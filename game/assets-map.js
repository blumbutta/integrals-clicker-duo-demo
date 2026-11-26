// The standalone preview uses the same keys with embedded images.
window.duoArt = path => path;

(() => {
  const original = window.duoArt;
  window.duoArt = path => {
    const url = original(path);
    if (url === path && path === 'art/fonts/LICENSE.txt' && '5e2e94eb3bc8')
      return url + '?v=5e2e94eb3bc8';
    return url === path && (path.startsWith('art/appearance/') || path.startsWith('art/launcher/'))
      ? url + '?v=fff90b6de047' : url;
  };
})();
