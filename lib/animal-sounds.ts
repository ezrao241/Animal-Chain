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

 if(species==='lion'){
  // a rolling roar: a low sawtooth swell with a rasp of breath on top
  tone(event==='death'?120:150,event==='death'?70:95,0,event==='ability'?.75:.5,'sawtooth',.5);
  hiss(.04,event==='ability'?.65:.4,420,.22);
 }else if(species==='leopard'){
  // the sawing call: short rasping coughs
  for(let i=0;i<(event==='ability'?2:4);i++){tone(190,140,i*.16,.11,'sawtooth',.36);hiss(i*.16,.1,700,.2);}
 }else if(species==='hyena'){
  // the rising whoop
  tone(event==='death'?520:260,event==='death'?240:640,0,.42,'sine',.55);
  if(event!=='death')tone(300,720,.45,.35,'sine',.38);
 }else if(species==='zebra'){
  // a barking bray
  tone(520,380,0,.12,'square',.25);tone(470,620,.13,.12,'square',.22);tone(520,360,.27,.14,'square',.22);
 }else if(species==='impala'){
  // an alarm snort
  hiss(0,.16,1800,.4);tone(330,220,.02,.1,'triangle',.22);
 }else{
  // warthog grunts
  for(let i=0;i<3;i++)tone(event==='death'?150:110,80,i*.13,.09,'square',.3);
 }
 if(event==='action'||event==='success')tone(520,760,duration*.55,.1,'sine',.18);
}
