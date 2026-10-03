// Shared helpers for the drawings that are drawn from the logs (plan/site.md §2): where the sources are, how a
// marked SVG is read and rewritten, and how wide a Kalam label is.
//
// Markers, all invisible in the browser:
//   <svg data-draw="<generator>">   this drawing is (partly) drawn by scripts/drawings/generators.mjs
//   data-gen="<role>"               this element's data geometry or data label is the generator's; nobody types it
//   data-q="<source>"               a hand-written label quotes this source (log:, corpus:, code:, const)
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// Before S4 the pre-freeze checks point WORKSHOP_DIR at a copy of the Turkish tag (PLAN §4); after S4 the synced
// copy under src/snippets is the source, so the check also runs on Vercel.
const WS = process.env.WORKSHOP_DIR ? resolve(SITE, process.env.WORKSHOP_DIR) : null;
export const LOGS = WS ? join(WS, 'logs') : join(SITE, 'src/snippets/logs');
export const CODE = WS ?? join(SITE, 'src/snippets/code');

export class DrawError extends Error {}
export const fail = (msg) => { throw new DrawError(msg); };

/** A source named in a data-q attribute or used by a generator, as a path. */
export function sourcePath(q) {
  const [kind, ...rest] = q.split(':');
  const p = rest.join(':');
  if (kind === 'log') return join(LOGS, /\.\w+$/.test(p) ? p : `${p}.txt`);
  if (kind === 'corpus') return join(CODE, 'corpus', p.replace(/^corpus\//, ''));
  if (kind === 'code') return join(CODE, p);
  return null;
}
const cache = new Map();
export function readSource(q) {
  const p = sourcePath(q);
  if (!p) return null;
  if (!cache.has(p)) {
    if (!existsSync(p)) fail(`source ${q} not found (${p})`);
    cache.set(p, readFileSync(p, 'utf8'));
  }
  return cache.get(p);
}
export const log = (name) => readSource(`log:${name}`);
/** Group 1 of the first match of re in text; a miss is an error, never an empty value. */
export function grab(text, re, what) {
  const m = text.match(re);
  if (!m) fail(`${what}: no match for ${re}`);
  return m[1];
}

// ── numbers ────────────────────────────────────────────────────────────────────────────────────────
/** 315.6 stays 315.6, 564.0 becomes 564: one decimal at most, the way the drawings were hand-made. */
export const r1 = (v) => String(Math.round(v * 10) / 10);
export const rInt = (v) => String(Math.round(v));
// A number slot in a label: a placeholder of the English drafts, or a number (decimal point or comma).
const SLOT = /⟦[^⟧]*⟧|\d+(?:[.,]\d+)?/g;
/**
 * Writes values into the number slots of a label, left to right. `null` keeps a slot (a step number, "k = 5").
 * The slot count must match: a label whose numbers changed shape needs a person, not a guess.
 */
export function fillSlots(label, values, what) {
  const slots = label.match(SLOT) || [];
  if (slots.length !== values.length) fail(`${what}: ${slots.length} number slots in "${label}", generator has ${values.length}`);
  let i = 0;
  return label.replace(SLOT, (s) => {
    const v = values[i++];
    return v === null || v === undefined ? s : String(v);
  });
}

// ── SVG source ─────────────────────────────────────────────────────────────────────────────────────
/** Every inline drawing of a page: { start, end, src, draw } where draw is its data-draw value. */
export function drawings(page) {
  return [...page.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((m, i) => ({
    index: i + 1,
    start: m.index,
    end: m.index + m[0].length,
    src: m[0],
    draw: m[0].match(/^<svg\b[^>]*\bdata-draw="([^"]+)"/)?.[1] ?? null,
  }));
}
const ATTR = /([\w:-]+)="([^"]*)"/g;
export const attrsOf = (s) => Object.fromEntries([...s.matchAll(ATTR)].map((m) => [m[1], m[2]]));
/** Elements of a drawing that carry data-gen, in source order: { tag, role, attrs, text, start, end, raw }. */
export function genElements(svg) {
  const out = [];
  const re = /<(text|rect|path|circle|polygon|line|g)\b([^>]*?)(\/?)>/g;
  for (const m of svg.matchAll(re)) {
    const attrs = attrsOf(m[2]);
    if (!('data-gen' in attrs)) continue;
    let end = m.index + m[0].length, text = null;
    if (!m[3] && (m[1] === 'text' || m[1] === 'g')) {
      const close = svg.indexOf(`</${m[1]}>`, end);
      text = svg.slice(end, close);
      end = close + m[1].length + 3;
    }
    out.push({ tag: m[1], role: attrs['data-gen'], attrs, text, start: m.index, end, head: m[0] });
  }
  return out;
}
/** Every <text> of a drawing, generator-owned or not, in source order (for collision checks and data-q). */
export function allTexts(svg) {
  return [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map((m) => ({ attrs: attrsOf(m[1]), text: m[2], start: m.index }));
}

/** Rewrites a drawing: edits = [{ el, set: {attr: value}, text }] on genElements() results; aria = new aria-label. */
export function applyEdits(svg, edits, aria) {
  const sorted = [...edits].sort((a, b) => b.el.start - a.el.start);
  let out = svg;
  for (const { el, set = {}, text } of sorted) {
    let head = el.head;
    for (const [k, v] of Object.entries(set)) {
      const re = new RegExp(`(\\s${k}=")[^"]*(")`);
      head = re.test(head) ? head.replace(re, `$1${v}$2`) : head.replace(/(\s*\/?>)$/, ` ${k}="${v}"$1`);
    }
    let body = out.slice(el.start + el.head.length, el.end);
    if (text !== undefined && text !== null) body = `${text}</${el.tag}>`;
    out = out.slice(0, el.start) + head + body + out.slice(el.end);
  }
  if (aria !== undefined) out = out.replace(/^(<svg\b[^>]*?\saria-label=")[^"]*(")/, `$1${aria}$2`);
  return out;
}
export const ariaOf = (svg) => svg.match(/^<svg\b[^>]*?\saria-label="([^"]*)"/)?.[1] ?? '';

// ── label width (Kalam, the real advances, written by scripts/dev/kalam-advances; the en-translation-wip fit tool reads the same) ───────────────
const KALAM = JSON.parse(readFileSync(join(SITE, 'scripts/drawings/kalam-advances.json'), 'utf8'));
/**
 * The visible string of a label: no tags (a positioned <tspan> starts a new line, so it reads as a space), JSX
 * string braces and the five XML entities resolved.
 */
export function visible(text) {
  return text
    .replace(/<tspan\b[^>]*\s(?:x|dy)="[^>]*>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/\{'([^']*)'\}/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .trim();
}
export function fontOf(attrs) {
  const cls = new Set((attrs.class ?? '').split(/\s+/));
  let size = 16.8, weight = 400, mono = false;
  if (cls.has('flbl')) { size = cls.has('tight') ? 22 : 24; weight = 700; }
  if (cls.has('fsub')) size = 19;
  if (cls.has('fmono')) { size = 15; mono = true; }
  if (cls.has('fnum')) weight = 700;
  return { size, weight, mono };
}
export function textWidth(s, attrs) {
  const { size, weight, mono } = fontOf(attrs);
  const str = visible(s);
  if (mono) return str.length * 0.6 * size;
  const adv = KALAM[weight >= 600 ? '700' : '400'];
  return [...str].reduce((w, c) => w + (adv[c] ?? 0.55), 0) * size;
}

// ── the "…" shortening rule (one rule, never typed per label) ────────────────────────────────────────
const norm = (w) => w.toLocaleLowerCase('tr').replace(/^[«"“(\[]+|[»"”)\].,;:!?]+$/g, '');
const words = (s) => s.split(/\s+/).filter(Boolean);
/**
 * Is `label` a fair shortening of `source`? Its words (without "…") appear in the source in the same order
 * (case and edge punctuation ignored; a word may be cut short). A hand shortening that passes and fits is kept, so today's drawings stay
 * as they were made; anything else is rebuilt by the rule below.
 */
export function isShortening(label, source) {
  const want = words(visible(label)).filter((w) => w !== '…').map(norm).filter(Boolean);
  const have = words(source).map(norm);
  let j = 0;
  // A label word may also cut a source word short ("kartı" for "kartına"): Turkish shortens inside the word.
  const match = (h, w) => h === w || (w.length >= 3 && h.startsWith(w));
  for (const w of want) {
    while (j < have.length && !match(have[j], w)) j++;
    if (j++ >= have.length) return false;
  }
  return want.length > 0;
}
const stripEnd = (s) => s.trim().replace(/[.?!]+$/, '');
/** The longest word prefix of `source` that, with " …", fits `max` px; the whole source when it fits. */
export function shortenPrefix(source, attrs, max) {
  if (textWidth(source, attrs) <= max) return source;
  const ws = words(source);
  for (let k = ws.length - 1; k >= 1; k--) {
    const s = `${stripEnd(ws.slice(0, k).join(' '))} …`;
    if (textWidth(s, attrs) <= max) return s;
  }
  fail(`"${source}" does not fit ${max} px even as one word`);
}
/**
 * Two sentences shown as "a ↔ b" in `max` px. Words both sides open with say nothing about the difference, so
 * they become "…" first ("… may work remotely ↔ … may not work remotely"); then the wider side loses words from
 * its end until the pair fits.
 */
export function shortenPair(a, b, attrs, max) {
  const join = (x, y) => `${x} ↔ ${y}`;
  if (textWidth(join(a, b), attrs) <= max) return join(a, b);
  const A = words(stripEnd(a)), B = words(stripEnd(b));
  let pre = 0;
  while (pre < A.length - 1 && pre < B.length - 1 && norm(A[pre]) === norm(B[pre])) pre++;
  const side = (ws, keep) => `${pre ? '… ' : ''}${ws.slice(pre, pre + keep).join(' ')}${pre + keep < ws.length ? ' …' : ''}`;
  let ka = A.length - pre, kb = B.length - pre;
  for (;;) {
    const s = join(side(A, ka), side(B, kb));
    if (textWidth(s, attrs) <= max) return s;
    if (ka <= 1 && kb <= 1) fail(`pair "${a}" ↔ "${b}" does not fit ${max} px even as one word a side`);
    if ((textWidth(side(A, ka), attrs) >= textWidth(side(B, kb), attrs) && ka > 1) || kb <= 1) ka--; else kb--;
  }
}
