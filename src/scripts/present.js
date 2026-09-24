/**
 * Present mode for the room's one shared screen: `F` hides the sidebar, header and page furniture and
 * makes the content column fill the screen (the key is handled in deck.js, next to the arrow keys).
 * This script only restores the mode after a page change, so a walk through the pages stays
 * without falling out of it.
 */
export const presentScript = `
(function () {
  try {
    if (sessionStorage.getItem('present') === '1') document.documentElement.setAttribute('data-present', '');
    new MutationObserver(function () {
      try { sessionStorage.setItem('present', document.documentElement.hasAttribute('data-present') ? '1' : '0'); } catch (e) {}
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-present'] });
  } catch (e) {}
})();
`.trim();
