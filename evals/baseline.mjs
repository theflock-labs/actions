import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateSuite, caseDigest, digest } from '../dist/index.js';

const directory = join('.flock', 'evaluations', `baseline-${randomUUID()}`);
await mkdir(directory, { recursive: true });
const summary = [];
for (const family of ['triage', 'ci-diagnosis', 'docs']) {
  const suite = validateSuite(JSON.parse(await readFile(`evals/${family}/suite.json`, 'utf8')));
  const cases = suite.cases.map(entry => {
    const started = performance.now();
    let result; const files = {};
    if (family === 'triage') {
      const text = `${entry.inputs.title}\n${entry.inputs.body}`;
      const label = /crash|\berror\b|exception|\bfails?\b|\bwrong\b|\bbroken\b/i.test(text) ? 'bug'
        : /\badd\b|\bsupport\b|\bfeature\b|would like/i.test(text) ? 'feature'
        : /^(how|what|can|where|is|does)\b/i.test(text) ? 'question' : 'needs-info';
      result = { label, reason: 'Deterministic keyword baseline; no semantic reasoning.' };
    } else if (family === 'ci-diagnosis') {
      const log = entry.files['build.log'];
      const signatures = [
        ['authentication', /E401|401 Unauthorized|403 Forbidden/i], ['resource', /OOMKilled|ENOSPC/i],
        ['dependency', /ERESOLVE|Cannot find module|ModuleNotFoundError/i], ['network', /ENOTFOUND|ETIMEDOUT/i],
        ['lint', /no-unused-vars|F401|E501/i], ['configuration', /Missing script|YAML.*mapping/i],
        ['test-assertion', /AssertionError|Expected:/i],
      ];
      const match = signatures.find(([, pattern]) => pattern.test(log));
      result = { category: match?.[0] ?? 'insufficient-evidence', evidence: match ? log.split('\n').find(line => match[1].test(line)) : log.trim(), next_step: 'Inspect the failing operation and its trusted configuration before changing anything.' };
    } else {
      const changes = JSON.parse(entry.files['changes.json']);
      files['release-notes.md'] = '# Release notes\n\n' + changes.map(c => `- ${c.description} [${c.id}]`).join('\n') + '\n';
      result = { path: 'release-notes.md' };
    }
    return { caseId: entry.id, caseDigest: caseDigest(entry), status: 'completed', result, files,
      durationMs: performance.now() - started, modelCalls: 0, estimatedCostUsd: 0, accountingComplete: true,
    };
  });
  const observations = { version: 1, suiteDigest: digest(suite), engine: `flock-example-baseline/${family}`, method: 'deterministic', timingScope: 'In-process baseline algorithm only, excluding file IO and scoring; not comparable to an end-to-end agent run.', cases };
  const observationPath = join(directory, `${family}.observations.json`);
  const reportPath = join(directory, `${family}.report.json`);
  await writeFile(observationPath, JSON.stringify(observations, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  // Exercise the shipped CLI as well as the scorer. A zero threshold collects
  // the baseline's mistakes; missing cases or incomplete accounting still fail.
  execFileSync(process.execPath, ['dist/cli.js', 'score', '--suite', `evals/${family}/suite.json`, '--results', observationPath, '--output', reportPath, '--min-pass-rate', '0'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  summary.push({ family, corpus: 'synthetic', passed: report.totals.passed, total: report.totals.cases, modelCalls: report.totals.knownModelCalls, report: reportPath });
}
console.log(JSON.stringify({ source: 'Deterministic baselines on authored synthetic fixtures; no AI quality result is implied.', directory, suites: summary }, null, 2));
