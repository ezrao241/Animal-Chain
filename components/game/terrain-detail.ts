// Close-range ground detail. The Blender terrain bake is 4K over an 80 m tile (about 2 cm a texel), which turns soft
// within a few metres of a life-size animal's camera. A tiled photo-scanned leaf-litter set (Poly Haven
// forest_leaves_03, CC0) adds the missing high frequency: its luminance (relative to its mean) modulates the baked colour,
// so mud stays mud and moss stays moss, and its normal map adds leaf relief. Both fade out with distance, where the bake
// alone is already sharp, and a second rotated sample breaks up the tiling.
import * as THREE from 'three';

const MEAN_LUM = 0.0477;          // mean linear luminance of forest_leaves_03_diff (measured in Python)
const TILE_M = 2.3;               // the scan covers 2.3 m, the same scale the Blender bake used

export function addTerrainDetail(mat: THREE.MeshStandardMaterial, base: string) {
  const tl = new THREE.TextureLoader();
  const diff = tl.load(base + 'detail/forest_leaves_03_diff_2k.jpg'), nor = tl.load(base + 'detail/forest_leaves_03_nor_gl_2k.jpg');
  diff.colorSpace = THREE.SRGBColorSpace;
  for (const t of [diff, nor]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, {uDetail: {value: diff}, uDetailN: {value: nor}, uDScale: {value: 1 / (TILE_M * 10)}, uMeanLum: {value: MEAN_LUM}});
    sh.vertexShader = 'varying vec3 vWorldD;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWorldD = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWorldD;\nuniform sampler2D uDetail;\nuniform sampler2D uDetailN;\nuniform float uDScale;\nuniform float uMeanLum;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        float dFade = 1.0 - smoothstep(60.0, 260.0, length(vWorldD - cameraPosition));
        vec2 dUv = vWorldD.xz * uDScale, dUv2 = mat2(0.8, -0.6, 0.6, 0.8) * dUv * 0.43 + 0.37;
        vec3 dA = texture2D(uDetail, dUv).rgb, dB = texture2D(uDetail, dUv2).rgb;
        float dPick = smoothstep(0.35, 0.65, texture2D(uDetail, dUv * 0.071).g / max(uMeanLum * 1.6, 1e-3) * 0.5);
        float dLum = dot(mix(dA, dB, dPick), vec3(0.2126, 0.7152, 0.0722)) / uMeanLum;
        diffuseColor.rgb *= mix(1.0, clamp(dLum, 0.2, 2.4), 0.8 * dFade);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 dN = mix(texture2D(uDetailN, dUv).xyz, texture2D(uDetailN, dUv2).xyz, dPick) * 2.0 - 1.0;
        normal = normalize(normal + (viewMatrix * vec4(dN.x, 0.0, dN.y, 0.0)).xyz * 0.85 * dFade);`);
  };
  mat.customProgramCacheKey = () => 'terrain-detail';
  mat.needsUpdate = true;
}

// The base terrain (everything outside the finished Blender tiles) gets the same photo-scanned ground: forest_leaves_03
// litter on the forest floor, mud_forest on the trails (blended by the vertex attribute `trail`), a slow macro
// variation so the tiling does not read, and the litter normal map for relief. Vertex colour is a gentle tint.
export function addBaseGround(mat: THREE.MeshStandardMaterial, base: string) {
  const tl = new THREE.TextureLoader();
  const lit = tl.load(base + 'detail/forest_leaves_03_diff_2k.jpg'), mud = tl.load(base + 'detail/mud_forest_diff_2k.jpg'), nor = tl.load(base + 'detail/forest_leaves_03_nor_gl_2k.jpg');
  lit.colorSpace = mud.colorSpace = THREE.SRGBColorSpace;
  for (const t of [lit, mud, nor]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, {uLit: {value: lit}, uMud: {value: mud}, uNor: {value: nor}, uDScale: {value: 1 / (TILE_M * 10)}});
    sh.vertexShader = 'attribute float trail;\nvarying float vTrail;\nvarying vec3 vWorldD;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWorldD = (modelMatrix * vec4(transformed, 1.0)).xyz; vTrail = trail;');
    sh.fragmentShader = 'varying vec3 vWorldD;\nvarying float vTrail;\nuniform sampler2D uLit;\nuniform sampler2D uMud;\nuniform sampler2D uNor;\nuniform float uDScale;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `
        vec2 gUv = vWorldD.xz * uDScale, gUv2 = mat2(0.8, -0.6, 0.6, 0.8) * gUv * 0.43 + 0.37;
        float gPick = smoothstep(0.3, 0.7, texture2D(uLit, gUv * 0.031).g * 6.0);
        vec3 gLit = mix(texture2D(uLit, gUv).rgb, texture2D(uLit, gUv2).rgb, gPick);
        vec3 gMud = texture2D(uMud, vWorldD.xz / 235.0).rgb;
        float gMacro = 0.82 + 0.36 * texture2D(uLit, vWorldD.xz / 2900.0).g / 0.25;
        diffuseColor.rgb *= mix(gLit, gMud, smoothstep(0.15, 0.85, vTrail)) * clamp(gMacro, 0.75, 1.25);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 gN = mix(texture2D(uNor, gUv).xyz, texture2D(uNor, gUv2).xyz, gPick) * 2.0 - 1.0;
        float gFade = 1.0 - smoothstep(80.0, 400.0, length(vWorldD - cameraPosition));
        normal = normalize(normal + (viewMatrix * vec4(gN.x, 0.0, gN.y, 0.0)).xyz * 0.8 * gFade * (1.0 - vTrail * 0.6));`);
  };
  mat.customProgramCacheKey = () => 'base-ground';
  mat.needsUpdate = true;
}
