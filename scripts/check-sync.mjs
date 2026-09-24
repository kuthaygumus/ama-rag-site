// npm run check:sync — fail when a snippet no longer matches the workshop repo (no hand-typed code or output).
// Without the workshop next to this repo (a Vercel build) there is nothing to compare: skip.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { WORKSHOP, snippetPairs } from './snippet-files.mjs';

if (!existsSync(WORKSHOP)) {
  console.log(`check:sync skipped — ${WORKSHOP} not found (clean clone / Vercel build)`);
  process.exit(0);
}
const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)])) : []);
const pairs = snippetPairs();
const expected = new Set(pairs.map(([, to]) => to));
const problems = [];
for (const [from, to] of pairs) {
  if (!existsSync(to)) problems.push(`missing  ${to}`);
  else if (!readFileSync(from).equals(readFileSync(to))) problems.push(`drifted  ${to}`);
}
for (const f of walk('src/snippets')) if (!expected.has(f)) problems.push(`stale    ${f}`);
if (problems.length) {
  console.log(problems.join('\n') + `\ncheck:sync ✗ ${problems.length} file(s) — run: npm run sync`);
  process.exit(1);
}
console.log(`check:sync ✓ ${pairs.length} files match ${WORKSHOP}`);
