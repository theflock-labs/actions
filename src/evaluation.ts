import { z } from 'zod';
import { mkdtemp, readFile, rm, stat, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { taskSchema, type Task } from './config.js';
import { runTask } from './engine.js';
import type { Provider } from './types.js';
import { Workspace } from './workspace.js';
import { digest, redact, validator } from './util.js';
import { saveReceipt } from './receipt.js';
import { version } from './version.js';

const object = z.record(z.string(), z.unknown());
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/);
const files = z.record(z.string().min(1), z.string().max(131072)).default({});
const fileExpectation = z.strictObject({
  path: z.string().min(1), contains: z.array(z.string().min(1)).max(30).default([]),
  equals: z.string().optional(), jsonSchema: object.optional(),
}).refine(v => v.contains.length > 0 || v.equals !== undefined || !!v.jsonSchema, 'A file expectation requires a content assertion');
export const evaluationSuiteSchema = z.strictObject({
  $schema: z.string().optional(), version: z.literal(1), name: z.string().min(1).max(200),
  provenance: z.strictObject({ kind: z.enum(['synthetic', 'public', 'consented']), description: z.string().min(1), source: z.string().optional() }),
  supportFiles: z.array(z.string().min(1)).max(30).default([]),
  cases: z.array(z.strictObject({
    id: identifier, category: identifier, inputs: object.default({}), files,
    expect: z.strictObject({ resultSchema: object.optional(), files: z.array(fileExpectation).max(20).default([]) })
      .refine(v => !!v.resultSchema || v.files.length > 0, 'Each case requires at least one independent expectation'),
  })).min(1).max(500),
}).refine(suite => new Set(suite.cases.map(c => c.id)).size === suite.cases.length, 'Case IDs must be unique');
export type EvaluationSuite = z.infer<typeof evaluationSuiteSchema>;
export type EvaluationCase = EvaluationSuite['cases'][number];

export const evaluationResultsSchema = z.strictObject({
  version: z.literal(1), suiteDigest: sha,
  engine: z.string().min(1).max(200), method: z.enum(['agent', 'deterministic', 'human']),
  timingScope: z.string().min(1).max(1000),
  cases: z.array(z.strictObject({
    caseId: identifier, caseDigest: sha, status: z.enum(['completed', 'failed']), result: object.default({}), files,
    durationMs: z.number().finite().nonnegative(), modelCalls: z.number().int().nonnegative().nullable(),
    estimatedCostUsd: z.number().finite().nonnegative().nullable(), accountingComplete: z.boolean(),
    error: z.string().max(4096).optional(),
  })).max(500),
});
export type EvaluationResults = z.infer<typeof evaluationResultsSchema>;
type Observation = EvaluationResults['cases'][number];
export const caseDigest = (entry: EvaluationCase): string => digest({ inputs: entry.inputs, files: entry.files });

export interface EvaluationReport {
  version: 1; id: string; createdAt: string; suite: string; suiteDigest: string;
  corpus: EvaluationSuite['provenance'];
  source: 'provider-execution' | 'imported-self-reported' | 'test-fixture';
  engine: string; method: EvaluationResults['method']; timingScope: string;
  taskDigest?: string; supportFilesDigest?: string;
  runtime: { version: string; node: string; platform: string };
  totals: {
    cases: number; executed: number; passed: number; failed: number; notRun: number;
    passRate: number; passRateAmongExecuted: number | null;
    knownEstimatedCostUsd: number; accountingComplete: boolean; costPerPassedCaseUsd: number | null;
    knownModelCalls: number; allModelCallsKnown: boolean; p50DurationMs: number | null; p95DurationMs: number | null;
  };
  categories: Array<{ category: string; cases: number; executed: number; passed: number }>;
  cases: Array<{
    id: string; category: string; caseDigest: string; status: 'passed' | 'failed' | 'not-run';
    checks: Array<{ name: string; passed: boolean; detail: string }>;
    resultDigest?: string; durationMs?: number; error?: string;
  }>;
  stoppedReason?: string; digest: string;
}

export async function loadEvaluationJson(path: string): Promise<unknown> {
  if ((await stat(path)).size > 10_000_000) throw new Error('Evaluation file exceeds 10 MB');
  return JSON.parse(await readFile(path, 'utf8'));
}
export function validateSuite(input: unknown): EvaluationSuite {
  const suite = evaluationSuiteSchema.parse(input);
  for (const entry of suite.cases) {
    if (entry.expect.resultSchema) validator(entry.expect.resultSchema);
    for (const check of entry.expect.files) if (check.jsonSchema) validator(check.jsonSchema);
  }
  return suite;
}
const quantile = (sorted: number[], q: number): number | null => sorted.length ? sorted[Math.ceil(sorted.length * q) - 1]! : null;
export function scoreEvaluation(suiteInput: unknown, resultsInput: unknown, source: EvaluationReport['source'] = 'imported-self-reported'): EvaluationReport {
  const suite = validateSuite(suiteInput);
  const results = evaluationResultsSchema.parse(resultsInput);
  if (results.suiteDigest !== digest(suite)) throw new Error('Results refer to a different suite digest');
  const expected = new Map(suite.cases.map(c => [c.id, c]));
  const observations = new Map<string, Observation>();
  for (const observation of results.cases) {
    if (observations.has(observation.caseId)) throw new Error(`Duplicate result: ${observation.caseId}`);
    const entry = expected.get(observation.caseId);
    if (!entry || observation.caseDigest !== caseDigest(entry)) throw new Error(`Unknown case or changed inputs: ${observation.caseId}`);
    if (observation.accountingComplete && observation.estimatedCostUsd === null) throw new Error('Complete accounting requires a numeric cost');
    observations.set(observation.caseId, observation);
  }
  const cases: EvaluationReport['cases'] = suite.cases.map(entry => {
    const observation = observations.get(entry.id);
    const base = { id: entry.id, category: entry.category, caseDigest: caseDigest(entry) };
    if (!observation) return { ...base, status: 'not-run', checks: [] };
    const checks: EvaluationReport['cases'][number]['checks'] = [];
    const check = (name: string, run: () => void) => {
      try { run(); checks.push({ name, passed: true, detail: 'Passed' }); }
      catch (error) { checks.push({ name, passed: false, detail: redact((error as Error).message).slice(0, 1000) }); }
    };
    check('Execution completed', () => { if (observation.status !== 'completed') throw new Error('Execution failed; output cannot be counted as an accepted outcome'); });
    if (entry.expect.resultSchema) check('Labeled result expectation', () => validator(entry.expect.resultSchema!)(observation.result));
    for (const file of entry.expect.files) check(`Artifact: ${file.path}`, () => {
      const content = observation.files[file.path];
      if (content === undefined) throw new Error('Expected artifact was not provided');
      if (file.equals !== undefined && content !== file.equals) throw new Error('Artifact does not match expected content');
      if (file.contains.some(text => !content.includes(text))) throw new Error('Artifact is missing required content');
      if (file.jsonSchema) validator(file.jsonSchema)(JSON.parse(content));
    });
    return { ...base, status: checks.every(c => c.passed) ? 'passed' : 'failed', checks,
      resultDigest: digest(observation.result), durationMs: observation.durationMs,
      ...(observation.error ? { error: redact(observation.error) } : {}),
    };
  });
  const passed = cases.filter(c => c.status === 'passed').length;
  const executed = observations.size;
  const all = [...observations.values()];
  const cost = all.reduce((sum, c) => sum + (c.estimatedCostUsd ?? 0), 0);
  const accountingComplete = all.every(c => c.accountingComplete && c.estimatedCostUsd !== null);
  const durations = all.map(c => c.durationMs).sort((a, b) => a - b);
  const categories = [...new Set(suite.cases.map(c => c.category))].map(category => {
    const subset = cases.filter(c => c.category === category);
    return { category, cases: subset.length, executed: subset.filter(c => c.status !== 'not-run').length, passed: subset.filter(c => c.status === 'passed').length };
  });
  const report: Omit<EvaluationReport, 'digest'> = {
    version: 1, id: randomUUID(), createdAt: new Date().toISOString(), suite: suite.name, suiteDigest: digest(suite),
    corpus: suite.provenance, source, engine: results.engine, method: results.method, timingScope: results.timingScope,
    runtime: { version, node: process.version, platform: process.platform },
    totals: { cases: cases.length, executed, passed, failed: executed - passed, notRun: cases.length - executed,
      passRate: passed / cases.length, passRateAmongExecuted: executed ? passed / executed : null,
      knownEstimatedCostUsd: cost, accountingComplete, costPerPassedCaseUsd: accountingComplete && passed ? cost / passed : null,
      knownModelCalls: all.reduce((sum, c) => sum + (c.modelCalls ?? 0), 0), allModelCallsKnown: all.every(c => c.modelCalls !== null),
      p50DurationMs: quantile(durations, 0.5), p95DurationMs: quantile(durations, 0.95),
    }, categories, cases,
  };
  return sealReport(report);
}
function sealReport(report: Omit<EvaluationReport, 'digest'>): EvaluationReport {
  const clean = {
    ...report, suite: redact(report.suite), engine: redact(report.engine), timingScope: redact(report.timingScope),
    corpus: { ...report.corpus, description: redact(report.corpus.description), ...(report.corpus.source ? { source: redact(report.corpus.source) } : {}) },
    categories: report.categories.map(c => ({ ...c, category: redact(c.category) })),
    cases: report.cases.map(c => ({ ...c, id: redact(c.id), category: redact(c.category),
      checks: c.checks.map(check => ({ ...check, name: redact(check.name), detail: redact(check.detail) })),
      ...(c.error ? { error: redact(c.error) } : {}),
    })),
    ...(report.stoppedReason ? { stoppedReason: redact(report.stoppedReason) } : {}),
  };
  return { ...clean, digest: digest(clean) };
}

export interface EvaluateOptions {
  cwd: string; maxCostUsd: number; maxDurationSeconds?: number; allowExternalTools?: boolean;
  receiptsDirectory?: string; signal?: AbortSignal;
  // An injected provider always labels the report test-fixture, never live execution.
  providerFactory?: (entry: EvaluationCase) => Provider;
}
export async function evaluateTask(taskInput: Task, suiteInput: unknown, options: EvaluateOptions): Promise<EvaluationReport> {
  const task = taskSchema.parse(taskInput);
  const suite = validateSuite(suiteInput);
  if (!Number.isFinite(options.maxCostUsd) || options.maxCostUsd <= 0 || options.maxCostUsd > 1000) throw new Error('An explicit suite budget between 0 and 1000 USD is required');
  const duration = options.maxDurationSeconds ?? 1800;
  if (!Number.isInteger(duration) || duration < 1 || duration > 14400) throw new Error('Suite duration must be 1–14400 seconds');
  if (!options.allowExternalTools && (Object.keys(task.tools).length || task.mcp.length || task.verifiers.some(v => v.type === 'command'))) {
    throw new Error('Evaluation of commands, HTTP or MCP requires explicit allowExternalTools; repeated cases may repeat external effects');
  }
  const source = new Workspace(resolve(options.cwd));
  const support: Record<string, string> = Object.create(null);
  const aliases = new Set<string>();
  const alias = (path: string) => posix.normalize(path).toLowerCase();
  for (const path of suite.supportFiles) {
    if (aliases.has(alias(path))) throw new Error('Support file paths must be unique across case-insensitive filesystems');
    aliases.add(alias(path));
    if (task.permissions.writePaths.some(p => p === '.' || alias(p) === alias(path) || (p.endsWith('/') && alias(path).startsWith(`${alias(p).replace(/\/$/, '')}/`)))) throw new Error('Trusted support files cannot be inside agent-writable paths');
    support[path] = await source.read(path, [path]);
  }
  const preflight = await mkdtemp(join(tmpdir(), 'flock-eval-preflight-'));
  try {
    const workspace = new Workspace(preflight);
    for (const path of Object.keys(support)) await workspace.path(path, ['.'], true);
    for (const entry of suite.cases) {
      const names = new Set(aliases);
      for (const [path, content] of Object.entries(entry.files)) {
        if (names.has(alias(path))) throw new Error(`Fixture shadows another fixture or trusted support file: ${path}`);
        names.add(alias(path));
        if (Buffer.byteLength(content) > 131072) throw new Error('Fixture exceeds 128 KiB');
        await workspace.path(path, ['.'], true);
      }
      for (const file of entry.expect.files) await workspace.path(file.path, ['.']);
    }
  } finally { await rm(preflight, { recursive: true, force: true }); }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Evaluation time budget exhausted')), duration * 1000);
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
  const observations: Observation[] = [];
  let spent = 0; let stoppedReason: string | undefined;
  try {
    for (const entry of suite.cases) {
      if (signal.aborted) { stoppedReason = 'Evaluation cancelled or time budget exhausted'; break; }
      const remaining = options.maxCostUsd - spent;
      if (remaining <= 0) { stoppedReason = 'Evaluation estimated USD budget exhausted'; break; }
      const directory = await mkdtemp(join(tmpdir(), 'flock-eval-case-'));
      try {
        const workspace = new Workspace(directory);
        for (const [path, content] of Object.entries({ ...support, ...entry.files })) await workspace.write(path, content, ['.']);
        const candidate = taskSchema.parse({ ...task, inputs: entry.inputs, budget: { ...task.budget, maxCostUsd: Math.min(task.budget.maxCostUsd, remaining) } });
        const receipt = await runTask(candidate, { cwd: directory, signal, ...(options.providerFactory ? { provider: options.providerFactory(entry) } : {}) });
        spent += receipt.usage.estimatedCostUsd;
        if (options.receiptsDirectory) await saveReceipt(join(options.receiptsDirectory, `${entry.id}.json`), receipt);
        const artifacts: Record<string, string> = Object.create(null);
        for (const file of entry.expect.files) {
          try { artifacts[file.path] = await workspace.read(file.path, [file.path]); } catch { /* scorer records missing/unreadable artifacts */ }
        }
        observations.push({ caseId: entry.id, caseDigest: caseDigest(entry), status: receipt.status === 'verified' || receipt.status === 'unverified' ? 'completed' : 'failed', result: receipt.result, files: artifacts,
          durationMs: receipt.durationMs, modelCalls: receipt.usage.modelCalls, estimatedCostUsd: receipt.usage.estimatedCostUsd, accountingComplete: receipt.usage.accountingComplete,
          ...(receipt.error ? { error: receipt.error } : {}),
        });
        if (!receipt.usage.accountingComplete) { stoppedReason = 'A submitted model request has unknown billing; no further requests will be made'; break; }
        if (receipt.status === 'failed' && receipt.usage.modelCalls === 0) { stoppedReason = receipt.error ?? 'Execution failed before any model call'; break; }
      } finally { await rm(directory, { recursive: true, force: true }); }
    }
  } finally { clearTimeout(timer); }
  const report = scoreEvaluation(suite, { version: 1, suiteDigest: digest(suite), engine: `${task.model.provider}/${task.model.name}`, method: 'agent', timingScope: 'Per-case engine wall time including model calls, tools and task verifiers; excludes fixture preparation and evaluation grading.', cases: observations }, options.providerFactory ? 'test-fixture' : 'provider-execution');
  const { digest: ignored, ...body } = report;
  return sealReport({ ...body, taskDigest: digest(task), supportFilesDigest: digest(support), ...(stoppedReason ? { stoppedReason: redact(stoppedReason) } : {}) });
}
export async function saveEvaluationReport(path: string, report: EvaluationReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
