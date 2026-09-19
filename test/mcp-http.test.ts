import { it, expect } from 'vitest';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { taskSchema } from '../src/config.js';
import { ToolRegistry } from '../src/tools.js';
import { Workspace } from '../src/workspace.js';

it('negotiates Streamable HTTP MCP, validates schemas and invokes only the allowlist', async () => {
  const mcp = new Server({ name: 'http-fixture', version: '1.0.0' }, { capabilities: { tools: {} } });
  mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [
    { name: 'echo', description: 'echo', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } },
    { name: 'delete_all', description: 'not authorized', inputSchema: { type: 'object' } },
  ] }));
  mcp.setRequestHandler(CallToolRequestSchema, async req => ({ content: [{ type: 'text', text: String(req.params.arguments?.text) }] }));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID, enableJsonResponse: true });
  await mcp.connect(transport);
  const http = createServer((req, res) => { void transport.handleRequest(req, res); });
  await new Promise<void>(r => http.listen(0, '127.0.0.1', r));
  const task = taskSchema.parse({ version: 1, name: 'HTTP MCP', prompt: 'test', mcp: [{
    name: 'remote', transport: 'http', url: `http://127.0.0.1:${(http.address() as AddressInfo).port}/mcp`, allowInsecureLocalhost: true,
    tools: { echo: { effect: 'read' } },
  }] });
  const registry = new ToolRegistry(task, new Workspace(process.cwd()));
  try {
    await registry.initialize(AbortSignal.timeout(5000));
    expect([...registry.tools.keys()]).toEqual(['remote__echo']);
    expect(JSON.stringify(await registry.tools.get('remote__echo')!.execute({ text: 'remote works' }, AbortSignal.timeout(5000)))).toContain('remote works');
    await expect(registry.tools.get('remote__echo')!.execute({ text: 2 }, AbortSignal.timeout(5000))).rejects.toThrow('Schema');
  } finally {
    await registry.close(); await mcp.close();
    http.closeAllConnections(); await new Promise<void>(r => http.close(() => r()));
  }
});
