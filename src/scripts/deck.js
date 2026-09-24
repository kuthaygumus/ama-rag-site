/**
 * Step deck: one idea per screen, inside a Starlight page. Markup (written by <Deck>/<Step>):
 *
 *   <div class="deck" data-deck>
 *     <div class="deck-stage">
 *       <div class="deck-figure" data-stage="main">…inline svg…</div>
 *     </div>
 *     <ol class="deck-list">
 *       <li data-stage="main" data-phase="2"> <h3>…</h3> <p>…</p> </li>
 *     </ol>
 *   </div>
 *
 * Two ways a step changes the figure, usable together:
 *  - `data-phase="n"` on the step lights the parts drawn with class `ph phN` and dims the other `ph` parts;
 *  - SVG groups with `data-from="3"` (and optionally `data-to="5"`) appear from step 3 on (and leave after
 *    step 5) — one drawing that builds up step by step, parts staying once they have arrived.
 *
 * Progressive enhancement: without JavaScript (and for print and the search index) every step and every
 * figure part is visible, stacked, in order. Arrow keys drive the deck closest to the middle of the screen.
 */
export const deckScript = `
(function () {
  var decks = [];

  function init(deck) {
    var list = deck.querySelector('.deck-list');
    if (!list) return;
    var steps = Array.prototype.slice.call(list.children);
    var figures = Array.prototype.slice.call(deck.querySelectorAll('.deck-figure'));
    var parts = Array.prototype.slice.call(deck.querySelectorAll('.deck-figure [data-from]'));
    if (steps.length < 2) return;
    var cur = 0;

    var head = document.createElement('div');
    head.className = 'deck-head';
    var count = document.createElement('span');
    count.className = 'deck-count';
    var bar = document.createElement('div');
    bar.className = 'deck-bar';
    var fill = document.createElement('i');
    bar.appendChild(fill);
    head.appendChild(count);
    head.appendChild(bar);

    var foot = document.createElement('div');
    foot.className = 'deck-foot';
    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'deck-btn';
    prev.textContent = '← Geri';
    var dots = document.createElement('div');
    dots.className = 'deck-dots';
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'deck-btn deck-btn-primary';
    next.textContent = 'İleri →';
    foot.appendChild(prev);
    foot.appendChild(dots);
    foot.appendChild(next);

    steps.forEach(function (step, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'deck-dot';
      dot.setAttribute('aria-label', (i + 1) + '. adım');
      dot.addEventListener('click', function () { go(i); });
      dots.appendChild(dot);
      step.setAttribute('role', 'group');
    });
    list.setAttribute('aria-live', 'polite');
    deck.insertBefore(head, deck.firstChild);
    deck.appendChild(foot);

    function render() {
      var step = steps[cur];
      var stage = step.getAttribute('data-stage');
      var phase = step.getAttribute('data-phase');
      steps.forEach(function (s, i) { s.classList.toggle('on', i === cur); });
      figures.forEach(function (f) {
        var on = !stage || f.getAttribute('data-stage') === stage;
        f.classList.toggle('on', on);
        if (on && phase) f.setAttribute('data-phase', phase);
        else f.removeAttribute('data-phase');
      });
      var n = cur + 1;
      parts.forEach(function (p) {
        var from = Number(p.getAttribute('data-from'));
        var to = p.hasAttribute('data-to') ? Number(p.getAttribute('data-to')) : Infinity;
        var shown = n >= from && n <= to;
        p.classList.toggle('shown', shown);
        p.classList.toggle('fresh', shown && n === from);
      });
      Array.prototype.forEach.call(dots.children, function (d, i) {
        d.classList.toggle('on', i === cur);
        d.classList.toggle('done', i < cur);
      });
      count.textContent = 'ADIM ' + n + ' / ' + steps.length;
      fill.style.width = (n / steps.length * 100) + '%';
      prev.disabled = cur === 0;
      next.disabled = cur === steps.length - 1;
    }

    function go(i, focus) {
      cur = Math.max(0, Math.min(i, steps.length - 1));
      render();
      if (focus) {
        var box = deck.getBoundingClientRect();
        if (box.top < 0 || box.bottom > window.innerHeight) deck.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    prev.addEventListener('click', function () { go(cur - 1, true); });
    next.addEventListener('click', function () { go(cur + 1, true); });
    deck.setAttribute('data-ready', 'true');
    decks.push({ el: deck, step: function (d) { go(cur + d, true); } });
    render();
  }

  // The deck whose middle is closest to the middle of the screen gets the arrow keys.
  function focused() {
    var mid = window.innerHeight / 2, best = null, dist = Infinity;
    decks.forEach(function (d) {
      var r = d.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var x = Math.abs((r.top + r.bottom) / 2 - mid);
      if (x < dist) { dist = x; best = d; }
    });
    return best;
  }

  document.addEventListener('keydown', function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    var el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    if (event.key === 'f' || event.key === 'F') {
      var root = document.documentElement;
      if (root.hasAttribute('data-present')) root.removeAttribute('data-present');
      else root.setAttribute('data-present', '');
      return;
    }
    var d = focused();
    if (!d) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); d.step(1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); d.step(-1); }
  });

  function scan() {
    document.querySelectorAll('[data-deck]').forEach(function (deck) {
      if (!deck.getAttribute('data-ready')) init(deck);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
})();
`.trim();
