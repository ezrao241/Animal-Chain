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
