// The in-round soundscape, synthesised in the page (no audio files). The world scene hands it one frame a render: where
// the player's animal is and which way the camera looks, the time of day, and the animals nearby. From that it plays
// - the beds: wind and grass (stronger by day), cicadas in the heat of the day, crickets at night, frogs near water;
// - the birds and far calls of the hour: ring-necked doves by day, the fiery-necked nightjar at dusk and night, and
//   lions and hyenas calling from beyond the map at night (both call mostly in the dark, lions most just before dawn);
// - footsteps for the player's animal and anything walking near it (hooves click, the cats' soft pads barely show);
// - the player's own animal: panting when its sprint is spent, eating, lapping water.
// What each sound is modelled on is in docs/wildlife-sources.md "Sounds".
import type {Species} from './game';
import {noiseBuffer,playAnimalSound,soundBus,voiceKit,voiceOutput,type AnimalSoundEvent} from './animal-sounds';

export type AudioAnimal={id:string;species:Species;x:number;y:number;speed:number;onGround:boolean;quiet:boolean};
export type AudioFrame={
 /** the listener: the player's animal (game units) and the camera's yaw, which sets left and right */
 x:number;y:number;yaw:number;
 hour:number;day:number;moonlight:number;
 /** metres to the nearest watering hole's edge */
 water:number;
 own:AudioAnimal&{stamina:number;feeding:boolean;drinks:number;dead:boolean};
 animals:AudioAnimal[];
};

const MASS:Record<Species,number>={lion:190,leopard:60,hyena:60,zebra:300,impala:55,warthog:75};
const HOOVED:Record<Species,boolean>={lion:false,leopard:false,hyena:false,zebra:true,impala:true,warthog:true};
/** speed (m/s) at which the footfalls bunch into a gallop's four-beat rhythm */
const GALLOP:Record<Species,number>={lion:6,leopard:5.5,hyena:5,zebra:6.5,impala:6,warthog:5};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const smooth=(a:number,b:number,v:number)=>{const k=clamp((v-a)/(b-a),0,1);return k*k*(3-2*k);};

/** Where a sound at (x, y) sits for the listener: stereo pan from the camera's view, level and the air's dulling. */
export function placeSound(frame:{x:number;y:number;yaw:number},x:number,y:number,reach=360){
 const dx=x-frame.x,dy=y-frame.y,range=Math.hypot(dx,dy),angle=Math.atan2(dx,dy)-frame.yaw-Math.PI;
 // the same bearing the tracking arrow uses: a negative angle is to the right of the screen
 const pan=range<15?0:-Math.sin(angle)*clamp(range/60,0,.85),behind=Math.cos(angle)<0?.8:1;
 return{pan,level:clamp(1-range/reach,0,1)**1.4*behind,far:clamp(range/reach,0,1)*.7,range};
}

export class FieldAudio{
 private bed:GainNode;private fx:GainNode;private sources:AudioScheduledSourceNode[]=[];private stopped=false;
 private wind:GainNode;private windBand:BiquadFilterNode;private grass:GainNode;private rush:GainNode;private cicadas:GainNode;private crickets:GainNode;
 private steps=new Map<string,{phase:number;seen:number}>();
 private lastAt=0;private nextGust=0;private gust=.5;private nextCicada=0;private nextBird=0;private nextNight=0;private nextFar=0;private nextFrog=0;private nextPant=0;private nextBite=0;private drinks=-1;private cicadaUntil=0;
 constructor(private ctx:AudioContext){
  const bus=soundBus(ctx);
  this.bed=ctx.createGain();this.bed.gain.value=0;this.bed.connect(bus.ambience);this.bed.gain.linearRampToValueAtTime(1,ctx.currentTime+2.5);
  this.fx=ctx.createGain();this.fx.connect(bus.effects);
  // a slow, rumbling noise for the wind and a bright one for grass
  const len=ctx.sampleRate*4,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);let b=0;
  for(let i=0;i<len;i++){b=.985*b+.015*(Math.random()*2-1);d[i]=b*5;}
  const brown=this.loop(buf),white=this.loop(noiseBuffer(ctx));
  this.windBand=ctx.createBiquadFilter();this.windBand.type='bandpass';this.windBand.frequency.value=380;this.windBand.Q.value=.5;
  this.wind=this.gain(0);brown.connect(this.windBand);this.windBand.connect(this.wind);this.wind.connect(this.bed);
  const leaves=ctx.createBiquadFilter();leaves.type='bandpass';leaves.frequency.value=3600;leaves.Q.value=.6;
  this.grass=this.gain(0);white.connect(leaves);leaves.connect(this.grass);this.grass.connect(this.bed);
  // air past the ears at a sprint
  const air=ctx.createBiquadFilter();air.type='bandpass';air.frequency.value=900;air.Q.value=.4;
  this.rush=this.gain(0);brown.connect(air);air.connect(this.rush);this.rush.connect(this.bed);
  // cicadas: a narrow band of noise buzzed at a fast pulse, swelling in waves
  const shrill=ctx.createBiquadFilter();shrill.type='bandpass';shrill.frequency.value=6400;shrill.Q.value=7;
  const buzz=this.gain(.5),pulse=ctx.createOscillator(),pulseDepth=this.gain(.5);pulse.type='square';pulse.frequency.value=92;pulse.connect(pulseDepth);pulseDepth.connect(buzz.gain);pulse.start();this.sources.push(pulse);
  this.cicadas=this.gain(0);white.connect(shrill);shrill.connect(buzz);buzz.connect(this.cicadas);this.cicadas.connect(this.bed);
  // crickets: two singers, each a high tone in quick trills grouped into chirps, a little apart in the stereo field
  this.crickets=this.gain(0);this.crickets.connect(this.bed);
  for(const [freq,trill,chirp,side] of [[4400,30,2.1,-.5],[3700,24,1.4,.55]] as const){
   const tone=ctx.createOscillator(),gate=this.gain(.5),trillOsc=ctx.createOscillator(),trillDepth=this.gain(.5),group=this.gain(.5),chirpOsc=ctx.createOscillator(),chirpDepth=this.gain(.5),pan=ctx.createStereoPanner();
   tone.frequency.value=freq;trillOsc.type='square';trillOsc.frequency.value=trill;chirpOsc.type='square';chirpOsc.frequency.value=chirp;pan.pan.value=side;
   trillOsc.connect(trillDepth);trillDepth.connect(gate.gain);chirpOsc.connect(chirpDepth);chirpDepth.connect(group.gain);
   tone.connect(gate);gate.connect(group);group.connect(pan);pan.connect(this.crickets);tone.start();trillOsc.start();chirpOsc.start();this.sources.push(tone,trillOsc,chirpOsc);
  }
 }
 private gain(v:number){const g=this.ctx.createGain();g.gain.value=v;return g;}
 private loop(buffer:AudioBuffer){const s=this.ctx.createBufferSource();s.buffer=buffer;s.loop=true;s.start(0,Math.random()*buffer.duration);this.sources.push(s);return s;}
 private set(node:GainNode|BiquadFilterNode,param:'gain'|'frequency',value:number,time=.4){(node as GainNode&BiquadFilterNode)[param].setTargetAtTime(value,this.ctx.currentTime,time);}

 /** one render's worth of world: call it every frame while a round is on */
 frame(f:AudioFrame){
  if(this.stopped)return;
  const ctx=this.ctx,ms=performance.now(),dt=this.lastAt?Math.min(.25,(ms-this.lastAt)/1000):0;this.lastAt=ms;
  const night=1-f.day,heat=f.day*smooth(9,12,f.hour)*(1-smooth(16.5,18.5,f.hour)),own=f.own;
  // beds: afternoon breezes, still nights (the same gusts sway the grass)
  if(ms>=this.nextGust){this.gust=.25+Math.random()*.75;this.nextGust=ms+2500+Math.random()*4000;this.set(this.windBand,'frequency',300+this.gust*260,1.5);}
  const breeze=(.022+.03*f.day+.01*heat)*(.55+this.gust*.45);
  this.set(this.wind,'gain',breeze,1.2);
  const brushing=own.dead||!own.onGround?0:clamp(own.speed/8,0,1);
  this.set(this.grass,'gain',.006+.012*this.gust*(.4+f.day*.6)+.02*brushing,.3);
  this.set(this.rush,'gain',own.dead?0:.05*smooth(10,20,own.speed),.25);
  this.set(this.crickets,'gain',.0065*smooth(.35,.95,night),2);
  // cicadas sing in waves through the hot hours and fall quiet in the cool
  if(ms>=this.nextCicada){const on=Math.random()<heat*1.1;this.cicadaUntil=on?ms+3000+Math.random()*5000:0;this.nextCicada=ms+(on?7000:4000)+Math.random()*9000;}
  this.set(this.cicadas,'gain',ms<this.cicadaUntil?.009*heat:0,ms<this.cicadaUntil?1.4:.9);
  // the birds and calls of the hour
  if(ms>=this.nextBird){this.nextBird=ms+6000+Math.random()*9000;if(f.day>.5){if(Math.random()<.55)this.dove();else this.whistle();}}
  if(ms>=this.nextNight){this.nextNight=ms+9000+Math.random()*12000;if(f.day<.55&&f.day>.02||night>.95&&Math.random()<.5)this.nightjar();}
  if(ms>=this.nextFar){
   this.nextFar=ms+16000+Math.random()*16000;
   // lions roar most in the dark and most of all before dawn; hyenas whoop through the night; both rest by day
   const predawn=smooth(1,3,f.hour)*(1-smooth(5.5,7,f.hour)),lion=night*(.35+.5*predawn),hyena=night*.45;
   const roll=Math.random(),pan=Math.random()*1.6-.8;
   if(roll<lion)playAnimalSound(ctx,'lion','call',.08,pan,.85);else if(roll<lion+hyena)playAnimalSound(ctx,'hyena','call',.05,pan,.8);
  }
  if(f.water<70&&ms>=this.nextFrog){this.nextFrog=ms+1500+Math.random()*3500;if(night>.4||Math.random()<.15)this.frogs(1-f.water/70);}
  // footsteps: the player's own animal and anything walking within earshot
  const heard=[own,...f.animals];
  for(const a of heard){
   const self=a===own;if(!a.onGround||a.quiet&&!self||self&&own.dead)continue;
   const place=self?{pan:0,level:1,far:0,range:0}:placeSound(f,a.x,a.y,420);if(!self&&place.level<=0)continue;
   let s=this.steps.get(a.id);if(!s)this.steps.set(a.id,s={phase:Math.random(),seen:ms});s.seen=ms;
   if(a.speed<.35){s.phase=.6;continue;}
   const galloping=a.speed>GALLOP[a.species],size=(75/MASS[a.species])**.12;
   // footfalls per second for a walk or trot; a gallop is counted in strides, each one four quick hoof beats
   const rate=galloping?(1.5+a.speed*.05)*size:2*(.8+.55*Math.sqrt(a.speed))*size;
   s.phase+=dt*rate;
   if(s.phase>=1){s.phase-=Math.floor(s.phase);const level=(self?.55:.5)*place.level*clamp(.35+a.speed/12,0,1);
    if(galloping)for(let i=0;i<4;i++)this.footfall(a.species,level*(i===3?1:.75),place.pan,place.far,i*.045);else this.footfall(a.species,level,place.pan,place.far,0);}
  }
  for(const [id,s]of this.steps)if(ms-s.seen>3000)this.steps.delete(id);
  // the player's own animal: panting when spent, eating, drinking
  if(!own.dead&&own.stamina<35&&ms>=this.nextPant){const hard=1-own.stamina/35;this.nextPant=ms+380-hard*120;this.pant(hard);}
  if(!own.dead&&own.feeding&&ms>=this.nextBite){this.nextBite=ms+(HOOVED[own.species]?520:420)+Math.random()*300;this.bite(own.species);}
  if(this.drinks>=0&&own.drinks>this.drinks)this.lap();this.drinks=own.drinks;
 }

 /** a sound placed in the world: animal calls, alarms and abilities, panned and dulled by distance */
 call(f:{x:number;y:number;yaw:number},species:Species,event:AnimalSoundEvent,x:number,y:number,loud=1){
  if(this.stopped)return;const p=placeSound(f,x,y,event==='call'?700:event==='alarm'?520:380);if(p.level<=0)return;
  playAnimalSound(this.ctx,species,event,Math.max(.012,.16*loud*p.level),p.pan,p.far);
 }

 private footfall(species:Species,level:number,pan:number,far:number,offset:number){
  if(level<.003)return;const out=voiceOutput(this.ctx,level*.5,pan,far,this.fx),{tone,hiss}=voiceKit(this.ctx,out),heavy=MASS[species]/300;
  const at=(o:number)=>offset+o;
  if(HOOVED[species]){
   // hard hooves on dry ground: a click and a thud, deeper for a heavier animal
   hiss(at(0),.035,1700+Math.random()*700,.5,1.6,.002);tone(150-heavy*70,60,at(0),.09,'sine',.35+heavy*.4,0,.003);hiss(at(.01),.1,3800,.12,.7,.01);
  }else{
   // soft pads: a muffled press and the grass it moves
   hiss(at(0),.07,260+Math.random()*120,.28,.8,.008);hiss(at(.01),.12,3200,.08,.6,.02);
  }
 }
 private dove(){
  // the ring-necked dove's three-note "work HAR-der", repeated a few times from somewhere in the bush
  const out=voiceOutput(this.ctx,.03+Math.random()*.02,Math.random()*1.6-.8,.3,this.bed),{tone}=voiceKit(this.ctx,out,.92+Math.random()*.16);
  for(let r=0,s=0;r<2+Math.floor(Math.random()*3);r++,s+=1.15){tone(520,500,s,.16,'sine',.5,0,.03);tone(600,560,s+.22,.42,'sine',.6,0,.05);tone(500,470,s+.7,.2,'sine',.45,0,.03);}
 }
 private whistle(){
  const out=voiceOutput(this.ctx,.02,Math.random()*1.6-.8,.2,this.bed),{tone}=voiceKit(this.ctx,out),base=1800+Math.random()*1400,notes=2+Math.floor(Math.random()*3);
  for(let i=0;i<notes;i++)tone(base*(1+i*.12),base*(1.25+i*.1),i*.16,.13,'sine',.8,0,.02);
 }
 private nightjar(){
  // the fiery-necked nightjar's mellow, falling "good-lord-de-liv-er-us", ending in a quick tremble
  const out=voiceOutput(this.ctx,.028,Math.random()*1.6-.8,.35,this.bed),{tone}=voiceKit(this.ctx,out,.95+Math.random()*.1);
  const notes=[[1180,1150,.22],[1240,1200,.32],[1100,1060,.16],[1060,1020,.16],[1000,960,.16]] as const;let s=0;
  for(const [a,b,l] of notes){tone(a,b,s,l,'sine',.7,0,.03);s+=l+.08;}
  for(let i=0;i<7;i++)tone(980-i*12,950-i*12,s+i*.05,.045,'sine',.45,0,.008);
 }
 private frogs(near:number){
  // reed frogs at the water's edge: short, bright plinks in little clusters
  const out=voiceOutput(this.ctx,.018*near,Math.random()*1.4-.7,.2,this.bed),{tone}=voiceKit(this.ctx,out);
  const base=2100+Math.random()*900;for(let i=0;i<2+Math.floor(Math.random()*4);i++)tone(base,base*.94,i*.17+Math.random()*.04,.05,'sine',.8,0,.003);
 }
 private pant(hard:number){
  const out=voiceOutput(this.ctx,.035+.04*hard,0,0,this.fx),{hiss}=voiceKit(this.ctx,out);hiss(0,.16,900,.6,.7,.04);hiss(.19,.14,1300,.45,.7,.04);
 }
 private bite(species:Species){
  const out=voiceOutput(this.ctx,.06,(Math.random()-.5)*.3,0,this.fx),{hiss,tone}=voiceKit(this.ctx,out);
  // grazers crop grass with a crisp tearing pull; the meat-eaters tear and crunch
  if(HOOVED[species]){hiss(0,.09,2800,.5,1.2,.005);hiss(.1,.07,3400,.35,1.2,.005);}
  else{hiss(0,.14,700,.6,.9,.01);if(Math.random()<.5)tone(180,90,.05,.06,'square',.25,900,.003);hiss(.16,.06,1500,.4,1.5,.004);}
 }
 private lap(){
  const out=voiceOutput(this.ctx,.05,0,0,this.fx),{hiss,tone}=voiceKit(this.ctx,out);
  for(let i=0;i<7;i++){const s=i*.3;tone(700,1300,s,.05,'sine',.35,0,.004);hiss(s,.06,2200,.3,2,.004);}
 }
 stop(){
  if(this.stopped)return;this.stopped=true;const t=this.ctx.currentTime;
  this.bed.gain.cancelScheduledValues(t);this.bed.gain.setValueAtTime(this.bed.gain.value,t);this.bed.gain.linearRampToValueAtTime(0,t+.6);
  setTimeout(()=>{this.sources.forEach(n=>{try{n.stop();}catch{}});try{this.bed.disconnect();this.fx.disconnect();}catch{}},800);
 }
}
