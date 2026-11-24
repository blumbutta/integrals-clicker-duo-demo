(() => {
  // The original Android 11 WebView predates Element.replaceChildren.
  if (!Element.prototype.replaceChildren) {
    Object.defineProperty(Element.prototype, 'replaceChildren', {
      configurable: true, writable: true,
      value: function (...children) {
        const next = this.ownerDocument.createDocumentFragment();
        next.append(...children);
        this.textContent = '';
        this.appendChild(next);
      }
    });
  }
  const station = document.getElementById('station');
  const tablet = matchMedia('(orientation: portrait) and (min-width: 540px) and (min-aspect-ratio: 1/2)');
  const landscape = matchMedia('(orientation: landscape)');

  // A long press is a game gesture. Android may also request Select All
  // directly through its context menu or a hardware keyboard.
  document.addEventListener('selectstart', event => event.preventDefault());
  document.addEventListener('contextmenu', event => event.preventDefault());
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') event.preventDefault();
  });
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) selection.removeAllRanges();
  });

  function layout() {
    for (const element of [document.documentElement, station]) {
      element.toggleAttribute('data-tablet', tablet.matches);
      element.toggleAttribute('data-landscape', landscape.matches);
    }
  }
  layout();
  tablet.addEventListener('change', layout);
  landscape.addEventListener('change', layout);
})();
// The map handles its own pinch. Keep browser gestures from scaling the entire game.
if (!window.DuoLauncher) {
  for (const event of ['gesturestart', 'gesturechange']) {
    document.addEventListener(event, e => e.preventDefault(), {passive:false});
  }
  window.addEventListener('wheel', e => {
    if (e.ctrlKey) e.preventDefault();
  }, {passive:false});
}
