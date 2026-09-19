import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { taskSchema } from '../src/config.js';
import { caseDigest, evaluateTask, scoreEvaluation, validateSuite, saveEvaluationReport, type EvaluationSuite, type EvaluationCase, type EvaluationResults } from '../src/evaluation.js';
import { digest } from '../src/util.js';
import type { Provider } from '../src/types.js';

let cwd: string;
beforeEach(async () => { cwd = await mkdtemp(join(tmpdir(), 'flock-eval-test-')); });
afterEach(async () => { vi.unstubAllEnvs(); await rm(cwd, { recursive: true, force: true }); });
const suite = (count = 2): EvaluationSuite => validateSuite({ version: 1, name: 'Test corpus', provenance: { kind: 'synthetic', description: 'Unit test fixtures, not measured agent quality.' },
  cases: Array.from({ length: count }, (_, i) => ({ id: `case-${i}`, category: i ? 'ambiguous' : 'ordinary', inputs: { text: `input ${i}` }, expect: { resultSchema: { type: 'object', required: ['label'], properties: { label: { const: 'bug' } } } } })),
});
const results = (s: EvaluationSuite, labels: string[]): EvaluationResults => ({ version: 1, suiteDigest: digest(s), engine: 'test-baseline', method: 'deterministic', timingScope: 'Unit test synthetic timing.', cases: labels.map((label, i) => ({ caseId: s.cases[i]!.id, caseDigest: caseDigest(s.cases[i]!), status: 'completed', result: { label }, files: {}, durationMs: (i + 1) * 10, estimatedCostUsd: 0.01, accountingComplete: true, modelCalls: 1 })) });
const task = () => taskSchema.parse({ version: 1, name: 'Triage', prompt: 'Classify the input.' });
const provider = (label: string): Provider => ({ turn: vi.fn(async () => ({ text: '', calls: [{ id: 'finish', name: 'finish', arguments: { summary: 'Classified', result: { label } } }], usage: { input: 10, output: 2 } })) });

describe('fair, provenance-aware scoring', () => {
  it('counts wrong answers and missing cases in the full denominator', () => {
    const s = suite(3); const report = scoreEvaluation(s, results(s, ['bug', 'feature']));
    expect(report.source).toBe('imported-self-reported');
    expect(report.totals).toMatchObject({ cases: 3, executed: 2, passed: 1, failed: 1, notRun: 1, passRate: 1 / 3, passRateAmongExecuted: 0.5 });
    expect(report.categories).toEqual([{ category: 'ordinary', cases: 1, executed: 1, passed: 1 }, { category: 'ambiguous', cases: 2, executed: 1, passed: 0 }]);
  });
  it('includes failed-case cost in cost per accepted case', () => {
    const s = suite(); const report = scoreEvaluation(s, results(s, ['bug', 'wrong']));
    expect(report.totals.costPerPassedCaseUsd).toBe(0.02);
    expect(report.totals.p50DurationMs).toBe(10); expect(report.totals.p95DurationMs).toBe(20);
  });
  it('does not accept a failed run even if its result matches the expected label', () => {
    const s = suite(1); const r = results(s, ['bug']); r.cases[0]!.status = 'failed';
    expect(scoreEvaluation(s, r).totals.passed).toBe(0);
  });
  it('never turns missing cost or model-call evidence into a complete zero', () => {
    const s = suite(1); const r = results(s, ['bug']); r.cases[0]!.estimatedCostUsd = null; r.cases[0]!.accountingComplete = false; r.cases[0]!.modelCalls = null;
    expect(scoreEvaluation(s, r).totals).toMatchObject({ accountingComplete: false, costPerPassedCaseUsd: null, allModelCallsKnown: false });
    r.cases[0]!.accountingComplete = true; expect(() => scoreEvaluation(s, r)).toThrow('numeric cost');
  });
  it('rejects stale suite fingerprints, changed inputs and duplicate imports', () => {
    const s = suite(); const r = results(s, ['bug']);
    expect(() => scoreEvaluation(s, { ...r, suiteDigest: 'a'.repeat(64) })).toThrow('different suite');
    r.cases[0]!.caseDigest = 'b'.repeat(64); expect(() => scoreEvaluation(s, r)).toThrow('changed inputs');
    r.cases[0]!.caseDigest = caseDigest(s.cases[0]!); r.cases.push(r.cases[0]!);
    expect(() => scoreEvaluation(s, r)).toThrow('Duplicate');
  });
  it('rejects duplicate cases and invalid expectation schemas before a model can run', () => {
    const s = suite(); s.cases[1]!.id = s.cases[0]!.id; expect(() => validateSuite(s)).toThrow('unique');
    s.cases[1]!.id = 'different'; s.cases[0]!.expect.resultSchema = { type: 'imaginary' }; expect(() => validateSuite(s)).toThrow();
  });
  it('checks artifact contents and reports missing evidence', () => {
    const s = suite(1); s.cases[0]!.expect.files = [{ path: 'out.json', contains: ['version'], jsonSchema: { type: 'object', required: ['version'], properties: { version: { const: '1.0.0' } } } }];
    const r = results(s, ['bug']); expect(scoreEvaluation(s, r).totals.passed).toBe(0);
    r.cases[0]!.files = { 'out.json': '{"version":"1.0.0"}' }; expect(scoreEvaluation(s, r).totals.passed).toBe(1);
  });
  it('stores result digests instead of raw private input/output content', () => {
    const s = suite(1); const r = results(s, ['bug']); r.cases[0]!.result.private = 'customer-source-secret';
    const report = scoreEvaluation(s, r);
    expect(JSON.stringify(report)).not.toContain('customer-source-secret');
    const { digest: hash, ...body } = report; expect(digest(body)).toBe(hash);
  });
});

describe('bounded evaluation execution', () => {
  it('labels an injected provider as a test fixture and keeps expected labels out of prompts', async () => {
    const s = suite(1); const p = provider('bug'); const original = p.turn; let sent = '';
    p.turn = vi.fn(async (...args: Parameters<Provider['turn']>) => { sent = JSON.stringify(args[0]); return original(...args); });
    const report = await evaluateTask(task(), s, { cwd, maxCostUsd: 0.1, providerFactory: () => p });
    expect(report.source).toBe('test-fixture'); expect(report.totals.passed).toBe(1);
    expect(sent).toContain('input 0'); expect(sent).not.toContain('const'); expect(sent).not.toContain('bug');
  });
  it('stops the suite on unknown billing instead of retrying remaining cases', async () => {
    const factory = vi.fn(() => ({ turn: async () => { throw new Error('Request failed after submission'); } }));
    const report = await evaluateTask(task(), suite(3), { cwd, maxCostUsd: 1, providerFactory: factory });
    expect(factory).toHaveBeenCalledTimes(1); expect(report.totals).toMatchObject({ executed: 1, notRun: 2, accountingComplete: false });
    expect(report.stoppedReason).toContain('unknown billing');
  });
  it('refuses model requests when the remaining suite budget cannot reserve a turn', async () => {
    const p = provider('bug'); const report = await evaluateTask(task(), suite(3), { cwd, maxCostUsd: 0.000001, providerFactory: () => p });
    expect(p.turn).not.toHaveBeenCalled(); expect(report.totals).toMatchObject({ executed: 1, notRun: 2, knownModelCalls: 0 });
    expect(report.stoppedReason).toContain('budget');
  });
  it('decrements the budget across cases before scheduling more requests', async () => {
    let calls = 0;
    const factory = () => ({ turn: async () => { calls++; return { text: '', calls: [{ id: 'done', name: 'finish', arguments: { summary: 'Done', result: { label: 'bug' } } }], usage: { input: 10, output: 2000 } }; } });
    const report = await evaluateTask(task(), suite(3), { cwd, maxCostUsd: 0.006, providerFactory: factory });
    expect(calls).toBe(1); expect(report.totals.knownEstimatedCostUsd).toBeLessThanOrEqual(0.006);
    expect(report.totals.notRun).toBe(1);
  });
  it('creates a fresh workspace per case without changing the source repository', async () => {
    const s = suite(2);
    for (const entry of s.cases) { entry.files = { 'input.txt': entry.id }; entry.expect.files = [{ path: 'out.txt', contains: [], equals: entry.id }]; }
    const t = taskSchema.parse({ version: 1, name: 'files', prompt: 'Copy input to output.', permissions: { write: true, readPaths: ['input.txt'], writePaths: ['out.txt'] }, verifiers: [{ type: 'file', name: 'Output exists', path: 'out.txt' }] });
    const factory = (entry: EvaluationCase): Provider => {
      let turn = 0;
      return { turn: async () => ({ text: '', calls: turn++ === 0 ? [{ id: 'write', name: 'write_file', arguments: { path: 'out.txt', content: entry.id } }] : [{ id: 'finish', name: 'finish', arguments: { summary: 'Done', result: { label: 'bug' } } }], usage: { input: 10, output: 10 } }) };
    };
    const report = await evaluateTask(t, s, { cwd, maxCostUsd: 1, providerFactory: factory, receiptsDirectory: join(cwd, 'evidence') });
    expect(report.totals.passed).toBe(2);
    await expect(readFile(join(cwd, 'out.txt'))).rejects.toThrow();
    expect(JSON.parse(await readFile(join(cwd, 'evidence/case-0.json'), 'utf8')).status).toBe('verified');
  });
  it('rejects external capabilities without explicit opt-in', async () => {
    const t = taskSchema.parse({ ...task(), tools: { inspect: { type: 'command', command: 'node', description: 'inspect', effect: 'read' } } });
    await expect(evaluateTask(t, suite(), { cwd, maxCostUsd: 1 })).rejects.toThrow('allowExternalTools');
  });
  it('copies trusted verifier code and runs it against a case-specific artifact', async () => {
    await writeFile(join(cwd, 'verify.mjs'), 'import {readFile} from "node:fs/promises"; if((await readFile("out.txt","utf8"))!=="reviewed output") process.exit(1);');
    const s = suite(1); s.supportFiles = ['verify.mjs']; s.cases[0]!.expect.files = [{ path: 'out.txt', contains: [], equals: 'reviewed output' }];
    const t = taskSchema.parse({ ...task(), permissions: { write: true, writePaths: ['out.txt'] }, verifiers: [{ type: 'command', name: 'Trusted check', command: process.execPath, args: ['verify.mjs'] }] });
    let turn = 0;
    const p: Provider = { turn: async () => ({ text: '', calls: turn++ === 0 ? [{ id: 'write', name: 'write_file', arguments: { path: 'out.txt', content: 'reviewed output' } }] : [{ id: 'finish', name: 'finish', arguments: { summary: 'Done', result: { label: 'bug' } } }], usage: { input: 10, output: 10 } }) };
    const report = await evaluateTask(t, s, { cwd, maxCostUsd: 1, allowExternalTools: true, providerFactory: () => p });
    expect(report.totals.passed).toBe(1); expect(report.supportFilesDigest).toBeDefined();
  });
  it('protects trusted support code against shadowing and broad write grants', async () => {
    await writeFile(join(cwd, 'verify.mjs'), 'console.log("trusted")');
    const s = suite(1); s.supportFiles = ['verify.mjs']; s.cases[0]!.files = { './verify.mjs': 'tampered' };
    await expect(evaluateTask(task(), s, { cwd, maxCostUsd: 1 })).rejects.toThrow('shadows');
    s.cases[0]!.files = {};
    const t = task(); t.permissions.writePaths = ['.'];
    await expect(evaluateTask(t, s, { cwd, maxCostUsd: 1 })).rejects.toThrow('agent-writable');
  });
  it('rejects traversal fixtures before making any provider call', async () => {
    const s = suite(1); s.cases[0]!.files = { '../outside.txt': 'bad' };
    const factory = vi.fn(() => provider('bug'));
    await expect(evaluateTask(task(), s, { cwd, maxCostUsd: 1, providerFactory: factory })).rejects.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });
  it('supports cancellation without quietly dropping unexecuted cases', async () => {
    const signal = AbortSignal.abort(); const report = await evaluateTask(task(), suite(2), { cwd, maxCostUsd: 1, signal });
    expect(report.totals).toMatchObject({ executed: 0, notRun: 2, passRate: 0 }); expect(report.stoppedReason).toContain('cancelled');
  });
  it('saves reports without overwriting an existing artifact', async () => {
    const s = suite(1); const report = scoreEvaluation(s, results(s, ['bug']));
    const path = join(cwd, 'report.json'); await saveEvaluationReport(path, report);
    await expect(saveEvaluationReport(path, report)).rejects.toThrow();
  });
  it('preserves numeric metering when its digits coincide with a known secret', () => {
    vi.stubEnv('SHORT_TOKEN', '1234');
    const s = suite(1); const r = results(s, ['bug']); r.cases[0]!.durationMs = 1234;
    expect(scoreEvaluation(s, r).totals.p50DurationMs).toBe(1234);
  });
});
