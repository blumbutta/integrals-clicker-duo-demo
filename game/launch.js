// Like the iPhone scene, the title owns the first three visible foreground seconds.
// The game modules stay inert until that point, so timers, music and rewards start together.
(() => {
  'use strict';
  const card=document.getElementById('launch-screen'),station=document.getElementById('station');
  const bridge=window.DuoStartup;
  let remaining=3000,since=null,timer=0,background=bridge?.isForeground?.()===false,pageSuspended=false,starting=false;
  const listeners=[];
  function listen(target,name,fn){
    target.addEventListener(name,fn);listeners.push(()=>target.removeEventListener(name,fn));
  }
  function layout(){
    const width=card.clientWidth,height=card.clientHeight;
    if(!width||!height)return;
    const unit=Math.min(width/390,height/760,1.15*Math.max(1,parseFloat(getComputedStyle(document.documentElement).fontSize)/16));
    card.style.setProperty('--lu',unit+'px');
    const drawing=card.querySelector('.ls-engraving'),group=drawing.firstChild;
    drawing.setAttribute('viewBox','0 0 '+width+' '+height);
    group.setAttribute('transform','translate('+width*.5+' '+height*.37+')');
    group.querySelectorAll('circle').forEach((circle,i)=>{
      circle.setAttribute('r',width*(.69+i*.23));circle.style.strokeWidth=.7*unit;circle.style.opacity=i===0?.17:.1;
    });
    const lines=[];
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6+.11,x=Math.cos(a),y=Math.sin(a);
      lines.push('M',x*width*.69,y*width*.69,'L',x*height*1.5,y*height*1.5);
    }
    const rays=group.querySelector('path');rays.setAttribute('d',lines.join(' '));rays.style.strokeWidth=.6*unit;rays.style.opacity=.08;
  }
  async function loadGame(){
    const template=document.getElementById('game-modules'),waiting=[];
    for(const source of template.content.querySelectorAll('script')){
      const script=document.createElement('script'),src=source.getAttribute('src');
      if(src){
        // Ordered, locally served scripts can load in parallel in the Android host.
        script.async=false;script.src=src;
        waiting.push(new Promise((done,fail)=>{script.onload=done;script.onerror=()=>fail(new Error(src));}));
      }else script.text=source.textContent;
      document.body.append(script);
    }
    template.remove();
    await Promise.all(waiting);
    if(!window.App)throw new Error('Game startup failed');
  }
  async function enter(warm=false){
    if(starting)return;
    starting=true;clearTimeout(timer);listeners.splice(0).forEach(stop=>stop());
    try{
      await loadGame();
    }catch(error){
      console.error(error);document.documentElement.classList.remove('duo-warm');
      card.removeAttribute('role');card.removeAttribute('aria-label');
      const retry=document.createElement('button');retry.textContent='Не удалось открыть игру. Повторить';
      retry.onclick=()=>location.reload();card.replaceChildren(retry);retry.focus();return;
    }
    // WebView may have been backgrounded while its local scripts were loading.
    if(bridge?.isForeground?.()===false)window.dispatchEvent(new Event('duopause'));
    document.body.classList.remove('duo-launching');station.removeAttribute('aria-hidden');station.removeAttribute('inert');
    bridge?.finish?.();window.dispatchEvent(new Event('duolaunchcomplete'));
    if(warm||matchMedia('(prefers-reduced-motion:reduce)').matches){card.remove();return;}
    card.setAttribute('aria-hidden','true');
    // Recalculate once if the three seconds finished immediately after a restore.
    card.getBoundingClientRect();card.classList.add('ls-leaving');
    card.addEventListener('transitionend',()=>card.remove(),{once:true});setTimeout(()=>card.remove(),300);
  }
  function track(){
    if(starting)return;
    const now=performance.now();clearTimeout(timer);
    if(since!==null)remaining=Math.max(0,remaining-Math.max(0,now-since));
    since=null;
    if(document.hidden||background||pageSuspended)return;
    if(remaining<=0){enter();return;}
    since=now;timer=setTimeout(track,remaining);
  }
  if(bridge?.isComplete?.()){enter(true);return;}
  layout();listen(window,'resize',layout);
  listen(window,'duopause',()=>{background=true;track();});
  listen(window,'duoresume',()=>{background=false;track();});
  listen(window,'pagehide',()=>{pageSuspended=true;track();});
  listen(window,'pageshow',()=>{pageSuspended=false;track();});
  listen(document,'visibilitychange',track);
  track();
})();
