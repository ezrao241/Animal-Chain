// The six savanna animals, modelled in code as faceted low-poly bodies with real anatomy and life-size proportions
// (lengths in metres, scaled x10 into game units). Each animal is a small joint hierarchy (body, neck, head, ears,
// two tail segments, three segments per leg) so walking, galloping, grazing, stalking, kicking and leaping are animated.
import * as THREE from 'three';
import {Model,Ring,V,Coat,hex,cellDistance,facetMaterial} from './faceted';
import {ANIMALS,type Species} from '@/lib/game';
import {nearestBark,type Segment} from '@/lib/acacia';
import {createRenderer,SoftwareRenderer} from './software-renderer';

type Leg={name:string;hip:V;knee:V;ankle:V;ground:V;radii:[number,number,number,number];above:{c:V;r:number};foot:{c:V;r:V};hoof?:boolean;front:boolean};
type Spec={
 torso:Ring[];neck:Ring[];head:Ring[];jaw?:Ring[];neckPivot:V;headPivot:V;
 eye:{c:V;r:V};ear:{pivot:V;build:(m:Model,part:string)=>void};
 front:Omit<Leg,'name'|'front'>;hind:Omit<Leg,'name'|'front'>;
 tail:{base:V;a:Ring[];b:Ring[];mid:V;tuft?:{c:V;r:V}};
 extras?:(m:Model)=>void;coat:Coat;sub:Partial<Record<string,number>>;
 stride:number;camera:CameraProfile;
};
export type CameraProfile={distance:number;min:number;max:number;head:number;lift:number;lookAhead:number;lookY:number;clearance:number;near:number;shadow:[number,number]};
const R=(x:number,y:number,rz:number,ry:number,top?:number,bot?:number,z=0):Ring=>({c:[x,y,z],rz,ry,top,bot});
const mix=(a:number,b:number,t:number)=>hex(a).lerp(hex(b),Math.max(0,Math.min(1,t)));
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
/** A crest (mane, spine ridge) standing on top of a path: rings offset along the path's upward normal. */
function crest(m:Model,part:string,path:[number,number][],offset:number[],height:number[],width:number,jitter=.18){
 const rings:Ring[]=path.map(([x,y],i)=>{const [px,py]=path[Math.max(0,i-1)],[nx,ny]=path[Math.min(path.length-1,i+1)],l=Math.hypot(nx-px,ny-py)||1,ux=-(ny-py)/l,uy=(nx-px)/l;return{c:[x+ux*(offset[i]+height[i]/2),y+uy*(offset[i]+height[i]/2),0],rz:width,ry:height[i]/2};});
 m.loft(part,rings,{n:6,jitter,start:'point',end:'point'});
}
const eyeCoat=(n:THREE.Vector3,iris:number,part:string)=>part.includes('#glint')?hex(0xffffff):n.x>.55&&n.y>-.3?hex(0x0d0a08):hex(iris).multiplyScalar(1.15);

// ---------------------------------------------------------------- lion (adult male)
const lion:Spec={
 torso:[R(-.84,.93,.1,.12),R(-.76,.92,.2,.23),R(-.6,.9,.25,.28),R(-.38,.86,.23,.24,1,.85),R(-.12,.88,.25,.28,1,.95),R(.15,.92,.28,.31,1,1.08),R(.4,.95,.27,.3,1,1.1),R(.56,.99,.21,.25)],
 neck:[R(.45,1.02,.19,.22),R(.66,1.12,.17,.19),R(.8,1.18,.14,.16)],neckPivot:[.5,1.05,0],headPivot:[.8,1.18,0],
 head:[R(.76,1.2,.13,.14),R(.86,1.23,.17,.17),R(.97,1.21,.165,.145,1,1.05),R(1.06,1.15,.125,.11),R(1.14,1.12,.095,.085),R(1.19,1.11,.065,.065)],
 jaw:[R(.92,1.06,.09,.045),R(1.03,1.04,.08,.04),R(1.13,1.04,.055,.03)],
 eye:{c:[1.02,1.235,.095],r:[.026,.022,.015]},
 ear:{pivot:[.9,1.29,.11],build:(m,p)=>m.blob(p,[.9,1.33,.12],[.035,.055,.05],{jitter:.08})},
 front:{hip:[.42,1,.16],knee:[.36,.6,.17],ankle:[.42,.17,.16],ground:[.47,.03,.16],radii:[.14,.1,.065,.06],above:{c:[.45,1.12,.15],r:.16},foot:{c:[.5,.05,.16],r:[.09,.05,.075]}},
 hind:{hip:[-.58,.98,.15],knee:[-.45,.58,.17],ankle:[-.66,.27,.16],ground:[-.6,.03,.16],radii:[.17,.1,.06,.055],above:{c:[-.6,1.08,.14],r:.17},foot:{c:[-.56,.05,.16],r:[.085,.05,.07]}},
 tail:{base:[-.82,.98,0],a:[R(-.82,.98,.045,.045),R(-1,.82,.04,.04),R(-1.12,.66,.035,.035)],mid:[-1.12,.66,0],b:[R(-1.12,.66,.032,.032),R(-1.25,.52,.03,.03),R(-1.36,.47,.025,.025)],tuft:{c:[-1.4,.46,0],r:[.07,.06,.06]}},
 extras:m=>{
  // the mane: a shaggy ruff around neck and face, hanging into a bib on the chest
  m.loft('neck#mane',[R(.36,1.1,.22,.28),R(.52,1.16,.32,.4,1,1.3),R(.7,1.22,.33,.39,1.05,1.25),R(.83,1.24,.28,.33,1.05,1.15),R(.89,1.24,.2,.24)],{n:10,jitter:.17,start:'point',end:'flat'});
  m.blob('head#mane',[.83,1.36,0],[.09,.06,.13],{jitter:.2});
 },
 coat:(p,n,part)=>{
  if(part.includes('#eye')||part.includes('#glint'))return eyeCoat(n,0xc8902c,part);
  if(part.includes('#mane')){const r=Math.hypot(p.y-1.22,p.z),t=smooth(.16,.4,r)*.6+(p.y<1.0?.35:0)+(n.x<-.3?.2:0);return t<.25?mix(0xd09245,0xb86a2c,t*4):t<.6?mix(0xb4602a,0x8c4420,(t-.25)*3):mix(0x7a3a1c,0x55291a,(t-.6)*2.5);}
  if(part.includes('#tuft'))return hex(0x3a2216);
  if(part.startsWith('ear'))return n.x<-.2?hex(0x3d281a):hex(0xc79a5e);
  if(part==='head'||part==='head#jaw'){if(p.x>1.17&&n.x>.55&&p.y>1.09)return hex(0x5e3229);if(p.x>1.0&&p.y<1.1)return hex(0xefe2c6);if(p.x>1.07)return hex(0xe2c697);if(Math.hypot(p.x-1.0,p.y-1.205)<.04&&Math.abs(p.z)>.06)return hex(0xe6cf9f);return mix(0xcf9a52,0xb7803f,n.y);}
  if(p.y<.72&&part==='torso'||n.y<-.55)return hex(0xe2cc9c);
  if(part.startsWith('leg'))return mix(0xd7ad70,0xc58d48,p.y*1.4);
  return mix(0xc8914a,0xb07a38,smooth(.2,.9,n.y));
 },
 sub:{},stride:1.25,
 camera:{distance:62,min:34,max:150,head:13,lift:6,lookAhead:14,lookY:2,clearance:4,near:.2,shadow:[15,7]},
};

// ---------------------------------------------------------------- leopard
const rosette=(p:THREE.Vector3,base:THREE.Color,size:number,solid:boolean)=>{const {d}=cellDistance(p,size,3);if(solid)return d<.3?hex(0x2a1c12):base;return d<.17?base.clone().multiplyScalar(.82):d<.36?hex(0x2a1c12):base;};
const leopard:Spec={
 torso:[R(-.62,.62,.08,.09),R(-.55,.62,.15,.16),R(-.42,.61,.17,.18),R(-.2,.58,.15,.16,1,.85),R(.02,.6,.16,.19),R(.24,.63,.17,.2,1,1.08),R(.4,.65,.15,.18),R(.48,.67,.12,.15)],
 neck:[R(.4,.68,.12,.14),R(.56,.76,.1,.11),R(.64,.8,.09,.1)],neckPivot:[.42,.68,0],headPivot:[.64,.8,0],
 head:[R(.6,.82,.085,.085),R(.68,.84,.1,.095),R(.76,.82,.095,.08,1,1.05),R(.82,.78,.065,.06),R(.86,.765,.045,.04)],
 jaw:[R(.73,.745,.05,.025),R(.84,.74,.035,.02)],
 eye:{c:[.775,.85,.055],r:[.017,.014,.01]},
 ear:{pivot:[.66,.89,.06],build:(m,p)=>m.blob(p,[.665,.915,.065],[.022,.037,.034],{jitter:.06})},
 front:{hip:[.32,.66,.1],knee:[.28,.38,.11],ankle:[.32,.1,.105],ground:[.35,.02,.105],radii:[.09,.065,.04,.04],above:{c:[.34,.74,.09],r:.1},foot:{c:[.37,.035,.105],r:[.055,.035,.045]}},
 hind:{hip:[-.44,.64,.1],knee:[-.34,.38,.11],ankle:[-.5,.17,.105],ground:[-.46,.02,.105],radii:[.11,.065,.04,.035],above:{c:[-.45,.72,.09],r:.11},foot:{c:[-.43,.035,.105],r:[.05,.033,.042]}},
 tail:{base:[-.6,.66,0],a:[R(-.6,.66,.036,.036),R(-.8,.5,.033,.033),R(-.95,.36,.03,.03)],mid:[-.95,.36,0],b:[R(-.95,.36,.03,.03),R(-1.12,.3,.028,.028),R(-1.3,.34,.026,.026),R(-1.4,.43,.024,.024)]},
 coat:(p,n,part)=>{
  if(part.includes('#eye')||part.includes('#glint'))return eyeCoat(n,0xb9b042,part);
  if(part.startsWith('ear'))return n.x<-.2?hex(0x1e1610):hex(0xd3a85e);
  const belly=n.y<-.5||part==='torso'&&p.y<.5||part==='neck'&&n.y<-.2||part.startsWith('leg')&&n.z*Math.sign(p.z)<-.4;
  if(part==='head'||part==='head#jaw'){if(p.x>.85&&n.x>.5&&p.y>.75)return hex(0xa8675a);if(p.y<.775||p.x>.8&&n.y<.2)return hex(0xf2e9d6);return rosette(p,mix(0xd6a457,0xc48d40,n.y),.04,true);}
  if(belly)return rosette(p,hex(0xf1e7d0),.07,true);
  if(part.startsWith('tail')){const t=-p.x;return t>1.2&&Math.sin(t*38)>.2?hex(0x2a1c12):rosette(p,hex(0xd8a65a),.06,true);}
  return rosette(p,mix(0xdcaa5c,0xc58f3e,smooth(.1,.9,n.y)),part.startsWith('leg')?.055:.085,part.startsWith('leg')||part==='neck');
 },
 sub:{torso:1,neck:1,head:1,tail1:1,tail2:1,legFR0:1,legFL0:1,legHR0:1,legHL0:1,legFR1:1,legFL1:1,legHR1:1,legHL1:1},stride:.9,
 camera:{distance:44,min:24,max:110,head:7.5,lift:4,lookAhead:10,lookY:1.2,clearance:3,near:.15,shadow:[10,4.5]},
};

// ---------------------------------------------------------------- spotted hyena: high shoulders, sloping back, heavy head
const hyena:Spec={
 torso:[R(-.58,.58,.08,.09),R(-.5,.58,.14,.15),R(-.36,.58,.15,.16),R(-.15,.59,.16,.18,1,.88),R(.08,.62,.18,.21),R(.28,.64,.19,.22,1,1.05),R(.42,.66,.16,.19),R(.5,.68,.12,.15)],
 neck:[R(.42,.72,.14,.16),R(.58,.78,.12,.14),R(.66,.8,.11,.12)],neckPivot:[.44,.72,0],headPivot:[.66,.8,0],
 head:[R(.62,.82,.1,.1),R(.71,.83,.115,.11),R(.8,.8,.1,.09,1,1.05),R(.88,.75,.075,.065),R(.93,.73,.055,.05)],
 jaw:[R(.76,.71,.065,.035),R(.9,.7,.045,.025)],
 eye:{c:[.8,.86,.072],r:[.016,.014,.01]},
 ear:{pivot:[.67,.9,.08],build:(m,p)=>m.blob(p,[.67,.94,.085],[.025,.05,.045],{jitter:.06})},
 front:{hip:[.36,.66,.12],knee:[.31,.4,.13],ankle:[.35,.1,.125],ground:[.38,.02,.125],radii:[.1,.065,.045,.042],above:{c:[.38,.76,.11],r:.11},foot:{c:[.4,.035,.125],r:[.055,.035,.045]}},
 hind:{hip:[-.44,.6,.11],knee:[-.35,.36,.12],ankle:[-.5,.16,.115],ground:[-.46,.02,.115],radii:[.1,.06,.04,.038],above:{c:[-.45,.68,.1],r:.1},foot:{c:[-.43,.035,.115],r:[.05,.033,.042]}},
 tail:{base:[-.58,.62,0],a:[R(-.58,.62,.03,.03),R(-.66,.5,.03,.03),R(-.72,.4,.028,.028)],mid:[-.72,.4,0],b:[R(-.72,.4,.03,.03),R(-.76,.3,.03,.03)],tuft:{c:[-.77,.27,0],r:[.05,.08,.05]}},
 extras:m=>crest(m,'neck#mane',[[.24,.84],[.4,.86],[.56,.92],[.66,.94]],[.0,.0,.0,0],[.05,.07,.06,.04],.025),
 coat:(p,n,part)=>{
  if(part.includes('#eye')||part.includes('#glint'))return eyeCoat(n,0x4a2c18,part);
  if(part.includes('#mane')||part.includes('#tuft'))return hex(0x2c2119);
  if(part.startsWith('ear'))return n.x<-.2?hex(0x3a2b20):hex(0xa8916c);
  if(part==='head'||part==='head#jaw'){if(p.x>.86)return hex(0x2f251d);return mix(0xb39a72,0x8d7655,smooth(.7,.9,p.x));}
  const {d}=cellDistance(p,.075,9),base=n.y<-.5?hex(0xcdbd9b):mix(0xbca37a,0xa98f66,smooth(.2,.9,n.y));
  if(part.startsWith('tail'))return hex(0x5a4532);
  return d<(part.startsWith('leg')?.24:.27)&&p.y>.12?hex(0x4a3524):base;
 },
 sub:{torso:1,neck:1,legFR0:1,legFL0:1,legHR0:1,legHL0:1,legFR1:1,legFL1:1,legHR1:1,legHL1:1},stride:.95,
 camera:{distance:48,min:26,max:120,head:8.5,lift:4.5,lookAhead:11,lookY:1.4,clearance:3,near:.15,shadow:[10,5]},
};

// ---------------------------------------------------------------- plains zebra
const zebraStripe=(p:THREE.Vector3,part:string)=>{
 let u:number;
 if(part.startsWith('leg'))u=p.y/.065;
 else if(part==='neck'||part.includes('#mane'))u=((p.x-.48)*.6+(p.y-1.2)*.8)/.085;
 else if(part==='head')u=((p.x-.84)*.75+(p.y-1.66)*.66)/.04;
 else{u=p.x/.1;if(p.x<-.38)u+=(p.y-1.05)*(-.38-p.x)*14;}
 return Math.sin(u*Math.PI)>0;
};
const zebra:Spec={
 torso:[R(-.78,1.02,.13,.16),R(-.7,1.02,.25,.3),R(-.5,1,.28,.33),R(-.2,.98,.28,.34,1,1.05),R(.1,1,.29,.35,1,1.05),R(.36,1.05,.26,.32),R(.52,1.12,.2,.27),R(.6,1.18,.15,.2)],
 neck:[R(.48,1.2,.17,.24),R(.66,1.4,.13,.2),R(.8,1.56,.11,.17),R(.88,1.62,.1,.14)],neckPivot:[.5,1.22,0],headPivot:[.88,1.62,0],
 head:[R(.84,1.66,.09,.1),R(.94,1.64,.1,.11),R(1.06,1.55,.085,.09),R(1.18,1.45,.07,.075),R(1.27,1.38,.065,.065),R(1.31,1.35,.055,.05)],
 eye:{c:[.97,1.685,.088],r:[.02,.017,.012]},
 ear:{pivot:[.9,1.72,.06],build:(m,p)=>m.loft(p,[{c:[.9,1.71,.06],rz:.03,ry:.04},{c:[.91,1.8,.075],rz:.035,ry:.045},{c:[.92,1.88,.085],rz:.015,ry:.02}],{n:6,jitter:.05,start:'flat',end:'point'})},
 front:{hip:[.42,1.1,.17],knee:[.38,.72,.16],ankle:[.41,.14,.15],ground:[.43,.05,.15],radii:[.15,.1,.055,.045],above:{c:[.44,1.2,.15],r:.17},foot:{c:[.44,.035,.15],r:[.06,.04,.05]},hoof:true},
 hind:{hip:[-.55,1.05,.16],knee:[-.42,.72,.17],ankle:[-.62,.48,.15],ground:[-.57,.05,.15],radii:[.2,.1,.055,.045],above:{c:[-.58,1.15,.14],r:.2},foot:{c:[-.56,.035,.15],r:[.06,.04,.05]},hoof:true},
 tail:{base:[-.78,1.12,0],a:[R(-.78,1.12,.04,.04),R(-.86,.95,.035,.035),R(-.9,.8,.03,.03)],mid:[-.9,.8,0],b:[R(-.9,.8,.026,.026),R(-.92,.64,.024,.024)],tuft:{c:[-.93,.55,0],r:[.05,.11,.05]}},
 extras:m=>crest(m,'neck#mane',[[.46,1.38],[.6,1.5],[.74,1.66],[.86,1.78],[.92,1.8]],[.0,0,0,0,0],[.06,.1,.1,.09,.06],.03,.08),
 coat:(p,n,part)=>{
  if(part.includes('#eye')||part.includes('#glint'))return eyeCoat(n,0x2a1a10,part);
  if(part.includes('#hoof')||part.includes('#tuft'))return hex(0x1a1716);
  if(part.startsWith('ear'))return n.x>.3&&Math.abs(n.z)<.6?hex(0xe8e2d4):zebraStripe(p,'leg')?hex(0x1c1a1a):hex(0xf0ebde);
  if(part==='head'&&p.x>1.2)return hex(0x1f1b1a);
  if(part==='torso'&&n.y<-.6&&Math.abs(p.z)<.06)return hex(0x1c1a1a);
  if(part==='torso'&&n.y<-.7)return hex(0xf0ebde);
  return zebraStripe(p,part)?hex(0x1c1a1a):hex(0xf1ece0);
 },
 sub:{torso:2,neck:2,head:2,'neck#mane':1,legFR0:2,legFL0:2,legHR0:2,legHL0:2,legFR1:2,legFL1:2,legHR1:2,legHL1:2,legFR2:1,legFL2:1,legHR2:1,legHL2:1},stride:1.5,
 camera:{distance:68,min:36,max:160,head:15,lift:6.5,lookAhead:15,lookY:2,clearance:4,near:.2,shadow:[15,6.5]},
};

// ---------------------------------------------------------------- impala (ram)
const impala:Spec={
 torso:[R(-.55,.84,.08,.1),R(-.48,.84,.13,.16),R(-.34,.83,.15,.18),R(-.12,.82,.15,.18,1,.9),R(.1,.84,.155,.2),R(.28,.87,.14,.19),R(.38,.9,.11,.15)],
 neck:[R(.3,.92,.09,.12),R(.42,1.06,.07,.08),R(.5,1.18,.06,.065),R(.53,1.22,.055,.06)],neckPivot:[.32,.94,0],headPivot:[.53,1.22,0],
 head:[R(.5,1.25,.055,.065),R(.58,1.26,.065,.07),R(.66,1.21,.05,.055),R(.74,1.15,.04,.04),R(.78,1.13,.032,.03)],
 eye:{c:[.605,1.285,.058],r:[.02,.018,.012]},
 ear:{pivot:[.55,1.3,.045],build:(m,p)=>m.loft(p,[{c:[.55,1.3,.045],rz:.02,ry:.03},{c:[.555,1.36,.08],rz:.03,ry:.045},{c:[.56,1.42,.095],rz:.012,ry:.025}],{n:6,jitter:.05,start:'flat',end:'point'})},
 front:{hip:[.26,.86,.09],knee:[.25,.56,.09],ankle:[.27,.27,.085],ground:[.29,.04,.085],radii:[.075,.045,.025,.022],above:{c:[.28,.94,.08],r:.085},foot:{c:[.3,.025,.085],r:[.03,.025,.022]},hoof:true},
 hind:{hip:[-.38,.84,.09],knee:[-.28,.55,.09],ankle:[-.44,.33,.085],ground:[-.4,.04,.085],radii:[.095,.05,.028,.022],above:{c:[-.39,.92,.08],r:.095},foot:{c:[-.38,.025,.085],r:[.03,.025,.022]},hoof:true},
 tail:{base:[-.55,.88,0],a:[R(-.55,.88,.03,.025),R(-.6,.78,.028,.025),R(-.62,.7,.025,.022)],mid:[-.62,.7,0],b:[R(-.62,.7,.022,.02),R(-.63,.62,.015,.015)]},
 extras:m=>{
  // lyre-shaped ridged horns
  m.spike('head#horn',[[.56,1.32,.03],[.535,1.42,.05],[.47,1.52,.085],[.475,1.62,.075],[.53,1.69,.045],[.56,1.71,.03]],[.022,.02,.017,.013,.008,.002],{n:5,sub:1});
  m.mirror('head#horn','head#hornL');
 },
 coat:(p,n,part)=>{
  if(part.includes('#eye')||part.includes('#glint'))return eyeCoat(n,0x2a160c,part);
  if(part.includes('#horn'))return Math.sin(p.y*120)>.3?hex(0x3a2a1c):hex(0x5a4532);
  if(part.includes('#hoof'))return hex(0x1d1612);
  if(part.startsWith('ear'))return n.x>.3&&Math.abs(n.z)<.6?hex(0xefe2cc):hex(0xb07040);
  if(part==='head'){if(p.x>.76&&n.x>.4)return hex(0x2a1d16);if(p.y<1.165||Math.hypot(p.x-.605,p.y-1.285)<.032&&Math.abs(p.z)>.03)return hex(0xf4ece0);return mix(0xb06a35,0x8f5228,smooth(.6,1,n.y));}
  if(part.startsWith('tail'))return n.y>.2?hex(0x1e1712):hex(0xf4ece0);
  if(part==='torso'&&p.x<-.4&&Math.abs(Math.abs(p.z)-.085)<.018&&p.y>.66)return hex(0x1e1712);
  if(part.startsWith('legH')&&part.endsWith('2')&&n.x<-.4&&p.y>.2)return hex(0x1e1712);
  if(n.y<-.45||part==='torso'&&p.y<.71||part==='neck'&&n.y<-.3&&p.y<1.05)return hex(0xf3ece0);
  if(part==='torso'&&p.y<.8)return hex(0xd09557);
  if(part.startsWith('leg'))return mix(0xc68c55,0xa8622f,p.y*1.2);
  return mix(0xae6732,0x95552a,smooth(.3,.95,n.y));
 },
 sub:{torso:1,head:1},stride:1.1,
 camera:{distance:50,min:28,max:120,head:10,lift:5,lookAhead:12,lookY:1.6,clearance:3,near:.15,shadow:[10,4]},
};

// ---------------------------------------------------------------- warthog
const warthog:Spec={
 torso:[R(-.55,.45,.1,.11),R(-.47,.45,.17,.19),R(-.3,.45,.2,.21),R(-.05,.46,.21,.23),R(.2,.48,.21,.23),R(.36,.5,.18,.21),R(.44,.52,.14,.17)],
 neck:[R(.38,.52,.15,.18),R(.52,.52,.14,.16)],neckPivot:[.4,.52,0],headPivot:[.5,.52,0],
 head:[R(.47,.56,.13,.13),R(.57,.55,.15,.12,1.1,1),R(.68,.5,.12,.1),R(.78,.44,.09,.08),R(.86,.39,.075,.075),R(.9,.37,.07,.07)],
 eye:{c:[.655,.6,.115],r:[.014,.012,.009]},
 ear:{pivot:[.52,.64,.1],build:(m,p)=>m.loft(p,[{c:[.52,.64,.1],rz:.02,ry:.035},{c:[.51,.7,.13],rz:.015,ry:.03},{c:[.5,.74,.15],rz:.006,ry:.012}],{n:5,jitter:.05,start:'flat',end:'point'})},
 front:{hip:[.32,.48,.13],knee:[.3,.28,.13],ankle:[.32,.1,.125],ground:[.33,.04,.125],radii:[.09,.06,.035,.033],above:{c:[.33,.58,.12],r:.1},foot:{c:[.345,.025,.125],r:[.035,.025,.03]},hoof:true},
 hind:{hip:[-.42,.46,.12],knee:[-.34,.28,.13],ankle:[-.45,.14,.12],ground:[-.42,.04,.12],radii:[.1,.055,.032,.03],above:{c:[-.43,.56,.11],r:.1},foot:{c:[-.41,.025,.12],r:[.035,.025,.03]},hoof:true},
 tail:{base:[-.55,.52,0],a:[R(-.55,.52,.016,.016),R(-.62,.42,.015,.015),R(-.65,.32,.014,.014)],mid:[-.65,.32,0],b:[R(-.65,.32,.013,.013),R(-.66,.24,.012,.012)],tuft:{c:[-.665,.2,0],r:[.02,.05,.02]}},
 extras:m=>{
  m.blob('head#wart',[.66,.52,.145],[.035,.025,.035]).blob('head#wart',[.77,.46,.105],[.025,.022,.03]);
  m.spike('head#tusk',[[.83,.37,.07],[.88,.39,.11],[.9,.45,.13],[.88,.5,.12]],[.018,.016,.012,.003]);
  m.mirror('head#wart','head#wartL').mirror('head#tusk','head#tuskL');
  crest(m,'torso#mane',[[.44,.66],[.3,.7],[.1,.69],[-.12,.68],[-.3,.66]],[0,0,0,0,0],[.08,.12,.1,.07,.03],.02,.25);
  crest(m,'head#mane',[[.62,.64],[.5,.68]],[0,0],[.06,.09],.02,.25);
 },
 coat:(p,n,part)=>{
  if(part.includes('#eye')||part.includes('#glint'))return eyeCoat(n,0x3a2418,part);
  if(part.includes('#tusk'))return mix(0xf1e6cd,0xd9c9a4,p.y*2);
  if(part.includes('#mane')||part.includes('#tuft'))return mix(0x3a2b22,0x5a4636,n.y);
  if(part.includes('#hoof'))return hex(0x2a2220);
  if(part.includes('#wart'))return hex(0x6e615a);
  if(part==='head'){if(p.x>.88&&n.x>.5)return hex(0x4e3a36);if(p.x>.66&&p.x<.82&&p.y<.47&&Math.abs(n.z)>.4)return hex(0xd9d0c2);return mix(0x7d6e66,0x6a5c54,n.y);}
  if(part.startsWith('ear'))return hex(0x5b4d46);
  if(n.y<-.5)return hex(0x8f8076);
  return mix(0x7a6b62,0x655850,smooth(.2,.9,n.y));
 },
 sub:{},stride:.75,
 camera:{distance:42,min:22,max:100,head:6.5,lift:4,lookAhead:9,lookY:1,clearance:2.5,near:.12,shadow:[9,5]},
};

const SPECS:Record<Species,Spec>={lion,leopard,hyena,zebra,impala,warthog};

// ---------------------------------------------------------------- natural coat colours
// The unlockable coats (lib/rewards.ts COATS, same order, with their sources): each repaints the usual coat facet by
// facet, so the anatomy and markings stay the same animal's. Eyes, hooves, horns and tusks keep their colour.
type Paint=(c:THREE.Color,p:THREE.Vector3,n:THREE.Vector3,part:string)=>THREE.Color;
const lum=(c:THREE.Color)=>c.r*.3+c.g*.59+c.b*.11;
/** the facet's brightness relative to a reference colour of the usual coat, carried over onto a new colour */
const retint=(c:THREE.Color,usual:number,to:number,lo=.45,hi=1.15)=>hex(to).multiplyScalar(Math.max(lo,Math.min(hi,lum(c)/lum(hex(usual)))));
const dark=(c:THREE.Color)=>lum(c)<.06;
const furred=(part:string)=>!/#(eye|glint|hoof|horn|tusk)/.test(part);
const PAINT:Record<Species,Paint[]>={
 lion:[
  // dark-maned: the mane and tail tuft deepen towards black-brown
  (c,p,n,part)=>part.includes('#mane')?c.clone().multiplyScalar(.42).lerp(hex(0x1c120c),.25):part.includes('#tuft')?hex(0x1a110b):c,
  // white lion: cream all over, pink nose, the eyes keep their colour
  (c,p,n,part)=>!furred(part)?c:part==='head'&&p.x>1.17&&n.x>.55&&p.y>1.09?hex(0xc79a8c):retint(c,0xc8914a,0xf1e6cc,.72,1.06),
 ],
 leopard:[
  // strawberry (erythristic): rosettes red-brown instead of black, the gold paler and pinker
  (c,p,n,part)=>!furred(part)?c:dark(c)?hex(0x8a4a2e):c.clone().lerp(hex(0xe9b48e),.45),
  // black (melanistic): dark all over, the rosettes still faintly darker
  (c,p,n,part)=>!furred(part)?c:c.clone().multiplyScalar(dark(c)?.5:.11),
 ],
 hyena:[
  // elder: the spots fade to brown, the coat a little greyer
  (c,p,n,part)=>!furred(part)?c:/^(torso|neck|leg)/.test(part)&&!part.includes('#')&&dark(c)?hex(0x8c7658):c.clone().lerp(hex(0xa69c88),.25),
  // pale: a cream ground colour, the spots unchanged
  (c,p,n,part)=>!furred(part)||dark(c)?c:c.clone().lerp(hex(0xe6dabf),.5),
 ],
 zebra:[
  // southern: thinner, browner stripes that fade out down the legs
  (c,p,n,part)=>!furred(part)||!dark(c)?c:part.startsWith('leg')&&p.y<.62?hex(0xd8cebd):hex(0x40302a),
  // polka-dot (pseudomelanism): a dark coat with white dots where stripes would be
  (c,p,n,part)=>{if(!furred(part)||part.includes('#tuft'))return c;if(part==='head'&&p.x>1.2)return c;return cellDistance(p,.06,7).d<.3&&n.y>-.6?hex(0xefe9dc):hex(0x221d1b);},
 ],
 impala:[
  // black-faced: a dark blaze from the forehead down the nose
  (c,p,n,part)=>part==='head'&&p.x>.56&&n.y>-.1&&Math.abs(p.z)<.05?hex(0x1e1712):c,
 ],
 warthog:[
  // wallowed in red earth, then in pale clay
  (c,p,n,part)=>!furred(part)||/#(mane|tuft)/.test(part)?c:retint(c,0x7a6b62,0x8e4c32),
  (c,p,n,part)=>!furred(part)||/#(mane|tuft)/.test(part)?c:retint(c,0x7a6b62,0xb9a47c),
 ],
};
export const coatCount=(s:Species)=>PAINT[s].length;
export const cameraProfile=(s:Species):CameraProfile=>SPECS[s].camera;

// ---------------------------------------------------------------- assembly
type Joint={name:string;parent:string|null;pivot:V};
type Built={geometries:Map<string,THREE.BufferGeometry>;joints:Joint[];partJoint:Map<string,string>};
const BUILT=new Map<string,Built>();
const LEGS=[['FR',true,1],['FL',true,-1],['HR',false,1],['HL',false,-1]] as const;
function build(species:Species,lod=0,coat=0):Built{
 const key=species+lod+':'+coat,cached=BUILT.get(key);if(cached)return cached;
 const s=SPECS[species],m=new Model(species.length*131,lod),sub=(p:string)=>s.sub[p]??0,torsoCentre:V=[(s.torso[0].c[0]+s.torso.at(-1)!.c[0])/2,s.torso[3].c[1],0];
 m.loft('torso',s.torso,{n:8,jitter:.07,start:'point',end:'flat',sub:sub('torso')});
 m.loft('neck',s.neck,{n:8,jitter:.06,start:'flat',end:'flat',sub:sub('neck')});
 m.loft('head',s.head,{n:8,jitter:.06,start:'point',end:'flat',sub:sub('head')});
 if(s.jaw)m.loft('head#jaw',s.jaw,{n:6,jitter:.05,start:'point',end:'point'});
 m.blob('head#eye',s.eye.c,s.eye.r,{jitter:0,rot:[0,-.35,0]}).blob('head#glint',[s.eye.c[0]+s.eye.r[0]*.55,s.eye.c[1]+s.eye.r[1]*.5,s.eye.c[2]+s.eye.r[2]*.6],[s.eye.r[0]*.28,s.eye.r[0]*.28,s.eye.r[0]*.2],{jitter:0});
 m.mirror('head#eye','head#eyeL').mirror('head#glint','head#glintL');
 s.ear.build(m,'earR');m.mirror('earR','earL');
 m.loft('tail1',s.tail.a,{n:6,jitter:.05,start:'flat',end:'flat',sub:sub('tail1')});
 m.loft('tail2',s.tail.b,{n:6,jitter:.05,start:'flat',end:'point',sub:sub('tail2')});
 if(s.tail.tuft)m.blob('tail2#tuft',s.tail.tuft.c,s.tail.tuft.r,{jitter:.2});
 s.extras?.(m);
 const joints:Joint[]=[{name:'body',parent:null,pivot:torsoCentre},{name:'neck',parent:'body',pivot:s.neckPivot},{name:'head',parent:'neck',pivot:s.headPivot},
  {name:'earR',parent:'head',pivot:s.ear.pivot},{name:'earL',parent:'head',pivot:[s.ear.pivot[0],s.ear.pivot[1],-s.ear.pivot[2]]},
  {name:'tail1',parent:'body',pivot:s.tail.base},{name:'tail2',parent:'tail1',pivot:s.tail.mid}];
 for(const [id,front,side] of LEGS){
  const L=front?s.front:s.hind,z=(v:V):V=>[v[0],v[1],v[2]*side],name='leg'+id,r=L.radii;
  if(side>0){
   m.loft(name+'0',[{c:L.above.c,rz:L.above.r*.8,ry:L.above.r},{c:L.hip,rz:r[0]*.85,ry:r[0]*1.05},{c:L.knee,rz:r[1]*.8,ry:r[1]}],{n:7,jitter:.06,start:'point',end:'point',capLength:r[1]*.6,sub:sub(name+'0')});
   m.loft(name+'1',[{c:L.knee,rz:r[1]*.75,ry:r[1]*.95},{c:[(L.knee[0]+L.ankle[0])/2,(L.knee[1]+L.ankle[1])/2,L.knee[2]],rz:r[2]*1.1,ry:r[2]*1.25},{c:L.ankle,rz:r[2],ry:r[2]}],{n:6,jitter:.05,start:'point',end:'point',capLength:r[2]*.5,sub:sub(name+'1')});
   m.loft(name+'2',[{c:L.ankle,rz:r[2]*.95,ry:r[2]},{c:L.ground,rz:r[3],ry:r[3]}],{n:6,jitter:.04,start:'point',end:'flat',sub:sub(name+'2')});
   m.blob(name+'2'+(L.hoof?'#hoof':''),L.foot.c,L.foot.r,{jitter:.1});
  }else for(const k of ['0','1','2'])m.mirror('leg'+id.replace('L','R')+k,name+k);
  joints.push({name:name+'0',parent:'body',pivot:z(L.hip)},{name:name+'1',parent:name+'0',pivot:z(L.knee)},{name:name+'2',parent:name+'1',pivot:z(L.ankle)});
 }
 const pivots:Record<string,V>={torso:torsoCentre};for(const j of joints)pivots[j.name]=j.pivot;
 const paint=PAINT[species][coat-1],geometries=m.build(paint?(p,n,part,r)=>paint(s.coat(p,n,part,r),p,n,part):s.coat,pivots),partJoint=new Map<string,string>();
 for(const part of geometries.keys())partJoint.set(part,part==='torso'?'body':part);
 const out={geometries,joints,partJoint};BUILT.set(key,out);return out;
}

export type SafariRig={root:THREE.Group;model:THREE.Group;j:Record<string,THREE.Group>;meshes:THREE.Mesh[];species:Species;coat:number;phase:number;turn:number;born:number;altitude:number;seed:number;blink:number;
 /** climbing: 0..1 weight of the tree pose, the limb-cycle phase, and the smoothed body pose the renderer keeps */
 climbWeight:number;climbPhase:number;pitch:number;climb?:{x:number;y:number;h:number;yaw:number;pitch:number;speed:number;still:number;on:'trunk'|'limb'|'air'}};
let sharedMaterial:THREE.MeshStandardMaterial|null=null;
export const animalMaterial=()=>sharedMaterial||=facetMaterial();
export function makeSafariAnimal(species:Species,coat=0):SafariRig{
 const b=build(species,0,coat),root=new THREE.Group(),model=new THREE.Group(),j:Record<string,THREE.Group>={},meshes:THREE.Mesh[]=[];
 model.scale.setScalar(10);root.add(model);
 for(const joint of b.joints){const g=new THREE.Group();g.name=joint.name;const parent=joint.parent?b.joints.find(x=>x.name===joint.parent)!.pivot:[0,0,0];g.position.set(joint.pivot[0]-parent[0],joint.pivot[1]-parent[1],joint.pivot[2]-parent[2]);g.userData.rest=g.position.clone();(joint.parent?j[joint.parent]:model).add(g);j[joint.name]=g;}
 const far=build(species,1,coat);
 for(const [part,geometry] of b.geometries){const mesh=new THREE.Mesh(geometry,animalMaterial());mesh.userData.far=far.geometries.get(part);mesh.castShadow=true;mesh.receiveShadow=true;j[b.partJoint.get(part)!].add(mesh);meshes.push(mesh);}
 // remember each leg's rest geometry for the foot-placement solver: the foot segment from ankle to the ground point
 for(const [id,front,side] of LEGS){const L=front?SPECS[species].front:SPECS[species].hind;j['leg'+id+'2'].userData.toe=new THREE.Vector3(L.ground[0]-L.ankle[0],L.ground[1]-L.ankle[1],(L.ground[2]-L.ankle[2])*side);j['leg'+id+'0'].userData.side=side;}
 return{root,model,j,meshes,species,coat,phase:Math.random(),turn:0,born:0,altitude:0,seed:Math.random()*100,blink:0,climbWeight:0,climbPhase:0,pitch:0};
}

/** mood cues: alert = head high, ears forward, watching a threat; grazing = head down at the grass; crouch = a stalking
 *  hunter low to the ground; resting = lying up in the shade */
export type SafariPose={feeding?:boolean;speed:number;time:number;dt:number;ability:number;action:boolean;perched:boolean;altitude:number;stunned:boolean;alert?:boolean;grazing?:boolean;crouch?:boolean;resting?:boolean;
 /** in a tree: what the body is on, how fast it moves over the bark (game units/s), lying up, pivoting, head first, pitch */
 climb?:{on:'trunk'|'limb'|'air';speed:number;rest:boolean;turning:boolean;down:boolean;pitch:number}};
const damp=(a:number,b:number,k:number,dt:number)=>a+(b-a)*(1-Math.exp(-k*dt));
/** Pose the joint hierarchy for this frame. speed is in game units per second; ability is the 0..1 progress of an active ability, or -1. */
export function animateSafari(r:SafariRig,p:SafariPose){
 const s=SPECS[r.species],a=ANIMALS[r.species],g=a.gait,v=p.speed/10,dt=p.dt,j=r.j,moving=smooth(.15,.8,v);
 // gait by the species' own transition speeds: walk, trot (not for big cats), then canter/gallop
 const gallop=smooth(g.gallop-1,g.gallop+1,v),trot=g.trot===Infinity?0:smooth(g.trot-.4,g.trot+.4,v)*(1-gallop),walk=1-trot-gallop;
 // longer strides as the gait opens up; a full gallop settles at about 2.6 strides a second, as real quadrupeds do
 const strideLen=Math.max(s.stride*(1+trot*.5+gallop*.9),v/2.6);r.phase=(r.phase+dt*v/strideLen)%1;const phi=r.phase*Math.PI*2;
 const amp=Math.min(1,v/1.4)*(.3+.1*trot+.26*gallop),ab=p.ability,active=ab>=0;
 const stalk=r.species==='leopard'&&active||!!p.crouch&&!!a.prey.length,kick=r.species==='zebra'&&active?Math.sin(Math.min(1,ab)*Math.PI):0,leap=r.species==='impala'&&active?Math.sin(Math.min(1,ab)*Math.PI):0,burrow=r.species==='warthog'&&active;
 const graze=!!p.feeding||(p.action||!!p.grazing)&&v<1&&!a.prey.length&&!p.alert,lunge=!p.feeding&&p.action&&!!a.prey.length,resting=!!p.resting&&v<.5,alert=!!p.alert&&v<1;
 // legs: walk is a lateral sequence, faster gaits swing the front and hind pairs together
 const walkOff={FR:.75,FL:.25,HR:.5,HL:0},trotOff={FR:.5,FL:0,HR:0,HL:.5},runOff={FR:.6,FL:.5,HR:.1,HL:0};
 for(const [id,front] of LEGS){
  const off=walkOff[id]*walk+trotOff[id]*trot+runOff[id]*gallop,t=phi+off*Math.PI*2,swing=Math.sin(t),lift=Math.max(0,Math.cos(t))*amp*1.5;
  let a0=amp*swing,a1=front?lift*.45:-lift*.55,a2=front?-lift*1.3:lift*.9;
  if(stalk){a0+=front?.25:-.3;a1+=front?.55:-.75;a2+=front?-.6:.7;}
  const cl=p.climb;
  if(p.perched&&!cl){a0=front?1.25:-1.2;a1=front?-.2:-.6;a2=front?-1.1:1.3;}
  // jumping down: forelegs reach for the ground, hind legs trail, as a cat drops off a bough
  if(cl?.on==='air'){a0=front?.75:-.55;a1=front?-.15:-.35;a2=front?-.35:.5;}
  // lying up on a bough: all four legs hang either side of the wood
  if(cl?.rest){a0=front?-.15:.2;a1=front?.15:-.2;a2=front?.1:-.1;}
  if(kick&&!front){a0=-1.15*kick;a1=.35*kick;a2=.4*kick;}
  if(leap){a0=front?.9*leap:-.95*leap;a1=front?0:-.2*leap;a2=front?-1.3*leap:.3*leap;}
  if(burrow||resting){a0=front?.6:-.7;a1=front?-.4:-.6;a2=front?-.4:.9;}
  if(graze&&r.species==='warthog'&&front){a0=-.15;a1=1.5;a2=-1.6;}
  j['leg'+id+'0'].rotation.x=damp(j['leg'+id+'0'].rotation.x,cl?.rest?-(j['leg'+id+'0'].userData.side as number)*.22:0,10,dt);
  j['leg'+id+'0'].rotation.z=damp(j['leg'+id+'0'].rotation.z,a0,24,dt);j['leg'+id+'1'].rotation.z=damp(j['leg'+id+'1'].rotation.z,a1,24,dt);j['leg'+id+'2'].rotation.z=damp(j['leg'+id+'2'].rotation.z,a2,24,dt);
 }
 const body=j.body,rest=body.userData.rest as THREE.Vector3,size=a.size;
 const bob=Math.abs(Math.sin(phi*2))*(.012+.025*trot+.05*gallop)*moving*size,breathe=Math.sin(p.time*2.1+r.seed)*.004*size;
 const cl=p.climb,belly=Math.min(...s.torso.map(t=>t.c[1]-t.ry*(t.bot??1)));
 let lower=0;if(stalk)lower=.16*size;if(p.perched&&!cl)lower=.22*size;
 // in a tree the body hugs the bark: close to the trunk while climbing, crouched low on a bough (lower still while
 // pivoting), and lying on it with the belly on the wood when resting
 if(cl)lower=cl.rest?belly-.02:cl.on==='trunk'?belly*.85:cl.on==='limb'?belly*(cl.turning?.42:.3):0;if(burrow)lower=.55*size;if(resting)lower=.42*size;if(graze&&r.species==='warthog')lower=.12*size;
 body.position.y=damp(body.position.y,rest.y+bob+breathe-lower+leap*3,leap?30:14,dt);
 const climbFlex=cl&&cl.on==='trunk'?Math.sin(r.climbPhase*Math.PI*2)*.08*smooth(1,6,cl.speed):0;
 body.rotation.z=damp(body.rotation.z,Math.sin(phi)*.07*gallop-kick*.28+(lunge?.12:0)+(graze&&r.species==='warthog'?-.18:0)+leap*.12+climbFlex,14,dt);
 body.rotation.x=damp(body.rotation.x,Math.sin(phi)*.025*moving*(1-gallop),10,dt);
 // neck and head: grazing drops the head to the grass, idle animals look around, runners stretch forward
 const look=Math.sin(p.time*.37+r.seed)*.5+Math.sin(p.time*.13+r.seed*2)*.3;
 const neckZ=alert?.3:resting?-.1:graze?(r.species==='zebra'?-1.05:r.species==='impala'?-1.15:-.35):stalk?-.35:p.perched?-.25:-.22*gallop+Math.sin(phi*2)*.04*moving*(1-gallop);
 // in a tree the head keeps itself nearly level against the body's pitch: looking up the trunk, down at the footing
 // on a bough, resting low along it when lying up
 const treeNeck=!cl?neckZ:cl.on==='air'?.1:cl.rest?-.3-cl.pitch*.4:cl.on==='trunk'?(cl.down?.45:.3):-.12-cl.pitch*.45;
 j.neck.rotation.z=damp(j.neck.rotation.z,treeNeck,6,dt);
 j.head.rotation.z=damp(j.head.rotation.z,graze?-.35:gallop*.12+(p.stunned?Math.sin(p.time*9)*.12:0),6,dt);
 j.head.rotation.y=damp(j.head.rotation.y,(1-moving)*(graze||alert?0:look*.45)+(p.stunned?Math.sin(p.time*7)*.3:0),3,dt);
 j.neck.rotation.y=damp(j.neck.rotation.y,(1-moving)*(graze||alert?0:look*.25),3,dt);
 // ears flick now and then; tails swish (a running warthog carries its tail straight up)
 const flick=Math.max(0,Math.sin(p.time*1.3+r.seed*5)-.92)*8;
 j.earR.rotation.x=damp(j.earR.rotation.x,alert?-.25:flick*.5,20,dt);if(alert)j.earL.rotation.x=damp(j.earL.rotation.x,.25,20,dt);else j.earL.rotation.x=damp(j.earL.rotation.x,-Math.max(0,Math.sin(p.time*1.1+r.seed*3)-.93)*4,20,dt);
 const tailUp=r.species==='warthog'?smooth(.5,2.5,v)*1.9:r.species==='lion'||r.species==='leopard'?gallop*.9:gallop*.5;
 // a climbing cat's tail hangs as a counterweight and swings against its balance; resting, it hangs straight down
 const treeTail=!cl?tailUp+(p.perched?-.9:0):cl.rest?1.3+cl.pitch:cl.on==='trunk'?.5:cl.on==='air'?.4:.9+cl.pitch*.6;
 j.tail1.rotation.z=damp(j.tail1.rotation.z,treeTail,8,dt);j.tail1.rotation.y=Math.sin(p.time*(cl?1.1:1.6)+r.seed)*(cl?.35:.28)*(1-gallop);
 j.tail2.rotation.z=damp(j.tail2.rotation.z,(r.species==='leopard'?.25:0)+(r.species==='warthog'?tailUp*.3:0),8,dt);j.tail2.rotation.y=Math.sin(p.time*1.6+r.seed-.8)*.35*(1-gallop);
 r.model.position.y=0;
}

// ---------------------------------------------------------------- paws on bark
// Foot placement for climbing: each paw gets a target on the real surface under it (the trunk, a bough, or the ground)
// and the leg is solved to reach it: the hip swings the leg sideways (adduction) to bring the paw under the body on
// narrow wood, a two-bone solve bends shoulder/hip and elbow/knee, and the foot segment keeps its standing angle so the
// paw lies flat. Paws step in the species' climbing gait: a bound up the trunk (forepaws reach and pull, hind feet push
// together), a careful walk along a bough; a planted paw stays put on the bark while the body moves over it.
const tmpV=new THREE.Vector3(),tmpW=new THREE.Vector3();
const BOUND={FR:0,FL:.08,HR:.5,HL:.58},WALK={FR:.75,FL:.25,HR:.5,HL:0};
export type Bark={segments:Segment[];base:number;ground:(x:number,z:number)=>number};
export function plantFeet(r:SafariRig,p:{dt:number;on:'trunk'|'limb';speed:number;weight:number;turning?:boolean},bark:Bark){
 const s=SPECS[r.species],j=r.j,v=p.speed/10,stride=s.stride*(p.on==='trunk'?.55:.6),duty=p.on==='trunk'?.55:.68;
 r.climbPhase=(r.climbPhase+p.dt*v/stride)%1;
 const lift=smooth(.05,.25,v),offsets=p.on==='trunk'?BOUND:WALK;
 r.root.updateMatrixWorld(true);
 let worst=0;
 for(const [id,front,side] of LEGS){
  const L=front?s.front:s.hind,leg0=j['leg'+id+'0'],leg1=j['leg'+id+'1'],leg2=j['leg'+id+'2'];
  // the paw's place in its step cycle: in stance it slides back under the body exactly as fast as the body moves forward
  // (so it stays planted on the bark), in swing it lifts clear and reaches forward
  const f=(r.climbPhase+offsets[id as keyof typeof BOUND])%1,swing=f>=duty,u=swing?(f-duty)/(1-duty):f/duty;
  const dx=(swing?-.5+u:.5-u)*duty*stride,up=swing?Math.sin(u*Math.PI)*.07*s.stride*lift:0;
  // nominal paw: under the hip, pulled in toward the midline on narrow wood; pivoting on a bough, all four paws bunch
  // together under the body so they stay on the wood while it turns
  const narrow=p.on==='limb'?.35:.8,bunch=p.turning?.45:1,nominal=new THREE.Vector3((L.ground[0]+dx)*bunch,0,L.ground[2]*side*narrow);
  r.model.localToWorld(tmpV.copy(nominal));
  // the real surface nearest that point: bark (trunk or bough) or the ground
  let best={x:tmpV.x,y:bark.ground(tmpV.x,tmpV.z),z:tmpV.z,nx:0,ny:1,nz:0,d:Math.abs(tmpV.y-bark.ground(tmpV.x,tmpV.z))};
  for(const seg of bark.segments){const b=nearestBark(seg,{x:tmpV.x,y:tmpV.z,h:tmpV.y-bark.base});if(Math.abs(b.d)<best.d)best={x:b.x,y:b.h+bark.base,z:b.y,nx:b.nx,ny:b.nh,nz:b.ny,d:Math.abs(b.d)};}
  // the ground point sits a few centimetres up the paw; lift it off the bark along the surface normal while swinging
  const lift10=(.025+up)*10;tmpW.set(best.x+best.nx*lift10,best.y+best.ny*lift10,best.z+best.nz*lift10);
  j.body.worldToLocal(tmpW);
  // solve in the hip's frame
  const hip=leg0.position,knee=leg1.position,ankle=leg2.position,toe=leg2.userData.toe as THREE.Vector3;
  const tx=tmpW.x-hip.x,ty=tmpW.y-hip.y,tz=tmpW.z-hip.z-(knee.z+ankle.z+toe.z);
  const adduct=THREE.MathUtils.clamp(Math.atan2(-tz,-ty),-.6,.6),py=ty*Math.cos(adduct)+tz*Math.sin(adduct),px=tx;
  const a1r=Math.atan2(knee.y,knee.x),a2r=Math.atan2(ankle.y,ankle.x),a3r=Math.atan2(toe.y,toe.x);
  const l1=Math.hypot(knee.x,knee.y),l2=Math.hypot(ankle.x,ankle.y),l3=Math.hypot(toe.x,toe.y);
  const ax=px-Math.cos(a3r)*l3,ay=py-Math.sin(a3r)*l3,reach=Math.hypot(ax,ay),D=THREE.MathUtils.clamp(reach,Math.abs(l1-l2)+.01,(l1+l2)*.995);
  worst=Math.max(worst,reach-D);
  const restA=Math.atan2(knee.y+ankle.y,knee.x+ankle.x),bend=Math.sign(Math.atan2(Math.sin(a1r-restA),Math.cos(a1r-restA)))||1;
  const beta=Math.acos(THREE.MathUtils.clamp((l1*l1+D*D-l2*l2)/(2*l1*D),-1,1)),a1=Math.atan2(ay,ax)+bend*beta;
  const kx=Math.cos(a1)*l1,ky=Math.sin(a1)*l1,a2=Math.atan2(ay*D/Math.max(reach,1e-4)-ky,ax*D/Math.max(reach,1e-4)-kx);
  const w=p.weight,mixTo=(o:THREE.Object3D,key:'x'|'z',val:number)=>{o.rotation[key]+=(val-o.rotation[key])*w;};
  mixTo(leg0,'x',adduct);mixTo(leg0,'z',a1-a1r);mixTo(leg1,'z',(a2-a1)-(a2r-a1r));mixTo(leg2,'z',(a3r-a2)-(a3r-a2r));
 }
 return worst;
}

/** A head-and-shoulders portrait, rendered once per species for the menus and HUD. */
let portraitRenderer:THREE.WebGLRenderer|SoftwareRenderer|undefined;const portraitCache=new Map<string,string>();
export function animalPortrait(species:Species,coat=0){const key=species+coat;if(portraitCache.has(key))return portraitCache.get(key)!;
 try{if(!portraitRenderer){portraitRenderer=createRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});portraitRenderer.setSize(192,160);portraitRenderer.setPixelRatio(1);portraitRenderer.outputColorSpace=THREE.SRGBColorSpace;}
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xcfe0f5,0x6b5230,1.6));const sun=new THREE.DirectionalLight(0xffe2b0,3.2);sun.position.set(60,90,70);scene.add(sun);
  const rig=makeSafariAnimal(species,coat);scene.add(rig.root);rig.j.head.rotation.y=.25;
  const h=SPECS[species].headPivot,size=ANIMALS[species].size*10,camera=new THREE.PerspectiveCamera(30,192/160,.1,500);
  camera.position.set(h[0]*10+size*1.25,h[1]*10+size*.18,size*1.05);camera.lookAt(h[0]*10-size*.1,h[1]*10-size*.12,0);
  scene.updateMatrixWorld(true);portraitRenderer.render(scene,camera);const url=portraitRenderer.domElement.toDataURL('image/png');portraitCache.set(key,url);return url;}catch{return '';}}
