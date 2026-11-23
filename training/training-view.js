/* The browser tutorial registers its coach here. The normal game never mounts it. */
window.TrainingView = (() => {
  'use strict';
  let spec, root, panel, ring, shade, shadePath, title, copy, mode, progress, skip, primary;
  let focusedAnchor, resizeWatch, treeWatch, frame, scrolledAnchor;
  const capturedPointers = new Map();
  const listen = (type, handler, options=true) => window.addEventListener(type, handler, options);
  const element = (tag, cls, parent) => {
    const node = document.createElement(tag);
    node.className = cls;
    if (parent) parent.append(node);
    return node;
  };
  const text = (node, value) => {
    const next = value || '';
    if (node.textContent !== next) node.textContent = next;
  };
  function resolve(value) {
    if (typeof value === 'function') value = value();
    if (typeof value === 'string') return document.querySelector(value);
    return value instanceof Element && value.isConnected ? value : null;
  }
  function currentTarget() { return spec ? resolve(spec.target) : null; }
  function allowedNodes() {
    if (spec.target) {
      const anchor=currentTarget();
      return anchor && !spec.lockTarget ? [anchor] : [];
    }
    const extra = Array.isArray(spec.allowed) ? spec.allowed : [spec.allowed];
    return extra.map(resolve).filter(Boolean);
  }
  function contains(outer, inner) { return !!inner && !!outer && (outer === inner || outer.contains(inner)); }
  function permitted(target) {
    return !spec || spec.lock === false || contains(panel, target) ||
      allowedNodes().some(node => contains(node, target));
  }
  function guard(event) {
    if (!spec || spec.lock === false) return;
    // Drag surfaces can capture the pointer on press (the map does this). Only
    // finish a gesture that actually began on the current highlighted target.
    if (event.type === 'pointerup' || event.type === 'pointercancel') {
      const original=capturedPointers.get(event.pointerId);
      capturedPointers.delete(event.pointerId);
      if (original && original === currentTarget()) return;
    }
    if (permitted(event.target)) {
      if (event.type === 'pointerdown' && contains(currentTarget(),event.target)) {
        capturedPointers.set(event.pointerId,currentTarget());
      }
      return;
    }
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }
  function focusables() {
    const focusSelector = 'button:not(:disabled),a[href],input:not(:disabled),[tabindex]:not([tabindex="-1"]),select:not(:disabled)';
    const targets = allowedNodes().flatMap(node => node.matches(focusSelector) ? [node] : [...node.querySelectorAll(focusSelector)]);
    return [...new Set([...targets, primary, skip])].filter(node => !node.hidden && node.getClientRects().length);
  }
  function focus(node) {
    if (node) node.focus({preventScroll:true});
  }
  function keyGuard(event) {
    if (!spec || spec.lock === false) return;
    if (event.key === 'Tab') {
      const list = focusables();
      if (!list.length) return;
      const index = list.indexOf(document.activeElement);
      const next = event.shiftKey ? (index < 1 ? list.length - 1 : index - 1) : (index + 1) % list.length;
      event.preventDefault();
      event.stopImmediatePropagation();
      focus(list[next]);
    } else if (event.key === 'Escape' || event.key === 'Backspace' ||
      (['Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key) && !permitted(event.target))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  // The launcher reveals the station just before the initial coaching frame.
  // Keep real input out of this gap, while allowing restoreScreen's synchronous
  // DOM actions and the launcher's own retry button.
  function gateStartup() {
    if (!window.DuoTraining) return;
    const types=['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','click','keydown'];
    function guardStartup(event) {
      if (spec || window.DuoTraining.currentStep?.()==='done') {
        for (const type of types) window.removeEventListener(type,guardStartup,true);
        return;
      }
      if (!event.isTrusted || (event.type!=='keydown' && !event.target.closest?.('#station'))) return;
      if (event.cancelable) event.preventDefault();
      event.stopImmediatePropagation();
    }
    for (const type of types) listen(type,guardStartup,{capture:true,passive:false});
  }
  gateStartup();
  function mount() {
    if (root) return;
    root = element('div', '', document.body);
    root.id = 'training-coach';
    root.hidden = true;
    const svgNS='http://www.w3.org/2000/svg';
    shade=document.createElementNS(svgNS,'svg');
    shade.setAttribute('class','tr-shade');
    shade.setAttribute('aria-hidden','true');
    shade.setAttribute('focusable','false');
    shadePath=document.createElementNS(svgNS,'path');
    shadePath.setAttribute('fill-rule','evenodd');
    shade.append(shadePath);
    root.append(shade);
    ring = element('div', 'tr-ring', root);
    ring.setAttribute('aria-hidden', 'true');
    panel = element('section', 'tr-panel', root);
    panel.setAttribute('aria-label','Обучение');
    const head = element('div', 'tr-head', panel);
    const meta = element('div','tr-meta',head);
    mode = element('span','tr-mode',meta);
    progress = element('span','tr-progress',meta);
    skip = element('button','tr-skip',head);
    skip.type = 'button';
    skip.textContent = 'Пропустить';
    skip.setAttribute('aria-label','Пропустить обучение');
    const message = element('div','tr-message',panel);
    message.setAttribute('aria-live','polite');
    message.setAttribute('aria-atomic','true');
    title = element('h2','tr-title',message);
    copy = element('p','tr-text',message);
    primary = element('button','tr-primary',panel);
    primary.type = 'button';
    primary.onclick = () => spec?.onAction?.();

    for (const type of ['pointerdown','pointerup','pointercancel','mousedown','mouseup','touchstart','touchend','wheel','click','dblclick','contextmenu']) {
      listen(type,guard,{capture:true,passive:false});
    }
    listen('keydown',keyGuard);
    listen('focusin',event => {
      if (spec && !permitted(event.target)) focus(focusables()[0]);
    });
    listen('scroll',schedule);
    listen('resize',schedule);
    listen('orientationchange',schedule);
    listen('transitionend',schedule);
    if (window.visualViewport) window.visualViewport.addEventListener('resize',schedule);
    if (window.ResizeObserver) {
      resizeWatch = new ResizeObserver(schedule);
      resizeWatch.observe(panel);
      resizeWatch.observe(document.documentElement);
    }
    /* The game replaces shop cards and map controls. Re-resolve an anchor that has
       been removed, without recalculating geometry on every animated score tick. */
    treeWatch = new MutationObserver(() => {
      if (spec?.target && (!focusedAnchor || !focusedAnchor.isConnected)) schedule();
    });
  }
  function schedule() {
    if (spec && !frame) frame = requestAnimationFrame(() => {frame = 0; layout();});
  }
  const clamp = (x, min, max) => Math.max(min, Math.min(x, max));
  function box(left, top, right, bottom) {
    return {left, top, right, bottom, width:Math.max(0,right-left), height:Math.max(0,bottom-top)};
  }
  function intersect(a,b) {
    return box(Math.max(a.left,b.left), Math.max(a.top,b.top), Math.min(a.right,b.right), Math.min(a.bottom,b.bottom));
  }
  function clippedRect(node, bounds) {
    let raw = node.getBoundingClientRect();
    if (!raw.width || !raw.height) return null;
    /* The balance heading stretches across the page. Frame the actual number. */
    if (node.id === 'balance' || node.classList.contains('pg-balance')) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const letters = range.getBoundingClientRect();
      if (letters.width && letters.height) raw = letters;
    }
    let visible = intersect(bounds,raw);
    for (let parent=node.parentElement; parent && parent !== document.body; parent=parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/(hidden|clip|auto|scroll)/.test(style.overflowX+' '+style.overflowY)) {
        visible = intersect(visible,parent.getBoundingClientRect());
      }
    }
    return {raw,visible};
  }
  function coordinate(node,name,value) {
    const css = Math.round(value)+'px';
    if (node.style[name] !== css) node.style[name]=css;
  }
  function roundedHole(x,y,w,h,rx,ry) {
    const r=x+w, b=y+h, arc=' A'+rx+' '+ry+' 0 0 1 ';
    return ' M'+(x+rx)+' '+y+' H'+(r-rx)+arc+r+' '+(y+ry)+
      ' V'+(b-ry)+arc+(r-rx)+' '+b+' H'+(x+rx)+
      arc+x+' '+(b-ry)+' V'+(y+ry)+arc+(x+rx)+' '+y+' Z';
  }
  function spotlight(viewport,target,radius,pad) {
    const w=viewport.width,h=viewport.height;
    const viewBox='0 0 '+w+' '+h;
    if (shade.getAttribute('viewBox')!==viewBox) shade.setAttribute('viewBox',viewBox);
    // A targetless live question must expose its prompt, choices, timer and
    // confirmation button together. A detached single target has no active hole.
    let d=target || spec.target || spec.paused ? 'M0 0 H'+w+' V'+h+' H0 Z' : '';
    if(target){
      const sides=radius.split(/\s+/), xRadius=sides[0], yRadius=sides[1]||xRadius;
      const toPixels=(value,length)=>Math.min(length/2,Math.max(5,value.endsWith('%') ? length*parseFloat(value)/100 : (parseFloat(value)||0)+pad));
      const x=target.left-viewport.left,y=target.top-viewport.top;
      const rx=toPixels(xRadius,target.width),ry=toPixels(yRadius,target.height);
      ring.style.borderRadius=rx+'px / '+ry+'px';
      d+=roundedHole(x,y,target.width,target.height,rx,ry);
    }
    if(shadePath.getAttribute('d')!==d) shadePath.setAttribute('d',d);
  }
  function layout() {
    if (!spec || !root || root.hidden) return;
    const stage = document.getElementById('station');
    const viewport = root.getBoundingClientRect();
    const bounds = stage ? intersect(viewport, stage.getBoundingClientRect()) : viewport;
    if (!bounds.width || !bounds.height) return;
    const font = parseFloat(getComputedStyle(root).fontSize) || 18;
    const pad = Math.max(6,Math.round(font*.58)), gap = Math.max(10,Math.round(font*.72));
    const anchor = currentTarget();
    if (focusedAnchor !== anchor) {
      if (focusedAnchor) resizeWatch?.unobserve(focusedAnchor);
      if (anchor) resizeWatch?.observe(anchor);
      focusedAnchor=anchor;
    }
    let region=anchor && clippedRect(anchor,bounds);
    if (region && scrolledAnchor !== anchor) {
      scrolledAnchor=anchor;
      if ((region.visible.width < Math.min(46,region.raw.width*.82) ||
           region.visible.height < Math.min(48,region.raw.height*.82)) && anchor.scrollIntoView) {
        anchor.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
        region=clippedRect(anchor,bounds);
      }
    }
    let target=region?.visible;
    if (target && (target.width<2 || target.height<2)) target=null;
    ring.hidden=!target;
    let radius='0px';
    const p=Math.max(3,Math.round(font*.2));
    if (target) {
      target=intersect(bounds,box(target.left-p,target.top-p,target.right+p,target.bottom+p));
      coordinate(ring,'left',target.left-viewport.left);
      coordinate(ring,'top',target.top-viewport.top);
      coordinate(ring,'width',target.width);
      coordinate(ring,'height',target.height);
      radius=getComputedStyle(anchor).borderTopLeftRadius;
    }
    spotlight(viewport,target,radius,p);
    const card=panel.getBoundingClientRect();
    const left=bounds.left+pad, top=bounds.top+pad;
    const right=bounds.right-pad-card.width, bottom=bounds.bottom-pad-card.height;
    const landscape=bounds.width>bounds.height;
    let choices=[];
    if (target) {
      const cx=(target.left+target.right-card.width)/2, cy=(target.top+target.bottom-card.height)/2;
      const horizontal=[['right',target.right+gap,cy],['left',target.left-gap-card.width,cy]];
      const vertical=[['below',cx,target.bottom+gap],['above',cx,target.top-gap-card.height]];
      choices=landscape ? horizontal.concat(vertical) : vertical.concat(horizontal);
    }
    choices.push(['top-right',right,top],['top-left',left,top],['bottom-right',right,bottom],['bottom-left',left,bottom]);
    if (!target && !spec.placement) choices.unshift(['bottom',(left+right)/2,bottom-gap]);
    const obstacles = [target,...allowedNodes().filter(x=>x!==anchor).map(n=>n.getBoundingClientRect())
      .filter(r=>r.width*r.height<bounds.width*bounds.height*.55)].filter(Boolean);
    if (spec.compact && !spec.paused && document.querySelector('.qc-screen')) {
      for (const node of document.querySelectorAll('.qc-options,.qc-foot,.qc-prompt,.qc-clock')) {
        if (node.getClientRects().length) obstacles.push(node.getBoundingClientRect());
      }
    }
    let best, score=Infinity;
    for (const [side,x,y] of choices) {
      const px=clamp(x,left,right), py=clamp(y,top,bottom);
      const rectangle=box(px-gap*.4,py-gap*.4,px+card.width+gap*.4,py+card.height+gap*.4);
      let cost=Math.abs(x-px)+Math.abs(y-py);
      for (const obj of obstacles) {
        const over=intersect(obj,rectangle);
        cost+=over.width*over.height*8;
      }
      if (side===spec.placement) cost-=500;
      if (cost<score) {score=cost;best=[px,py];}
    }
    if (best) {
      coordinate(panel,'left',best[0]-viewport.left);
      coordinate(panel,'top',best[1]-viewport.top);
    }
  }
  function show(options) {
    mount();
    const old=spec;
    const id=options.id??options.key;
    spec={...options,id,paused:options.paused??!options.live};
    const changed=!old || old.id!==id;
    if (changed) { scrolledAnchor=null; capturedPointers.clear(); }
    if (changed) root.dataset.step=id || '';
    if (!old || old.paused!==spec.paused) {
      root.dataset.paused=String(spec.paused);
      document.body.toggleAttribute('data-training-instruction',spec.paused);
    }
    if (!old || !!old.compact!==!!spec.compact) root.dataset.compact=String(!!spec.compact);
    text(mode,spec.paused?'На паузе':'Игра идёт');
    const step=spec.step??spec.progress?.current, count=spec.count??spec.progress?.total;
    text(progress,step && count ? step+' / '+count : '');
    progress.hidden=!progress.textContent;
    const message=spec.text??spec.body;
    text(title,spec.title); title.hidden=!spec.title;
    text(copy,message); copy.hidden=!message;
    text(primary,spec.actionLabel); primary.hidden=!spec.onAction || !spec.actionLabel;
    const skippable=spec.required===false && typeof spec.onSkip==='function';
    skip.hidden=!skippable;
    skip.disabled=!skippable;
    skip.onclick=skippable ? spec.onSkip : null;
    if (root.hidden) {
      root.hidden=false;
      const station=document.getElementById('station');
      if (station) treeWatch.observe(station,{subtree:true,childList:true});
    }
    if (changed) {
      layout();
      schedule();
    } else if (focusedAnchor!==currentTarget() || focusedAnchor?.id==='balance') schedule();
  }
  function hide() {
    spec=null;
    if (!root) return;
    root.hidden=true;
    document.body.removeAttribute('data-training-instruction');
    treeWatch.disconnect();
    if (focusedAnchor) resizeWatch?.unobserve(focusedAnchor);
    focusedAnchor=null;
    capturedPointers.clear();
    scrolledAnchor=null;
    if (frame) cancelAnimationFrame(frame);
    frame=0;
  }
  return Object.freeze({show,hide,currentTarget});
})();
