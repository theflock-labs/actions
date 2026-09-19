import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { readdir } from 'node:fs/promises';
import type { Task } from './config.js';
import type { Tool, JsonObject } from './types.js';
import { Workspace } from './workspace.js';
import { commandEnv, runCommand } from './commands.js';
import { validator, checkedUrl, authHeaders, limitedText } from './util.js';
import { version } from './version.js';

const pathSchema = { type: 'object', properties: { path: { type: 'string', minLength: 1 } }, required: ['path'], additionalProperties: false };
export class ToolRegistry {
  readonly tools = new Map<string, Tool>();
  private clients: Client[] = [];
  constructor(readonly task: Task, readonly workspace: Workspace) {}
  add(tool: Tool): void {
    if (this.tools.has(tool.name) || tool.name === 'finish') throw new Error(`Reserved or duplicate tool: ${tool.name}`);
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(tool.name)) throw new Error(`Invalid tool name: ${tool.name}`);
    const validate = validator(tool.inputSchema);
    this.tools.set(tool.name, { ...tool, execute: async (args, signal) => {
      signal.throwIfAborted(); validate(args);
      if (tool.effect === 'write' && !this.task.permissions.write) throw new Error(`Write permission denied: ${tool.name}`);
      return tool.execute(args, signal);
    } });
  }
  async initialize(signal: AbortSignal): Promise<void> {
    const { task, workspace } = this;
    if (task.permissions.readPaths.length) {
      this.add({ name: 'read_file', description: 'Read an explicitly allowed UTF-8 file, up to 128 KiB.', inputSchema: pathSchema, effect: 'read',
        execute: async (args) => ({ content: await workspace.read(args.path as string, task.permissions.readPaths) }) });
      this.add({ name: 'list_files', description: 'List immediate entries in an explicitly allowed directory. Symlinks are excluded.', inputSchema: pathSchema, effect: 'read',
        execute: async (args) => {
          const path = await workspace.path(args.path as string, task.permissions.readPaths);
          const entries = await readdir(path, { withFileTypes: true });
          return entries.filter(e => !e.isSymbolicLink()).slice(0, 500).map(e => ({ name: e.name, directory: e.isDirectory() }));
        } });
    }
    if (task.permissions.write && task.permissions.writePaths.length) this.add({
      name: 'write_file', description: 'Write a UTF-8 file within an explicitly allowed path, up to 128 KiB.', effect: 'write',
      inputSchema: { ...pathSchema, properties: { ...pathSchema.properties, content: { type: 'string' } }, required: ['path', 'content'] },
      execute: async args => { await workspace.write(args.path as string, args.content as string, task.permissions.writePaths); return { written: args.path }; },
    });
    for (const [name, config] of Object.entries(task.tools)) {
      if (config.effect === 'write' && !task.permissions.write) continue;
      if (config.type === 'command') this.add({ ...config, name, execute: (args, signal) => runCommand(config, workspace.root, args, signal) });
      else {
        const url = checkedUrl(config.url, config.allowInsecureLocalhost);
        if (config.method !== 'GET' && config.effect === 'read') throw new Error(`HTTP ${config.method} must declare effect=write`);
        this.add({ ...config, name, execute: async (args, signal) => {
          const target = new URL(url);
          if (config.method === 'GET') {
            for (const [key, value] of Object.entries(args)) {
              if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') throw new Error('GET arguments must be scalar query values');
              if (target.searchParams.has(key)) throw new Error(`Cannot override fixed query parameter: ${key}`);
              target.searchParams.set(key, String(value));
            }
          }
          const response = await fetch(target, { method: config.method, redirect: 'error', signal,
            headers: { 'Content-Type': 'application/json', ...config.headers, ...authHeaders(config.auth) },
            ...(config.method !== 'GET' ? { body: JSON.stringify(args) } : {}),
          });
          if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP tool ${name} returned ${response.status}`); }
          const body = await limitedText(response);
          try { return JSON.parse(body); } catch { return body; }
        } });
      }
    }
    for (const server of task.mcp) {
      signal.throwIfAborted();
      const client = new Client({ name: 'flock-actions', version });
      this.clients.push(client);
      const transport = server.transport === 'stdio'
        ? new StdioClientTransport({ command: server.command ?? (() => { throw new Error('MCP stdio requires command'); })(), args: server.args, env: commandEnv(server.env) as Record<string, string>, stderr: 'pipe', cwd: workspace.root })
        : new StreamableHTTPClientTransport(checkedUrl(server.url ?? '', server.allowInsecureLocalhost), { requestInit: { headers: authHeaders(server.auth), redirect: 'error' } });
      const cancel = () => { void client.close(); };
      signal.addEventListener('abort', cancel, { once: true });
      try {
        await client.connect(transport, { timeout: 15000 });
        const discovered = new Map<string, { name: string; description?: string; inputSchema: JsonObject }>();
        let cursor: string | undefined;
        for (let page = 0; page < 20; page++) {
          const list = await client.listTools(cursor ? { cursor } : undefined, { signal, timeout: 15000 });
          for (const tool of list.tools) discovered.set(tool.name, tool);
          cursor = list.nextCursor;
          if (!cursor) break;
        }
        if (cursor) throw new Error('MCP tool discovery exceeds 20 pages');
        for (const [remoteName, policy] of Object.entries(server.tools)) {
          if (policy.effect === 'write' && !task.permissions.write) continue;
          const remote = discovered.get(remoteName);
          if (!remote) throw new Error(`MCP tool not found: ${server.name}/${remoteName}`);
          this.add({ name: `${server.name}__${remoteName}`, description: policy.description ?? remote.description ?? remoteName, inputSchema: remote.inputSchema, effect: policy.effect,
            execute: async (args, signal) => {
              const result = await client.callTool({ name: remoteName, arguments: args }, undefined, { signal, timeout: 30000 });
              if (result.isError) throw new Error(`MCP tool failed: ${remoteName}`);
              return result;
            } });
        }
      } finally { signal.removeEventListener('abort', cancel); }
    }
    if (this.tools.size > 64) throw new Error('At most 64 tools may be exposed');
  }
  async close(): Promise<void> { await Promise.allSettled(this.clients.map(client => client.close())); }
}
