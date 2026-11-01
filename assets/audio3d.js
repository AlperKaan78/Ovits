// Original synthesized sound. No recordings or licensed sound assets.
export function createAudio(){
  let context=null,master=null,muted=false,impacts=0;
  function unlock(){if(!context){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return Promise.resolve(false);context=new Audio();master=context.createGain();master.gain.value=.55;master.connect(context.destination);}return context.resume().then(()=>true).catch(()=>false);}
  function impact(big=false,distance=0){if(!context||context.state!=='running'||muted)return false;
    const now=context.currentTime,duration=big?2.2:1.5,volume=Math.max(.12,1-distance/90);impacts++;
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);let last=0;
    for(let i=0;i<data.length;i++){last=(last+Math.random()*2-1)/1.025;data[i]=last*.12*Math.exp(-i/(context.sampleRate*.38));}
    const noise=context.createBufferSource();noise.buffer=buffer;const low=context.createBiquadFilter();low.type='lowpass';low.frequency.setValueAtTime(1800,now);low.frequency.exponentialRampToValueAtTime(80,now+duration);const gain=context.createGain();gain.gain.setValueAtTime(volume*(big?1.1:.8),now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);noise.connect(low).connect(gain).connect(master);noise.start(now);noise.stop(now+duration);
    const boom=context.createOscillator(),envelope=context.createGain();boom.type='sine';boom.frequency.setValueAtTime(big?68:92,now);boom.frequency.exponentialRampToValueAtTime(24,now+.65);envelope.gain.setValueAtTime(.001,now);envelope.gain.exponentialRampToValueAtTime(volume*.7,now+.015);envelope.gain.exponentialRampToValueAtTime(.001,now+1.2);boom.connect(envelope).connect(master);boom.start(now);boom.stop(now+1.25);
    return true;
  }
  return {unlock,impact,toggle(){muted=!muted;if(master)master.gain.value=muted?0:.55;return !muted;},get muted(){return muted;},get impactCount(){return impacts;},get ready(){return context?.state==='running';},dispose(){context?.close();}};
}
