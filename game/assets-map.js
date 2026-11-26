// The standalone preview uses the same keys with embedded images.
window.duoArt = path => path;

(() => {
  const original = window.duoArt;
  const guideVersions = {"art/guide/city-school.webp": "b10515fa7a51", "art/guide/daily-wheel.webp": "98fdacc9b8d3", "art/guide/golden-flight-landscape.webp": "60f61268df24", "art/guide/golden-flight-portrait.webp": "59f709bef06a", "art/guide/golden-still-landscape.webp": "e4448bc26335", "art/guide/golden-still-portrait.webp": "af660fea8359", "art/guide/upgrade-confirm.webp": "850392fa194a", "art/guide/upgrade-ready.webp": "5b516865c7e2", "art/guide/upgrade-studied.webp": "e8d449c7d924"};
  window.duoArt = path => {
    const url = original(path);
    if (url === path && guideVersions[path]) return url + '?v=' + guideVersions[path];
    if (url === path && path === 'art/fonts/LICENSE.txt' && '5e2e94eb3bc8')
      return url + '?v=5e2e94eb3bc8';
    return url === path && (path.startsWith('art/appearance/') || path.startsWith('art/launcher/'))
      ? url + '?v=fff90b6de047' : url;
  };
})();
