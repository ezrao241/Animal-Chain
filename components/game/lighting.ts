// Daylight for the forest: a real photographed summer-woodland HDRI (Poly Haven "epping_forest_01", CC0) supplies the
// sky, the distant tree line and all indirect light; the scene's DirectionalLight is turned into the sun of that same
// photo (direction found from the HDRI's brightest pixel), warm and strong enough to throw leaf-dappled shadows.
import * as THREE from 'three';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';

export type Daylight = {sunDir: THREE.Vector3; update(follow: THREE.Vector3): void; dispose(): void};

function brightestDirection(tex: THREE.DataTexture) {
  const {data, width, height} = tex.image as {data: Float32Array; width: number; height: number};
  let best = -1, bi = 0;
  for (let i = 0; i < width * height; i++) {
    const l = data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722;
    if (l > best) { best = l; bi = i; }
  }
  const x = bi % width, y = Math.floor(bi / width);
  // three.js equirect lookup: u = atan(z, x) / 2pi + 0.5; RGBELoader rows run top (zenith) to bottom (nadir)
  const ang = ((x + 0.5) / width - 0.5) * Math.PI * 2, lat = (0.5 - (y + 0.5) / height) * Math.PI;
  return new THREE.Vector3(Math.cos(ang) * Math.cos(lat), Math.sin(lat), Math.sin(ang) * Math.cos(lat)).normalize();
}

export async function loadDaylight(scene: THREE.Scene, renderer: THREE.WebGLRenderer | null, url: string): Promise<Daylight> {
  const tex = await new RGBELoader().setDataType(THREE.FloatType).loadAsync(url);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const sunDir = brightestDirection(tex);
  scene.environment = tex; scene.background = tex;
  (scene as any).environmentIntensity = 0.6; (scene as any).backgroundIntensity = 1.0;
  // aerial perspective: squared-exponential haze toward the photo's shaded olive-grey woodland. Unlike linear fog it
  // leaves trees at 30-50 m with their own shading (no flat paper-cutout silhouettes) and still hides the draw range.
  scene.fog = new THREE.FogExp2(0x627062, 0.0016);
  let sun: THREE.DirectionalLight | null = null; const fills: THREE.Light[] = [];
  scene.traverse(o => {
    if ((o as THREE.DirectionalLight).isDirectionalLight && (o as THREE.DirectionalLight).castShadow && !sun) sun = o as THREE.DirectionalLight;
    else if ((o as THREE.Light).isLight) fills.push(o as THREE.Light);
  });
  for (const f of fills) f.intensity *= 0.25;          // the HDRI now does the sky fill
  if (sun) {
    const s = sun as THREE.DirectionalLight;
    s.color.set(0xffeccc); s.intensity = 7.0;
    // (shadow map size is fixed once three has allocated it; WorldScene sets it)
    Object.assign(s.shadow.camera, {left: -650, right: 650, top: 650, bottom: -650, near: 10, far: 2600});
    s.shadow.bias = -0.0002; s.shadow.normalBias = 0.6; s.shadow.radius = 2; s.shadow.camera.updateProjectionMatrix();
  }
  if (renderer) { renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.05; }
  return {
    sunDir,
    update(follow: THREE.Vector3) {
      if (!sun) return;
      const s = sun as THREE.DirectionalLight;
      s.target.position.copy(follow); s.position.copy(follow).addScaledVector(sunDir, 1200);
      s.target.updateMatrixWorld();
    },
    dispose() { tex.dispose(); },
  };
}
