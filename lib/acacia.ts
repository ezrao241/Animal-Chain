// The umbrella-thorn acacia's trunk and limbs as data, shared by the 3D model (savanna-world.ts builds its bark from
// it) and the rules (climbing paths, perches and colliders), so a leopard on a limb stands on the limb that is drawn.
// Model space is metres for a size-1 tree, +y up; a placed tree is turned about y and scaled by 10 x size.
import type {Prop} from './game';

/** Same lattice hash as the faceted modelling kit, so the drawn tree and this data share every random number. */
export function hash(x:number,y:number,z:number){let h=Math.imul(Math.floor(x)|0,374761393)+Math.imul(Math.floor(y)|0,668265263)+Math.imul(Math.floor(z)|0,1274126177);h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296;}
type V3=[number,number,number];
/** A limb: a centreline from where it leaves the trunk to its tip, with the bark radius at each point. */
export type Limb={path:V3[];radii:number[];rest:boolean};
export type AcaciaShape={fork:number;trunk:{c:V3;r:number}[];limbs:Limb[];canopy:{c:V3;r:V3;rot:number}[]};
export const ACACIA_SEEDS=[11,23,37] as const;

const shapes=new Map<number,AcaciaShape>();
export function acaciaShape(seed:number):AcaciaShape{
 const cached=shapes.get(seed);if(cached)return cached;
 const r=(a:number,b:number)=>a+hash(seed,a*100,b*100)*(b-a),fork=2.6+r(0,.6);
 const trunk=[{c:[0,-.3,0] as V3,r:.24},{c:[0,1.2,0] as V3,r:.17},{c:[.15,fork,0] as V3,r:.15}];
 const limbs:Limb[]=[],canopy:AcaciaShape['canopy']=[];
 const branches=3+Math.floor(r(0,1.9)),spin=r(-.3,.3);
 // the climbable resting limb: a thick, nearly level bough lower down, in the widest gap between the crown branches
 // (the kind a leopard drapes itself over; real umbrella thorns often carry one or two)
 {const a=(.5)/branches*Math.PI*2+spin,h=fork-1.25,ax=.15*Math.max(0,h-1.2)/(fork-1.2),dx=Math.cos(a),dz=Math.sin(a);
  limbs.push({path:[[ax,h,0],[ax+dx*1.3,h+.16,dz*1.3],[ax+dx*2.5,h+.48,dz*2.5]],radii:[.15,.1,.045],rest:true});
  canopy.push({c:[ax+dx*2.6,h+1.65,dz*2.6],r:[.95,.26,.95],rot:a});}
 for(let b=0;b<branches;b++){
  const a=b/branches*Math.PI*2+spin,out=2.2+r(0,1.6),top=fork+1.6+r(0,1.1);
  limbs.push({path:[[.15,fork-.2,0],[Math.cos(a)*out*.45+.15,fork+(top-fork)*.6,Math.sin(a)*out*.45],[Math.cos(a)*out,top,Math.sin(a)*out]],radii:[.13,.085,.04],rest:false});
  canopy.push({c:[Math.cos(a)*out,top+.35,Math.sin(a)*out],r:[1.9+r(0,.8),.42+r(0,.15),1.9+r(0,.8)],rot:a});
 }
 canopy.push({c:[.1,fork+2.4+r(0,.5),0],r:[2.6+r(0,.6),.5,2.4+r(0,.6)],rot:0});
 const shape={fork,trunk,limbs,canopy};shapes.set(seed,shape);return shape;
}

/** Which of the three acacia models a tree uses and how it is turned, exactly as the world places them. */
const ordinals=new WeakMap<Prop[],Map<Prop,number>>();
export function treePlacement(ps:Prop[],t:Prop){
 let m=ordinals.get(ps);if(!m){m=new Map();let i=0;for(const p of ps)if(p.kind==='tree')m.set(p,i++);ordinals.set(ps,m);}
 return placementAt(m.get(t)??0);
}
/** the k-th tree drawn: model variant k % 3, turned by a hash of its place in that variant's list */
export function placementAt(k:number){const v=k%3,i=Math.floor(k/3);return{seed:ACACIA_SEEDS[v],rot:hash(i,v,417)*6.28,variant:v,index:i};}

// ---------------------------------------------------------------- the same tree in game units
// Ground-plane positions are game x/y; heights are game units above the ground at the trunk's foot.
export type Pt={x:number;y:number;h:number};
export type Segment={a:Pt;b:Pt;ra:number;rb:number;limb:number};
export type Tree={prop:Prop;shape:AcaciaShape;rot:number;scale:number;
 /** trunk axis and bark radius at height h (game units) */
 axis:(h:number)=>{x:number;y:number;r:number};
 /** top of the climbable trunk (where the crown branches leave), game units */
 top:number;
 limbs:{start:number;points:Pt[];radii:number[];lengths:number[];length:number;angle:number;rest:boolean}[];
 /** every bark surface as tapered capsules: the trunk (limb -1) and each limb */
 segments:Segment[]};
const trees=new WeakMap<Prop,Tree>();
export function tree(ps:Prop[],t:Prop):Tree{
 const cached=trees.get(t);if(cached)return cached;
 const {seed,rot}=treePlacement(ps,t),shape=acaciaShape(seed),S=10*t.size,c=Math.cos(rot),s=Math.sin(rot);
 // a three.js turn about y: model (x, z) lands on world (x cos + z sin, -x sin + z cos); world z is game y
 const place=([x,y,z]:V3):Pt=>({x:t.x+S*(x*c+z*s),y:t.y+S*(-x*s+z*c),h:S*y});
 const tr=shape.trunk;
 const axis=(h:number)=>{const y=h/S;let i=0;while(i<tr.length-2&&y>tr[i+1].c[1])i++;const a=tr[i],b=tr[i+1],u=Math.max(0,Math.min(1,(y-a.c[1])/(b.c[1]-a.c[1])));
  const p=place([a.c[0]+(b.c[0]-a.c[0])*u,y,0]);return{x:p.x,y:p.y,r:S*(a.r+(b.r-a.r)*u)};};
 const limbs=shape.limbs.map(l=>{const points=l.path.map(place),lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y,p.h-points[i].h));
  return{start:points[0].h,points,radii:l.radii.map(x=>x*S),lengths,length:lengths.reduce((a,b)=>a+b,0),angle:Math.atan2(points.at(-1)!.y-points[0].y,points.at(-1)!.x-points[0].x),rest:l.rest};});
 const top=S*(shape.fork-.2),segments:Segment[]=[];
 for(let i=0;i<tr.length-1;i++){const a=place(tr[i].c),b=place(tr[i+1].c);segments.push({a,b,ra:tr[i].r*S,rb:tr[i+1].r*S,limb:-1});}
 limbs.forEach((l,k)=>l.points.slice(1).forEach((b,i)=>segments.push({a:l.points[i],b,ra:l.radii[i],rb:l.radii[i+1],limb:k})));
 const out={prop:t,shape,rot,scale:S,axis,top,limbs,segments};trees.set(t,out);return out;
}

/** A point on limb k, `along` game units from where it leaves the trunk: centreline, unit tangent and bark radius. */
export function limbPoint(T:Tree,k:number,along:number){
 const l=T.limbs[k];let d=Math.max(0,Math.min(l.length,along)),i=0;
 while(i<l.lengths.length-1&&d>l.lengths[i]){d-=l.lengths[i];i++;}
 const a=l.points[i],b=l.points[i+1],u=Math.min(1,d/l.lengths[i]),len=l.lengths[i];
 return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,h:a.h+(b.h-a.h)*u,tx:(b.x-a.x)/len,ty:(b.y-a.y)/len,th:(b.h-a.h)/len,r:l.radii[i]+(l.radii[i+1]-l.radii[i])*u};
}
/** Closest point on a tapered capsule's surface to q: the bark point, its outward normal and the distance to it. */
export function nearestBark(seg:Segment,q:Pt){
 const vx=seg.b.x-seg.a.x,vy=seg.b.y-seg.a.y,vh=seg.b.h-seg.a.h,l2=vx*vx+vy*vy+vh*vh;
 const u=Math.max(0,Math.min(1,((q.x-seg.a.x)*vx+(q.y-seg.a.y)*vy+(q.h-seg.a.h)*vh)/l2));
 const cx=seg.a.x+vx*u,cy=seg.a.y+vy*u,ch=seg.a.h+vh*u,r=seg.ra+(seg.rb-seg.ra)*u;
 let nx=q.x-cx,ny=q.y-cy,nh=q.h-ch;const n=Math.hypot(nx,ny,nh)||1;nx/=n;ny/=n;nh/=n;
 return{x:cx+nx*r,y:cy+ny*r,h:ch+nh*r,nx,ny,nh,d:n-r};
}
