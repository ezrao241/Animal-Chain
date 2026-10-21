import * as THREE from 'three';
import {animalMaterial,type SafariRig} from './safari-animals';
import {ANIMALS} from '@/lib/game';

// Keep the articulated skeletons, but submit matching body parts together: every lion's left foreleg is one
// instance of the same geometry. A savanna of sixty animals costs about a hundred GPU draws, not a thousand.
// Level of detail: animals beyond FAR_LOD from the camera swap to a lighter cut of the same model (fewer facets,
// coarser markings), so detail is spent where the player can see it.
// Animals outside the view are skipped (unless real shadows are on: an animal just off screen can still cast one in view).
const FAR_LOD=260;
export class AnimalBatches{
 private batches=new Map<THREE.BufferGeometry,THREE.InstancedMesh>();private frustum=new THREE.Frustum();private view=new THREE.Matrix4();private bounds=new THREE.Sphere();private skinned=new Set<SafariRig>();private frame=0;
 constructor(private scene:THREE.Scene){}
 update(rigs:Iterable<SafariRig>,camera:THREE.Camera,cull=true){
  for(const batch of this.batches.values())batch.count=0;
  this.frame++;
  if(cull){camera.updateMatrixWorld();this.frustum.setFromProjectionMatrix(this.view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));}
  for(const rig of rigs){
   if(!rig.root.visible)continue;
   // a sphere around the whole animal: shoulder height x10 units, and about twice that from nose to tail
   if(cull){const size=ANIMALS[rig.species].size*10;this.bounds.center.copy(rig.root.position);this.bounds.center.y+=size*.6;this.bounds.radius=size*1.6+8;if(!this.frustum.intersectsSphere(this.bounds))continue;}
   const far=rig.root.position.distanceTo(camera.position)>FAR_LOD;
   // a Blender-made body is one skinned draw per animal: it lives in the scene and is shown only while in view
   if(rig.skins){if(!rig.root.parent)this.scene.add(rig.root);rig.skins.near.visible=!far;rig.skins.far.visible=far;if(rig.skins.hair)rig.skins.hair.visible=!far;rig.root.userData.seen=this.frame;this.skinned.add(rig);continue;}
   rig.root.updateMatrixWorld(true);
   for(const part of rig.meshes){
    const geometry:THREE.BufferGeometry=far&&part.userData.far||part.geometry;let batch=this.batches.get(geometry);
    if(!batch){batch=new THREE.InstancedMesh(geometry,animalMaterial(),160);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.count=0;batch.frustumCulled=false;batch.castShadow=true;batch.receiveShadow=true;batch.matrixAutoUpdate=false;this.batches.set(geometry,batch);this.scene.add(batch);}
    if(batch.count<160)batch.setMatrixAt(batch.count++,part.matrixWorld);
   }
  }
  for(const batch of this.batches.values()){batch.visible=batch.count>0;batch.instanceMatrix.needsUpdate=true;}
  for(const rig of this.skinned){if(rig.root.userData.seen===this.frame)continue;rig.skins!.near.visible=rig.skins!.far.visible=false;if(rig.skins!.hair)rig.skins!.hair.visible=false;if(!rig.root.parent)this.skinned.delete(rig);}
 }
 get drawCalls(){let skins=0;for(const rig of this.skinned)if(rig.root.parent)skins+=[rig.skins!.near,rig.skins!.far,rig.skins!.hair].filter(m=>m?.visible).length;return [...this.batches.values()].filter(b=>b.visible).length+skins;}
 dispose(){for(const batch of this.batches.values()){this.scene.remove(batch);batch.dispose();}this.batches.clear();}
}
