// Blender-made animal bodies (art/blender/build_animal.py): one smooth, skinned surface per species with a painted coat
// and a baked normal map, a lighter far cut, and alpha-cut hair cards (a lion's mane). The skin is weighted to the same
// joint names as the procedural rig in safari-animals.ts, so every pose, gait and climbing solve drives it unchanged.
// Species without a model yet, and the software renderer, keep the procedural bodies.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {Species} from '@/lib/game';
import lionUrl from './models/lion.glb?url';

const URLS:Partial<Record<Species,string>>={lion:lionUrl};
export type AnimalModel={near:THREE.BufferGeometry;far:THREE.BufferGeometry;hair:THREE.BufferGeometry|null;bones:string[];coat:THREE.Material;hairMaterial:THREE.Material|null};
const MODELS=new Map<Species,AnimalModel>();
export const animalModel=(species:Species)=>MODELS.get(species);

async function load(species:Species,url:string){
 const gltf=await new GLTFLoader().loadAsync(url);let near:THREE.SkinnedMesh|undefined,far:THREE.SkinnedMesh|undefined,hair:THREE.SkinnedMesh|undefined;
 gltf.scene.traverse(o=>{if(!(o as THREE.SkinnedMesh).isSkinnedMesh)return;const m=o as THREE.SkinnedMesh;if(m.name.endsWith('_far'))far=m;else if(m.name.includes('hair'))hair=m;else near=m;});
 if(!near)throw new Error('no body in '+species+' model');
 const bones=near.skeleton.bones.map(b=>b.name);
 // every mesh shares the body's joint order, so one skeleton per animal drives all of them
 const ordered=(m:THREE.SkinnedMesh)=>{const g=m.geometry,map=m.skeleton.bones.map(b=>bones.indexOf(b.name)),idx=g.getAttribute('skinIndex');
  if(map.some((v,i)=>v!==i))for(let i=0;i<idx.count;i++)for(let k=0;k<4;k++)idx.setComponent(i,k,map[idx.getComponent(i,k)]);
  g.applyMatrix4(m.matrixWorld);g.computeBoundingSphere();return g;};
 gltf.scene.updateMatrixWorld(true);
 const coat=near.material as THREE.MeshStandardMaterial;coat.roughness=.86;coat.metalness=0;
 // the savanna's warm, bright light washes pale coats out; a slightly deeper base keeps the painted tones
 coat.color.setRGB(.86,.8,.72);
 let hairMaterial:THREE.MeshStandardMaterial|null=null;
 if(hair){hairMaterial=hair.material as THREE.MeshStandardMaterial;hairMaterial.alphaTest=.45;hairMaterial.transparent=false;hairMaterial.side=THREE.DoubleSide;hairMaterial.roughness=.9;hairMaterial.metalness=0;}
 MODELS.set(species,{near:ordered(near),far:ordered(far??near),hair:hair?ordered(hair):null,bones,coat,hairMaterial});
}

let loading:Promise<void>|null=null;
/** Fetch every Blender-made animal once; resolves even if some fail (those species stay procedural). */
export function loadAnimalModels(){
 if(typeof window==='undefined')return Promise.resolve();
 return loading||=Promise.all(Object.entries(URLS).map(([s,url])=>load(s as Species,url!).catch(e=>console.warn('animal model',s,e)))).then(()=>{});
}
