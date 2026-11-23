export const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0); // clip-space quad: ignores camera
}`;

export const fragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uBands, uGrain, uAspect;
uniform vec2 uPointer;
uniform vec3 uColorA, uColorB;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y) * uBands;
  vec2 warp = vec2(fbm(p + uTime * 0.6), fbm(p - uTime * 0.4 + 4.0));
  p += (warp - 0.5) * 1.6 + (uPointer - 0.5) * 0.6;
  float band = fbm(vec2(p.x * 0.6, p.y * 2.2 + uTime));
  float ridge = smoothstep(0.35, 0.75, band) * smoothstep(1.0, 0.2, vUv.y * 0.9);
  vec3 ink = vec3(0.045, 0.045, 0.04);
  vec3 col = mix(ink, uColorB, smoothstep(0.2, 0.9, band) * 0.55);
  col = mix(col, uColorA, ridge * 0.85);
  col += (hash(vUv * 1024.0 + uTime) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
