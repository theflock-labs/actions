import type { Task } from './config.js';
import type { Message, Provider, ToolDefinition, Turn, JsonObject } from './types.js';
import { assertObject, checkedUrl, limitedText } from './util.js';

export function rates(task: Task): { input: number; output: number } {
  const m = task.model;
  if (m.inputUsdPerMillion !== undefined && m.outputUsdPerMillion !== undefined) return { input: m.inputUsdPerMillion, output: m.outputUsdPerMillion };
  if (m.provider === 'openai' && !m.baseUrl && ['gpt-5-mini', 'gpt-5-mini-2025-08-07'].includes(m.name)) return { input: 0.25, output: 2 };
  throw new Error('Configure inputUsdPerMillion and outputUsdPerMillion for this model; unknown pricing is never treated as free');
}
export function chatMessages(messages: Message[]): JsonObject[] {
  return messages.map(m => {
    if (m.role === 'assistant') return { role: m.role, content: m.content || null, ...(m.calls.length ? { tool_calls: m.calls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.arguments) } })) } : {}) };
    if (m.role === 'tool') return { role: 'tool', tool_call_id: m.callId, content: m.content };
    return m;
  });
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Provider did not return valid token usage; refusing unmetered execution');
  return value;
}
export function createProvider(task: Task): Provider {
  const { model } = task;
  const anthropic = model.provider === 'anthropic';
  const keyName = model.apiKeyEnv ?? (anthropic ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY');
  const key = process.env[keyName];
  // Local gateways can be keyless, but the author must explicitly select compatible + localhost.
  const endpoint = checkedUrl(model.baseUrl ?? (anthropic ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1'), model.allowInsecureLocalhost);
  if (!key && !(model.provider === 'openai-compatible' && model.allowInsecureLocalhost && endpoint.protocol === 'http:')) throw new Error(`Missing model credential: ${keyName}`);
  return { async turn(messages, tools, maxOutput, signal): Promise<Turn> {
    const headers: Record<string, string> = anthropic
      ? { 'x-api-key': key!, 'anthropic-version': '2023-06-01' }
      : (key ? { Authorization: `Bearer ${key}` } : {});
    const body = anthropic ? anthropicBody(model.name, messages, tools, maxOutput) : {
      model: model.name, messages: chatMessages(messages),
      tools: tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
      tool_choice: 'required', parallel_tool_calls: false,
      [model.provider === 'openai' ? 'max_completion_tokens' : 'max_tokens']: maxOutput,
    };
    const response = await fetch(`${endpoint.href.replace(/\/$/, '')}/${anthropic ? 'messages' : 'chat/completions'}`, {
      method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(90000)]),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Model API returned ${response.status}; requests are not automatically retried because they may be billable`); }
    const raw = JSON.parse(await limitedText(response, 1_000_000));
    return anthropic ? parseAnthropic(raw) : parseChat(raw);
  } };
}
export function parseChat(raw: any): Turn {
  const choice = raw.choices?.[0];
  if (!choice || choice.finish_reason === 'length' || choice.finish_reason === 'content_filter') throw new Error('Model response was missing, truncated, or filtered');
  const calls = (choice.message?.tool_calls ?? []).map((c: any) => {
    if (typeof c.id !== 'string' || typeof c.function?.name !== 'string') throw new Error('Malformed tool call');
    const args = JSON.parse(c.function.arguments); assertObject(args);
    return { id: c.id, name: c.function.name, arguments: args };
  });
  return { text: choice.message?.content ?? '', calls, usage: { input: count(raw.usage?.prompt_tokens), output: count(raw.usage?.completion_tokens) } };
}
export function anthropicBody(model: string, messages: Message[], tools: ToolDefinition[], maxOutput: number): JsonObject {
  const converted: Array<{ role: string; content: unknown[] }> = [];
  for (const m of messages.filter(m => m.role !== 'system')) {
    let role: string; let content: unknown[];
    if (m.role === 'tool') { role = 'user'; content = [{ type: 'tool_result', tool_use_id: m.callId, content: m.content }]; }
    else if (m.role === 'assistant') {
      role = 'assistant'; content = [...(m.content ? [{ type: 'text', text: m.content }] : []), ...m.calls.map(c => ({ type: 'tool_use', id: c.id, name: c.name, input: c.arguments }))];
    } else { role = 'user'; content = [{ type: 'text', text: m.content }]; }
    const previous = converted.at(-1);
    if (previous?.role === role) previous.content.push(...content); else converted.push({ role, content });
  }
  return { model, system: messages.filter(m => m.role === 'system').map(m => m.content).join('\n'), messages: converted, max_tokens: maxOutput,
    tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema })), tool_choice: { type: 'any', disable_parallel_tool_use: true } };
}
export function parseAnthropic(raw: any): Turn {
  if (!Array.isArray(raw.content) || raw.stop_reason === 'max_tokens') throw new Error('Model response was missing or truncated');
  const calls = raw.content.filter((c: any) => c.type === 'tool_use').map((c: any) => {
    if (typeof c.id !== 'string' || typeof c.name !== 'string') throw new Error('Malformed tool call');
    assertObject(c.input); return { id: c.id, name: c.name, arguments: c.input };
  });
  return { text: raw.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n'), calls,
    usage: { input: count(raw.usage?.input_tokens) + count(raw.usage?.cache_creation_input_tokens ?? 0) + count(raw.usage?.cache_read_input_tokens ?? 0), output: count(raw.usage?.output_tokens) } };
}
