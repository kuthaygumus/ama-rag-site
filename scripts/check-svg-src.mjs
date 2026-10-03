// Runs before `astro build`. A blank line inside an inline <svg> in an .mdx page ends the raw block: the
// processor wraps the rest of the drawing in <p>, and the browser silently drops it. check-dist sees this only
// after a full build; this check names the page and line before the build starts.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
let problems = 0, svgs = 0;
for (const f of walk('src/content/docs').filter((f) => f.endsWith('.mdx'))) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/<svg\b[\s\S]*?<\/svg>/g)) {
    svgs++;
    const blank = m[0].match(/\n[ \t]*\n/);
    if (!blank) continue;
    problems++;
    const line = src.slice(0, m.index + blank.index).split('\n').length + 1;
    console.log(`blank line in svg  ${f}:${line}`);
  }
}
console.log(problems ? `check:svg-src ✗ ${problems} drawing(s) with a blank line` : `check:svg-src ✓ ${svgs} inline SVGs in the pages, no blank line inside`);
process.exit(problems ? 1 : 0);
