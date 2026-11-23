// The game is still inert until both storage objects have been installed and verified.
(() => {
  'use strict';
  const initialized = () => {
      // This frame shares the artwork's origin so Canvas and WebGL can read it.
  // Both storage objects live only in this frame and are discarded on restart.
  function memoryStorage(entries) {
    const values = new Map(entries);
    return Object.freeze({
      get length() { return values.size; },
      key(i) { return [...values.keys()][i] ?? null; },
      getItem(key) { return values.get(String(key)) ?? null; },
      setItem(key, value) { values.set(String(key), String(value)); },
      removeItem(key) { values.delete(String(key)); },
      clear() { values.clear(); }
    });
  }
  const local = memoryStorage([['integrals.duomax.progress.v1', "{\"version\":1,\"balance\":9.001258925463847e+24,\"totalEarned\":1.2001258925463846e+25,\"clicks\":3800,\"counts\":{\"autoclick\":240,\"abacus\":160,\"calculator\":120,\"algorithm\":90,\"neuron\":70,\"quantum\":52,\"singularity\":45,\"dimension\":32,\"universe\":21,\"multiverse\":13,\"superintelligence\":9,\"automaton\":7,\"navigator\":5,\"chronologist\":4,\"oracle\":3,\"architect\":2,\"nanoforge\":1},\"upgrades\":[\"click-1\",\"click-2\",\"autoclick-1\",\"abacus-1\",\"calculator-1\",\"algorithm-1\",\"neuron-1\"],\"discoveries\":[\"autoclick\",\"abacus\",\"calculator\",\"algorithm\",\"neuron\",\"quantum\",\"singularity\",\"dimension\",\"universe\",\"multiverse\",\"superintelligence\",\"automaton\",\"navigator\",\"chronologist\",\"oracle\",\"architect\",\"nanoforge\"],\"seen\":[\"autoclick\",\"abacus\",\"calculator\",\"algorithm\",\"neuron\",\"quantum\",\"singularity\",\"dimension\",\"universe\",\"multiverse\",\"superintelligence\",\"automaton\",\"navigator\",\"chronologist\",\"oracle\",\"architect\",\"nanoforge\"],\"progress\":{\"honors\":{\"earned\":[\"clicks-1\",\"clicks-50\",\"clicks-1000\",\"earned-1000\",\"earned-1000000\",\"earned-1000000000\",\"earned-1000000000000\",\"earned-1000000000000000\",\"production-1\",\"production-100\",\"production-10000\",\"production-1000000\",\"production-1000000000\",\"helpers-1\",\"helpers-25\",\"helpers-100\",\"research-1\",\"pairs-3\",\"resource-autoclick\",\"resource-abacus\",\"resource-calculator\",\"resource-algorithm\",\"resource-neuron\",\"resource-quantum\",\"resource-singularity\",\"resource-dimension\",\"resource-universe\",\"resource-multiverse\",\"resource-superintelligence\",\"resource-automaton\",\"resource-navigator\",\"resource-chronologist\",\"resource-oracle\",\"resource-architect\",\"resource-nanoforge\"],\"claimed\":[\"clicks-1\",\"clicks-50\",\"clicks-1000\",\"earned-1000\",\"earned-1000000\",\"earned-1000000000\",\"earned-1000000000000\",\"earned-1000000000000000\",\"production-1\",\"production-100\",\"production-10000\",\"production-1000000\",\"production-1000000000\",\"helpers-1\",\"helpers-25\",\"helpers-100\",\"research-1\",\"pairs-3\",\"resource-autoclick\",\"resource-abacus\",\"resource-calculator\",\"resource-algorithm\",\"resource-neuron\",\"resource-quantum\",\"resource-singularity\",\"resource-dimension\",\"resource-universe\",\"resource-multiverse\",\"resource-superintelligence\",\"resource-automaton\",\"resource-navigator\",\"resource-chronologist\",\"resource-oracle\",\"resource-architect\",\"resource-nanoforge\"],\"converted\":{}}},\"purchases\":{\"autoclick\":240,\"abacus\":160,\"calculator\":120,\"algorithm\":90,\"neuron\":70,\"quantum\":52,\"singularity\":45,\"dimension\":32,\"universe\":21,\"multiverse\":13,\"superintelligence\":9,\"automaton\":7,\"navigator\":5,\"chronologist\":4,\"oracle\":3,\"architect\":2,\"nanoforge\":1},\"runPurchases\":{\"autoclick\":240,\"abacus\":160,\"calculator\":120,\"algorithm\":90,\"neuron\":70,\"quantum\":52,\"singularity\":45,\"dimension\":32,\"universe\":21,\"multiverse\":13,\"superintelligence\":9,\"automaton\":7,\"navigator\":5,\"chronologist\":4,\"oracle\":3,\"architect\":2,\"nanoforge\":1},\"prestigeLevel\":0,\"highestPrestige\":0,\"cosmicAscensions\":0,\"totalRemainder\":-157526267,\"lifetimeBits\":\"27b576332d49bbda715c140000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000\",\"lifetimeEarned\":1.2001258925463846e+25,\"runEarned\":1.2001258925463844e+25,\"baselineClicks\":0,\"baselineWins\":0,\"prestigeDiscovered\":true}"], ['duo.avatar','57']]);
  const session = memoryStorage([]);
  Object.defineProperties(window, {
    localStorage: {value:local, writable:false, configurable:false},
    sessionStorage: {value:session, writable:false, configurable:false}
  });
  if (window.localStorage !== local || window.sessionStorage !== session) throw Error('Demo storage is unavailable');

  window.DuoStartup = {isComplete: () => true};
  window.addEventListener('duolaunchcomplete', () => {
    App.route('resources');
    const entry = document.querySelector('[data-page-action="prestige"]');
    entry.scrollIntoView({block:'end'});
    document.fonts.ready.then(() => {
      if (App.activeRoute === 'resources' && !App.sheet && Economy.snapshot().canPrestige)
        entry.scrollIntoView({block:'end'});
    });
  }, {once:true});
  window.addEventListener('duoprestige', () => {
    if (Economy.snapshot().prestigeLevel === 1) parent.postMessage('prestige-demo-complete','*');
  });

    for (const element of document.querySelector('#demo-startup').content.querySelectorAll('script')) {
      const script = document.createElement('script');
      if (element.hasAttribute('src')) {
        script.async = false;
        script.src = element.getAttribute('src');
      } else {
        script.text = element.textContent;
      }
      document.body.append(script);
    }
  };
  try {
    initialized();
  } catch (error) {
    document.querySelector('#demo-error').hidden = false;
    console.error(error);
  }
})();
