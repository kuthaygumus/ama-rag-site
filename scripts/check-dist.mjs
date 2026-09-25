// Runs after `astro build`. Two guards on the built HTML:
//  1. an inline <svg> must not contain HTML block tags — a blank line inside an SVG in MDX/Markdown ends the
//     raw block, the processor wraps the rest in <p>, and the browser silently drops the drawing;
//  2. no audience-facing page may carry stage directions or trainer wording (one shared screen).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const STAGE = /\b(eğitmen|projektör|salon|katılımcılar?|trainer|presenter|sunumda de|sorulabilir|fikri olan|el kaldır|odanın|odada|the room)/i;
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
let problems = 0, svgs = 0;
for (const f of walk('dist').filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)) {
    svgs++;
    if (/<\/?(p|div|br|h[1-6])\b/.test(m[0])) { problems++; console.log(`broken svg  ${f}`); }
  }
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  const hit = text.match(STAGE);
  if (hit) { problems++; console.log(`stage word  ${f}: "${hit[0]}"`); }
}
console.log(problems ? `check:dist ✗ ${problems} problem(s)` : `check:dist ✓ ${svgs} inline SVGs intact, no stage directions`);
process.exit(problems ? 1 : 0);
