import * as THREE from 'three';
import type {AnimalRig} from './animal-models';

// Keep the articulated skeletons, but submit matching body parts together.
// A forest of animals now costs a handful of GPU draws rather than hundreds.
export class AnimalBatches {
 private material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.94});
 private batches=new Map<THREE.BufferGeometry,THREE.InstancedMesh>();
 private parts=new WeakMap<AnimalRig,THREE.Mesh[]>();
 constructor(private scene:THREE.Scene){}
 update(rigs:Iterable<AnimalRig>,focus:THREE.Vector3,lowDetail=false){
  for(const batch of this.batches.values())batch.count=0;
  for(const rig of rigs){
   if(!rig.root.visible)continue;
   let parts=this.parts.get(rig);if(!parts){parts=[];rig.root.traverse(o=>{if(o instanceof THREE.Mesh)parts!.push(o);});this.parts.set(rig,parts);}
   rig.root.updateMatrixWorld(true);
   const distant=lowDetail||rig.root.position.distanceToSquared(focus)>260*260;
   for(const part of parts){
    if(!part.visible)continue;
    const geometry=distant&&part.userData.softwareGeometry?part.userData.softwareGeometry as THREE.BufferGeometry:part.geometry;
    let batch=this.batches.get(geometry);
    if(!batch){batch=new THREE.InstancedMesh(geometry,this.material,2048);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.count=0;batch.frustumCulled=false;batch.castShadow=true;batch.receiveShadow=true;batch.matrixAutoUpdate=false;this.batches.set(geometry,batch);this.scene.add(batch);}
    const index=batch.count++;batch.setMatrixAt(index,part.matrixWorld);batch.setColorAt(index,(part.material as THREE.MeshStandardMaterial).color);
   }
  }
  for(const batch of this.batches.values()){batch.visible=batch.count>0;batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;}
 }
 get drawCalls(){return [...this.batches.values()].filter(b=>b.visible).length;}
 dispose(){for(const batch of this.batches.values()){this.scene.remove(batch);batch.dispose();}this.batches.clear();this.material.dispose();}
}
