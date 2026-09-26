// Runs before `astro build`. A ▶ Şimdi strip (<Now n="…"> inside a deck step) sends the room from the deck to
// one item of the page's SIRA SENDE box, so the two must agree: the item must exist, and every command the strip
// shows must also be written in the box. Otherwise the deck and the box drift apart.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const COMMAND = /^(npm|npx|podman|ollama) /;
let problems = 0, strips = 0;
for (const f of walk('src/content/docs').filter((f) => f.endsWith('.mdx'))) {
  const src = readFileSync(f, 'utf8');
  const boxes = [...src.matchAll(/<YourTurn\b[^>]*>([\s\S]*?)<\/YourTurn>/g)].map((m) => m[1]).join('\n');
  const decks = [...src.matchAll(/<Deck>([\s\S]*?)<\/Deck>/g)].map((m) => m[1]).join('\n');
  const all = [...src.matchAll(/<Now\b([^>]*)>([\s\S]*?)<\/Now>/g)];
  if (all.length !== [...decks.matchAll(/<Now\b/g)].length) { problems++; console.log(`outside deck ${f}`); }
  for (const [, attrs, body] of all) {
    strips++;
    if (!boxes) { problems++; console.log(`no box       ${f}`); continue; }
    const n = attrs.match(/\bn="([^"]+)"/)?.[1];
    if (n && !new RegExp(`\\*\\*${n} · |^\\s*${n}\\. `, 'm').test(boxes)) { problems++; console.log(`no item      ${f}: SIRA SENDE ${n}`); }
    for (const [, code] of body.matchAll(/`([^`]+)`/g)) {
      if (COMMAND.test(code) && !boxes.includes(code)) { problems++; console.log(`not in box   ${f}: ${code}`); }
    }
  }
}
console.log(problems ? `check:now ✗ ${problems} problem(s)` : `check:now ✓ ${strips} strips, each on a box item and naming only the box's commands`);
process.exit(problems ? 1 : 0);
