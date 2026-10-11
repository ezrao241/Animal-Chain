import type {Species} from './game';

export type AnimalSoundEvent='call'|'action'|'success'|'ability'|'death';

const noiseBuffers=new WeakMap<AudioContext,AudioBuffer>();

function noiseBuffer(context:AudioContext){
 let buffer=noiseBuffers.get(context);
 if(!buffer){
  buffer=context.createBuffer(1,context.sampleRate,context.sampleRate);
  const samples=buffer.getChannelData(0);
  for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
  noiseBuffers.set(context,buffer);
 }
 return buffer;
}

export function playAnimalSound(context:AudioContext,species:Species,event:AnimalSoundEvent,volume:number,pan=0){
 if(context.state==='suspended')void context.resume().catch(()=>{});
 const now=context.currentTime,output=context.createGain(),stereo=context.createStereoPanner();
 output.gain.setValueAtTime(Math.max(.001,Math.min(.22,volume)),now);
 stereo.pan.setValueAtTime(Math.max(-1,Math.min(1,pan)),now);
 output.connect(stereo);stereo.connect(context.destination);
 const pitch=event==='death'?.78:event==='ability'?1.12:1;
 const duration=event==='ability'?.5:event==='death'?.4:.3;
 const tone=(from:number,to:number,offset:number,length:number,wave:OscillatorType='sine',level=.55)=>{
  const oscillator=context.createOscillator(),envelope=context.createGain(),start=now+offset;
  oscillator.type=wave;oscillator.frequency.setValueAtTime(from*pitch,start);oscillator.frequency.exponentialRampToValueAtTime(Math.max(1,to*pitch),start+length);
  envelope.gain.setValueAtTime(.001,start);envelope.gain.linearRampToValueAtTime(level,start+.012);envelope.gain.exponentialRampToValueAtTime(.001,start+length);
  oscillator.connect(envelope);envelope.connect(output);oscillator.start(start);oscillator.stop(start+length+.015);
 };
 const hiss=(offset:number,length:number,center:number,level=.3)=>{
  const source=context.createBufferSource(),filter=context.createBiquadFilter(),envelope=context.createGain(),start=now+offset;
  source.buffer=noiseBuffer(context);filter.type='bandpass';filter.frequency.setValueAtTime(center,start);filter.Q.setValueAtTime(.8,start);
  envelope.gain.setValueAtTime(.001,start);envelope.gain.linearRampToValueAtTime(level,start+.025);envelope.gain.exponentialRampToValueAtTime(.001,start+length);
  source.connect(filter);filter.connect(envelope);envelope.connect(output);source.start(start);source.stop(start+length+.02);
 };

 if(species==='owl'){
  tone(event==='death'?340:420,event==='death'?245:320,0,.23,'triangle',.65);
  tone(event==='ability'?360:315,event==='ability'?285:245,.23,.25,'triangle',.58);
 }else if(species==='fox'){
  tone(event==='death'?470:590,event==='death'?280:860,0,.18,'triangle',.62);
  tone(430,650,.18,.15,'sine',.42);
 }else if(species==='snake'){
  hiss(0,duration*1.15,event==='death'?900:1450,.42);
  if(event==='ability'||event==='success')tone(190,125,.08,.2,'triangle',.2);
 }else if(species==='squirrel'){
  tone(1050,820,0,.075,'square',.24);
  tone(940,1180,.09,.07,'square',.22);
  tone(1100,760,.19,.09,'triangle',.25);
 }else if(species==='mouse'){
  tone(1380,980,0,.075,'sine',.35);
  tone(1620,1190,.11,.09,'sine',.3);
  if(event==='death')tone(1050,700,.2,.13,'sine',.3);
 }else{
  tone(event==='death'?620:820,event==='death'?390:1120,0,.11,'sine',.35);
  tone(740,940,.13,.11,'sine',.3);
 }
 if(event==='action'||event==='success')tone(species==='owl'?680:species==='snake'?210:520, species==='owl'?860:species==='snake'?170:760,duration*.55,.1,'sine',.18);
}
