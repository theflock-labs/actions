import { z } from 'zod';
import type { Task } from './config.js';
import type { Receipt, Runbook } from './types.js';
import { digest } from './util.js';

export const runbookSchema = z.strictObject({
  version: z.literal(1), taskDigest: z.string().regex(/^[a-f0-9]{64}$/), inputsDigest: z.string().regex(/^[a-f0-9]{64}$/),
  reviewed: z.boolean(), guards: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
  steps: z.array(z.strictObject({ tool: z.string(), arguments: z.record(z.string(), z.unknown()), expectDigest: z.string().regex(/^[a-f0-9]{64}$/).optional() })).max(500),
  result: z.record(z.string(), z.unknown()),
});
export const taskDigest = (task: Task): string => digest(task);
export function promote(task: Task, receipt: Receipt): Runbook {
  const { digest: checksum, ...body } = receipt;
  if (!checksum || digest(body) !== checksum) throw new Error('Receipt checksum does not match');
  if (receipt.status !== 'verified' || receipt.mode !== 'agent') throw new Error('Only independently verified agent runs can be promoted');
  if (receipt.taskDigest !== taskDigest(task) || receipt.inputsDigest !== digest(task.inputs)) throw new Error('Task or inputs differ from receipt');
  if (JSON.stringify(receipt).includes('[REDACTED]')) throw new Error('Redacted receipts cannot be promoted');
  let writesStarted = false;
  const steps = receipt.steps.map(step => {
    let effect: 'read' | 'write' | undefined;
    if (['read_file', 'list_files'].includes(step.tool)) effect = 'read';
    else if (step.tool === 'write_file') effect = 'write';
    else effect = task.tools[step.tool]?.effect;
    if (!effect) {
      for (const server of task.mcp) for (const [name, policy] of Object.entries(server.tools)) if (`${server.name}__${name}` === step.tool) effect = policy.effect;
    }
    if (!effect) throw new Error(`Unknown tool in receipt: ${step.tool}`);
    if (effect === 'read' && writesStarted) throw new Error('Cannot promote a read-after-write trace; author a runbook with all prerequisite reads first');
    if (effect === 'write') writesStarted = true;
    return { tool: step.tool, arguments: step.arguments, ...(effect === 'read' ? { expectDigest: step.resultDigest } : {}) };
  });
  // Context files are checked at replay by the engine through guards provided in the receipt steps.
  // Context-only observations cannot be recovered from a privacy-minimized receipt.
  if (task.context.length) throw new Error('Context files must be converted to guarded read_file steps before promotion');
  return { version: 1, taskDigest: taskDigest(task), inputsDigest: digest(task.inputs), reviewed: false, guards: {}, steps, result: receipt.result };
}
