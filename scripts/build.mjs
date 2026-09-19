import { build } from 'esbuild';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
const packages = new Set();
await mkdir('dist', { recursive: true });
for (const entry of ['action', 'cli', 'index']) {
  const result = await build({
    entryPoints: [`src/${entry}.ts`], outfile: `dist/${entry}.js`,
    bundle: true, platform: 'node', target: 'node24', format: 'esm',
    legalComments: 'eof', metafile: true,
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  });
  await writeFile(`dist/${entry}.meta.json`, JSON.stringify(result.metafile, null, 2) + '\n');
  for (const input of Object.keys(result.metafile.inputs).filter(path => path.includes('node_modules/'))) {
    let directory = dirname(input);
    while (directory !== '.') {
      try {
        const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
        if (pkg.name && pkg.version) { packages.add(directory); break; }
      } catch { /* walk to the package root */ }
      directory = dirname(directory);
    }
  }
}
const { taskSchema, evaluationSuiteSchema, evaluationResultsSchema } = await import('../dist/index.js');
const { z } = await import('zod');
await mkdir('schema', { recursive: true });
await writeFile('schema/task.schema.json', JSON.stringify(z.toJSONSchema(taskSchema), null, 2) + '\n');
await writeFile('schema/evaluation-suite.schema.json', JSON.stringify(z.toJSONSchema(evaluationSuiteSchema), null, 2) + '\n');
await writeFile('schema/evaluation-results.schema.json', JSON.stringify(z.toJSONSchema(evaluationResultsSchema), null, 2) + '\n');
const notices = [];
for (const directory of [...packages].sort()) {
  const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  const files = (await readdir(directory)).filter(name => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name)).sort();
  if (!files.length) throw new Error(`No license notice found for bundled package ${pkg.name}`);
  const license = await Promise.all(files.map(file => readFile(join(directory, file), 'utf8')));
  notices.push(`## ${pkg.name} ${pkg.version}\n\nLicense: ${typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license)}\n\n${license.join('\n\n')}`);
}
await writeFile('THIRD_PARTY_NOTICES.md', '# Bundled third-party notices\n\nGenerated from packages present in the distribution bundles.\n\n' + notices.join('\n\n---\n\n') + '\n');
