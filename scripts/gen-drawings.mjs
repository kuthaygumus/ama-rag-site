// Draws the data drawings from the logs (plan/site.md §2, mechanism G): every <svg data-draw="<generator>"> in the
// pages is rebuilt by scripts/drawings/generators.mjs and compared with what the page holds.
//
// Usage: node scripts/gen-drawings.mjs [--fix] [--root <dir>] [--lang tr|en] [--allow-placeholders] [<page.mdx>…]
//   (no --fix)   report only; exit 1 on any difference or error (this is what check-drawings runs)
//   --fix        write the drawings back; exit 1 only on errors
//   --root       the pages folder (default src/content/docs; the scratch EN pages live outside the repo)
//   --lang       page language when the path does not say it (`/en/` in the path means en, else tr)
//   --allow-placeholders  a difference where the page still holds a ⟦…⟧ placeholder is listed, not failed
// Sources: WORKSHOP_DIR/logs when WORKSHOP_DIR is set (the pre-freeze runs, PLAN §4), else src/snippets.
//
// Tolerance: geometry numbers (x, y, cx, cy, width, height, d, points) that differ by at most 0.1 px count as
// equal. The map scales today's points into the box today's points span, so a re-draw on the same data can move a
// point by one rounding step; labels and every other text must be equal byte for byte.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { DrawError, LOGS, SITE, applyEdits, drawings, genElements } from './drawings/lib.mjs';
import { GENERATORS } from './drawings/generators.mjs';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (o) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
const FIX = flag('--fix'), ALLOW = flag('--allow-placeholders');
const ROOT = resolve(SITE, opt('--root') ?? 'src/content/docs');
const LANG = opt('--lang');
const files = args.filter((a, i) => !a.startsWith('--') && !['--root', '--lang'].includes(args[i - 1]));
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const pages = (files.length ? files.map((f) => resolve(f)) : walk(ROOT)).filter((f) => f.endsWith('.mdx')).sort();

const GEOM = /\b(x|y|cx|cy|width|height|d|points)="([^"]*)"/g;
/** Equal, or equal except geometry numbers within 0.1 px. */
function same(a, b) {
  if (a === b) return true;
  const blank = (s) => s.replace(GEOM, '$1=""');
  if (blank(a) !== blank(b)) return false;
  const nums = (s) => [...s.matchAll(GEOM)].flatMap((m) => m[2].match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const na = nums(a), nb = nums(b);
  return na.length === nb.length && na.every((v, i) => Math.abs(v - nb[i]) <= 0.1001);
}
let nearly = 0;
function diffLines(a, b) {
  const A = a.split('\n'), B = b.split('\n'), out = [];
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    if (A[i] === B[i]) continue;
    if (A[i] !== undefined && B[i] !== undefined && same(A[i], B[i])) { nearly++; continue; }
    out.push({ was: (A[i] ?? '').trim(), now: (B[i] ?? '').trim() });
  }
  return out;
}

let errors = 0, diffs = 0, pending = 0, count = 0;
console.log(`gen-drawings: logs from ${relative(SITE, LOGS) || LOGS}${FIX ? ' (--fix)' : ''}`);
for (const file of pages) {
  const lang = LANG ?? (/(^|\/)en\//.test(relative(ROOT, file)) || /\/en\//.test(file) ? 'en' : 'tr');
  let page = readFileSync(file, 'utf8');
  const name = relative(ROOT, file);
  let changed = false;
  for (const d of drawings(page).reverse()) {
    if (!d.draw) continue;
    count++;
    const gen = GENERATORS[d.draw];
    const where = `${name} svg${d.index} ${d.draw}`;
    if (!gen) { errors++; console.log(`✗ ${where}: no generator of that name`); continue; }
    let out, notes = [];
    try {
      const r = gen({ svg: d.src, els: genElements(d.src), lang, page: name });
      out = applyEdits(d.src, r.edits, r.aria);
      notes = r.notes ?? [];
    } catch (e) {
      if (!(e instanceof DrawError)) throw e;
      errors++;
      console.log(`✗ ${where}: ${e.message}`);
      continue;
    }
    const before = nearly;
    const lines = diffLines(d.src, out);
    if (nearly > before) notes.unshift(`${nearly - before} line(s) equal within 0.1 px, not byte for byte`);
    const open = lines.filter((l) => /⟦/.test(l.was));
    if (!lines.length) console.log(`✓ ${where}`);
    else {
      const hard = lines.length - open.length;
      if (hard || !ALLOW) diffs++;
      pending += open.length;
      console.log(`${FIX ? '↻' : hard || !ALLOW ? '✗' : '·'} ${where}: ${lines.length} line(s) differ${open.length ? ` (${open.length} still a ⟦…⟧ placeholder)` : ''}`);
      for (const l of lines.slice(0, 12)) console.log(`    - ${l.was.slice(0, 150)}\n    + ${l.now.slice(0, 150)}`);
      if (lines.length > 12) console.log(`    … ${lines.length - 12} more`);
    }
    for (const n of notes) console.log(`    note: ${n}`);
    if (FIX && lines.length) {
      page = page.slice(0, d.start) + out + page.slice(d.end);
      changed = true;
    }
  }
  if (changed) writeFileSync(file, page);
}
const bad = errors + (FIX ? 0 : diffs);
console.log(`gen-drawings ${bad ? '✗' : '✓'} ${count} generated drawing(s): ${diffs} differ${pending ? ` (${pending} placeholder line(s))` : ''}, ${errors} error(s)`);
process.exit(bad ? 1 : 0);
