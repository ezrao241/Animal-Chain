// Real-size, rigged animals built in Blender (blender/scripts/animals/quadruped.py) and exported as skinned GLBs.
// Model contract: metres, +X forward, +Y up, named bones (root, spine, chest, neck, head, ear_L/R, upperarm/forearm/hand_L/R,
// thigh/shin/foot_L/R, tail_1..3), skin primitive with the baked coat texture (uv1) and fur length in COLOR_0 alpha.
// Fur: shell layers that share the skeleton, so the coat outline and the light through it read as fur from the follow
// camera. Motion: procedural walk / trot / rotary gallop from the game speed, plus idle, eat and pounce poses.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/examples/jsm/utils/SkeletonUtils.js';
import type {Species} from '@/lib/game';
import type {AnimalRig, Pose} from './animal-models';

// Game units are decimetres (10 = 1 m). Camera values are per species, sized to the real animal.
export type CameraProfile = {distance: number; min: number; max: number; head: number; lift: number; lookAhead: number; lookY: number; clearance: number; near: number; shadow: [number, number]};
type Source = {scene: THREE.Group; fur: number; shells: number; density: number; gait: Gait; size: number; profile: CameraProfile; rest: Map<string, {q: THREE.Quaternion; p: THREE.Vector3; wq: THREE.Quaternion; wqi: THREE.Quaternion}>};

type Gait = 'quad' | 'hop' | 'bound' | 'slither' | 'bird';
const SPECS: Partial<Record<Species, {file: string; fur: number; shells: number; density: number; gait: Gait; size: number; profile: CameraProfile}>> = {
  // red fox: 0.40 m at the shoulder, head carried ~0.47 m; camera ~2.7 m back, a little above head height
  fox: {file: 'fox.glb', fur: 0.07, shells: 16, density: 520, gait: 'quad', size: 1,
    profile: {distance: 27, min: 14, max: 70, head: 4.4, lift: 1.8, lookAhead: 7, lookY: 0.6, clearance: 2.6, near: 0.15, shadow: [8, 3.6]}},
  // European rabbit: crouched back ~0.2 m, moves in hops
  rabbit: {file: 'rabbit.glb', fur: 0.03, shells: 14, density: 700, gait: 'hop', size: 0.5,
    profile: {distance: 15, min: 8, max: 40, head: 1.9, lift: 1.0, lookAhead: 4, lookY: 0.3, clearance: 1.4, near: 0.08, shadow: [4.4, 2.4]}},
  // red squirrel: bounds on the ground, tail held over the back
  squirrel: {file: 'squirrel.glb', fur: 0.022, shells: 14, density: 800, gait: 'bound', size: 0.32,
    profile: {distance: 11, min: 6, max: 30, head: 1.0, lift: 0.7, lookAhead: 3, lookY: 0.2, clearance: 1.0, near: 0.05, shadow: [3.2, 1.5]}},
  // tawny owl: 0.33 m perched, 0.95 m wingspan; feathers are alpha-tested cards
  owl: {file: 'owl.glb', fur: 0.026, shells: 12, density: 600, gait: 'bird', size: 0.45,
    profile: {distance: 22, min: 10, max: 60, head: 3.0, lift: 1.6, lookAhead: 5, lookY: 0.5, clearance: 2.0, near: 0.1, shadow: [4, 4]}},
  // grass snake: 0.9 m, head ~2 cm off the ground; scaled skin, no fur
  snake: {file: 'snake.glb', fur: 0, shells: 0, density: 0, gait: 'slither', size: 0.3,
    profile: {distance: 9, min: 5, max: 26, head: 0.35, lift: 0.9, lookAhead: 2.5, lookY: 0.1, clearance: 0.6, near: 0.03, shadow: [2.6, 2.6]}},
  // wood mouse: 9 cm body; the camera sits at mouse scale, a hand's length behind
  mouse: {file: 'mouse.glb', fur: 0.007, shells: 12, density: 1100, gait: 'bound', size: 0.12,
    profile: {distance: 4.2, min: 2.5, max: 14, head: 0.32, lift: 0.3, lookAhead: 1.1, lookY: 0.05, clearance: 0.45, near: 0.03, shadow: [1.2, 0.55]}},
};
const SOURCES = new Map<Species, Source>();
// fur shells cost a draw each, so only animals near the camera's subject wear them (beyond, the coat texture reads the same)
const FOCUS = new THREE.Vector3(); let hasFocus = false;
export function setRealFocus(v: THREE.Vector3) { FOCUS.copy(v); hasFocus = true; }
const UP = new THREE.Vector3(0, 1, 0), SIDE = new THREE.Vector3(0, 0, 1);   // +Z = the animal's right side; +angle swings a limb forward

export async function preloadRealAnimals(base: string, list?: Species[]) {
  const loader = new GLTFLoader();
  await Promise.all((list || (Object.keys(SPECS) as Species[])).map(async species => {
    const spec = SPECS[species]; if (!spec) return;
    try {
      const gltf = await loader.loadAsync(base + spec.file); const scene = gltf.scene as THREE.Group;
      scene.updateMatrixWorld(true);
      const rest = new Map<string, any>();
      scene.traverse(o => { if ((o as THREE.Bone).isBone) { const wq = o.getWorldQuaternion(new THREE.Quaternion()); rest.set(o.name, {q: o.quaternion.clone(), p: o.position.clone(), wq, wqi: wq.clone().invert()}); } });
      scene.traverse(o => {
        const m = o as THREE.SkinnedMesh; if (!m.isMesh) return;
        const geo = m.geometry, col = geo.getAttribute('color');
        if (col && !geo.getAttribute('furLen')) { const f = new Float32Array(col.count); for (let i = 0; i < col.count; i++) f[i] = col.itemSize > 3 ? col.getW(i) : 0; geo.setAttribute('furLen', new THREE.BufferAttribute(f, 1)); }
      });
      // shared by every clone: the bare base layer is the fur root zone, shaded by the coat above it
      scene.traverse(o => { const m = o as THREE.Mesh; const mt = m.material as THREE.MeshStandardMaterial;
        if (m.isMesh && mt.name.includes('feather')) { mt.transparent = false; mt.alphaTest = 0.5; mt.side = THREE.DoubleSide; mt.depthWrite = true; if ((mt as any).sheen) (mt as any).sheen = 0; } });
      if (spec.shells > 0) scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).name.endsWith('_skin')) (m.material as THREE.MeshStandardMaterial).color.multiplyScalar(0.62); });
      // Blender exports a white sheen at full strength, which greys the coat at grazing angles: tint it with the coat itself
      scene.traverse(o => { const m = o as THREE.Mesh; const mt = m.material as THREE.MeshPhysicalMaterial;
        if (m.isMesh && mt.name.endsWith('_skin') && mt.sheen) { mt.sheen = 0.5; mt.sheenColorMap = mt.map; mt.sheenColor.setScalar(1); mt.needsUpdate = true; } });
      SOURCES.set(species, {scene, fur: spec.fur, shells: spec.shells, density: spec.density, gait: spec.gait, size: spec.size, profile: spec.profile, rest});
    } catch (e) { console.warn('real animal failed to load', species, e); }
  }));
}
export const hasReal = (s: Species) => SOURCES.has(s);
export const cameraProfile = (s: Species) => SOURCES.get(s)?.profile;

// ---------------------------------------------------------------- fur shells
const shellCache = new Map<string, THREE.MeshStandardMaterial[]>();
function shellMaterials(key: string, base: THREE.MeshStandardMaterial, n: number, fur: number, density: number) {
  let mats = shellCache.get(key); if (mats) return mats; mats = [];
  for (let i = 1; i <= n; i++) {
    const layer = i / n, m = new THREE.MeshStandardMaterial({map: base.map, roughness: 0.92, metalness: 0});
    m.onBeforeCompile = sh => {
      sh.uniforms.uLayer = {value: layer}; sh.uniforms.uFur = {value: fur}; sh.uniforms.uDensity = {value: density};
      sh.vertexShader = 'attribute float furLen;\nvarying float vFur;\nuniform float uLayer;\nuniform float uFur;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vFur = furLen;
        // strands leave the skin along the normal and lie back and down toward the tail and the ground as they lengthen
        transformed += (normal * uLayer + vec3(-0.55, -0.35, 0.0) * uLayer * uLayer * 0.7) * uFur * furLen;`);
      sh.fragmentShader = 'varying float vFur;\nuniform float uLayer;\nuniform float uDensity;\nfloat fh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        {
          if (vFur < 0.03) discard;
          vec2 g = vMapUv * uDensity; vec2 cell = floor(g); vec2 f = fract(g) - 0.5;
          float h = fh(cell), h2 = fh(cell + 17.31), len = mix(0.45, 1.0, h);
          float t = uLayer / len;
          float footprint = length(fwidth(g));
          if (footprint < 0.9) {
            vec2 off = (vec2(h2, fh(cell + 3.7)) - 0.5) * 0.45;
            if (t > 1.0 || length(f - off) > 0.48 * (1.0 - t)) discard;
          } else {
            // strands smaller than a pixel: keep the same coverage as a stochastic screen-space dither
            float cover = clamp((1.0 - uLayer / 1.0) * (1.0 - uLayer) * 0.9, 0.0, 1.0);
            if (fh(gl_FragCoord.xy + uLayer * 37.0) > cover) discard;
          }
          // roots are shaded by the coat above them; tips catch the light
          diffuseColor.rgb *= mix(0.42, 1.08, uLayer) * mix(0.88, 1.12, h2);
        }`);
    };
    m.customProgramCacheKey = () => 'fur-shell-' + layer.toFixed(3);
    mats.push(m);
  }
  shellCache.set(key, mats); return mats;
}

export function makeRealAnimal(species: Species): AnimalRig {
  const src = SOURCES.get(species)!;
  const model = cloneSkinned(src.scene) as THREE.Group; model.scale.setScalar(10);
  const root = new THREE.Group(); root.add(model); root.userData.real = true;
  const bones = new Map<string, THREE.Bone>();
  model.traverse(o => { if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone); });
  const skins: THREE.SkinnedMesh[] = [], shells: THREE.Object3D[] = [];
  model.traverse(o => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh) { m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; if ((m.material as THREE.Material).name.endsWith('_skin')) skins.push(m); } });
  for (const m of skins) {
    const base = m.material as THREE.MeshStandardMaterial;
    for (const mat of shellMaterials(species, base, src.shells, src.fur, src.density)) {
      const s = new THREE.SkinnedMesh(m.geometry, mat); s.bind(m.skeleton, m.bindMatrix); s.frustumCulled = false; s.castShadow = false; s.receiveShadow = true;
      m.parent!.add(s); shells.push(s);
    }
  }
  const g = () => new THREE.Group();
  const rig: AnimalRig = {root, body: g(), head: g(), legs: [], knees: [], ears: [], tail: g(), wings: [], segments: [], species, phase: Math.random(), stride: 0, altitude: 0, turn: 0, born: 0, lastX: 0, lastZ: 0};
  (rig as any).real = {bones, src, shells, gait: 0, pounce: -1, look: 0, lookT: 0, blend: {} as Record<string, number>};
  return rig;
}

// ---------------------------------------------------------------- motion
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), acc = new Map<string, THREE.Quaternion>();
function turn(name: string, axis: THREE.Vector3, angle: number) {
  if (!angle) return; let q = acc.get(name); if (!q) { q = new THREE.Quaternion(); acc.set(name, q); }
  q.premultiply(qa.setFromAxisAngle(axis, angle));
}
// limb phase offsets (fraction of a stride): lateral-sequence walk, diagonal trot, rotary gallop
const GAITS = {
  walk: {LH: 0, LF: 0.25, RH: 0.5, RF: 0.75, amp: 0.32, bob: 0.06, flex: 0.0},
  trot: {LH: 0.5, LF: 0, RH: 0, RF: 0.5, amp: 0.46, bob: 0.12, flex: 0.04},
  gallop: {LH: 0, LF: 0.55, RH: 0.1, RF: 0.45, amp: 0.72, bob: 0.3, flex: 0.16},
  // half-bound of small mammals: hind feet land together, forefeet just after one another
  bound: {LH: 0, LF: 0.5, RH: 0.04, RF: 0.58, amp: 0.8, bob: 0.35, flex: 0.28},
  // rabbit hop: both hind feet push off together, forefeet touch down in turn between hops
  hop: {LH: 0, LF: 0.55, RH: 0, RF: 0.65, amp: 0.9, bob: 0.5, flex: 0.3},
} as const;
type GaitName = keyof typeof GAITS;

export function animateReal(rig: AnimalRig, p: Pose) {
  const R = (rig as any).real, src: Source = R.src, bones: Map<string, THREE.Bone> = R.bones; acc.clear();
  // height above the ground: owls perch in the canopy and fly at ~7 m, squirrels run up trunks
  const climb = p.climbing ? 1 : 0, flyH = p.flying ? 68 : 0, hTarget = p.perched ? (p.altitude || 72) : flyH || climb * 26;
  rig.altitude = THREE.MathUtils.damp(rig.altitude, hTarget * (1 - Math.sin((p.dive || 0) * Math.PI) * 0.92), p.perched ? 5 : 7, p.dt);
  rig.root.position.y += rig.altitude;
  const near = !hasFocus || rig.root.position.distanceToSquared(FOCUS) < (60 + 160 * src.size) ** 2;
  for (const sh of R.shells as THREE.Object3D[]) sh.visible = near;
  if (src.gait === 'slither') { slither(rig, p, R, src, bones); return; }
  if (src.gait === 'bird') { bird(rig, p, R, src, bones); return; }
  const ms = p.speed / 10 / src.size;                        // body-lengths-normalised speed (fox-equivalent m/s)
  const target: Record<string, number> = src.gait === 'quad'
    ? {walk: ms < 2.2 ? 1 : 0, trot: ms >= 2.2 && ms < 5.5 ? 1 : 0, gallop: ms >= 5.5 ? 1 : 0}
    : src.gait === 'hop' ? {walk: 0, hop: 1} : {walk: ms < 1.6 ? 1 : 0, bound: ms >= 1.6 ? 1 : 0};
  for (const k of Object.keys(target)) R.blend[k] = (R.blend[k] ?? target[k]) + (target[k] - (R.blend[k] ?? target[k])) * (1 - Math.exp(-6 * p.dt));
  for (const k of Object.keys(R.blend)) if (!(k in target)) delete R.blend[k];
  const moving = THREE.MathUtils.smoothstep(ms, 0.08, 0.5);
  const strideM = ((R.blend.walk || 0) * 0.62 + (R.blend.trot || 0) * (0.9 + ms * 0.08) + (R.blend.gallop || 0) * (1.5 + ms * 0.16)
    + (R.blend.bound || 0) * (1.2 + ms * 0.14) + (R.blend.hop || 0) * (1.3 + ms * 0.2)) * src.size;
  rig.phase = (rig.phase + p.dt * Math.min(ms * src.size / Math.max(strideM, 1e-3), 4.2 / Math.sqrt(src.size))) % 1;
  const ph = rig.phase * Math.PI * 2;
  let bob = 0, spineFlex = 0;
  for (const [gname, w] of Object.entries(R.blend) as [GaitName, number][]) {
    if (!(gname in GAITS)) continue;
    if (w < 0.01) continue; const G = GAITS[gname], a = G.amp * w * moving;
    for (const leg of ['LF', 'RF', 'LH', 'RH'] as const) {
      const lp = ph - (G as any)[leg] * Math.PI * 2, s = Math.sin(lp), lift = Math.max(0, Math.cos(lp)), side = leg[0], fore = leg[1] === 'F';
      if (fore) {
        turn('upperarm_' + side, SIDE, a * s * 0.9);
        turn('forearm_' + side, SIDE, -a * lift * 1.5);
        turn('hand_' + side, SIDE, -a * lift * 1.3 + a * Math.max(0, -s) * 0.25);
      } else {
        turn('thigh_' + side, SIDE, a * s * 0.8);
        turn('shin_' + side, SIDE, -a * lift * 1.2);
        turn('foot_' + side, SIDE, a * lift * 0.9);
      }
    }
    bob += -G.bob * w * moving * (gname === 'walk' || gname === 'trot' ? Math.cos(ph * 2) : Math.cos(ph));
    spineFlex += G.flex * w * moving * Math.sin(ph);
  }
  // spine: gallop flexes and extends the back; the head stays level (a hunter's eyes are stabilised)
  turn('spine', SIDE, -spineFlex); turn('chest', SIDE, spineFlex * 0.6); turn('neck', SIDE, spineFlex * 0.3);
  turn('head', SIDE, bob * 0.15 - spineFlex * 0.3);
  // tail: droops at rest, streams out behind at speed, swings with the stride
  turn('tail_1', SIDE, src.gait === 'quad' ? 0.12 - 0.4 * (R.blend.gallop || 0) * moving - 0.15 * (R.blend.trot || 0) * moving : 0.1 * Math.sin(ph) * moving);
  turn('tail_1', UP, Math.sin(ph) * 0.12 * moving + Math.sin(p.time * 0.7) * 0.05 * (1 - moving));
  turn('tail_2', UP, Math.sin(ph - 0.8) * 0.1 * moving); turn('tail_3', UP, Math.sin(ph - 1.6) * 0.12 * moving + Math.sin(p.time * 1.1) * 0.06);
  // idle life: breathing, an occasional look around, ear flicks
  const idle = 1 - moving;
  turn('chest', SIDE, Math.sin(p.time * 2.1) * 0.012 * idle);
  if (p.time > R.lookT) { R.lookT = p.time + 2.5 + Math.random() * 4; R.lookTarget = (Math.random() - 0.5) * 1.1; }
  R.look += ((R.lookTarget || 0) * idle - R.look) * (1 - Math.exp(-3 * p.dt));
  turn('neck', UP, R.look * 0.55); turn('head', UP, R.look * 0.45);
  const flick = Math.max(0, Math.sin(p.time * 0.9) - 0.96) * 6;
  turn('ear_L', SIDE, flick * 0.3); turn('ear_R', UP, -Math.max(0, Math.sin(p.time * 0.67 + 2) - 0.96) * 4);
  // eating / sniffing: head to the ground
  if (p.action) { turn('neck', SIDE, -0.75); turn('head', SIDE, -0.45); turn('upperarm_L', SIDE, 0.12); turn('upperarm_R', SIDE, 0.12); }
  // pounce: the mousing leap, a high arc landing nose-first
  let lift = 0, pitch = 0;
  if (p.ability) { if (R.pounce < 0) R.pounce = p.time; } else R.pounce = -1;
  if (R.pounce >= 0) {
    const t = Math.min(1, (p.time - R.pounce) / 0.75);
    lift = Math.sin(t * Math.PI) * 0.8; pitch = Math.cos(t * Math.PI) * 0.55;
    turn('upperarm_L', SIDE, 0.6 * (1 - t) - 0.2); turn('upperarm_R', SIDE, 0.6 * (1 - t) - 0.2);
    turn('thigh_L', SIDE, -0.5 * Math.sin(t * Math.PI)); turn('thigh_R', SIDE, -0.5 * Math.sin(t * Math.PI));
    turn('tail_1', SIDE, -0.5 * Math.sin(t * Math.PI));
  }
  // write bone rotations: a model-space rotation Q at the bone's pivot = local rest * (W^-1 Q W)
  for (const [name, b] of bones) {
    const r = src.rest.get(name)!; b.quaternion.copy(r.q);
    const q = acc.get(name); if (q) b.quaternion.multiply(qb.copy(r.wqi).multiply(q).multiply(r.wq));
  }
  const root = bones.get('root');
  if (root) { const r = src.rest.get('root')!; root.position.copy(r.p); root.position.y += (bob * 0.15 + lift) * src.size; }
  // climbing: body turned nose-up against the trunk
  R.climb = THREE.MathUtils.damp(R.climb ?? 0, p.climbing ? 1 : 0, 8, p.dt);
  const model = rig.root.children[0]; model.rotation.z = pitch + R.climb * 1.45;
}

// lateral undulation: a bending wave runs from head to tail as fast as the snake moves forward, so each part of the
// body follows the path of the part ahead of it; at rest only the head moves (tongue-flicking, looking around)
function slither(rig: AnimalRig, p: Pose, R: any, src: Source, bones: Map<string, THREE.Bone>) {
  acc.clear();
  const ms = p.speed / 10, moving = THREE.MathUtils.smoothstep(ms, 0.03, 0.25), wavelength = 0.32;
  rig.phase = (rig.phase + p.dt * ms / wavelength) % 1;
  const ph = rig.phase * Math.PI * 2;
  for (let k = 0; k < 16; k++) {
    const name = 'seg_' + String(k).padStart(2, '0'), taper = Math.min(1, 0.35 + k * 0.12) * (k > 12 ? 1 - (k - 12) * 0.15 : 1);
    turn(name, UP, (Math.sin(ph - k * 0.95) * 0.42 * moving + Math.sin(p.time * 0.4 - k * 0.6) * 0.03 * (1 - moving)) * taper);
  }
  if (p.time > R.lookT) { R.lookT = p.time + 1.5 + Math.random() * 3; R.lookTarget = (Math.random() - 0.5) * 0.9; }
  R.look += ((R.lookTarget || 0) * (1 - moving) - R.look) * (1 - Math.exp(-3 * p.dt));
  turn('head', UP, R.look * 0.6 - Math.sin(ph) * 0.25 * moving);       // the head stays on course while the body waves
  turn('head', SIDE, p.action ? -0.25 : 0.04);
  for (const [name, b] of bones) {
    const r = src.rest.get(name)!; b.quaternion.copy(r.q);
    const q = acc.get(name); if (q) b.quaternion.multiply(qb.copy(r.wqi).multiply(q).multiply(r.wq));
  }
}

// owl: wings spread in the model; folded against the flanks when perched or on the ground (span swung back along the
// body, feathers hanging down), flapped in flight with the hand lagging the arm, body pitched level and legs tucked
const FWD = new THREE.Vector3(1, 0, 0);
function bird(rig: AnimalRig, p: Pose, R: any, src: Source, bones: Map<string, THREE.Bone>) {
  acc.clear();
  const fly = R.fly = THREE.MathUtils.damp(R.fly ?? 0, p.flying ? 1 : 0, 4, p.dt), fold = 1 - fly;
  const dive = p.dive || 0, ms = p.speed / 10;
  R.flap = (R.flap ?? 0) + p.dt * (2.6 + ms * 0.15) * Math.PI * 2;
  const glide = 0.5 + 0.5 * Math.sin(p.time * 0.5) > 0.75 ? 0.25 : 1;          // owls glide between bouts of flapping
  const a = Math.sin(R.flap) * 0.75 * fly * glide * (1 - dive);
  for (const [sfx, s] of [['L', 1], ['R', -1]] as const) {
    // folded: span back along the body (about up), then the wing plane turned vertical (about the forward axis)
    turn('wing_' + sfx, UP, s * Math.PI / 2 * Math.max(fold, dive * 0.6));
    turn('wing_' + sfx, FWD, s * (Math.PI / 2 * fold + a + 0.25 * dive));
    turn('wing2_' + sfx, FWD, s * Math.sin(R.flap - 0.6) * 0.3 * fly * glide);
    turn('wing3_' + sfx, FWD, s * Math.sin(R.flap - 1.2) * 0.35 * fly * glide);
    // a folded wing is far shorter than a spread one (the arm and hand fold in a Z): shrink the panel to the flank
    const b1 = bones.get('wing_' + sfx); if (b1) b1.scale.setScalar(1 - 0.38 * fold);
    turn('thigh_' + sfx, SIDE, -1.1 * fly + 1.2 * dive + (fold * Math.sin(p.time * 9 + (s > 0 ? 0 : Math.PI)) * 0.35 * THREE.MathUtils.smoothstep(ms, 0.1, 0.5)));
  }
  turn('tail_1', SIDE, fly * 0.9 - 0.2 * dive);
  // head: owls swivel the head far round while perched, and hold it level in flight
  if (p.time > R.lookT) { R.lookT = p.time + 1.2 + Math.random() * 3.5; R.lookTarget = (Math.random() - 0.5) * 2.6; }
  R.look += ((R.lookTarget || 0) * fold - R.look) * (1 - Math.exp(-5 * p.dt));
  turn('head', UP, R.look); turn('head', SIDE, fly * 1.0 + (p.action ? -0.5 : 0));
  for (const [name, b] of bones) {
    const r = src.rest.get(name)!; b.quaternion.copy(r.q);
    const q = acc.get(name); if (q) b.quaternion.multiply(qb.copy(r.wqi).multiply(q).multiply(r.wq));
  }
  // flight posture: the body tips forward to level about its middle
  const model = rig.root.children[0]; model.rotation.z = -1.15 * fly - 0.4 * dive; model.position.y = (1.6 * fly) + (Math.sin(R.flap) * 0.15 * fly);
}
