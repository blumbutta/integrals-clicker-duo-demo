// The original 16-second recording loops at the same level as on iPhone.
// WAV effects use the note scores and envelopes in Services/Audio/GameAudio.swift.
window.DuoAudio = (() => {
  'use strict';
  const musicName='integrals-soundtrack';
  const effects=['click','purchase','tick','golden','correct','loss','reward','achievement','miss','prestigeOpen'];
  const known=new Set([...effects,'world-charge','world-infall','world-launch','world-birth']);
  const notices=new Set(['golden','reward','miss','correct','loss','achievement','prestigeOpen']);
  const vibration={click:8,purchase:16,golden:[18,38,30],correct:15,loss:35,reward:[12,40,22],achievement:[12,40,22],'world-birth':32};
  const prefs={sound:true,haptics:true};
  for(const key of Object.keys(prefs)) {
    try { prefs[key]=localStorage.getItem('integrals.duo.'+key)!=='off'; } catch (_) {}
  }
  let context=null,music=null,gain=null,musicLoading=false,started=false,calledResume=null,calledSuspend=null,priority=null;
  let foreground=window.DuoStartup?.isForeground?.()!==false,pageAway=false;
  let transportGeneration=0,noticeSequence=0,voiceSequence=0;
  const decoded=new Map(), voices=[];
  let ambientRequested=false,ambient=null,holeLoop=null,worldActive=false,cue=null;
  function canPrepare(){return foreground && !pageAway && !document.hidden && prefs.sound;}
  function active(){return started && canPrepare();}
  function enabled(key){return !!prefs[key];}
  const readyEffects=new Map();
  let warmingEffects=false,waitingForOutput=null;
  async function warmEffects(){
    if(warmingEffects || readyEffects.size===effects.length)return;
    warmingEffects=true;
    try{
      // Prioritize input sounds while limiting simultaneous fetches and decoders.
      for(let i=0;i<effects.length;i+=2){
        if(!context || !canPrepare())return;
        await Promise.all(effects.slice(i,i+2).map(load));
      }
    }finally{warmingEffects=false;}
  }
  function load(name){
    if(decoded.has(name))return decoded.get(name);
    const url=window.duoArt('art/audio/'+name+'.wav');
    const result=fetch(url).then(response=>{
      if(!response.ok)throw Error('audio '+response.status);
      return response.arrayBuffer();
    }).then(bytes=>context.decodeAudioData(bytes)).then(buffer=>{
      if(effects.includes(name))readyEffects.set(name,buffer);
      return buffer;
    }).catch(()=>{decoded.delete(name);return null});
    decoded.set(name,result);return result;
  }
  function ensureContext(){
    if(!context){
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return false;
      try{context=new Audio();}catch(_){return false;}
    }
    return true;
  }
  // Decode during the title. Opening a context never starts a source by itself.
  function prepare(){
    if(!canPrepare() || !ensureContext())return;
    load(musicName);warmEffects();
  }
  if(window.requestIdleCallback)window.requestIdleCallback(prepare,{timeout:300});
  else setTimeout(prepare,0);
  function stopNode(node){
    if(!node)return;
    try{node.stop()}catch(_){}
    node.disconnect();
  }
  function musicVolume(){return worldActive ? 0 : ambientRequested ? .14 : .32;}
  function mixMusic(fade=false){
    if(!gain)return;
    const volume=gain.gain,target=musicVolume(),now=context.currentTime;
    volume.cancelScheduledValues(now);
    if(fade && active()){
      volume.setValueAtTime(volume.value,now);
      volume.linearRampToValueAtTime(target,now+.9);
    }else volume.setValueAtTime(target,now);
  }
  // The four-second drone in GameAudio.makeBlackHoleLoop, at its native sample rate.
  function prestigeLoop(){
    if(holeLoop)return holeLoop;
    const rate=22050,duration=4,tau=2*Math.PI;
    holeLoop=context.createBuffer(1,duration*rate,rate);
    const samples=holeLoop.getChannelData(0);
    for(let i=0;i<samples.length;i++){
      const t=i/rate,cycle=tau*t/duration;
      const bass=Math.sin(tau*64*t)*.075;
      const halo=Math.sin(tau*96*t+.6*Math.sin(cycle))*.038;
      const dust=Math.sin(tau*192*t)*.012+Math.sin(tau*320*t)*.006;
      samples[i]=(bass+halo+dust)*(.7+.3*Math.cos(cycle));
    }
    return holeLoop;
  }
  function updateAmbience(){
    if(!active() || !ambientRequested || worldActive){
      stopNode(ambient);ambient=null;return;
    }
    if(ambient||!context)return;
    const level=context.createGain();level.gain.value=.42;level.connect(context.destination);
    const node=context.createBufferSource();node.buffer=prestigeLoop();node.loop=true;node.connect(level);
    node.onended=()=>level.disconnect();
    ambient=node;node.start();
  }
  function updatePrestigeSheet(){
    const visible=window.App?.sheet==='prestige';
    if(visible===ambientRequested)return;
    ambientRequested=visible;
    if(visible)begin();
    mixMusic();updateAmbience();
    if(visible && context && active()){
      load('world-charge');load('world-birth');worldBuffer('world-launch');
    }
  }
  function worldBuffer(name){
    if(name!=='world-launch')return load(name);
    if(decoded.has('beam-infall'))return decoded.get('beam-infall');
    const result=Promise.all([load('world-launch'),load('world-infall')]).then(([launch,infall])=>{
      if(!launch||!infall)throw Error('incomplete transition sound');
      // A single source preserves launch, the quiet interval and then the pull across frames.
      const delay=Math.round(1.38*launch.sampleRate);
      const combined=context.createBuffer(1,Math.max(launch.length,delay+infall.length),launch.sampleRate);
      const samples=combined.getChannelData(0),pull=infall.getChannelData(0);
      samples.set(launch.getChannelData(0));
      for(let i=0;i<pull.length;i++)samples[delay+i]+=pull[i];
      return combined;
    }).catch(()=>{decoded.delete('beam-infall');return null;});
    decoded.set('beam-infall',result);
    return result;
  }
  function stopCue(){
    if(cue?.node){cue.node.onended=null;stopNode(cue.node);}
    cue=null;
  }
  function stopWorldTransition(){
    stopCue();
    if(!worldActive)return;
    worldActive=false;mixMusic(true);updateAmbience();
  }
  function scheduleCue(){
    const current=cue;
    if(!current||current.node||!active()||!context)return;
    worldBuffer(current.name).then(buffer=>{
      if(cue!==current||current.node||!active())return;
      const offset=Math.max(0,context.currentTime-current.start);
      if(!buffer||offset>=buffer.duration){
        if(current.name==='world-birth')stopWorldTransition();else cue=null;
        return;
      }
      const node=context.createBufferSource();current.node=node;
      node.buffer=buffer;node.connect(context.destination);
      node.onended=()=>{
        node.disconnect();
        if(cue!==current)return;
        cue=null;
        if(current.name==='world-birth')stopWorldTransition();
      };
      node.start(0,offset);
    });
  }
  function playCue(name){
    if(name==='world-infall'&&cue?.name==='world-launch')return;
    stopCue();worldActive=true;updateAmbience();mixMusic();
    cue={name,start:context.currentTime,node:null};
    scheduleCue();
  }
  function muteNow(){
    transportGeneration++;
    while(voices.length)stopNode(voices.pop());
    stopNode(priority);priority=null;
    updateAmbience();
    if(!prefs.sound)stopWorldTransition();
    if(context && context.state!=='suspended' && !calledSuspend){
      const pending=context.suspend().catch(()=>{});
      calledSuspend=pending;
      pending.then(()=>{
        if(calledSuspend===pending)calledSuspend=null;
        // The app may already have returned while Web Audio was suspending.
        if(active() && context.state==='suspended')transport();
      });
    }
    // Suspending the context holds the loop's playhead; reuse its source on return.
  }
  function resumeContext(userGesture){
    if(context.state==='running' || (calledResume && !userGesture))return;
    // A browser may defer resume until the end of a trusted touch. A later input
    // can retry while the initial autoplay request is still pending.
    const pending=context.resume().catch(()=>{});
    calledResume=pending;
    pending.then(()=>{
      if(calledResume===pending)calledResume=null;
      if(!canPrepare())muteNow();
    });
  }
  function transport(userGesture=false){
    if(!canPrepare()){muteNow();return;}
    prepare();
    if(!context)return;
    if(started || userGesture===true)resumeContext(userGesture===true);
    if(!started)return;
    updateAmbience();scheduleCue();
    if(!music && !musicLoading){
      musicLoading=true;
      load(musicName).then(buffer=>{
        musicLoading=false;
        if(!buffer || !active() || music)return;
        gain=context.createGain();gain.gain.value=musicVolume();gain.connect(context.destination);
        music=context.createBufferSource();music.buffer=buffer;music.loop=true;music.connect(gain);music.start();
      });
    }
  }
  function begin(userGesture=false){
    if(canPrepare() && (!context || context.state!=='running' || (started && !music)))transport(userGesture);
  }
  function unlock(event){
    if(!event.isTrusted)return;
    begin(true);
  }
  function setEnabled(key,value){
    if(!(key in prefs))return;
    prefs[key]=Boolean(value);
    try{localStorage.setItem('integrals.duo.'+key,prefs[key]?'on':'off');}catch(_){}
    if(key==='sound')transport(Boolean(value));
    else if(!value && navigator.vibrate)navigator.vibrate(0);
  }
  function play(name){
    if(!known.has(name)||!foreground||document.hidden)return;
    if(prefs.haptics && navigator.vibrate && vibration[name]){
      try{navigator.vibrate(vibration[name]);}catch(_){}
    }
    begin();
    if(!active()||!context)return;
    if(name.startsWith('world-')){playCue(name);return;}
    const gen=transportGeneration,notice=notices.has(name);
    const sequence=notice?++noticeSequence:++voiceSequence;
    const requested=performance.now();
    const start=buffer=>{
      if(!buffer || !active() || gen!==transportGeneration)return;
      if(notice?sequence!==noticeSequence:sequence<voiceSequence-5)return;
      // An interaction that passed while a device was stalled should never replay later.
      if(name==='click' && performance.now()-requested>250)return;
      if(context.state!=='running'){
        // Some browsers release audio only at touch-up. Keep only the latest
        // reaction and never queue a source on a clock that may stay suspended.
        if(waitingForOutput)context.removeEventListener('statechange',waitingForOutput);
        waitingForOutput=()=>{
          waitingForOutput=null;
          if(context.state==='running' && performance.now()-requested<=120)start(buffer);
        };
        context.addEventListener('statechange',waitingForOutput,{once:true});
        return;
      }
      if(notice){stopNode(priority);priority=null;}
      else if(voices.length>=6)stopNode(voices.shift());
      const node=context.createBufferSource();node.buffer=buffer;node.connect(context.destination);
      if(notice)priority=node;else voices.push(node);
      node.onended=()=>{
        if(priority===node)priority=null;
        const idx=voices.indexOf(node);if(idx>=0)voices.splice(idx,1);
        node.disconnect();
      };
      node.start();
    };
    const ready=readyEffects.get(name);
    if(ready)start(ready);
    else load(name).then(start);
  }
  window.addEventListener('duolaunchcomplete',()=>{started=true;transport();},{once:true});
  window.addEventListener('duonavigation',updatePrestigeSheet);
  window.addEventListener('pointerdown',unlock,{capture:true,passive:true});
  window.addEventListener('pointerup',unlock,{capture:true,passive:true});
  window.addEventListener('click',unlock,{capture:true,passive:true});
  window.addEventListener('keydown',unlock,{capture:true});
  document.addEventListener('visibilitychange',transport);
  window.addEventListener('duopause',()=>{foreground=false;transport()});
  window.addEventListener('duoresume',()=>{foreground=true;transport()});
  window.addEventListener('pagehide',()=>{pageAway=true;transport()});
  window.addEventListener('pageshow',()=>{pageAway=false;transport()});
  return Object.freeze({play,enabled,setEnabled,stopWorldTransition});
})();
