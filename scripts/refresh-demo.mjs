import { readFile, writeFile } from 'node:fs/promises';
import { taskSchema, taskDigest, digest } from '../dist/index.js';
const task = taskSchema.parse(JSON.parse(await readFile('examples/runbook/task.json', 'utf8')));
const book = {
  version: 1, reviewed: true, taskDigest: taskDigest(task), inputsDigest: digest(task.inputs), guards: {},
  steps: [{ tool: 'write_file', arguments: { path: 'release-manifest.json', content: '{"name":"flock-demo","version":"1.0.0"}\n' } }],
  result: { path: 'release-manifest.json' },
};
await writeFile('examples/runbook/runbook.json', JSON.stringify(book, null, 2) + '\n');
