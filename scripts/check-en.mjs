// Runs after `astro build`, on the English pages (dist/en/**) and the English popovers (terms-en.js). The English
// text is read aloud by a non-native speaker to a room, on one shared screen, so it must be plain and audience-facing.
// Logs, code, drawings and quoted data (“…”, "…") are removed first: they are data, not narration.
//  ✗ fails: a Starlight fallback page (a Turkish page served under /en/ because its twin is missing), a ⟦…⟧
//    placeholder left unfilled, a stage direction, a formal connector, a rare word, an idiom, an abbreviation read
//    as letters, Turkish letters outside quoted data; RARE and IDIOM also on drawing labels; with --fail-length, a
//    sentence over the length limit of its block;
//  ! warns: filler words, heavy contractions, perfect tenses, em-dash asides, and (without --fail-length) long
//    sentences: deck steps, ▶ Now strips, popovers and captions > 15 words (fail > 20), a deck step > 50 words,
//    paragraphs and list items > 20 (fail > 25), a Takeaway with more than 2 sentences or one > 15 words.
// `--page <path under docs>` checks one page (and skips the popovers). Red until every page has its twin (S11).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { termsEn } from '../src/scripts/terms-en.js';
import { FAIL_LISTS, WARN_LISTS, RARE, IDIOM, allMatches, decode, proseText, sentences, words } from './style-lists.mjs';

const args = process.argv.slice(2);
const only = args.includes('--page')
  ? (args[args.indexOf('--page') + 1] ?? '').replace(/^(src\/content\/docs\/)?(en\/)?/, '').replace(/\.mdx$/, '').replace(/\/?index(\.html)?$/, '').replace(/\/$/, '')
  : null;
const failLength = args.includes('--fail-length');
const DIST = 'dist/en';
const TURKISH = /[çğıöşüÇĞİÖŞÜ]\S*/;

let fails = 0, warns = 0, pages = 0;
const fail = (where, msg) => { fails++; console.log(`✗ ${where}  ${msg}`); };
const warn = (where, msg) => { warns++; console.log(`! ${where}  ${msg}`); };
const around = (t, i, n) => '…' + t.slice(Math.max(0, i - 30), i + n + 30).trim() + '…';

/** Word lists on one prose string: FAIL_LISTS and Turkish letters fail, WARN_LISTS warn. */
function scan(where, text) {
  for (const [name, re] of Object.entries(FAIL_LISTS)) for (const m of allMatches(re, text)) fail(where, `${name} "${m[0]}"  ${around(text, m.index, m[0].length)}`);
  for (const [name, re] of Object.entries(WARN_LISTS)) for (const m of allMatches(re, text)) warn(where, `${name} "${m[0]}"  ${around(text, m.index, m[0].length)}`);
  const tr = text.match(TURKISH);
  if (tr) fail(where, `Turkish letters outside quoted data "${tr[0]}"  ${around(text, tr.index, tr[0].length)} (quote the Turkish document's words)`);
}

/** Length limits of one block: `soft` warns, `hard` warns (fails with --fail-length). */
function length(where, kind, text, soft, hard) {
  for (const s of sentences(text)) {
    const n = words(s);
    if (n > hard) (failLength ? fail : warn)(where, `${kind} sentence of ${n} words (limit ${hard}): ${s.slice(0, 80)}…`);
    else if (n > soft) warn(where, `${kind} sentence of ${n} words (aim ${soft}): ${s.slice(0, 80)}…`);
  }
}

/** Prose for the length rule: a code span or a quote counts as one word. */
const lenText = (html) => proseText(html.replace(/<code\b[\s\S]*?<\/code>/g, ' CODE '));
const blocks = (html, re) => [...html.matchAll(re)].map((m) => m[1] ?? m[0]);

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const files = existsSync(DIST) ? walk(DIST).filter((f) => f.endsWith('.html') && !f.endsWith('404.html')).sort() : [];
let sidebarDone = false;
for (const f of files) {
  const page = relative(DIST, f).replace(/\/?index\.html$/, '') || '(home)';
  if (only !== null && page !== (only || '(home)')) continue;
  pages++;
  const html = readFileSync(f, 'utf8');
  if (/<main\b[^>]*\blang="tr"/.test(html) || /not available in your language/.test(html)) { fail(page, 'fallback page: Turkish text served under /en/ (the English twin is missing)'); continue; }
  // The sidebar is the same on every page: check its labels once.
  const nav = html.match(/<nav class="sidebar[\s\S]*?<\/nav>/)?.[0];
  if (nav && !sidebarDone) { sidebarDone = true; scan('(sidebar)', proseText(nav.replace(/<(starlight-lang-select|starlight-theme-select|select)\b[\s\S]*?<\/\1>/g, ' '))); }
  const main = html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';
  if (main.includes('⟦')) fail(page, `unfilled placeholder ${main.match(/⟦[^⟧]*⟧?/)[0].slice(0, 60)} (run scripts/dev/fill.mjs)`);
  scan(page, proseText(main));
  // Drawing labels: a smaller pass, rare words and idioms only.
  for (const svg of blocks(main, /<svg\b[\s\S]*?<\/svg>/g)) {
    const label = decode(blocks(svg, /<text\b[^>]*>([\s\S]*?)<\/text>/g).join(' ').replace(/<[^>]+>/g, ' '));
    for (const re of [RARE, IDIOM]) for (const m of allMatches(re, label)) fail(page, `drawing label "${m[0]}"  ${around(label, m.index, m[0].length)}`);
  }
  // Lengths, by block. Deck steps and ▶ Now strips are read aloud live: the tightest limits.
  const deck = blocks(main, /<ol class="deck-list">([\s\S]*?)<\/ol>\s*<\/div>/g).join('');
  for (const now of blocks(deck, /<div class="deck-now"[^>]*>([\s\S]*?)<\/div>/g)) length(page, 'Now strip', lenText(now), 15, 20);
  for (const step of deck.split(/<h3\b/).slice(1)) {
    const body = step.replace(/^[\s\S]*?<\/h3>/, '').replace(/<div class="deck-now"[\s\S]*?<\/div>/g, ' ');
    const t = lenText(body);
    length(page, 'deck step', t, 15, 20);
    if (words(t) > 50) warn(page, `deck step of ${words(t)} words (aim 50): ${t.trim().slice(0, 60)}…`);
  }
  for (const cap of blocks(main, /<figcaption(?![^>]*class="[^"]*header)[^>]*>([\s\S]*?)<\/figcaption>/g)) length(page, 'caption', lenText(cap), 15, 20);
  for (const tk of blocks(main, /<div class="takeaway">([\s\S]*?)<\/div>/g)) {
    const ss = sentences(lenText(tk));
    if (ss.length > 2 || ss.some((s) => words(s) > 15)) warn(page, `Takeaway: ${ss.length} sentence(s), longest ${Math.max(...ss.map(words))} words (aim 2 and 15)`);
  }
  const rest = main.replace(/<ol class="deck-list">[\s\S]*?<\/ol>/g, ' ');
  for (const p of blocks(rest, /<(?:p|li)\b[^>]*>([\s\S]*?)<\/(?:p|li)>/g)) length(page, 'prose', lenText(p), 20, 25);
}
if (only !== null && !pages) fail(only, `no built page at ${DIST}/${only}/index.html (run astro build first)`);

// Popovers: not in dist as text, so their bodies are checked here.
if (only === null) for (const [id, { title, body }] of Object.entries(termsEn)) {
  const t = proseText(`${title} ${body}`.replace(/`[^`]*`/g, ' CODE '));
  if (t.includes('⟦')) fail(`terms-en.js ${id}`, 'unfilled placeholder');
  scan(`terms-en.js ${id}`, t);
  length(`terms-en.js ${id}`, 'popover', t, 15, 20);
}

console.log(fails
  ? `check:en ✗ ${fails} problem(s), ${warns} warning(s) in ${pages} English page(s)`
  : `check:en ✓ ${pages} English page(s) plain and audience-facing${warns ? ` (${warns} warning(s) above)` : ''}`);
process.exit(fails ? 1 : 0);
