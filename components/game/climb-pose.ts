// The renderer's side of climbing: the body follows the shared climbing pose (lib/game climbPose, on the same bark the
// rules use), smoothed so every transition (rearing onto the trunk, pulling up onto a bough, pivoting, jumping down)
// is continuous, and then the paws are placed on the real bark.
import * as THREE from 'three';
import {ANIMALS,climbPose,type Player,type Prop} from '@/lib/game';
import {tree} from '@/lib/acacia';
import {plantFeet,type SafariRig,type SafariPose} from './safari-animals';
type Ground=(x:number,z:number)=>number;
export type Climber={x:number;y:number;info:NonNullable<SafariPose['climb']>;prop:Prop};
/** Pose the rig's root for an animal in a tree; returns null when it is on the ground (the caller poses it as usual). */
export function climberPose(rig:SafariRig,p:Player,ps:Prop[],dt:number,groundY:Ground):Climber|null{
 const pose=climbPose(ps,p),prop=pose?ps[p.tree!]:undefined;
 if(!pose||!prop){if(rig.climb){rig.turn=rig.climb.yaw;rig.climb=undefined;}return null;}
 const base=groundY(prop.x,prop.y),k=1-Math.exp(-10*dt);
 if(!rig.climb)rig.climb={x:rig.root.position.x,y:rig.root.position.z,h:rig.root.position.y,yaw:rig.turn,pitch:rig.pitch,speed:0,still:0,on:pose.on};
 const c=rig.climb,ox=c.x,oy=c.y,oh=c.h,wantYaw=-pose.heading,turn=Math.atan2(Math.sin(wantYaw-c.yaw),Math.cos(wantYaw-c.yaw)),max=ANIMALS[p.species].gait.turnRate*dt;
 c.x+=(pose.x-c.x)*k;c.y+=(pose.y-c.y)*k;c.h+=(base+pose.h-c.h)*k;c.pitch+=(pose.pitch-c.pitch)*k;c.yaw+=THREE.MathUtils.clamp(turn*Math.min(1,k*1.4),-max,max);
 c.speed=Math.hypot(c.x-ox,c.y-oy,c.h-oh)/Math.max(dt,1e-3);c.still=c.speed<1.5&&Math.abs(turn)<.2?c.still+dt:0;c.on=pose.on;
 rig.turn=c.yaw;rig.pitch=c.pitch;rig.altitude=c.h-groundY(c.x,c.y);
 rig.root.position.set(c.x,c.h,c.y);rig.root.rotation.set(0,c.yaw,c.pitch);
 // lying up: still on a bough for a moment (not while still walking out or pivoting)
 return{x:c.x,y:c.y,prop,info:{on:pose.on,speed:c.speed,rest:pose.on==='limb'&&p.climb==='limb'&&c.still>1.2,turning:Math.abs(turn)>.3,down:pose.pitch<-.5,pitch:c.pitch}};
}
/** After animateSafari: blend the legs onto the bark (full weight while climbing or walking a bough). Returns the
 *  largest distance (metres) any paw fell short of its bark target, for checks. */
export function climberFeet(rig:SafariRig,climb:Climber|null,ps:Prop[],dt:number,groundY:Ground){
 const contact=!!climb&&!climb.info.rest&&climb.info.on!=='air';rig.climbWeight=THREE.MathUtils.damp(rig.climbWeight,contact?1:0,8,dt);
 if(rig.climbWeight<.01||!climb||climb.info.on==='air')return 0;
 const T=tree(ps,climb.prop);return plantFeet(rig,{dt,on:climb.info.on,speed:climb.info.speed,weight:rig.climbWeight,turning:climb.info.turning},{segments:T.segments,base:groundY(climb.prop.x,climb.prop.y),ground:groundY});
}
