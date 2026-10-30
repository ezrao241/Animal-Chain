// World events drawn on the plains (rules in lib/game.ts worldEvent): the grass fire's glowing front and tongues of
// flame, the smoke it throws downwind (and its column on the horizon when the fire is out of view), the blackened
// ground and the green flush that follows, and the dust kicked up by the migrating zebra column. Everything is worked
// out from the room's clock, so every player sees the same edge where the server burns animals.
import * as THREE from 'three';
import {worldEvent,fireArrival,fireEdge,nearWater,props,FIRE,FIRE_SHAPE,type Room,type Player,type WorldEvent} from '@/lib/game';
import {groundY,TERRAIN_GRID,type Savanna} from './savanna-world';
import {hash} from './faceted';

const PS=props(417);
type Puff={x:number;y:number;z:number;vx:number;vy:number;vz:number;born:number;life:number;s0:number;s1:number;dust:boolean};

/** a tongue of flame: three thin faceted spikes, yellow at the tip and deep orange at the root, one metre tall */
function tongue(){
 const pos:number[]=[],col:number[]=[],root=new THREE.Color(0xe0420a),mid=new THREE.Color(0xff8a1e),tip=new THREE.Color(0xffd65a);
 for(let k=0;k<3;k++){const a=k/3*Math.PI*2,ox=Math.cos(a)*1.6,oz=Math.sin(a)*1.6,h=(k?7:10),w=2.2;
  for(let f=0;f<3;f++){const b=f/3*Math.PI*2+a,c=b+Math.PI*2/3;const m=k?mid:tip;pos.push(ox+Math.cos(b)*w,0,oz+Math.sin(b)*w,ox+Math.cos(c)*w,0,oz+Math.sin(c)*w,ox*.3,h,oz*.3);col.push(root.r,root.g,root.b,root.r,root.g,root.b,m.r,m.g,m.b);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));return g;
}
/** the burnt patch: the ground triangles under the fire's whole run, each corner carrying the time the front reaches it */
function scorchGeometry(ev:WorldEvent){
 const {S,X0,Z0,NX,NZ}=TERRAIN_GRID,s=FIRE.run/1000,e=fireEdge(ev,s),hx=Math.hypot(e.a*ev.ux,e.b*ev.uy)+S,hz=Math.hypot(e.a*ev.uy,e.b*ev.ux)+S;
 const i0=Math.max(0,Math.floor((e.cx-hx-X0)/S)),i1=Math.min(NX-1,Math.ceil((e.cx+hx-X0)/S)),j0=Math.max(0,Math.floor((e.cy-hz-Z0)/S)),j1=Math.min(NZ-1,Math.ceil((e.cy+hz-Z0)/S));
 const pos:number[]=[],arr:number[]=[],put=(i:number,j:number)=>{const x=X0+i*S,z=Z0+j*S;pos.push(x,groundY(x,z)+.5,z);const t=fireArrival(ev,x,z);arr.push(Number.isFinite(t)?(t-ev.at)/1000:1e4);};
 for(let j=j0;j<j1;j++)for(let i=i0;i<i1;i++){for(const [a,b] of [[i,j],[i+1,j+1],[i+1,j]])put(a,b);for(const [a,b] of [[i,j],[i,j+1],[i+1,j+1]])put(a,b);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('arrival',new THREE.Float32BufferAttribute(arr,1));g.computeBoundingSphere();return g;
}

export class WorldEffects{
 private scene:THREE.Scene;private savanna:Savanna;private lightweight:boolean;
 private key='';private scorch?:THREE.Mesh;
 private scorchUniforms={uS:{value:0},uFT:{value:new THREE.Vector4(FIRE.run/1000,FIRE.flame/1000,FIRE.flush/1000,1)}};
 private scorchMat:THREE.MeshBasicMaterial;
 private flames:THREE.InstancedMesh;private flameGeo=tongue();private flameMat=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false});
 private puffs:Puff[]=[];private smoke:THREE.InstancedMesh;private puffGeo=new THREE.IcosahedronGeometry(1,0);private puffMat=new THREE.MeshBasicMaterial({transparent:true,opacity:.36,depthWrite:false});
 private plume:THREE.Group;private plumeMat=new THREE.MeshBasicMaterial({color:0x8a8178,transparent:true,opacity:.55,fog:false,depthWrite:false});
 private glow=new THREE.PointLight(0xff7a2e,0,0,2);
 private m=new THREE.Matrix4();private q=new THREE.Quaternion();private v=new THREE.Vector3();private sc=new THREE.Vector3();private e=new THREE.Euler();private c=new THREE.Color();
 stats='';private lastEmit=0;private lastDraw=0;private maxFlames:number;private maxPuffs:number;
 constructor(scene:THREE.Scene,savanna:Savanna,lightweight:boolean){
  this.scene=scene;this.savanna=savanna;this.lightweight=lightweight;this.maxFlames=lightweight?90:320;this.maxPuffs=lightweight?70:240;
  this.scorchMat=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  const u=this.scorchUniforms;
  this.scorchMat.onBeforeCompile=shader=>{Object.assign(shader.uniforms,u);
   shader.vertexShader='attribute float arrival;\nvarying float vArr;\nvarying vec2 vXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vArr=arrival;vXZ=position.xz;');
   // the front glows as it passes, then the ground cools from embers to black char, patchy where tussocks burnt
   // hotter; green shoots come through after the flush wait. Lit colours dim with the daylight (uFT.w), embers do not.
   shader.fragmentShader='uniform float uS;\nuniform vec4 uFT;\nvarying float vArr;\nvarying vec2 vXZ;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float age=uS-vArr;if(age<0.)discard;
 float n=.5+.25*sin(vXZ.x*.061+sin(vXZ.y*.043)*2.3)+.25*sin(vXZ.y*.077+sin(vXZ.x*.052)*1.9);
 vec3 c,charc=vec3(.07,.062,.055)*(.7+.6*n)*mix(.45,1.,uFT.w);
 if(age<uFT.y&&uS<uFT.x){float k=age/uFT.y;c=age<1.2?mix(vec3(1.,.66,.2),vec3(.75,.2,.04),age/1.2):mix(vec3(.32,.07,.02)*(.6+.8*n),charc,smoothstep(0.,.8,k));}
 else{float cool=clamp((age-uFT.y)/20.,0.,1.);c=mix(mix(vec3(.22,.05,.02)*(.3+1.4*n*n),charc,.5),charc,cool);
  float g=clamp((age-uFT.z)/40.,0.,1.)*smoothstep(.25,.7,n+.15);c=mix(c,vec3(.2,.3,.09)*(.7+.6*n)*mix(.3,1.,uFT.w),g*.75);}
 diffuseColor=vec4(c,smoothstep(0.,1.2,age)*.94);`);};
  this.flames=new THREE.InstancedMesh(this.flameGeo,this.flameMat,this.maxFlames);this.flames.count=0;this.flames.frustumCulled=false;scene.add(this.flames);
  this.smoke=new THREE.InstancedMesh(this.puffGeo,this.puffMat,this.maxPuffs);this.smoke.count=0;this.smoke.frustumCulled=false;this.smoke.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(this.maxPuffs*3),3);scene.add(this.smoke);
  // the smoke column as seen from far across the plains: leaning puffs, drawn on the horizon like the hills
  this.plume=new THREE.Group();for(let k=0;k<9;k++){const b=new THREE.Mesh(this.puffGeo,this.plumeMat),h=k/8;b.position.set(h*h*.55,.06+h*.9,0);b.scale.setScalar(.07+h*.16);b.rotation.set(k,k*2,0);this.plume.add(b);}
  this.plume.visible=false;this.plume.renderOrder=-1;this.plume.children.forEach(o=>o.renderOrder=-1);scene.add(this.plume);
  scene.add(this.glow);
 }
 /** one frame: `players` are the animals as drawn (their smoothed positions), `day` 0 night .. 1 day */
 update(room:Pick<Room,'started'|'seed'|'round'>|null,now:number,time:number,cam:THREE.Vector3,far:number,players:readonly Pick<Player,'id'|'x'|'y'|'vx'|'vy'|'deadUntil'>[],day:number){
  const ev=room?worldEvent(room,now):null,fire=ev?.kind==='fire'&&now>=ev.at?ev:null,s=fire?(now-fire.at)/1000:0,burning=!!fire&&now<fire.until;
  // the burnt patch is built once per fire
  const key=fire?room!.seed+':'+room!.round+':'+room!.started+':'+fire.day:'';
  if(key!==this.key){this.key=key;if(this.scorch){this.scene.remove(this.scorch);this.scorch.geometry.dispose();this.scorch=undefined;}if(fire){this.scorch=new THREE.Mesh(scorchGeometry(fire),this.scorchMat);this.scorch.renderOrder=1;this.scene.add(this.scorch);}}
  this.scorchUniforms.uS.value=s;this.scorchUniforms.uFT.value.w=day;
  this.savanna.fire(fire?{x:fire.x,y:fire.y,ux:fire.ux,uy:fire.uy,seconds:s,run:FIRE.run/1000,flame:FIRE.flame/1000,flush:FIRE.flush/1000,a:FIRE_SHAPE.a,c:FIRE_SHAPE.c,f:FIRE_SHAPE.f}:null);
  // tongues of flame along the front: tall at the head where it runs with the wind, low on the creeping flanks and back
  let n=0,nearest=Infinity;const glowAt=this.v.set(0,0,0);
  if(burning&&fire){
   const e=fireEdge(fire,s),inner=fireEdge(fire,Math.max(0,s-FIRE.flame/1000*.45)),px=-fire.uy,py=fire.ux,perim=Math.PI*(3*(e.a+e.b)-Math.sqrt((3*e.a+e.b)*(e.a+3*e.b))),steps=Math.min(this.maxFlames,Math.max(12,Math.round(perim/(this.lightweight?60:24))));
   for(const [edge,row] of [[e,0],[inner,1]] as const)for(let k=0;k<steps&&n<this.maxFlames;k++){
    const th=(k+row*.5)/steps*Math.PI*2,lc=Math.cos(th),x=edge.cx+fire.ux*edge.a*lc+px*edge.b*Math.sin(th),z=edge.cy+fire.uy*edge.a*lc+py*edge.b*Math.sin(th);
    const d=Math.hypot(x-cam.x,z-cam.z);if(d>far||nearWater(PS,x,z))continue;
    if(d<nearest){nearest=d;glowAt.set(x,0,z);}
    const head=Math.max(0,lc),h=(.5+2.6*head*head)*(row?.6:1)*(.7+.55*Math.abs(Math.sin(time*(7+hash(k,row,3)*5)+k*1.7))),w=1+head*.6;
    this.q.setFromEuler(this.e.set(0,hash(k,row,1)*6.28+time*.6,0));this.m.compose(this.v.set(x,groundY(x,z),z),this.q,this.sc.set(w,h,w));this.flames.setMatrixAt(n++,this.m);
   }
  }
  this.flames.count=n;this.flames.instanceMatrix.needsUpdate=true;
  this.stats=`${fire?fire.kind:'-'} s${s.toFixed(0)} flames${n} puffs${this.puffs.length} scorch${this.scorch?1:0}`;
  // the fire's light on the animals and grass round it, strongest after dark, flickering
  this.glow.intensity=burning&&nearest<700?(1.1-day*.9)*(.85+.25*Math.sin(time*11)*Math.sin(time*7.3))*2500:0;
  if(this.glow.intensity>0){const gx=glowAt.x,gz=glowAt.z;this.glow.position.set(gx,groundY(gx,gz)+80,gz);}
  this.emit(fire,burning,s,now,time,cam,players);
  this.drawPuffs(time,day,cam);
  // the column on the horizon when the fire is beyond the far plane (smoke still rises for a while after the flames)
  this.plume.visible=false;
  if(fire&&s<FIRE.run/1000+50){const e=fireEdge(fire,Math.min(s,FIRE.run/1000)),hx=e.cx+fire.ux*e.a*.6,hz=e.cy+fire.uy*e.a*.6,d=Math.hypot(hx-cam.x,hz-cam.z);
   if(d>far*.7){const r=far*.55,k=r/d,size=Math.min(1,.35+s/40)*(s>FIRE.run/1000?Math.max(0,1-(s-FIRE.run/1000)/50):1)*1600*k;this.plume.visible=size>1;
    this.plume.position.set(cam.x+(hx-cam.x)*k,cam.y+(groundY(hx,hz)-cam.y)*k,cam.z+(hz-cam.z)*k);this.plume.scale.setScalar(size);this.plume.rotation.y=-Math.atan2(fire.uy,fire.ux);
    this.plumeMat.color.set(0x8a8178).lerp(this.c.set(0x5a4034),1-day);}}
 }
 private emit(fire:WorldEvent|null,burning:boolean,s:number,now:number,time:number,cam:THREE.Vector3,players:readonly Pick<Player,'id'|'x'|'y'|'vx'|'vy'|'deadUntil'>[]){
  const dt=Math.min(.1,time-this.lastEmit);this.lastEmit=time;if(dt<=0)return;
  const room=this.maxPuffs-this.puffs.length;if(room<=0)return;let budget=room;
  if(fire&&burning){
   // smoke rises off the front (most from the head) and drifts downwind with the breeze
   const e=fireEdge(fire,s),px=-fire.uy,py=fire.ux;let want=(this.lightweight?10:32)*dt;
   while(want>0&&budget>0){if(want<1&&Math.random()>want)break;want--;
    const th=(Math.random()-.5)*Math.PI*(Math.random()<.7?.9:2),x=e.cx+fire.ux*e.a*Math.cos(th)+px*e.b*Math.sin(th),z=e.cy+fire.uy*e.a*Math.cos(th)+py*e.b*Math.sin(th);
    if(Math.hypot(x-cam.x,z-cam.z)>1300||nearWater(PS,x,z))continue;budget--;
    this.puffs.push({x,y:groundY(x,z)+8,z,vx:fire.ux*28+(Math.random()-.5)*8,vy:22+Math.random()*16,vz:fire.uy*28+(Math.random()-.5)*8,born:time,life:14+Math.random()*6,s0:9+Math.random()*8,s1:55+Math.random()*60,dust:false});}
  }
  // dust behind the migrating zebra
  for(const p of players){if(budget<=0)break;if(!p.id.startsWith('trek-')||p.deadUntil)continue;const v=Math.hypot(p.vx||0,p.vy||0);if(v<12||Math.hypot(p.x-cam.x,p.y-cam.z)>700||Math.random()>dt*(this.lightweight?.6:1.6))continue;budget--;
   this.puffs.push({x:p.x-(p.vx||0)*.12,y:groundY(p.x,p.y)+3,z:p.y-(p.vy||0)*.12,vx:(Math.random()-.5)*6,vy:4+Math.random()*4,vz:(Math.random()-.5)*6,born:time,life:3+Math.random()*2,s0:5,s1:18+Math.random()*12,dust:true});}
 }
 private drawPuffs(time:number,day:number,cam:THREE.Vector3){
  this.puffs=this.puffs.filter(p=>time-p.born<p.life);let n=0;const dt=Math.min(.1,Math.max(0,time-this.lastDraw));this.lastDraw=time;
  const smokeDay=this.c.set(0x8d877f),smokeNight=new THREE.Color(0x4a3d35),dust=new THREE.Color(0xc9ab7c),dustNight=new THREE.Color(0x544a3c);
  for(const p of this.puffs){const age=(time-p.born)/p.life;p.x+=p.vx*dt;p.y+=p.vy*dt*(1-age*.5);p.z+=p.vz*dt;
   // a puff right at the lens thins away, so smoke drifting over the camera never walls off the view
   const near=Math.hypot(p.x-cam.x,p.y-cam.y,p.z-cam.z),size=(p.s0+(p.s1-p.s0)*Math.sqrt(age))*(age>.75?1-(age-.75)/.25:1)*Math.min(1,Math.max(0,(near-40)/(p.s1*.8)));
   this.q.setFromEuler(this.e.set(p.born,p.born*2,0));this.m.compose(this.v.set(p.x,p.y,p.z),this.q,this.sc.set(size,size*(p.dust?.5:.8),size));this.smoke.setMatrixAt(n,this.m);
   const col=p.dust?dust.clone().lerp(dustNight,1-day):smokeDay.clone().lerp(smokeNight,1-day);col.multiplyScalar(.85+hash(p.born*100,1,2)*.3);this.smoke.setColorAt(n,col);n++;}
  this.smoke.count=n;this.smoke.instanceMatrix.needsUpdate=true;if(this.smoke.instanceColor)this.smoke.instanceColor.needsUpdate=true;
 }
 dispose(){if(this.scorch){this.scene.remove(this.scorch);this.scorch.geometry.dispose();}this.scorchMat.dispose();this.flameGeo.dispose();this.flameMat.dispose();this.puffGeo.dispose();this.puffMat.dispose();this.plumeMat.dispose();this.scene.remove(this.flames,this.smoke,this.plume,this.glow);}
}
