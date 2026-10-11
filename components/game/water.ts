// Runtime moving-water material for the stream surfaces exported from Blender (glTF can't carry animated materials).
// Mesh contract (blender/scripts, Water_* objects): uv.x = across the stream 0..1, uv.y = metres downstream
// (flow runs along +uv.y), COLOR_0 r = surface speed in m/s, g = pool weight, b = ford weight.
// Flow: two-phase flow-map advection (offsets reset half a period apart and cross-fade), so the ripples move
// downstream continuously without a visible conveyor-belt loop. Normals are analytic value-noise gradients stretched
// along the flow; speed varies per vertex (calm pools, quicker narrows). Shading: Fresnel sky/canopy reflection,
// restrained sun glint, depth-based tint/opacity so shallow edges and fords show the bed.
import * as THREE from 'three';
import {SUN_DIR} from './sky';

export type WaterHandle = {update(time: number): void; setSun?(d: THREE.Vector3): void; dispose(): void};

// Shared ripple ring buffer: every water material reads the same array (one uniform upload per frame).
export const RIPPLES: THREE.Vector4[] = Array.from({length: 32}, () => new THREE.Vector4(0, 0, -100, 0));
let rippleHead = 0;
export function addRipple(x: number, z: number, time: number, strength: number) {
  (globalThis as any).__ripples = ((globalThis as any).__ripples || 0) + 1; RIPPLES[rippleHead].set(x, z, time, Math.min(1, strength)); rippleHead = (rippleHead + 1) % RIPPLES.length;
}

const vert = /* glsl */`
#include <common>
#include <fog_pars_vertex>
attribute vec3 color;
varying vec2 vUv; varying vec3 vCol; varying vec3 vWorld; varying vec3 vFlowW;
void main(){
  vUv = uv; vCol = color;
  vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const frag = /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uCanopy;
uniform float uCanopyCover;
#define MAX_RIPPLES 32
uniform vec4 uRipples[MAX_RIPPLES];   // x, z (game units), start time (s), strength 0..1
varying vec2 vUv; varying vec3 vCol; varying vec3 vWorld;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// value noise with analytic derivative: returns (value, d/dx, d/dy)
vec3 vnoised(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f), du = 6.0*f*(1.0-f);
  float a = h21(i), b = h21(i+vec2(1,0)), c = h21(i+vec2(0,1)), d = h21(i+vec2(1,1));
  return vec3(a + (b-a)*u.x + (c-a)*u.y + (a-b-c+d)*u.x*u.y, du*(vec2(b-a, c-a) + (a-b-c+d)*u.yx));
}
// ripple height gradient in flow space (x across, y along flow), metres
vec2 ripples(vec2 p, float calm){
  vec2 g = vec2(0.0); float amp = 1.0, fr = 1.0;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int k = 0; k < 4; k++){
    vec2 q = p * fr * vec2(2.2, 1.1);          // stretched along the flow
    g += vnoised(q).yz * amp * fr * vec2(2.2, 1.1);
    p = rot * p + 3.1; amp *= 0.5; fr *= 2.03;
  }
  return g * mix(0.020, 0.006, calm);
}
void main(){
  float speed = vCol.r, pool = vCol.g, ford = vCol.b;
  // flow frame from the UV gradients: B = +v direction (downstream), T = across
  vec3 dpx = dFdx(vWorld), dpy = dFdy(vWorld); vec2 dux = dFdx(vUv), duy = dFdy(vUv);
  vec3 T = normalize(dpx * duy.y - dpy * dux.y); vec3 B = normalize(dpy * dux.x - dpx * duy.x);
  float widthM = length(dpx * duy.y - dpy * dux.y) / max(abs(dux.x*duy.y - dux.y*duy.x), 1e-6) * 0.1;  // game units -> m
  vec2 p = vec2(vUv.x * widthM, vUv.y);       // metres across, metres downstream
  float period = 2.4;
  float t0 = fract(uTime / period), t1 = fract(uTime / period + 0.5);
  float w0 = 1.0 - abs(1.0 - 2.0 * t0);
  vec2 off0 = vec2(0.0, -(t0 - 0.5) * period * speed), off1 = vec2(0.0, -(t1 - 0.5) * period * speed);
  float calm = clamp(pool * 1.2, 0.0, 1.0);
  vec2 g = ripples(p * 2.6 + off0 * 2.6, calm) * w0 + ripples(p * 2.6 + off1 * 2.6 + vec2(17.3, 5.1), calm) * (1.0 - w0);
  // extra fine chop where the water runs fast or shoals over the ford
  g += ripples(p * 7.0 + vec2(0.0, -uTime * speed * 7.0 * 0.5), 0.0) * (0.25 + 0.6 * ford) * smoothstep(0.08, 0.35, speed);
  // contact ripples: expanding capillary rings from where animals step or wade (world-space gradient, game units)
  vec2 rg = vec2(0.0); float foam = 0.0, ring = 0.0;
  for (int i = 0; i < MAX_RIPPLES; i++){
    vec4 r = uRipples[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 3.0) continue;
    vec2 d = vWorld.xz - r.xy; float dist = length(d) + 1e-3;
    float front = age * 3.2 + 0.6;                       // rings spread ~0.32 m/s (game units: 3.2/s)
    float env = exp(-pow((dist - front) / (1.0 + age * 1.6), 2.0)) * exp(-age * 1.1) * r.w;
    // a short train of rings ~15 cm apart: large enough to resolve from the follow camera, a few cm high at most
    float wave = sin((dist - front) * 4.2);
    rg += d / dist * wave * env * 1.8; ring += wave * env;
    foam += exp(-dist * dist / 6.0) * exp(-age * 5.0) * r.w;   // brief disturbed patch at the contact point
  }
  vec3 N = normalize(vec3(0.0, 1.0, 0.0) - (T * g.x + B * g.y) * 6.0 - vec3(rg.x, 0.0, rg.y));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  float up = clamp(R.y, 0.0, 1.0);
  vec3 sky = mix(uHorizon, uZenith, pow(up, 0.6));
  // reflected canopy: mostly leaves near the horizon, sky gaps overhead
  float n = vnoised(R.xz / max(R.y, 0.15) * 3.0).x;
  float cover = clamp(uCanopyCover + (1.0 - up) * 0.5 + (n - 0.5) * 0.5, 0.0, 1.0);
  vec3 refl = mix(sky, uCanopy, cover);
  float glint = pow(max(dot(R, uSunDir), 0.0), 900.0) * 6.0 * (1.0 - cover * 0.8);
  // body colour and opacity: deeper water darker and more opaque; edges, fords and shallows see the bed
  float edge = 1.0 - abs(vUv.x * 2.0 - 1.0);
  float depth = clamp(edge * (0.5 + 0.9 * pool) * (1.0 - 0.75 * ford), 0.0, 1.0);
  vec3 body = mix(vec3(0.090, 0.085, 0.060), vec3(0.018, 0.028, 0.022), depth);
  float alpha = mix(0.18, 0.88, smoothstep(0.0, 0.9, depth));
  vec3 col = body * (1.0 - fres) + refl * fres + uSunCol * glint;
  // ring crests catch the bright sky gaps and troughs mirror the dark canopy: on a shallow ford seen from above the
  // flat-water fresnel is only a few percent, so the rings are what make a disturbed surface read at all
  float ra = clamp(abs(ring), 0.0, 1.0);
  col = mix(col, ring > 0.0 ? mix(sky, uSunCol, 0.35) : uCanopy * 0.7, ra * 0.55);
  alpha = max(alpha, ra * 0.75);
  col = mix(col, vec3(0.16, 0.15, 0.12), clamp(foam, 0.0, 1.0) * 0.35);   // stirred silt where the foot lands
  alpha = mix(alpha, 0.9, clamp(foam, 0.0, 1.0) * 0.5);
  alpha = clamp(alpha + fres * 0.6 + glint, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function createWater(mesh: THREE.Mesh, env: {sun: THREE.Vector3}): WaterHandle {
  const geo = mesh.geometry as THREE.BufferGeometry;
  if (!geo.getAttribute('color')) {  // no flow data: still water at 0.1 m/s
    const n = geo.getAttribute('position').count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c[i * 3] = 0.1;
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: {value: 0}, uSunDir: {value: env.sun.clone()}, uSunCol: {value: new THREE.Color(1.0, 0.9, 0.75)},
      uZenith: {value: new THREE.Color(0.30, 0.45, 0.75)}, uHorizon: {value: new THREE.Color(0.72, 0.80, 0.88)},
      uCanopy: {value: new THREE.Color(0.05, 0.075, 0.035)}, uCanopyCover: {value: 0.45},
      uRipples: {value: RIPPLES},
    }]),
  });
  // UniformsUtils.merge clones every value, so point the uniform back at the shared ring buffer addRipple() writes
  mat.uniforms.uRipples.value = RIPPLES;
  ((globalThis as any).__waterMats ||= []).push(mat); (globalThis as any).__addRipple = addRipple;
  const old = mesh.material as THREE.Material; mesh.material = mat; old.dispose?.();
  mesh.renderOrder = 2; mesh.castShadow = false; mesh.receiveShadow = false;
  return {update(time: number) { mat.uniforms.uTime.value = time; }, setSun(d: THREE.Vector3) { mat.uniforms.uSunDir.value.copy(d); }, dispose() { mat.dispose(); }};
}
