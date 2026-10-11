// Drop-in replacement for components/game/forest-world.ts for the larger 400 x 280 m map.
// Same exports (groundY, pathDistance, createForest), plus preloadWorld() which must resolve before the scene starts.
// Terrain height and trail distance come from fields exported by blender/scripts/export_height.py, so animals,
// camera and the Blender-built terrain agree. GLB content (test area, water) is loaded by createForest.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {W, H} from '@/lib/game';
import {createWater, WaterHandle, addRipple} from './water';
import {createSkyEnvironment} from './sky';
import {createInstances, Placement} from './instances';
import {addTerrainDetail} from './terrain-detail';
import {loadDaylight, Daylight} from './lighting';

const STEP = 5, NX = 801, NY = 561;
let HEIGHT: Float32Array | null = null, PATH: Uint8Array | null = null, WATER: Float32Array | null = null;
export let WORLD_CONFIG: {tiles: {url: string; x0: number; y0: number; x1: number; y1: number}[]; base: string; placements: Placement[]} = {tiles: [], base: '/world/', placements: []};

export async function preloadWorld(base = '/world/', tiles: typeof WORLD_CONFIG.tiles = [], placementUrls: string[] = []) {
  const placements: Placement[] = [];
  for (const u of placementUrls) {
    const j: any = await (await fetch(base + u)).json();
    placements.push(...(j.trees || j.items || []));
  }
  WORLD_CONFIG = {tiles, base, placements};
  const [h, p, wl] = await Promise.all([fetch(base + 'height_large_05.bin'), fetch(base + 'pathdist_large_05.bin'), fetch(base + 'waterlevel_large_05.bin')]);
  HEIGHT = new Float32Array(await h.arrayBuffer());
  PATH = new Uint8Array(await p.arrayBuffer());
  WATER = new Float32Array(await wl.arrayBuffer());
}

function sample(a: ArrayLike<number> | null, x: number, z: number) {
  if (!a) return 0;
  const fx = Math.min(Math.max(x / STEP, 0), NX - 1.001), fz = Math.min(Math.max(z / STEP, 0), NY - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * NX + i;
  return a[k] * (1 - u) * (1 - v) + a[k + 1] * u * (1 - v) + a[k + NX] * (1 - u) * v + a[k + NX + 1] * u * v;
}
export const groundY = (x: number, z: number) => sample(HEIGHT, x, z);
export const pathDistance = (x: number, z: number) => sample(PATH, x, z);
/** water-surface height (game units) if (x, z) is inside a stream channel, else null */
export function waterLevel(x: number, z: number) {
  if (!WATER) return null;
  const i = Math.round(Math.min(Math.max(x / STEP, 0), NX - 1)), j = Math.round(Math.min(Math.max(z / STEP, 0), NY - 1));
  const v = WATER[j * NX + i]; return v > -999 ? v : null;
}

// Contact ripples. The game calls setAnimals() each frame/tick with every animal's position (x, z in game units,
// y = height above ground for fliers/climbers); any animal standing in water that moves makes rings, roughly
// one per stride, stronger when running; a still animal makes an occasional faint ring.
type AnimalTouch = {id: string; x: number; z: number; y?: number; size?: number};
const contact = new Map<string, {x: number; z: number; t: number}>();
let ANIMALS: AnimalTouch[] = [];
export function setAnimals(list: AnimalTouch[]) { ANIMALS = list; }
function updateRipples(time: number) {
  for (const a of ANIMALS) {
    if ((a.y ?? 0) > 3) continue;                                  // flying / perched: not touching the water
    if (waterLevel(a.x, a.z) === null) { contact.delete(a.id); continue; }
    const c = contact.get(a.id);
    if (!c) { addRipple(a.x, a.z, time, 1.0); contact.set(a.id, {x: a.x, z: a.z, t: time}); continue; }   // entering: splash ring
    const moved = Math.hypot(a.x - c.x, a.z - c.z), dt = time - c.t, stride = 3 + (a.size ?? 1) * 2;
    if (moved > stride || dt > 1.6) {
      const speed = moved / Math.max(dt, 0.05);
      addRipple(a.x, a.z, time, moved > stride ? Math.min(1, 0.35 + speed / 120) : 0.18);
      c.x = a.x; c.z = a.z; c.t = time;
    }
  }
}

export function createForest(scene: THREE.Scene, seed: number, lightweight: boolean, preview = false) {
  const resources: {dispose(): void}[] = [];
  const env = createSkyEnvironment(scene);
  resources.push(env);
  let daylight: Daylight | null = null; const followV = new THREE.Vector3();
  loadDaylight(scene, null, WORLD_CONFIG.base + 'sky/epping_forest_01_2k.hdr').then(d => {
    daylight = d; resources.push(d); env.sun.copy(d.sunDir);   // water glints follow the photo's sun
    for (const w of waters) w.setSun?.(d.sunDir);
    (window as any).__daylight = {sun: d.sunDir.toArray().map(v => +v.toFixed(3))};
  }).catch(e => console.error('daylight failed', e));
  const tiles = WORLD_CONFIG.tiles;
  const inTile = (x: number, z: number) => tiles.some(t => x > t.x0 && x < t.x1 && z > t.y0 && z < t.y1);

  // base terrain (outside the finished test tiles): 2 m grid over the map plus a 500-unit apron
  const S = 20, x0 = -500, z0 = -500, nx = Math.ceil((W + 1000) / S) + 1, nz = Math.ceil((H + 1000) / S) + 1;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  const floor = new THREE.Color(0x3e3a26), trail = new THREE.Color(0x5a4630), c = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * S, z = z0 + j * S, k = (j * nx + i) * 3;
    pos[k] = x; pos[k + 1] = groundY(x, z); pos[k + 2] = z;
    c.copy(floor).lerp(trail, 1 - THREE.MathUtils.smoothstep(pathDistance(x, z), 18, 45));
    col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
  }
  const idx: number[] = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const cx = x0 + (i + .5) * S, cz = z0 + (j + .5) * S;
    if (inTile(cx, cz)) continue;  // the tile's own terrain replaces this cell
    const a = j * nx + i;
    idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const gm = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1});
  addTerrainDetail(gm, WORLD_CONFIG.base); const ground = new THREE.Mesh(g, gm); ground.receiveShadow = true; scene.add(ground);
  resources.push(g, gm);

  // finished tiles: GLB in metres, Blender Z-up already converted to Y-up by the exporter; game units = 10 x metres
  const waters: WaterHandle[] = [];
  const loader = new GLTFLoader();
  for (const t of tiles) {
    loader.load(WORLD_CONFIG.base + t.url, gltf => {
      const root = gltf.scene;
      root.scale.setScalar(10);
      root.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.receiveShadow = true; m.castShadow = !/^(Water|Terrain|Ground)/.test(m.name);
        if (/^Water_/.test(m.name)) { const w = createWater(m, env); waters.push(w); resources.push(w); }
        if (/^Terrain/.test(m.name)) addTerrainDetail(m.material as THREE.MeshStandardMaterial, WORLD_CONFIG.base);
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mt of mats) if ((mt as THREE.MeshStandardMaterial).map) (mt as THREE.MeshStandardMaterial).map!.anisotropy = 8;
      });
      scene.add(root);
      (window as any).__tileLoaded = ((window as any).__tileLoaded || 0) + 1;
    }, undefined, e => console.error('tile load failed', t.url, e));
  }
  let inst: Awaited<ReturnType<typeof createInstances>> | null = null;
  if (WORLD_CONFIG.placements.length) createInstances(scene, '/env/', WORLD_CONFIG.placements).then(r => {
    inst = r; (window as any).__instances = {triangles: r.triangles, chunks: r.chunks};
  }).catch(e => console.error('instances failed', e));
  (window as any).__probe = () => { const out: any = {casters: 0, inst: 0, mats: {} as any, sun: null};
    scene.traverse(o => { const m = o as any; if (m.isMesh && m.castShadow) out.casters++; if (m.isInstancedMesh) { out.inst++; const mt = m.material; out.mats[mt.name] = [mt.transparent, mt.alphaTest, mt.side, m.castShadow, m.visible]; }
      if (m.isDirectionalLight && m.castShadow) out.sun = {p: m.position.toArray().map((v: number) => Math.round(v)), t: m.target.position.toArray().map((v: number) => Math.round(v)), cam: [m.shadow.camera.left, m.shadow.camera.far], map: m.shadow.mapSize.x}; });
    return out; };
  return {
    update(time: number, x: number, z: number, range: number) {
      const g = globalThis as any; g.__frames = (g.__frames || 0) + 1; if (g.__freezeTime != null) time = g.__freezeTime;  // test hooks
      updateRipples(time); for (const w of waters) w.update(time); inst?.update(x, z, range);
      daylight?.update(followV.set(x, groundY(x, z), z));
    },
    dispose() { resources.forEach(r => r.dispose()); inst?.dispose(); },
  };
}
