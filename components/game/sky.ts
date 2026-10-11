// Image-based light for the forest: an HDR equirectangular environment generated in code (no HDRI download is
// possible from this environment). Sky gradient + sun + a broken leaf canopy overhead + dark forest floor below.
// three.js converts an equirect scene.environment to PMREM automatically.
import * as THREE from 'three';

// matches WorldScene's sun: positioned at follow + (-300, 620, -350)
export const SUN_DIR = new THREE.Vector3(-300, 620, -350).normalize();

function hash(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x: number, y: number) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}

export function createSkyEnvironment(scene: THREE.Scene) {
  const w = 512, h = 256, data = new Float32Array(w * h * 4);
  const sun = SUN_DIR;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // three.js equirect convention (flipY false): row 0 = straight down, u = atan(z, x) / 2pi + 0.5
    const lat = ((y + 0.5) / h - 0.5) * Math.PI, ang = ((x + 0.5) / w - 0.5) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(ang) * Math.cos(lat), Math.sin(lat), Math.sin(ang) * Math.cos(lat));
    const phi = ang + Math.PI, th = Math.PI / 2 - lat;
    const up = dir.y, k = (y * w + x) * 4;
    let r: number, g: number, b: number;
    if (up > 0) {
      const t = Math.pow(1 - up, 3);
      r = 0.30 + 0.45 * t; g = 0.45 + 0.42 * t; b = 0.75 + 0.2 * t;      // zenith blue to pale horizon
      const sd = Math.max(0, dir.dot(sun));
      const glow = Math.pow(sd, 8) * 2.5 + Math.pow(sd, 900) * 40;       // aureole + soft disc (the direct sun is the scene DirectionalLight)
      r += glow; g += glow * 0.92; b += glow * 0.78;
      // canopy: leaf cover thickens towards the horizon (trunks and crowns), with gaps overhead
      const n = vnoise(phi * 9, th * 14) * 0.6 + vnoise(phi * 31, th * 47) * 0.4;
      const cover = THREE.MathUtils.smoothstep(n + (1 - up) * 0.55, 0.62, 0.78);
      const leaf = [0.06, 0.09, 0.04];
      const lit = Math.pow(Math.max(0, dir.dot(sun)), 2) * 0.25;         // translucent leaves near the sun
      r = r * (1 - cover) + (leaf[0] + lit * 0.5) * cover; g = g * (1 - cover) + (leaf[1] + lit * 0.9) * cover; b = b * (1 - cover) + (leaf[2] + lit * 0.2) * cover;
    } else {
      const t = Math.min(1, -up * 4);
      r = 0.10 - 0.04 * t; g = 0.10 - 0.04 * t; b = 0.06 - 0.03 * t;      // leaf litter and soil
    }
    data[k] = r; data[k + 1] = g; data[k + 2] = b; data[k + 3] = 1;
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.flipY = false; tex.needsUpdate = true;
  scene.environment = tex;
  (scene as any).environmentIntensity = 1.0;
  return {texture: tex, sun, dispose() { tex.dispose(); }};
}
