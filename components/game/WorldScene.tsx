'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {createRenderer,SoftwareRenderer} from './software-renderer';
import {cameraInput,ANIMALS,SPECIES,Species,Room,Player,W,H,props,makeFoods,move,newPlayer,dist,solidNear,solidRadius,sense,wind,headDown,canClimb,sightBlocked,idHash,FOOD_RANGE,lightAt,isPredator,postureOf,worldEvent,fireEdge,FIRE,type Posture} from '@/lib/game';
import {climberPose,climberFeet} from './climb-pose';
import {SafariTraces} from './safari-traces';
import {makeSafariAnimal,animateSafari,SafariRig,animalPortrait,cameraProfile} from './safari-animals';
import {createSavanna,groundY,SUN_DIRECTION} from './savanna-world';
import {WorldEffects} from './world-effects';
import {FoodField} from './safari-food';
import {AnimalBatches} from './animal-batches';
import {MenuCinema} from './menu-cinema';
import type {FieldAudio} from '@/lib/savanna-audio';
import {coatOf} from '@/lib/rewards';
export type GraphicsMode='auto'|'performance'|'balanced'|'high';
export type PerformanceStats={fps:number;renderMs:number;renderer:string;quality:string;drawCalls:number};
/** each real player's tag and minimap colour, stable for the player */
const PLAYER_COLOURS=['#9fd4ff','#ffb3c7','#c8f59a','#ffd68a','#d6b8ff','#8ff0dc','#ffc29e','#f5f0a0'];
const playerColour=(id:string)=>PLAYER_COLOURS[Math.floor(idHash(id)*PLAYER_COLOURS.length)];
export type WorldRoom=Omit<Room,'players'>&{serverTime:number;_received?:number;_transitMs?:number;players:(Player&{online:boolean;concealed:boolean})[]};
// moveYaw is the camera yaw that movement is read against. It is latched while a direction is held, so the camera can
// swing round behind a turning animal without the held key suddenly meaning a different way.
/** `?graphics=performance|balanced|high` pins the quality tier (for testing and for players who want to choose) */
const forcedGraphics=(():GraphicsMode|undefined=>{try{const g=new URLSearchParams(location.search).get('graphics');return g==='performance'||g==='balanced'||g==='high'?g:undefined;}catch{return undefined;}})();
export type WorldInput={posture?:Posture;dx:number;dy:number;interact:boolean;ability:boolean;perch:boolean;sprint:boolean;cameraYaw:number;moveYaw?:number;instinct?:boolean;recenter?:boolean;graphics?:GraphicsMode;claim?:{x:number;y:number;vx:number;vy:number;born:number;at:number}};
export function ModelPortrait({species,size=70,coat=0}:{species:Species;size?:number;coat?:number}){const [src,setSrc]=useState('');useEffect(()=>{setSrc(animalPortrait(species,coat));},[species,coat]);return src?<img className="portrait" src={src} alt={ANIMALS[species].name} width={size} height={size}/>:<span className="portrait-loading" style={{width:size,height:size}} aria-label={ANIMALS[species].name}>{ANIMALS[species].name.slice(0,1)}</span>;}
// preview is the home screen backdrop: focus holds its camera on one species, onShot reports which species is on screen
export default function WorldScene({room,me,input,preview=false,focus=null,onShot,onPerformance,sound}:{room:WorldRoom|null;me:Player|undefined;input:React.RefObject<WorldInput>;preview?:boolean;focus?:Species|null;onShot?:(species:Species|null)=>void;onPerformance?:(stats:PerformanceStats)=>void;sound?:FieldAudio|null}){
 const host=useRef<HTMLDivElement>(null),latest=useRef({room,me,focus,onShot,onPerformance,sound});latest.current={room,me,focus,onShot,onPerformance,sound};const [failure,setFailure]=useState(''),[software,setSoftware]=useState(false);
 useEffect(()=>{
  if(!host.current)return;const element=host.current;let renderer:THREE.WebGLRenderer|SoftwareRenderer;
  try{renderer=createRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{setFailure('3D rendering is unavailable. Enable graphics acceleration and reload.');return;}
  const lightweight=renderer instanceof SoftwareRenderer;setSoftware(lightweight);let pixelRatio=lightweight?.7:1;
  renderer.setPixelRatio(pixelRatio);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.enabled=false;renderer.shadowMap.type=THREE.PCFSoftShadowMap;if(renderer instanceof THREE.WebGLRenderer)renderer.shadowMap.autoUpdate=false;
  const canvas=renderer.domElement;canvas.setAttribute('aria-label',preview?'Live Golden Plains savanna preview with animated animals':'3D Golden Plains savanna. WASD moves relative to camera. Drag to look. Shift sprints, E interacts, Space uses ability, F toggles instincts, R centers camera.');canvas.tabIndex=preview?-1:0;element.appendChild(canvas);
  const overlay=document.createElement('canvas');overlay.className='world-labels';element.appendChild(overlay);const ctx=overlay.getContext('2d')!;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xd2dad8);scene.fog=new THREE.Fog(0xcbd3d1,340,800);const camera=new THREE.PerspectiveCamera(61,1,1.8,1000);
  // late-morning light: a near-white sun, blue skylight filling the shade, warm bounce off the dry grass
  const sky=new THREE.HemisphereLight(0xb9d3ef,0x8f805c,1.2);scene.add(sky);const sun=new THREE.DirectionalLight(0xfff0d8,2.8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-400,right:400,top:400,bottom:-400,near:10,far:1700});sun.shadow.bias=-.0003;sun.shadow.intensity=.78;sun.shadow.normalBias=1.5;sun.shadow.camera.updateProjectionMatrix();scene.add(sun,sun.target);
  const rim=new THREE.DirectionalLight(0x9fc0e6,.35);rim.position.set(400,200,500);scene.add(rim);
  // Day and night (lib/game.ts lightAt): the key light is the sun by day and the moon (or faint starlight from overhead)
  // at night. Exposure stands in for the eyes of the animal you play: after dark a lion, leopard or hyena sees the
  // moonlit plain well (eyes built for low light), a grazer sees it darker.
  const keyDir=SUN_DIRECTION.clone(),sunV=new THREE.Vector3(),moonV=new THREE.Vector3(),overhead=new THREE.Vector3(.2,.95,.25).normalize(),dayFog=new THREE.Color(0xcbd3d1),dayBg=new THREE.Color(0xd2dad8),emberFog=new THREE.Color(0xd8a47a),nightFog=new THREE.Color(0x111a2c),warm=new THREE.Color(0xffa65c),moonCol=new THREE.Color(0xa9bde6);let lastLight=-1e9,dayLevel=1;
  const smoothK=(a:number,b:number,v:number)=>{const k=THREE.MathUtils.clamp((v-a)/(b-a),0,1);return k*k*(3-2*k);};
  const daylight=(room:Room|null|undefined,now:number,me:Player|null|undefined)=>{
   const l=lightAt(room||{started:0,seed:417,round:0},now),toMap=(v:{east:number;north:number;up:number},out:THREE.Vector3)=>out.set(v.east,v.up,-v.north).normalize();
   toMap(l.sun,sunV);toMap(l.moon,moonV);const up=sunV.y,ember=smoothK(-.2,.02,up)*(1-smoothK(.05,.4,up)),night=1-l.day;
   savanna.daylight(sunV,moonV,l.day,l.moonlight);
   dayLevel=l.day;const sunUp=smoothK(-.02,.25,up);keyDir.copy(up>.0?sunV:moonV.y>.05?moonV:overhead);
   sun.color.set(0xfff0d8).lerp(warm,ember);if(up<=0)sun.color.copy(moonCol);sun.intensity=up>0?2.8*sunUp+.2:.12+.6*l.moonlight;
   sky.color.set(0xb9d3ef).lerp(moonCol,night*.6);sky.groundColor.set(0x8f805c).lerp(new THREE.Color(0x2a2a30),night*.8);sky.intensity=1.2*l.day+(1-l.day)*(.5+.35*l.moonlight);
   rim.intensity=.35+.25*night;
   const fog=dayFog.clone().lerp(nightFog,night).lerp(emberFog,ember*.7);if(scene.fog instanceof THREE.Fog)scene.fog.color.copy(fog);(scene.background as THREE.Color).copy(dayBg).lerp(nightFog,night).lerp(emberFog,ember*.7);
   shadowMat.opacity=.22*(.3+.7*sunUp);
   renderer.toneMappingExposure=1+night*(me&&isPredator(me.species)?.55:-.05);
  };
  const savanna=createSavanna(scene,lightweight),ps=props(417),waters=ps.filter(t=>t.kind==='water'),previewFoods=makeFoods(417),food=new FoodField(scene),traces=new SafariTraces(scene,groundY,lightweight),effects=new WorldEffects(scene,savanna,lightweight);
  const rigs=new Map<string,SafariRig>(),positions=new Map<string,Player>(),shadows=new Map<string,THREE.Mesh>(),shadowGeo=new THREE.CircleGeometry(1,20),shadowShift={x:-SUN_DIRECTION.x/SUN_DIRECTION.y*5,z:-SUN_DIRECTION.z/SUN_DIRECTION.y*5},shadowMat=new THREE.MeshBasicMaterial({color:0x0b1913,transparent:true,opacity:.22,depthWrite:false});
  const animalBatches=lightweight?null:new AnimalBatches(scene);
  const solidNearCamera=(x:number,z:number,range:number)=>solidNear(ps,x,z,range).filter(t=>Math.abs(t.x-x)<range&&Math.abs(t.y-z)<range);
  const cinema=preview?new MenuCinema():null,demo=cinema?.players||[];let shownShot:Species|null|undefined;
  // the menu backdrop is graded to late golden hour: lower, redder sun, cooler sky fill and a warm haze
  if(preview){sun.color.set(0xffa65c);sun.intensity=3.4;rim.color.set(0x8f9be0);rim.intensity=.7;renderer.toneMappingExposure=1.18;scene.traverse(o=>{if(o instanceof THREE.HemisphereLight){o.color.set(0xb7b9e0);o.groundColor.set(0x9a6a3e);o.intensity=1.15;}});savanna.dusk();scene.background=new THREE.Color(0xd9a77a);(scene.fog as THREE.Fog).color.set(0xd8a47a);}
  let width=0,height=0,last=performance.now(),lastPreviewFrame=0,lastTraceFrame=0,yaw=0,pitch=.24,distance=155,shownDistance=0,dragging=false,lastX=0,lastY=0,ownHeading=Math.PI/2,first=true,ownBorn=0,frameCost=16,dragPointer=-1,lastLook=-1e9,yawVel=0,recentering=false,eyeHeight=0,camY=NaN,latchKey='',moveYaw=0,ownFix:number|undefined,rejoinUntil=0,lastServerTime=0,updateGap=.2,reach=.3;
  const follow=new THREE.Vector3(1600,20,820),target=new THREE.Vector3(),projected=new THREE.Vector3(),view=new THREE.Vector3();
  const qualityCaps={high:1.5,balanced:1.12,performance:.78};
  const resize=()=>{const bounds=element.getBoundingClientRect();width=bounds.width;height=bounds.height;if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();overlay.width=Math.round(width);overlay.height=Math.round(height);};
  const observer=new ResizeObserver(resize);observer.observe(element);resize();input.current.cameraYaw=yaw;
  let sampleStart=performance.now(),sampleFrames=0,sampleWork=0,lastOverlay=0,lastShadow=0,slowSamples=0,autoTier:'balanced'|'performance'='performance',activeTier='',drawRange=800,nextAmbientAt=performance.now()+3500;
  const animalStates=new Map<string,{actionUntil:number;abilityUntil:number;deadUntil:number;calledAt:number}>();
  let soundRoomCode='';
  // one finger (or the mouse) looks around; a second finger on the canvas is ignored so look never jumps
  const down=(e:PointerEvent)=>{if(preview||dragging)return;dragging=true;dragPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});};
  const drag=(e:PointerEvent)=>{if(!dragging||e.pointerId!==dragPointer)return;recentering=false;yaw-=(e.clientX-lastX)*.005;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastY)*.003,-.06,.62);lastX=e.clientX;lastY=e.clientY;lastLook=performance.now();input.current.cameraYaw=yaw;};
  const up=(e:PointerEvent)=>{if(e.pointerId===dragPointer){dragging=false;dragPointer=-1;}};const wheel=(e:WheelEvent)=>{if(preview)return;e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.12,95,260);};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',drag);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});
  const render=(ms:number)=>{
   if(preview&&ms-lastPreviewFrame<1000/30)return;
   if(preview)lastPreviewFrame=ms;
   const raw=Math.max(0,(ms-last)/1000),dt=Math.min(.075,raw);last=ms;if(!width||!height)return;
   const mode=input.current.graphics||forcedGraphics||'auto';
   const time=ms/1000,{room:r,me:m}=latest.current;
   // Other animals are carried forward along their last reported velocity until the next update, at most about one
   // update interval (measured: a slow connection updates less often), so they keep moving smoothly between updates
   // without running far past an animal that has just stopped.
   if(r&&r.serverTime!==lastServerTime){if(lastServerTime&&r.serverTime>lastServerTime)updateGap+=(Math.min(1,(r.serverTime-lastServerTime)/1000)-updateGap)*.2;lastServerTime=r.serverTime;reach=THREE.MathUtils.clamp(updateGap*1.25,.15,.6);}
   cinema?.animate(time);const now=r?Date.now()+r.serverTime-(r._received||Date.now())+(r._transitMs||0):Date.now(),lag=r?Math.min(reach,Math.max(0,(now-r.serverTime)/1000)):0,players=r?.players||demo,ids=new Set(players.map(p=>p.id));
   if(r?.code!==soundRoomCode){animalStates.clear();soundRoomCode=r?.code||'';}
   const tier=lightweight||preview?'performance':mode==='auto'?autoTier:mode;
   const lowBudget=tier==='performance'&&mode!=='high'&&lightweight;
   if(tier!==activeTier){activeTier=tier;pixelRatio=lightweight?0.7:Math.min(window.devicePixelRatio||1,qualityCaps[tier] ?? 1.12);renderer.setPixelRatio(pixelRatio);renderer.shadowMap.enabled=!lightweight&&tier==='high';savanna.realShadows(renderer.shadowMap.enabled);drawRange=lightweight?520:tier==='high'?1050:tier==='performance'?620:800;if(scene.fog instanceof THREE.Fog){scene.fog.near=drawRange*.55;scene.fog.far=drawRange;}camera.far=drawRange+180;resize();}
   const audio=latest.current.sound;
   if(!preview&&m&&r?.phase==='playing'&&audio){
    const ear={x:(positions.get(m.id)||m).x,y:(positions.get(m.id)||m).y,yaw};
    for(const p of players){
     const previous=animalStates.get(p.id);
     animalStates.set(p.id,{actionUntil:p.actionUntil,abilityUntil:p.abilityUntil,deadUntil:p.deadUntil,calledAt:p.calledAt||0});
     if(!previous)continue;
     const at=positions.get(p.id)||p;
     if(p.deadUntil>now&&p.deadUntil!==previous.deadUntil)audio.call(ear,p.species,'death',at.x,at.y);
     else if(p.abilityUntil>now&&p.abilityUntil!==previous.abilityUntil)audio.call(ear,p.species,'ability',at.x,at.y,.8);
     // an alarm call: the snort or bark of an animal that has just spotted danger (direction only, from stereo pan)
     else if(p.calledAt&&p.calledAt!==previous.calledAt&&now-p.calledAt<1500)audio.call(ear,p.species,'alarm',at.x,at.y,1.1);
     else if(p.id===m.id&&p.actionUntil>now&&p.actionUntil!==previous.actionUntil)audio.call(ear,p.species,p.message.includes('+')?'success':'action',at.x,at.y,.7);
    }
    // now and then an animal within earshot calls: a lion's roaring bout, a leopard sawing, a hyena's whoop
    if(ms>=nextAmbientAt){
     const nearby=players.filter(p=>p.id!==m.id&&!p.deadUntil&&dist(m,p)<600&&!(p.species==='leopard'&&p.abilityUntil>now));
     if(nearby.length){const animal=nearby[Math.floor(Math.random()*nearby.length)],at=positions.get(animal.id)||animal;audio.call(ear,animal.species,'call',at.x,at.y,.7);}
     nextAmbientAt=ms+7000+Math.random()*6000;
    }
    const light=lightAt(r,now),own=positions.get(m.id)||m,speedOf=(q:Player)=>Math.hypot(q.vx||0,q.vy||0)/10;
    let water=1e9;for(const w of waters)water=Math.min(water,(Math.hypot(w.x-own.x,w.y-own.y)-w.size)/10);
    const heard=[];for(const p of players){if(p.id===m.id||p.deadUntil)continue;const at=positions.get(p.id)||p;if(Math.abs(at.x-own.x)<420&&Math.abs(at.y-own.y)<420)heard.push({id:p.id,species:p.species,x:at.x,y:at.y,speed:speedOf(at),onGround:!p.perched&&!(p.species==='warthog'&&p.abilityUntil>now),quiet:p.species==='leopard'&&p.abilityUntil>now});}
    heard.sort((a,b)=>Math.hypot(a.x-own.x,a.y-own.y)-Math.hypot(b.x-own.x,b.y-own.y));
    audio.frame({...ear,hour:light.hour,day:light.day,moonlight:light.moonlight,water,own:{id:m.id,species:m.species,x:own.x,y:own.y,speed:speedOf(own),onGround:!m.perched,quiet:false,stamina:m.stamina??100,feeding:!!m.feeding,drinks:m.drinks??0,dead:m.deadUntil>now},animals:heard.slice(0,10)});
   }
   {const i=input.current,moving=Math.hypot(i.dx,i.dy)>.1,key=moving?String(Math.round(Math.atan2(i.dy,i.dx)/(Math.PI/4))):'';if(key!==latchKey||dragging||!moving){latchKey=key;moveYaw=yaw;}i.moveYaw=moveYaw;}
   for(const [id,rig]of rigs)if(!ids.has(id)){scene.remove(rig.root);rigs.delete(id);positions.delete(id);const shadow=shadows.get(id);if(shadow)scene.remove(shadow);shadows.delete(id);}
   for(const p of players){
    const own=p.id===m?.id;let rig=rigs.get(p.id);
    const coat=coatOf(p.coats,p.species);if(!rig||rig.species!==p.species||rig.coat!==coat){if(rig)scene.remove(rig.root);rig=makeSafariAnimal(p.species,coat);rig.born=p.born;rig.turn=own?Math.PI/2:0;rigs.set(p.id,rig);positions.set(p.id,{...p});if(!animalBatches)scene.add(rig.root);if(!shadows.has(p.id)){const shadow=new THREE.Mesh(shadowGeo,shadowMat);shadow.rotation.x=-Math.PI/2;scene.add(shadow);shadows.set(p.id,shadow);}}
    const position=positions.get(p.id)!;if(position.born!==p.born||Math.hypot(position.x-p.x,position.y-p.y)>(own?600:220)){Object.assign(position,p);rig.altitude=0;}
    const concealed=(p as Player&{concealed?:boolean}).concealed;rig.root.visible=!p.deadUntil&&!(p.species==='warthog'&&p.abilityUntil>now)&&(!concealed||own)&&(own||!m||dist(m,p)<drawRange-60);const shadow=shadows.get(p.id)!;shadow.visible=rig.root.visible;
    // the menu camera tours a herd at close range: anyone wandering right up to the lens steps out of the shot
    if(preview&&Math.hypot(position.x-camera.position.x,position.y-camera.position.z)<30)rig.root.visible=shadow.visible=false;
    if(!rig.root.visible)continue;let vx=p.vx||0,vy=p.vy||0;
    // up in the tree, or still on foot walking round to the climbing face (drawn walking, not in the perched pose)
    const perched=!!p.perched&&p.climb!=='approach';
    // a player's own posture is drawn from this device's input at once; everyone else's comes with the room
    const pose=own&&r?.phase==='playing'?postureOf({...p,posture:input.current.posture}):postureOf(p);
    if(preview){position.x=p.x;position.y=p.y;position.vx=vx;position.vy=vy;}
    else if(own&&r?.phase==='playing'){
     // moving stands a lying animal up, a sprint ends a crouch, and a new life, a death or a climb starts standing
     {const i=input.current;if(i.posture==='lie'&&Math.hypot(i.dx,i.dy)>.1||i.posture==='crouch'&&i.sprint||p.deadUntil||p.climb||p.perched||p.born!==ownBorn&&!first)i.posture=undefined;}
     Object.assign(position,{species:p.species,coats:p.coats,perched:p.perched,abilityUntil:p.abilityUntil,deadUntil:p.deadUntil,stunUntil:p.stunUntil,stamina:p.stamina,exhausted:p.exhausted,...input.current,...cameraInput(input.current.dx,input.current.dy,input.current.moveYaw??input.current.cameraYaw)});
     // This device moves its own animal (the same move() the server runs) and reports where it got to (lib/net.ts claim),
     // so the server's copy, a moment old, is never pulled back toward. The server's position is only rejoined while it
     // holds the animal (in a tree, stunned) or for a moment after it refused a reported position (fix).
     // A slow frame (a busy phone) still covers its full time in 50 ms steps, so the animal keeps its real speed.
     if(p.fix!==ownFix){ownFix=p.fix;rejoinUntil=ms+450;}
     // (walking to the trunk before a climb is still on the ground: keep the server's walking velocity for the gait)
     if(p.perched||p.climb){position.x=THREE.MathUtils.damp(position.x,p.x,10,dt);position.y=THREE.MathUtils.damp(position.y,p.y,10,dt);position.vx=p.climb==='approach'?p.vx||0:0;position.vy=p.climb==='approach'?p.vy||0:0;}
     else{
      // other animals' bodies are solid: bump against them where they are drawn (the server does the same with its copies)
      const near:Player[]=[];for(const q of players){const at=q.id!==p.id&&positions.get(q.id);if(at&&Math.abs(at.x-position.x)<70&&Math.abs(at.y-position.y)<70)near.push({...q,x:at.x,y:at.y});}
      for(let left=Math.min(.25,raw);left>1e-4;left-=.05)move(position,Math.min(.05,left),ps,now,near);if(ms<rejoinUntil||(p.stunUntil||0)>now){const k=1-Math.exp(-10*dt);position.x+=(p.x+vx*lag-position.x)*k;position.y+=(p.y+vy*lag-position.y)*k;}}vx=position.vx;vy=position.vy;
     input.current.claim={x:position.x,y:position.y,vx:position.vx,vy:position.vy,born:p.born,at:Date.now()};
    }else{const k=1-Math.exp(-12*dt);position.x+=(p.x+vx*lag-position.x)*k;position.y+=(p.y+vy*lag-position.y)*k;}
    const speed=Math.hypot(vx,vy);
    // Facing is separate from movement: the body swings toward where the animal is being steered (the input), or
    // along its motion when there is no input, eased but capped at the species' turnRate so a 180 is a quick pivot.
    {const steer=own&&r?.phase==='playing'?position:p,steering=Math.hypot(steer.dx,steer.dy)>.1&&!p.perched;
     if(steering||speed>3){const direction=steering?-Math.atan2(steer.dy,steer.dx):-Math.atan2(vy,vx),delta=Math.atan2(Math.sin(direction-rig.turn),Math.cos(direction-rig.turn)),max=ANIMALS[p.species].gait.turnRate*dt;rig.turn+=THREE.MathUtils.clamp(delta*(1-Math.exp(-14*dt)),-max,max);}
      // a watchful animal standing still turns to face what it is watching
      else if(!own&&p.mood==='watch'){const delta=Math.atan2(Math.sin(-(p.heading||0)-rig.turn),Math.cos(-(p.heading||0)-rig.turn));rig.turn+=delta*(1-Math.exp(-4*dt));}}
    // In a tree the body follows the shared climbing pose (on the bark the rules use), smoothed so every transition
    // (rearing onto the trunk, pulling up onto a bough, pivoting, jumping down) is continuous; the paws are then placed
    // on the real bark. Back on the ground the pose eases back into normal locomotion.
    const climb=preview?null:climberPose(rig,p,ps,dt,groundY);
    if(climb){position.x=climb.x;position.y=climb.y;position.vx=position.vy=0;}
    else{rig.pitch=THREE.MathUtils.damp(rig.pitch,0,8,dt);rig.altitude=THREE.MathUtils.damp(rig.altitude,0,6,dt);rig.root.rotation.set(0,rig.turn,rig.pitch);rig.root.position.set(position.x,groundY(position.x,position.y)+rig.altitude,position.y);}
    {const a=ANIMALS[p.species],start=p.abilityUntil-a.duration*1000;animateSafari(rig,{feeding:!!p.feeding,speed:perched?0:speed,time,dt,ability:p.abilityUntil>now?THREE.MathUtils.clamp((now-start)/(a.duration*1000),0,1):-1,action:p.actionUntil>now,perched,altitude:rig.altitude,stunned:(p.stunUntil||0)>now,alert:p.mood==='watch',grazing:headDown(p,now),crouch:p.mood==='stalk'||pose==='crouch',resting:p.mood==='rest'||pose==='lie',climb:climb?.info});}
    climberFeet(rig,climb,ps,dt,groundY);
    /* with real shadow maps the painted shadow is only contact shade under the body; without them it stands in for the cast shadow, away from the sun */{const real=renderer.shadowMap.enabled?0:1;shadow.position.set(position.x+shadowShift.x*real,groundY(position.x,position.y)+.6,position.y+shadowShift.z*real);}{const sp=cameraProfile(p.species);shadow.scale.set(sp.shadow[0],sp.shadow[1],1);shadow.rotation.z=rig.turn;}
    // the camera's point of interest: the animal's head height (lower while it crouches or lies down, eased), followed
    // closely along the ground and more softly in height, so gait bob and the terrain's facets never shake the view
    if(own){ownHeading=rig.turn;eyeHeight=THREE.MathUtils.damp(eyeHeight||cameraProfile(p.species).head,cameraProfile(p.species).head*(pose==='lie'?.55:pose==='crouch'?.75:1),4,dt);target.set(position.x,rig.root.position.y+eyeHeight,position.y);
     if(first||ownBorn!==p.born){follow.copy(target);ownBorn=p.born;first=false;yaw=rig.turn-Math.PI/2;pitch=.24;yawVel=0;camY=NaN;}
     follow.x=THREE.MathUtils.damp(follow.x,target.x,12,dt);follow.z=THREE.MathUtils.damp(follow.z,target.z,12,dt);follow.y=THREE.MathUtils.damp(follow.y,target.y,climb?8:5,dt);}
   }
   if(input.current.recenter){recentering=true;input.current.recenter=false;}
   // The camera turns with the animal: a critically damped spring swings it round behind the body whenever the animal
   // turns (a full about-turn included), so the view always looks the way the animal is facing. It eases in as the
   // animal gets going (or as soon as it is steered) and swings faster at a sprint and on a big turn, so turns read as
   // one continuous move. A drag to look around pauses it for a second and a half; R swings straight back behind.
   if(!preview&&m&&(dragging||m.perched||ms-lastLook<1500)&&!recentering)yawVel=0;
   else if(!preview&&m){const own=positions.get(m.id),sp=own?Math.hypot(own.vx||0,own.vy||0):0,want=ownHeading-Math.PI/2,delta=Math.atan2(Math.sin(want-yaw),Math.cos(want-yaw));
    const steered=Math.hypot(input.current.dx,input.current.dy)>.1,moving=recentering?1:Math.max(THREE.MathUtils.smoothstep(sp,4,30),steered?.7:0),
     w=recentering?7:(m.sprint?3.6:2.8)*(1+.5*THREE.MathUtils.smoothstep(Math.abs(delta),1,2.6))*moving;
    yawVel+=(w*w*delta-2*Math.max(w,2.5)*yawVel)*Math.min(dt,.05);yaw+=yawVel*dt;
    if(recentering){pitch=THREE.MathUtils.damp(pitch,.24,8,dt);if(Math.abs(delta)<.01&&Math.abs(yawVel)<.05)recentering=false;}}
   if(!preview)input.current.cameraYaw=yaw;
   if(cinema){follow.copy(cinema.frame(camera,time,dt,latest.current.focus??null,groundY,width/height,positions));if(cinema.shot!==shownShot){shownShot=cinema.shot;latest.current.onShot?.(shownShot);}}else{
   const prof=!preview&&m?cameraProfile(m.species):undefined;if(camera.near!==(prof?.near??1.8)){camera.near=prof?.near??1.8;camera.updateProjectionMatrix();}let actualDistance=(prof?prof.distance*distance/155:distance)*(width<650?.91:1);const forwardX=Math.sin(yaw),forwardZ=Math.cos(yaw);
   // a boulder or an acacia trunk between the animal and the camera pulls the camera in front of it (a thin trunk only
   // when it sits close to the lens, where it would fill the frame), quickly in and gently back out
   for(const t of solidNearCamera(follow.x,follow.z,actualDistance+40)){const dx=t.x-follow.x,dz=t.y-follow.z,along=dx*forwardX+dz*forwardZ,side=Math.abs(dx*forwardZ-dz*forwardX),r=solidRadius(t);
    if(t.kind==='rock'&&along>(prof?3:24)&&along<actualDistance&&side<r*.9)actualDistance=prof?Math.max(prof.min,along-r):Math.max(55,along-22);
    else if(t.kind==='tree'&&along>(prof?3:24)&&along<actualDistance+r+4&&along>actualDistance*.45&&side<r+6)actualDistance=prof?Math.max(prof.min,along-r-8):Math.max(55,along-r-8);}
   shownDistance=!shownDistance||preview?actualDistance:THREE.MathUtils.damp(shownDistance,actualDistance,actualDistance<shownDistance?14:3,dt);actualDistance=shownDistance;
   const boost=m?.sprint&&!m.exhausted&&m.stamina>2&&Math.hypot(m.vx,m.vy)>ANIMALS[m.species].gait.run*10+5?1:0,nextFov=THREE.MathUtils.damp(camera.fov,61+boost*5,5,dt);if(Math.abs(nextFov-camera.fov)>.01){camera.fov=nextFov;camera.updateProjectionMatrix();}
   // height eases too: it rises quickly when the ground ahead of the lens climbs (so it never dips into a slope) and
   // settles back gently
   {const wantY=Math.max(groundY(follow.x+forwardX*actualDistance,follow.z+forwardZ*actualDistance)+(prof?prof.clearance:12),follow.y+Math.sin(pitch)*actualDistance+(prof?prof.lift:13));
    camY=preview||!Number.isFinite(camY)?wantY:THREE.MathUtils.damp(camY,wantY,wantY>camY?16:6,dt);
    camera.position.set(follow.x+forwardX*Math.cos(pitch)*actualDistance,camY,follow.z+forwardZ*Math.cos(pitch)*actualDistance);}
   {const la=prof?prof.lookAhead:32;camera.lookAt(follow.x-forwardX*la,follow.y+(prof?prof.lookY:6),follow.z-forwardZ*la);}}if(!preview&&ms-lastLight>=200){lastLight=ms;daylight(r,now,m);}sun.position.set(follow.x+keyDir.x*700,follow.y+keyDir.y*700,follow.z+keyDir.z*700);sun.target.position.set(follow.x,follow.y,follow.z);const breeze=wind(r||{seed:417,round:0});savanna.update(time,follow.x,follow.z,drawRange,camera.far,camera.position,breeze);if(!preview)effects.update(r?.phase==='playing'||r?.phase==='finished'?r:null,now,time,camera.position,camera.far,players.map(p=>{const q=positions.get(p.id);return q?{id:p.id,x:q.x,y:q.y,vx:q.vx,vy:q.vy,deadUntil:p.deadUntil}:p;}),dayLevel);
   if(ms-lastTraceFrame>=100){lastTraceFrame=ms;traces.update(players.filter(p=>rigs.get(p.id)?.root.visible).map(p=>{const pos=positions.get(p.id)||p,rig=rigs.get(p.id);return{id:p.id+':'+p.born,species:p.species,x:pos.x,z:pos.y,vx:pos.vx||0,vy:pos.vy||0,heading:p.heading||0,visible:!!rig?.root.visible,moving:true,quiet:p.species==='leopard'&&p.abilityUntil>now,onGround:!p.deadUntil&&!p.perched&&!(p.species==='warthog'&&p.abilityUntil>now)};}),r?.foods||[],now,{x:follow.x,z:follow.z},breeze);}animalBatches?.update(rigs.values(),camera,!renderer.shadowMap.enabled);
   if(renderer instanceof THREE.WebGLRenderer&&renderer.shadowMap.enabled&&ms-lastShadow>100){renderer.shadowMap.needsUpdate=true;lastShadow=ms;}
   food.update(r?.foods||previewFoods,now,m||null,lightweight?240:360,groundY,kind=>!!m&&(ANIMALS[m.species].foods as string[]).includes(kind),f=>input.current.instinct!==false||(!!m&&dist(m,f)<75),m&&!m.deadUntil?{...(positions.get(m.id)||m),range:FOOD_RANGE}:undefined);
   const before=performance.now();renderer.render(scene,camera);frameCost=frameCost*.97+(performance.now()-before)*.03;
   sampleFrames++;sampleWork+=performance.now()-before;if(ms-sampleStart>=2000){const fps=sampleFrames*1000/(ms-sampleStart),renderMs=sampleWork/sampleFrames;const stats={fps:Math.round(fps),renderMs:Math.round(renderMs*10)/10,renderer:lightweight?'software':'webgl',quality:activeTier,drawCalls:renderer instanceof THREE.WebGLRenderer?renderer.info.render.calls:0};element.dataset.fps=fps.toFixed(1);element.dataset.renderMs=renderMs.toFixed(1);element.dataset.renderer=stats.renderer;element.dataset.drawCalls=String(stats.drawCalls);if(renderer instanceof THREE.WebGLRenderer)element.dataset.triangles=String(renderer.info.render.triangles);element.dataset.animalDrawCalls=String(animalBatches?.drawCalls||0);element.dataset.quality=activeTier;element.dataset.worldEvent=effects.stats;latest.current.onPerformance?.(stats);if(!document.hidden&&mode==='auto'&&!lightweight){slowSamples=(frameCost>25||fps<40)?slowSamples+1:0;if(slowSamples>=2)autoTier='performance';}sampleStart=ms;sampleFrames=0;sampleWork=0;}
   if(ms-lastOverlay<100)return;lastOverlay=ms;{const own=m&&positions.get(m.id);if(own)element.dataset.own=own.x.toFixed(1)+' '+own.y.toFixed(1);}element.dataset.camera=yaw.toFixed(3)+' '+ownHeading.toFixed(3)+' '+distance.toFixed(0);ctx.clearRect(0,0,width,height);if(preview||!m)return;
   const placed:[number,number][]=[];
   function label(text:string,x:number,y:number,z:number,color='#f0f3de'){view.set(x,y,z).applyMatrix4(camera.matrixWorldInverse);if(view.z>=-2)return;projected.set(x,y,z).project(camera);const sx=(projected.x*.5+.5)*width,sy=(-projected.y*.5+.5)*height;if(sx<20||sx>width-20||sy<100||sy>height-100)return;if(placed.some(([px,py])=>Math.abs(px-sx)<90&&Math.abs(py-sy)<16))return;placed.push([sx,sy]);ctx.font='600 12px Arial';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#2a1d0ed9';ctx.strokeText(text,sx,sy);ctx.fillStyle=color;ctx.fillText(text,sx,sy);}
   // Tracking names only prey your animal can actually notice right now (the same sight / scent / sound rule the wildlife
   // uses): no markers through boulders, no labels on still animals hidden in tall grass, no minimap dots.
   const prey=players.filter(q=>q.id!==m.id&&!q.deadUntil&&ANIMALS[m.species].prey.includes(q.species)).map(q=>({q,cue:sense(m,q,r!,now,ps)})).filter(x=>x.cue).sort((a,b)=>a.cue!.range-b.cue!.range);
   // real players: a small name tag over their animal while it is drawn, in front of the camera and not behind a boulder
   // (hidden players are never drawn, so they never get one), and a dot in their colour on the minimap
   const humans=players.filter(p=>!p.bot&&p.id!==m.id&&!p.deadUntil&&!(p as Player&{concealed?:boolean}).concealed);
   for(const p of humans){const rig=rigs.get(p.id);if(!rig?.root.visible||sightBlocked(ps,m,p))continue;label('\u25BE '+p.name+' \u00B7 '+ANIMALS[p.species].name,rig.root.position.x,rig.root.position.y+cameraProfile(p.species).head+14,rig.root.position.z,playerColour(p.id));}
   if(input.current.instinct!==false){
    for(const {q,cue} of prey.slice(0,2)){const rig=rigs.get(q.id);if(rig&&(cue!.how==='sight'||cue!.how==='close'))label(ANIMALS[q.species].name.toUpperCase()+' · '+Math.round(dist(m,q)/10)+' m',rig.root.position.x,rig.root.position.y+cameraProfile(q.species).head+9,rig.root.position.z,'#ffce89');}
    const nearestCue=prey[0],nearest=nearestCue?.q,how=nearestCue?.cue!.how;if(nearest){const direction=Math.atan2(nearest.x-m.x,nearest.y-m.y)-yaw-Math.PI,angle=Math.atan2(Math.sin(direction),Math.cos(direction)),sx=width/2-THREE.MathUtils.clamp(angle/1.5,-1,1)*Math.min(220,width*.28);ctx.save();ctx.translate(sx,106);ctx.rotate(-angle);ctx.fillStyle='#f7ba6b';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(-5,4);ctx.lineTo(5,4);ctx.closePath();ctx.fill();ctx.restore();ctx.textAlign='center';ctx.font='600 12px Arial';ctx.fillStyle='#ffe1b3';ctx.fillText(how==='scent'?ANIMALS[nearest.species].name+' scent on the wind':how==='sound'?'Something running':ANIMALS[nearest.species].name+' · '+Math.round(dist(m,nearest)/10)+' m',sx,126);}
   }
   if(m.species==='warthog')for(const t of ps)if(t.kind==='burrow'&&dist(m,t)<230)label('BURROW',t.x,groundY(t.x,t.y)+12,t.y,'#f1d9a6');
   if((m.species==='leopard'||m.species==='lion')&&!m.perched){const tree=ps.filter(t=>t.kind==='tree'&&dist(m,t)<120&&canClimb(m.species,ps,t)).sort((a,b)=>dist(m,a)-dist(m,b))[0];if(tree)label('Q · CLIMB',tree.x,groundY(tree.x,tree.y)+40*tree.size,tree.y,'#f1d9a6');}
   for(const t of ps)if(t.kind==='water'&&dist(m,t)<t.size+260&&dist(m,t)>t.size*.6)label('WATERING HOLE',t.x,groundY(t.x,t.y)+16,t.y,'#cfe6ea');
   const mw=width<760?106:142,mh=mw*H/W,mx=width-mw-22,my=width<760?94:height-mh-24;
   ctx.fillStyle='#2a2112da';ctx.fillRect(mx-8,my-24,mw+16,mh+32);ctx.strokeStyle='#e6c47a55';ctx.strokeRect(mx-8,my-24,mw+16,mh+32);ctx.textAlign='left';ctx.font='600 11px Arial';ctx.fillStyle='#f3e7cc';ctx.fillText('GOLDEN PLAINS',mx,my-10);ctx.fillStyle='#b8954e';ctx.fillRect(mx,my,mw,mh);
   for(const t of ps){if(t.kind==='tallgrass'){ctx.fillStyle='#9c8a3f';ctx.beginPath();ctx.arc(mx+t.x/W*mw,my+t.y/H*mh,Math.max(1.5,t.size*100/W*mw),0,Math.PI*2);ctx.fill();continue;}if(t.kind==='water'){ctx.fillStyle='#5e9a96';ctx.beginPath();ctx.arc(mx+t.x/W*mw,my+t.y/H*mh,Math.max(2,t.size/W*mw),0,Math.PI*2);ctx.fill();continue;}if(t.kind==='bush')continue;ctx.fillStyle=t.kind==='tree'?'#5f7a33':t.kind==='rock'?'#8b8070':'#4a3420';ctx.fillRect(mx+t.x/W*mw,my+t.y/H*mh,2,2);}
   // the day's world event on the map: the burnt patch and its burning edge, or the migrating column and its heading
   {const ev=r?worldEvent(r,now):null;
    if(ev?.kind==='fire'&&now>=ev.at){const e=fireEdge(ev,(Math.min(now,ev.until)-ev.at)/1000);ctx.save();ctx.beginPath();ctx.ellipse(mx+e.cx/W*mw,my+e.cy/H*mh,Math.max(1,e.a/W*mw),Math.max(1,e.b/H*mh),Math.atan2(ev.uy*mh/H,ev.ux*mw/W),0,Math.PI*2);ctx.fillStyle=now-ev.at>FIRE.flush+20000?'#4f5a2ccc':'#231a14d9';ctx.fill();if(now<ev.until){ctx.strokeStyle='#ff8a3a';ctx.lineWidth=1.6;ctx.stroke();}ctx.restore();}
    if(ev?.kind==='migration'&&now>=ev.at-10000&&now<ev.until+60000){ctx.fillStyle='#f6eedb';ctx.strokeStyle='#2a1d0e';ctx.lineWidth=1;for(const p of players)if(p.id.startsWith('trek-')&&!p.deadUntil){ctx.fillRect(mx+p.x/W*mw-1.5,my+p.y/H*mh-1.5,3,3);ctx.strokeRect(mx+p.x/W*mw-1.5,my+p.y/H*mh-1.5,3,3);}if(now<ev.at+20000){const ax=mx+ev.x0/W*mw,bx=mx+ev.x1/W*mw;ctx.strokeStyle='#e9dcc099';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(ax,my+mh);ctx.lineTo(bx,my);ctx.stroke();ctx.setLineDash([]);}}}
   for(const p of humans){ctx.fillStyle=playerColour(p.id);ctx.strokeStyle='#2a1d0e';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(mx+p.x/W*mw,my+p.y/H*mh,3.2,0,Math.PI*2);ctx.fill();ctx.stroke();}
   ctx.save();ctx.translate(mx+m.x/W*mw,my+m.y/H*mh);ctx.rotate(-yaw);ctx.fillStyle='#fff6dc';ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(-3,3);ctx.lineTo(3,3);ctx.closePath();ctx.fill();ctx.restore();
  };
  renderer.setAnimationLoop(render);
  return()=>{observer.disconnect();renderer.setAnimationLoop(null);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',drag);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);animalBatches?.dispose();savanna.dispose();effects.dispose();traces.dispose();food.dispose();shadowGeo.dispose();shadowMat.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();overlay.remove();};
 },[preview,input]);
 return <div ref={host} className="world-scene">{failure&&<div className="graphics-error" role="alert">{failure}</div>}{software&&!preview&&<span className="render-mode">Compatibility graphics</span>}</div>;
}
