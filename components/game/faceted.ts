// Faceted low-poly modelling kit. Shapes are lofted through rings of a few sides, with slightly irregular vertices so the
// planes read as deliberate, hand-cut facets (the Cell to Singularity look) rather than a smooth mesh at low resolution.
// Every triangle gets its own colour from a coat function, so markings (spots, stripes, a mane) follow the facets.
import * as THREE from 'three';
import {toCreasedNormals} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
/** Surfaces are shaded smoothly across gentle angles and keep a crease only at sharp edges (natural, not faceted). */
const CREASE=Math.PI*.42;

export type V=[number,number,number];
/** A cross-section: centre, lateral half-width (rz) and half-depth in the path's own vertical plane (ry).
 *  top/bot scale the upper and lower half of the ring (a flat back, a deep chest keel). */
export type Ring={c:V;rz:number;ry:number;top?:number;bot?:number};
export type Tri={a:THREE.Vector3;b:THREE.Vector3;c:THREE.Vector3;part:string;sub:number};
export type LoftOptions={n?:number;jitter?:number;start?:'point'|'flat'|'none';end?:'point'|'flat'|'none';capLength?:number;sub?:number;seed?:number};
export type Coat=(p:THREE.Vector3,n:THREE.Vector3,part:string,rand:number)=>THREE.Color;

export function hash(x:number,y:number,z:number){let h=Math.imul(Math.floor(x)|0,374761393)+Math.imul(Math.floor(y)|0,668265263)+Math.imul(Math.floor(z)|0,1274126177);h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296;}
function seeded(seed:number){let a=seed|0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
/** Distance to the nearest point of a jittered 3D lattice: the basis of spots and rosettes. */
export function cellDistance(p:THREE.Vector3,size:number,seed=0){
 const x=p.x/size,y=p.y/size,z=p.z/size,ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let best=9,second=9;
 for(let k=-1;k<=1;k++)for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const cx=ix+i,cy=iy+j,cz=iz+k;const fx=cx+hash(cx,cy,cz+seed),fy=cy+hash(cx+31,cy,cz+seed),fz=cz+hash(cx,cy+57,cz+seed);const d=Math.hypot(fx-x,fy-y,fz-z);if(d<best){second=best;best=d;}else if(d<second)second=d;}
 return{d:best,edge:second-best};
}

export class Model{
 tris:Tri[]=[];
 private rand:()=>number;
 /** lod 0 is full detail; each level up cuts ring sides, sphere detail and colour subdivision for distant copies */
 constructor(seed=7,public lod=0){this.rand=seeded(seed);}
 /** Loft a tube through the rings. Paths that stay in the animal's side plane keep a stable frame (lateral = +Z). */
 loft(part:string,rings:Ring[],o:LoftOptions={}){
  const n=Math.max(4,(o.n??8)-2*this.lod),jit=o.jitter??.06,sub=Math.max(0,(o.sub??0)-this.lod),pts:THREE.Vector3[][]=[],tangents:THREE.Vector3[]=[],centres=rings.map(r=>new THREE.Vector3(...r.c));
  rings.forEach((r,i)=>{
   const t=centres[Math.min(i+1,rings.length-1)].clone().sub(centres[Math.max(i-1,0)]).normalize();tangents.push(t);
   const z=new THREE.Vector3(0,0,1),side=z.sub(t.clone().multiplyScalar(t.z));if(side.lengthSq()<1e-4)side.set(1,0,0);side.normalize();
   const up=new THREE.Vector3().crossVectors(side,t).normalize(),ring:THREE.Vector3[]=[];
   for(let k=0;k<n;k++){const a=Math.PI/2+k/n*Math.PI*2,s=Math.sin(a),j=1+jit*(this.rand()*2-1);
    ring.push(centres[i].clone().addScaledVector(side,Math.cos(a)*r.rz*j).addScaledVector(up,s*r.ry*j*(s>0?r.top??1:r.bot??1)).addScaledVector(t,(this.rand()-.5)*jit*Math.min(r.rz,r.ry)));}
   pts.push(ring);
  });
  for(let i=0;i<rings.length-1;i++)for(let k=0;k<n;k++){
   const a=pts[i][k],b=pts[i][(k+1)%n],c=pts[i+1][(k+1)%n],d=pts[i+1][k],mid=centres[i].clone().add(centres[i+1]).multiplyScalar(.5);
   if((i+k)%2){this.tri(part,a,b,c,mid,sub);this.tri(part,a,c,d,mid,sub);}else{this.tri(part,a,b,d,mid,sub);this.tri(part,b,c,d,mid,sub);}
  }
  const cap=(i:number,kind:'point'|'flat'|'none'|undefined,dir:number)=>{if(kind==='none')return;const r=rings[i],t=tangents[i].clone().multiplyScalar(dir);
   const tip=centres[i].clone().addScaledVector(t,kind==='point'?(o.capLength??Math.min(r.rz,r.ry)*.7):0),inside=centres[i].clone().addScaledVector(t,-1);
   for(let k=0;k<n;k++)this.tri(part,pts[i][k],pts[i][(k+1)%n],tip,inside,sub);};
  cap(0,o.start??'point',-1);cap(rings.length-1,o.end??'point',1);
  return this;
 }
 /** A faceted ellipsoid (icosphere with jitter), for paws, tufts, warts, eyes and ear tips. */
 blob(part:string,c:V,r:V,o:{detail?:number;jitter?:number;sub?:number;rot?:V}={}){
  const g=new THREE.IcosahedronGeometry(1,Math.max(0,(o.detail??0)-this.lod)),pos=g.getAttribute('position'),idx=g.index,centre=new THREE.Vector3(...c),e=new THREE.Euler(...(o.rot??[0,0,0])),moved=new Map<string,THREE.Vector3>();
  const sub=Math.max(0,(o.sub??0)-this.lod),at=(i:number)=>{const v=new THREE.Vector3().fromBufferAttribute(pos,i),key=v.toArray().map(x=>x.toFixed(3)).join();let m=moved.get(key);if(!m){m=v.clone().multiplyScalar(1+(o.jitter??.12)*(this.rand()*2-1)).multiply(new THREE.Vector3(...r)).applyEuler(e).add(centre);moved.set(key,m);}return m;};
  const count=idx?idx.count:pos.count;for(let i=0;i<count;i+=3){const a=idx?idx.getX(i):i,b=idx?idx.getX(i+1):i+1,d=idx?idx.getX(i+2):i+2;this.tri(part,at(a),at(b),at(d),centre,sub);}
  g.dispose();return this;
 }
 /** A tapering horn, tusk, ear or claw along a path of points with radii, ending in a point. */
 spike(part:string,path:V[],radii:number[],o:LoftOptions={}){return this.loft(part,path.map((c,i)=>({c,rz:radii[i],ry:radii[i]})),{n:5,jitter:.04,start:'flat',end:'point',...o});}
 private tri(part:string,a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,inside:THREE.Vector3,sub:number){
  const n=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)),out=new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1/3).sub(inside);
  this.tris.push(n.dot(out)>=0?{a,b,c,part,sub}:{a,b:c,c:b,part,sub});
 }
 /** Mirror every triangle of a part across z=0 into a new part (left/right legs, ears, eyes, tusks). */
 mirror(from:string,to:string){for(const t of this.tris.filter(t=>t.part===from||t.part.startsWith(from+'#'))){const m=(v:THREE.Vector3)=>new THREE.Vector3(v.x,v.y,-v.z);this.tris.push({a:m(t.a),b:m(t.c),c:m(t.b),part:to+t.part.slice(from.length),sub:t.sub});}return this;}
 /** Build one flat-shaded, vertex-coloured geometry per part, positioned relative to that part's pivot. */
 build(coat:Coat,pivots:Record<string,V>,lightJitter=.07){
  const parts=new Map<string,{p:number[];c:number[]}>(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),nn=new THREE.Vector3(),cen=new THREE.Vector3();
  const emit=(t:{a:THREE.Vector3;b:THREE.Vector3;c:THREE.Vector3},part:string)=>{
   // "head#eye" is drawn with the head mesh; the suffix only tells the coat what it is colouring
   const key=part.split('#')[0];let bucket=parts.get(key);if(!bucket)parts.set(key,bucket={p:[],c:[]});
   nn.copy(ab.subVectors(t.b,t.a)).cross(ac.subVectors(t.c,t.a)).normalize();cen.copy(t.a).add(t.b).add(t.c).multiplyScalar(1/3);
   const r=hash(cen.x*997,cen.y*991,cen.z*983),col=coat(cen,nn,part,r).clone();col.multiplyScalar(1+(r-.5)*2*lightJitter);
   const pv=pivots[key]??[0,0,0];for(const v of [t.a,t.b,t.c]){bucket.p.push(v.x-pv[0],v.y-pv[1],v.z-pv[2]);bucket.c.push(col.r,col.g,col.b);}
  };
  const split=(t:{a:THREE.Vector3;b:THREE.Vector3;c:THREE.Vector3},depth:number,part:string)=>{
   if(!depth){emit(t,part);return;}
   const ab2=t.a.clone().lerp(t.b,.5),bc=t.b.clone().lerp(t.c,.5),ca=t.c.clone().lerp(t.a,.5);
   for(const s of [{a:t.a,b:ab2,c:ca},{a:ab2,b:t.b,c:bc},{a:ca,b:bc,c:t.c},{a:ab2,b:bc,c:ca}])split(s,depth-1,part);
  };
  for(const t of this.tris)split(t,t.sub,t.part);
  const out=new Map<string,THREE.BufferGeometry>();
  for(const [part,b] of parts){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));const smooth=toCreasedNormals(g,CREASE);g.dispose();smooth.computeBoundingSphere();out.set(part,smooth);}
  return out;
 }
}
export const hex=(h:number)=>new THREE.Color(h);
/** Shared look for everything built with this kit: colour in the vertices, smooth shading, a soft matte finish. */
export const facetMaterial=()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:0});
