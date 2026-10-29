// Food on the plains, faceted like everything else: fresh green grass, acacia browse, dug-up roots and old carcasses.
// One instanced mesh per kind, refilled each frame with the items that are ready and near the player.
import * as THREE from 'three';
import {Model,hex,hash,facetMaterial} from './faceted';

function geometry(kind:string){
 const m=new Model(kind.length*17);
 if(kind==='grass'){for(let i=0;i<7;i++){const a=i/7*6.28,r=.08+hash(i,1,1)*.1,h=.35+hash(i,2,1)*.25;m.spike('f#blade',[[Math.cos(a)*r,0,Math.sin(a)*r],[Math.cos(a)*(r+.08),h*.6,Math.sin(a)*(r+.08)],[Math.cos(a)*(r+.18),h,Math.sin(a)*(r+.18)]],[.03,.022,0],{n:3});}}
 else if(kind==='browse'){m.spike('f#twig',[[0,0,0],[.05,.45,.02],[.02,.8,0]],[.035,.025,.01],{n:4});for(const [x,y,z,s] of [[.0,.75,0,.28],[.2,.55,.1,.2],[-.18,.5,-.08,.22],[.05,.4,-.2,.18]])m.blob('f#leaf',[x,y,z],[s,s*.55,s],{jitter:.2});}
 else if(kind==='roots'){m.blob('f#soil',[0,.02,0],[.42,.1,.36],{jitter:.25});for(let i=0;i<3;i++){const a=i*2.1;m.blob('f#tuber',[Math.cos(a)*.18,.08,Math.sin(a)*.15],[.11,.07,.07],{jitter:.15,rot:[0,a,.3]});}m.spike('f#shoot',[[0,.05,0],[.03,.3,0]],[.015,0],{n:3});}
 else{for(let i=0;i<5;i++){const x=-.3+i*.16;m.spike('f#bone',[[x,.02,-.25],[x+.02,.28,-.12],[x+.03,.32,.05],[x+.02,.2,.25]],[.025,.022,.02,.008],{n:4,start:'point'});}m.loft('f#bone',[{c:[-.45,.06,0],rz:.04,ry:.04},{c:[.4,.08,0],rz:.04,ry:.04}],{n:5});m.blob('f#hide',[-.1,.05,.2],[.35,.06,.2],{jitter:.3});}
 return m.build((p,n,part)=>{
  if(part.includes('#blade'))return hex(0x6f9a36).lerp(hex(0xb7d061),p.y*2.2);
  if(part.includes('#leaf'))return n.y>.3?hex(0x8fae4a):hex(0x587a2e);
  if(part.includes('#twig'))return hex(0x5a4634);
  if(part.includes('#soil'))return hex(0x7a5a3c).multiplyScalar(.9+hash(p.x*50,p.z*50,1)*.2);
  if(part.includes('#tuber'))return hex(0xd7c08f);
  if(part.includes('#shoot'))return hex(0x7d9a3c);
  if(part.includes('#bone'))return hex(0xe9dfc6);
  return hex(0x7c4a32);
 },{f:[0,0,0]},.08).get('f')!.scale(10,10,10);
}

export type FoodItem={id:number;x:number;y:number;kind:string;ready:number;until?:number};
export class FoodField{
 private meshes=new Map<string,THREE.InstancedMesh>();private rings:THREE.InstancedMesh;private lit:THREE.InstancedMesh;private material=facetMaterial();private m=new THREE.Matrix4();private q=new THREE.Quaternion();private e=new THREE.Euler();private v=new THREE.Vector3();private s=new THREE.Vector3(1,1,1);
 constructor(private scene:THREE.Scene){
  for(const kind of ['grass','browse','roots','carrion']){const mesh=new THREE.InstancedMesh(geometry(kind),this.material,700);mesh.count=0;mesh.castShadow=true;mesh.frustumCulled=false;scene.add(mesh);this.meshes.set(kind,mesh);}
  this.rings=new THREE.InstancedMesh(new THREE.RingGeometry(10,12,20).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xf2d27a,transparent:true,opacity:.6,depthWrite:false}),700);this.rings.count=0;this.rings.frustumCulled=false;scene.add(this.rings);
  // the one item E would eat right now: a brighter, fuller ring
  this.lit=new THREE.InstancedMesh(new THREE.RingGeometry(8,13,24).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xfff2b0,transparent:true,opacity:.95,depthWrite:false}),1);this.lit.count=0;this.lit.frustumCulled=false;scene.add(this.lit);
 }
 update(foods:FoodItem[],now:number,focus:{x:number;y:number}|null,range:number,ground:(x:number,z:number)=>number,edible:(kind:string)=>boolean,showRings:(f:FoodItem)=>boolean,reach?:{x:number;y:number;range:number}){
  for(const mesh of this.meshes.values())mesh.count=0;this.rings.count=0;this.lit.count=0;let litD=reach?reach.range*reach.range:0,litAt:THREE.Vector3|null=null;
  for(const f of foods){
   // a fresh kill (a carcass that isn't open to scavengers yet) is drawn at once, so the hunter is seen feeding at it
   if(f.ready>now&&!f.until||f.until&&f.until<=now)continue;if(focus&&Math.hypot(focus.x-f.x,focus.y-f.y)>range)continue;
   const mesh=this.meshes.get(f.kind);if(!mesh)continue;const y=ground(f.x,f.y);
   this.q.setFromEuler(this.e.set(0,hash(f.id,3,7)*6.28,0));this.s.setScalar(.85+hash(f.id,5,1)*.35);this.m.compose(this.v.set(f.x,y,f.y),this.q,this.s);mesh.setMatrixAt(mesh.count++,this.m);
   if(reach&&f.ready<=now&&edible(f.kind)){const d=(f.x-reach.x)**2+(f.y-reach.y)**2;if(d<litD){litD=d;litAt=(litAt||new THREE.Vector3()).set(f.x,y+1,f.y);}}
   if(f.ready<=now&&edible(f.kind)&&showRings(f)){this.s.setScalar(1);this.m.compose(this.v.set(f.x,y+.8,f.y),this.q.identity(),this.s);this.rings.setMatrixAt(this.rings.count++,this.m);}
  }
  if(litAt){const pulse=1+Math.sin(now/180)*.08;this.s.setScalar(pulse);this.m.compose(litAt,this.q.identity(),this.s);this.lit.setMatrixAt(0,this.m);this.lit.count=1;}
  for(const mesh of [...this.meshes.values(),this.rings,this.lit])mesh.instanceMatrix.needsUpdate=true;
 }
 dispose(){for(const mesh of [...this.meshes.values(),this.rings,this.lit]){this.scene.remove(mesh);mesh.geometry.dispose();}this.material.dispose();(this.rings.material as THREE.Material).dispose();(this.lit.material as THREE.Material).dispose();}
}
