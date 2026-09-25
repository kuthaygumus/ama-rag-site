/**
 * The day's-question guess (<Guess> / <Guess echo>): the number typed into `[data-guess]` is kept in this
 * browser's localStorage and shown again wherever `[data-guess-echo]` sits (Kapanış). Nothing leaves the
 * browser. Without storage (private window, blocked site data) the box still works, it just forgets.
 */
export const guessScript = `
(function () {
  var KEY = 'rag-guess';

  function read() {
    try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
  }
  function write(v) {
    try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) {}
  }

  function scan() {
    var saved = read();
    document.querySelectorAll('[data-guess]').forEach(function (input) {
      input.value = saved;
      input.addEventListener('input', function () { write(input.value.trim()); });
      // Enter hands the arrow keys back to the deck (deck.js ignores keys while an input has focus).
      input.addEventListener('keydown', function (event) { if (event.key === 'Enter') input.blur(); });
    });
    document.querySelectorAll('[data-guess-echo]').forEach(function (echo) {
      if (!saved) return;
      var value = echo.querySelector('[data-guess-value]');
      if (value) value.textContent = saved;
      echo.hidden = false;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
})();
`.trim();
