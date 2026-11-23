// The original game only sees the storage of this particular practice run.
(async () => {
  'use strict';
  const makeToken = () => Array.from(crypto.getRandomValues(new Uint32Array(3)), n => n.toString(16).padStart(8,'0')).join('');
  const locationToken = new URLSearchParams(location.search).get('run');
  const run = /^[a-f0-9]{24}$/.test(locationToken || '') ? locationToken : makeToken();
  let area;
  try { area=window.sessionStorage; } catch (_) {}
  function practiceStorage(kind) {
    const name='duo.training.v1.'+run+'.'+kind;
    let values = new Map();
    try { values = new Map(JSON.parse(area?.getItem(name) || '[]')); } catch (_) {}
    function persist() { try { area?.setItem(name,JSON.stringify([...values])); } catch (_) {} }
    return Object.freeze({
      get length(){ return values.size; },
      key(i){ return [...values.keys()][i] ?? null; },
      getItem(k){ return values.get(String(k)) ?? null; },
      setItem(k,v){ values.set(String(k),String(v));persist(); },
      removeItem(k){ values.delete(String(k));persist(); },
      clear(){ values.clear();persist(); }
    });
  }
  const local=practiceStorage('local'), session=practiceStorage('session');
  try {
    Object.defineProperties(window,{
      localStorage:{value:local,configurable:false},
      sessionStorage:{value:session,configurable:false}
    });
    if (window.localStorage!==local || window.sessionStorage!==session) throw Error('storage isolation');
    window.DuoTraining = {};
    for(const source of document.getElementById('training-startup').content.querySelectorAll('script')) {
      const node=document.createElement('script');
      if(source.src) {
        const loaded=new Promise((resolve,reject)=>{node.onload=resolve;node.onerror=reject;});
        node.async=false;node.src=source.src;
        document.head.append(node);
        await loaded;
      } else {
        node.textContent=source.textContent;
        document.head.append(node);
      }
    }
  } catch (error) {
    console.error('Training startup failed',error);
    document.getElementById('training-error').hidden=false;
  }
})();
