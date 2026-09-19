import { createHash } from 'node:crypto';
import AjvModule from 'ajv';
import type { Auth } from './config.js';
import type { JsonObject } from './types.js';

const Ajv = AjvModule.default;
const ajv = new Ajv({ allErrors: true, strict: true, ownProperties: true });
export function canonical(value: unknown): string {
  if (value === undefined) throw new Error('Undefined is not JSON');
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as JsonObject)[k])}`).join(',')}}`;
}
export const digest = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex');
export function validator(schema: JsonObject): (data: unknown) => void {
  const validate = ajv.compile(schema);
  return (data) => { if (!validate(data)) throw new Error(`Schema validation failed: ${ajv.errorsText(validate.errors)}`); };
}
export function assertObject(value: unknown): asserts value is JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object');
}
export function redact(text: string, env: NodeJS.ProcessEnv = process.env, extra: string[] = []): string {
  const secrets = [...extra, ...Object.entries(env).filter(([key]) => /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/.test(key)).map(([,v]) => v ?? '')];
  for (const secret of secrets.filter(v => v.length >= 4).sort((a,b) => b.length-a.length)) text = text.split(secret).join('[REDACTED]');
  return text;
}
// Redact untrusted JSON data structurally. Never rewrite serialized JSON: a
// coincidental match in a number can make the document invalid or corrupt usage.
export function redactData(value: unknown, sanitize: (text: string) => string = redact): unknown {
  if (typeof value === 'string') return sanitize(value);
  if (Array.isArray(value)) return value.map(item => redactData(item, sanitize));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [sanitize(key), redactData(item, sanitize)]));
  return value;
}
export function checkedUrl(value: string, allowLocal = false): URL {
  const url = new URL(value);
  if (url.username || url.password || url.hash) throw new Error('URL must not contain credentials or a fragment');
  if (url.protocol !== 'https:' && !(allowLocal && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('HTTPS required; local HTTP must be explicitly enabled');
  return url;
}
export function authHeaders(auth?: Auth): Record<string, string> {
  if (!auth) return {};
  const value = process.env[auth.env];
  if (!value) throw new Error(`Missing credential environment variable: ${auth.env}`);
  return { [auth.header]: `${auth.prefix}${value}` };
}
export async function limitedText(response: Response, maxBytes = 262144): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error(`Response exceeds ${maxBytes} bytes`); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}
