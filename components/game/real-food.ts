// Life-size natural food from Blender (blender/scripts/food/build_food.py): a blackberry bramble, acorns and hazelnuts,
// a grazing patch, a rotting log with beetles and a pheasant's ground nest. Replaces the prototype spheres and rings.
// GLBs are in metres; clones share geometry and materials.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

const KINDS = ['berries', 'seeds', 'grass', 'insects', 'eggs'];
const SOURCES = new Map<string, THREE.Object3D>();
// "Instinct" cue: a faint warm haze on the ground where food your species eats lies (the game shows it when instinct
// is on and the food is near). Real food is small at life size, so this stands in for the animal's sense of smell.
let scent: THREE.Mesh | null = null;
function scentCue() {
  if (!scent) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,236,190,0.55)'); r.addColorStop(0.5, 'rgba(255,226,170,0.18)'); r.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    scent = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6}));
    scent.rotation.x = -Math.PI / 2; scent.position.y = 0.3; scent.name = 'food-ring'; scent.renderOrder = 3;
  }
  return scent.clone();
}

export async function preloadRealFood(base: string) {
  const loader = new GLTFLoader();
  await Promise.all(KINDS.map(async k => {
    try {
      const g = await loader.loadAsync(base + k + '.glb');
      g.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true;
        for (const mt of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) if (mt.map) mt.map.anisotropy = 8; } });
      SOURCES.set(k, g.scene);
    } catch (e) { console.warn('food model failed', k, e); }
  }));
}
export const hasRealFood = (kind: string) => SOURCES.has(kind);
export function makeRealFood(kind: string, id: number) {
  const g = new THREE.Group(), m = SOURCES.get(kind)!.clone();
  m.scale.setScalar(10); m.rotation.y = (id * 2.399963) % (Math.PI * 2);
  g.add(m, scentCue()); g.userData.real = true; return g;
}
