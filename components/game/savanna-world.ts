import {createTerrainHeight} from '../../lib/terrain-height';
// The Golden Plains: a faceted African savanna modelled on the central Serengeti (Seronera) in the early dry season
// (late June, about 10:00 in the morning: clear sky, a few fair-weather cumulus, straw-tan grass still green at the
// base, green flushes by water, granite kopjes). See docs/visual-reference.md. It is built in code from the shared prop table (lib/game.ts), so the
// colliders the server uses and the acacias, kopjes, thickets, burrows and watering holes the player sees always agree.
// Terrain is a faceted height grid; groundY() interpolates the same triangles, so animals stand exactly on the facets.
import * as THREE from 'three';
import {W,H,props,trailDistance,GRASS_PATCH,type Prop} from '@/lib/game';
import {Model,hex,hash,facetMaterial} from './faceted';
import {acaciaShape,placementAt} from '@/lib/acacia';

const S=40,X0=-1600,Z0=-1600,NX=Math.ceil((W+3200)/S)+1,NZ=Math.ceil((H+3200)/S)+1;
const PROPS=props(417),WATERS=PROPS.filter(p=>p.kind==='water'),KOPJES=PROPS.filter(p=>p.kind==='rock'&&p.size>=1.3),BURROWS=PROPS.filter(p=>p.kind==='burrow'),PATCHES=PROPS.filter(p=>p.kind==='tallgrass');
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const {groundY,grid,waterLevel}=createTerrainHeight(PROPS,W,H);
export {groundY,waterLevel};
// early dry season: straw and tan with grey-green underneath, not one uniform gold
const GRASS=[0xb09662,0xa58c56,0xb59c69,0x9c844d,0xab925e,0xa28b55],DRY=0xbca97a,OLIVE=0x84864d,EARTH=0x9a6b44,GREEN=0x6c8742,MUD=0x5e5039,ROCKY=0x958e81;
function groundColour(x:number,z:number,r:number){
 const c=hex(GRASS[Math.floor(r*GRASS.length)]);
 // broad sweeps of sun-bleached straw, olive swales where the soil holds water, and bare red-brown earth between the tussocks
 const n=Math.sin(x*.0031+Math.sin(z*.0023)*2)*Math.cos(z*.0027);c.lerp(hex(DRY),Math.max(0,n)*.5);
 const swale=Math.sin(x*.0017+1)*Math.sin(z*.0021+Math.sin(x*.0011)*1.5);if(swale>.3)c.lerp(hex(OLIVE),smooth(.3,.85,swale)*.6);
 const bare=Math.sin(x*.0061+z*.0013)*Math.sin(z*.0057-x*.0021+2);if(bare>.66)c.lerp(hex(EARTH),smooth(.66,.95,bare)*.55);
 for(const w of WATERS){const d=Math.hypot(x-w.x,z-w.y);if(d<w.size*2.6)c.lerp(hex(GREEN),(1-smooth(w.size*1.1,w.size*2.6,d))*.65);if(d<w.size*1.25)c.lerp(hex(MUD),1-smooth(w.size*.9,w.size*1.25,d));}
 for(const k of KOPJES){const d=Math.hypot(x-k.x,z-k.y);if(d<170)c.lerp(hex(ROCKY),(1-smooth(60,170,d))*.6);}
 for(const b of BURROWS)if(Math.hypot(x-b.x,z-b.y)<40)c.lerp(hex(0x9a6e45),.5);
 // tall-grass swales read a little greener-gold from above; game trails are worn pale and dusty
 for(const g of PATCHES)if(Math.hypot(x-g.x,z-g.y)<g.size*GRASS_PATCH)c.lerp(hex(0x958a4e),.35);
 if(x>0&&z>0&&x<W&&z<H&&trailDistance(x,z)<24)c.lerp(hex(0xbba47c),.6);
 if(x<0||z<0||x>W||z>H)c.lerp(hex(0xb7a476),.25);
 return c;
}
/** Ground tiles are TILE x TILE grid cells, so the renderer frustum-culls the land behind and beyond the camera. */
const TILE=12;
function terrain(material:THREE.Material){
 const g=grid(),tiles:THREE.Mesh[]=[];
 for(let tj=0;tj<NZ-1;tj+=TILE)for(let ti=0;ti<NX-1;ti+=TILE){
  const pos:number[]=[],col:number[]=[],put=(i:number,j:number)=>pos.push(X0+i*S,g[j*NX+i],Z0+j*S);
  for(let j=tj;j<Math.min(tj+TILE,NZ-1);j++)for(let i=ti;i<Math.min(ti+TILE,NX-1);i++){
   const x=X0+(i+.5)*S,z=Z0+(j+.5)*S;
   for(const [tri,ox,oz] of [[[[i,j],[i+1,j+1],[i+1,j]],.66,.33],[[[i,j],[i,j+1],[i+1,j+1]],.33,.66]] as const){
    for(const [a,b] of tri)put(a,b);
    const c=groundColour(x+(ox-.5)*S,z+(oz-.5)*S,hash(i*7+ox*3,j*13+oz*5,1));c.multiplyScalar(.93+hash(i,j,ox*9)*.12);for(let k=0;k<3;k++)col.push(c.r,c.g,c.b);
   }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.computeVertexNormals();geo.computeBoundingSphere();
  const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;tiles.push(mesh);
 }
 return tiles;
}

// ---------------------------------------------------------------- vegetation and rocks (authored in metres, placed x10)
function acacia(seed:number,lod=0){
 // trunk and limbs come from the shared shape the climbing rules use, so paws land on the bark that is drawn
 const m=new Model(seed,lod),shape=acaciaShape(seed);
 m.loft('t#bark',shape.trunk.map(t=>({c:t.c,rz:t.r,ry:t.r})),{n:6,jitter:.04,start:'flat',end:'point'});
 shape.limbs.forEach(l=>m.spike('t#bark',l.path,l.radii,{n:5,jitter:.03}));
 // bark stems carrying each canopy pad: from its limb's tip (pad i sits over limb i) or, for the central crown, from
 // the fork, up into the pad's underside so no pad floats. Drawn only: the climbing rules keep the limbs above.
 shape.canopy.forEach((c,i)=>{const l=shape.limbs[i],from=l?l.path.at(-1)!:[.15,shape.fork,0] as const,
  to=[c.c[0],c.c[1]-c.r[1]*.4,c.c[2]] as const,mid=[(from[0]+to[0])/2,from[1]+(to[1]-from[1])*.55,(from[2]+to[2])/2] as const;
  if(to[1]-from[1]>.05)m.spike('t#bark',[[...from],[...mid],[...to]],l?[l.radii.at(-1)!*1.1,l.radii.at(-1)!*.8,.018]:[.12,.075,.03],{n:5,jitter:.03});});
 // flat-topped umbrella canopy: overlapping faceted pads at the branch tips, a small one over the resting bough
 shape.canopy.forEach((c,i)=>m.blob('t#leaf',c.c,c.r,{detail:1,jitter:i===shape.canopy.length-1?.16:.18,rot:[0,c.rot,0]}));
 // warm bark that catches the sun on top; canopies lit gold-green above, cool olive in their own shade (never black)
 return m.build((p,n,part)=>part.includes('#bark')?(n.y>.4?hex(0xa88b68):hex(0x7a624b).lerp(hex(0x8e7457),hash(p.x*13,p.z*13,4))).multiplyScalar(.9+hash(p.x*40,p.y*40,p.z*40)*.2):n.y>.55?hex([0x95a752,0x879c4a,0xa0ad5c,0x7f9444][Math.floor(hash(p.x*9,p.z*9,1)*4)]):n.y<-.3?hex(0x5d7546):hex(0x6e8a45),{t:[0,0,0]},.1).get('t')!;
}
function boulder(seed:number,lod=0){const m=new Model(seed,lod);m.blob('b',[0,.15,0],[1,.72,1],{detail:1,jitter:.22});return m.build((p,n)=>{const c=hex([0xa59e94,0x9d9184,0xb2a99c,0x8f8a82][Math.floor(hash(p.x*20,p.y*20,p.z*20)*4)]);if(n.y>.6)c.lerp(hex(0xcdc3b2),.35);if(hash(p.x*31,p.y*31,p.z*31)>.86)c.lerp(hex(0xc9a54e),.55);return c;},{b:[0,0,0]},.06).get('b')!;}
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
  pos.push(bx-px,0,bz-pz,bx+px,0,bz+pz,tx,h,tz);const base=hex(0x8f8c56).lerp(hex(0xb09a62),hash(seed,b,7)),tip=hex(hash(seed,b,6)>.3?0xeadcb0:0xd9c389);col.push(base.r,base.g,base.b,base.r,base.g,base.b,tip.r,tip.g,tip.b);}
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
// Sun at 2.3° S on 25 June at 10:00 solar time: altitude 51°, azimuth 47° east of north (north is -z, east is +x on
// the map), so shadows are short and fall to the south-west. One vector drives the light, the sun disc, the sky glow
// and every painted shade.
const SUN=new THREE.Vector3(.46,.78,-.43).normalize();
/** Where a shadow falls on the ground for something whose shade is cast from `height` units up. */
const shadowOffset=(height:number)=>({x:-SUN.x/SUN.y*height,z:-SUN.z/SUN.y*height});
// grass colour per tuft: mostly gold, some pale straw, rusty red oat grass, olive in the damp swales, green by water
const STRAW=new THREE.Color(1.08,1.05,.96),GOLD=new THREE.Color(1,1,1),RUST=new THREE.Color(1.03,.84,.7),SAGE=new THREE.Color(.84,.94,.74),LUSH=new THREE.Color(.62,.9,.52);
function grassTint(x:number,z:number,lush:boolean){
 if(lush)return hash(x,z,21)<.75?LUSH:SAGE;
 const swale=Math.sin(x*.0017+1)*Math.sin(z*.0021+Math.sin(x*.0011)*1.5),r=hash(x,z,22),rusty=Math.sin(x*.0043-z*.0029)>.55;
 return swale>.4&&r<.55?SAGE:rusty&&r<.6?RUST:r<.3?STRAW:GOLD;
}
// early dry season: the rains' flowering is over, so only a few white and yellow late bloomers survive where the soil stays damp
const FLOWERS=[new THREE.Color(1,1,1),new THREE.Color(1,.86,.3)];
const damp=(x:number,z:number)=>Math.sin(x*.0017+1)*Math.sin(z*.0021+Math.sin(x*.0011)*1.5)>.3||WATERS.some(w=>Math.hypot(x-w.x,z-w.y)<w.size*2.6);

/** A ring of faceted hills at the horizon, drawn far to near: blue-lavender ranges, sage ridges, then low golden rises
 *  with acacia silhouettes. Faces turned to the sun are warm, faces in their own shade cool, and every foot fades into haze. */
function horizon(lightweight:boolean){
 const pos:number[]=[],col:number[]=[],haze=hex(0xd2dad8),n=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
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
 layer(lightweight?54:84,.97,.012,.026,7,0xb3ae8c,0x8a9a98,.45,a=>bump(a,3.6,.25,.02)+bump(a,5.8,.3,.018));
 layer(lightweight?48:72,.94,.004,.012,13,0xb2a274,0x8b8c68,.25,()=>0);
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

export type Savanna={/** direction to the sun now (late morning in play, low in the west on the home screen) */sun:THREE.Vector3;update(time:number,x:number,z:number,range:number,cameraFar:number,camera:THREE.Vector3,wind?:{x:number;y:number}):void;realShadows(on:boolean):void;dusk():void;/** time of day in play: sun and moon directions (x east, y up, z south), how light it is (0 night, 1 day) and the moonlight */daylight(sun:THREE.Vector3,moon:THREE.Vector3,day:number,moonlight:number):void;dispose():void};
export function createSavanna(scene:THREE.Scene,lightweight:boolean):Savanna{
 const disposables:{dispose():void}[]=[],add=<T extends THREE.Object3D>(o:T)=>{scene.add(o);return o;};
 const facet=facetMaterial();disposables.push(facet);
 for(const tile of terrain(facet)){add(tile);disposables.push(tile.geometry);}
 const r=(i:number,k:number)=>hash(i,k,417);
 // scenery beyond the edge of the map (where nobody can walk): acacias and scrub that carry the plains to the hills
 const beyond=(count:number,seed:number)=>{const out:{x:number;y:number;size:number}[]=[];for(let k=0;out.length<count&&k<count*20;k++){const x=-760+hash(k,seed,1)*(W+1520),z=-760+hash(k,seed,2)*(H+1520),o=Math.max(-x,x-W,-z,z-H);if(o>90&&o<760)out.push({x,y:z,size:.8+hash(k,seed,3)*.6});}return out;};
 const trees=[...PROPS.filter(p=>p.kind==='tree'),...beyond(lightweight?60:170,1)];
 // acacias, three shapes (map trees come first, so their shape and turn match the climbing data)
 const lods:{near:THREE.InstancedMesh;far:THREE.InstancedMesh;items:Placed[]}[]=[];
 const leveled=(near:THREE.BufferGeometry,far:THREE.BufferGeometry,items:Placed[])=>{const a=add(instanced(near,facet,items)),b=add(instanced(far,facet,items));lods.push({near:a,far:b,items});disposables.push(near,far);};
 [11,23,37].forEach((seed,v)=>leveled(acacia(seed),acacia(seed,1),trees.filter((_,k)=>placementAt(k).variant===v).map(t=>({x:t.x,y:groundY(t.x,t.y),z:t.y,rot:placementAt(trees.indexOf(t)).rot,scale:10*t.size}))));
 // kopjes: boulders half sunk into their mounds
 const rocks=PROPS.filter(p=>p.kind==='rock');
 [5,9,17,29].forEach((seed,v)=>leveled(boulder(seed),boulder(seed,1),rocks.filter((_,i)=>i%4===v).map((t,i)=>({x:t.x,y:groundY(t.x,t.y)-t.size*6,z:t.y,rot:r(i,v+5)*6.28,scale:t.size*33,sy:.85+r(i,v+9)*.4}))));
 // level of detail: trees and boulders near the player use the full-facet model, distant ones a lighter cut, and those
 // past the far clipping plane are not submitted at all (the margin covers the camera's orbit around the animal, up to
 // ~260 units, plus a canopy's width and the 40-unit relevel step)
 const NEAR_LOD=lightweight?90:420,CULL_MARGIN=440,mat=new THREE.Matrix4(),quat=new THREE.Quaternion(),eul=new THREE.Euler(),at=new THREE.Vector3(),size=new THREE.Vector3(),lodAt={x:1e9,z:1e9,far:0};
 const relevel=(x:number,z:number,far:number)=>{const reach=far+CULL_MARGIN;for(const l of lods){l.near.count=0;l.far.count=0;for(const it of l.items){const d=Math.hypot(it.x-x,it.z-z);if(d>reach)continue;quat.setFromEuler(eul.set(0,it.rot,0));mat.compose(at.set(it.x,it.y,it.z),quat,size.set(it.scale,it.scale*(it.sy??1),it.scale));const mesh=d<NEAR_LOD?l.near:l.far;mesh.setMatrixAt(mesh.count++,mat);}for(const mesh of [l.near,l.far]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}}};
 // thickets: a scrub bush wrapped in tall grass (the hiding spots); half are green bush, half grey thorn scrub
 const bushes=PROPS.filter(p=>p.kind==='bush'),shrubs=[...bushes,...beyond(lightweight?40:120,2)],shrubGeo=[shrub(3),shrub(8,true)];disposables.push(...shrubGeo);
 shrubGeo.forEach((geo,v)=>add(instanced(geo,facet,shrubs.filter((_,i)=>i%2===v).map((b,i)=>({x:b.x,y:groundY(b.x,b.y),z:b.y,rot:r(i,2+v)*6.28,scale:b.size*8,sy:.75+r(i,4+v)*.35,tint:new THREE.Color().setScalar(.9+r(i,6+v)*.2)})))));
 // soft cool shade pooled under every acacia, bush and kopje, draped over the ground facets (real shadow maps are only on
 // the high tier; this gives every tier grounded props and the sunlit/shaded contrast of the savanna)
 // (pooled per ground tile, like the terrain, so shade off screen is culled with it)
 const shadeTiles=new Map<number,number[]>(),drape=(cx:number,cz:number,rad:number,stretch:number)=>{const n=lightweight?9:14,ux=-SUN.x,uz=-SUN.z,ul=Math.hypot(ux,uz),dx=ux/ul,dz=uz/ul;
  const key=Math.floor((cz-Z0)/(TILE*S))*1000+Math.floor((cx-X0)/(TILE*S));let shadePos=shadeTiles.get(key);if(!shadePos)shadeTiles.set(key,shadePos=[]);
  const at=(a:number,f:number)=>{const lx=Math.cos(a)*rad*f*stretch,lz=Math.sin(a)*rad*f,x=cx+dx*lx-dz*lz,z=cz+dz*lx+dx*lz;return[x,groundY(x,z)+1.2,z];};
  const c=[cx,groundY(cx,cz)+1.2,cz];for(let k=0;k<n;k++){const a0=k/n*Math.PI*2,a1=(k+1)/n*Math.PI*2;for(const f of [1,.6])shadePos.push(...c,...at(a1,f),...at(a0,f));}};
 for(const t of trees){const o=shadowOffset(26*t.size);drape(t.x+o.x,t.y+o.z,32*t.size,1.2);drape(t.x+o.x*.15,t.y+o.z*.15,7*t.size,1);}
 for(const b of shrubs){const o=shadowOffset(6*b.size);drape(b.x+o.x,b.y+o.z,11*b.size,1.2);}
 for(const k of rocks){const o=shadowOffset(10*k.size);drape(k.x+o.x,k.y+o.z,34*k.size,1.15);}
 const shadeMat=new THREE.MeshBasicMaterial({color:0x2f3a52,transparent:true,opacity:.2,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});disposables.push(shadeMat);
 const shade=add(new THREE.Group());
 for(const shadePos of shadeTiles.values()){const shadeGeo=new THREE.BufferGeometry();shadeGeo.setAttribute('position',new THREE.Float32BufferAttribute(shadePos,3));shadeGeo.computeBoundingSphere();const mesh=new THREE.Mesh(shadeGeo,shadeMat);mesh.renderOrder=1;shade.add(mesh);disposables.push(shadeGeo);}
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
 const density=lightweight?.15:1;
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
   // a few wildflower drifts in damp ground; stones lie scattered on the plain and pile up around the kopjes
   for(let d=0;d<3;d++){const fx=cx*CH+hash(cx,cz,d*7+100)*CH,fz=cz*CH+hash(cx,cz,d*7+101)*CH;if(!damp(fx,fz))continue;const tint=FLOWERS[Math.floor(hash(cx,cz,d*7+102)*FLOWERS.length)];for(let k=0;k<14;k++){const x=fx+(hash(fx,k,1)-.5)*70,z=fz+(hash(fz,k,2)-.5)*70;if(!blocked(x,z))per[4].push({x,y:groundY(x,z)-.3,z,rot:hash(x,z,4)*6.28,scale:.8+hash(x,z,5)*.6,tint});}}
   for(let k=0;k<26;k++){const x=cx*CH+hash(cx,cz,k*5+300)*CH,z=cz*CH+hash(cx,cz,k*5+301)*CH;if(!WATERS.some(w=>Math.hypot(x-w.x,z-w.y)<w.size*1.1))per[5].push({x,y:groundY(x,z)-.4,z,rot:hash(x,z,8)*6.28,scale:1.2+hash(x,z,9)*2.3,sy:.6+hash(x,z,10)*.6});}
   for(const t of rocks)if(Math.floor(t.x/CH)===cx&&Math.floor(t.y/CH)===cz)for(let k=0;k<6;k++){const a=hash(t.x,k,41)*6.283,d=t.size*(32+hash(t.y,k,42)*40),x=t.x+Math.cos(a)*d,z=t.y+Math.sin(a)*d;per[5].push({x,y:groundY(x,z)-.6,z,rot:a,scale:2.5+hash(k,t.x,43)*2.5,sy:.7+hash(k,t.y,44)*.5});}
  }
  per.forEach((items,v)=>{if(!items.length)return;const mesh=add(instanced(LAYERS[v][0],LAYERS[v][1],items,false));chunks.push({mesh,cx:cx*CH+CH/2,cz:cz*CH+CH/2,full:items.length});});
 }
 // watering holes: faceted water that shimmers, deep in the middle and pale green in the shallows
 const waterMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.1,metalness:.18,flatShading:true,transparent:true,opacity:.92});disposables.push(waterMat);
 const waters=WATERS.map((w,i)=>{const geo=pool(w.size,i+1);const mesh=add(new THREE.Mesh(geo,waterMat));mesh.position.set(w.x,waterLevel(w),w.y);mesh.receiveShadow=true;disposables.push(geo);return{mesh,base:Float32Array.from(geo.getAttribute('position').array as Float32Array)};});
 // sky dome: pale dusty haze at the horizon, a clean blue overhead, and a soft glow around the sun
 const skyGeo=new THREE.SphereGeometry(1,40,20),skyCol:number[]=[],sp=skyGeo.getAttribute('position'),sv=new THREE.Vector3();
 const daySky=(y:number,toSun:number)=>hex(0xe3e6df).lerp(hex(0xbfd6e8),smooth(.0,.12,y)).lerp(hex(0x7fb0de),smooth(.1,.45,y)).lerp(hex(0x4f86c9),smooth(.45,1,y)).lerp(hex(0xfdf8ea),smooth(.82,1,toSun)*.6);
 for(let i=0;i<sp.count;i++){sv.fromBufferAttribute(sp,i);const c=daySky(sv.y,sv.normalize().dot(SUN));skyCol.push(c.r,c.g,c.b);}
 skyGeo.setAttribute('color',new THREE.Float32BufferAttribute(skyCol,3));const skyMat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false});
 const sky=add(new THREE.Mesh(skyGeo,skyMat));sky.renderOrder=-3;disposables.push(skyGeo,skyMat);
 const cloudGeo=clouds(lightweight),cloudMat=new THREE.MeshBasicMaterial({vertexColors:true,fog:false,depthWrite:false});const cloudMesh=add(new THREE.Mesh(cloudGeo,cloudMat));cloudMesh.renderOrder=-2;disposables.push(cloudGeo,cloudMat);
 const sunDir=SUN.clone(),sunMat=new THREE.MeshBasicMaterial({color:0xfff6dc,fog:false,depthWrite:false}),sunGeo=new THREE.CircleGeometry(.04,16),haloMat=new THREE.MeshBasicMaterial({color:0xfff0c8,fog:false,depthWrite:false,transparent:true,opacity:.28}),haloGeo=new THREE.CircleGeometry(.075,16);
 const sunDisc=add(new THREE.Mesh(sunGeo,sunMat)),sunHalo=add(new THREE.Mesh(haloGeo,haloMat));sunDisc.renderOrder=-2;sunHalo.renderOrder=-2;disposables.push(sunMat,sunGeo,haloMat,haloGeo);
 // the moon (its own disc, cool white) and a field of stars fixed to the sky dome, both only seen after dark
 const moonDir=new THREE.Vector3(0,-1,0),moonMat=new THREE.MeshBasicMaterial({color:0xeef1f8,fog:false,depthWrite:false,transparent:true,opacity:0}),moonGeo=new THREE.CircleGeometry(.03,20),moonDisc=add(new THREE.Mesh(moonGeo,moonMat));moonDisc.renderOrder=-2;moonDisc.visible=false;disposables.push(moonMat,moonGeo);
 const starPos:number[]=[];for(let i=0;i<(lightweight?350:900);i++){const u=hash(i,1,71),a=hash(i,2,72)*Math.PI*2,y=.04+u*.96,r=Math.sqrt(1-y*y);starPos.push(Math.cos(a)*r,y,Math.sin(a)*r);}
 const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));const starMat=new THREE.PointsMaterial({color:0xdfe6ff,size:1.6,sizeAttenuation:false,fog:false,depthWrite:false,transparent:true,opacity:0});
 const stars=add(new THREE.Points(starGeo,starMat));stars.renderOrder=-2;stars.visible=false;disposables.push(starGeo,starMat);
 const hillGeo=horizon(lightweight),hillMat=new THREE.MeshBasicMaterial({vertexColors:true,fog:false,side:THREE.DoubleSide,depthWrite:false});const hills=add(new THREE.Mesh(hillGeo,hillMat));hills.renderOrder=-1;disposables.push(hillGeo,hillMat);
 let lastWater=0;
 return{
  sun:sunDir,
  update(t,x,z,range,far,cam,wind){
   time.value=t;lens.value.copy(cam);if(wind)breeze.value.set(wind.x,wind.y);
   const radius=far*.92;sky.position.copy(cam);sky.scale.setScalar(radius);hills.position.set(cam.x,cam.y-radius*.04,cam.z);hills.scale.set(radius*.97,radius,radius*.97);
   cloudMesh.position.copy(cam);cloudMesh.scale.setScalar(radius);cloudMesh.rotation.y=t*.0015;
   for(const [disc,d] of [[sunDisc,.95],[sunHalo,.96]] as const){disc.position.copy(cam).addScaledVector(sunDir,radius*d);disc.scale.setScalar(radius);disc.lookAt(cam);}
   if(moonDisc.visible){moonDisc.position.copy(cam).addScaledVector(moonDir,radius*.95);moonDisc.scale.setScalar(radius);moonDisc.lookAt(cam);}
   if(stars.visible){stars.position.copy(cam);stars.scale.setScalar(radius*.97);}
   // grass thins out with distance (instances are in random order, so drawing fewer keeps an even spread)
   for(const c of chunks){const d=Math.hypot(c.cx-x,c.cz-z),reach=range*(lightweight?.6:.85)+CH*.7;c.mesh.visible=d<reach;c.mesh.count=Math.ceil(c.full*(d<CH*1.1?1:d<reach*.6?.45:.2));}
   if(Math.hypot(x-lodAt.x,z-lodAt.z)>40||far!==lodAt.far){lodAt.x=x;lodAt.z=z;lodAt.far=far;relevel(x,z,far);}
   if(t-lastWater>.08){lastWater=t;for(const w of waters){const pos=w.mesh.geometry.getAttribute('position') as THREE.BufferAttribute,a=pos.array as Float32Array;for(let i=0;i<a.length;i+=3){const px=w.base[i],pz=w.base[i+2],edge=Math.hypot(px,pz)>1?1:0;a[i+1]=edge*Math.sin(t*1.3+px*.05+pz*.07)*.5;}pos.needsUpdate=true;w.mesh.geometry.computeVertexNormals();}}
  },
  realShadows(on){shade.visible=!on;},
  // the home screen's late golden hour: an ember horizon under a deepening violet sky, rose-lit clouds, dusky hills
  dusk(){
   sunDir.copy(DUSK_SUN);
   const col=skyGeo.getAttribute('color') as THREE.BufferAttribute;
   for(let i=0;i<sp.count;i++){sv.fromBufferAttribute(sp,i);const y=sv.y,c=hex(0xffb36a).lerp(hex(0xf08a5c),smooth(.0,.1,y)).lerp(hex(0xa8607a),smooth(.08,.32,y)).lerp(hex(0x4a3f78),smooth(.3,.7,y)).lerp(hex(0x1f2450),smooth(.7,1,y));c.lerp(hex(0xffe0a8),smooth(.75,1,sv.normalize().dot(DUSK_SUN))*.75);col.setXYZ(i,c.r,c.g,c.b);}
   col.needsUpdate=true;cloudMat.color.set(0xffb9a0);hillMat.color.set(0x8a6f86);sunMat.color.set(0xffe2a6);haloMat.color.set(0xffb070);haloMat.opacity=.45;
  },
  // the clock in play: the sky dome is repainted from three palettes (day, the ember band of sunset and dawn on the sun's
  // side, a moonlit navy night), the sun and moon discs ride their real paths, stars come out, and the painted ground
  // shade fades as the sun gets low (it was laid for the late-morning sun; at night there is only moonlight)
  daylight(sunNow,moon,day,moonlight){
   const up=sunNow.y,ember=smooth(-.2,.02,up)*(1-smooth(.05,.4,up)),col=skyGeo.getAttribute('color') as THREE.BufferAttribute,hs=Math.hypot(sunNow.x,sunNow.z)||1;
   for(let i=0;i<sp.count;i++){sv.fromBufferAttribute(sp,i);const y=sv.y,v=sv.normalize(),toSun=v.dot(sunNow),side=.5+.5*(v.x*sunNow.x+v.z*sunNow.z)/(Math.hypot(v.x,v.z)*hs||1);
    const night=hex(0x1a2744).lerp(hex(0x0d1630),smooth(.0,.35,y)).lerp(hex(0x060b1c),smooth(.35,1,y)).lerp(hex(0x2c3a5c),smooth(.9,1,v.dot(moon))*moonlight*.8),
     glow=hex(0xffb36a).lerp(hex(0xf08a5c),smooth(.0,.1,y)).lerp(hex(0xa8607a),smooth(.08,.32,y)).lerp(hex(0x4a3f78),smooth(.3,.7,y)).lerp(hex(0x1f2450),smooth(.7,1,y)).lerp(hex(0xffe0a8),smooth(.75,1,toSun)*.75);
    const c=night.lerp(daySky(y,toSun),day).lerp(glow,ember*(.25+.75*side*side)*(1-smooth(.2,.8,y)*.5));col.setXYZ(i,c.r,c.g,c.b);}
   col.needsUpdate=true;
   const tint=hex(0x27304a).lerp(hex(0xffffff),day).lerp(hex(0xffb9a0),ember*.8);cloudMat.color.copy(tint);hillMat.color.copy(hex(0x2a3248).lerp(hex(0xffffff),day).lerp(hex(0x8a6f86),ember*.7));
   sunDir.copy(sunNow);sunMat.color.set(0xfff6dc).lerp(hex(0xffb070),ember);haloMat.color.set(0xfff0c8).lerp(hex(0xff9a50),ember);haloMat.opacity=.28+ember*.25;sunDisc.visible=sunHalo.visible=up>-.06;
   moonDir.copy(moon);moonDisc.visible=moon.y>-.03&&moonlight>.02;moonMat.opacity=Math.min(1,.25+moonlight*.9)*(1-day*.7);
   starMat.opacity=(1-smooth(-.25,.05,up))*(1-moonlight*.45);stars.visible=starMat.opacity>.01;
   shadeMat.opacity=.2*smooth(.15,.6,up);
  },
  dispose(){disposables.forEach(d=>d.dispose());},
 };
}
export const SUN_DIRECTION=SUN.clone();
/** the home screen's golden-hour sun: about 22° up, west-north-west (late-June sunset at 2° S is about 23° north of west) */
const DUSK_SUN=new THREE.Vector3(-.85,.38,-.36).normalize();
