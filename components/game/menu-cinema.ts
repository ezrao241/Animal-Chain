// The home screen's live backdrop: a small cast of wildlife living around the first watering hole (each species in its
// real haunt: herds on the banks, the lion in the thicket shade, the leopard under its acacia, hyenas by the kopje,
// warthogs at the burrow) and a cinematic camera that tours them one species at a time, or holds on the one the menu
// asks for. Nothing here touches the rules; the cast are plain Player records posed with the normal rigs.
import * as THREE from 'three';
import {ANIMALS,SPECIES,Species,Player,newPlayer,props,solidNear,solidRadius} from '@/lib/game';
import {cameraProfile} from './safari-animals';

type Actor={p:Player;ax:number;ay:number;radius:number;speed:number;phase:number;duty:number;still:Player['mood'];moving:Player['mood']};
// [species, anchor x, anchor y, loop radius, walking share of each 12 s cycle, mood while still, mood while walking]
const CAST:[Species,number,number,number,number,Player['mood'],Player['mood']][]=[
 ['zebra',1372,872,22,.35,'graze','graze'],['zebra',1405,840,18,.3,'graze','graze'],['zebra',1398,905,26,.4,'watch','graze'],['zebra',1430,875,16,.25,'graze','graze'],
 ['impala',1150,1080,18,.3,'graze','graze'],['impala',1180,1105,22,.35,'graze','graze'],['impala',1120,1110,14,.25,'watch','graze'],['impala',1210,1075,16,.3,'graze','graze'],
 ['lion',1318,1016,20,.45,'watch','stalk'],
 ['leopard',1030,782,24,.5,'watch','patrol'],
 ['hyena',1566,1040,26,.55,'watch','patrol'],['hyena',1590,1010,20,.5,'watch','patrol'],
 ['warthog',1440,1060,16,.4,'graze','graze'],['warthog',1468,1052,12,.35,'graze','graze'],
];
export const MENU_SHOTS:(Species|null)[]=[null,'lion','zebra','leopard','impala','hyena','warthog'];
const SHOT_SECONDS=9,OPENING_SECONDS=7;

export class MenuCinema{
 actors:Actor[];players:Player[];private ps=props(417);shot:Species|null=null;
 private eye=new THREE.Vector3(1500,90,1180);private angle=new Map<Species,number>();private framed:Species|null=null;private look=new THREE.Vector3(1250,10,900);private started=-1;
 constructor(){
  const now=Date.now();
  this.actors=CAST.map(([s,ax,ay,radius,duty,still,moving],i)=>{const p=newPlayer('menu-'+s+'-'+i,ANIMALS[s].name,now,true,s);p.protectedUntil=0;return{p,ax,ay,radius,speed:ANIMALS[s].gait.walk*10*(moving==='stalk'?.6:1),phase:i*1.7,duty,still,moving};});
  this.players=this.actors.map(a=>a.p);
 }
 // distance walked so far: each actor walks for `duty` of every 12 s cycle, then stands (grazing or watching)
 private walked(a:Actor,t:number){const T=12,u=t+a.phase*3,c=Math.floor(u/T),r=u-c*T;return(c*a.duty*T+Math.min(r,a.duty*T))*a.speed;}
 private at(a:Actor,t:number){const angle=a.phase+this.walked(a,t)/a.radius;return{x:a.ax+Math.cos(angle)*a.radius,y:a.ay+Math.sin(angle)*a.radius*.7};}
 // is the sight line from a camera at this angle to the animal free of rocks, trunks and the rest of the herd, with the
 // camera on dry land?
 private clear(p:{x:number;y:number},yaw:number,d:number){const ex=p.x+Math.cos(yaw)*d,ez=p.y+Math.sin(yaw)*d;if(this.ps.some(w=>w.kind==='water'&&Math.hypot(w.x-ex,w.y-ez)<w.size+30))return false;const vx=ex-p.x,vz=ez-p.y,near=(o:{x:number;y:number},r:number)=>{const u=Math.max(0,Math.min(1,((o.x-p.x)*vx+(o.y-p.y)*vz)/(d*d)));return u>.08&&Math.hypot(p.x+vx*u-o.x,p.y+vz*u-o.y)<r;};
  return!solidNear(this.ps,(ex+p.x)/2,(ez+p.y)/2,d/2+40).some(o=>near(o,solidRadius(o)+(o.kind==='rock'?14:4)))&&!this.players.some(o=>o!==p&&near(o,16));}
 /** Moves the cast to time t (seconds); positions and velocities are in game units like a synced room. */
 animate(t:number){
  for(const a of this.actors){const q=this.at(a,t),b=this.at(a,t-.1),vx=(q.x-b.x)*10,vy=(q.y-b.y)*10,moving=Math.hypot(vx,vy)>1;Object.assign(a.p,{x:q.x,y:q.y,vx:moving?vx:0,vy:moving?vy:0,mood:moving?a.moving:a.still});if(!moving&&a.still==='watch')a.p.heading=Math.atan2(860-q.y,1180-q.x);}
 }
 /** Which species the camera is on: the menu's focus, else the tour (an opening wide shot, then each species in turn). */
 subject(t:number,focus:Species|null){
  if(focus)return focus;if(this.started<0)this.started=t;const e=t-this.started;if(e<OPENING_SECONDS)return null;
  const tour=MENU_SHOTS.slice(1);return tour[Math.floor((e-OPENING_SECONDS)/SHOT_SECONDS)%tour.length];
 }
 /** Eases the camera toward the current shot: a slow telephoto orbit round the subject, framed off-centre so the menu
  *  stays clear (subject in the right third on wide screens, the lower third on tall ones). */
 frame(camera:THREE.PerspectiveCamera,t:number,dt:number,focus:Species|null,ground:(x:number,z:number)=>number,aspect:number,positions:Map<string,{x:number;y:number}>){
  const s=this.subject(t,focus);this.shot=s;
  const wantEye=new THREE.Vector3(),wantLook=new THREE.Vector3(),fov=s?40:48;
  if(!s){const yaw=-.95+Math.sin(t*.05)*.12,cx=1290,cz=940;wantLook.set(cx,ground(cx,cz)+8,cz);wantEye.set(cx+Math.sin(yaw)*330,ground(cx,cz)+70,cz+Math.cos(yaw)*330);}
  else{
   const a=this.actors.find(x=>x.p.species===s)!,pos=positions.get(a.p.id)||a.p,prof=cameraProfile(s),d=prof.distance*(focus?1.5:1.85),y=ground(pos.x,pos.y);
   // a three-quarter front view, chosen from where the animal is facing when the shot starts and then held (with a
   // slow drift) so the camera doesn't chase every step of its walk
   if(this.framed!==s){this.framed=s;const p=a.p,h=Math.hypot(p.vx,p.vy)>1?Math.atan2(p.vy,p.vx):p.heading||0;const base=h+(SPECIES.indexOf(s)%2?.75:-.75);this.angle.set(s,[0,.8,-.8,1.6,-1.6,2.6].map(o=>base+o).find(y=>this.clear(p,y,d))??base);}
   const yaw=this.angle.get(s)!+Math.sin(t*.06)*.25,ex=pos.x+Math.cos(yaw)*d,ez=pos.y+Math.sin(yaw)*d;wantEye.set(ex,Math.max(y,ground(ex,ez))+prof.head*.8,ez);wantLook.set(pos.x,y+prof.head*.7,pos.y);
   // shift the aim so the animal sits off-centre: right third when wide, lower third when tall
   const h=Math.tan(THREE.MathUtils.degToRad(fov/2)),forward=wantLook.clone().sub(wantEye).normalize(),right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
   // (with the species cards open, centred just above the cards instead)
   if(focus)wantLook.y-=.28*d*h;else if(aspect>1.1)wantLook.addScaledVector(right,-.42*d*h*aspect);else wantLook.y+=.5*d*h;
  }
  // a long move between shots rises like a crane over the grass instead of skimming through it
  const k=1-Math.exp(-2.2*dt),gap=this.look.distanceTo(wantLook);this.eye.lerp(wantEye,k);this.look.lerp(wantLook,k);
  const lift=Math.min(50,gap*.12);this.eye.y=Math.max(this.eye.y,ground(this.eye.x,this.eye.z)+3+lift);
  if(Math.abs(camera.fov-fov)>.05){camera.fov=THREE.MathUtils.damp(camera.fov,fov,1.5,dt);camera.updateProjectionMatrix();}
  camera.position.copy(this.eye);camera.lookAt(this.look);
  return this.look;
 }
}
