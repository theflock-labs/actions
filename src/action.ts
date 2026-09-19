import * as core from '@actions/core';
import { readFile, mkdtemp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { taskSchema, loadTask } from './config.js';
import { runTask } from './engine.js';
import { runbookSchema } from './runbook.js';
import { saveReceipt } from './receipt.js';
import { redact } from './util.js';

async function main(): Promise<void> {
  const taskFile = core.getInput('task-file');
  const prompt = core.getInput('prompt');
  const cwd = process.env.GITHUB_WORKSPACE ?? process.cwd();
  let task = taskFile ? await loadTask(resolve(cwd, taskFile)) : taskSchema.parse({ version: 1, name: 'prompt', prompt });
  if (prompt) task.prompt = prompt;
  const inputs = core.getInput('inputs');
  if (inputs) task.inputs = JSON.parse(inputs);
  const provider = core.getInput('provider'); if (provider) task.model.provider = provider as typeof task.model.provider;
  const model = core.getInput('model'); if (model) task.model.name = model;
  const budget = core.getInput('max-cost-usd'); if (budget) task.budget.maxCostUsd = Number(budget);
  task = taskSchema.parse(task);
  const apiKey = core.getInput('api-key');
  if (apiKey) {
    core.setSecret(apiKey);
    process.env[task.model.apiKeyEnv ?? (task.model.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY')] = apiKey;
  }
  const mode = core.getInput('mode') || 'agent';
  if (!['agent', 'runbook', 'dry-run'].includes(mode)) throw new Error('mode must be agent, runbook, or dry-run');
  const bookPath = core.getInput('runbook');
  if (mode === 'runbook' && !bookPath) throw new Error('runbook mode requires a runbook path');
  if (mode !== 'runbook' && bookPath) throw new Error('runbook input requires mode=runbook');
  const book = bookPath ? runbookSchema.parse(JSON.parse(await readFile(resolve(cwd, bookPath), 'utf8'))) : undefined;
  const controller = new AbortController();
  const cancel = () => controller.abort(new Error('Action cancelled'));
  process.once('SIGTERM', cancel); process.once('SIGINT', cancel);
  try {
    const receipt = await runTask(task, { cwd, ...(book ? { runbook: book } : {}), dryRun: mode === 'dry-run', signal: controller.signal });
    const directory = await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'flock-'));
    const path = join(directory, 'receipt.json');
    await saveReceipt(path, receipt);
    core.setOutput('status', receipt.status); core.setOutput('verified', receipt.status === 'verified');
    core.setOutput('result', JSON.stringify(receipt.result)); core.setOutput('receipt-path', path);
    core.setOutput('estimated-cost-usd', receipt.usage.estimatedCostUsd);
    core.setOutput('model-calls', receipt.usage.modelCalls);
    if (process.env.GITHUB_STEP_SUMMARY) await core.summary.addHeading('Flock Actions', 2)
      .addTable([
        [{ data: 'Status', header: true }, { data: 'Model calls', header: true }, { data: 'Tool calls', header: true }, { data: 'Estimated inference (USD)', header: true }],
        [receipt.status, String(receipt.usage.modelCalls), String(receipt.usage.toolCalls), receipt.usage.estimatedCostUsd.toFixed(6)],
      ]).addRaw('\nReceipt includes contract fingerprints, independent checks, and redacted execution metadata.\n').write();
    if (receipt.status === 'failed') core.setFailed(receipt.error ?? 'Task failed');
    else core.info(`Flock Actions: ${receipt.status}; ${receipt.usage.modelCalls} model call(s).`);
  } finally { process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel); }
}
main().catch(error => core.setFailed(redact((error as Error).message)));
