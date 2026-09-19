import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, symlink, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { taskSchema, type Task } from '../src/config.js';
import { runTask } from '../src/engine.js';
import { promote, taskDigest } from '../src/runbook.js';
import { digest } from '../src/util.js';
import { Workspace } from '../src/workspace.js';
import type { Provider, ToolCall, Runbook } from '../src/types.js';

let cwd: string;
beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(), 'flock-test-')); });
afterEach(async () => { vi.unstubAllEnvs(); await rm(cwd, { recursive: true, force: true }); });
const task = (overrides: Record<string, unknown> = {}): Task => taskSchema.parse({ version: 1, name: 'test', prompt: 'Create an accurate report.', ...overrides });
const call = (name: string, args: Record<string, unknown> = {}, id = Math.random().toString()): ToolCall => ({ id, name, arguments: args });
const finish = (result = {}) => call('finish', { summary: 'Done', result });
function provider(turns: ToolCall[][]): Provider {
  let i = 0;
  return { turn: vi.fn(async () => ({ text: '', calls: turns[i++] ?? [], usage: { input: 50, output: 10 } })) };
}
const writing = () => task({ permissions: { write: true, readPaths: ['source.txt'], writePaths: ['report.txt'] }, verifiers: [{ type: 'file', name: 'content', path: 'report.txt', contains: 'accurate' }] });
function book(t: Task, overrides: Partial<Runbook> = {}): Runbook {
  return { version: 1, reviewed: true, taskDigest: taskDigest(t), inputsDigest: digest(t.inputs), guards: {}, steps: [], result: {}, ...overrides };
}
describe('outcome engine', () => {
  it('does not confuse model prose with independent verification', async () => {
    const r = await runTask(task(), { cwd, provider: provider([[finish()]]) });
    expect(r.status).toBe('unverified'); expect(r.usage.modelCalls).toBe(1);
  });
  it('writes through a capability, then checks the actual file', async () => {
    const r = await runTask(writing(), { cwd, provider: provider([[call('write_file', { path: 'report.txt', content: 'accurate' })], [finish()]]) });
    expect(r.status).toBe('verified'); expect(r.checks[0]?.passed).toBe(true);
    expect(await readFile(join(cwd, 'report.txt'), 'utf8')).toBe('accurate');
  });
  it('feeds failed verification back to the agent for a bounded repair', async () => {
    const p = provider([[call('write_file', { path: 'report.txt', content: 'wrong' })], [finish()], [call('write_file', { path: 'report.txt', content: 'accurate' })], [finish()]]);
    const r = await runTask(writing(), { cwd, provider: p });
    expect(r.status).toBe('verified'); expect(r.usage.modelCalls).toBe(4);
    expect(JSON.stringify(vi.mocked(p.turn).mock.calls[2]?.[0])).toContain('accepted');
  });
  it('fails when the agent claims completion without satisfying the contract', async () => {
    const t = writing(); t.budget.maxTurns = 1;
    const r = await runTask(t, { cwd, provider: provider([[finish()]]) });
    expect(r.status).toBe('failed'); expect(r.checks[0]?.passed).toBe(false);
  });
  it('rejects an undeclared shell capability', async () => {
    const r = await runTask(task(), { cwd, provider: provider([[call('shell', { command: 'echo attacker' })]]) });
    expect(r.status).toBe('failed'); expect(r.error).toContain('Tool not allowed');
  });
  it('validates arguments before executing tools', async () => {
    const r = await runTask(writing(), { cwd, provider: provider([[call('write_file', { path: 'report.txt', content: 4 })]]) });
    expect(r.error).toContain('Schema validation');
    await expect(readFile(join(cwd, 'report.txt'))).rejects.toThrow();
  });
  it('does not expose write tools without write permission', async () => {
    const r = await runTask(task(), { cwd, provider: provider([[call('write_file', { path: 'report.txt', content: 'accurate' })]]) });
    expect(r.error).toContain('Tool not allowed');
  });
  it('requires a verifier for write-enabled tasks', async () => {
    const r = await runTask(task({ permissions: { write: true } }), { cwd, provider: provider([[finish()]]) });
    expect(r.error).toContain('independent verifier'); expect(r.usage.modelCalls).toBe(0);
  });
  it('rejects invalid structured results', async () => {
    const t = task({ resultSchema: { type: 'object', required: ['label'], properties: { label: { enum: ['bug', 'question'] } }, additionalProperties: false } });
    const r = await runTask(t, { cwd, provider: provider([[finish({ label: 'delete-everything' })]]) });
    expect(r.error).toContain('Schema validation');
  });
  it('refuses to make a model call when budget is insufficient', async () => {
    const p = provider([[finish()]]);
    const r = await runTask(task({ budget: { maxCostUsd: 0 } }), { cwd, provider: p });
    expect(r.status).toBe('failed'); expect(p.turn).not.toHaveBeenCalled();
  });
  it('marks billing evidence incomplete when an API request fails without usage', async () => {
    const r = await runTask(task(), { cwd, provider: { turn: async () => { throw new Error('Connection reset after submission'); } } });
    expect(r.status).toBe('failed'); expect(r.usage.modelCalls).toBe(1); expect(r.usage.accountingComplete).toBe(false);
  });
  it('checks URL policy even in a credential-free dry run', async () => {
    const t = task({ tools: { unsafe: { type: 'http', description: 'Bad URL', url: 'http://example.com', effect: 'read' } } });
    const r = await runTask(t, { cwd, dryRun: true }); expect(r.error).toContain('HTTPS');
  });
  it('checks returned usage before executing side effects', async () => {
    const t = writing(); t.budget.maxOutputTokens = 10;
    const p: Provider = { turn: async () => ({ text: '', calls: [call('write_file', { path: 'report.txt', content: 'accurate' })], usage: { input: 1, output: 11 } }) };
    const r = await runTask(t, { cwd, provider: p });
    expect(r.error).toContain('exceeded budget'); expect(r.usage.toolCalls).toBe(0);
  });
  it('enforces tool call limit across turns', async () => {
    await writeFile(join(cwd, 'source.txt'), 'data');
    const t = task({ permissions: { readPaths: ['source.txt'] }, budget: { maxToolCalls: 1 } });
    const r = await runTask(t, { cwd, provider: provider([[call('read_file', { path: 'source.txt' })], [call('read_file', { path: 'source.txt' })], [finish()]]) });
    expect(r.error).toContain('Tool call budget'); expect(r.steps.length).toBe(1);
  });
  it('rejects duplicate calls before repeated side effects', async () => {
    const r = await runTask(writing(), { cwd, provider: provider([[call('write_file', { path: 'report.txt', content: 'accurate' }, 'same')], [call('write_file', { path: 'report.txt', content: 'bad' }, 'same')]]) });
    expect(r.error).toContain('Duplicate'); expect(await readFile(join(cwd, 'report.txt'), 'utf8')).toBe('accurate');
  });
  it('never executes tools in a mixed finish turn', async () => {
    const r = await runTask(writing(), { cwd, provider: provider([[call('write_file', { path: 'report.txt', content: 'accurate' }), finish()]]) });
    expect(r.error).toContain('only call'); expect(r.steps).toHaveLength(0);
  });
  it('redacts known credentials from results, steps, and errors', async () => {
    vi.stubEnv('SERVICE_TOKEN', 'super-secret-token');
    const r = await runTask(task(), { cwd, provider: provider([[finish({ message: 'super-secret-token' })]]) });
    expect(JSON.stringify(r)).not.toContain('super-secret-token'); expect(r.result.message).toBe('[REDACTED]');
    const { digest: hash, ...body } = r; expect(digest(body)).toBe(hash);
  });
  it('redacts secret data without corrupting numeric usage fields', async () => {
    vi.stubEnv('SHORT_TOKEN', '1234');
    const p: Provider = { turn: async () => ({ text: '', calls: [finish({ token: '1234' })], usage: { input: 1234, output: 1 } }) };
    const r = await runTask(task(), { cwd, provider: p });
    expect(r.status).toBe('unverified'); expect(r.usage.inputTokens).toBe(1234); expect(r.result.token).toBe('[REDACTED]');
  });
  it('keeps redacted model input data valid JSON when it contains matching numeric values', async () => {
    vi.stubEnv('SHORT_TOKEN', '1234');
    const p: Provider = { turn: async messages => {
      const text = messages.find(m => m.role === 'user')!.content.split('Untrusted input data:\n')[1]!;
      expect(JSON.parse(text).inputs).toEqual({ count: 1234, token: '[REDACTED]' });
      return { text: '', calls: [finish()], usage: { input: 10, output: 1 } };
    } };
    const r = await runTask(task({ inputs: { count: 1234, token: '1234' } }), { cwd, provider: p });
    expect(r.status).toBe('unverified');
  });
  it('validates a dry run without a model key or executing a command', async () => {
    const r = await runTask(task({ tools: { never: { type: 'command', description: 'Must not execute', command: 'does-not-exist', effect: 'read' } } }), { cwd, dryRun: true });
    expect(r.status).toBe('dry-run'); expect(r.usage.modelCalls).toBe(0);
  });
  it('stops before execution on cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    const r = await runTask(task(), { cwd, provider: provider([[finish()]]), signal: controller.signal });
    expect(r.status).toBe('failed'); expect(r.usage.modelCalls).toBe(0);
  });
});
describe('runbooks', () => {
  it('executes and verifies without constructing a provider', async () => {
    const t = writing(); t.model.name = 'nonexistent';
    const r = await runTask(t, { cwd, runbook: book(t, { steps: [{ tool: 'write_file', arguments: { path: 'report.txt', content: 'accurate' } }] }) });
    expect(r.status).toBe('verified'); expect(r.usage.modelCalls).toBe(0); expect(r.usage.estimatedCostUsd).toBe(0);
  });
  it('rejects an unreviewed runbook', async () => {
    const t = task(); const r = await runTask(t, { cwd, runbook: book(t, { reviewed: false }) });
    expect(r.error).toContain('explicit review');
  });
  it('rejects changed contracts and input data', async () => {
    const t = task(); const b = book(t); t.inputs = { issue: 2 };
    const r = await runTask(t, { cwd, runbook: b }); expect(r.error).toContain('changed');
  });
  it('rejects a read-after-write runbook before the first mutation', async () => {
    const t = writing();
    const b = book(t, { steps: [{ tool: 'write_file', arguments: { path: 'report.txt', content: 'accurate' } }, { tool: 'read_file', arguments: { path: 'source.txt' }, expectDigest: digest({ content: '' }) }] });
    const r = await runTask(t, { cwd, runbook: b });
    expect(r.error).toContain('precede writes'); expect(r.steps).toHaveLength(0);
    await expect(readFile(join(cwd, 'report.txt'))).rejects.toThrow();
  });
  it('blocks writes when observed prerequisite data changed', async () => {
    const t = writing(); await writeFile(join(cwd, 'source.txt'), 'new');
    const b = book(t, { steps: [{ tool: 'read_file', arguments: { path: 'source.txt' }, expectDigest: digest({ content: 'old' }) }, { tool: 'write_file', arguments: { path: 'report.txt', content: 'accurate' } }] });
    const r = await runTask(t, { cwd, runbook: b });
    expect(r.error).toContain('observation changed'); await expect(readFile(join(cwd, 'report.txt'))).rejects.toThrow();
  });
  it('promotes verified receipts into explicitly unreviewed guarded runbooks', async () => {
    const t = writing(); await writeFile(join(cwd, 'source.txt'), 'stable');
    const r = await runTask(t, { cwd, provider: provider([[call('read_file', { path: 'source.txt' })], [call('write_file', { path: 'report.txt', content: 'accurate' })], [finish()]]) });
    const b = promote(t, r); expect(b.reviewed).toBe(false); expect(b.steps[0]?.expectDigest).toBe(digest({ content: 'stable' }));
    b.reviewed = true; const replay = await runTask(t, { cwd, runbook: b }); expect(replay.status).toBe('verified');
  });
  it('rejects corrupted receipt promotion', async () => {
    const t = task(); const r = await runTask(t, { cwd, provider: provider([[finish()]]) }); r.summary = 'tampered';
    expect(() => promote(t, r)).toThrow('checksum');
  });
  it('refuses to promote a trace with reads after writes', async () => {
    const t = writing(); await writeFile(join(cwd, 'source.txt'), 'stable');
    const r = await runTask(t, { cwd, provider: provider([[call('write_file', { path: 'report.txt', content: 'accurate' })], [call('read_file', { path: 'source.txt' })], [finish()]]) });
    expect(() => promote(t, r)).toThrow('read-after-write');
  });
});
describe('filesystem boundary', () => {
  it.each(['../outside.txt', '/etc/passwd', '.git/config', '.env', '.env.production', '.aws/credentials', '.npmrc', '.netrc', '.docker/config.json', '.kube/config', 'key.pem', 'a\\b', 'report.txt:stream', '.env ', '.env.'])('rejects %s', async path => {
    await expect(new Workspace(cwd).read(path, ['.'])).rejects.toThrow();
  });
  it('rejects a symlink even if it points to a readable file', async () => {
    await writeFile(join(cwd, 'source.txt'), 'private'); await symlink(join(cwd, 'source.txt'), join(cwd, 'link.txt'));
    await expect(new Workspace(cwd).read('link.txt', ['.'])).rejects.toThrow('Symlinks');
  });
  it('rejects hard links', async () => {
    await writeFile(join(cwd, 'source.txt'), 'private'); await link(join(cwd, 'source.txt'), join(cwd, 'link.txt'));
    await expect(new Workspace(cwd).read('link.txt', ['.'])).rejects.toThrow('Hard-linked');
  });
  it('protects workflow definitions and task contracts from writes', async () => {
    await expect(new Workspace(cwd).write('.github/workflows/attack.yml', 'attack', ['.'])).rejects.toThrow('Protected');
    await expect(new Workspace(cwd).write('.GITHUB/workflows/attack.yml', 'attack', ['.'])).rejects.toThrow('Protected');
    await expect(new Workspace(cwd).write('.flock-tasks/task.json', '{}', ['.'])).rejects.toThrow('Protected');
  });
  it('does not treat file prefixes as directory grants', async () => {
    await expect(new Workspace(cwd).write('docs-private/readme.md', 'x', ['docs/'])).rejects.toThrow('not allowed');
  });
});
