// Animal voices, synthesised in the page (no audio files). Each one is modelled on how the real call is described
// (docs/wildlife-sources.md "Sounds"), squeezed into a few seconds: a real lion roaring bout runs to a minute.
import type {Species} from './game';

export type AnimalSoundEvent='call'|'alarm'|'action'|'success'|'ability'|'death';

const noiseBuffers=new WeakMap<AudioContext,AudioBuffer>();

export function noiseBuffer(context:AudioContext){
 let buffer=noiseBuffers.get(context);
 if(!buffer){
  buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);
  const samples=buffer.getChannelData(0);
  for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
  noiseBuffers.set(context,buffer);
 }
 return buffer;
}

type Bus={master:GainNode;ambience:GainNode;effects:GainNode};
const buses=new WeakMap<AudioContext,Bus>();
/** Every game sound goes through one master volume, split into ambience (the soundscape) and effects (animals, menus). */
export function soundBus(context:AudioContext):Bus{
 let bus=buses.get(context);
 if(!bus){
  const master=context.createGain(),ambience=context.createGain(),effects=context.createGain();
  ambience.connect(master);effects.connect(master);master.connect(context.destination);
  buses.set(context,bus={master,ambience,effects});
 }
 return bus;
}

export type SoundLevels={muted:boolean;volume:number;ambience:number};
export const DEFAULT_LEVELS:SoundLevels={muted:false,volume:.8,ambience:.8};
const LEVELS_KEY='animal-chain-sound';
export function loadLevels():SoundLevels{
 try{const saved=JSON.parse(localStorage.getItem(LEVELS_KEY)||'null');if(saved&&typeof saved.volume==='number')return{...DEFAULT_LEVELS,...saved};}catch{}
 return{...DEFAULT_LEVELS};
}
export function saveLevels(levels:SoundLevels){try{localStorage.setItem(LEVELS_KEY,JSON.stringify(levels));}catch{}}
/** volume sliders are perceptual: the gain rises with the square of the slider, and the default slider is unity gain */
export function applyLevels(context:AudioContext,levels:SoundLevels){
 const bus=soundBus(context),t=context.currentTime,unit=(v:number)=>(v/.8)**2;
 bus.master.gain.setTargetAtTime(levels.muted?0:unit(levels.volume),t,.05);
 bus.ambience.gain.setTargetAtTime(unit(levels.ambience),t,.05);
}

/** A voice's output: level, stereo position and, for far sounds, the dull edge the air gives a distant call. */
export function voiceOutput(context:AudioContext,volume:number,pan:number,far=0,destination:AudioNode=soundBus(context).effects){
 const now=context.currentTime,output=context.createGain(),stereo=context.createStereoPanner();
 output.gain.setValueAtTime(Math.max(.0001,Math.min(.3,volume)),now);
 stereo.pan.setValueAtTime(Math.max(-1,Math.min(1,pan)),now);
 if(far>0){const air=context.createBiquadFilter();air.type='lowpass';air.frequency.setValueAtTime(9000*(1-far)+500*far,now);output.connect(air);air.connect(stereo);}
 else output.connect(stereo);
 stereo.connect(destination);
 setTimeout(()=>{try{output.disconnect();stereo.disconnect();}catch{}},12000);
 return output;
}

/** the building blocks: a pitched tone (optionally through a formant band, like a vocal tract) and a breath of noise */
export function voiceKit(context:AudioContext,output:AudioNode,pitch=1){
 const now=context.currentTime;
 const tone=(from:number,to:number,offset:number,length:number,wave:OscillatorType='sine',level=.55,formant=0,attack=.012)=>{
  const oscillator=context.createOscillator(),envelope=context.createGain(),start=now+offset;
  oscillator.type=wave;oscillator.frequency.setValueAtTime(from*pitch,start);oscillator.frequency.exponentialRampToValueAtTime(Math.max(1,to*pitch),start+length);
  envelope.gain.setValueAtTime(.0001,start);envelope.gain.linearRampToValueAtTime(level,start+Math.min(attack,length*.5));envelope.gain.exponentialRampToValueAtTime(.0001,start+length);
  if(formant){const band=context.createBiquadFilter();band.type='bandpass';band.frequency.setValueAtTime(formant,start);band.Q.setValueAtTime(1.1,start);oscillator.connect(band);band.connect(envelope);}
  else oscillator.connect(envelope);
  envelope.connect(output);oscillator.start(start);oscillator.stop(start+length+.02);
 };
 // a tone that rises and falls over its length (a roar, a whoop): through, then to, then end
 const swell=(from:number,peak:number,end:number,offset:number,length:number,wave:OscillatorType,level:number,formant=0)=>{
  const oscillator=context.createOscillator(),envelope=context.createGain(),start=now+offset;
  oscillator.type=wave;oscillator.frequency.setValueAtTime(from*pitch,start);oscillator.frequency.exponentialRampToValueAtTime(peak*pitch,start+length*.35);oscillator.frequency.exponentialRampToValueAtTime(end*pitch,start+length);
  envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(level,start+length*.3);envelope.gain.setValueAtTime(level,start+length*.55);envelope.gain.exponentialRampToValueAtTime(.0001,start+length);
  let tail:AudioNode=oscillator;if(formant){const lowpass=context.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.setValueAtTime(formant,start);lowpass.Q.setValueAtTime(3,start);oscillator.connect(lowpass);tail=lowpass;}
  tail.connect(envelope);envelope.connect(output);oscillator.start(start);oscillator.stop(start+length+.02);
 };
 const hiss=(offset:number,length:number,center:number,level=.3,q=.8,attack=.025)=>{
  const source=context.createBufferSource(),filter=context.createBiquadFilter(),envelope=context.createGain(),start=now+offset;
  source.buffer=noiseBuffer(context);filter.type='bandpass';filter.frequency.setValueAtTime(center,start);filter.Q.setValueAtTime(q,start);
  envelope.gain.setValueAtTime(.0001,start);envelope.gain.linearRampToValueAtTime(level,start+Math.min(attack,length*.5));envelope.gain.exponentialRampToValueAtTime(.0001,start+length);
  source.connect(filter);filter.connect(envelope);envelope.connect(output);source.start(start,Math.random()*1.5);source.stop(start+length+.02);
 };
 return{tone,swell,hiss};
}

// evens out the voices: the filtered barks and snorts carry less energy than a roar for the same level
const LOUDNESS:Record<Species,number>={lion:1,leopard:1.8,hyena:1,zebra:2.4,impala:1.8,warthog:2};

export function playAnimalSound(context:AudioContext,species:Species,event:AnimalSoundEvent,volume:number,pan=0,far=0){
 if(context.state==='suspended')void context.resume().catch(()=>{});
 const output=voiceOutput(context,volume*LOUDNESS[species],pan,far);
 const pitch=event==='death'?.82:1,{tone,swell,hiss}=voiceKit(context,output,pitch);

 if(species==='lion'){
  if(event==='call'){
   // a roaring bout: a soft opening moan, two full-throated roars, then a run of grunts that slow and fade
   swell(95,130,90,0,.9,'sawtooth',.18,520);
   for(let i=0;i<2;i++){const s=1.05+i*1.55;swell(110,190,95,s,1.35,'sawtooth',.6,900);hiss(s+.05,1.2,380,.2,.7,.25);}
   for(let i=0,s=4.15;i<6;i++,s+=.42+i*.05)swell(95,115,80,s,.32,'sawtooth',.42*(1-i*.11),620);
  }else if(event==='ability'){
   // the charge: a coughing snarl
   tone(170,90,0,.55,'sawtooth',.55,700,.02);hiss(0,.5,900,.35,.6,.01);
  }else if(event==='alarm'){swell(120,170,100,0,.7,'sawtooth',.45,800);}
  else{swell(110,140,70,0,event==='death'?.9:.5,'sawtooth',.45,600);hiss(.04,.4,420,.2);}
 }else if(species==='leopard'){
  if(event==='call'){
   // the sawing call: strokes in and out, like a saw through wood
   for(let i=0;i<9;i++){const s=i*.34,out=i%2===0;tone(out?125:150,out?100:130,s,out?.24:.17,'sawtooth',out?.45:.3,520);hiss(s,out?.24:.17,out?620:900,out?.28:.2,1.4,.02);}
  }else if(event==='ability'){
   // stalking is silent: only a breath that the stalker itself can hear up close
   hiss(0,.5,500,.06,.5,.2);
  }else{tone(220,150,0,event==='death'?.6:.35,'sawtooth',.4,800);hiss(0,.35,1100,.2);}
 }else if(species==='hyena'){
  if(event==='call'){
   // the whoop: low, rising and drawn out, repeated in a slow series
   for(let i=0;i<3;i++){const s=i*1.35;swell(210,330,560,s,1.0,'sine',.55);swell(420,660,1120,s,1.0,'triangle',.08);}
  }else if(event==='ability'){for(let i=0;i<2;i++)swell(230,330,520,i*.8,.7,'sine',.45);}
  else if(event==='death'){tone(700,300,0,.5,'sine',.5);tone(640,280,.5,.45,'sine',.35);}
  else{for(let i=0;i<5;i++)tone(520+((i*37)%60),420,i*.11,.09,'triangle',.3);}
 }else if(species==='zebra'){
  if(event==='call'||event==='alarm'){
   // the alarm opens with a hard blow through the nostrils; the bark is a braying "kwa-ha", repeated
   if(event==='alarm')hiss(0,.32,750,.55,.9,.01);
   const o=event==='alarm'?.36:0;
   for(let i=0;i<3;i++){const s=o+i*.42;tone(560,430,s,.15,'square',.22,1300,.008);hiss(s,.13,1500,.14,1.2,.01);tone(420,330,s+.17,.18,'sawtooth',.16,900,.02);hiss(s+.17,.2,900,.18,.9,.02);}
  }else if(event==='ability'){
   // the kick: a heavy thump of hooves and a squeal
   tone(95,45,0,.25,'sine',.75,0,.004);hiss(0,.08,300,.5,.7,.003);tone(900,700,.12,.3,'sawtooth',.18,1600);
  }else{tone(700,420,0,.6,'sawtooth',.3,1200);hiss(0,.5,800,.25);}
 }else if(species==='impala'){
  if(event==='alarm'||event==='call'){
   // a sharp, explosive snort (two for an alarm)
   const n=event==='alarm'?2:1;
   for(let i=0;i<n;i++){hiss(i*.28,.18,1900,.55,.9,.004);hiss(i*.28,.14,600,.3,.8,.004);tone(330,200,i*.28+.01,.09,'triangle',.15);}
  }else if(event==='ability'){
   // the leap: air rushing past, then the landing
   hiss(0,.5,2600,.22,.5,.25);tone(110,55,.62,.16,'sine',.6,0,.003);hiss(.62,.08,350,.35,.7,.003);
  }else{tone(900,520,0,.45,'triangle',.3);hiss(0,.35,1500,.2);}
 }else{
  if(event==='call'){for(let i=0;i<4;i++)tone(105+(i%2)*14,80,i*.2,.11,'square',.3,500);}
  else if(event==='alarm'){
   // a snorting grunt that runs faster as it breaks into a run
   for(let i=0,s=0;i<6;i++,s+=.2-i*.022){tone(125,85,s,.08,'square',.32,520);hiss(s,.07,700,.22,1,.005);}
  }else if(event==='ability'){
   // scrambling backwards into the burrow: soil scuffing
   for(let i=0;i<7;i++)hiss(i*.09+Math.random()*.03,.07,500+Math.random()*500,.3,1.2,.004);
  }else if(event==='death'){tone(950,620,0,.5,'square',.2,1500);tone(880,560,.45,.4,'square',.15,1400);}
  else{for(let i=0;i<3;i++)tone(110,80,i*.13,.09,'square',.3,500);}
 }
 if(event==='action'||event==='success')tone(520,760,.18,.1,'sine',.18);
}
