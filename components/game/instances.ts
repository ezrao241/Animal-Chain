// Instanced placement of the Blender asset library (exports/stage2/env_*.glb) from placement JSON written by
// blender/scripts/stage3_test_layout.py. One InstancedMesh per (asset primitive, 40 m chunk); chunks outside the
// draw range are hidden. Placement units: game (10 = 1 m); z = ground height in game units; rot = radians about up
// (Blender Z == three Y); s = uniform scale of the metre-scale asset.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

export type Placement = {asset: string; x: number; y: number; z: number; rot: number; s: number};

const LIB: [RegExp, string][] = [
  [/^TREE_Young/, 'env_trees_young.glb'], [/^TREE_/, 'env_trees_broadleaf.glb'], [/^CONIFER_/, 'env_trees_evergreen.glb'],
  [/^(SHRUB|SAPLING)_/, 'env_shrubs.glb'], [/^FERN_/, 'env_ferns.glb'], [/^(GRASS|PLANT)_/, 'env_grass_plants.glb'],
  [/^ROCK_/, 'env_rocks.glb'], [/^(LOG|STUMP|BRANCH|ROOT)_/, 'env_wood.glb'], [/^GROUND_/, 'env_ground.glb'],
];
const CHUNK = 400;

export async function createInstances(scene: THREE.Scene, base: string, placements: Placement[], opts: {shadows?: boolean} = {}) {
  const files = new Map<string, Placement[]>();
  for (const p of placements) {
    const f = LIB.find(([re]) => re.test(p.asset))?.[1];
    if (!f) { console.warn('no library for', p.asset); continue; }
    if (!files.has(f)) files.set(f, []);
    files.get(f)!.push(p);
  }
  const loader = new GLTFLoader();
  const chunks: {mesh: THREE.InstancedMesh; x: number; z: number}[] = [];
  const group = new THREE.Group(); group.name = 'Instanced_Assets'; scene.add(group);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let triangles = 0;
  await Promise.all([...files.entries()].map(async ([file, list]) => {
    const gltf = await loader.loadAsync(base + file);
    const byAsset = new Map<string, Placement[]>();
    for (const p of list) { if (!byAsset.has(p.asset)) byAsset.set(p.asset, []); byAsset.get(p.asset)!.push(p); }
    for (const [asset, ps] of byAsset) {
      const node = gltf.scene.getObjectByName(asset);
      if (!node) { console.warn('asset not in', file, asset); continue; }
      node.updateMatrixWorld(true);
      const prims: THREE.Mesh[] = [];
      node.traverse(o => { if ((o as THREE.Mesh).isMesh) prims.push(o as THREE.Mesh); });
      const bins = new Map<string, Placement[]>();
      for (const p of ps) { const k = `${Math.floor(p.x / CHUNK)},${Math.floor(p.y / CHUNK)}`; if (!bins.has(k)) bins.set(k, []); bins.get(k)!.push(p); }
      for (const prim of prims) {
        const local = prim.matrixWorld.clone();      // primitive transform inside the asset (usually identity)
        const mat = prim.material as THREE.MeshStandardMaterial;
        if (mat.map) mat.map.anisotropy = 8;
        for (const [, bp] of bins) {
          const im = new THREE.InstancedMesh(prim.geometry, mat, bp.length);
          let cx = 0, cz = 0;
          bp.forEach((p, i) => {
            q.setFromAxisAngle(up, p.rot); v.set(p.x, p.z, p.y); sc.setScalar(p.s * 10);
            m.compose(v, q, sc).multiply(local); im.setMatrixAt(i, m); cx += p.x; cz += p.y;
          });
          im.castShadow = opts.shadows ?? true; im.receiveShadow = true;
          im.computeBoundingSphere(); im.frustumCulled = true;
          im.name = `${asset}:${prim.name}`;
          group.add(im); chunks.push({mesh: im, x: cx / bp.length, z: cz / bp.length});
          triangles += (prim.geometry.index ? prim.geometry.index.count / 3 : prim.geometry.attributes.position.count / 3) * bp.length;
        }
      }
    }
  }));
  let lastX = -1e9, lastZ = -1e9, lastR = 0;
  return {
    triangles, chunks: chunks.length,
    update(x: number, z: number, range: number) {
      if (Math.hypot(x - lastX, z - lastZ) < 40 && range === lastR) return;
      lastX = x; lastZ = z; lastR = range;
      for (const c of chunks) c.mesh.visible = Math.hypot(c.x - x, c.z - z) < range + CHUNK;
    },
    dispose() { for (const c of chunks) c.mesh.dispose(); scene.remove(group); },
  };
}
