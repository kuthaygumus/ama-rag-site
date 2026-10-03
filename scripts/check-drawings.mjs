// Fails when a drawing shows a number that its source does not hold (plan/site.md §2, mechanism Q), or when a
// generated drawing is not what the logs draw (mechanism G, scripts/gen-drawings.mjs). Part of `build` since S7g,
// when the TR labels moved to the English capture (PLAN §1.3).
//
// Rules, per <text> of every inline drawing:
//   1. every number in a label with data-q is a number of its source(s) (data-q="log:x code:y …"; const = design value)
//   2. data-q-mode="quote": every "…"-separated fragment of 4+ characters is verbatim in a source
//   3. a label that shows a digit has data-q, or is drawn by a generator (data-gen on it or on its group)
//   and the aria-label of a drawing with data labels: its numbers are numbers of its labels or of their sources.
// ⟦…⟧ placeholders of the English drafts are skipped (fill.mjs and check-en own them).
// Usage: node scripts/check-drawings.mjs [--root <dir>] [--lang tr|en] [--allow-placeholders] [<page.mdx>…]
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { DrawError, SITE, attrsOf, drawings, readSource, visible } from './drawings/lib.mjs';

const args = process.argv.slice(2);
const opt = (o) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
const ROOT = resolve(SITE, opt('--root') ?? 'src/content/docs');
const files = args.filter((a, i) => !a.startsWith('--') && !['--root', '--lang'].includes(args[i - 1]));
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const pages = (files.length ? files.map((f) => resolve(f)) : walk(ROOT)).filter((f) => f.endsWith('.mdx')).sort();

// G: the generators, in report mode.
let genOk = true;
try {
  execFileSync(process.execPath, [join(SITE, 'scripts/gen-drawings.mjs'), ...args], { stdio: 'inherit', cwd: SITE });
} catch {
  genOk = false;
}

// Q: the data-q rules.
const NUM = /\d+(?:[.,]\d+)?/g;
const norm = (n) => String(parseFloat(n.replace(',', '.')));
const numbers = (s) => (s.match(NUM) || []).map(norm);
const tokenCache = new Map();
function tokens(q) {
  if (!tokenCache.has(q)) tokenCache.set(q, new Set(numbers(readSource(q))));
  return tokenCache.get(q);
}
// Typographic and straight quotes are the same character for a quote check; so is any run of white space.
const flat = (s) => s.replace(/[“”„«»]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
const EDGE = /^["'\s]+|["'\s]+$/g;
const problems = [];
let labels = 0, tagged = 0;
for (const file of pages) {
  const name = relative(ROOT, file);
  const page = readFileSync(file, 'utf8');
  for (const d of drawings(page)) {
    const where = `${name} svg${d.index}`;
    // Texts inside a generator-owned group (the map's points and legend) count as generated.
    const genRanges = [...d.src.matchAll(/<g\b[^>]*\bdata-gen="[^"]*"[^>]*>[\s\S]*?<\/g>/g)].map((m) => [m.index, m.index + m[0].length]);
    const union = new Set(), shown = new Set();
    let hasData = !!d.draw;
    // A data-q on the <svg> itself names the source of numbers that only its aria-label shows.
    const svgQ = (d.src.match(/^<svg\b[^>]*?\sdata-q="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter((q) => q && q !== 'const');
    try { svgQ.forEach((q) => tokens(q).forEach((t) => union.add(t))); } catch (e) { if (!(e instanceof DrawError)) throw e; problems.push(`${where}: ${e.message}`); }
    const texts = [...d.src.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)];
    texts.forEach((m, i) => {
      labels++;
      const a = attrsOf(m[1]);
      const label = visible(m[2].replace(/⟦[^⟧]*⟧/g, ' '));
      const gen = 'data-gen' in a || genRanges.some(([s, e]) => m.index > s && m.index < e);
      numbers(label).forEach((n) => shown.add(n));
      const at = `${where} t${i + 1} "${label.slice(0, 60)}"`;
      if (!a['data-q']) {
        if (!gen && /\d/.test(label)) problems.push(`${at}: shows a digit but has no data-q (rule 3)`);
        return;
      }
      tagged++;
      hasData = true;
      const qs = a['data-q'].split(/\s+/).filter((q) => q !== 'const');
      if (!qs.length) return;
      try {
        const have = new Set(qs.flatMap((q) => [...tokens(q)]));
        qs.forEach((q) => tokens(q).forEach((t) => union.add(t)));
        const missing = numbers(label).filter((n) => !have.has(n));
        if (missing.length) problems.push(`${at}: ${missing.join(', ')} not in ${qs.join(' ')} (rule 1)`);
        if (a['data-q-mode'] === 'quote') {
          const src = qs.map((q) => flat(readSource(q))).join('\n');
          const frags = flat(label).split('…').map((f) => f.replace(EDGE, '')).filter((f) => f.length >= 4);
          const off = frags.filter((f) => !src.includes(flat(f)));
          if (off.length) problems.push(`${at}: "${off[0].slice(0, 50)}" is not verbatim in ${qs.join(' ')} (rule 2)`);
        }
      } catch (e) {
        if (!(e instanceof DrawError)) throw e;
        problems.push(`${at}: ${e.message}`);
      }
    });
    const aria = visible((d.src.match(/^<svg\b[^>]*?\saria-label="([^"]*)"/)?.[1] ?? '').replace(/⟦[^⟧]*⟧/g, ' '));
    if (hasData) {
      const off = numbers(aria).filter((n) => !union.has(n) && !shown.has(n));
      if (off.length) problems.push(`${where} aria-label: ${off.join(', ')} not in its labels or their sources (rule 1)`);
    }
  }
}
for (const p of problems) console.log(`✗ ${p}`);
console.log(problems.length
  ? `check:drawings ✗ ${problems.length} label problem(s) in ${labels} labels (${tagged} with data-q)`
  : `check:drawings ✓ ${labels} labels, ${tagged} with data-q, every number traced to its source`);
process.exit(problems.length || !genOk ? 1 : 0);
