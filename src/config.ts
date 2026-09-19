import { z } from 'zod';
import { readFile } from 'node:fs/promises';

const jsonObject = z.record(z.string(), z.unknown());
const name = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/);
const schema = jsonObject.default({ type: 'object', properties: {}, additionalProperties: false });
const auth = z.strictObject({ env: z.string().regex(/^[A-Z_][A-Z0-9_]*$/), header: z.string().default('Authorization'), prefix: z.string().default('Bearer ') });
const command = z.strictObject({
  command: z.string().min(1), args: z.array(z.string()).default([]),
  env: z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/)).default([]),
  timeoutSeconds: z.number().int().min(1).max(300).default(30),
});
const base = { description: z.string().min(1), inputSchema: schema, effect: z.enum(['read', 'write']).default('write') };
const tool = z.discriminatedUnion('type', [
  z.strictObject({ ...base, type: z.literal('command'), ...command.shape }),
  z.strictObject({ ...base, type: z.literal('http'), url: z.url(), method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'), headers: z.record(z.string(), z.string()).default({}), auth: auth.optional(), allowInsecureLocalhost: z.boolean().default(false) }),
]);
const verifier = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('command'), name: z.string().min(1), ...command.shape }),
  z.strictObject({ type: z.literal('file'), name: z.string().min(1), path: z.string().min(1), contains: z.string().optional(), jsonSchema: jsonObject.optional() }),
]);
const mcp = z.strictObject({
  name, transport: z.enum(['stdio', 'http']), command: z.string().optional(), args: z.array(z.string()).default([]),
  env: z.array(z.string()).default([]), url: z.url().optional(), auth: auth.optional(),
  allowInsecureLocalhost: z.boolean().default(false),
  tools: z.record(name, z.strictObject({ effect: z.enum(['read', 'write']), description: z.string().optional() })).refine(v => Object.keys(v).length > 0, 'An explicit MCP tool allowlist is required'),
});
export const taskSchema = z.strictObject({
  $schema: z.string().optional(), version: z.literal(1), name: z.string().min(1).max(100),
  prompt: z.string().min(1).max(100000), inputs: jsonObject.default({}), context: z.array(z.string()).max(20).default([]),
  model: z.strictObject({
    provider: z.enum(['openai', 'anthropic', 'openai-compatible']).default('openai'),
    name: z.string().min(1).default('gpt-5-mini'), baseUrl: z.url().optional(), apiKeyEnv: z.string().optional(),
    allowInsecureLocalhost: z.boolean().default(false),
    inputUsdPerMillion: z.number().nonnegative().optional(), outputUsdPerMillion: z.number().nonnegative().optional(),
  }).default({ provider: 'openai', name: 'gpt-5-mini', allowInsecureLocalhost: false }),
  budget: z.strictObject({
    maxTurns: z.number().int().min(1).max(100).default(8), maxToolCalls: z.number().int().min(1).max(500).default(24),
    maxInputTokens: z.number().int().min(1).max(10000000).default(100000),
    maxOutputTokens: z.number().int().min(1).max(1000000).default(16000),
    maxOutputTokensPerTurn: z.number().int().min(1).max(128000).default(2048),
    maxCostUsd: z.number().nonnegative().max(1000).default(1),
    maxDurationSeconds: z.number().int().min(1).max(3600).default(300),
  }).prefault({}),
  permissions: z.strictObject({
    write: z.boolean().default(false), readPaths: z.array(z.string().min(1)).default([]), writePaths: z.array(z.string().min(1)).default([]),
  }).prefault({}),
  tools: z.record(name, tool).default({}), mcp: z.array(mcp).max(10).default([]),
  resultSchema: jsonObject.default({ type: 'object', additionalProperties: true }),
  verifiers: z.array(verifier).max(20).default([]),
});
export type Task = z.infer<typeof taskSchema>;
export type ToolConfig = Task['tools'][string];
export type CommandConfig = z.infer<typeof command>;
export type Auth = z.infer<typeof auth>;
export async function loadTask(path: string): Promise<Task> {
  const text = await readFile(path, 'utf8');
  if (Buffer.byteLength(text) > 1_000_000) throw new Error('Task file exceeds 1 MB');
  return taskSchema.parse(JSON.parse(text));
}
