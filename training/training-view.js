/* Only a new or unfinished lesson needs the coach. */
if (window.DuoTraining && !window.TrainingView) window.TrainingView = (() => {
  'use strict';
  let spec, root, panel, ring, contextRing, shade, shadePath, title, copy, head, progress, skip, primary;
  let pointer, focusedAnchor, contextAnchor, resizeWatch, treeWatch, frame, scrolledAnchor;
  const capturedPointers = new Map();
  let scoreGain,finaleSchool,invite,inviteQR,connect;
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
  function visualTarget() { return resolve(spec.highlight) || currentTarget(); }
  function allowedNodes() {
    const anchor=currentTarget();
    const extra = Array.isArray(spec.allowed) ? spec.allowed : [spec.allowed];
    const nodes = [anchor, ...extra.map(resolve)];
    return [...new Set(nodes.filter(node => node && !(spec.lockTarget && contains(anchor,node))))];
  }
  function contains(outer, inner) { return !!inner && !!outer && (outer === inner || outer.contains(inner)); }
  function exitButton() {
    const button = document.getElementById('exit-game');
    return button && !button.disabled && !button.closest('[inert],[hidden]') ? button : null;
  }
  function exitDialog() {
    const dialog = document.getElementById('exit-dialog');
    return dialog?.open ? dialog : null;
  }
  function permitted(target) {
    const dialog = exitDialog();
    if (dialog) return contains(dialog, target);
    if (target?.closest?.('#exit-game') && contains(exitButton(), target)) return true;
    if (!spec || spec.lock === false || contains(panel, target)) return true;
    if (spec.lockTarget && contains(currentTarget(),target)) return false;
    return allowedNodes().some(node => contains(node, target));
  }
  function guard(event) {
    if (!spec || spec.lock === false) return;
    if (event.type==='wheel' && ['choose-theme','apply-theme'].includes(spec.id) &&
        event.target.closest?.('.ap-scroll-area')) return;
    // Drag surfaces can capture the pointer on press (the map does this). Only
    // finish a gesture that actually began on the current highlighted target.
    if (event.type === 'pointerup' || event.type === 'pointercancel') {
      const original=capturedPointers.get(event.pointerId);
      capturedPointers.delete(event.pointerId);
      if (original && original === currentTarget() && !exitDialog()) return;
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
    return [...new Set([...targets, primary, connect, skip, exitButton()])].filter(node => node && !node.hidden && node.getClientRects().length && permitted(node));
  }
  function focus(node) {
    if (node) node.focus({preventScroll:true});
  }
  function keyGuard(event) {
    if (!spec || spec.lock === false || exitDialog()) return;
    if (event.key === 'Tab') {
      const list = focusables();
      event.preventDefault();
      event.stopImmediatePropagation();
      if (list.length) {
        const index = list.indexOf(document.activeElement);
        const next = event.shiftKey ? (index < 1 ? list.length - 1 : index - 1) : (index + 1) % list.length;
        focus(list[next]);
      }
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
      if (!event.isTrusted || contains(exitButton(),event.target) || exitDialog() ||
          (event.type!=='keydown' && !event.target.closest?.('#station'))) return;
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
    contextRing = element('div', 'tr-context-ring', root);
    contextRing.setAttribute('aria-hidden', 'true');
    pointer = element('div', 'tr-pointer', root);
    pointer.setAttribute('aria-hidden','true');
    const arrow=document.createElementNS(svgNS,'svg');
    arrow.setAttribute('viewBox','0 0 64 40');
    arrow.setAttribute('focusable','false');
    const shape='M5 12 H32 V4 Q32 2 34 3 L60 18 Q63 20 60 22 L34 37 Q32 38 32 36 V28 H5 Q3 28 3 26 V14 Q3 12 5 12 Z';
    for (const border of [5,2]) {
      const path=document.createElementNS(svgNS,'path');
      path.setAttribute('d',shape);
      path.setAttribute('stroke-linejoin','round');
      path.setAttribute('stroke-width',border);
      path.setAttribute('stroke',border===5 ? '#10232b' : '#fff6d5');
      path.setAttribute('fill','#ffc050');
      arrow.append(path);
    }
    pointer.append(arrow);
    pointer.hidden = true;
    scoreGain = element('span','tr-score-gain',root);
    scoreGain.setAttribute('role','status');
    scoreGain.hidden=true;
    panel = element('section', 'tr-panel', root);
    panel.setAttribute('aria-label','Обучение');
    head = element('div', 'tr-head', panel);
    progress = element('span','tr-progress',head);
    skip = element('button','tr-skip',head);
    skip.type = 'button';
    skip.textContent = 'Пропустить';
    skip.setAttribute('aria-label','Пропустить обучение');
    const message = element('div','tr-message',panel);
    message.setAttribute('aria-live','polite');
    message.setAttribute('aria-atomic','true');
    finaleSchool=element('img','tr-finale-school',panel);
    finaleSchool.alt='';finaleSchool.draggable=false;finaleSchool.hidden=true;
    title = element('h2','tr-title',message);
    copy = element('p','tr-text',message);
    invite = element('section','tr-invite',panel);
    invite.hidden = true;
    const inviteTitle = element('h3','',invite);
    inviteTitle.id='tr-invite-title';
    inviteTitle.textContent='Подключить Яндекс ID?';
    invite.setAttribute('aria-labelledby',inviteTitle.id);
    const details = element('div','tr-invite-copy',invite);
    element('p','',details).textContent='Из Яндекса игра получит имя и уникальный для этой игры ID. Фото и почту игра не запрашивает.';
    element('p','',details).textContent='Игроки увидят имя, эмодзи, эпоху, престиж и текущий счёт. Результат обновляется автоматически во время игры.';
    element('p','tr-invite-later',details).textContent='Можно подключиться позже в разделе «Общий рейтинг».';
    const qr = element('figure','tr-invite-qr',invite);
    inviteQR = element('img','',qr);
    inviteQR.alt='QR-код страницы ввода кода Яндекс ID';
    inviteQR.draggable=false;
    element('figcaption','',qr).textContent='Для входа понадобится код. Нажми «Да, подключить», чтобы запросить его.';
    const actions = element('div','tr-actions',panel);
    primary = element('button','tr-primary',actions);
    primary.type = 'button';
    primary.onclick = () => spec?.onAction?.();
    connect = element('button','tr-connect',actions);
    connect.hidden = true;
    connect.type = 'button';
    connect.textContent='Да, подключить';
    connect.onclick = () => spec?.onConnect?.();

    for (const type of ['pointerdown','pointerup','pointercancel','mousedown','mouseup','touchstart','touchend','wheel','click','dblclick','contextmenu']) {
      listen(type,guard,{capture:true,passive:false});
    }
    listen('keydown',keyGuard);
    listen('focusin',event => {
      if (spec && !exitDialog() && !permitted(event.target)) focus(focusables()[0]);
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
      if ((spec?.target && !focusedAnchor?.isConnected) || (spec?.context && !contextAnchor?.isConnected)) schedule();
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
  function placeScoreGain(viewport,bounds,gap) {
    if (scoreGain.hidden) return;
    const balance=document.getElementById('balance');
    const digits=balance && clippedRect(balance,bounds)?.visible;
    if (!digits?.width) return;
    const badge=scoreGain.getBoundingClientRect();
    const right=digits.right+gap, left=digits.left-gap-badge.width;
    const x=right+badge.width<=bounds.right-gap ? right : left;
    coordinate(scoreGain,'left',clamp(x,bounds.left+gap,bounds.right-gap-badge.width)-viewport.left);
    coordinate(scoreGain,'top',clamp((digits.top+digits.bottom-badge.height)/2,bounds.top,bounds.bottom-badge.height)-viewport.top);
  }
  function roundedHole(x,y,w,h,rx,ry) {
    const r=x+w, b=y+h, arc=' A'+rx+' '+ry+' 0 0 1 ';
    return ' M'+(x+rx)+' '+y+' H'+(r-rx)+arc+r+' '+(y+ry)+
      ' V'+(b-ry)+arc+(r-rx)+' '+b+' H'+(x+rx)+
      arc+x+' '+(b-ry)+' V'+(y+ry)+arc+(x+rx)+' '+y+' Z';
  }
  function frameRegion(outline,node,region,viewport,bounds,pad) {
    const rect=region?.visible;
    outline.hidden=!rect || rect.width<2 || rect.height<2;
    if (outline.hidden) return null;
    const target=intersect(bounds,box(rect.left-pad,rect.top-pad,rect.right+pad,rect.bottom+pad));
    const x=target.left-viewport.left, y=target.top-viewport.top;
    coordinate(outline,'left',x);
    coordinate(outline,'top',y);
    coordinate(outline,'width',target.width);
    coordinate(outline,'height',target.height);
    const sides=getComputedStyle(node).borderTopLeftRadius.split(/\s+/);
    const toPixels=(value,length)=>Math.min(length/2,Math.max(5,value.endsWith('%') ? length*parseFloat(value)/100 : (parseFloat(value)||0)+pad));
    const rx=toPixels(sides[0],target.width), ry=toPixels(sides[1]||sides[0],target.height);
    outline.style.borderRadius=rx+'px / '+ry+'px';
    return {bounds:target,path:roundedHole(x,y,target.width,target.height,rx,ry)};
  }
  function spotlight(viewport,regions) {
    if (!spec.spotlight) {
      if (shadePath.getAttribute('d')) shadePath.setAttribute('d','');
      return;
    }
    const w=viewport.width,h=viewport.height;
    const viewBox='0 0 '+w+' '+h;
    if (shade.getAttribute('viewBox')!==viewBox) shade.setAttribute('viewBox',viewBox);
    // A targetless live question must expose its prompt, choices, timer and
    // confirmation button together. A detached single target has no active hole.
    let d=regions.length || spec.target || spec.paused ? 'M0 0 H'+w+' V'+h+' H0 Z' : '';
    for (const region of regions) d+=region.path;
    if(shadePath.getAttribute('d')!==d) shadePath.setAttribute('d',d);
  }
  function overlapArea(a,b) {
    return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)) *
      Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  }
  function placeCoach(tip,card,bounds,viewport,font,protectedAreas,otherControls) {
    const full=clamp(font*2.95,42,92), pad=Math.max(6,font*.43), gap=Math.max(5,font*.28);
    const left=bounds.left+pad,top=bounds.top+pad;
    const width=card?.width||0,height=card?.height||0;
    const right=bounds.right-pad-width,bottom=bounds.bottom-pad-height;
    const gain=scoreGain.hidden?null:scoreGain.getBoundingClientRect();
    let best=null;
    function consider(arrow,x,y,preference) {
      const l=clamp(x,left,right),t=clamp(y,top,bottom);
      const caption=box(l,t,l+width,t+height);
      if(card && overlapArea(arrow.rect,caption)>1)return;
      const tailGap=card?Math.hypot(Math.max(0,l-arrow.backX,arrow.backX-caption.right),
        Math.max(0,t-arrow.backY,arrow.backY-caption.bottom)):0;
      let cost=preference+tailGap*3;
      if(card){
        for(const r of protectedAreas)cost+=overlapArea(caption,r)*50;
        for(const r of otherControls)cost+=overlapArea(caption,r)/font;
      }
      if(!best||cost<best.cost)best={arrow,l,t,cost};
    }
    if(tip?.width&&tip.height){
      // The arrow and its caption are one placement: attach the caption to the
      // tail, while the tip stays on the actual control, even at a screen edge.
      for(const length of [full,full*.72]){
        const thickness=length*40/64;
        for(const [dx,dy,angle] of [[0,1,90],[0,-1,-90],[1,0,0],[-1,0,180]]){
          for(const ratio of [.5,.23,.77,.1,.9]){
            const x=dx===1?tip.left-4:dx===-1?tip.right+4:tip.left+tip.width*ratio;
            const y=dy===1?tip.top-4:dy===-1?tip.bottom+4:tip.top+tip.height*ratio;
            const backX=x-length*dx,backY=y-length*dy;
            const rect=box(Math.min(x,backX)-Math.abs(dy)*thickness/2,Math.min(y,backY)-Math.abs(dx)*thickness/2,
              Math.max(x,backX)+Math.abs(dy)*thickness/2,Math.max(y,backY)+Math.abs(dx)*thickness/2);
            if(rect.left<bounds.left+2||rect.right>bounds.right-2||rect.top<bounds.top+2||rect.bottom>bounds.bottom-2)continue;
            if(gain&&overlapArea(rect,gain)>0)continue;
            const arrow={x,y,backX,backY,rect,length,thickness,angle};
            const preference=Math.abs(ratio-.5)*font+(full-length)*.7;
            if(!card){consider(arrow,0,0,preference);continue;}
            for(const align of [.5,.16,.84]){
              const l=dx===1?backX-gap-width:dx===-1?backX+gap:backX-width*align;
              const t=dy===1?backY-gap-height:dy===-1?backY+gap:backY-height*align;
              consider(arrow,l,t,preference+Math.abs(align-.5));
              // A cornered target may only have room beside the arrow.
              if(dx){
                consider(arrow,backX-width*align,rect.top-gap-height,preference+font*.8);
                consider(arrow,backX-width*align,rect.bottom+gap,preference+font*.8);
              }else{
                consider(arrow,rect.left-gap-width,backY-height*align,preference+font*.8);
                consider(arrow,rect.right+gap,backY-height*align,preference+font*.8);
              }
            }
          }
        }
      }
    }
    pointer.hidden=!best;
    if(best){
      const a=best.arrow;
      coordinate(pointer,'left',a.x-viewport.left-a.length);
      coordinate(pointer,'top',a.y-viewport.top-a.thickness/2);
      coordinate(pointer,'width',a.length);coordinate(pointer,'height',a.thickness);
      pointer.style.transform='rotate('+a.angle+'deg)';
    }
    if(card){
      coordinate(panel,'left',(best?best.l:clamp((left+right)/2,left,right))-viewport.left);
      coordinate(panel,'top',(best?best.t:bottom)-viewport.top);
    }
  }
  function layout() {
    if (!spec || !root || root.hidden) return;
    const stage = document.getElementById('station');
    const viewport = root.getBoundingClientRect();
    const bounds = stage ? intersect(viewport, stage.getBoundingClientRect()) : viewport;
    if (!bounds.width || !bounds.height) return;
    const font = parseFloat(getComputedStyle(root).fontSize) || 18;
    const gap = Math.max(10,Math.round(font*.72));
    const anchor = visualTarget(), context=resolve(spec.context);
    if (focusedAnchor !== anchor) {
      if (focusedAnchor) resizeWatch?.unobserve(focusedAnchor);
      if (anchor) resizeWatch?.observe(anchor);
      focusedAnchor=anchor;
    }
    if (contextAnchor !== context) {
      if (contextAnchor) resizeWatch?.unobserve(contextAnchor);
      if (context) resizeWatch?.observe(context);
      contextAnchor=context;
    }
    let region=anchor && clippedRect(anchor,bounds);
    if (region && scrolledAnchor !== anchor) {
      scrolledAnchor=anchor;
      const clippedCard=spec.highlight && (region.visible.height+2<region.raw.height || region.visible.width+2<region.raw.width);
      if ((clippedCard || region.visible.width < Math.min(46,region.raw.width*.82) ||
           region.visible.height < Math.min(48,region.raw.height*.82)) && anchor.scrollIntoView) {
        anchor.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
        region=clippedRect(anchor,bounds);
      }
    }
    const aim=resolve(spec.pointAt) || currentTarget();
    let aimRect=aim && clippedRect(aim,bounds);
    function reachable(r){
      return r && r.visible.width>=Math.min(24,r.raw.width*.5) &&
        r.visible.height>=Math.min(24,r.raw.height*.5);
    }
    if(aimRect && !reachable(aimRect)){
      // A scrolled gallery may have several equally valid choices. Point to
      // one that is still in view. A mandatory single target must be reachable.
      let alternate;
      if(spec.id==='choose-theme'){
        for(const n of allowedNodes()){
          const r=clippedRect(n,bounds);
          if(reachable(r)){alternate=r;break;}
        }
      }
      if(alternate)aimRect=alternate;
      else if(aim.scrollIntoView){
        aim.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
        aimRect=clippedRect(aim,bounds);
        region=anchor && clippedRect(anchor,bounds);
      }
    }
    const p=Math.max(3,Math.round(font*.2));
    const mainFrame=frameRegion(ring,anchor,region,viewport,bounds,p);
    const contextFrame=frameRegion(contextRing,context,context && clippedRect(context,bounds),viewport,bounds,p);
    const regions=[mainFrame,contextFrame].filter(Boolean);
    const exitBounds=exitButton()?.getBoundingClientRect();
    // Cut out only the exit control when the tutorial dims the laboratory or
    // paints its finale. The confirmation dialog uses the browser's top layer.
    const exitCutout=(spec.spotlight || spec.id==='completed') && exitBounds?.width && exitBounds?.height
      ? `radial-gradient(ellipse ${exitBounds.width/2}px ${exitBounds.height/2}px at ${exitBounds.left-viewport.left+exitBounds.width/2}px ${exitBounds.top-viewport.top+exitBounds.height/2}px, transparent 98%, black 100%)`
      : 'none';
    if(root.style.getPropertyValue('--tr-exit-cutout')!==exitCutout) root.style.setProperty('--tr-exit-cutout',exitCutout);
    spotlight(viewport,regions);
    const target=mainFrame?.bounds;
    if (target) placeScoreGain(viewport,target,gap);
    const tip=aimRect?.visible || target;
    if(spec.id==='completed'||spec.id==='theme-reveal'){
      pointer.hidden=true;panel.style.removeProperty('left');panel.style.removeProperty('top');
      return;
    }
    if(panel.hidden){placeCoach(tip,null,bounds,viewport,font,[],[]);return;}
    const protectedAreas=regions.map(frame=>frame.bounds);
    if(exitBounds?.width && exitBounds.height) protectedAreas.push(exitBounds);
    if(spec.id==='global-ranking'){
      const balance=document.getElementById('balance');
      const digits=balance && clippedRect(balance,bounds)?.visible;
      if(digits)protectedAreas.push(digits);
    }
    if(tip)protectedAreas.push(tip);
    if(!scoreGain.hidden)protectedAreas.push(scoreGain.getBoundingClientRect());
    if(spec.gainLabel){
      const integral=document.getElementById('integral-button');
      if(integral)protectedAreas.push(integral.getBoundingClientRect());
    }
    const other=allowedNodes().filter(n=>!contains(anchor,n)).map(n=>n.getBoundingClientRect())
      .filter(r=>r.width*r.height<bounds.width*bounds.height*.55);
    const detail=anchor?.closest('.pg-study-panel,.ap-detail') ||
      (spec.id==='choose-theme' && document.querySelector('.ap-detail:not([hidden])'));
    if(detail)other.push(detail.getBoundingClientRect());
    if(spec.id==='choose-theme'||spec.id==='apply-theme'){
      for(const n of document.querySelectorAll('.ap-chapters,.ap-tabs,.ap-filter,#tabs'))other.push(n.getBoundingClientRect());
    }
    if(document.querySelector('.qc-screen')){
      for(const n of document.querySelectorAll('.qc-options,.qc-foot,.qc-prompt,.qc-clock,.qc-review')){
        if(n.getClientRects().length)other.push(n.getBoundingClientRect());
      }
    }
    placeCoach(tip,panel.getBoundingClientRect(),bounds,viewport,font,protectedAreas,other);
  }
  function show(options) {
    mount();
    const old=spec;
    const id=options.id??options.key;
    // Only the first click and the two introductory resource purchases use a
    // cutout. All subsequent pointers leave the real interface in view.
    const spotlight=!options.point && ['first-tap','first-funds','buy-bit','buy-schoolchild'].includes(id);
    spec={...options,id,spotlight,paused:options.paused??!options.live};
    const changed=!old || old.id!==id;
    if (changed) { scrolledAnchor=null; capturedPointers.clear(); }
    if (changed) root.dataset.step=id || '';
    const pointed=String(!spotlight), framed=String(!spotlight && !!visualTarget()?.matches('.meter'));
    if(root.dataset.point!==pointed) root.dataset.point=pointed;
    if(root.dataset.framePoint!==framed) root.dataset.framePoint=framed;
    if (!old || old.paused!==spec.paused) {
      root.dataset.paused=String(spec.paused);
      document.body.toggleAttribute('data-training-instruction',spec.paused);
    }
    const compact=String(!!spec.compact || !spotlight);
    if(root.dataset.compact!==compact) root.dataset.compact=compact;
    // The question already supplies its own timer, instructions and feedback.
    // Keep the mandatory input guard active while it owns the full screen.
    panel.hidden=/^quiz-(play-|review-|retry$)/.test(id);
    const step=spec.step??spec.progress?.current, count=spec.count??spec.progress?.total;
    text(progress,step && count ? step+' / '+count : '');
    progress.hidden=!progress.textContent;
    const message=spec.text??spec.body;
    finaleSchool.hidden=id!=='completed';
    if(!finaleSchool.hidden&&!finaleSchool.hasAttribute('src'))finaleSchool.src=window.duoArt('art/map/hd-school.webp');
    connect.hidden=invite.hidden=!spec.onConnect;
    if(!invite.hidden && !inviteQR.hasAttribute('src')) inviteQR.src=window.duoArt('art/guide/yandex-device-ru.png');
    text(title,spec.title); title.hidden=!spec.title;
    text(copy,message); copy.hidden=!message;
    text(scoreGain,spec.gainLabel); scoreGain.hidden=!spec.gainLabel;
    text(primary,spec.actionLabel); primary.hidden=!spec.onAction || !spec.actionLabel;
    const skippable=spec.required===false && typeof spec.onSkip==='function';
    skip.hidden=!skippable;
    skip.disabled=!skippable;
    skip.onclick=skippable ? spec.onSkip : null;
    head.hidden=progress.hidden && skip.hidden;
    if (root.hidden) {
      root.hidden=false;
      const station=document.getElementById('station');
      if (station) treeWatch.observe(station,{subtree:true,childList:true});
    }
    if (changed) {
      if((id==='theme-reveal'||id==='completed')&&!primary.hidden)focus(primary);
      layout();
      schedule();
    } else if (focusedAnchor!==visualTarget() || contextAnchor!==resolve(spec.context) ||
      focusedAnchor?.id==='balance' || spec.pointAt==='#balance') schedule();
  }
  function hide() {
    spec=null;
    if (!root) return;
    root.hidden=true;
    document.body.removeAttribute('data-training-instruction');
    treeWatch.disconnect();
    if (focusedAnchor) resizeWatch?.unobserve(focusedAnchor);
    if (contextAnchor) resizeWatch?.unobserve(contextAnchor);
    focusedAnchor=null;
    contextAnchor=null;
    capturedPointers.clear();
    scrolledAnchor=null;
    if (frame) cancelAnimationFrame(frame);
    frame=0;
  }
  return Object.freeze({show,hide,currentTarget});
})();
