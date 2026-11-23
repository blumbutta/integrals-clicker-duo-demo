(() => {
  const station = document.getElementById('station');
  const tablet = matchMedia('(orientation: portrait) and (min-width: 540px) and (min-aspect-ratio: 1/2)');
  const landscape = matchMedia('(orientation: landscape)');

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
