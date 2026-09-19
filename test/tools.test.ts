import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, type Server, type RequestListener } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { taskSchema } from '../src/config.js';
import { ToolRegistry } from '../src/tools.js';
import { Workspace } from '../src/workspace.js';
import { runCommand } from '../src/commands.js';
import { checkedUrl } from '../src/util.js';

let cwd: string; let server: Server | undefined; let registry: ToolRegistry | undefined;
beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(), 'flock-tools-')); });
afterEach(async () => {
  await registry?.close(); registry = undefined;
  if (server) await new Promise<void>(r => server!.close(() => r())); server = undefined;
  vi.unstubAllEnvs(); await rm(cwd, { recursive: true, force: true });
});
const signal = () => AbortSignal.timeout(5000);
async function http(handler: RequestListener): Promise<string> {
  server = createServer(handler);
  await new Promise<void>(r => server!.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
const schema = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false };
describe('tool adapters', () => {
  it('passes model arguments only through stdin, without shell interpolation', async () => {
    const payload = { text: '$(touch /tmp/should-not-exist); `echo bad`' };
    const output = await runCommand({ command: process.execPath, args: ['-e', 'process.stdin.pipe(process.stdout)'], env: [], timeoutSeconds: 5 }, cwd, payload, signal());
    expect(JSON.parse(output)).toEqual(payload);
  });
  it('does not inherit provider credentials into commands', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'secret-key');
    const output = await runCommand({ command: process.execPath, args: ['-e', 'console.log(process.env.OPENAI_API_KEY ?? "absent")'], env: [], timeoutSeconds: 5 }, cwd, {}, signal());
    expect(output.trim()).toBe('absent');
  });
  it('kills commands at timeout', async () => {
    await expect(runCommand({ command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], env: [], timeoutSeconds: 1 }, cwd, {}, signal())).rejects.toThrow('timed out');
  });
  it('bounds child process output', async () => {
    await expect(runCommand({ command: process.execPath, args: ['-e', 'process.stdout.write("x".repeat(140000))'], env: [], timeoutSeconds: 5 }, cwd, {}, signal())).rejects.toThrow('128 KiB');
  });
  it('encodes GET parameters without allowing endpoint replacement', async () => {
    let seen = '';
    const url = await http((req, res) => { seen = req.url ?? ''; res.end('{"ok":true}'); });
    const task = taskSchema.parse({ version: 1, name: 'http', prompt: 'test', tools: { get: { type: 'http', effect: 'read', description: 'Read', url: `${url}/safe`, allowInsecureLocalhost: true, inputSchema: schema } } });
    registry = new ToolRegistry(task, new Workspace(cwd)); await registry.initialize(signal());
    expect(await registry.tools.get('get')!.execute({ text: 'https://evil.example' }, signal())).toEqual({ ok: true });
    expect(seen).toBe('/safe?text=https%3A%2F%2Fevil.example');
  });
  it('rejects redirects rather than forwarding credentials', async () => {
    const url = await http((_req, res) => { res.writeHead(302, { Location: 'https://example.com' }); res.end(); });
    const task = taskSchema.parse({ version: 1, name: 'http', prompt: 'test', tools: { get: { type: 'http', effect: 'read', description: 'Read', url, allowInsecureLocalhost: true } } });
    registry = new ToolRegistry(task, new Workspace(cwd)); await registry.initialize(signal());
    await expect(registry.tools.get('get')!.execute({}, signal())).rejects.toThrow();
  });
  it('rejects remote plaintext and embedded credentials', () => {
    expect(() => checkedUrl('http://example.com', true)).toThrow('HTTPS');
    expect(() => checkedUrl('https://user:pass@example.com')).toThrow('credentials');
  });
  it('rejects write methods mislabeled read-only', async () => {
    const task = taskSchema.parse({ version: 1, name: 'http', prompt: 'test', tools: { post: { type: 'http', effect: 'read', method: 'POST', description: 'Wrong', url: 'https://example.com' } } });
    registry = new ToolRegistry(task, new Workspace(cwd)); await expect(registry.initialize(signal())).rejects.toThrow('effect=write');
  });
  it('connects to a real stdio MCP server and exposes only explicitly allowed tools', async () => {
    const task = taskSchema.parse({ version: 1, name: 'mcp', prompt: 'test', mcp: [{ name: 'fixture', transport: 'stdio', command: process.execPath, args: [resolve('test/fixtures/mcp-server.mjs')], tools: { echo: { effect: 'read' } } }] });
    registry = new ToolRegistry(task, new Workspace(cwd)); await registry.initialize(signal());
    expect([...registry.tools.keys()]).toEqual(['fixture__echo']);
    const result = await registry.tools.get('fixture__echo')!.execute({ text: 'hello' }, signal());
    expect(JSON.stringify(result)).toContain('hello');
  });
});
