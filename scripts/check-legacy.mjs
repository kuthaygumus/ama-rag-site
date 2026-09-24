// npm run check:legacy [-- <dir>] — nothing from the retired course material may come back.
// Fails on any marker below, in any text file of this repo (or of <dir>, e.g. dist/).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const MARKERS = [
  /ama-rag-(course|from-scratch|lab)\b/,
  /amadeus/i,
  /fare_classic/i,
  /CLASSIC K\b/,
  /kraken-q2/i,
  /\bMNIST\b/i,
  /\bColab\b/i,
  /\.ipynb\b/,
  /\.py\b/,
  /going-further/,
  /presenter/i,
  /\bHelios\b/i,
  /\bIRIS\b/,
  /\blab\b/i,
];
const SKIP = new Set(['node_modules', '.git', '.astro', '.vercel', 'dist']);
const TEXT = /\.(ts|js|mjs|cjs|json|jsonl|md|mdx|astro|css|html|svg|yaml|yml|bru|txt|xml)$|^\.[a-z]+$/;
const SELF = /check-(legacy|dist)\.(ts|mjs)$/;

const root = process.argv[2] ?? '.';
const skip = root === '.' ? SKIP : new Set(['node_modules', '.git']);
function* files(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (TEXT.test(e.name) && !SELF.test(p) && e.name !== 'package-lock.json') yield p;
  }
}
let hits = 0, scanned = 0;
for (const f of files(root)) {
  scanned++;
  readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
    for (const m of MARKERS) if (m.test(l)) { hits++; console.log(`${relative('.', f)}:${i + 1}  ${m}  ${l.trim().slice(0, 100)}`); }
  });
}
console.log(hits ? `\ncheck:legacy ✗ ${hits} hit(s) in ${scanned} files (${root})` : `check:legacy ✓ 0 hits in ${scanned} files (${root})`);
process.exit(hits ? 1 : 0);
