// Fills the ⟦…⟧ placeholders of the English pages (plan D8) from the workshop's logs, corpus, code and facts.json.
// No number is typed by hand, and nothing ships with a hole: a missing file, a regex miss, a missing facts key, an
// empty value or an unknown form is an error that names the page, the line and the placeholder. Exit 1 if any is left.
//
// Usage: node scripts/dev/fill.mjs (--check | --out <dir> [--partial] | --in-place) [--report <file.json>] <path>…
//   <path>      .mdx/.js/.json files, or folders (walked; `_notes` folders and other extensions are skipped)
//   --check     report only, write nothing
//   --out       write filled copies under <dir> (folder args keep their inner paths, file args their base name);
//               nothing is written while any placeholder fails, unless --partial (then failed ones stay as ⟦…⟧)
//   --in-place  overwrite the sources; only when every placeholder in every file resolves
//   --report    write every placeholder with its value or its error as JSON
// Sources resolve against WORKSHOP_DIR (default ../ama-rag-workshop, from the site root), the same as snippet-files.mjs.
//
// Placeholder forms (one grammar; the scratch pages were normalized to it, see the dry-run notes):
//   ⟦SRC /RE/flags⟧                 group 1 of the first match
//   ⟦SRC /RE/flags minus /RE2/⟧     number minus number (RE2 on the same SRC); also `minus <number>`
//   ⟦facts.json KEY.PATH⟧           a value from logs/facts.json (check:story --write-facts), `.value` unwrapped;
//                                   facts.json never takes a /regex/ (refused as a form error)
//   ⟦… → T → T⟧                     transforms, applied left to right (TRANSFORMS below)
//   ⟦calc EXPR⟧                     arithmetic over [SRC /RE/] refs ([SRC /RE/g] = every match, as a list), [facts.json KEY], numbers
//                                   and round floor ceil abs min max fmt(x,d) ordinal(n) gained(a,b) lost(a,b)
// SRC: `site:<path>` (this repo), `code:<path>` or any `<dir>/<path>` (workshop), `facts.json` (workshop
//   logs/facts.json), `<name>.txt|.json` (workshop logs/<name>…), `<name>` (workshop logs/<name>.txt).
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WORKSHOP = resolve(SITE, process.env.WORKSHOP_DIR ?? '../ama-rag-workshop');

class FillError extends Error {
  constructor(kind, msg) { super(msg); this.kind = kind; }
}
const fail = (kind, msg) => { throw new FillError(kind, msg); };

// ── sources ───────────────────────────────────────────────────────────────────────────────────────
function sourcePath(src) {
  if (src.startsWith('site:')) return join(SITE, src.slice(5));
  if (src.startsWith('code:')) return join(WORKSHOP, src.slice(5));
  if (src === 'facts.json') return join(WORKSHOP, 'logs/facts.json');
  if (src.includes('/')) return join(WORKSHOP, src);
  if (/\.(txt|json)$/.test(src)) return join(WORKSHOP, 'logs', src);
  if (/^[\w.-]+$/.test(src)) return join(WORKSHOP, 'logs', `${src}.txt`);
  return fail('form', `bad source "${src}"`);
}
const cache = new Map();
function text(src) {
  const p = sourcePath(src);
  if (!cache.has(p)) {
    if (!existsSync(p)) fail(src === 'facts.json' ? 'facts' : 'missing-file', `missing file ${relative(SITE, p)}`);
    cache.set(p, readFileSync(p, 'utf8'));
  }
  return cache.get(p);
}

// ── a JS regex literal, read like the JS lexer does (escapes and [classes] may hold a "/") ────────────
function readRegex(s, i) {
  if (s[i] !== '/') fail('form', `expected /regex/ at "${s.slice(i, i + 20)}"`);
  let j = i + 1, inClass = false;
  for (; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') { j++; continue; }
    if (inClass) { if (c === ']') inClass = false; continue; }
    if (c === '[') inClass = true;
    else if (c === '/') break;
  }
  if (j >= s.length) fail('form', `unterminated regex "${s.slice(i, i + 40)}"`);
  const flags = s.slice(j + 1).match(/^[a-z]*/)[0];
  if (/[^gimsu]/.test(flags)) fail('form', `bad regex flags "${flags}"`);
  let re;
  try { re = new RegExp(s.slice(i + 1, j), flags.replace('g', '')); } catch (e) { fail('form', `bad regex: ${e.message}`); }
  return { re, all: flags.includes('g'), end: j + 1 + flags.length };
}

/** The text a /RE/ runs on. facts.json has none: each value sits in {value, from}, so a regex over the file
 *  text cannot tell a key from its group and fails only at the freeze. It takes a KEY.PATH instead. */
const regexText = (src, re) =>
  src === 'facts.json' ? fail('form', `facts.json ${re}: use a KEY.PATH (or [facts.json KEY] in calc), not a /regex/`) : text(src);
/** The match of RE in SRC, or a loud miss. */
function match(src, re) {
  const m = regexText(src, re).match(re);
  if (!m) fail('regex-miss', `regex miss ${re} in ${src}`);
  return m;
}
const allMatches = (src, re) => [...regexText(src, re).matchAll(new RegExp(re.source, re.flags + 'g'))];

function num(v, what) {
  const n = Number(String(v).replace(/,/g, ''));
  if (String(v).trim() === '' || !Number.isFinite(n)) fail('not-a-number', `${what}: "${v}" is not a number`);
  return n;
}
const decimals = (s) => (String(s).split('.')[1] ?? '').length;

// ── facts.json: { facts: { group: { key: { value, from } } } }, keys may hold dots ─────────────────────
function factRaw(path) {
  let json;
  try { json = JSON.parse(text('facts.json')); } catch (e) { if (e instanceof FillError) throw e; fail('facts', `facts.json: ${e.message}`); }
  const [group, ...rest] = path.split('.');
  const g = json.facts?.[group] ?? fail('facts', `facts key "${path}": no group "${group}" in facts.json`);
  let k = rest.length;
  while (k > 0 && !(rest.slice(0, k).join('.') in g)) k--;
  if (k === 0) fail('facts', `facts key "${path}" not in facts.json (group ${group} has: ${Object.keys(g).join(', ')})`);
  let v = g[rest.slice(0, k).join('.')].value;
  for (const seg of rest.slice(k)) {
    if (v == null || typeof v !== 'object' || !(seg in v)) fail('facts', `facts key "${path}": no "${seg}"`);
    v = v[seg];
  }
  if (v == null || typeof v === 'object') fail('facts', `facts key "${path}" is ${JSON.stringify(v)?.slice(0, 60)}, not a value`);
  return v;
}
function factValue(path) {
  const v = factRaw(path);
  if (typeof v === 'number' && decimals(v) > 3) fail('calc', `facts key "${path}" = ${v}: use ⟦calc fmt([facts.json ${path}], d)⟧`);
  return String(v);
}

// ── transforms (`→ name args`); args are "quoted" or bare tokens ────────────────────────────────────
const ordinal = (n) => {
  if (!Number.isInteger(n) || n < 1) fail('calc', `ordinal of ${n}`);
  const k = n % 100;
  return `${n}${k >= 11 && k <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th'}`;
};
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
/** A duration in plain words with no digits (read aloud): "about half a minute". */
function durationWords(ms) {
  const s = ms / 1000;
  if (s < 1.5) return 'about a second';
  if (s < 20.5) return `about ${WORDS[Math.round(s)]} seconds`;
  if (s < 25) return 'about twenty seconds';
  if (s < 37.5) return 'about half a minute';
  if (s < 50) return 'about forty seconds';
  if (s < 75) return 'about a minute';
  if (s < 105) return 'about a minute and a half';
  const m = Math.round(s / 60);
  return m <= 20 ? `about ${WORDS[m]} minutes` : fail('calc', `duration ${ms} ms is too long for words`);
}
function wrap(v, width, sel) {
  const lines = [];
  for (const w of v.split(/\s+/)) {
    if (lines.length && (lines.at(-1) + ' ' + w).length <= width) lines[lines.length - 1] += ' ' + w;
    else lines.push(w);
  }
  const m = String(sel).match(/^(\d+)(-?)$/) ?? fail('form', `wrap: bad line "${sel}"`);
  const out = m[2] ? lines.slice(m[1] - 1).join(' ') : lines[m[1] - 1];
  return out ?? fail('empty', `wrap ${width}: the text has ${lines.length} line(s), no line ${sel}`);
}
/** The two needles in order, every cut marked with "…". */
function keep(v, a, b) {
  const ia = v.indexOf(a);
  const ib = ia < 0 ? -1 : v.indexOf(b, ia + a.length);
  if (ia < 0 || ib < 0) fail('regex-miss', `keep: "${a}" then "${b}" not in "${v.slice(0, 80)}"`);
  const has = (s) => /[\p{L}\p{N}]/u.test(s);
  return `${has(v.slice(0, ia)) ? '… ' : ''}${a}${has(v.slice(ia + a.length, ib)) ? ' … ' : ' '}${b}${has(v.slice(ib + b.length)) ? ' …' : ''}`;
}
const TRANSFORMS = {
  count: { n: 0 }, // matches of the regex (no group needed); must come first
  join: { n: 1 }, // every group, joined with the separator; must come first
  lowercase: { n: 0, fn: (v) => v.toLocaleLowerCase(/[çğıöşüÇĞİÖŞÜ]/.test(v) ? 'tr' : 'en') }, // Turkish İ → i, not i̇
  nospace: { n: 0, fn: (v) => v.replace(/\s+/g, '') },
  'drop-parens': { n: 0, fn: (v) => v.replace(/\s*\([^)]*\)/g, '') },
  inverse: { n: 0, fn: (v) => String(Math.round(1 / num(v, 'inverse'))) },
  ordinal: { n: 0, fn: (v) => ordinal(num(v, 'ordinal')) },
  'duration-words': { n: 0, fn: (v) => durationWords(num(v, 'duration-words')) },
  position: { n: 1, fn: (v, [x]) => { const i = v.split(/\s+/).indexOf(x); return i < 0 ? fail('regex-miss', `position: "${x}" not in "${v}"`) : String(i + 1); } },
  replace: { n: 2, fn: (v, [a, b]) => (v.includes(a) ? v.split(a).join(b) : fail('regex-miss', `replace: "${a}" not in "${v}"`)) },
  keep: { n: 2, fn: (v, [a, b]) => keep(v, a, b) },
  wrap: { n: 2, fn: (v, [w, sel]) => wrap(v, num(w, 'wrap width'), sel) },
};
function readTransform(t) {
  const [name, ...rest] = [...t.matchAll(/"((?:[^"\\]|\\.)*)"|(\S+)/g)].map((m) => (m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2]));
  const spec = TRANSFORMS[name] ?? fail('form', `unknown transform "→ ${t}" (known: ${Object.keys(TRANSFORMS).join(', ')})`);
  if (rest.length !== spec.n) fail('form', `→ ${name} takes ${spec.n} argument(s), got "${t}"`);
  return { name, args: rest };
}

// ── one placeholder ──────────────────────────────────────────────────────────────────────────────
function parse(body) {
  if (body.startsWith('calc ')) return { calc: body.slice(5).trim() };
  const sp = body.indexOf(' ');
  if (sp < 1) fail('form', 'no source and no /regex/');
  const src = body.slice(0, sp);
  let ref, rest;
  if (src === 'facts.json' && body[sp + 1] !== '/') {
    const key = body.slice(sp + 1).match(/^[\w.-]+/)?.[0] ?? fail('form', 'facts.json needs a key or a /regex/');
    ref = { src, key };
    rest = body.slice(sp + 1 + key.length);
  } else {
    const r = readRegex(body, sp + 1);
    if (r.all) fail('form', 'the g flag works only inside calc (use → count to count matches)');
    ref = { src, re: r.re };
    rest = body.slice(r.end);
  }
  let minus;
  if (rest.startsWith(' minus ')) {
    rest = rest.slice(7);
    if (rest[0] === '/') { const r = readRegex(rest, 0); minus = { re: r.re }; rest = rest.slice(r.end); }
    else { const n = rest.match(/^-?\d+(\.\d+)?/)?.[0] ?? fail('form', 'minus needs a /regex/ or a number'); minus = { n }; rest = rest.slice(n.length); }
  }
  const transforms = [];
  while (rest.startsWith(' → ')) {
    rest = rest.slice(3);
    const end = rest.indexOf(' → ');
    transforms.push(readTransform(end < 0 ? rest : rest.slice(0, end)));
    rest = end < 0 ? '' : rest.slice(end);
  }
  if (rest) fail('form', `cannot read "${rest.slice(0, 40)}"`);
  transforms.slice(1).forEach((t) => ['count', 'join'].includes(t.name) && fail('form', `→ ${t.name} must come first`));
  return { ref, minus, transforms };
}

function value(v, what) {
  if (typeof v !== 'string' || v.trim() === '') fail('empty', `${what} is empty`);
  if (v.includes('\n')) fail('form', `${what} spans lines: "${v.slice(0, 60)}"`);
  return v;
}
function evaluate(body) {
  const p = parse(body);
  if (p.calc !== undefined) return value(calc(p.calc), 'calc');
  let ts = p.transforms, v;
  if (p.ref.key) {
    if (['count', 'join'].includes(ts[0]?.name)) fail('form', `→ ${ts[0].name} needs a /regex/, not a facts key`);
    v = factValue(p.ref.key);
  }
  else if (ts[0]?.name === 'count') {
    if (p.minus) fail('form', '→ count with minus');
    v = String(allMatches(p.ref.src, p.ref.re).length);
    ts = ts.slice(1);
  } else {
    const m = match(p.ref.src, p.ref.re);
    if (ts[0]?.name === 'join') { v = m.slice(1).map((g) => value(g, 'a group')).join(ts[0].args[0]); ts = ts.slice(1); }
    else v = m.length > 1 ? m[1] : fail('form', 'the regex has no group 1 (use → count to count matches)');
  }
  value(v, 'group 1');
  if (p.minus) {
    const b = p.minus.re ? value(match(p.ref.src, p.minus.re)[1], 'minus group 1') : p.minus.n;
    v = (num(v, 'minus') - num(b, 'minus')).toFixed(Math.max(decimals(v), decimals(b)));
  }
  for (const t of ts) v = value(TRANSFORMS[t.name].fn(v, t.args), `→ ${t.name}`);
  return v;
}

// ── calc ─────────────────────────────────────────────────────────────────────────────────────────
/** q-rows of an eval log: { q01: '✓', … }. */
const evalRows = (src) => Object.fromEntries([...text(src).matchAll(/^\s+(q\d+)\s+\S+\s+(\S)\s+rr/gm)].map((m) => [m[1], m[2]]));
function gainedLost(which, a, b) {
  const fa = evalRows(a), fb = evalRows(b);
  if (!Object.keys(fa).length || !Object.keys(fb).length) fail('regex-miss', `${which}: no q-rows in ${a} or ${b}`);
  const [from, to] = which === 'gained' ? [fa, fb] : [fb, fa];
  return Object.keys(to).filter((q) => to[q] === '✓' && from[q] !== '✓').length;
}
const flat = (a) => a.flat(Infinity);
const CALC = {
  round: Math.round, floor: Math.floor, ceil: Math.ceil, abs: Math.abs,
  min: (...a) => Math.min(...flat(a)), max: (...a) => Math.max(...flat(a)),
  fmt: (x, d) => Number(x).toFixed(d), ordinal: (n) => ordinal(n),
};
function calc(expr) {
  let js = '';
  for (let i = 0; i < expr.length;) {
    const fk = expr.slice(i).match(/^\[facts\.json ([\w.-]+)\]/);
    if (fk) { js += `(${num(factRaw(fk[1]), `facts ${fk[1]}`)})`; i += fk[0].length; continue; }
    const ref = expr[i] === '[' && expr.slice(i).match(/^\[(\S+) \//);
    if (ref) {
      const r = readRegex(expr, i + ref[0].length - 1);
      if (expr[r.end] !== ']') fail('form', `calc: no "]" after ${r.re}`);
      const src = ref[1];
      js += r.all
        ? `[${allMatches(src, r.re).map((m) => num(m[1], `${src} ${r.re}`)).join(',')}]`
        : `(${num(match(src, r.re)[1], `${src} ${r.re}`)})`;
      i = r.end + 1;
      continue;
    }
    const g = expr.slice(i).match(/^(gained|lost)\(([\w./:-]+),\s*([\w./:-]+)\)/);
    if (g) { js += String(gainedLost(g[1], g[2], g[3])); i += g[0].length; continue; }
    js += expr[i++];
  }
  const left = js.replace(/\b(round|floor|ceil|abs|min|max|fmt|ordinal)\(/g, '(').replace(/[\d.\s+\-*/(),[\]]/g, '');
  if (left) fail('form', `calc: cannot read "${left}" in "${expr}"`);
  let v;
  try { v = new Function(...Object.keys(CALC), `return (${js});`)(...Object.values(CALC)); }
  catch (e) { if (e instanceof FillError) throw e; fail('calc', `calc "${js}": ${e.message}`); }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) fail('calc', `calc "${js}" = ${v}`);
    if (decimals(v) > 3) fail('calc', `calc "${js}" = ${v}: round it, or use fmt(x, d)`);
  }
  return String(v);
}

// ── files ────────────────────────────────────────────────────────────────────────────────────────
const EXT = /\.(mdx|js|json)$/;
function walk(dir) {
  return readdirSync(dir).sort().flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === '_notes' || n === 'node_modules' ? [] : walk(p);
    return EXT.test(n) ? [p] : [];
  });
}
/** Fills one text; failed placeholders stay as they are. */
function fillText(t, rel, results) {
  return t.replace(/⟦([^⟧]*)⟧/g, (whole, body, at) => {
    const line = t.slice(0, at).split('\n').length;
    try {
      const v = evaluate(body);
      results.push({ file: rel, line, placeholder: whole, value: v });
      return v;
    } catch (e) {
      if (!(e instanceof FillError)) throw e;
      results.push({ file: rel, line, placeholder: whole, kind: e.kind, error: e.message });
      return whole;
    }
  });
}

function main(argv) {
  const opt = { paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check' || a === '--in-place' || a === '--partial') opt[a.slice(2)] = true;
    else if (a === '--out' || a === '--report') opt[a.slice(2)] = argv[++i] ?? fail('form', `${a} needs a path`);
    else if (a.startsWith('--')) fail('form', `unknown option ${a}`);
    else opt.paths.push(a);
  }
  const modes = ['check', 'out', 'in-place'].filter((m) => opt[m]);
  if (modes.length !== 1 || !opt.paths.length || (opt.partial && !opt.out)) {
    console.error('usage: node scripts/dev/fill.mjs (--check | --out <dir> [--partial] | --in-place) [--report <file.json>] <path>…');
    process.exit(2);
  }
  if (!existsSync(WORKSHOP)) fail('missing-file', `WORKSHOP_DIR ${WORKSHOP} does not exist`);
  const jobs = []; // [source file, path shown and written under --out]
  for (const p of opt.paths) {
    if (!existsSync(p)) fail('missing-file', `no such path ${p}`);
    if (statSync(p).isDirectory()) for (const f of walk(p)) jobs.push([f, relative(p, f)]);
    else jobs.push([p, basename(p)]);
  }
  const results = [], filled = [];
  for (const [src, rel] of jobs) {
    const t = readFileSync(src, 'utf8');
    if (t.includes('⟦')) filled.push([src, rel, fillText(t, rel, results)]);
    else filled.push([src, rel, t]);
  }
  const bad = results.filter((r) => r.error);
  for (const r of bad) console.log(`✗ ${r.file}:${r.line}  ${r.placeholder.slice(0, 110)}\n    ${r.kind}: ${r.error}`);
  const kinds = Object.entries(Object.groupBy(bad, (r) => r.kind)).map(([k, v]) => `${v.length} ${k}`).join(', ');
  console.log(`fill ${bad.length ? '✗' : '✓'}  ${results.length} placeholders in ${new Set(results.map((r) => r.file)).size} files · ` +
    `${results.length - bad.length} filled · ${bad.length} left${kinds ? ` (${kinds})` : ''} · workshop ${WORKSHOP}`);
  if (opt.report) writeFileSync(opt.report, `${JSON.stringify({ workshop: WORKSHOP, results }, null, 1)}\n`);
  const write = opt.out ? (!bad.length || opt.partial) : opt['in-place'] && !bad.length;
  if (write) {
    for (const [src, rel, t] of filled) {
      const dest = opt.out ? join(opt.out, rel) : src;
      if (opt['in-place'] && t === readFileSync(src, 'utf8')) continue;
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, t);
    }
    console.log(`wrote ${filled.length} file(s) ${opt.out ? `under ${opt.out}` : 'in place'}${bad.length ? ' (partial: failed placeholders left as ⟦…⟧)' : ''}`);
  } else if (!opt.check) console.log('wrote nothing: fix every ✗ first (or --out … --partial to inspect)');
  process.exit(bad.length ? 1 : 0);
}

try { main(process.argv.slice(2)); }
catch (e) {
  if (!(e instanceof FillError)) throw e;
  console.error(`fill ✗  ${e.message}`);
  process.exit(2);
}
