'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createRenderer,SoftwareRenderer} from './software-renderer';
import {cameraInput,ANIMALS,SPECIES,Species,Room,Player,W,H,props,makeFoods,move,newPlayer,dist} from '@/lib/game';
import {makeAnimal,animateAnimal,AnimalRig,animalPortrait} from './animal-models';
import {hasReal,makeRealAnimal,animateReal,cameraProfile,setRealFocus} from './real-animals';
import {hasRealFood,makeRealFood} from './real-food';
import {createForest,groundY,setAnimals} from './forest-world';
import {loadGameAssets} from './world-assets';
import {AnimalBatches} from './animal-batches';
import type {AnimalSoundEvent} from '@/lib/animal-sounds';
export type GraphicsMode='auto'|'performance'|'high';
export type PerformanceStats={fps:number;renderMs:number;renderer:string;quality:string;drawCalls:number};
export type WorldRoom=Omit<Room,'players'>&{serverTime:number;_received?:number;_transitMs?:number;players:(Player&{online:boolean;concealed:boolean})[]};
export type WorldInput={dx:number;dy:number;interact:boolean;ability:boolean;perch:boolean;sprint:boolean;cameraYaw:number;instinct?:boolean;recenter?:boolean;graphics?:GraphicsMode};
export function ModelPortrait({species,size=70}:{species:Species;size?:number}){const [src,setSrc]=useState('');useEffect(()=>{setSrc(animalPortrait(species));},[species]);return src?<img className="portrait" src={src} alt={ANIMALS[species].name} width={size} height={size}/>:<span className="portrait-loading" style={{width:size,height:size}} aria-label={ANIMALS[species].name}>{ANIMALS[species].name.slice(0,1)}</span>;}
function makeFood(kind:string){
 const g=new THREE.Group(),color=kind==='grass'?0x8ca95b:kind==='berries'?0x9b4058:kind==='eggs'?0xe0d9b8:kind==='insects'?0xb6ad61:0x947049,geometry=kind==='grass'?new THREE.ConeGeometry(2,10,3):new THREE.SphereGeometry(kind==='eggs'?3.7:2.8,6,4),material=new THREE.MeshStandardMaterial({color,roughness:.9});
 const pieces=[];for(let i=0;i<5;i++){const piece=geometry.clone();if(kind==='eggs')piece.scale(1,1.3,1);piece.translate(Math.sin(i*2.4)*5,kind==='grass'?5:3,Math.cos(i*2.4)*5);pieces.push(piece);}const combined=mergeGeometries(pieces);g.add(new THREE.Mesh(combined,material));pieces.forEach(p=>p.dispose());geometry.dispose();
 const halo=new THREE.Mesh(new THREE.RingGeometry(12,14,24),new THREE.MeshBasicMaterial({color:0xbdda78,transparent:true,opacity:.55,side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=1;halo.name='food-ring';g.add(halo);return g;
}
export default function WorldScene({room,me,input,preview=false,onPerformance,onAnimalSound}:{room:WorldRoom|null;me:Player|undefined;input:React.RefObject<WorldInput>;preview?:boolean;onPerformance?:(stats:PerformanceStats)=>void;onAnimalSound?:(species:Species,event:AnimalSoundEvent,volume:number,pan:number)=>void}){
 const host=useRef<HTMLDivElement>(null),latest=useRef({room,me,onPerformance,onAnimalSound});latest.current={room,me,onPerformance,onAnimalSound};const [failure,setFailure]=useState(''),[software,setSoftware]=useState(false),[assetsReady,setAssetsReady]=useState(false);
 useEffect(()=>{let live=true;loadGameAssets().catch(e=>console.error('world assets failed',e)).then(()=>{if(live)setAssetsReady(true);});return()=>{live=false;};},[]);
 useEffect(()=>{
  if(!assetsReady||!host.current)return;const element=host.current;let renderer:THREE.WebGLRenderer|SoftwareRenderer;
  try{renderer=createRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{setFailure('3D rendering is unavailable. Enable graphics acceleration and reload.');return;}
  const lightweight=renderer instanceof SoftwareRenderer;setSoftware(lightweight);let pixelRatio=lightweight?.7:1;
  renderer.setPixelRatio(pixelRatio);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=false;renderer.shadowMap.type=THREE.PCFSoftShadowMap;if(renderer instanceof THREE.WebGLRenderer)renderer.shadowMap.autoUpdate=false;
  const canvas=renderer.domElement;canvas.setAttribute('aria-label',preview?'Live Mosswood forest preview with animated animals':'3D Mosswood forest. WASD moves relative to camera. Drag to look. Shift sprints, E interacts, Space uses ability, F toggles instincts, R centers camera.');canvas.tabIndex=preview?-1:0;element.appendChild(canvas);
  const overlay=document.createElement('canvas');overlay.className='world-labels';element.appendChild(overlay);const ctx=overlay.getContext('2d')!;
  const scene=new THREE.Scene();scene.background=new THREE.Color(preview?0x526b61:0x718b87);scene.fog=new THREE.Fog(preview?0x526b61:0x718b87,340,800);const camera=new THREE.PerspectiveCamera(61,1,1.8,1000);
  scene.add(new THREE.HemisphereLight(0xc5ddf1,0x303923,1.5));const sun=new THREE.DirectionalLight(0xffdab0,2.9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-400,right:400,top:400,bottom:-400,near:10,far:1700});sun.shadow.bias=-.0003;sun.shadow.normalBias=1.5;sun.shadow.camera.updateProjectionMatrix();scene.add(sun,sun.target);
  const rim=new THREE.DirectionalLight(0x99bbca,.65);rim.position.set(-400,200,500);scene.add(rim);
  const forest=createForest(scene,417,lightweight,preview),ps=props(417),previewFoods=makeFoods(417),foodModels=new Map<number,THREE.Group>();
  for(const f of previewFoods){const food=hasRealFood(f.kind)?makeRealFood(f.kind,f.id):makeFood(f.kind);food.position.set(f.x,groundY(f.x,f.y),f.y);foodModels.set(f.id,food);scene.add(food);}
  const rigs=new Map<string,AnimalRig>(),positions=new Map<string,Player>(),shadows=new Map<string,THREE.Mesh>(),shadowGeo=new THREE.CircleGeometry(1,20),shadowMat=new THREE.MeshBasicMaterial({color:0x0b1913,transparent:true,opacity:.22,depthWrite:false});
  const animalBatches=lightweight?null:new AnimalBatches(scene);
  const demo=SPECIES.map((s,i)=>{const p=newPlayer('preview-'+s,ANIMALS[s].name,Date.now(),true,s);p.x=900+(i%3)*90;p.y=610+Math.floor(i/3)*110;p.protectedUntil=0;if(s==='owl')p.owlMode='flying';return p;});
  let width=0,height=0,last=performance.now(),lastPreviewFrame=0,yaw=0,pitch=.24,distance=155,dragging=false,lastX=0,lastY=0,ownHeading=Math.PI/2,first=true,ownBorn=0,frameCost=16;
  const follow=new THREE.Vector3(1000,20,700),target=new THREE.Vector3(),projected=new THREE.Vector3(),view=new THREE.Vector3();
  const qualityCaps={high:1.5,balanced:1.12,performance:.78};
  const resize=()=>{const bounds=element.getBoundingClientRect();width=bounds.width;height=bounds.height;if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();overlay.width=Math.round(width);overlay.height=Math.round(height);};
  const observer=new ResizeObserver(resize);observer.observe(element);resize();input.current.cameraYaw=yaw;
  let sampleStart=performance.now(),sampleFrames=0,sampleWork=0,lastOverlay=0,lastShadow=0,slowSamples=0,autoTier:'balanced'|'performance'='balanced',activeTier='',drawRange=800,nextAmbientAt=performance.now()+3500;
  const animalStates=new Map<string,{actionUntil:number;abilityUntil:number;deadUntil:number}>();
  let soundRoomCode='';
  const down=(e:PointerEvent)=>{if(preview)return;dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});};
  const drag=(e:PointerEvent)=>{if(!dragging)return;yaw-=(e.clientX-lastX)*.005;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastY)*.003,-.06,.62);lastX=e.clientX;lastY=e.clientY;input.current.cameraYaw=yaw;};
  const up=()=>{dragging=false;};const wheel=(e:WheelEvent)=>{if(preview)return;e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.12,95,260);};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',drag);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});
  const render=(ms:number)=>{
   if(preview&&ms-lastPreviewFrame<1000/30)return;
   if(preview)lastPreviewFrame=ms;
   const dt=Math.min(.075,Math.max(0,(ms-last)/1000));last=ms;if(!width||!height)return;
   const mode=input.current.graphics||'auto';
   const time=ms/1000,{room:r,me:m}=latest.current,now=r?Date.now()+r.serverTime-(r._received||Date.now())+(r._transitMs||0):Date.now(),lag=r?Math.min(.3,Math.max(0,(now-r.serverTime)/1000)):0,players=r?.players||demo,ids=new Set(players.map(p=>p.id));
   if(r?.code!==soundRoomCode){animalStates.clear();soundRoomCode=r?.code||'';}
   const tier=lightweight||preview?'performance':mode==='auto'?autoTier:mode;
   const lowBudget=players.length>18||(tier==='performance'&&mode!=='high');
   if(tier!==activeTier){activeTier=tier;pixelRatio=lightweight?0.7:Math.min(window.devicePixelRatio||1,qualityCaps[tier] ?? 1.12);renderer.setPixelRatio(pixelRatio);renderer.shadowMap.enabled=!lightweight&&tier==='high';drawRange=lightweight?520:tier==='high'?1050:tier==='performance'?620:800;if(scene.fog instanceof THREE.Fog){scene.fog.near=drawRange*.4;scene.fog.far=drawRange;}camera.far=drawRange+180;resize();}
   if(!preview&&m&&r?.phase==='playing'){
    for(const p of players){
     const previous=animalStates.get(p.id);
     animalStates.set(p.id,{actionUntil:p.actionUntil,abilityUntil:p.abilityUntil,deadUntil:p.deadUntil});
     if(!previous)continue;
     const range=dist(m,p);
     if(range>320)continue;
     const volume=Math.max(.025,(1-range/360)*.13),pan=THREE.MathUtils.clamp((p.x-m.x)/220,-1,1);
     if(p.deadUntil>now&&p.deadUntil!==previous.deadUntil)latest.current.onAnimalSound?.(p.species,'death',volume,pan);
     else if(p.abilityUntil>now&&p.abilityUntil!==previous.abilityUntil)latest.current.onAnimalSound?.(p.species,'ability',volume*.78,pan);
     else if(p.id===m.id&&p.actionUntil>now&&p.actionUntil!==previous.actionUntil)latest.current.onAnimalSound?.(p.species,p.message.includes('+')?'success':'action',volume*.7,pan);
    }
    if(ms>=nextAmbientAt){
     const nearby=players.filter(p=>p.id!==m.id&&!p.deadUntil&&dist(m,p)<290);
     if(nearby.length){const animal=nearby[Math.floor(Math.random()*nearby.length)],range=dist(m,animal);latest.current.onAnimalSound?.(animal.species,'call',Math.max(.025,(1-range/340)*.09),THREE.MathUtils.clamp((animal.x-m.x)/220,-1,1));}
     nextAmbientAt=ms+6500+Math.random()*4500;
    }
   }
   for(const [id,rig]of rigs)if(!ids.has(id)){scene.remove(rig.root);rigs.delete(id);positions.delete(id);const shadow=shadows.get(id);if(shadow)scene.remove(shadow);shadows.delete(id);}
   for(const p of players){
    const own=p.id===m?.id;let rig=rigs.get(p.id);
    if(!rig||rig.species!==p.species){if(rig)scene.remove(rig.root);rig=hasReal(p.species)?makeRealAnimal(p.species):makeAnimal(p.species);rig.born=p.born;rig.turn=own?Math.PI/2:0;rigs.set(p.id,rig);positions.set(p.id,{...p});if(!animalBatches||rig.root.userData.real)scene.add(rig.root);if(!shadows.has(p.id)){const shadow=new THREE.Mesh(shadowGeo,shadowMat);shadow.rotation.x=-Math.PI/2;scene.add(shadow);shadows.set(p.id,shadow);}}
    const position=positions.get(p.id)!;if(position.born!==p.born||Math.hypot(position.x-p.x,position.y-p.y)>220){Object.assign(position,p);rig.altitude=0;}
    const concealed=(p as Player&{concealed?:boolean}).concealed;rig.root.visible=!p.deadUntil&&(!concealed||own)&&(own||!m||dist(m,p)<drawRange-60);const shadow=shadows.get(p.id)!;shadow.visible=rig.root.visible;
    if(!rig.root.visible)continue;let vx=p.vx||0,vy=p.vy||0;
    if(preview){const i=SPECIES.indexOf(p.species);position.x=p.x+Math.sin(time*.3+i)*26;position.y=p.y+Math.cos(time*.3+i)*20;vx=Math.cos(time*.3+i)*40;vy=-Math.sin(time*.3+i)*25;}
    else if(own&&r?.phase==='playing'){
     Object.assign(position,{species:p.species,owlMode:p.owlMode,abilityUntil:p.abilityUntil,deadUntil:p.deadUntil,stamina:p.stamina,exhausted:p.exhausted,...input.current,...cameraInput(input.current.dx,input.current.dy,input.current.cameraYaw)});
     if(p.owlMode==='perched'){position.x=THREE.MathUtils.damp(position.x,p.x,10,dt);position.y=THREE.MathUtils.damp(position.y,p.y,10,dt);position.vx=position.vy=0;}
     else{move(position,dt,ps,now);const tx=p.x+vx*lag,ty=p.y+vy*lag,error=Math.hypot(position.x-tx,position.y-ty),k=1-Math.exp(-(error>100?12:1.4)*dt);position.x+=(tx-position.x)*k;position.y+=(ty-position.y)*k;}vx=position.vx;vy=position.vy;
    }else{const k=1-Math.exp(-12*dt);position.x+=(p.x+vx*lag-position.x)*k;position.y+=(p.y+vy*lag-position.y)*k;}
    const speed=Math.hypot(vx,vy);if(speed>3){const direction=-Math.atan2(vy,vx),delta=Math.atan2(Math.sin(direction-rig.turn),Math.cos(direction-rig.turn));rig.turn+=delta*(1-Math.exp(-11*dt));}
    rig.root.rotation.y=rig.turn;rig.root.position.set(position.x,groundY(position.x,position.y),position.y);
    (rig.root.userData.real?animateReal:animateAnimal)(rig,{speed,time,dt,flying:p.species==='owl'&&p.owlMode==='flying',perched:p.species==='owl'&&p.owlMode==='perched',altitude:p.perchHeight,climbing:p.species==='squirrel'&&p.abilityUntil>now,ability:p.abilityUntil>now,action:p.actionUntil>now,dive:p.diveUntil>now?1-(p.diveUntil-now)/650:0});
    shadow.position.set(position.x,groundY(position.x,position.y)+.6,position.y);{const sp=cameraProfile(p.species);shadow.scale.set(sp?sp.shadow[0]:p.species==='fox'?26:18,sp?sp.shadow[1]:p.species==='fox'?13:12,1);}
    if(own){ownHeading=rig.turn;const headHeight=cameraProfile(p.species)?.head??(p.species==='fox'?25:p.species==='owl'?30:p.species==='snake'?9:19);target.set(position.x,rig.root.position.y+headHeight,position.y);if(first||ownBorn!==p.born){follow.copy(target);ownBorn=p.born;first=false;}follow.lerp(target,1-Math.exp(-9*dt));}
   }
   setRealFocus(follow);
   setAnimals(Array.from(rigs,([id,rg])=>({id,x:rg.root.position.x,z:rg.root.position.z,y:rg.altitude||0})));
   if(preview){follow.set(1000,45,700);yaw=-.5+Math.sin(time*.08)*.15;distance=width<760?330:240;pitch=.2;}
   if(input.current.recenter){yaw=ownHeading-Math.PI/2;pitch=.24;input.current.recenter=false;}if(!preview)input.current.cameraYaw=yaw;
   const prof=!preview&&m?cameraProfile(m.species):undefined;if(camera.near!==(prof?.near??1.8)){camera.near=prof?.near??1.8;camera.updateProjectionMatrix();}let actualDistance=(prof?prof.distance*distance/155:distance)*(width<650?.91:1);const forwardX=Math.sin(yaw),forwardZ=Math.cos(yaw);
   for(const t of ps){if(t.kind==='bush'||t.kind==='hollow')continue;const dx=t.x-follow.x,dz=t.y-follow.z,along=dx*forwardX+dz*forwardZ,side=Math.abs(dx*forwardZ-dz*forwardX);if(along>(prof?3:24)&&along<actualDistance&&side<(t.kind==='rock'?32:19))actualDistance=prof?Math.max(prof.min,along-6):Math.max(55,along-22);}
   const boost=m?.sprint&&!m.exhausted&&m.stamina>2&&Math.hypot(m.vx,m.vy)>60?1:0,nextFov=THREE.MathUtils.damp(camera.fov,61+boost*5,5,dt);if(Math.abs(nextFov-camera.fov)>.01){camera.fov=nextFov;camera.updateProjectionMatrix();}
   camera.position.set(follow.x+forwardX*Math.cos(pitch)*actualDistance,Math.max(groundY(follow.x+forwardX*actualDistance,follow.z+forwardZ*actualDistance)+(prof?prof.clearance:12),follow.y+Math.sin(pitch)*actualDistance+(prof?prof.lift:13)),follow.z+forwardZ*Math.cos(pitch)*actualDistance);
   {const la=prof?prof.lookAhead:32;camera.lookAt(follow.x-forwardX*la,follow.y+(prof?prof.lookY:6),follow.z-forwardZ*la);}sun.position.set(follow.x-300,620,follow.z-350);sun.target.position.set(follow.x,0,follow.z);forest.update(time,follow.x,follow.z,drawRange);animalBatches?.update(rigs.values(),follow,tier==='performance');
   if(renderer instanceof THREE.WebGLRenderer&&renderer.shadowMap.enabled&&ms-lastShadow>100){renderer.shadowMap.needsUpdate=true;lastShadow=ms;}
   for(const f of r?.foods||previewFoods){const model=foodModels.get(f.id);if(!model)continue;model.visible=f.ready<=now&&(!m||dist(m,f)<(lightweight?240:360));const halo=model.getObjectByName('food-ring');if(halo)halo.visible=!!m&&ANIMALS[m.species].foods.includes(f.kind)&&(input.current.instinct!==false||dist(m,f)<75);}
   const before=performance.now();renderer.render(scene,camera);frameCost=frameCost*.97+(performance.now()-before)*.03;
   sampleFrames++;sampleWork+=performance.now()-before;if(ms-sampleStart>=2000){const fps=sampleFrames*1000/(ms-sampleStart),renderMs=sampleWork/sampleFrames;const stats={fps:Math.round(fps),renderMs:Math.round(renderMs*10)/10,renderer:lightweight?'software':'webgl',quality:activeTier,drawCalls:renderer instanceof THREE.WebGLRenderer?renderer.info.render.calls:0};element.dataset.fps=fps.toFixed(1);element.dataset.renderMs=renderMs.toFixed(1);element.dataset.renderer=stats.renderer;element.dataset.drawCalls=String(stats.drawCalls);element.dataset.animalDrawCalls=String(animalBatches?.drawCalls||0);element.dataset.quality=activeTier;latest.current.onPerformance?.(stats);if(!document.hidden&&mode==='auto'&&!lightweight){slowSamples=(frameCost>25||(fps>5&&fps<40))?slowSamples+1:0;if(slowSamples>=2)autoTier='performance';}sampleStart=ms;sampleFrames=0;sampleWork=0;}
   if(ms-lastOverlay<50)return;lastOverlay=ms;ctx.clearRect(0,0,width,height);if(preview||!m||lowBudget)return;
   function label(text:string,x:number,y:number,z:number,color='#f0f3de'){view.set(x,y,z).applyMatrix4(camera.matrixWorldInverse);if(view.z>=-2)return;projected.set(x,y,z).project(camera);const sx=(projected.x*.5+.5)*width,sy=(-projected.y*.5+.5)*height;if(sx<20||sx>width-20||sy<100||sy>height-100)return;ctx.font='600 12px Arial';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#081711d9';ctx.strokeText(text,sx,sy);ctx.fillStyle=color;ctx.fillText(text,sx,sy);}
   const prey=players.filter(q=>q.id!==m.id&&!q.deadUntil&&!(q as Player&{concealed?:boolean}).concealed&&ANIMALS[m.species].prey.includes(q.species)).sort((a,b)=>dist(m,a)-dist(m,b));
   for(const p of players){const rig=rigs.get(p.id);if(!rig?.root.visible||p.id===m.id||dist(m,p)>400)continue;if(!p.bot)label(p.name,rig.root.position.x,rig.root.position.y+52,rig.root.position.z);}
   if(input.current.instinct!==false){
    for(const q of prey.slice(0,2)){const rig=rigs.get(q.id);if(rig)label(ANIMALS[q.species].name.toUpperCase()+' · '+Math.round(dist(m,q)/10)+' m',rig.root.position.x,rig.root.position.y+44,rig.root.position.z,'#ffce89');}
    const nearest=prey[0];if(nearest){const direction=Math.atan2(nearest.x-m.x,nearest.y-m.y)-yaw-Math.PI,angle=Math.atan2(Math.sin(direction),Math.cos(direction)),sx=width/2-THREE.MathUtils.clamp(angle/1.5,-1,1)*Math.min(220,width*.28);ctx.save();ctx.translate(sx,106);ctx.rotate(-angle);ctx.fillStyle='#f7ba6b';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(-5,4);ctx.lineTo(5,4);ctx.closePath();ctx.fill();ctx.restore();ctx.textAlign='center';ctx.font='600 12px Arial';ctx.fillStyle='#ffe1b3';ctx.fillText(ANIMALS[nearest.species].name+' · '+Math.round(dist(m,nearest)/10)+' m',sx,126);}
   }
   for(const t of ps)if(t.kind==='hollow'&&dist(m,t)<230)label('FOOD CACHE',t.x,groundY(t.x,t.y)+12,t.y,'#e3cea2');
   const mw=width<760?106:142,mh=mw*H/W,mx=width-mw-22,my=width<760?94:height-mh-24;
   ctx.fillStyle='#081b17da';ctx.fillRect(mx-8,my-24,mw+16,mh+32);ctx.strokeStyle='#b2d88d44';ctx.strokeRect(mx-8,my-24,mw+16,mh+32);ctx.textAlign='left';ctx.font='600 11px Arial';ctx.fillStyle='#bacab5';ctx.fillText('MOSSWOOD',mx,my-10);ctx.fillStyle='#244332';ctx.fillRect(mx,my,mw,mh);
   for(const t of ps){ctx.fillStyle=t.kind==='hollow'?'#ac9860':'#496749';ctx.fillRect(mx+t.x/W*mw,my+t.y/H*mh,2,2);}
   if(input.current.instinct!==false)for(const q of prey){ctx.fillStyle='#f2b16a';ctx.beginPath();ctx.arc(mx+q.x/W*mw,my+q.y/H*mh,2.5,0,Math.PI*2);ctx.fill();}
   ctx.save();ctx.translate(mx+m.x/W*mw,my+m.y/H*mh);ctx.rotate(-yaw);ctx.fillStyle='#e6f7b9';ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(-3,3);ctx.lineTo(3,3);ctx.closePath();ctx.fill();ctx.restore();
  };
  renderer.setAnimationLoop(render);
  return()=>{observer.disconnect();renderer.setAnimationLoop(null);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',drag);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);animalBatches?.dispose();forest.dispose();shadowGeo.dispose();shadowMat.dispose();for(const g of foodModels.values())g.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});renderer.dispose();renderer.forceContextLoss();canvas.remove();overlay.remove();};
 },[preview,input,assetsReady]);
 return <div ref={host} className="world-scene">{failure&&<div className="graphics-error" role="alert">{failure}</div>}{software&&!preview&&<span className="render-mode">Compatibility graphics</span>}</div>;
}
