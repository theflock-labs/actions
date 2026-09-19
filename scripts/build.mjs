import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const entry of ['action', 'cli', 'index']) {
  const result = await build({
    entryPoints: [`src/${entry}.ts`], outfile: `dist/${entry}.js`,
    bundle: true, platform: 'node', target: 'node24', format: 'esm',
    legalComments: 'eof', metafile: true,
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  });
  await writeFile(`dist/${entry}.meta.json`, JSON.stringify(result.metafile, null, 2) + '\n');
}
const { taskSchema } = await import('../dist/index.js');
const { z } = await import('zod');
await mkdir('schema', { recursive: true });
await writeFile('schema/task.schema.json', JSON.stringify(z.toJSONSchema(taskSchema), null, 2) + '\n');
