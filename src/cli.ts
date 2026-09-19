import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadTask } from './config.js';
import { runTask } from './engine.js';
import { runbookSchema, promote } from './runbook.js';
import { saveReceipt } from './receipt.js';
import { redact } from './util.js';

const help = `Flock Actions — prompts with proof, programs when possible.

  flock run --task .flock-tasks/triage.json [--inputs inputs.json] [--dry-run]
  flock run --task task.json --runbook runbook.json
  flock promote --task task.json --receipt receipt.json --output runbook.json

Options:
  --cwd PATH       Workspace root (default: current directory)
  --receipt PATH   Receipt output for run; input for promote
  --inputs PATH    JSON object to replace the task's input data
  --dry-run        Validate without models, tools, credentials, or verifiers
  --help           Show this help

Model credentials come from OPENAI_API_KEY / ANTHROPIC_API_KEY, or model.apiKeyEnv.
Runbooks need no model credentials. Promotion produces reviewed:false for human review.
`;
async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ options: {
    task: { type: 'string' }, inputs: { type: 'string' }, cwd: { type: 'string' }, receipt: { type: 'string' },
    runbook: { type: 'string' }, output: { type: 'string' }, 'dry-run': { type: 'boolean' }, help: { type: 'boolean' },
  }, allowPositionals: true });
  if (values.help || !positionals.length) { console.log(help); return; }
  if (!values.task) throw new Error('--task is required');
  const cwd = resolve(values.cwd ?? process.cwd());
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
