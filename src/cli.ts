import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { loadTask } from './config.js';
import { runTask } from './engine.js';
import { runbookSchema, promote } from './runbook.js';
import { saveReceipt } from './receipt.js';
import { redact } from './util.js';
import { evaluateTask, loadEvaluationJson, scoreEvaluation, saveEvaluationReport, validateSuite } from './evaluation.js';

const help = `Flock Actions — prompts with proof, programs when possible.

  flock run --task .flock-tasks/triage.json [--inputs inputs.json] [--dry-run]
  flock run --task task.json --runbook runbook.json
  flock promote --task task.json --receipt receipt.json --output runbook.json
  flock evaluate --task task.json --suite suite.json --max-cost-usd 1 --output report.json
  flock score --suite suite.json --results results.json --output report.json

Options:
  --cwd PATH       Workspace root (default: current directory)
  --receipt PATH   Receipt output for run; input for promote
  --inputs PATH    JSON object to replace the task's input data
  --dry-run        Validate without models, tools, credentials, or verifiers
  --help           Show this help

Evaluation options:
  --suite PATH              Versioned labeled case suite
  --results PATH            Imported observations for offline scoring
  --output PATH             New report file (default: .flock/evaluations/<id>/report.json)
  --max-cost-usd NUMBER      Required total estimated inference budget for evaluate
  --max-duration-seconds N   Evaluation wall-time limit (default: 1800)
  --min-pass-rate NUMBER     Required fraction of all cases passing, 0–1 (default: 1)
  --allow-external-tools    Explicitly permit command/HTTP/MCP execution in the suite
  --save-receipts            Retain redacted per-case receipts next to the report

Model credentials come from OPENAI_API_KEY / ANTHROPIC_API_KEY, or model.apiKeyEnv.
Runbooks need no model credentials. Promotion produces reviewed:false for human review.
`;
async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ options: {
    task: { type: 'string' }, inputs: { type: 'string' }, cwd: { type: 'string' }, receipt: { type: 'string' },
    runbook: { type: 'string' }, output: { type: 'string' }, 'dry-run': { type: 'boolean' }, help: { type: 'boolean' },
    suite: { type: 'string' }, results: { type: 'string' }, 'max-cost-usd': { type: 'string' },
    'max-duration-seconds': { type: 'string' }, 'min-pass-rate': { type: 'string' },
    'allow-external-tools': { type: 'boolean' }, 'save-receipts': { type: 'boolean' },
  }, allowPositionals: true });
  if (values.help || !positionals.length) { console.log(help); return; }
  const cwd = resolve(values.cwd ?? process.cwd());
  if (positionals[0] === 'evaluate' || positionals[0] === 'score') {
    if (!values.suite) throw new Error('--suite is required');
    if (values['dry-run'] || values.runbook || values.inputs) throw new Error('Evaluation inputs come from the suite; --dry-run, --runbook and --inputs are not supported here');
    const threshold = Number(values['min-pass-rate'] ?? 1);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('--min-pass-rate must be a number between 0 and 1');
    const suite = validateSuite(await loadEvaluationJson(resolve(cwd, values.suite)));
    const output = resolve(cwd, values.output ?? `.flock/evaluations/${randomUUID()}/report.json`);
    const controller = new AbortController();
    const cancel = () => controller.abort(new Error('Evaluation cancelled'));
    process.once('SIGTERM', cancel); process.once('SIGINT', cancel);
    try {
      let report;
      if (positionals[0] === 'score') {
        if (!values.results) throw new Error('score requires --results');
        report = scoreEvaluation(suite, await loadEvaluationJson(resolve(cwd, values.results)));
      } else {
        if (!values.task || !values['max-cost-usd']) throw new Error('evaluate requires --task and an explicit --max-cost-usd');
        report = await evaluateTask(await loadTask(resolve(cwd, values.task)), suite, {
          cwd, maxCostUsd: Number(values['max-cost-usd']),
          ...(values['max-duration-seconds'] ? { maxDurationSeconds: Number(values['max-duration-seconds']) } : {}),
          allowExternalTools: values['allow-external-tools'], signal: controller.signal,
          ...(values['save-receipts'] ? { receiptsDirectory: join(dirname(output), 'receipts') } : {}),
        });
      }
      await saveEvaluationReport(output, report);
      console.log(JSON.stringify({ report: output, source: report.source, totals: report.totals, ...(report.stoppedReason ? { stoppedReason: report.stoppedReason } : {}) }, null, 2));
      if (report.totals.notRun || !report.totals.accountingComplete || report.totals.passRate < threshold) process.exitCode = 1;
    } finally { process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel); }
    return;
  }
  if (!values.task) throw new Error('--task is required');
  const task = await loadTask(resolve(cwd, values.task));
  if (values.inputs) {
    const data = JSON.parse(await readFile(resolve(cwd, values.inputs), 'utf8'));
    const { taskSchema } = await import('./config.js');
    task.inputs = taskSchema.shape.inputs.parse(data);
  }
  if (positionals[0] === 'promote') {
    if (!values.receipt || !values.output) throw new Error('promote requires --receipt and --output');
    const receipt = JSON.parse(await readFile(resolve(cwd, values.receipt), 'utf8'));
    const book = promote(task, receipt);
    await writeFile(resolve(cwd, values.output), JSON.stringify(book, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(`Runbook written to ${values.output}. Review every step, then set reviewed:true before execution.`);
  } else if (positionals[0] === 'run') {
    const book = values.runbook ? runbookSchema.parse(JSON.parse(await readFile(resolve(cwd, values.runbook), 'utf8'))) : undefined;
    const controller = new AbortController();
    const cancel = () => controller.abort(new Error('Run cancelled'));
    process.once('SIGTERM', cancel); process.once('SIGINT', cancel);
    try {
      const receipt = await runTask(task, { cwd, ...(book ? { runbook: book } : {}), dryRun: values['dry-run'], signal: controller.signal });
      const path = resolve(cwd, values.receipt ?? `.flock/receipts/${receipt.id}.json`);
      await saveReceipt(path, receipt);
      console.log(JSON.stringify({ status: receipt.status, receipt: path, usage: receipt.usage, ...(receipt.error ? { error: receipt.error } : {}) }, null, 2));
      if (receipt.status === 'failed') process.exitCode = 1;
    } finally { process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel); }
  } else throw new Error(`Unknown command: ${positionals[0]}`);
}
main().catch(error => { console.error(redact((error as Error).message)); process.exitCode = 1; });
