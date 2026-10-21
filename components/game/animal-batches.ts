import * as THREE from 'three';
import {animalMaterial,type SafariRig} from './safari-animals';

// Keep the articulated skeletons, but submit matching body parts together: every lion's left foreleg is one
// instance of the same geometry. A savanna of sixty animals costs about a hundred GPU draws, not a thousand.
// Level of detail: animals beyond FAR_LOD from the camera swap to a lighter cut of the same model (fewer facets,
// coarser markings), so detail is spent where the player can see it.
const FAR_LOD=260;
export class AnimalBatches{
 private batches=new Map<THREE.BufferGeometry,THREE.InstancedMesh>();
 constructor(private scene:THREE.Scene){}
 update(rigs:Iterable<SafariRig>,camera:THREE.Vector3){
  for(const batch of this.batches.values())batch.count=0;
  for(const rig of rigs){
   if(!rig.root.visible)continue;
   rig.root.updateMatrixWorld(true);const far=rig.root.position.distanceTo(camera)>FAR_LOD;
   for(const part of rig.meshes){
    const geometry:THREE.BufferGeometry=far&&part.userData.far||part.geometry;let batch=this.batches.get(geometry);
    if(!batch){batch=new THREE.InstancedMesh(geometry,animalMaterial(),160);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.count=0;batch.frustumCulled=false;batch.castShadow=true;batch.receiveShadow=true;batch.matrixAutoUpdate=false;this.batches.set(geometry,batch);this.scene.add(batch);}
    if(batch.count<160)batch.setMatrixAt(batch.count++,part.matrixWorld);
   }
  }
  for(const batch of this.batches.values()){batch.visible=batch.count>0;batch.instanceMatrix.needsUpdate=true;}
 }
 get drawCalls(){return [...this.batches.values()].filter(b=>b.visible).length;}
 dispose(){for(const batch of this.batches.values()){this.scene.remove(batch);batch.dispose();}this.batches.clear();}
}
