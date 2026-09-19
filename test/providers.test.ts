import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseChat, parseAnthropic, anthropicBody, chatMessages, createProvider, rates } from '../src/providers.js';
import { taskSchema } from '../src/config.js';
import type { Message } from '../src/types.js';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const response = { choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ id: 'one', type: 'function', function: { name: 'finish', arguments: '{"summary":"Done","result":{}}' } }] } }], usage: { prompt_tokens: 14, completion_tokens: 6 } };
const messages: Message[] = [
  { role: 'system', content: 'trusted' }, { role: 'user', content: 'input' },
  { role: 'assistant', content: '', calls: [{ id: '1', name: 'read', arguments: {} }] },
  { role: 'tool', callId: '1', content: 'result' },
];
describe('provider protocols', () => {
  it('parses actual OpenAI Chat Completions tool shape and usage', () => {
    expect(parseChat(response)).toMatchObject({ calls: [{ name: 'finish', arguments: { result: {} } }], usage: { input: 14, output: 6 } });
  });
  it('rejects missing metering', () => { expect(() => parseChat({ ...response, usage: undefined })).toThrow('token usage'); });
  it('rejects truncated tool arguments', () => { expect(() => parseChat({ choices: [{ finish_reason: 'length' }] })).toThrow('truncated'); });
  it('rejects arrays as tool arguments', () => {
    expect(() => parseChat({ ...response, choices: [{ message: { tool_calls: [{ id: '1', function: { name: 'write', arguments: '[]' } }] } }] })).toThrow('JSON object');
  });
  it('accounts for Anthropic cache tokens conservatively', () => {
    expect(parseAnthropic({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: '1', name: 'finish', input: {} }], usage: { input_tokens: 10, cache_creation_input_tokens: 3, cache_read_input_tokens: 7, output_tokens: 2 } }).usage).toEqual({ input: 20, output: 2 });
  });
  it('round-trips tool call IDs in both protocols', () => {
    expect(chatMessages(messages)[3]).toMatchObject({ role: 'tool', tool_call_id: '1' });
    const body = anthropicBody('claude', messages, [], 100);
    expect(body.system).toBe('trusted'); expect(JSON.stringify(body.messages)).toContain('tool_use_id');
  });
  it('requires pricing for custom endpoints and unknown models', () => {
    const task = taskSchema.parse({ version: 1, name: 'test', prompt: 'test', model: { provider: 'openai-compatible', name: 'custom', baseUrl: 'https://gateway.example/v1' } });
    expect(() => rates(task)).toThrow('Configure');
  });
  it('sends a non-streaming bounded request without following redirects', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'not-a-real-key');
    const fetch = vi.fn(async () => new Response(JSON.stringify(response), { status: 200 })); vi.stubGlobal('fetch', fetch);
    const task = taskSchema.parse({ version: 1, name: 'test', prompt: 'test' });
    const turn = await createProvider(task).turn(messages, [], 2048, AbortSignal.timeout(5000));
    expect(turn.usage.input).toBe(14);
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.redirect).toBe('error'); expect(JSON.parse(init.body as string).max_completion_tokens).toBe(2048);
  });
  it('does not echo provider error bodies that could contain secrets', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'not-a-real-key'); vi.stubGlobal('fetch', vi.fn(async () => new Response('provider-secret-data', { status: 429 })));
    const task = taskSchema.parse({ version: 1, name: 'test', prompt: 'test' });
    await expect(createProvider(task).turn(messages, [], 100, AbortSignal.timeout(5000))).rejects.toThrow('429');
  });
});
