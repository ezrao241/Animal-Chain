// The Golden Plains: a faceted African savanna built in code from the shared prop table (lib/game.ts), so the
// colliders the server uses and the acacias, kopjes, thickets, burrows and watering holes the player sees always agree.
// Terrain is a faceted height grid; groundY() interpolates the same triangles, so animals stand exactly on the facets.
import * as THREE from 'three';
import {W,H,props,type Prop} from '@/lib/game';
import {Model,hex,hash,facetMaterial} from './faceted';

const S=40,X0=-1600,Z0=-1600,NX=Math.ceil((W+3200)/S)+1,NZ=Math.ceil((H+3200)/S)+1;
const PROPS=props(417),WATERS=PROPS.filter(p=>p.kind==='water'),KOPJES=PROPS.filter(p=>p.kind==='rock'&&p.size>=1.3),BURROWS=PROPS.filter(p=>p.kind==='burrow');
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function rolling(x:number,z:number){return 18*Math.sin(x*.0021+1.3)*Math.cos(z*.0017)+9*Math.sin(x*.0052+z*.0041)+4*Math.sin(x*.013-z*.011);}
/** surface height of each watering hole (the land around it is levelled to its centre, then dished) */
export const waterLevel=(w:Prop)=>rolling(w.x,w.y)-7;
function height(x:number,z:number){
 let h=rolling(x,z);
 for(const w of WATERS){const d=Math.hypot(x-w.x,z-w.y);if(d<w.size*2.3){const c=rolling(w.x,w.y);h=c+(h-c)*smooth(w.size*1.2,w.size*2.2,d);const t=d/(w.size*1.35);if(t<1)h-=26*(1-t*t)**2;}}
 for(const k of KOPJES){const d=Math.hypot(x-k.x,z-k.y);if(d<230)h+=24*(1-smooth(0,230,d));}
 // outside the playable map the land rises into low hills that frame the horizon
 const out=Math.max(-x,x-W,-z,z-H,0);if(out>0)h+=smooth(0,1200,out)*140+Math.sin(x*.004)*Math.cos(z*.005)*30*smooth(0,600,out);
 return h;
}
let GRID:Float32Array|null=null;
function grid(){if(GRID)return GRID;GRID=new Float32Array(NX*NZ);for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++)GRID[j*NX+i]=height(X0+i*S,Z0+j*S);return GRID;}
/** Height of the faceted ground at (x, z) in game units, on the very triangle the renderer draws. */
export function groundY(x:number,z:number){
 const g=grid(),fx=Math.min(Math.max((x-X0)/S,0),NX-1.001),fz=Math.min(Math.max((z-Z0)/S,0),NZ-1.001),i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j,k=j*NX+i;
 const h00=g[k],h10=g[k+1],h01=g[k+NX],h11=g[k+NX+1];
 return u>=v?h00+(h10-h00)*u+(h11-h10)*v:h00+(h11-h01)*u+(h01-h00)*v;
}
const GRASS=[0xd2ad5a,0xc9a14c,0xdcbb6c,0xbf9645,0xd6b062],DRY=0xb48a48,GREEN=0x9c9a4c,MUD=0x76603e,ROCKY=0xa69a82;
function groundColour(x:number,z:number,r:number){
 let c=hex(GRASS[Math.floor(r*GRASS.length)]);
 const n=Math.sin(x*.0031+Math.sin(z*.0023)*2)*Math.cos(z*.0027);c.lerp(hex(DRY),Math.max(0,n)*.45);
 for(const w of WATERS){const d=Math.hypot(x-w.x,z-w.y);if(d<w.size*2.4)c.lerp(hex(GREEN),(1-smooth(w.size*1.2,w.size*2.4,d))*.75);if(d<w.size*1.25)c.lerp(hex(MUD),1-smooth(w.size*.95,w.size*1.25,d));}
 for(const k of KOPJES){const d=Math.hypot(x-k.x,z-k.y);if(d<170)c.lerp(hex(ROCKY),(1-smooth(60,170,d))*.6);}
 for(const b of BURROWS)if(Math.hypot(x-b.x,z-b.y)<40)c.lerp(hex(0x8a6a44),.5);
 if(x<0||z<0||x>W||z>H)c.lerp(hex(0xb99a62),.25);
 return c;
}
function terrain(){
 const g=grid(),pos:number[]=[],col:number[]=[];
 const put=(i:number,j:number)=>pos.push(X0+i*S,g[j*NX+i],Z0+j*S);
 for(let j=0;j<NZ-1;j++)for(let i=0;i<NX-1;i++){
  const x=X0+(i+.5)*S,z=Z0+(j+.5)*S;
  for(const [tri,ox,oz] of [[[[i,j],[i+1,j+1],[i+1,j]],.66,.33],[[[i,j],[i,j+1],[i+1,j+1]],.33,.66]] as const){
   for(const [a,b] of tri)put(a,b);
   const c=groundColour(x+(ox-.5)*S,z+(oz-.5)*S,hash(i*7+ox*3,j*13+oz*5,1));c.multiplyScalar(.93+hash(i,j,ox*9)*.12);for(let k=0;k<3;k++)col.push(c.r,c.g,c.b);
  }
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.computeVertexNormals();
 const mesh=new THREE.Mesh(geo,facetMaterial());mesh.receiveShadow=true;return mesh;
}

// ---------------------------------------------------------------- vegetation and rocks (authored in metres, placed x10)
function acacia(seed:number,lod=0){
 const m=new Model(seed,lod),r=(a:number,b:number)=>a+hash(seed,a*100,b*100)*(b-a),fork=2.6+r(0,.6);
 m.loft('t#bark',[{c:[0,-.3,0],rz:.24,ry:.24},{c:[0,1.2,0],rz:.17,ry:.17},{c:[.15,fork,0],rz:.15,ry:.15}],{n:6,jitter:.08,start:'flat',end:'point'});
 const branches=3+Math.floor(r(0,1.9));
 for(let b=0;b<branches;b++){
  const a=b/branches*Math.PI*2+r(-.3,.3),out=2.2+r(0,1.6),top=fork+1.6+r(0,1.1),mid:[number,number,number]=[Math.cos(a)*out*.45+.15,fork+(top-fork)*.6,Math.sin(a)*out*.45],tip:[number,number,number]=[Math.cos(a)*out,top,Math.sin(a)*out];
  m.spike('t#bark',[[.15,fork-.2,0],mid,tip],[.13,.085,.04],{n:5});
  // flat-topped umbrella canopy: overlapping faceted pads at the branch tips
  m.blob('t#leaf',[tip[0],top+.35,tip[2]],[1.9+r(0,.8),.42+r(0,.15),1.9+r(0,.8)],{detail:1,jitter:.18,rot:[0,a,0]});
 }
 m.blob('t#leaf',[.1,fork+2.4+r(0,.5),0],[2.6+r(0,.6),.5,2.4+r(0,.6)],{detail:1,jitter:.16});
 return m.build((p,n,part)=>part.includes('#bark')?(n.y>.4?hex(0x7a6650):hex(0x4f4034)).multiplyScalar(.9+hash(p.x*40,p.y*40,p.z*40)*.2):n.y>.55?hex([0x8ea047,0x7f9640,0x9aab52][Math.floor(hash(p.x*9,p.z*9,1)*3)]):n.y<-.3?hex(0x3c5223):hex(0x5f7b33),{t:[0,0,0]},.1).get('t')!;
}
function boulder(seed:number,lod=0){const m=new Model(seed,lod);m.blob('b',[0,.15,0],[1,.72,1],{detail:1,jitter:.22});return m.build((p,n)=>{const c=hex([0xa49a88,0x9b8a72,0xb0a28a,0x8f8676][Math.floor(hash(p.x*20,p.y*20,p.z*20)*4)]);if(n.y>.6)c.lerp(hex(0xcab894),.35);if(hash(p.x*31,p.y*31,p.z*31)>.86)c.lerp(hex(0xc2a65c),.6);return c;},{b:[0,0,0]},.06).get('b')!;}
function shrub(seed:number){const m=new Model(seed);m.blob('s',[0,.55,0],[1.1,.75,1.1],{detail:1,jitter:.24});m.blob('s',[.6,.4,.3],[.7,.5,.7],{detail:0,jitter:.2});return m.build((p,n)=>n.y>.4?hex(0x7d8f3c):n.y<-.2?hex(0x3e4a22):hex(0x5f7030),{s:[0,0,0]},.12).get('s')!;}
function tuft(seed:number,tall:boolean){
 // a clump of blades; vertex colours run from shaded straw at the base to pale gold tips
 const pos:number[]=[],col:number[]=[],blades=tall?9:6;
 for(let b=0;b<blades;b++){const a=b/blades*Math.PI*2+hash(seed,b,1)*1.2,lean=.18+hash(seed,b,2)*.35,h=(tall?1.15:.42)*(.65+hash(seed,b,3)*.6),w=.035+hash(seed,b,4)*.03,r=.12+hash(seed,b,5)*.14;
  const bx=Math.cos(a)*r,bz=Math.sin(a)*r,tx=bx+Math.cos(a)*lean*h,tz=bz+Math.sin(a)*lean*h,px=-Math.sin(a)*w,pz=Math.cos(a)*w;
  pos.push(bx-px,0,bz-pz,bx+px,0,bz+pz,tx,h,tz);const base=hex(0xa98a48),tip=hex(hash(seed,b,6)>.3?0xf0dc98:0xe2c271);col.push(base.r,base.g,base.b,base.r,base.g,base.b,tip.r,tip.g,tip.b);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(pos.map((_,i)=>i%3===1?1:0),3));g.scale(10,10,10);return g;
}
/** Grass bends in the wind: the higher a vertex, the further it sways. */
function windy(material:THREE.MeshStandardMaterial,time:{value:number}){
 material.onBeforeCompile=shader=>{shader.uniforms.uTime=time;shader.vertexShader='uniform float uTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  #ifdef USE_INSTANCING
  vec3 iPos=instanceMatrix[3].xyz;
  #else
  vec3 iPos=vec3(0.);
  #endif
  float sway=sin(uTime*1.7+iPos.x*.013+iPos.z*.011)*.5+sin(uTime*2.9+iPos.x*.031)*.25;
  transformed.x+=sway*transformed.y*.16;transformed.z+=sway*transformed.y*.07;`);};
 return material;
}

type Placed={x:number;y:number;z:number;rot:number;scale:number;sy?:number};
function instanced(geometry:THREE.BufferGeometry,material:THREE.Material,items:Placed[],shadow=true){
 const mesh=new THREE.InstancedMesh(geometry,material,Math.max(1,items.length)),m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();
 items.forEach((it,i)=>{q.setFromEuler(e.set(0,it.rot,0));m.compose(new THREE.Vector3(it.x,it.y,it.z),q,new THREE.Vector3(it.scale,it.scale*(it.sy??1),it.scale));mesh.setMatrixAt(i,m);});
 mesh.count=items.length;mesh.castShadow=shadow;mesh.receiveShadow=true;mesh.computeBoundingSphere();return mesh;
}

export type Savanna={update(time:number,x:number,z:number,range:number,cameraFar:number,camera:THREE.Vector3):void;dispose():void};
export function createSavanna(scene:THREE.Scene,lightweight:boolean):Savanna{
 const disposables:{dispose():void}[]=[],add=<T extends THREE.Object3D>(o:T)=>{scene.add(o);return o;};
 const ground=add(terrain());disposables.push(ground.geometry,ground.material as THREE.Material);
 const facet=facetMaterial();disposables.push(facet);
 const r=(i:number,k:number)=>hash(i,k,417);
 // acacias, three shapes
 const lods:{near:THREE.InstancedMesh;far:THREE.InstancedMesh;items:Placed[]}[]=[];
 const leveled=(near:THREE.BufferGeometry,far:THREE.BufferGeometry,items:Placed[])=>{const a=add(instanced(near,facet,items)),b=add(instanced(far,facet,items));lods.push({near:a,far:b,items});disposables.push(near,far);};
 const trees=PROPS.filter(p=>p.kind==='tree');
 [11,23,37].forEach((seed,v)=>leveled(acacia(seed),acacia(seed,1),trees.filter((_,i)=>i%3===v).map((t,i)=>({x:t.x,y:groundY(t.x,t.y),z:t.y,rot:r(i,v)*6.28,scale:10*t.size}))));
 // kopjes: boulders half sunk into their mounds
 const rocks=PROPS.filter(p=>p.kind==='rock');
 [5,9,17,29].forEach((seed,v)=>leveled(boulder(seed),boulder(seed,1),rocks.filter((_,i)=>i%4===v).map((t,i)=>({x:t.x,y:groundY(t.x,t.y)-t.size*6,z:t.y,rot:r(i,v+5)*6.28,scale:t.size*33,sy:.85+r(i,v+9)*.4}))));
 // level of detail: trees and boulders near the player use the full-facet model, distant ones a lighter cut
 const NEAR_LOD=lightweight?220:420,mat=new THREE.Matrix4(),quat=new THREE.Quaternion(),eul=new THREE.Euler(),lodAt={x:1e9,z:1e9};
 const relevel=(x:number,z:number)=>{for(const l of lods){l.near.count=0;l.far.count=0;for(const it of l.items){quat.setFromEuler(eul.set(0,it.rot,0));mat.compose(new THREE.Vector3(it.x,it.y,it.z),quat,new THREE.Vector3(it.scale,it.scale*(it.sy??1),it.scale));const near=Math.hypot(it.x-x,it.z-z)<NEAR_LOD,mesh=near?l.near:l.far;mesh.setMatrixAt(mesh.count++,mat);}for(const mesh of [l.near,l.far]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}}};
 // thickets: a scrub bush wrapped in tall grass (the hiding spots)
 const bushes=PROPS.filter(p=>p.kind==='bush'),shrubGeo=shrub(3);disposables.push(shrubGeo);
 add(instanced(shrubGeo,facet,bushes.map((b,i)=>({x:b.x,y:groundY(b.x,b.y),z:b.y,rot:r(i,2)*6.28,scale:b.size*8,sy:.75+r(i,4)*.35}))));
 // burrows: a dark hole ringed by a lip of dug earth
 const holeGeo=new THREE.CircleGeometry(5.5,7).rotateX(-Math.PI/2),holeMat=new THREE.MeshBasicMaterial({color:0x1d140c}),lipGeo=new THREE.TorusGeometry(7,2.4,3,8).rotateX(Math.PI/2);disposables.push(holeGeo,holeMat,lipGeo);
 add(instanced(holeGeo,holeMat,BURROWS.map((b,i)=>({x:b.x,y:groundY(b.x,b.y)+.6,z:b.y,rot:r(i,8)*6.28,scale:1})),false));
 add(instanced(lipGeo,new THREE.MeshStandardMaterial({color:0x8a6844,flatShading:true,roughness:1}),BURROWS.map((b,i)=>({x:b.x,y:groundY(b.x,b.y)+.3,z:b.y,rot:r(i,8)*6.28,scale:1,sy:.6}))));
 // grass: tufts scattered over the plains in chunks, so distant chunks can be skipped
 const time={value:0},grassMat=windy(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,side:THREE.DoubleSide}),time);disposables.push(grassMat);
 const shortGeo=[tuft(1,false),tuft(2,false),tuft(3,false)],tallGeo=tuft(4,true);disposables.push(...shortGeo,tallGeo);
 const CH=400,chunks:{mesh:THREE.InstancedMesh;cx:number;cz:number;full:number}[]=[];
 const blocked=(x:number,z:number)=>WATERS.some(w=>Math.hypot(x-w.x,z-w.y)<w.size*1.05)||rocks.some(t=>Math.hypot(x-t.x,z-t.y)<t.size*30)||BURROWS.some(b=>Math.hypot(x-b.x,z-b.y)<14);
 const density=lightweight?.35:1;
 for(let cz=-1;cz<Math.ceil(H/CH)+1;cz++)for(let cx=-1;cx<Math.ceil(W/CH)+1;cx++){
  const per:Placed[][]=[[],[],[],[]],count=Math.floor(520*density*(cx<0||cz<0||cx*CH>=W||cz*CH>=H?.5:1));
  for(let i=0;i<count;i++){const x=cx*CH+hash(cx,cz,i*3)*CH,z=cz*CH+hash(cx,cz,i*3+1)*CH;if(blocked(x,z))continue;
   // denser, lusher grass towards water; thinner on kopje slopes
   const lush=WATERS.some(w=>Math.hypot(x-w.x,z-w.y)<w.size*2.2);if(!lush&&hash(x,z,7)<.25)continue;
   per[i%3].push({x,y:groundY(x,z)-1,z,rot:hash(x,z,2)*6.28,scale:.8+hash(x,z,3)*.7});}
  for(const b of bushes)if(Math.floor(b.x/CH)===cx&&Math.floor(b.y/CH)===cz)for(let k=0;k<12;k++){const a=k/12*6.28+hash(b.x,k,1),d=(6+hash(b.y,k,2)*18)*b.size;per[3].push({x:b.x+Math.cos(a)*d,y:groundY(b.x,b.y)-1,z:b.y+Math.sin(a)*d,rot:a,scale:b.size*(1+hash(k,b.x,3)*.5)});}
  per.forEach((items,v)=>{if(!items.length)return;const mesh=add(instanced(v<3?shortGeo[v]:tallGeo,grassMat,items,false));chunks.push({mesh,cx:cx*CH+CH/2,cz:cz*CH+CH/2,full:items.length});});
 }
 // watering holes: faceted water that shimmers
 const waterMat=new THREE.MeshStandardMaterial({color:0x5e9a96,roughness:.08,metalness:.15,flatShading:true,transparent:true,opacity:.9});disposables.push(waterMat);
 const waters=WATERS.map(w=>{const geo=new THREE.CircleGeometry(w.size*1.3,22,0,Math.PI*2);geo.rotateX(-Math.PI/2);const nonIndexed=geo.toNonIndexed();geo.dispose();const mesh=add(new THREE.Mesh(nonIndexed,waterMat));mesh.position.set(w.x,waterLevel(w),w.y);mesh.receiveShadow=true;disposables.push(nonIndexed);return{mesh,base:Float32Array.from(nonIndexed.getAttribute('position').array as Float32Array)};});
 // sky dome with a warm hazy horizon, the sun, and a ring of distant blue hills
 const skyGeo=new THREE.SphereGeometry(1,24,12),skyCol:number[]=[],sp=skyGeo.getAttribute('position');
 for(let i=0;i<sp.count;i++){const y=sp.getY(i),c=hex(0xf1d7a4).lerp(hex(0x8fbbe0),smooth(-.02,.35,y)).lerp(hex(0x5f95cf),smooth(.35,1,y));skyCol.push(c.r,c.g,c.b);}
 skyGeo.setAttribute('color',new THREE.Float32BufferAttribute(skyCol,3));const skyMat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false});
 const sky=add(new THREE.Mesh(skyGeo,skyMat));sky.renderOrder=-2;disposables.push(skyGeo,skyMat);
 const sunDir=new THREE.Vector3(-.5,.55,-.62).normalize(),sunMat=new THREE.MeshBasicMaterial({color:0xfff3d1,fog:false,depthWrite:false}),sunGeo=new THREE.CircleGeometry(.045,16);const sunDisc=add(new THREE.Mesh(sunGeo,sunMat));sunDisc.renderOrder=-1;disposables.push(sunMat,sunGeo);
 const hillPos:number[]=[],hillCol:number[]=[];for(let i=0;i<72;i++){const a0=i/72*Math.PI*2,a1=(i+1)/72*Math.PI*2,h0=.02+hash(i,1,5)*.035+(i%17===3?.05:0),h1=.02+hash(i+1,1,5)*.035+((i+1)%17===3?.05:0),am=(a0+a1)/2,hm=Math.max(h0,h1)+hash(i,2,5)*.015;
  const v=(a:number,h:number)=>[Math.cos(a),h,Math.sin(a)];for(const tri of [[v(a0,-.02),v(am,hm),v(a0,h0)],[v(a0,-.02),v(a1,-.02),v(am,hm)],[v(a1,-.02),v(a1,h1),v(am,hm)]]){const c=hex(0xa9b1bf).lerp(hex(0xd8cdb4),.35+hash(i,tri[1][1]*100,3)*.4);for(const p of tri){hillPos.push(...p);hillCol.push(c.r,c.g,c.b);}}}
 const hillGeo=new THREE.BufferGeometry();hillGeo.setAttribute('position',new THREE.Float32BufferAttribute(hillPos,3));hillGeo.setAttribute('color',new THREE.Float32BufferAttribute(hillCol,3));
 const hillMat=new THREE.MeshBasicMaterial({vertexColors:true,fog:false,side:THREE.DoubleSide,depthWrite:false});const hills=add(new THREE.Mesh(hillGeo,hillMat));hills.renderOrder=-1;disposables.push(hillGeo,hillMat);
 let lastWater=0;
 return{
  update(t,x,z,range,far,cam){
   time.value=t;
   const radius=far*.92;sky.position.copy(cam);sky.scale.setScalar(radius);hills.position.set(cam.x,cam.y-radius*.04,cam.z);hills.scale.set(radius*.97,radius,radius*.97);
   sunDisc.position.copy(cam).addScaledVector(sunDir,radius*.95);sunDisc.scale.setScalar(radius);sunDisc.lookAt(cam);
   // grass thins out with distance (instances are in random order, so drawing fewer keeps an even spread)
   for(const c of chunks){const d=Math.hypot(c.cx-x,c.cz-z),reach=range*(lightweight?.6:.85)+CH*.7;c.mesh.visible=d<reach;c.mesh.count=Math.ceil(c.full*(d<CH*1.1?1:d<reach*.6?.45:.2));}
   if(Math.hypot(x-lodAt.x,z-lodAt.z)>40){lodAt.x=x;lodAt.z=z;relevel(x,z);}
   if(t-lastWater>.08){lastWater=t;for(const w of waters){const pos=w.mesh.geometry.getAttribute('position') as THREE.BufferAttribute,a=pos.array as Float32Array;for(let i=0;i<a.length;i+=3){const px=w.base[i],pz=w.base[i+2],edge=Math.hypot(px,pz)>1?1:0;a[i+1]=edge*Math.sin(t*1.3+px*.05+pz*.07)*.5;}pos.needsUpdate=true;w.mesh.geometry.computeVertexNormals();}}
  },
  dispose(){disposables.forEach(d=>d.dispose());},
 };
}
export const SUN_DIRECTION=new THREE.Vector3(-.5,.55,-.62).normalize();
