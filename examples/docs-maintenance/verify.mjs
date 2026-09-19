import { readFile } from 'node:fs/promises';
const changes = JSON.parse(await readFile('examples/docs-maintenance/changes.json', 'utf8'));
const text = await readFile('change-summary.md', 'utf8');
const expected = new Set(changes.map(c => c.id));
const actual = new Set([...text.matchAll(/\[(CHANGE-\d+)\]/g)].map(m => m[1]));
if (!text.startsWith('# ') || text.length > 10000 || actual.size !== expected.size || [...expected].some(id => !actual.has(id))) {
  throw new Error('Summary must have a heading, stay under 10,000 characters, and cite every change ID with no invented IDs.');
}
