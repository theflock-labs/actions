export type JsonObject = Record<string, unknown>;
export interface ToolCall { id: string; name: string; arguments: JsonObject }
export interface Turn { text: string; calls: ToolCall[]; usage: { input: number; output: number } }
export interface ToolDefinition { name: string; description: string; inputSchema: JsonObject; effect: 'read' | 'write' }
export type Message =
  | { role: 'user' | 'system'; content: string }
  | { role: 'assistant'; content: string; calls: ToolCall[] }
  | { role: 'tool'; content: string; callId: string };
export interface Provider {
  turn(messages: Message[], tools: ToolDefinition[], maxOutput: number, signal: AbortSignal): Promise<Turn>;
}
export interface Tool extends ToolDefinition { execute(args: JsonObject, signal: AbortSignal): Promise<unknown> }
export interface Step { tool: string; arguments: JsonObject; expectDigest?: string }
export interface Runbook {
  version: 1; taskDigest: string; reviewed: boolean;
  inputsDigest: string; steps: Step[]; result: JsonObject;
  guards: Record<string, string>;
}
export interface Receipt {
  version: 1; id: string; task: string; taskDigest: string; inputsDigest: string;
  mode: 'agent' | 'runbook' | 'dry-run'; status: 'verified' | 'unverified' | 'failed' | 'dry-run';
  startedAt: string; durationMs: number; summary: string; result: JsonObject;
  usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number; accountingComplete: boolean; modelCalls: number; toolCalls: number };
  steps: Array<Step & { resultDigest: string }>;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  error?: string; digest?: string;
}
