// Runs before `astro build`. Every <Log> and <RepoCode> shows a slice of a synced file, and the page text talks about
// what that slice shows. When the workshop re-captures its logs or edits its code, line numbers move and the slice
// silently starts or ends one block off (or a `mark` lands on the wrong line). This check rebuilds each slice exactly
// the way the components do (Log.astro, RepoCode.astro) and compares its first and last shown line, and every numeric
// mark, with the content anchors in scripts/ranges.json: `first`, `last`, optional `after` (the line just below a
// Log that stops short of the end), `marks` {line: regex}, and `toEOF` for a RepoCode allowed to run to the end.
//   node scripts/check-ranges.mjs            fail on any drift (quiet when green)
//   node scripts/check-ranges.mjs --list     also print every excerpt: page:line  file  L<first>-L<last>  first/last
//   node scripts/check-ranges.mjs --suggest  for each drifted Log, print the from/to that satisfy its anchors again
// Anchors are regexes on line content, never line numbers. A row is keyed by the tag's own values, so the TR page and
// its EN twin (check-i18n forces equal values) share one row.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LIST = process.argv.includes('--list');
const SUGGEST = process.argv.includes('--suggest');
const DOCS = 'src/content/docs';
const ROWS = JSON.parse(readFileSync('scripts/ranges.json', 'utf8'));
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const cut = (s) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A starting anchor for a line that has none yet: literal text, numbers loosened (they re-roll with every capture).
const draft = (s) => '^\\s*' + esc(s.trim().slice(0, 48)).replace(/\d+/g, '\\d+');

/** Tag attributes: name="x" or name={expr}. Braced numbers and arrays are parsed as JSON; a single-quoted
 *  string (from={'"id":"q01"'}) is its text; anything else is kept as raw text. */
function attrs(tag) {
  const a = {};
  for (const m of tag.matchAll(/(\w+)=(?:"([^"]*)"|\{([^}]*)\})/g)) {
    if (m[2] !== undefined) a[m[1]] = m[2];
    else if (/^'[^']*'$/.test(m[3].trim())) a[m[1]] = m[3].trim().slice(1, -1);
    else try { a[m[1]] = JSON.parse(m[3]); } catch { a[m[1]] = m[3]; }
  }
  return a;
}

/** Same slice as Log.astro: lines.slice(from ?? 0, to ?? length) on the trimmed file. Line numbers are 1-based. */
function logSlice(a) {
  const p = `src/snippets/logs/${a.name}.txt`;
  if (!existsSync(p)) return { error: `missing file ${p}` };
  const lines = readFileSync(p, 'utf8').trimEnd().split('\n');
  const first = a.from ?? 0, end = a.to ?? lines.length;
  if (end > lines.length) return { error: `to=${end} runs past the file (${lines.length} lines)`, lines };
  if (first >= end) return { error: `empty slice from=${first} to=${end}`, lines };
  return { lines, first, end, toEOF: a.to === undefined };
}

/** Same slice as RepoCode.astro: line holding `from`, climb over a JSDoc above it, end at the first `to` match. */
function codeSlice(a) {
  const p = `src/snippets/code/${a.file}`;
  if (!existsSync(p)) return { error: `missing file ${p}` };
  const lines = readFileSync(p, 'utf8').split('\n');
  if (!a.from) return { lines, first: 0, end: lines.length, whole: true };
  let start = lines.findIndex((l) => l.includes(a.from));
  if (start < 0) return { error: `from "${a.from}" not found`, lines };
  while (start > 0 && /^\s*(\/\*\*|\*)/.test(lines[start - 1])) start--;
  const endRe = new RegExp(a.to ?? '^}');
  const rel = lines.slice(start + 1).findIndex((l) => endRe.test(l));
  // RepoCode trims trailing blank lines (trimEnd) after slicing; the last shown line is the last non-blank one.
  let end = rel < 0 ? lines.length : start + rel + 2;
  while (end > start + 1 && lines[end - 1].trim() === '') end--;
  return { lines, first: start, end, toEOF: rel < 0 };
}

/** The line nearest to `near`, at or after `start`, for which ok(i) holds; -1 when none. */
function nearest(lines, start, near, ok) {
  let best = -1;
  for (let i = start; i < lines.length; i++) if (ok(i) && (best < 0 || Math.abs(i - near) < Math.abs(best - near))) best = i;
  return best;
}

let problems = 0, checked = 0;
const used = new Set();
const fail = (where, msg) => { problems++; console.log(`✗ ${where}  ${msg}`); };
for (const page of walk(DOCS).filter((f) => f.endsWith('.mdx')).sort()) {
  readFileSync(page, 'utf8').split('\n').forEach((text, i) => {
    for (const m of text.matchAll(/<(Log|RepoCode)\b[^]*?\/>/g)) {
      const where = `${page.slice(DOCS.length + 1)}:${i + 1}`;
      const a = attrs(m[0]);
      const isLog = m[1] === 'Log';
      const s = isLog ? logSlice(a) : codeSlice(a);
      const src = isLog ? a.name : a.file;
      checked++;
      if (s.error) { fail(where, `${src}: ${s.error}`); continue; }
      const shown = s.lines.slice(s.first, s.end);
      if (LIST) console.log(`${where}  ${src}  L${s.first + 1}-L${s.end}  first: ${cut(shown[0])}  last: ${cut(shown.at(-1))}`);
      // Marks are 1-based lines of the shown excerpt (numbers) or text that must be in it (strings).
      const marks = a.mark ?? [];
      for (const k of marks) {
        if (typeof k === 'number' && (k < 1 || k > shown.length)) fail(where, `${src}: mark ${k} points past the excerpt (${shown.length} lines)`);
        else if (typeof k === 'string' && !shown.some((l) => l.includes(k))) fail(where, `${src}: mark "${k}" is not in the excerpt`);
        else if (typeof k !== 'number' && typeof k !== 'string') fail(where, `${src}: mark ${JSON.stringify(k)} is not a line number or text`);
      }
      const ranged = isLog ? a.from !== undefined || a.to !== undefined : !s.whole;
      if (!ranged) continue;
      const key = isLog ? `${a.name} from=${a.from ?? '-'} to=${a.to ?? '-'}` : `${a.file} from=${a.from} to=${a.to ?? '-'}`;
      used.add(key);
      const row = ROWS[key];
      if (!row) {
        const d = { first: draft(shown[0]), last: draft(shown.at(-1)) };
        if (!isLog && s.toEOF) d.toEOF = true;
        const nums = marks.filter((k) => typeof k === 'number');
        if (nums.length) d.marks = Object.fromEntries(nums.map((k) => [k, draft(shown[k - 1].trim())]));
        fail(where, `no anchor row in scripts/ranges.json; draft:\n    ${JSON.stringify(key)}: ${JSON.stringify(d)},`);
        continue;
      }
      if (!isLog && s.toEOF && !row.toEOF) fail(where, `${src}: to "${a.to ?? '^}'}" matches nothing below "${a.from}", the excerpt runs to the end of the file (allow with "toEOF": true)`);
      const bad = [];
      if (!new RegExp(row.first).test(shown[0])) bad.push(`first line "${cut(shown[0])}" !~ /${row.first}/`);
      if (!new RegExp(row.last).test(shown.at(-1))) bad.push(`last line "${cut(shown.at(-1))}" !~ /${row.last}/`);
      // `after`: the line just below the excerpt (the one it stops short of); "" past the end of the file.
      if (row.after && !new RegExp(row.after).test(s.lines[s.end] ?? '')) bad.push(`line after "${cut(s.lines[s.end])}" !~ /${row.after}/`);
      for (const k of marks.filter((k) => typeof k === 'number')) {
        const re = row.marks?.[k];
        if (!re) bad.push(`mark ${k} has no anchor in the row`);
        else if (k <= shown.length && !new RegExp(re).test(shown[k - 1])) bad.push(`mark ${k} on "${cut(shown[k - 1])}" !~ /${re}/`);
      }
      if (!bad.length) continue;
      fail(where, `${src} L${s.first + 1}-L${s.end} drifted off its anchors:\n    ${bad.join('\n    ')}`);
      if (SUGGEST && isLog) {
        const [fRe, lRe, aRe] = [row.first, row.last, row.after ?? ''].map((r) => new RegExp(r));
        const from = nearest(s.lines, 0, s.first, (i) => fRe.test(s.lines[i]));
        const last = from < 0 ? -1 : a.to === undefined ? s.lines.length - 1
          : nearest(s.lines, from, s.end - 1, (i) => lRe.test(s.lines[i]) && aRe.test(s.lines[i + 1] ?? ''));
        if (from < 0 || last < 0 || !lRe.test(s.lines[last])) console.log(`    suggest: no line matches the anchors; rewrite the row`);
        else console.log(`    suggest: from={${from}}${a.to === undefined ? '' : ` to={${last + 1}}`}  (L${from + 1}-L${last + 1}; rename the row key to match)`);
      }
    }
  });
}
for (const key of Object.keys(ROWS)) if (!key.startsWith('//') && !used.has(key)) fail('scripts/ranges.json', `row ${JSON.stringify(key)} is used by no tag (stale)`);
console.log(problems ? `check:ranges ✗ ${problems} problem(s)` : `check:ranges ✓ ${checked} excerpts (${used.size} anchored) on their anchors, marks inside`);
process.exit(problems ? 1 : 0);
