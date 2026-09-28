/**
 * Side panels: a longer explanation of one phrase, opened over the page. Pages mark the phrase with
 * <PanelLink to="id"> and hold the content in <Panel id="id">. The panel is a native <dialog>, so Esc
 * closes it and focus stays inside while it is open; a click on the dimmed page closes it too. While a
 * panel is open, deck.js gives the arrow keys to the deck inside it.
 */
export const panelScript = `
(function () {
  document.addEventListener('click', function (event) {
    var t = event.target;
    if (!t || !t.closest) return;
    var opener = t.closest('[data-panel-open]');
    if (opener) {
      var dialog = document.getElementById(opener.getAttribute('data-panel-open'));
      if (dialog && !dialog.open) dialog.showModal();
      return;
    }
    var closer = t.closest('[data-panel-close]');
    if (closer) { closer.closest('dialog').close(); return; }
    // The panel's content fills the dialog, so a click that lands on the dialog itself hit the backdrop.
    if (t.tagName === 'DIALOG' && t.classList.contains('panel')) t.close();
  });
})();
`.trim();
