// The Golden Plains: a faceted African savanna built in code from the shared prop table (lib/game.ts), so the
// colliders the server uses and the acacias, kopjes, thickets, burrows and watering holes the player sees always agree.
// Terrain is a faceted height grid; groundY() interpolates the same triangles, so animals stand exactly on the facets.
import * as THREE from 'three';
import {W,H,props,trailDistance,GRASS_PATCH,type Prop} from '@/lib/game';
import {Model,hex,hash,facetMaterial} from './faceted';

const S=40,X0=-1600,Z0=-1600,NX=Math.ceil((W+3200)/S)+1,NZ=Math.ceil((H+3200)/S)+1;
const PROPS=props(417),WATERS=PROPS.filter(p=>p.kind==='water'),KOPJES=PROPS.filter(p=>p.kind==='rock'&&p.size>=1.3),BURROWS=PROPS.filter(p=>p.kind==='burrow'),PATCHES=PROPS.filter(p=>p.kind==='tallgrass');
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function rolling(x:number,z:number){return 18*Math.sin(x*.0021+1.3)*Math.cos(z*.0017)+9*Math.sin(x*.0052+z*.0041)+4*Math.sin(x*.013-z*.011);}
/** surface height of each watering hole (the land around it is levelled to its centre, then dished) */
export const waterLevel=(w:Prop)=>rolling(w.x,w.y)-4;
function height(x:number,z:number){
 let h=rolling(x,z);
 for(const w of WATERS){const d=Math.hypot(x-w.x,z-w.y);if(d<w.size*2.3){const c=rolling(w.x,w.y);h=c+(h-c)*smooth(w.size*1.2,w.size*2.2,d);const t=d/(w.size*1.35);if(t<1)h-=12*(1-t*t)**2;}}
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
const GRASS=[0xd9b660,0xcfa853,0xe2c374,0xc79d4b,0xdbb965,0xcbab58],DRY=0xc9a15a,OLIVE=0xa7a250,EARTH=0xb27b4b,GREEN=0x98a252,MUD=0x6d583b,ROCKY=0xab9f88;
function groundColour(x:number,z:number,r:number){
 const c=hex(GRASS[Math.floor(r*GRASS.length)]);
 // broad sweeps of sun-bleached straw, olive swales where the soil holds water, and bare red earth between the tussocks
 const n=Math.sin(x*.0031+Math.sin(z*.0023)*2)*Math.cos(z*.0027);c.lerp(hex(DRY),Math.max(0,n)*.5);
 const swale=Math.sin(x*.0017+1)*Math.sin(z*.0021+Math.sin(x*.0011)*1.5);if(swale>.35)c.lerp(hex(OLIVE),smooth(.35,.85,swale)*.55);
 const bare=Math.sin(x*.0061+z*.0013)*Math.sin(z*.0057-x*.0021+2);if(bare>.72)c.lerp(hex(EARTH),smooth(.72,.95,bare)*.5);
 for(const w of WATERS){const d=Math.hypot(x-w.x,z-w.y);if(d<w.size*2.6)c.lerp(hex(GREEN),(1-smooth(w.size*1.1,w.size*2.6,d))*.65);if(d<w.size*1.25)c.lerp(hex(MUD),1-smooth(w.size*.9,w.size*1.25,d));}
 for(const k of KOPJES){const d=Math.hypot(x-k.x,z-k.y);if(d<170)c.lerp(hex(ROCKY),(1-smooth(60,170,d))*.6);}
 for(const b of BURROWS)if(Math.hypot(x-b.x,z-b.y)<40)c.lerp(hex(0x9a6e45),.5);
 // tall-grass swales read a little greener-gold from above; game trails are worn pale and dusty
 for(const g of PATCHES)if(Math.hypot(x-g.x,z-g.y)<g.size*GRASS_PATCH)c.lerp(hex(0xb8a04a),.35);
 if(x>0&&z>0&&x<W&&z<H&&trailDistance(x,z)<24)c.lerp(hex(0xddc391),.55);
 if(x<0||z<0||x>W||z>H)c.lerp(hex(0xbfa066),.25);
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
 // warm bark that catches the sun on top; canopies lit gold-green above, cool olive in their own shade (never black)
 return m.build((p,n,part)=>part.includes('#bark')?(n.y>.4?hex(0xa88b68):hex(0x7a624b).lerp(hex(0x8e7457),hash(p.x*13,p.z*13,4))).multiplyScalar(.9+hash(p.x*40,p.y*40,p.z*40)*.2):n.y>.55?hex([0xa4b553,0x93a849,0xb3bd5e,0x8b9f43][Math.floor(hash(p.x*9,p.z*9,1)*4)]):n.y<-.3?hex(0x6b8848):hex(0x7d9a44),{t:[0,0,0]},.1).get('t')!;
}
function boulder(seed:number,lod=0){const m=new Model(seed,lod);m.blob('b',[0,.15,0],[1,.72,1],{detail:1,jitter:.22});return m.build((p,n)=>{const c=hex([0xa49a88,0x9b8a72,0xb0a28a,0x8f8676][Math.floor(hash(p.x*20,p.y*20,p.z*20)*4)]);if(n.y>.6)c.lerp(hex(0xcab894),.35);if(hash(p.x*31,p.y*31,p.z*31)>.86)c.lerp(hex(0xc2a65c),.6);return c;},{b:[0,0,0]},.06).get('b')!;}
/** Scrub bushes: a rounded green thicket bush and a sparser grey-olive thorn scrub. */
function shrub(seed:number,dry=false){const m=new Model(seed),top=dry?0x8c8f52:0x7f943d,side=dry?0x6d7244:0x617531,under=dry?0x4c5236:0x3f4d25;
 m.blob('s',[0,.55,0],[1.1,.75,1.1],{detail:1,jitter:.24});m.blob('s',[.6,.4,.3],[.7,.5,.7],{detail:0,jitter:.2});m.blob('s',[-.55,.45,-.35],[.65,.55,.6],{detail:0,jitter:.22});if(dry)m.blob('s',[.1,.95,-.2],[.5,.45,.5],{detail:0,jitter:.3});
 return m.build((p,n)=>(n.y>.4?hex(top):n.y<-.2?hex(under):hex(side)).multiplyScalar(.92+hash(p.x*30,p.y*30,p.z*30)*.16),{s:[0,0,0]},.12).get('s')!;}
/** Loose stones and pebbles strewn over the plain and around the kopjes (too small to block anything). */
function pebble(seed:number){const m=new Model(seed);m.blob('p',[0,.1,0],[1,.55,.8],{detail:0,jitter:.3});return m.build((p,n)=>hex(n.y>.5?0xcbb894:0xa8937a),{p:[0,0,0]},.08).get('p')!;}
/** A sprig of savanna wildflowers: thin stems and a few faceted blooms (white petals, tinted per instance). */
function blooms(seed:number){
 const pos:number[]=[],col:number[]=[],stem=hex(0x6f7f35),petal=hex(0xffffff);
 for(let b=0;b<4;b++){const a=hash(seed,b,1)*6.28,r=.06+hash(seed,b,2)*.14,h=.22+hash(seed,b,3)*.2,x=Math.cos(a)*r,z=Math.sin(a)*r,s=.045+hash(seed,b,4)*.03;
  pos.push(x-.01,0,z,x+.01,0,z,x,h,z);for(let k=0;k<3;k++)col.push(stem.r,stem.g,stem.b);
  for(let k=0;k<3;k++){const t=k/3*6.28+a,t2=t+2.1;pos.push(x,h,z,x+Math.cos(t)*s,h+.02,z+Math.sin(t)*s,x+Math.cos(t2)*s,h+.02,z+Math.sin(t2)*s);for(let q=0;q<3;q++)col.push(petal.r,petal.g,petal.b);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(pos.map((_,i)=>i%3===1?1:0),3));g.scale(10,10,10);return g;
}
function tuft(seed:number,tall:boolean){
 // a clump of blades; vertex colours run from shaded straw at the base to pale gold tips
 const pos:number[]=[],col:number[]=[],blades=tall?9:6;
 for(let b=0;b<blades;b++){const a=b/blades*Math.PI*2+hash(seed,b,1)*1.2,lean=.18+hash(seed,b,2)*.35,h=(tall?1.15:.42)*(.65+hash(seed,b,3)*.6),w=.035+hash(seed,b,4)*.03,r=.12+hash(seed,b,5)*.14;
  const bx=Math.cos(a)*r,bz=Math.sin(a)*r,tx=bx+Math.cos(a)*lean*h,tz=bz+Math.sin(a)*lean*h,px=-Math.sin(a)*w,pz=Math.cos(a)*w;
  pos.push(bx-px,0,bz-pz,bx+px,0,bz+pz,tx,h,tz);const base=hex(0xb39352).lerp(hex(0xc9a75c),hash(seed,b,7)),tip=hex(hash(seed,b,6)>.3?0xf3e0a0:0xe6c676);col.push(base.r,base.g,base.b,base.r,base.g,base.b,tip.r,tip.g,tip.b);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(pos.map((_,i)=>i%3===1?1:0),3));g.scale(10,10,10);return g;
}
/** Grass bends in one shared breeze: every tuft leans downwind, and gusts roll across the plain in the wind's direction
 *  (the bend is turned into each instance's own frame, so rotated tufts still lean the same way). */
function windy(material:THREE.MeshStandardMaterial,time:{value:number},wind:{value:THREE.Vector2},cam:{value:THREE.Vector3}){
 material.onBeforeCompile=shader=>{shader.uniforms.uTime=time;shader.uniforms.uWind=wind;shader.uniforms.uCam=cam;shader.vertexShader='uniform float uTime;\nuniform vec2 uWind;\nuniform vec3 uCam;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  #ifdef USE_INSTANCING
  vec3 iPos=instanceMatrix[3].xyz;vec3 lw=normalize((vec4(uWind.x,0.,uWind.y,0.)*instanceMatrix).xyz+vec3(1e-5));
  #else
  vec3 iPos=vec3(0.);vec3 lw=vec3(uWind.x,0.,uWind.y);
  #endif
  float along=dot(iPos.xz,uWind);
  float gust=.55+.45*sin(along*.011-uTime*1.6)+.15*sin(along*.037-uTime*2.7+iPos.x*.002);
  transformed.xz+=lw.xz*gust*transformed.y*.17;
  // tufts right in front of the lens sink into the ground so they never wall off the view
  transformed*=smoothstep(35.,95.,distance(iPos.xz,uCam.xz));`);};
 return material;
}

type Placed={x:number;y:number;z:number;rot:number;scale:number;sy?:number;tint?:THREE.Color};
function instanced(geometry:THREE.BufferGeometry,material:THREE.Material,items:Placed[],shadow=true){
 const mesh=new THREE.InstancedMesh(geometry,material,Math.max(1,items.length)),m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),white=new THREE.Color(1,1,1),tinted=items.some(it=>it.tint);
 items.forEach((it,i)=>{q.setFromEuler(e.set(0,it.rot,0));m.compose(new THREE.Vector3(it.x,it.y,it.z),q,new THREE.Vector3(it.scale,it.scale*(it.sy??1),it.scale));mesh.setMatrixAt(i,m);if(tinted)mesh.setColorAt(i,it.tint??white);});
 mesh.count=items.length;mesh.castShadow=shadow;mesh.receiveShadow=true;mesh.computeBoundingSphere();return mesh;
}
const SUN=new THREE.Vector3(-.5,.55,-.62).normalize();
/** Where a shadow falls on the ground for something whose shade is cast from `height` units up (afternoon sun). */
const shadowOffset=(height:number)=>({x:-SUN.x/SUN.y*height,z:-SUN.z/SUN.y*height});
// grass colour per tuft: mostly gold, some pale straw, rusty red oat grass, olive in the damp swales, green by water
const STRAW=new THREE.Color(1.07,1.03,.9),GOLD=new THREE.Color(1,1,1),RUST=new THREE.Color(1.02,.8,.62),SAGE=new THREE.Color(.86,.95,.7),LUSH=new THREE.Color(.62,.92,.5);
function grassTint(x:number,z:number,lush:boolean){
 if(lush)return hash(x,z,21)<.75?LUSH:SAGE;
 const swale=Math.sin(x*.0017+1)*Math.sin(z*.0021+Math.sin(x*.0011)*1.5),r=hash(x,z,22),rusty=Math.sin(x*.0043-z*.0029)>.55;
 return swale>.4&&r<.55?SAGE:rusty&&r<.6?RUST:r<.3?STRAW:GOLD;
}
const FLOWERS=[new THREE.Color(1,1,1),new THREE.Color(1,.86,.3),new THREE.Color(.78,.58,.98),new THREE.Color(1,.66,.72)];

/** A ring of faceted hills at the horizon, drawn far to near: blue-lavender ranges, sage ridges, then low golden rises
 *  with acacia silhouettes. Faces turned to the sun are warm, faces in their own shade cool, and every foot fades into haze. */
function horizon(lightweight:boolean){
 const pos:number[]=[],col:number[]=[],haze=hex(0xead8b2),n=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
 const face=(pts:number[][],lit:THREE.Color,shade:THREE.Color,fade:number)=>{
  const [a,b,c]=pts.map(p=>new THREE.Vector3(...p));n.copy(ab.subVectors(b,a)).cross(ac.subVectors(c,a)).normalize();if(n.dot(a)>0)n.negate();
  const base=shade.clone().lerp(lit,smooth(-.25,.55,n.dot(SUN)));for(const p of pts){pos.push(...p);const v=base.clone().lerp(haze,(1-smooth(-.02,.05,p[1]))*fade);col.push(v.r,v.g,v.b);}
 };
 const layer=(segs:number,dist:number,lo:number,amp:number,seed:number,lit:number,shade:number,fade:number,peaks:(a:number)=>number)=>{
  const h=(i:number)=>{const a=i/segs*Math.PI*2;return lo+amp*(.5+.5*Math.sin(a*3+seed)*Math.sin(a*7+seed*2))*(.7+hash(i%segs,seed,5)*.6)+peaks(a);};
  for(let i=0;i<segs;i++){const a0=i/segs*Math.PI*2,a1=(i+1)/segs*Math.PI*2,am=(a0+a1)/2,h0=h(i),h1=h(i+1),hm=Math.max(h0,h1)+hash(i,seed,6)*amp*.35;
   const v=(a:number,y:number)=>[Math.cos(a)*dist,y,Math.sin(a)*dist];
   face([v(a0,-.06),v(am,hm),v(a0,h0)],hex(lit),hex(shade),fade);face([v(a0,-.06),v(a1,-.06),v(am,hm)],hex(lit),hex(shade),fade);face([v(a1,-.06),v(a1,h1),v(am,hm)],hex(lit),hex(shade),fade);}
 };
 const bump=(a:number,at:number,w:number,hgt:number)=>{const d=Math.atan2(Math.sin(a-at),Math.cos(a-at));return Math.abs(d)<w?hgt*(1-Math.abs(d)/w)**1.4:0;};
 layer(lightweight?60:96,1,.025,.04,1,0xcfc9cc,0x9aa6c0,.55,a=>bump(a,2.3,.32,.07)+bump(a,4.9,.22,.045)+bump(a,.6,.15,.03));
 layer(lightweight?54:84,.97,.012,.026,7,0xc2b48a,0x8e9c95,.45,a=>bump(a,3.6,.25,.02)+bump(a,5.8,.3,.018));
 layer(lightweight?48:72,.94,.004,.012,13,0xbba66a,0x8f8d63,.25,()=>0);
 // flat-topped acacias on the nearest rise
 const tree=hex(0x7f8150),treeShade=hex(0x6c7352);
 for(let k=0;k<(lightweight?18:42);k++){const a=hash(k,3,9)*Math.PI*2,base=.006+.006*hash(k,4,9),w=.008+hash(k,5,9)*.01,t=.016+hash(k,6,9)*.012,d=.935,c=hash(k,7,9)>.5?tree:treeShade;
  const p=(da:number,y:number)=>[Math.cos(a+da)*d,y,Math.sin(a+da)*d];
  for(const tri of [[p(-.0012,base-.004),p(.0012,base-.004),p(0,t)],[p(-w,t),p(w,t),p(w*.7,t+.005)],[p(-w,t),p(w*.7,t+.005),p(-w*.7,t+.005)]])for(const q of tri){pos.push(...q);col.push(c.r,c.g,c.b);}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));return geo;
}
/** Faceted fair-weather cumulus scattered round the sky: bright tops, warm sun-side flanks, cool grey-blue bellies. */
function clouds(lightweight:boolean){
 const m=new Model(71);
 for(let k=0;k<(lightweight?8:15);k++){const a=k/15*Math.PI*2+hash(k,1,71)*.35,e=.08+hash(k,2,71)*.2,dir=new THREE.Vector3(Math.cos(a)*Math.cos(e),Math.sin(e),Math.sin(a)*Math.cos(e)).multiplyScalar(.9),side=new THREE.Vector3(-Math.sin(a),0,Math.cos(a)),size=.035+hash(k,3,71)*.035;
  const puffs=3+Math.floor(hash(k,4,71)*3);for(let j=0;j<puffs;j++){const o=(j-(puffs-1)/2)*size*.9,lift=(1-Math.abs(j-(puffs-1)/2)/puffs)*size*.45;const c=dir.clone().addScaledVector(side,o+(hash(k,j,72)-.5)*size*.4);c.y+=lift;
   m.blob('c',[c.x,c.y,c.z],[size*(.7+hash(k,j,73)*.4),size*(.45+hash(k,j,74)*.2),size*(.7+hash(k,j,75)*.4)],{detail:lightweight?0:1,jitter:.2});}}
 return m.build((p,n)=>n.y<-.35?hex(0xc3cbd8):n.y>.5?hex(0xfffbf2):n.dot(SUN)>0?hex(0xf8ead0):hex(0xd9dfe8),{c:[0,0,0]},.04).get('c')!;
}
/** A faceted watering hole: deep blue-green in the middle, paling to murky green shallows at the waterline. */
function pool(size:number,seed:number){
 const R=[0,.3,.55,.72,.82,.9,1.05,1.3],C=[0x2b6f84,0x2f7a8b,0x3a8994,0x4d9a9b,0x6aa9a0,0x8bb59b,0x96b494,0x96b494].map(hex),SEG=26,pts:THREE.Vector3[][]=[];
 for(let i=0;i<R.length;i++){const ring:THREE.Vector3[]=[];for(let k=0;k<SEG;k++){const a=k/SEG*Math.PI*2+(i%2)*Math.PI/SEG,r=R[i]*size*(i?1+(hash(seed,i*31+k,3)-.5)*.08:0);ring.push(new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r));}pts.push(ring);}
 const pos:number[]=[],col:number[]=[];
 const tri=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,ci:number)=>{const k=C[ci].clone().multiplyScalar(.96+hash(a.x+b.x,c.z,seed)*.08);for(const v of [a,c,b]){pos.push(v.x,v.y,v.z);col.push(k.r,k.g,k.b);}};
 for(let i=0;i<R.length-1;i++)for(let k=0;k<SEG;k++){const a=pts[i][k],b=pts[i][(k+1)%SEG],c=pts[i+1][k],d=pts[i+1][(k+1)%SEG];if(i===0)tri(a,c,d,0);else{tri(a,c,d,i);tri(a,d,b,i);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();return g;
}

export type Savanna={update(time:number,x:number,z:number,range:number,cameraFar:number,camera:THREE.Vector3,wind?:{x:number;y:number}):void;realShadows(on:boolean):void;dispose():void};
export function createSavanna(scene:THREE.Scene,lightweight:boolean):Savanna{
 const disposables:{dispose():void}[]=[],add=<T extends THREE.Object3D>(o:T)=>{scene.add(o);return o;};
 const ground=add(terrain());disposables.push(ground.geometry,ground.material as THREE.Material);
 const facet=facetMaterial();disposables.push(facet);
 const r=(i:number,k:number)=>hash(i,k,417);
 // scenery beyond the edge of the map (where nobody can walk): acacias and scrub that carry the plains to the hills
 const beyond=(count:number,seed:number)=>{const out:{x:number;y:number;size:number}[]=[];for(let k=0;out.length<count&&k<count*20;k++){const x=-760+hash(k,seed,1)*(W+1520),z=-760+hash(k,seed,2)*(H+1520),o=Math.max(-x,x-W,-z,z-H);if(o>90&&o<760)out.push({x,y:z,size:.8+hash(k,seed,3)*.6});}return out;};
 const trees=[...PROPS.filter(p=>p.kind==='tree'),...beyond(lightweight?60:170,1)];
 // acacias, three shapes (map trees come first, so their shape and turn match the climbing data)
 const lods:{near:THREE.InstancedMesh;far:THREE.InstancedMesh;items:Placed[]}[]=[];
 const leveled=(near:THREE.BufferGeometry,far:THREE.BufferGeometry,items:Placed[])=>{const a=add(instanced(near,facet,items)),b=add(instanced(far,facet,items));lods.push({near:a,far:b,items});disposables.push(near,far);};
 [11,23,37].forEach((seed,v)=>leveled(acacia(seed),acacia(seed,1),trees.filter((_,i)=>i%3===v).map((t,i)=>({x:t.x,y:groundY(t.x,t.y),z:t.y,rot:r(i,v)*6.28,scale:10*t.size}))));
 // kopjes: boulders half sunk into their mounds
 const rocks=PROPS.filter(p=>p.kind==='rock');
 [5,9,17,29].forEach((seed,v)=>leveled(boulder(seed),boulder(seed,1),rocks.filter((_,i)=>i%4===v).map((t,i)=>({x:t.x,y:groundY(t.x,t.y)-t.size*6,z:t.y,rot:r(i,v+5)*6.28,scale:t.size*33,sy:.85+r(i,v+9)*.4}))));
 // level of detail: trees and boulders near the player use the full-facet model, distant ones a lighter cut
 const NEAR_LOD=lightweight?220:420,mat=new THREE.Matrix4(),quat=new THREE.Quaternion(),eul=new THREE.Euler(),lodAt={x:1e9,z:1e9};
 const relevel=(x:number,z:number)=>{for(const l of lods){l.near.count=0;l.far.count=0;for(const it of l.items){quat.setFromEuler(eul.set(0,it.rot,0));mat.compose(new THREE.Vector3(it.x,it.y,it.z),quat,new THREE.Vector3(it.scale,it.scale*(it.sy??1),it.scale));const near=Math.hypot(it.x-x,it.z-z)<NEAR_LOD,mesh=near?l.near:l.far;mesh.setMatrixAt(mesh.count++,mat);}for(const mesh of [l.near,l.far]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}}};
 // thickets: a scrub bush wrapped in tall grass (the hiding spots); half are green bush, half grey thorn scrub
 const bushes=PROPS.filter(p=>p.kind==='bush'),shrubs=[...bushes,...beyond(lightweight?40:120,2)],shrubGeo=[shrub(3),shrub(8,true)];disposables.push(...shrubGeo);
 shrubGeo.forEach((geo,v)=>add(instanced(geo,facet,shrubs.filter((_,i)=>i%2===v).map((b,i)=>({x:b.x,y:groundY(b.x,b.y),z:b.y,rot:r(i,2+v)*6.28,scale:b.size*8,sy:.75+r(i,4+v)*.35,tint:new THREE.Color().setScalar(.9+r(i,6+v)*.2)})))));
 // soft cool shade pooled under every acacia, bush and kopje, draped over the ground facets (real shadow maps are only on
 // the high tier; this gives every tier grounded props and the sunlit/shaded contrast of the savanna)
 const shadePos:number[]=[],drape=(cx:number,cz:number,rad:number,stretch:number)=>{const n=lightweight?9:14,ux=-SUN.x,uz=-SUN.z,ul=Math.hypot(ux,uz),dx=ux/ul,dz=uz/ul;
  const at=(a:number,f:number)=>{const lx=Math.cos(a)*rad*f*stretch,lz=Math.sin(a)*rad*f,x=cx+dx*lx-dz*lz,z=cz+dz*lx+dx*lz;return[x,groundY(x,z)+1.2,z];};
  const c=[cx,groundY(cx,cz)+1.2,cz];for(let k=0;k<n;k++){const a0=k/n*Math.PI*2,a1=(k+1)/n*Math.PI*2;for(const f of [1,.6])shadePos.push(...c,...at(a1,f),...at(a0,f));}};
 for(const t of trees){const o=shadowOffset(26*t.size);drape(t.x+o.x,t.y+o.z,32*t.size,1.2);drape(t.x+o.x*.15,t.y+o.z*.15,7*t.size,1);}
 for(const b of shrubs){const o=shadowOffset(6*b.size);drape(b.x+o.x,b.y+o.z,11*b.size,1.2);}
 for(const k of rocks){const o=shadowOffset(10*k.size);drape(k.x+o.x,k.y+o.z,34*k.size,1.15);}
 const shadeGeo=new THREE.BufferGeometry();shadeGeo.setAttribute('position',new THREE.Float32BufferAttribute(shadePos,3));
 const shadeMat=new THREE.MeshBasicMaterial({color:0x3b3049,transparent:true,opacity:.17,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const shade=add(new THREE.Mesh(shadeGeo,shadeMat));shade.renderOrder=1;disposables.push(shadeGeo,shadeMat);
 // burrows: a dark hole ringed by a lip of dug earth
 const holeGeo=new THREE.CircleGeometry(5.5,7).rotateX(-Math.PI/2),holeMat=new THREE.MeshBasicMaterial({color:0x1d140c}),lipGeo=new THREE.TorusGeometry(7,2.4,3,8).rotateX(Math.PI/2),lipMat=new THREE.MeshStandardMaterial({color:0x9a7048,flatShading:true,roughness:1});disposables.push(holeGeo,holeMat,lipGeo,lipMat);
 add(instanced(holeGeo,holeMat,BURROWS.map((b,i)=>({x:b.x,y:groundY(b.x,b.y)+.6,z:b.y,rot:r(i,8)*6.28,scale:1})),false));
 add(instanced(lipGeo,lipMat,BURROWS.map((b,i)=>({x:b.x,y:groundY(b.x,b.y)+.3,z:b.y,rot:r(i,8)*6.28,scale:1,sy:.6}))));
 // grass: tufts scattered over the plains in chunks, so distant chunks can be skipped
 const time={value:0},breeze={value:new THREE.Vector2(1,0)},lens={value:new THREE.Vector3()},grassMat=windy(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,side:THREE.DoubleSide}),time,breeze,lens);disposables.push(grassMat);
 const shortGeo=[tuft(1,false),tuft(2,false),tuft(3,false)],tallGeo=tuft(4,true),flowerGeo=blooms(5),stoneGeo=pebble(6);disposables.push(...shortGeo,tallGeo,flowerGeo,stoneGeo);
 const LAYERS:[THREE.BufferGeometry,THREE.Material][]=[[shortGeo[0],grassMat],[shortGeo[1],grassMat],[shortGeo[2],grassMat],[tallGeo,grassMat],[flowerGeo,grassMat],[stoneGeo,facet]];
 const CH=400,chunks:{mesh:THREE.InstancedMesh;cx:number;cz:number;full:number}[]=[];
 const blocked=(x:number,z:number)=>WATERS.some(w=>Math.hypot(x-w.x,z-w.y)<w.size*1.05)||rocks.some(t=>Math.hypot(x-t.x,z-t.y)<t.size*30)||BURROWS.some(b=>Math.hypot(x-b.x,z-b.y)<14)||trailDistance(x,z)<10;
 const density=lightweight?.35:1;
 for(let cz=-1;cz<Math.ceil(H/CH)+1;cz++)for(let cx=-1;cx<Math.ceil(W/CH)+1;cx++){
  const per:Placed[][]=LAYERS.map(()=>[]),outside=cx<0||cz<0||cx*CH>=W||cz*CH>=H,count=Math.floor(640*density*(outside?.5:1));
  for(let i=0;i<count;i++){const x=cx*CH+hash(cx,cz,i*3)*CH,z=cz*CH+hash(cx,cz,i*3+1)*CH;if(blocked(x,z))continue;
   // denser, lusher grass towards water; thinner on kopje slopes
   const lush=WATERS.some(w=>Math.hypot(x-w.x,z-w.y)<w.size*2.2);if(!lush&&hash(x,z,7)<.25)continue;
   per[i%3].push({x,y:groundY(x,z)-1,z,rot:hash(x,z,2)*6.28,scale:.8+hash(x,z,3)*.7,tint:grassTint(x,z,lush)});}
  // tall-grass patches: dense stands about 1.2 m high (the cover that hides animals shorter than a metre)
  for(const g of PATCHES)if(Math.floor(g.x/CH)===cx&&Math.floor(g.y/CH)===cz){const rad=g.size*GRASS_PATCH,n=Math.floor(rad*rad*Math.PI/(lightweight?320:150));for(let k=0;k<n;k++){const a=hash(g.x,k,11)*6.283,d=Math.sqrt(hash(g.y,k,12))*rad,x=g.x+Math.cos(a)*d,z=g.y+Math.sin(a)*d;if(blocked(x,z))continue;per[3].push({x,y:groundY(x,z)-1,z,rot:hash(k,g.x,13)*6.28,scale:.85+hash(k,g.y,14)*.35,tint:grassTint(x,z,false)});}}
  for(const b of bushes)if(Math.floor(b.x/CH)===cx&&Math.floor(b.y/CH)===cz)for(let k=0;k<12;k++){const a=k/12*6.28+hash(b.x,k,1),d=(6+hash(b.y,k,2)*18)*b.size,x=b.x+Math.cos(a)*d,z=b.y+Math.sin(a)*d;per[3].push({x,y:groundY(b.x,b.y)-1,z,rot:a,scale:b.size*(1+hash(k,b.x,3)*.5),tint:grassTint(x,z,false)});}
  // reeds and green sedge standing in the shallows of each watering hole
  for(const w of WATERS)if(Math.floor(w.x/CH)===cx&&Math.floor(w.y/CH)===cz)for(let k=0;k<w.size*(lightweight?.25:.6);k++){const a=hash(w.x,k,31)*6.283,d=w.size*(.8+hash(w.y,k,32)*.22),x=w.x+Math.cos(a)*d,z=w.y+Math.sin(a)*d;per[3].push({x,y:Math.max(groundY(x,z),waterLevel(w)-3)-1,z,rot:a,scale:.7+hash(k,w.x,33)*.5,tint:hash(k,w.y,34)<.7?LUSH:SAGE});}
  if(!lightweight){
   // wildflowers grow in loose drifts; stones lie scattered on the plain and pile up around the kopjes
   for(let d=0;d<3;d++){const fx=cx*CH+hash(cx,cz,d*7+100)*CH,fz=cz*CH+hash(cx,cz,d*7+101)*CH,tint=FLOWERS[Math.floor(hash(cx,cz,d*7+102)*FLOWERS.length)];for(let k=0;k<14;k++){const x=fx+(hash(fx,k,1)-.5)*70,z=fz+(hash(fz,k,2)-.5)*70;if(!blocked(x,z))per[4].push({x,y:groundY(x,z)-.3,z,rot:hash(x,z,4)*6.28,scale:.8+hash(x,z,5)*.6,tint});}}
   for(let k=0;k<26;k++){const x=cx*CH+hash(cx,cz,k*5+300)*CH,z=cz*CH+hash(cx,cz,k*5+301)*CH;if(!WATERS.some(w=>Math.hypot(x-w.x,z-w.y)<w.size*1.1))per[5].push({x,y:groundY(x,z)-.4,z,rot:hash(x,z,8)*6.28,scale:1.2+hash(x,z,9)*2.3,sy:.6+hash(x,z,10)*.6});}
   for(const t of rocks)if(Math.floor(t.x/CH)===cx&&Math.floor(t.y/CH)===cz)for(let k=0;k<6;k++){const a=hash(t.x,k,41)*6.283,d=t.size*(32+hash(t.y,k,42)*40),x=t.x+Math.cos(a)*d,z=t.y+Math.sin(a)*d;per[5].push({x,y:groundY(x,z)-.6,z,rot:a,scale:2.5+hash(k,t.x,43)*2.5,sy:.7+hash(k,t.y,44)*.5});}
  }
  per.forEach((items,v)=>{if(!items.length)return;const mesh=add(instanced(LAYERS[v][0],LAYERS[v][1],items,false));chunks.push({mesh,cx:cx*CH+CH/2,cz:cz*CH+CH/2,full:items.length});});
 }
 // watering holes: faceted water that shimmers, deep in the middle and pale green in the shallows
 const waterMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.1,metalness:.18,flatShading:true,transparent:true,opacity:.92});disposables.push(waterMat);
 const waters=WATERS.map((w,i)=>{const geo=pool(w.size,i+1);const mesh=add(new THREE.Mesh(geo,waterMat));mesh.position.set(w.x,waterLevel(w),w.y);mesh.receiveShadow=true;disposables.push(geo);return{mesh,base:Float32Array.from(geo.getAttribute('position').array as Float32Array)};});
 // sky dome: warm haze at the horizon, a clean blue overhead, and a soft glow around the sun
 const skyGeo=new THREE.SphereGeometry(1,40,20),skyCol:number[]=[],sp=skyGeo.getAttribute('position'),sv=new THREE.Vector3();
 for(let i=0;i<sp.count;i++){sv.fromBufferAttribute(sp,i);const y=sv.y,c=hex(0xead8b2).lerp(hex(0xc6dbe6),smooth(.0,.16,y)).lerp(hex(0x8bb9df),smooth(.12,.5,y)).lerp(hex(0x5a8bc8),smooth(.5,1,y));c.lerp(hex(0xfff1d0),smooth(.8,1,sv.normalize().dot(SUN))*.7);skyCol.push(c.r,c.g,c.b);}
 skyGeo.setAttribute('color',new THREE.Float32BufferAttribute(skyCol,3));const skyMat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false});
 const sky=add(new THREE.Mesh(skyGeo,skyMat));sky.renderOrder=-3;disposables.push(skyGeo,skyMat);
 const cloudGeo=clouds(lightweight),cloudMat=new THREE.MeshBasicMaterial({vertexColors:true,fog:false,depthWrite:false});const cloudMesh=add(new THREE.Mesh(cloudGeo,cloudMat));cloudMesh.renderOrder=-2;disposables.push(cloudGeo,cloudMat);
 const sunDir=SUN,sunMat=new THREE.MeshBasicMaterial({color:0xfff6dc,fog:false,depthWrite:false}),sunGeo=new THREE.CircleGeometry(.04,16),haloMat=new THREE.MeshBasicMaterial({color:0xfff0c8,fog:false,depthWrite:false,transparent:true,opacity:.28}),haloGeo=new THREE.CircleGeometry(.075,16);
 const sunDisc=add(new THREE.Mesh(sunGeo,sunMat)),sunHalo=add(new THREE.Mesh(haloGeo,haloMat));sunDisc.renderOrder=-2;sunHalo.renderOrder=-2;disposables.push(sunMat,sunGeo,haloMat,haloGeo);
 const hillGeo=horizon(lightweight),hillMat=new THREE.MeshBasicMaterial({vertexColors:true,fog:false,side:THREE.DoubleSide,depthWrite:false});const hills=add(new THREE.Mesh(hillGeo,hillMat));hills.renderOrder=-1;disposables.push(hillGeo,hillMat);
 let lastWater=0;
 return{
  update(t,x,z,range,far,cam,wind){
   time.value=t;lens.value.copy(cam);if(wind)breeze.value.set(wind.x,wind.y);
   const radius=far*.92;sky.position.copy(cam);sky.scale.setScalar(radius);hills.position.set(cam.x,cam.y-radius*.04,cam.z);hills.scale.set(radius*.97,radius,radius*.97);
   cloudMesh.position.copy(cam);cloudMesh.scale.setScalar(radius);cloudMesh.rotation.y=t*.0015;
   for(const [disc,d] of [[sunDisc,.95],[sunHalo,.96]] as const){disc.position.copy(cam).addScaledVector(sunDir,radius*d);disc.scale.setScalar(radius);disc.lookAt(cam);}
   // grass thins out with distance (instances are in random order, so drawing fewer keeps an even spread)
   for(const c of chunks){const d=Math.hypot(c.cx-x,c.cz-z),reach=range*(lightweight?.6:.85)+CH*.7;c.mesh.visible=d<reach;c.mesh.count=Math.ceil(c.full*(d<CH*1.1?1:d<reach*.6?.45:.2));}
   if(Math.hypot(x-lodAt.x,z-lodAt.z)>40){lodAt.x=x;lodAt.z=z;relevel(x,z);}
   if(t-lastWater>.08){lastWater=t;for(const w of waters){const pos=w.mesh.geometry.getAttribute('position') as THREE.BufferAttribute,a=pos.array as Float32Array;for(let i=0;i<a.length;i+=3){const px=w.base[i],pz=w.base[i+2],edge=Math.hypot(px,pz)>1?1:0;a[i+1]=edge*Math.sin(t*1.3+px*.05+pz*.07)*.5;}pos.needsUpdate=true;w.mesh.geometry.computeVertexNormals();}}
  },
  realShadows(on){shade.visible=!on;},
  dispose(){disposables.forEach(d=>d.dispose());},
 };
}
export const SUN_DIRECTION=SUN.clone();
