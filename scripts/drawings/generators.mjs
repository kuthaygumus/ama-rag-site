// The drawings whose geometry carries data (plan/site.md §2, the G rows), one function per <svg data-draw="…">.
// Each one reads the logs, finds its elements by data-gen role and returns edits; it never holds a typed layout:
// rows, boxes, gaps and scales are read from the drawing itself, so the same code serves TR and EN pages.
// A value that the drawing cannot show without a person (a rank of 1, a context that fits, a label that changed
// shape) is an error with the reason, never a guess.
import {
  DrawError, ariaOf, fail, fillSlots, grab, isShortening, log, r1, readSource, shortenPair, shortenPrefix, textWidth, visible,
} from './lib.mjs';

const many = (els, role, n) => {
  const out = els.filter((e) => e.role === role);
  if (n !== undefined && out.length !== n) fail(`${n} elements with data-gen="${role}" expected, found ${out.length}`);
  return out;
};
const one = (els, role) => many(els, role, 1)[0];
const num = (v) => +v;
/** MDX text: braces and angle brackets would be read as code, so such a label becomes a JSX string. */
const mdx = (s) => (/[{}<>]/.test(s) ? `{'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'}` : s);
const slots = (el, values) => fillSlots(el.text, values, `data-gen="${el.role}"`);

// ── shared log readers ─────────────────────────────────────────────────────────────────────────────
const promptTokens = () => num(grab(log('08-answer'), /OUT\s+(\d+) prompt tokens/, '08-answer'));
const stuffTokens = () => num(grab(log('stuff-everything'), /prompt tokens\s+(\d+)/, 'stuff-everything'));
const time = (name) => num(grab(log(name), /TIME\s+(\d+) ms/, name));
const answerChunk = () => grab(log('08-answer'), /\n\s+\[1\] (\S+)/, '08-answer [1]');
const promptTop = () => num(grab(log('07-rerank'), /into the prompt: top (\d+)/, '07-rerank'));

// ── ragsiz-ragli svg2: two token bars ──────────────────────────────────────────────────────────────
function tokenBars({ els }) {
  const rag = promptTokens(), all = stuffTokens();
  if (rag >= all) fail(`RAG prompt (${rag}) is not shorter than the whole handbook (${all})`);
  const allBar = one(els, 'all-bar'), bar = one(els, 'rag-bar'), label = one(els, 'rag-label');
  const gap = num(label.attrs.x) - (num(bar.attrs.x) + num(bar.attrs.width));
  const w = Math.round((num(allBar.attrs.width) * rag) / all);
  return {
    edits: [
      { el: bar, set: { width: w } },
      { el: label, set: { x: num(bar.attrs.x) + w + gap }, text: slots(label, [rag]) },
      { el: one(els, 'all-label'), text: slots(one(els, 'all-label'), [all]) },
    ],
  };
}

// ── c-embedding svg3: five similarity bars ─────────────────────────────────────────────────────────
function similarPairs() {
  const re = /^\s+(\d\.\d+) [█░]+\s+(.+)\n\s+(.+)\n\s+(.+)$/gm;
  return [...log('04b-similar').matchAll(re)].map((m) => ({ score: m[1], name: m[2].trim(), a: m[3].trim(), b: m[4].trim() }));
}
function similarBars({ els, svg }) {
  const pairs = similarPairs();
  const bars = many(els, 'bar', pairs.length), scores = many(els, 'score', pairs.length), labels = many(els, 'pair', pairs.length);
  // The axis path runs from score 0 to score 1: its first and last x are the scale.
  const xs = [...one(els, 'axis').attrs.d.matchAll(/M([\d.]+)/g)].map((m) => num(m[1]));
  const x0 = xs[0], scale = xs.at(-1) - x0;
  const edits = [], notes = [];
  pairs.forEach((p, i) => {
    const w = num(p.score) * scale;
    edits.push({ el: bars[i], set: { width: r1(w) } });
    edits.push({ el: scores[i], set: { x: Math.floor(x0 + w + 11) }, text: slots(scores[i], [p.score]) });
    // The pair label fills the column left of the bars.
    const max = num(bars[i].attrs.x) - num(labels[i].attrs.x) - 5;
    const cur = visible(labels[i].text), sides = cur.split(' ↔ ');
    const keep = sides.length === 2 && isShortening(sides[0], p.a) && isShortening(sides[1], p.b) && textWidth(cur, labels[i].attrs) <= max;
    const text = keep ? labels[i].text : mdx(shortenPair(p.a, p.b, labels[i].attrs, max));
    edits.push({ el: labels[i], text });
    notes.push(`${i + 1}: ${p.name} ${p.score}`);
  });
  return { edits, aria: fillSlots(ariaOf(svg), pairs.map((p) => p.score), 'aria-label'), notes };
}

// ── c-embedding svg4: the 2-D map of all chunks ────────────────────────────────────────────────────
const NUMS = (s) => [...s.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => num(m[0]));
/** One marker element: its shape, class, size and centre. */
function marker(tag, a) {
  if (tag === 'circle') return { tag, cls: a.class, r: a.r, cx: num(a.cx), cy: num(a.cy), id: a['data-id'] };
  if (tag === 'rect') return { tag, cls: a.class, half: num(a.width) / 2, cx: num(a.x) + num(a.width) / 2, cy: num(a.y) + num(a.height) / 2, id: a['data-id'] };
  const n = NUMS(a.d), xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
  return { tag, cls: a.class, half: (Math.max(...xs) - Math.min(...xs)) / 2, cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2, id: a['data-id'] };
}
const markersIn = (inner) => [...inner.matchAll(/<(circle|rect|path)\b([^>]*?)\/>/g)].map((m) => marker(m[1], Object.fromEntries([...m[2].matchAll(/([\w:-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]))));
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
function drawMarker(shape, cx, cy, id) {
  const x = Math.round(cx * 10) / 10, y = Math.round(cy * 10) / 10;
  if (shape.tag === 'circle') return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${shape.r}" class="${shape.cls}" data-id="${id}" />`;
  const h = shape.half;
  if (shape.tag === 'rect') return `<rect x="${f1(x - h)}" y="${f1(y - h)}" width="${2 * h}" height="${2 * h}" class="${shape.cls}" data-id="${id}" />`;
  return `<path d="M${f1(x)} ${f1(y - h)} L${f1(x + h)} ${f1(y)} L${f1(x)} ${f1(y + h)} L${f1(x - h)} ${f1(y)}Z" class="${shape.cls}" data-id="${id}" />`;
}
function chunkMap({ els, svg, lang }) {
  const map = JSON.parse(readSource('log:map.json'));
  const pct = (i) => {
    const v = grab(log('04b-map'), i === 1 ? /PC1 keeps ([\d.]+)%/ : /PC2 ([\d.]+)% of the spread/, '04b-map');
    return lang === 'tr' ? v.replace('.', ',') : v;
  };
  const group = one(els, 'points');
  const cur = markersIn(group.text);
  if (cur.some((m) => !m.id)) fail('a marker in data-gen="points" has no data-id');
  const curAt = Object.fromEntries(cur.map((m) => [m.id, m]));
  // The plot box is where today's points are: the new points are scaled into it, one scale per axis.
  const box = { x0: Math.min(...cur.map((m) => m.cx)), x1: Math.max(...cur.map((m) => m.cx)), y0: Math.min(...cur.map((m) => m.cy)), y1: Math.max(...cur.map((m) => m.cy)) };
  const mapX = map.points.map((p) => p.x), mapY = map.points.map((p) => p.y);
  const [mx0, mx1, my0, my1] = [Math.min(...mapX), Math.max(...mapX), Math.min(...mapY), Math.max(...mapY)];
  const at = (x, y) => [box.x0 + ((x - mx0) / (mx1 - mx0)) * (box.x1 - box.x0), box.y1 - ((y - my0) / (my1 - my0)) * (box.y1 - box.y0)];
  // Marker shape per document, from the legend: one circle/rect/diamond and the document name after it.
  const legend = one(els, 'legend');
  const shapes = {}, legendItems = [...legend.text.matchAll(/<(circle|rect|path)\b([^>]*?)\/>\s*<text\b[^>]*>([^<]+)<\/text>/g)];
  for (const m of legendItems) shapes[m[3].trim()] = marker(m[1], Object.fromEntries([...m[2].matchAll(/([\w:-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]])));
  const answer = answerChunk(), answerDoc = answer.split('@')[0];
  // Map order, with the answer's document drawn last so its points sit on top.
  const pts = [...map.points.filter((p) => p.docId !== answerDoc), ...map.points.filter((p) => p.docId === answerDoc)];
  const newAt = {};
  const indent = group.text.match(/\n([ \t]*)</)?.[1] ?? '        ';
  const close = group.text.match(/\n([ \t]*)$/)?.[1] ?? '';
  const lines = pts.map((p) => {
    const shape = shapes[p.docId] ?? fail(`no legend entry for document ${p.docId}`);
    const [x, y] = at(p.x, p.y);
    newAt[p.id] = { cx: Math.round(x * 10) / 10, cy: Math.round(y * 10) / 10, doc: p.docId };
    return `${indent}${drawMarker(shape, x, y, p.id)}`;
  });
  const edits = [{ el: group, text: `\n${lines.join('\n')}\n${close}` }];
  // The question star moves with the question; its shape stays.
  const star = one(els, 'star');
  const sp = NUMS(star.attrs.points);
  const scx = sp.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b) / (sp.length / 2);
  const scy = sp.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b) / (sp.length / 2);
  const [qx, qy] = at(map.question.x, map.question.y);
  const moved = [];
  for (let i = 0; i < sp.length; i += 2) moved.push(`${f1(sp[i] - scx + qx)},${f1(sp[i + 1] - scy + qy)}`);
  edits.push({ el: star, set: { points: moved.join(' ') } });
  const line = one(els, 'star-line');
  const aAt = newAt[answer] ?? fail(`answer chunk ${answer} is not on the map`);
  edits.push({ el: line, set: { d: `M${Math.round(qx)} ${Math.round(qy)} L${Math.round(aAt.cx)} ${Math.round(aAt.cy)}`, 'data-id': answer } });
  const oldAnswer = line.attrs['data-id'];
  // Labels tied to one chunk keep their offset from it; "answer" means the chunk the answer cites.
  const placed = [];
  for (const el of many(els, 'anchor')) {
    const id = el.attrs['data-id'];
    const was = curAt[id === 'answer' ? oldAnswer : id] ?? fail(`label anchor ${id} is not on today's map`);
    const now = newAt[id === 'answer' ? answer : id] ?? fail(`label anchor ${id} is not on the new map`);
    const x = Math.round(now.cx + (num(el.attrs.x) - was.cx)), y = Math.round(now.cy + (num(el.attrs.y) - was.cy));
    edits.push({ el, set: { x, y } });
    placed.push({ el, x, y });
  }
  // A label tied to one document keeps its offset from the corner of that document's points.
  const corner = (pts2) => [Math.min(...pts2.map((m) => m.cx)), Math.min(...pts2.map((m) => m.cy))];
  for (const el of many(els, 'doc-label')) {
    const doc = el.attrs['data-doc'];
    const [ox, oy] = corner(cur.filter((m) => m.id.startsWith(`${doc}@`)));
    const [nx, ny] = corner(Object.values(newAt).filter((m) => m.doc === doc));
    const x = Math.round(nx + num(el.attrs.x) - ox), y = Math.round(ny + num(el.attrs.y) - oy);
    edits.push({ el, set: { x, y } });
    placed.push({ el, x, y });
  }
  edits.push({ el: one(els, 'axis-x'), text: slots(one(els, 'axis-x'), [null, null, pct(1)]) });
  edits.push({ el: one(els, 'axis-y'), text: slots(one(els, 'axis-y'), [null, null, pct(2)]) });
  // The legend's box: its translate, and the furthest child below it.
  const [lx, ly] = NUMS(legend.attrs.transform);
  const legendBox = { x: lx - 10, y0: ly - 20, y1: ly + Math.max(...NUMS(legend.text.replace(/class="[^"]*"/g, '')).filter((v) => v >= 0)) + 10 };
  return { edits, aria: fillSlots(ariaOf(svg), [pts.length], 'aria-label'), notes: mapCollisions(placed, newAt, legendBox) };
}
/** A placed label that sits on a point or runs into the legend is reported for a person to move. */
function mapCollisions(placed, at, legend) {
  const notes = [];
  for (const { el, x, y } of placed) {
    const w = textWidth(el.text, el.attrs), h = 19;
    const hit = Object.entries(at).find(([, p]) => p.cx > x - 9 && p.cx < x + w + 9 && p.cy > y - h - 9 && p.cy < y + 4 + 9);
    if (hit) notes.push(`label "${visible(el.text)}" at ${x},${y} overlaps point ${hit[0]}: move it by hand`);
    if (x + w > legend.x && y > legend.y0 && y - h < legend.y1) notes.push(`label "${visible(el.text)}" at ${x},${y} runs into the legend`);
  }
  return notes;
}

// ── e-retrieval-rerank svg1: vector order, rerank order and the arrows between them ─────────────────
function retrieveRows() {
  return [...log('06-retrieve').matchAll(/^\s+(\d+)\s+(0\.\d+)\s+(\S+@\S+)/gm)].map((m) => ({ rank: num(m[1]), score: m[2], id: m[3] }));
}
function rerankRows() {
  return [...log('07-rerank').matchAll(/^\s+(\d+)\s+[▲▼]?\s*was (\d+)\s+rel\s+(\d+)\s+vec \S+\s+(\S+@\S+)/gm)]
    .map((m) => ({ rank: num(m[1]), was: num(m[2]), rel: m[3], id: m[4] }));
}
/** "id=gloss|id=gloss" on the drawing: the page's own short name for a chunk (narration, per language). */
const glosses = (svg) => Object.fromEntries((svg.match(/^<svg\b[^>]*?\sdata-gloss="([^"]*)"/)?.[1] ?? '').split('|').filter(Boolean).map((p) => p.split('=')));
function rerankArrows({ els, svg }) {
  const vec = retrieveRows(), rr = rerankRows(), top = promptTop(), answer = answerChunk();
  const vScore = many(els, 'v-score', vec.length), vId = many(els, 'v-id', vec.length);
  const rRel = many(els, 'r-rel', rr.length), rId = many(els, 'r-id', rr.length), arrows = many(els, 'arrow', rr.length);
  const gloss = glosses(svg), notes = [], edits = [];
  const name = (el, id) => {
    if (gloss[id]) return `${id} · ${gloss[id]}`;
    if (/ · /.test(visible(el.text))) notes.push(`no gloss for ${id} in data-gloss: shown bare`);
    return id;
  };
  vec.forEach((r, i) => {
    edits.push({ el: vScore[i], text: slots(vScore[i], [r.score]) });
    edits.push({ el: vId[i], text: name(vId[i], r.id) });
  });
  rr.forEach((r, i) => {
    edits.push({ el: rRel[i], text: slots(rRel[i], [r.rel]) });
    edits.push({ el: rId[i], text: name(rId[i], r.id) });
  });
  // The green row box follows the chunk the answer cites, in both columns.
  const rowY = (el) => num(el.attrs.y);
  for (const [role, rows, labels] of [['v-good', vec, vScore], ['r-good', rr, rRel]]) {
    const box = one(els, role), i = rows.findIndex((r) => r.id === answer);
    if (i < 0) fail(`${role}: the cited chunk ${answer} is not in the column`);
    // Today's row is the one whose label sits inside the box; the label-to-box offset is kept.
    const y0 = num(box.attrs.y), on = labels.find((l) => rowY(l) >= y0 && rowY(l) <= y0 + num(box.attrs.height));
    if (!on) fail(`${role}: no row label inside the box`);
    edits.push({ el: box, set: { y: rowY(labels[i]) - (rowY(on) - y0) } });
  }
  // One arrow per vector rank: red when the chunk falls out of the prompt, green when it gets in.
  const lift = rowY(vScore[0]) - NUMS(arrows[0].attrs.d)[1];
  const [xa, xb] = [NUMS(arrows[0].attrs.d)[0], NUMS(arrows[0].attrs.d)[2]];
  rr.slice().sort((a, b) => a.was - b.was).forEach((r, i) => {
    const out = r.was <= top && r.rank > top, inn = r.was > top && r.rank <= top;
    const cls = out ? 'fbox-bad' : inn ? 'farrow-on' : 'farrow';
    edits.push({ el: arrows[i], set: { d: `M${xa} ${rowY(vScore[r.was - 1]) - lift} L${xb} ${rowY(rRel[r.rank - 1]) - lift}`, class: cls } });
  });
  const gap = one(els, 'gap');
  edits.push({ el: gap, text: slots(gap, [null, (num(vec[0].score) - num(vec[rr.length - 1].score)).toFixed(3)]) });
  const timing = one(els, 'timing');
  const search = grab(log('06-retrieve'), /search (\d+) ms/, '06-retrieve'), scored = grab(log('07-rerank'), /scored in (\d+) ms/, '07-rerank');
  edits.push({ el: timing, text: slots(timing, [search, rr.length, scored]) });
  return { edits, notes };
}

// ── kaliteyi-olcmek svg1: one gold question's five rows, its metrics, two chunkers ──────────────────
const outLine = (name) => {
  const m = log(name).match(/OUT\s+hit@1 ([\d.]+) · recall@5 ([\d.]+) · MRR ([\d.]+)\s+\((\d+) retrieval questions\)/);
  if (!m) fail(`${name}: no OUT hit@1 line`);
  return { hit: m[1], recall: m[2], mrr: m[3], n: num(m[4]) };
};
function evalQuestion({ els, svg }) {
  const qid = svg.match(/^<svg\b[^>]*?\sdata-qid="([^"]+)"/)?.[1] ?? fail('no data-qid on the drawing');
  const gold = readSource('code:eval/gold.jsonl').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((g) => g.id === qid) ?? fail(`${qid} not in eval/gold.jsonl`);
  const right = gold.gold_sections[0];
  const m = log('eval-section').match(new RegExp(`^\\s+${qid}\\s+\\S+\\s+\\S\\s+rr ([\\d.]+)\\s+(.+)$`, 'm')) ?? fail(`eval-section: no ${qid} row`);
  const rr = m[1], shown = m[2].trim().split(/\s+/), rank = Math.round(1 / num(rr));
  // D7: a rank of 1 or a miss tells a different story; the page needs new narration, not new numbers.
  if (num(rr) === 0 || rank === 1 || rank > 5) fail(`${qid} rank is ${num(rr) === 0 ? 'outside the top 5' : rank}: re-narrate the page (D7)`);
  const boxes = many(els, 'row-box', 5), ids = many(els, 'row-id', 5), ranks = many(els, 'row-rank', 5);
  const edits = [];
  boxes.forEach((box, k) => {
    const here = k + 1 === rank, id = k < shown.length ? shown[k] : here ? right : null;
    const top = num(box.attrs.y);
    edits.push({ el: box, set: { class: here ? 'fbox fbox-good' : 'fbox' } });
    edits.push({ el: ranks[k], text: String(k + 1) });
    edits.push(id
      ? { el: ids[k], set: { y: top + 29, class: here ? 'flbl fgood-t' : 'flbl' }, text: here ? `${id} ✓` : id }
      : { el: ids[k], set: { y: top + 28, class: 'fsub' }, text: '…' });
  });
  const rrEl = one(els, 'rr'), note = one(els, 'rank-note'), hit = one(els, 'hit1'), recall = one(els, 'recall');
  edits.push({ el: rrEl, text: slots(rrEl, [null, rank, rr]) });
  edits.push({ el: note, text: slots(note, [rank]) });
  edits.push({ el: hit, text: slots(hit, [null, 0]) });
  edits.push({ el: recall, text: slots(recall, [null, 1, 1, '1.0']) });
  for (const [role, name] of [['metrics-section', 'eval-section'], ['metrics-fixed', 'eval-fixed']]) {
    const el = one(els, role), o = outLine(name);
    edits.push({ el, text: slots(el, [null, o.hit, Math.round(num(o.hit) * o.n), o.n, null, o.recall, o.mrr]) });
  }
  // The weak types of the section chunker, weakest first, with the page's own names for them.
  const weak = one(els, 'weak');
  const names = Object.fromEntries((weak.attrs['data-names'] ?? '').split('|').filter(Boolean).map((p) => p.split('=')));
  const types = [...log('eval-section').matchAll(/^\s+([a-z-]+)\s+n=\d+\s+hit@1 ([\d.]+)/gm)].map((t) => ({ type: t[1], hit: t[2] }))
    .filter((t) => num(t.hit) < 1).sort((a, b) => num(a.hit) - num(b.hit));
  const head = visible(weak.text).split(': ')[0];
  edits.push({ el: weak, text: `${head}: ${types.map((t) => `${names[t.type] ?? fail(`no name for type ${t.type} in data-names`)} ${t.hit}`).join(' · ')}` });
  return { edits, notes: [`${qid}: right section ${right} at rank ${rank} (rr ${rr})`] };
}

// ── performans-maliyet svg1: token bars, the num_ctx line, where one question's time goes ────────────
function timeBars({ els }) {
  const rag = promptTokens(), all = stuffTokens(), top = promptTop();
  const numCtx = num(grab(readSource('code:src/lib/config.ts'), /numCtx:\s*(\d+)/, 'config.ts numCtx'));
  // §5 E5: if the whole handbook fits the context, the num_ctx line tells nothing; that needs new narration.
  if (all <= numCtx) fail(`the whole handbook (${all} tokens) fits num_ctx ${numCtx}: re-narrate (plan/site.md §5 E5)`);
  const allBar = one(els, 'all-bar'), bar = one(els, 'rag-bar'), label = one(els, 'rag-label');
  const x0 = num(allBar.attrs.x), W = num(allBar.attrs.width);
  const gap = num(label.attrs.x) - (num(bar.attrs.x) + num(bar.attrs.width));
  const w = Math.round((W * rag) / all);
  const edits = [
    { el: bar, set: { width: w } },
    { el: label, set: { x: num(bar.attrs.x) + w + gap }, text: slots(label, [top, rag, null]) },
    { el: one(els, 'all-label'), text: slots(one(els, 'all-label'), [null, all, null]) },
  ];
  const dash = one(els, 'numctx'), dashLabel = one(els, 'numctx-label');
  const dx = Math.round(x0 + (W * numCtx) / all);
  edits.push({ el: dash, set: { d: dash.attrs.d.replace(/^M[\d.]+/, `M${dx}`) } });
  edits.push({ el: dashLabel, set: { x: dx }, text: slots(dashLabel, [numCtx]) });
  // The stacked bar: search, rerank, answer, in the width the three parts have today.
  const segs = ['seg-search', 'seg-rerank', 'seg-answer'].map((r) => one(els, r));
  const ms = [time('06-retrieve'), time('07-rerank'), time('08-answer')], T = ms[0] + ms[1] + ms[2];
  const SW = segs.reduce((s, e) => s + num(e.attrs.width), 0);
  const ws = [Math.round((SW * ms[0]) / T), Math.round((SW * ms[1]) / T)];
  ws.push(SW - ws[0] - ws[1]);
  let x = num(segs[0].attrs.x);
  const xs = ws.map((v) => { const s = x; x += v; return s; });
  segs.forEach((el, i) => edits.push({ el, set: { x: xs[i], width: ws[i] } }));
  const calls = num(grab(log('07-rerank'), /OUT\s+(\d+) chunks scored/, '07-rerank'));
  const barTop = num(segs[1].attrs.y), barH = num(segs[1].attrs.height);
  for (const [i, role, values] of [[1, 'seg-rerank-label', [calls, ms[1]]], [2, 'seg-answer-label', [ms[2]]]]) {
    const el = one(els, role), text = slots(el, values);
    // A label wider than its part of the bar goes above the bar, right-aligned to the part's end.
    const fits = textWidth(text, el.attrs) <= ws[i] - 16;
    const set = fits
      ? { x: Math.round(xs[i] + ws[i] / 2), y: barTop + barH / 2 + 8, 'text-anchor': 'middle' }
      : { x: xs[i] + ws[i], y: barTop - 10, 'text-anchor': 'end' };
    edits.push({ el, set, text });
  }
  const tick = one(els, 'search-tick');
  edits.push({ el: tick, set: { d: tick.attrs.d.replace(/^M[\d.]+/, `M${Math.round(xs[0] + ws[0] / 2)}`) } });
  const sl = one(els, 'search-label');
  const search = grab(log('06-retrieve'), /search (\d+) ms/, '06-retrieve'), embed = grab(log('06-retrieve'), /bge-m3, (\d+) ms/, '06-retrieve');
  edits.push({ el: sl, text: slots(sl, [ms[0], search, embed]) });
  return { edits };
}

// ── f-cevap svg1: the prompt as the model gets it (rule lines and the question, "…" when too long) ──
function promptLines() {
  const box = log('08-answer').split('\n').filter((l) => /^\s+│/.test(l)).map((l) => l.replace(/^\s+│ ?/, ''));
  const s = box.indexOf('SYSTEM:');
  if (s < 0) fail('08-answer: no SYSTEM: line in the prompt box');
  const end = box.indexOf('', s);
  const system = box.slice(s + 1, end), question = box.at(-2);
  return { system, question };
}
function answerPrompt({ els }) {
  const { system, question } = promptLines();
  const rules = many(els, 'system', system.length);
  const q = one(els, 'question'), box = one(els, 'prompt-box');
  const edits = [];
  // A line may run to 2 px short of the prompt box's right edge. A fitting hand shortening stays.
  for (const [el, src] of [...rules.map((el, i) => [el, system[i]]), [q, question]]) {
    const max = num(box.attrs.x) + num(box.attrs.width) - num(el.attrs.x) - 2;
    const cur = visible(el.text);
    const keep = isShortening(cur, src) && textWidth(cur, el.attrs) <= max && !/⟦/.test(cur);
    edits.push({ el, text: keep ? el.text : mdx(shortenPrefix(src, el.attrs, max)) });
  }
  return { edits };
}

export const GENERATORS = {
  'token-bars': tokenBars,
  'similar-bars': similarBars,
  'chunk-map': chunkMap,
  'rerank-arrows': rerankArrows,
  'eval-question': evalQuestion,
  'time-bars': timeBars,
  'answer-prompt': answerPrompt,
};
export { DrawError };
