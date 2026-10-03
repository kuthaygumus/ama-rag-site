// Runs before `astro build`. Every Turkish page has an English twin in src/content/docs/en/ built on the same
// skeleton, so a deck step, a log or a SIRA SENDE item cannot exist in one language only.
//  ✗ fails the build: a twin is missing (or an English page has no Turkish one), the skeleton differs (the
//    components in order with the attributes that are not prose: Log/RepoCode references, Now n, deck stages and
//    phases, panel ids…; per drawing the number of <text> labels and the data-from/to/stage/phase values and
//    ph classes the deck animates), a term has no English definition in terms-en.js, or an English page links to
//    a Turkish one; the commands in backticks differ (both languages run the same commands on the same data); the
//    headings differ in count or level, or in the ids other pages link to (<h3 id> on the glossary); a UI string
//    key (src/content/i18n) exists in one language only, unless content.config.ts marks it optional; the English
//    day question differs from the one the logs print (dayQuestion in the synced config.ts);
//  ! only warns, because a Turkish edit made in a hurry must still deploy: the numbers written on the page (3,3
//    and 3.3 count as the same number), the terms marked, Turkish letters left in English prose (quoted data may
//    keep them), and the numbers in a popover that differ between terms.js and terms-en.js.
// `--page <path under docs>` checks one pair; `--strict` makes warnings fail too.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { terms } from '../src/scripts/terms.js';
import { termsEn } from '../src/scripts/terms-en.js';

const DOCS = 'src/content/docs';
const EN = join(DOCS, 'en');
const args = process.argv.slice(2);
const only = args.includes('--page') ? args[args.indexOf('--page') + 1]?.replace(/^(src\/content\/docs\/)?(en\/)?/, '') : null;
const strict = args.includes('--strict');

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const trPages = walk(DOCS).filter((f) => f.endsWith('.mdx') && !f.startsWith(EN + '/')).map((f) => relative(DOCS, f));
const enPages = existsSync(EN) ? walk(EN).filter((f) => f.endsWith('.mdx')).map((f) => relative(EN, f)) : [];

// Components whose attributes are listed here keep them in the skeleton; every other attribute is prose.
const KEEP = {
  Deck: [], Step: ['phase', 'stage'], DeckFigure: ['stage'], Log: ['name', 'from', 'to'],
  RepoCode: ['file', 'from', 'to', 'lang', 'mark'], Now: ['n'], YourTurn: ['optional'], Panel: ['id'],
  PanelLink: ['to'], WhereAmI: ['at'], DaysQuestion: [], Guess: ['echo'], Gate: ['bridge'], Takeaway: [],
  Example: [], FAQ: [], Figure: [], LinkCard: ['href'], CardGrid: [], Card: ['icon'], Aside: ['type'],
  Tabs: [], TabItem: [], Steps: [], svg: ['viewBox'],
};
const TAG = new RegExp(`<(${Object.keys(KEEP).join('|')})\\b((?:\\s+[\\w:-]+(?:=(?:"[^"]*"|'[^']*'|\\{[^}]*\\}))?)*)\\s*\\/?>`, 'g');
const ATTR = /([\w:-]+)(?:=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}))?/g;
const attrs = (s) => Object.fromEntries([...s.matchAll(ATTR)].map((m) => [m[1], m[2] ?? m[3] ?? m[4] ?? true]));

function skeleton(src) {
  const imports = src.split('\n').filter((l) => l.startsWith('import ')).map((l) => l.replace(/(\.\.\/)+/g, '…/')).sort();
  const tags = [...src.matchAll(TAG)].map(([, name, a]) => {
    const at = attrs(a);
    // An English LinkCard points at the English twin of the same page.
    if (typeof at.href === 'string') at.href = at.href.replace(/^\/en\//, '/');
    return name + KEEP[name].filter((k) => k in at).map((k) => ` ${k}=${JSON.stringify(at[k])}`).join('');
  });
  const svgs = [...src.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(([s]) => ({
    texts: (s.match(/<text\b/g) || []).length,
    anim: [...s.matchAll(/\bdata-(from|to|stage|phase)="([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`).join(' '),
    ph: [...new Set(s.match(/\bph\d+\b/g) || [])].sort().join(' '),
  }));
  return { imports, tags, svgs };
}

/** The reader-visible text: prose, drawing labels and the prose attributes, without code, logs and markup. */
function prose(src) {
  const body = src.replace(/^---[\s\S]*?\n---\n/, '').replace(/^import .*$/gm, '');
  const attrText = [...body.matchAll(/(?<![\w-])(title|answer|how|q|caption|aria-label|description|label|alt|placeholder)="([^"]*)"/g)].map((m) => m[2]);
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return [text, ...attrText].join('\n');
}
// TR writes 3,3 GB and EN 3.3 GB: the separator is a format, not a fact.
const numbers = (s) => (s.match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/,/g, '.')).sort();
/** Backticked commands, the way check-now reads them; the same multiset in both languages. */
const commands = (src) => [...src.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((c) => /^(npm|npx|podman|ollama) /.test(c)).sort();
/** Heading levels in order (Markdown ## outside code fences, and HTML <hN>), and the explicit ids links point at. */
function headings(src) {
  const body = src.replace(/^---[\s\S]*?\n---\n/, '').replace(/```[\s\S]*?```/g, '');
  const levels = [...body.matchAll(/^(#{1,6}) |<h([1-6])\b/gm)].map((m) => (m[1] ? m[1].length : +m[2]));
  const ids = [...body.matchAll(/<h[1-6]\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
  return { levels: levels.join(','), ids };
}
const termIds = (src) => [...src.matchAll(/<Term\s+id="([^"]+)"/g)].map((m) => m[1]).sort();
const frontmatter = (src) => Object.fromEntries((src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '').split('\n').map((l) => l.match(/^(\w+):/)?.[1]).filter(Boolean).map((k) => [k, true]));

/** Multiset difference a − b, as "x×n" strings. */
function minus(a, b) {
  const left = new Map();
  for (const x of a) left.set(x, (left.get(x) ?? 0) + 1);
  for (const x of b) if (left.has(x)) left.set(x, left.get(x) - 1);
  return [...left].filter(([, n]) => n > 0).map(([x, n]) => (n > 1 ? `${x}×${n}` : x));
}

let fails = 0, warns = 0, pairs = 0;
const fail = (page, msg) => { fails++; console.log(`✗ ${page}  ${msg}`); };
const warn = (page, msg) => { warns++; console.log(`! ${page}  ${msg}`); };

for (const id of Object.keys(terms)) if (!only && !(id in termsEn)) fail('terms-en.js', `no English definition for "${id}"`);
for (const id of Object.keys(termsEn)) if (!only && !(id in terms)) fail('terms-en.js', `"${id}" is not a term in terms.js`);
for (const page of enPages) if (!trPages.includes(page) && (!only || page === only)) fail(`en/${page}`, 'has no Turkish page');

// UI strings: every key a component reads is declared in content.config.ts; a required key is in both languages.
if (!only) {
  const declared = new Map([...readFileSync('src/content.config.ts', 'utf8').matchAll(/'(rag\.[\w.]+)':\s*z\.string\(\)(\.optional\(\))?/g)].map((m) => [m[1], !!m[2]]));
  const dict = Object.fromEntries(['tr', 'en'].map((l) => [l, JSON.parse(readFileSync(`src/content/i18n/${l}.json`, 'utf8'))]));
  for (const l of ['tr', 'en']) for (const k of Object.keys(dict[l])) if (k.startsWith('rag.') && !declared.has(k)) fail(`i18n/${l}.json`, `"${k}" is not declared in content.config.ts`);
  for (const [k, optional] of declared) for (const l of ['tr', 'en']) if (!optional && !(k in dict[l])) fail(`i18n/${l}.json`, `"${k}" is missing (required in content.config.ts)`);
  // The English day question is the one the logs print (D2): en.json must equal dayQuestion in the synced config.ts.
  const logsQ = readFileSync('src/snippets/code/src/lib/config.ts', 'utf8').match(/dayQuestion:\s*"([^"]+)"/)?.[1];
  if (!logsQ) fail('src/snippets/code/src/lib/config.ts', 'no dayQuestion (run npm run sync)');
  else if (dict.en['rag.dayq.question'] !== logsQ) fail('i18n/en.json', `"rag.dayq.question" differs from dayQuestion in config.ts: "${logsQ}"`);
  const code = walk('src').filter((f) => /\.(astro|ts|js|mjs)$/.test(f) && !f.startsWith('src/snippets/'));
  for (const f of code) for (const [, k] of readFileSync(f, 'utf8').matchAll(/\bt\(\s*['"](rag\.[\w.]+)['"]/g)) {
    if (!declared.has(k)) fail(f, `t('${k}') is not declared in content.config.ts`);
    else if (!(k in dict.tr) && !(k in dict.en)) fail(f, `t('${k}') has no string in tr.json or en.json`);
  }
  // A popover number is data (cosine 0.456): the English body must carry the same numbers.
  for (const [id, { body }] of Object.entries(terms)) {
    if (!termsEn[id]) continue;
    const a = numbers(body), b = numbers(termsEn[id].body);
    if (minus(a, b).length || minus(b, a).length) warn(`terms-en.js ${id}`, `numbers differ: only TR [${minus(a, b)}] only EN [${minus(b, a)}]`);
  }
}

for (const page of trPages) {
  if (only && page !== only) continue;
  const enFile = join(EN, page);
  if (!existsSync(enFile)) { fail(page, 'has no English twin in en/'); continue; }
  pairs++;
  const tr = readFileSync(join(DOCS, page), 'utf8');
  const en = readFileSync(enFile, 'utf8');
  const a = skeleton(tr), b = skeleton(en);

  if (a.imports.join('\n') !== b.imports.join('\n')) fail(page, `imports differ: TR [${minus(a.imports, b.imports)}] EN [${minus(b.imports, a.imports)}]`);
  const n = Math.max(a.tags.length, b.tags.length);
  for (let i = 0; i < n; i++) {
    if (a.tags[i] !== b.tags[i]) { fail(page, `component #${i + 1}: TR ${a.tags[i] ?? '(none)'} · EN ${b.tags[i] ?? '(none)'}`); break; }
  }
  if (a.svgs.length !== b.svgs.length) fail(page, `${a.svgs.length} drawings in TR, ${b.svgs.length} in EN`);
  else a.svgs.forEach((s, i) => {
    const t = b.svgs[i];
    if (s.texts !== t.texts) fail(page, `drawing #${i + 1}: ${s.texts} <text> labels in TR, ${t.texts} in EN (split a line with <tspan>, never a new <text>)`);
    if (s.anim !== t.anim) fail(page, `drawing #${i + 1}: deck animation attributes differ`);
    if (s.ph !== t.ph) fail(page, `drawing #${i + 1}: phase classes differ: TR [${s.ph}] EN [${t.ph}]`);
  });
  for (const id of termIds(en)) if (!(id in termsEn)) fail(page, `<Term id="${id}"> has no English definition`);
  // A site link on an English page must stay in English: /en/… (Starlight serves the Turkish page at the bare path).
  for (const [, href] of en.matchAll(/(?:\]\(|href=")(\/[^)"\s]*)/g)) {
    if (!href.startsWith('/en/') && !/^\/(_astro|favicon)/.test(href)) fail(page, `link ${href} leads to the Turkish page; use /en${href}`);
  }
  for (const k of Object.keys(frontmatter(tr))) if (!(k in frontmatter(en))) fail(page, `frontmatter "${k}" missing in EN`);
  const ca = commands(tr), cb = commands(en);
  if (minus(ca, cb).length || minus(cb, ca).length) fail(page, `commands in backticks differ: only TR [${minus(ca, cb).join(' | ')}] only EN [${minus(cb, ca).join(' | ')}]`);
  const ha = headings(tr), hb = headings(en);
  // The glossary is sorted by each language's own alphabet: the same headings and ids, in any order.
  // Every other page keeps its headings in the same order in both languages.
  const order = (list) => (page === 'sozluk.mdx' ? [...list].sort() : list).join(' ');
  if (order(ha.levels.split(',')) !== order(hb.levels.split(','))) fail(page, `headings differ in count or level: TR [${ha.levels}] EN [${hb.levels}]`);
  if (order(ha.ids) !== order(hb.ids)) fail(page, `heading ids differ (links point at them): only TR [${minus(ha.ids, hb.ids)}] only EN [${minus(hb.ids, ha.ids)}]`);

  const na = numbers(prose(tr)), nb = numbers(prose(en));
  const lost = minus(na, nb), added = minus(nb, na);
  if (lost.length || added.length) warn(page, `numbers differ: only TR [${lost.join(', ')}] only EN [${added.join(', ')}]`);
  const ta = termIds(tr), tb = termIds(en);
  const tl = minus([...new Set(ta)], [...new Set(tb)]), tadd = minus([...new Set(tb)], [...new Set(ta)]);
  if (tl.length || tadd.length) warn(page, `terms marked differ: only TR [${tl.join(', ')}] only EN [${tadd.join(', ')}]`);
  // A label a generator wrote (data-gen) quotes the data, which may be Turkish (the it-security pair).
  const generated = /<text\b[^>]*\bdata-gen="[^"]*"[^>]*>[^<]*<\/text>/g;
  const turkish = prose(en.replace(generated, ' ')).split('\n').filter((l) => /[çğıöşüÇĞİÖŞÜ]/.test(l));
  if (turkish.length) warn(page, `${turkish.length} English prose line(s) with Turkish letters (fine only for quoted data): ${turkish.slice(0, 2).map((l) => JSON.stringify(l.trim().slice(0, 70))).join(' ')}`);
}

const total = fails + (strict ? warns : 0);
console.log(
  total
    ? `check:i18n ✗ ${fails} problem(s), ${warns} warning(s) in ${pairs} page pair(s)`
    : `check:i18n ✓ ${pairs} page pairs share their skeleton${warns ? ` (${warns} warning(s) above)` : ''}`,
);
process.exit(total ? 1 : 0);
