(() => {
  const values = new Map([['integrals.duomax.progress.v1', "{\"version\":1,\"balance\":9.001258925463847e+24,\"totalEarned\":1.2001258925463846e+25,\"clicks\":3800,\"counts\":{\"autoclick\":240,\"abacus\":160,\"calculator\":120,\"algorithm\":90,\"neuron\":70,\"quantum\":52,\"singularity\":45,\"dimension\":32,\"universe\":21,\"multiverse\":13,\"superintelligence\":9,\"automaton\":7,\"navigator\":5,\"chronologist\":4,\"oracle\":3,\"architect\":2,\"nanoforge\":1},\"upgrades\":[\"click-1\",\"click-2\",\"autoclick-1\",\"abacus-1\",\"calculator-1\",\"algorithm-1\",\"neuron-1\"],\"discoveries\":[\"autoclick\",\"abacus\",\"calculator\",\"algorithm\",\"neuron\",\"quantum\",\"singularity\",\"dimension\",\"universe\",\"multiverse\",\"superintelligence\",\"automaton\",\"navigator\",\"chronologist\",\"oracle\",\"architect\",\"nanoforge\"],\"seen\":[\"autoclick\",\"abacus\",\"calculator\",\"algorithm\",\"neuron\",\"quantum\",\"singularity\",\"dimension\",\"universe\",\"multiverse\",\"superintelligence\",\"automaton\",\"navigator\",\"chronologist\",\"oracle\",\"architect\",\"nanoforge\"],\"progress\":{\"honors\":{\"earned\":[\"clicks-1\",\"clicks-50\",\"clicks-1000\",\"earned-1000\",\"earned-1000000\",\"earned-1000000000\",\"earned-1000000000000\",\"earned-1000000000000000\",\"production-1\",\"production-100\",\"production-10000\",\"production-1000000\",\"production-1000000000\",\"helpers-1\",\"helpers-25\",\"helpers-100\",\"research-1\",\"pairs-3\",\"resource-autoclick\",\"resource-abacus\",\"resource-calculator\",\"resource-algorithm\",\"resource-neuron\",\"resource-quantum\",\"resource-singularity\",\"resource-dimension\",\"resource-universe\",\"resource-multiverse\",\"resource-superintelligence\",\"resource-automaton\",\"resource-navigator\",\"resource-chronologist\",\"resource-oracle\",\"resource-architect\",\"resource-nanoforge\"],\"claimed\":[\"clicks-1\",\"clicks-50\",\"clicks-1000\",\"earned-1000\",\"earned-1000000\",\"earned-1000000000\",\"earned-1000000000000\",\"earned-1000000000000000\",\"production-1\",\"production-100\",\"production-10000\",\"production-1000000\",\"production-1000000000\",\"helpers-1\",\"helpers-25\",\"helpers-100\",\"research-1\",\"pairs-3\",\"resource-autoclick\",\"resource-abacus\",\"resource-calculator\",\"resource-algorithm\",\"resource-neuron\",\"resource-quantum\",\"resource-singularity\",\"resource-dimension\",\"resource-universe\",\"resource-multiverse\",\"resource-superintelligence\",\"resource-automaton\",\"resource-navigator\",\"resource-chronologist\",\"resource-oracle\",\"resource-architect\",\"resource-nanoforge\"],\"converted\":{}}},\"purchases\":{\"autoclick\":240,\"abacus\":160,\"calculator\":120,\"algorithm\":90,\"neuron\":70,\"quantum\":52,\"singularity\":45,\"dimension\":32,\"universe\":21,\"multiverse\":13,\"superintelligence\":9,\"automaton\":7,\"navigator\":5,\"chronologist\":4,\"oracle\":3,\"architect\":2,\"nanoforge\":1},\"runPurchases\":{\"autoclick\":240,\"abacus\":160,\"calculator\":120,\"algorithm\":90,\"neuron\":70,\"quantum\":52,\"singularity\":45,\"dimension\":32,\"universe\":21,\"multiverse\":13,\"superintelligence\":9,\"automaton\":7,\"navigator\":5,\"chronologist\":4,\"oracle\":3,\"architect\":2,\"nanoforge\":1},\"prestigeLevel\":0,\"highestPrestige\":0,\"cosmicAscensions\":0,\"totalRemainder\":-157526267,\"lifetimeBits\":\"27b576332d49bbda715c140000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000\",\"lifetimeEarned\":1.2001258925463846e+25,\"runEarned\":1.2001258925463844e+25,\"baselineClicks\":0,\"baselineWins\":0,\"prestigeDiscovered\":true}"], ['duo.avatar','57']]);
  const storage = {
    get length() { return values.size; },
    key(i) { return [...values.keys()][i] ?? null; },
    getItem(key) { return values.get(String(key)) ?? null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); }
  };
  Object.defineProperty(window, 'localStorage', {value: storage});
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
})();

// A sandboxed test has an opaque origin. Ask its own viewer for audio and the font license.
(() => {
  if (parent === window) return;
  const original = window.fetch.bind(window);
  window.fetch = (resource, options) => {
    const path = typeof resource === 'string' ? resource : '';
    if (!/^art\/(audio\/[a-zA-Z0-9-]+\.wav|fonts\/LICENSE\.txt)$/.test(path)) return original(resource,options);
    return new Promise((resolve,reject) => {
      const {port1,port2} = new MessageChannel();
      const timeout = setTimeout(() => {port1.close();reject(new Error('Asset timed out'));},15000);
      port1.onmessage = ({data}) => {
        clearTimeout(timeout);
        port1.close();
        if (!data.bytes) {reject(new Error('Missing asset'));return;}
        resolve(new Response(data.bytes,{headers:{'Content-Type':data.type}}));
      };
      parent.postMessage({kind:'duo-demo-asset',path},'*',[port2]);
    });
  };
})();
