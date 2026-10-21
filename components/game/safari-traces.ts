// Signs that animals have used the plains: footprints that follow each animal's real path and fade with age, worn game
// trails with old hoofprints, dung middens and hyena latrines, flattened resting spots in acacia shade, vultures circling
// over fresh carcasses, dust kicked up by running hooves and paws, and tall grass rustling as something pushes through.
// Everything here is decoration driven by the shared state: no trace reveals anything the room state doesn't, and a
// footprint is only ever left where an animal really walked.
import * as THREE from 'three';
import {ANIMALS,props,trails,inTallGrass,walkPace,type Species,type Prop} from '@/lib/game';
import {Model,hex,hash,facetMaterial} from './faceted';

type Kind='cat'|'hyena'|'hoof'|'cloven'|'pig';
const PRINT:Record<Species,Kind>={lion:'cat',leopard:'cat',hyena:'hyena',zebra:'hoof',impala:'cloven',warthog:'pig'};
// print length in metres, drawn about four times life size so a track reads from the follow camera (a game simplification)
const PRINT_SIZE:Record<Species,number>={lion:.48,leopard:.38,hyena:.4,zebra:.44,impala:.3,warthog:.28};
/** flat footprint shapes, about one unit long, lying on the ground and pointing along +x */
function printGeometry(kind:Kind){
 const parts:THREE.BufferGeometry[]=[];
 const disc=(x:number,z:number,rx:number,rz:number,n=7)=>{const g=new THREE.CircleGeometry(1,n).rotateX(-Math.PI/2);g.scale(rx,1,rz);g.translate(x,0,z);parts.push(g);};
 if(kind==='cat'||kind==='hyena'){
  // a three-lobed heel pad and four toes; hyenas show claw tips, cats keep their claws sheathed
  disc(-.12,0,.24,.28);for(const [x,z] of [[.22,-.24],[.3,-.08],[.3,.08],[.22,.24]])disc(x,z,.1,.09,6);
  if(kind==='hyena')for(const [x,z] of [[.36,-.25],[.44,-.08],[.44,.08],[.36,.25]])disc(x,z,.03,.03,4);
 }else if(kind==='hoof'){
  // a rounded zebra hoof: a solid wall with a frog notch at the heel
  disc(.05,0,.36,.33,9);disc(-.3,0,.08,.12,5);
 }else{
  // cloven hooves: two pointed halves (impala sharper and longer, warthog blunt)
  const sharp=kind==='cloven';for(const side of [-1,1])disc(.02,side*.12,sharp?.42:.32,.1,6);
 }
 const merged=mergeGeometries(parts);parts.forEach(p=>p.dispose());return merged;
}
function mergeGeometries(parts:THREE.BufferGeometry[]){
 const pos:number[]=[];for(const p of parts){const g=p.index?p.toNonIndexed():p,a=g.getAttribute('position');for(let i=0;i<a.count;i++)pos.push(a.getX(i),a.getY(i),a.getZ(i));if(g!==p)g.dispose();}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(pos.map((_,i)=>i%3===1?1:0),3));return g;
}

type Print={x:number;z:number;y:number;rot:number;scale:number;born:number;life:number;mud:boolean;species:Species};
const FRESH=hex(0x3e2a18),MUD=hex(0x271c10),OLD=hex(0xb89a5c);
export type TraceAnimal={id:string;species:Species;x:number;z:number;vx:number;vy:number;heading:number;visible:boolean;moving:boolean;quiet:boolean;onGround:boolean};
export type TraceFood={id:number;x:number;y:number;kind:string;ready:number;until?:number};

export class SafariTraces{
 private group=new THREE.Group();private disposables:{dispose():void}[]=[];
 private prints:Print[]=[];private printMeshes=new Map<Species,THREE.InstancedMesh>();private walkers=new Map<string,{x:number;z:number;side:number}>();
 private puffs:{x:number;y:number;z:number;vx:number;vy:number;vz:number;born:number;life:number;size:number;color:THREE.Color}[]=[];private puffMesh:THREE.InstancedMesh;
 private vultures:THREE.InstancedMesh;private m=new THREE.Matrix4();private q=new THREE.Quaternion();private e=new THREE.Euler();private v=new THREE.Vector3();private s=new THREE.Vector3();private c=new THREE.Color();
 private waters:Prop[];private ps:Prop[];private max:number;
 constructor(private scene:THREE.Scene,private ground:(x:number,z:number)=>number,lightweight:boolean){
  scene.add(this.group);this.ps=props(417);this.waters=this.ps.filter(p=>p.kind==='water');this.max=lightweight?260:900;
  const printMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.62,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});this.disposables.push(printMat);
  const shapes=new Map<Kind,THREE.BufferGeometry>();
  for(const s of Object.keys(PRINT) as Species[]){let g=shapes.get(PRINT[s]);if(!g){g=printGeometry(PRINT[s]);shapes.set(PRINT[s],g);this.disposables.push(g);}
   const mesh=new THREE.InstancedMesh(g,printMat,this.max);mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.setColorAt(0,FRESH);this.group.add(mesh);this.printMeshes.set(s,mesh);}
  // dust and grass flecks share one particle mesh: small faceted puffs, coloured per instance
  const puffGeo=new THREE.IcosahedronGeometry(1,0),puffMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.38,depthWrite:false});this.disposables.push(puffGeo,puffMat);
  this.puffMesh=new THREE.InstancedMesh(puffGeo,puffMat,lightweight?60:220);this.puffMesh.count=0;this.puffMesh.frustumCulled=false;this.puffMesh.setColorAt(0,OLD);this.group.add(this.puffMesh);
  // vultures: a dark faceted body with long fingered wings, circling high over a fresh kill
  const bird=new Model(77);bird.blob('v',[0,0,0],[.45,.12,.14],{detail:0,jitter:.1});
  for(const side of [-1,1])bird.loft('v#wing',[{c:[0,0,side*.08],rz:.02,ry:.22},{c:[-.05,.05,side*.9],rz:.02,ry:.2},{c:[-.12,.08,side*1.25],rz:.015,ry:.1}],{n:4,start:'flat',end:'point'});
  const birdGeo=bird.build((p,n,part)=>part.includes('#wing')?(n.y>0?hex(0x3b3128):hex(0x241d17)):hex(0x4a3d31),{v:[0,0,0]},.05).get('v')!.scale(10,10,10);
  const birdMat=facetMaterial();birdMat.fog=false;this.disposables.push(birdGeo,birdMat);this.vultures=new THREE.InstancedMesh(birdGeo,birdMat,48);this.vultures.count=0;this.vultures.frustumCulled=false;this.group.add(this.vultures);
  this.buildStatic(lightweight);
 }
 /** Trails worn by hooves, with old prints and a muddy, trampled crossing where each reaches the water; dung; resting spots. */
 private buildStatic(lightweight:boolean){
  const r=(a:number,b:number)=>hash(a*13.7,b*7.3,909);
  const old:Record<Species,Print[]>={lion:[],leopard:[],hyena:[],zebra:[],impala:[],warthog:[]};
  trails().forEach(([ax,ay,bx,by],ti)=>{
   const len=Math.hypot(bx-ax,by-ay),dir=Math.atan2(by-ay,bx-ax),step=lightweight?28:14;
   for(let d=0;d<len;d+=step){const i=Math.floor(d/step),t=d/len,x=ax+(bx-ax)*t+(r(ti,i)-.5)*14,z=ay+(by-ay)*t+(r(i,ti)-.5)*14;
    if(this.waters.some(w=>Math.hypot(x-w.x,z-w.y)<w.size*1.02)||this.ps.some(p=>p.kind==='rock'&&Math.hypot(x-p.x,z-p.y)<p.size*34))continue;
    const species:Species=r(ti,i+3)<.55?'zebra':r(ti,i+5)<.75?'impala':'warthog',mud=this.waters.some(w=>Math.hypot(x-w.x,z-w.y)<w.size*1.3);
    old[species].push({x,z,y:this.ground(x,z),rot:-(dir+(r(ti,i+9)<.5?Math.PI:0)),scale:PRINT_SIZE[species]*10,born:0,life:mud?1:.75,mud,species});}
  });
  this.staticPrints=old;
  // dung: impala middens near kopjes, zebra piles along the trails, chalk-white hyena latrines (bone in the diet)
  const pellets=new Model(41);for(let i=0;i<9;i++)pellets.blob('d',[(hash(i,1,4)-.5)*.5,.03,(hash(i,2,4)-.5)*.5],[.05,.035,.04],{detail:0,jitter:.2});
  const pile=new Model(42);for(let i=0;i<4;i++)pile.blob('d',[(hash(i,1,5)-.5)*.25,.05+i*.02,(hash(i,2,5)-.5)*.2],[.13,.07,.11],{detail:0,jitter:.25});
  const pelletGeo=pellets.build(()=>hex(0x3d3020),{d:[0,0,0]},.1).get('d')!.scale(10,10,10),pileGeo=pile.build(()=>hex(0x5b4a2c),{d:[0,0,0]},.12).get('d')!.scale(10,10,10),latrineGeo=pellets.build(()=>hex(0xe8e2cf),{d:[0,0,0]},.06).get('d')!.scale(12,12,12);
  const mat=facetMaterial();this.disposables.push(pelletGeo,pileGeo,latrineGeo,mat);
  const kopjes=this.ps.filter(p=>p.kind==='rock'&&p.size>=1.3),seg=trails();
  const place=(geo:THREE.BufferGeometry,items:{x:number;z:number}[])=>{const mesh=new THREE.InstancedMesh(geo,mat,Math.max(1,items.length));items.forEach((it,i)=>{this.m.compose(this.v.set(it.x,this.ground(it.x,it.z)+.1,it.z),this.q.setFromEuler(this.e.set(0,r(it.x,it.z)*6.3,0)),this.s.setScalar(.8+r(it.z,it.x)*.5));mesh.setMatrixAt(i,this.m);});mesh.count=items.length;this.group.add(mesh);};
  place(pelletGeo,kopjes.slice(0,10).map((k,i)=>({x:k.x+Math.cos(i*2.4)*190,z:k.y+Math.sin(i*2.4)*190})).filter(p=>!this.blocked(p.x,p.z)));
  place(pileGeo,seg.flatMap(([ax,ay,bx,by],i)=>[.3,.7].map(t=>({x:ax+(bx-ax)*t+12,z:ay+(by-ay)*t-8}))).filter(p=>!this.blocked(p.x,p.z)));
  place(latrineGeo,kopjes.slice(10,13).flatMap((k,i)=>[0,1,2].map(j=>({x:k.x-150+j*9,z:k.y+120+j*5+i}))).filter(p=>!this.blocked(p.x,p.z)));
  // resting spots: a flattened oval of pale grass in the shade of some acacias, where cats lie up through the heat
  const restGeo=new THREE.CircleGeometry(1,9).rotateX(-Math.PI/2),restMat=new THREE.MeshBasicMaterial({color:0xd9c48c,transparent:true,opacity:.55,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});this.disposables.push(restGeo,restMat);
  const trees=this.ps.filter((p,i)=>p.kind==='tree'&&i%5===0),rest=new THREE.InstancedMesh(restGeo,restMat,trees.length);
  trees.forEach((t,i)=>{this.m.compose(this.v.set(t.x+22,this.ground(t.x+22,t.y+6)+.3,t.y+6),this.q.setFromEuler(this.e.set(0,r(i,4)*3,0)),this.s.set(30,1,18));rest.setMatrixAt(i,this.m);});rest.count=trees.length;this.group.add(rest);
 }
 private staticPrints:Record<Species,Print[]>={lion:[],leopard:[],hyena:[],zebra:[],impala:[],warthog:[]};
 private blocked(x:number,z:number){return this.waters.some(w=>Math.hypot(x-w.x,z-w.y)<w.size*1.15)||this.ps.some(p=>(p.kind==='rock'||p.kind==='tree')&&Math.hypot(x-p.x,z-p.y)<(p.kind==='rock'?p.size*34:10));}
 private puff(x:number,y:number,z:number,now:number,color:THREE.Color,size:number,rise:number){if(this.puffs.length>=this.puffMesh.instanceMatrix.count)this.puffs.shift();this.puffs.push({x,y,z,vx:(Math.random()-.5)*6,vy:rise*(.6+Math.random()*.6),vz:(Math.random()-.5)*6,born:now,life:rise>10?.7:1.4,size,color});}
 /** now in seconds (server-synced clock); focus is the player's position; breeze the round's wind vector */
 update(animals:TraceAnimal[],foods:TraceFood[],nowMs:number,focus:{x:number;z:number},breeze:{x:number;y:number}){
  const now=nowMs/1000;
  for(const a of animals){
   if(!a.onGround||Math.hypot(a.x-focus.x,a.z-focus.z)>900){this.walkers.delete(a.id);continue;}
   let w=this.walkers.get(a.id);if(!w){this.walkers.set(a.id,w={x:a.x,z:a.z,side:1});continue;}
   const speed=Math.hypot(a.vx,a.vy),step=PRINT_SIZE[a.species]*10*(speed>walkPace(a.species)*1.05?4:2.4),moved=Math.hypot(a.x-w.x,a.z-w.z);
   if(moved>220){w.x=a.x;w.z=a.z;continue;}// respawn or teleport: no track across the gap
   if(moved<step)continue;
   const dx=(a.x-w.x)/moved,dz=(a.z-w.z)/moved;w.x=a.x;w.z=a.z;w.side=-w.side;
   const inWater=this.waters.some(o=>Math.hypot(a.x-o.x,a.z-o.y)<o.size*1.02);if(inWater)continue;
   const mud=this.waters.some(o=>Math.hypot(a.x-o.x,a.z-o.y)<o.size*1.3),half=PRINT_SIZE[a.species]*10*.55,x=a.x-dz*half*w.side,z=a.z+dx*half*w.side;
   // a stalking cat treads softly: its prints start out already faint
   this.prints.push({x,z,y:this.ground(x,z),rot:-Math.atan2(dz,dx),scale:PRINT_SIZE[a.species]*10,born:now-(a.quiet?25:0),life:mud?110:55,mud,species:a.species});
   if(this.prints.length>this.max*2.5)this.prints.splice(0,this.prints.length-this.max*2.5);
   // dust only off dry, open ground at a run; tall grass rustles and throws up seed flecks instead
   if(!a.visible||Math.hypot(a.x-focus.x,a.z-focus.z)>520)continue;
   const lush=this.waters.some(o=>Math.hypot(a.x-o.x,a.z-o.y)<o.size*2.1),grass=inTallGrass(this.ps,a.x,a.z),fast=speed>walkPace(a.species)*1.05;
   if(grass&&speed>12)for(let k=0;k<2;k++)this.puff(x+(Math.random()-.5)*8,this.ground(x,z)+8+Math.random()*6,z+(Math.random()-.5)*8,now,hex(0xe8cf86),.7,14);
   else if(fast&&!lush&&!mud)for(let k=0;k<2;k++)this.puff(a.x-dx*(10+k*6)+(Math.random()-.5)*6,this.ground(a.x,a.z)+2,a.z-dz*(10+k*6)+(Math.random()-.5)*6,now,hex(0xeadbb4),3.5+ANIMALS[a.species].size*3,4);
  }
  // footprints: one instanced mesh per species, fading from fresh to old ground colour
  for(const mesh of this.printMeshes.values())mesh.count=0;
  const draw=(p:Print,age:number)=>{const mesh=this.printMeshes.get(p.species)!;if(mesh.count>=this.max)return;if(Math.abs(p.x-focus.x)>520||Math.abs(p.z-focus.z)>520)return;
   this.m.compose(this.v.set(p.x,p.y+.35,p.z),this.q.setFromEuler(this.e.set(0,p.rot,0)),this.s.set(p.scale,1,p.scale));const i=mesh.count++;mesh.setMatrixAt(i,this.m);
   this.c.copy(p.mud?MUD:FRESH).lerp(OLD,Math.min(1,age));mesh.setColorAt(i,this.c);};
  this.prints=this.prints.filter(p=>now-p.born<p.life);
  for(let i=this.prints.length-1;i>=0;i--){const p=this.prints[i];draw(p,(now-p.born)/p.life);}
  for(const list of Object.values(this.staticPrints))for(const p of list)draw(p,p.mud?.35:.7);
  for(const mesh of this.printMeshes.values()){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  // particles drift a little downwind
  this.puffs=this.puffs.filter(p=>now-p.born<p.life);this.puffMesh.count=0;
  for(const p of this.puffs){const t=(now-p.born)/p.life,dt=now-p.born;this.m.compose(this.v.set(p.x+(p.vx+breeze.x*8)*dt,p.y+p.vy*dt-(p.vy>10?40*dt*dt:0),p.z+(p.vz+breeze.y*8)*dt),this.q.identity(),this.s.setScalar(p.size*(p.vy>10?1:1+t*2.2)*(1-t*.5)));const i=this.puffMesh.count++;this.puffMesh.setMatrixAt(i,this.m);this.puffMesh.setColorAt(i,p.color);}
  this.puffMesh.instanceMatrix.needsUpdate=true;if(this.puffMesh.instanceColor)this.puffMesh.instanceColor.needsUpdate=true;
  // vultures gather over a kill a little after it happens and leave as the carcass dries out
  this.vultures.count=0;
  for(const f of foods){if(f.kind!=='carrion'||!f.until||f.until<=nowMs||this.vultures.count>45)continue;const since=(nowMs-(f.until-90000))/1000;if(since<4)continue;const birds=Math.min(3,1+Math.floor((since-4)/5));
   for(let b=0;b<birds;b++){// (kept low, 14–21 m, so they show above the horizon from the follow camera; unfogged so they read from far off)
   const ang=now*.35+b*2.1+f.id,rad=90+b*25,h=this.ground(f.x,f.y)+140+b*35+Math.sin(now*.5+b)*12;this.m.compose(this.v.set(f.x+Math.cos(ang)*rad,h,f.y+Math.sin(ang)*rad),this.q.setFromEuler(this.e.set(.35,-(ang+Math.PI/2),0,'YXZ')),this.s.setScalar(1));this.vultures.setMatrixAt(this.vultures.count++,this.m);}}
  this.vultures.instanceMatrix.needsUpdate=true;
 }
 dispose(){this.scene.remove(this.group);for(const mesh of [...this.printMeshes.values(),this.puffMesh,this.vultures])mesh.dispose();this.disposables.forEach(d=>d.dispose());}
}
