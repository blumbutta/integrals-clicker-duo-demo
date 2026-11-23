/* The browser tutorial registers its coach here. The normal game never mounts it. */
window.TrainingView = (() => {
  'use strict';
  let spec, root, panel, ring, title, copy, mode, progress, skip, primary;
  let focusedAnchor, resizeWatch, treeWatch, frame, scrolledAnchor;
  const listen = (type, handler) => window.addEventListener(type, handler, true);
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
    const extra = Array.isArray(spec.allowed) ? spec.allowed : [spec.allowed];
    return [spec.lockTarget ? null : currentTarget(), ...extra.map(resolve)].filter(Boolean);
  }
  function contains(outer, inner) { return !!inner && !!outer && (outer === inner || outer.contains(inner)); }
  function permitted(target) {
    return !spec || spec.lock === false || contains(panel, target) ||
      allowedNodes().some(node => contains(node, target));
  }
  function guard(event) {
    if (!spec || permitted(event.target)) return;
    if (event.type === 'click' || event.type === 'dblclick' || event.type === 'contextmenu') event.preventDefault();
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
  function mount() {
    if (root) return;
    root = element('div', '', document.body);
    root.id = 'training-coach';
    root.hidden = true;
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
    skip.onclick = () => spec?.onSkip?.();
    const message = element('div','tr-message',panel);
    message.setAttribute('aria-live','polite');
    message.setAttribute('aria-atomic','true');
    title = element('h2','tr-title',message);
    copy = element('p','tr-text',message);
    primary = element('button','tr-primary',panel);
    primary.type = 'button';
    primary.onclick = () => spec?.onAction?.();

    for (const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','click','dblclick','contextmenu']) listen(type,guard);
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
    if (target) {
      const p=Math.max(3,Math.round(font*.2));
      target=intersect(bounds,box(target.left-p,target.top-p,target.right+p,target.bottom+p));
      coordinate(ring,'left',target.left-viewport.left);
      coordinate(ring,'top',target.top-viewport.top);
      coordinate(ring,'width',target.width);
      coordinate(ring,'height',target.height);
      const radius=getComputedStyle(anchor).borderTopLeftRadius;
      ring.style.borderRadius=radius.includes('%') ? radius : (Math.max(5, Math.round((parseFloat(radius)||0)+p))+'px');
    }
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
    if (changed) scrolledAnchor=null;
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
    skip.hidden=!spec.onSkip;
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
    scrolledAnchor=null;
    if (frame) cancelAnimationFrame(frame);
    frame=0;
  }
  return Object.freeze({show,hide,currentTarget});
})();
