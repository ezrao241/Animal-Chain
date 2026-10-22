// The home screen's soundscape, synthesised in the page (no audio files): a low evening breeze, crickets, now and
// then a bird, and a far-off call from whichever animal the camera is watching. Plus the menu's own soft UI sounds.
import {playAnimalSound} from './animal-sounds';
import type {Species} from './game';

export class MenuAmbience{
 private out:GainNode;private timers:ReturnType<typeof setTimeout>[]=[];private stopped=false;
 constructor(private ctx:AudioContext,private watching:()=>Species|null){
  this.out=ctx.createGain();this.out.gain.value=0;this.out.connect(ctx.destination);
  this.out.gain.linearRampToValueAtTime(1,ctx.currentTime+2.5);
  // breeze: pink-ish noise through a slowly swaying band-pass
  const len=ctx.sampleRate*4,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);let b=0;
  for(let i=0;i<len;i++){b=.985*b+.015*(Math.random()*2-1);d[i]=b*5;}
  const noise=ctx.createBufferSource();noise.buffer=buf;noise.loop=true;
  const band=ctx.createBiquadFilter();band.type='bandpass';band.frequency.value=420;band.Q.value=.6;
  const gust=ctx.createGain();gust.gain.value=.05;const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value=.07;depth.gain.value=.03;lfo.connect(depth);depth.connect(gust.gain);
  const sway=ctx.createOscillator(),swayDepth=ctx.createGain();sway.frequency.value=.05;swayDepth.gain.value=160;sway.connect(swayDepth);swayDepth.connect(band.frequency);
  noise.connect(band);band.connect(gust);gust.connect(this.out);noise.start();lfo.start();sway.start();
  // crickets: a high tone gated in quick trills
  const chirp=ctx.createOscillator(),gate=ctx.createGain(),trill=ctx.createOscillator(),trillDepth=ctx.createGain(),crickets=ctx.createGain();
  chirp.frequency.value=4600;trill.type='square';trill.frequency.value=28;trillDepth.gain.value=.5;gate.gain.value=.5;trill.connect(trillDepth);trillDepth.connect(gate.gain);
  crickets.gain.value=.006;chirp.connect(gate);gate.connect(crickets);crickets.connect(this.out);chirp.start();trill.start();
  this.nodes=[noise,lfo,sway,chirp,trill];
  this.schedule(()=>this.bird(),2500,7000);
  this.schedule(()=>{const s=this.watching();if(s)playAnimalSound(ctx,s,'call',.05,(Math.random()-.5)*.8);},6000,9000);
 }
 private nodes:AudioScheduledSourceNode[];
 private schedule(fn:()=>void,min:number,spread:number){const next=()=>{if(this.stopped)return;try{fn();}catch{}this.timers.push(setTimeout(next,min+Math.random()*spread));};this.timers.push(setTimeout(next,min+Math.random()*spread));}
 // a two- or three-note whistle, like a distant sunbird or bulbul
 private bird(){const c=this.ctx,t=c.currentTime,base=1800+Math.random()*1400,notes=2+Math.floor(Math.random()*2),pan=c.createStereoPanner();pan.pan.value=Math.random()*1.6-.8;pan.connect(this.out);
  for(let i=0;i<notes;i++){const o=c.createOscillator(),g=c.createGain(),s=t+i*.16;o.frequency.setValueAtTime(base*(1+i*.12),s);o.frequency.exponentialRampToValueAtTime(base*(1.25+i*.1),s+.1);g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(.018,s+.02);g.gain.exponentialRampToValueAtTime(.0001,s+.13);o.connect(g);g.connect(pan);o.start(s);o.stop(s+.15);}}
 stop(){if(this.stopped)return;this.stopped=true;this.timers.forEach(clearTimeout);const t=this.ctx.currentTime;this.out.gain.cancelScheduledValues(t);this.out.gain.setValueAtTime(this.out.gain.value,t);this.out.gain.linearRampToValueAtTime(0,t+.6);setTimeout(()=>{this.nodes.forEach(n=>{try{n.stop();}catch{}});this.out.disconnect();},800);}
}

/** Soft menu sounds: 'move' when the highlight moves, 'select' for a choice, 'back' for going back. */
export function uiSound(ctx:AudioContext,kind:'move'|'select'|'back'){
 if(ctx.state==='suspended')void ctx.resume().catch(()=>{});
 const t=ctx.currentTime,g=ctx.createGain();g.connect(ctx.destination);
 const notes=kind==='move'?[1320]:kind==='select'?[523,784,1046]:[660,440];
 notes.forEach((f,i)=>{const o=ctx.createOscillator(),s=t+i*(kind==='select'?.05:.07),v=kind==='move'?.012:.03;o.type=kind==='move'?'sine':'triangle';o.frequency.setValueAtTime(f,s);const e=ctx.createGain();e.gain.setValueAtTime(.0001,s);e.gain.exponentialRampToValueAtTime(v,s+.012);e.gain.exponentialRampToValueAtTime(.0001,s+(kind==='move'?.07:.35));o.connect(e);e.connect(g);o.start(s);o.stop(s+.4);});
}
