/* GLSL for Kelda Ridge. Colours arrive as uniforms derived from the page's theme tokens. */

export const terrainVert = /* glsl */ `
varying float vH;
varying float vDepth;
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vH = position.y;
  vec4 mv = viewMatrix * world;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

export const terrainFrag = /* glsl */ `
uniform vec3 uBase, uLine, uIndex, uWater, uFog;
uniform float uInterval, uFogNear, uFogFar, uWaterLevel;
varying float vH;
varying float vDepth;
varying vec3 vWorld;
float isoline(float v, float width) {
  float f = abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 1e-4);
  return 1.0 - smoothstep(0.0, width, f);
}
void main() {
  float water = 1.0 - step(uWaterLevel + 0.004, vH);
  vec3 col = mix(uBase, uWater, water);
  float minor = isoline(vH / uInterval, 0.9) * (1.0 - water);
  float major = isoline(vH / (uInterval * 5.0), 1.5) * (1.0 - water);
  col = mix(col, uLine, minor * 0.7);
  col = mix(col, uIndex, major * 0.9);
  float hatch = isoline(vWorld.z * 1.4, 0.8) * water;
  col = mix(col, uLine, hatch * 0.45);
  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, vDepth));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const skyFrag = /* glsl */ `
uniform vec3 uTop, uHorizon, uAurA, uAurB;
uniform float uTime, uAur;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.0; a *= 0.5; }
  return v;
}
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(uHorizon, uTop, smoothstep(-0.04, 0.6, y));
  // Curtains of light toward the north (-z), between about 6 and 50 degrees of elevation.
  float az = atan(d.x, -d.z);
  float north = smoothstep(1.9, 0.4, abs(az));
  float drift = uTime * 0.05;
  float band = fbm(vec2(az * 2.6 + drift, drift * 0.6));
  float curtain = smoothstep(0.1, 0.24, y + band * 0.08) * (1.0 - smoothstep(0.32, 0.86, y + band * 0.12));
  float folds = 0.55 + 0.45 * sin(az * 22.0 + band * 7.0 + uTime * 0.3);
  float a = curtain * north * smoothstep(0.38, 0.72, band) * folds * uAur;
  vec3 aur = mix(uAurA, uAurB, smoothstep(0.16, 0.6, y));
  col = mix(col, aur, clamp(a, 0.0, 1.0) * 0.82);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export const starVert = /* glsl */ `
attribute float aSeed;
uniform float uTime, uSize, uDpr;
varying float vTwinkle;
void main() {
  vTwinkle = 0.6 + 0.4 * sin(uTime * (0.5 + aSeed * 1.6) + aSeed * 40.0);
  gl_PointSize = uSize * uDpr * (0.55 + aSeed * 0.9);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const starFrag = /* glsl */ `
uniform vec3 uColor;
varying float vTwinkle;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.12, d) * vTwinkle;
  if (a < 0.03) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;
