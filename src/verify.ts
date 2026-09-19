import type { Task } from './config.js';
import type { JsonObject, Receipt } from './types.js';
import { runCommand } from './commands.js';
import { Workspace } from './workspace.js';
import { validator, redact } from './util.js';

export async function verify(task: Task, workspace: Workspace, result: JsonObject, signal: AbortSignal): Promise<Receipt['checks']> {
  const checks: Receipt['checks'] = [];
  for (const check of task.verifiers) {
    signal.throwIfAborted();
    try {
      if (check.type === 'command') await runCommand(check, workspace.root, { result, inputs: task.inputs }, signal);
      else {
        const content = await workspace.read(check.path, [check.path]);
        if (check.contains !== undefined && !content.includes(check.contains)) throw new Error('File does not contain required text');
        if (check.jsonSchema) validator(check.jsonSchema)(JSON.parse(content));
      }
      checks.push({ name: check.name, passed: true, detail: 'Passed' });
    } catch (error) { checks.push({ name: check.name, passed: false, detail: redact((error as Error).message).slice(0, 2048) }); }
  }
  return checks;
}
