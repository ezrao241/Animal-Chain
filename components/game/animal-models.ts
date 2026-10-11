import * as THREE from 'three';
import {createRenderer,SoftwareRenderer} from './software-renderer';
import type {Species} from '@/lib/game';

// Articulated wildlife, modeled facing +X. Every moving part has its own joint.
const materials=new Map<number,THREE.MeshStandardMaterial>();
function mat(color:number){let m=materials.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.9,flatShading:false});materials.set(color,m);}return m;}
const sphere=new THREE.SphereGeometry(1,16,12),simpleSphere=new THREE.IcosahedronGeometry(1,1),box=new THREE.BoxGeometry(1,1,1),cone=new THREE.ConeGeometry(1,1,8),cylinder=new THREE.CylinderGeometry(1,1,1,8);
function part(parent:THREE.Object3D,geometry:THREE.BufferGeometry,color:number,pos:number[],scale:number[],rot:number[]=[0,0,0]){const m=new THREE.Mesh(geometry,mat(color));if(geometry===sphere)m.userData.softwareGeometry=simpleSphere;m.position.set(...pos as [number,number,number]);m.scale.set(...scale as [number,number,number]);m.rotation.set(...rot as [number,number,number]);m.updateMatrix();m.matrixAutoUpdate=false;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function joint(parent:THREE.Object3D,x:number,y:number,z:number){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
const tapers=new Map<string,THREE.CylinderGeometry>();
function tapered(parent:THREE.Object3D,color:number,a:number[],b:number[],r1:number,r2:number){const av=new THREE.Vector3(...a as [number,number,number]),bv=new THREE.Vector3(...b as [number,number,number]);const d=bv.clone().sub(av),key=(r2/r1).toFixed(6);let geometry=tapers.get(key);if(!geometry){geometry=new THREE.CylinderGeometry(r2/r1,1,1,6);tapers.set(key,geometry);}const m=new THREE.Mesh(geometry,mat(color));m.position.copy(av.add(bv).multiplyScalar(.5));m.scale.set(r1,d.length(),r1);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());m.updateMatrix();m.matrixAutoUpdate=false;m.castShadow=true;parent.add(m);return m;}
export type AnimalRig={root:THREE.Group;body:THREE.Group;head:THREE.Group;legs:THREE.Group[];knees:THREE.Group[];ears:THREE.Group[];tail:THREE.Group;wings:THREE.Group[];segments:THREE.Mesh[];species:Species;phase:number;stride:number;altitude:number;turn:number;born:number;lastX:number;lastZ:number};
export function makeAnimal(species:Species):AnimalRig{
 const root=new THREE.Group(),body=joint(root,0,0,0),head=joint(body,0,0,0),tail=joint(body,0,0,0);const rig:AnimalRig={root,body,head,tail,legs:[],knees:[],ears:[],wings:[],segments:[],species,phase:0,stride:0,altitude:0,turn:0,born:0,lastX:0,lastZ:0};
 if(species==='snake'){
  for(let i=0;i<19;i++){const radius=3.7*(1-i/23);const seg=part(body,sphere,i%3===0?0x343c34:0x4a5144,[-i*3,4,0],[4.3,radius,radius]);seg.matrixAutoUpdate=true;rig.segments.push(seg);if(i>2&&i<17&&i%2===0){for(const side of [-1,1])part(body,sphere,0x79805b,[-i*3,4+radius*.88,side*radius*.34],[2.1,.65,radius*.42]);}}
  head.position.set(3,4,0);part(head,sphere,0x343c31,[0,0,0],[7,3.6,4]);part(head,box,0xbcae79,[2,-1.8,0],[8,1.1,5.5]);for(const z of [-3.3,3.3]){part(head,sphere,0xbd963c,[3,1.2,z],[.9,1,.5]);part(head,sphere,0x101511,[3.4,1.2,z*1.05],[.3,.75,.3]);}return rig;
 }
 if(species==='owl'){
  body.position.y=14;part(body,sphere,0x64523e,[0,8,0],[12,17,10]);part(body,sphere,0xa49572,[5,7,0],[8,13,8]);for(const row of [0,1,2,3])for(const side of [-1,0,1])part(body,sphere,row%2?0x76644d:0x806f56,[12.1-Math.abs(row-1.5)*.35,10-row*3,side*2.4],[.65,1.5,.8]);head.position.set(2,23,0);part(head,sphere,0x66543c,[0,0,0],[12,10,11]);
  for(const z of [-5.5,5.5]){part(head,sphere,0xc3b58e,[8,0,z],[4,6,5]);part(head,sphere,0xba9439,[11,-.2,z],[1.4,2.7,2.3]);part(head,sphere,0x11130f,[12,-.1,z],[.6,1.8,1.4]);part(head,box,0x463c2e,[10,4,z],[4,2,7],[0,0,z>0?-.1:.1]);part(head,cone,0x3c382d,[-1,10,z*1.5],[4.3,12,4],[0,0,-.28]);}
  part(head,cone,0x1d241e,[12,-4,0],[2.7,6,3],[0,0,-Math.PI/2]);
  const facialDisk=part(head,sphere,0xe1d5b0,[8,0,0],[9,8,9.5]);facialDisk.scale.set(1.1,1,1);facialDisk.rotation.y=.12;
  for(const side of [-1,1]){const wing=joint(body,-2,14,side*8);rig.wings.push(wing);
   part(wing,sphere,0x68553e,[-4,0,side*12],[10,3.8,17]);
   for(let i=0;i<7;i++){const feather=part(wing,box,i%2?0x413d32:0x827252,[-9+i*2.6,-.7,side*(21+(i<4?i:6-i)*1.8)],[4,1.4,22-i*.7],[0,side*(-.28+i*.08),0]);feather.userData.feather=true;}
   const foot=joint(body,4,-7,side*5);rig.legs.push(foot);part(foot,cylinder,0x9c8a56,[0,-4,0],[1.5,8,1.5]);for(let i=-1;i<=1;i++)part(foot,box,0x78683e,[3,-8,i*1.7],[8,1.4,1.1]);
  }
  tail.position.set(-10,0,0);for(let i=-1;i<=1;i++)part(tail,box,0x514a36,[-6,-2,i*3],[16,2,3],[0,0,-.2]);return rig;
 }
 const fox=species==='fox',rabbit=species==='rabbit',squirrel=species==='squirrel',mouse=species==='mouse';const coat=fox?0xac512b:rabbit?0x837258:squirrel?0x77786f:mouse?0x766b67:0x746653;const dark=fox?0x302c25:mouse?0x504542:0x494438,light=fox?0xcfc4a2:rabbit?0xb4a78c:mouse?0xc4b2a5:0xb5b19a;
 const bodyY=fox?24:rabbit?13:squirrel?15:9;body.position.y=bodyY;
 part(body,sphere,coat,[fox?-2:-3,0,0],[fox?23:rabbit?15:squirrel?17:mouse?12:13,fox?10:rabbit?11:squirrel?9:mouse?5.5:6,fox?8:rabbit?9:squirrel?7:mouse?4.8:5]);
 if(fox){part(body,sphere,light,[8,-4,0],[12,6,6]);part(body,sphere,light,[-4,-7,0],[8,5,5]);part(body,sphere,0x8f4329,[-8,9.2,0],[12,.75,4.8]);}
 else if(mouse){part(body,sphere,light,[1,-2,0],[8,3.8,3.7]);}
 else{part(body,sphere,light,[3,-3,0],[9,6,5]);if(rabbit)for(const side of [-1,1])part(body,sphere,coat,[-8,-1,side*4.2],[8,8,4.8]);if(squirrel)part(body,sphere,light,[3,-7,0],[8,5,4.8]);}
 if(rabbit||squirrel||mouse){
  const stripeColor=rabbit?0x9b896a:squirrel?0x4f504b:0x514947;
  const stripeY=rabbit?10.7:squirrel?8.65:5.3;
  part(body,sphere,stripeColor,[-4,stripeY,0],[rabbit?9:10,.45,rabbit?5.8:2.2]);
  if(squirrel)for(const side of [-1,1])part(body,sphere,0xaaa18d,[-8,3,side*6.2],[7,1.1,.7]);
 }
 head.position.set(fox?19:rabbit?10:squirrel?13:mouse?10:11,fox?4:rabbit?6:squirrel?3:mouse?1:1,0);
 part(head,sphere,coat,[0,0,0],[fox?9:rabbit?8:squirrel?7:mouse?6.5:6,fox?7:rabbit?7:squirrel?6:mouse?5.5:6,fox?6:mouse?5.7:5]);
 if(fox){tapered(head,coat,[2,-1,0],[16,-3,0],5,1.8);part(head,sphere,light,[8,-4,0],[7,2.6,3.5]);part(head,sphere,0x20221e,[16,-2.5,0],[2,1.7,2]);part(head,cone,0x8a472f,[15,-.5,0],[4,8,2.4],[0,0,-.28]);}
 else if(mouse){part(head,sphere,light,[5,-2,0],[4.6,2.7,3.5]);part(head,sphere,0x9d726f,[9,-.8,0],[1.1,.9,1.4]);}
 else{part(head,sphere,light,[5,-2,0],[rabbit?5:4,3,3.3]);part(head,sphere,0x332c24,[rabbit?9:8,-1.5,0],[1.2,1,1.3]);}
 for(const side of [-1,1]){
  const eyeX=fox?4:3,eyeZ=side*(fox?5.2:mouse?4.6:4.4);
  if(fox||rabbit||squirrel)part(head,sphere,fox?0xd5c3a2:rabbit?0xb7a98f:0xb0a58d,[eyeX,1.5,eyeZ*.91],[fox?2.1:1.9,fox?2.2:2,.9]);
  part(head,sphere,0x131914,[eyeX,1.5,eyeZ],[fox?1.1:mouse?1.35:1.1,fox?1.25:mouse?1.5:1.35,.65]);
  part(head,sphere,0xf4e9cf,[eyeX+.25,2,eyeZ+side*.45],[.35,.38,.18]);
  if(fox)part(head,box,0x784526,[2,3,side*5.2],[5,1.3,1.5],[0,0,-.18]);
  const ear=joint(head,fox?-3:-2,fox?5:5,side*(fox?4.3:3.7));rig.ears.push(ear);
  if(rabbit){part(ear,sphere,coat,[-1,10,0],[2.7,13,2]);part(ear,sphere,0xa88675,[.6,11,0],[1.4,9,1.3]);ear.rotation.z=.12;}
  else if(fox||squirrel){part(ear,cone,dark,[0,5,0],[4.2,12,3.3],[0,0,.07]);part(ear,cone,fox?0xc79c78:0x8f9080,[.8,4.8,0],[2.4,8,2]);}
  else if(mouse){part(ear,sphere,coat,[0,4,0],[4.8,5.5,1.7]);part(ear,sphere,0xb98280,[.7,4,0],[3.2,3.9,1.15]);}
  else{part(ear,sphere,coat,[0,3,0],[3.5,4.5,1.4]);part(ear,sphere,0x9f8372,[.6,3,0],[2.4,3.2,1.2]);}
 }
 if(mouse||rabbit)for(const side of [-1,1])for(let i=0;i<2;i++)tapered(head,mouse?0xb7a59c:0xa99a85,[5,-2-i*.6,side*2.5],[10,-2-i*1.4,side*(7+i*1.3)],.32,.08);
 const frontX=fox?12:rabbit?8:species==='mouse'?7:10,backX=fox?-15:rabbit?-9:species==='mouse'?-7:-11;
 for(let i=0;i<4;i++){const front=i<2,side=i%2===0?-1:1;const upper=joint(body,front?frontX:backX,-3,side*(fox?5.5:rabbit?6:4));rig.legs.push(upper);const upperLen=fox?10:rabbit?(front?5:7):squirrel?7:4;
  part(upper,sphere,front?coat:coat,[front?0:-2,-upperLen/2,0],[front?2.5:rabbit?5:3.5,upperLen/2+2,front?2.4:3]);
  const knee=joint(upper,front?0:-2,-upperLen,0);rig.knees.push(knee);const lowerLen=bodyY-upperLen-3;
  part(knee,cylinder,fox?dark:coat,[0,-lowerLen/2,0],[fox?1.4:1.5,lowerLen,1.4]);part(knee,sphere,fox?dark:light,[2,-lowerLen,.2],[rabbit&&!front?6:3,1.6,2]);
 }
 tail.position.set(fox?-21:rabbit?-15:squirrel?-17:-12,0,0);
 if(fox){tapered(tail,coat,[0,1,0],[-21,-3,0],5.5,8);tapered(tail,light,[-21,-3,0],[-37,-6,0],8,1.2);tail.rotation.y=.12;}
 else if(rabbit)part(tail,sphere,0xd6cec0,[-2,2,0],[4.5,4.5,4.5]);
 else if(squirrel){tapered(tail,0x656960,[0,0,0],[-8,14,0],5,9);tapered(tail,0x777b70,[-8,14,0],[-6,31,0],9,11);tapered(tail,0x858779,[-6,31,0],[5,35,0],11,5);for(const side of [-1,1])part(tail,sphere,0xb1a58d,[-6,24,side*8],[4,2,1.2]);}
 else if(mouse){tapered(tail,0x9d7770,[0,0,0],[-17,-2,0],1.5,.8);tapered(tail,0x9d7770,[-17,-2,0],[-34,-1,0],.8,.22);}
 else{for(let i=0;i<6;i++)part(tail,cylinder,0x8c7660,[-i*4-2,0,0],[.9-i*.11,5,.9-i*.11],[0,0,Math.PI/2]);}
 return rig;
}
export type Pose={speed:number;time:number;dt:number;flying?:boolean;perched?:boolean;climbing?:boolean;ability?:boolean;action?:boolean;dive?:number;altitude?:number};
export function animateAnimal(r:AnimalRig,p:Pose){
 const moving=Math.min(1,p.speed/90);r.stride=THREE.MathUtils.damp(r.stride,moving,13,p.dt);r.phase+=p.dt*(r.species==='mouse'?17:r.species==='rabbit'?12:10)*(p.speed/140+.3);const t=r.phase,s=r.stride;
 const breath=Math.sin(p.time*2.5)*.25;
 if(r.species==='snake'){r.segments.forEach((seg,i)=>{seg.position.z=Math.sin(t-i*.52)*(3+s*6)*(Math.min(i/4,1));seg.position.y=3+Math.sin(t-i*.35)*s*.3;seg.rotation.y=Math.cos(t-i*.52)*.32*s;});r.head.rotation.y=Math.sin(t)*.1;r.head.position.y=4+breath;return;}
 if(r.species==='owl'){
  const flight=p.flying?1:0;const target=p.perched?(p.altitude||72):flight?68:0;
  const dive=p.dive||0;const height=target*(1-Math.sin(dive*Math.PI)*.92);
  r.altitude=THREE.MathUtils.damp(r.altitude,height,p.perched?5:7,p.dt);r.root.position.y+=r.altitude;
  r.body.rotation.z=THREE.MathUtils.damp(r.body.rotation.z,flight?-.22-s*.18:0,7,p.dt);
  r.body.position.y=14+breath+(flight?Math.sin(p.time*4)*1.3:Math.sin(t*2)*s*1.3);
  r.wings.forEach((w,i)=>{const side=i===0?-1:1;const flap=flight?Math.sin(p.time*11)*.57:1.27;w.rotation.x=THREE.MathUtils.damp(w.rotation.x,side*flap,12,p.dt);w.rotation.y=THREE.MathUtils.damp(w.rotation.y,flight?side*.18:side*.15,8,p.dt);});
  r.legs.forEach((l,i)=>{l.rotation.z=flight?-.7:Math.sin(t+i*Math.PI)*s*.4;});r.head.rotation.y=Math.sin(p.time*.8)*.12*(1-s);return;
 }
 const hop=r.species==='rabbit';const base=r.species==='fox'?24:hop?13:r.species==='squirrel'?15:9;
 r.body.position.y=base+breath+(hop?Math.max(0,Math.sin(t))*s*7:Math.cos(t*2)*s*1.2);
 r.body.rotation.z=hop?Math.cos(t)*s*.09:Math.sin(t*2)*s*.025;
 // Species-specific head and balance cues: prey keep their heads low and alert,
 // while the fox counterbalances its stride through the neck and tail.
 r.head.position.y=(r.species==='fox'?4:r.species==='squirrel'?3:r.species==='mouse'?1:6)+Math.sin(t*2+.4)*s*(r.species==='fox'?.9:.45);
 r.head.rotation.z=(p.action?Math.sin(p.time*18)*.18:Math.sin(t+.5)*s*.045);
 r.head.rotation.y=Math.sin(p.time*.7)*.07*(1-s);
 r.legs.forEach((l,i)=>{const phase=hop?(i<2?0:Math.PI*.7):i===0||i===3?0:Math.PI;const swing=Math.sin(t+phase);l.rotation.z=swing*s*(hop?.8:.65);r.knees[i].rotation.z=Math.max(0,-swing)*s*(hop?.9:.55);});
 r.tail.rotation.y=Math.sin(t*.6)*(.08+s*.17);r.tail.rotation.z=Math.sin(t)*s*.06;r.ears.forEach((e,i)=>e.rotation.z=(hop?.12:0)+Math.sin(t-i*.4)*s*.07);
 if(p.climbing){r.altitude=THREE.MathUtils.damp(r.altitude,52,5,p.dt);r.root.position.y+=r.altitude;r.body.rotation.z=.9;}else{r.altitude=THREE.MathUtils.damp(r.altitude,0,7,p.dt);r.root.position.y+=r.altitude;}
}
let portraitRenderer:THREE.WebGLRenderer|SoftwareRenderer|undefined;const portraitCache=new Map<Species,string>();
export function animalPortrait(species:Species){if(portraitCache.has(species))return portraitCache.get(species)!;
 try{if(!portraitRenderer){portraitRenderer=createRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});portraitRenderer.setSize(192,160);portraitRenderer.setPixelRatio(1);portraitRenderer.outputColorSpace=THREE.SRGBColorSpace;}
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xfff8dc,0x253128,2.5));const sun=new THREE.DirectionalLight(0xffebbb,3);sun.position.set(50,100,60);scene.add(sun);const rig=makeAnimal(species);scene.add(rig.root);animateAnimal(rig,{speed:0,time:0,dt:.1});
 const camera=new THREE.PerspectiveCamera(35,192/160,.1,500);const zoom=species==='mouse'?.45:species==='rabbit'?.56:species==='fox'?.72:.62;camera.position.set(100*zoom,67*zoom,135*zoom);camera.lookAt(-4,species==='owl'?22:species==='snake'?5:18,0);portraitRenderer.render(scene,camera);const url=portraitRenderer.domElement.toDataURL('image/png');portraitCache.set(species,url);return url;}catch{return '';}}
