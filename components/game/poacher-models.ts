import * as THREE from 'three';
import type {Poacher} from '../../lib/game';
// Original articulated faceted models, in the game's ten-units-per-metre scale.
export function createPoacherEncounter(scene:THREE.Scene){
 const root=new THREE.Group(),person=new THREE.Group(),jeep=new THREE.Group();root.add(person,jeep);scene.add(root);
 const materials=new Map<number,THREE.MeshStandardMaterial>();const geometries:THREE.BufferGeometry[]=[];
 function part(parent:THREE.Object3D,color:number,size:number[],pos:number[],round=false){const g=round?new THREE.CylinderGeometry(size[0],size[0],size[1],12):new THREE.BoxGeometry(...size as [number,number,number]);geometries.push(g);let m=materials.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.85,flatShading:true});materials.set(color,m);}const o=new THREE.Mesh(g,m);o.position.set(...pos as [number,number,number]);o.castShadow=true;parent.add(o);return o;}
 // A clothed human silhouette: boots, jointed legs, belted jacket, sleeves, hands, face and brimmed hat.
 const legs=[-1.4,1.4].map(x=>{const leg=new THREE.Group();leg.position.set(x,8,0);person.add(leg);part(leg,0x585740,[1.9,4.2,2.1],[0,-2,0]);part(leg,0x67654d,[1.7,3.8,1.9],[0,-5.5,0]);part(leg,0x302c27,[2.1,1.4,3.5],[0,-7.3,.6]);return leg;});
 part(person,0x72734f,[5.3,5.7,3.1],[0,10.8,0]);part(person,0x363328,[5.5,.7,3.3],[0,8.3,0]);for(const x of [-1.5,1.5])part(person,0x626744,[1.5,1.7,.5],[x,11.7,1.8]);
 part(person,0x936b4d,[1.6,1.1,1.6],[0,14,0]);part(person,0xa77a58,[2.8,3.2,2.6],[0,16,0]);part(person,0x8b6045,[.6,.7,.7],[0,16,1.6]);for(const x of [-.7,.7])part(person,0x24231e,[.4,.3,.2],[x,16.6,1.4]);part(person,0x4c4c35,[2.5,.4,0],[0,17.6,0],true);part(person,0x68694b,[1.7,1.5,0],[0,18.2,0],true);
 const arms=new THREE.Group();arms.position.set(0,12.7,0);person.add(arms);for(const x of [-3,3]){const sleeve=part(arms,0x72734f,[1.8,4,1.9],[x,-.8,.6]);sleeve.rotation.x=-.6;part(arms,0xa77a58,[1.2,1.2,1.2],[x,-2.1,2.5]);}
 // Rifle has a stock, receiver, grip, trigger guard, barrel and front sight, held across both hands.
 const gun=new THREE.Group();gun.position.set(0,-1.5,3);arms.add(gun);part(gun,0x5b3925,[3.2,1.1,1],[ -3,0,0]);part(gun,0x242b2b,[4.2,1,1],[.4,0,0]);part(gun,0x343a37,[4,.35,.35],[4.3,.2,0]);part(gun,0x1c2423,[.4,.65,.4],[5.8,.6,0]);part(gun,0x5b3925,[.8,1.5,.8],[-.8,-.8,0]);part(gun,0x242b2b,[.7,1.5,.6],[1,-.8,0]);
 const flash=part(gun,0xffdd72,[1.3,.8,.8],[6.5,.2,0]);flash.visible=false;
 // Open jeep: chassis, hood, grille, lamps, four wheels, cabin, seats, roll cage and spare tyre.
 part(jeep,0x3a443a,[22,3,41],[0,6,0]);part(jeep,0x73744e,[21,6,16],[0,10,13]);part(jeep,0x343b32,[18,4,.8],[0,10,21.5]);for(const x of [-6,-3,0,3,6])part(jeep,0x151e1c,[.7,3,1],[x,10,22]);for(const x of [-8,8])part(jeep,0xe9dca1,[3,2.5,1],[x,11,22]);part(jeep,0x303a32,[25,2,2],[0,6,23]);
 for(const x of [-11.5,11.5])for(const z of [-13,13]){const tyre=part(jeep,0x242726,[5.2,3,0],[x,5.3,z],true);tyre.rotation.z=Math.PI/2;const hub=part(jeep,0x9b9d8c,[2.7,3.2,0],[x,5.3,z],true);hub.rotation.z=Math.PI/2;}
 for(const x of [-9.8,9.8])part(jeep,0x73744e,[1.7,6,24],[x,10,-6]);part(jeep,0x73744e,[21,7,2],[0,10,-20]);for(const x of [-5,5]){part(jeep,0x323c31,[7,2,8],[x,10,-3]);part(jeep,0x323c31,[7,7,2],[x,13,-7]);}
 for(const x of [-9,9])for(const z of [-17,5])part(jeep,0x3a443a,[1,13,1],[x,18,z]);for(const z of [-17,5])part(jeep,0x3a443a,[19,1,1],[0,24,z]);for(const x of [-9,9])part(jeep,0x3a443a,[1,1,24],[x,24,-6]);
 const steering=part(jeep,0x202a25,[2.3,.6,0],[-5,14,4],true);steering.rotation.x=.6;const spare=part(jeep,0x242726,[5,3,0],[0,11,-23],true);spare.rotation.x=Math.PI/2;
 return {update(list:Poacher[]|undefined,now:number,ground:(x:number,y:number)=>number){const n=list?.[0];root.visible=!!n&&n.state!=='gone';if(!n)return;jeep.position.set(n.jeepX,ground(n.jeepX,n.jeepY),n.jeepY);jeep.rotation.y=-Math.PI/2;
 person.visible=!['escaping','gone'].includes(n.state);person.position.set(n.x,ground(n.x,n.y),n.y);person.rotation.y=n.state==='retreating'?-Math.PI/2:Math.PI/2;
 const run=n.state==='retreating';legs.forEach((l,i)=>l.rotation.x=run?Math.sin(now*.013+i*Math.PI)*.7:0);arms.rotation.x=n.state==='defending'?-.2:0;flash.visible=now-n.shotAt<110;person.scale.setScalar(n.state==='entering'?Math.max(.15,1-(now-n.since)/1400):1);if(n.state==='subdued')person.position.y-=6;
 },dispose(){scene.remove(root);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
