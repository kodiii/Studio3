/* GLSL for Kelda Ridge. Colours arrive as uniforms from the night palette (palette.ts); the colour script (dusk →
   night → aurora) and the lights (aurora from the north sky, the walker's warm head-torch) are uniforms the scene
   damps every frame. One light direction: the sky light falls from the north and above, onto the ground and, in the
   DOM, onto the top edges of the caption panels. */

const NOISE = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}`;

export const terrainVert = /* glsl */ `
varying float vH;
varying float vDepth;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vH = position.y;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 mv = viewMatrix * world;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

export const terrainFrag = /* glsl */ `
uniform vec3 uBase, uLine, uIndex, uWater, uFog, uAurA, uGlow, uTorchCol;
uniform float uInterval, uFogNear, uFogFar, uWaterLevel, uAurLight, uDusk;
uniform vec3 uTorchPos, uTorchDir;
uniform float uTorch;
varying float vH;
varying float vDepth;
varying vec3 vWorld;
varying vec3 vNormal;
float isoline(float v, float width) {
  float f = abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 1e-4);
  return 1.0 - smoothstep(0.0, width, f);
}
void main() {
  vec3 n = normalize(vNormal);
  // Anti-aliased shoreline (one pixel of soft edge, whatever the mesh resolution).
  float fw = max(fwidth(vH), 1e-4);
  float water = 1.0 - smoothstep(uWaterLevel + 0.004 - fw, uWaterLevel + 0.004 + fw, vH);
  float land = 1.0 - water;
  // Sky light from the north and above: slopes that face it catch the aurora.
  float north = clamp(dot(n, normalize(vec3(0.0, 0.7, -1.0))), 0.0, 1.0);
  vec3 aurora = uAurA * uAurLight * north * north;
  // The head-torch: a cone from the walker's head toward the pointer's spot on the ground.
  vec3 L = vWorld - uTorchPos;
  float dist = max(length(L), 1e-3);
  float cone = smoothstep(0.95, 0.992, dot(L / dist, uTorchDir));
  float facing = clamp(dot(n, -L / dist), 0.0, 1.0);
  float torch = uTorch * cone * (0.3 + 0.7 * facing) / (1.0 + 0.0065 * dist * dist);

  float minor = isoline(vH / uInterval, 0.9) * land;
  float major = isoline(vH / (uInterval * 5.0), 1.5) * land;
  vec3 col = mix(uBase, uWater, water) + aurora * 0.06 * land;
  col = mix(col, uLine + aurora * 0.55, minor * 0.85);
  col = mix(col, uIndex + aurora * 0.4, major * 0.95);
  // The lake mirrors the sky: its hatch lines pick up the afterglow at dusk and the aurora at night.
  float hatch = isoline(vWorld.z * 1.4, 0.8) * water;
  vec3 sheen = mix(uLine, uGlow, uDusk * 0.4) + uAurA * uAurLight * 0.4;
  col = mix(col, sheen, hatch * 0.5);
  // Warm pool of torchlight: lifts the ground and makes the nearest contour lines glow.
  col += uTorchCol * torch * (0.2 + 1.6 * max(minor, major) + 0.5 * hatch);
  // Distance fog, plus a fade at the map's edge so the square tile dissolves into the far fells' silhouette.
  float edge = smoothstep(26.0, 31.8, max(abs(vWorld.x), abs(vWorld.z)));
  col = mix(col, uFog, max(smoothstep(uFogNear, uFogFar, vDepth), edge));
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
uniform vec3 uTop, uHorizon, uGlow, uAurA, uAurB, uAurC, uFloor;
uniform float uTime, uAur, uFlare, uDusk;
varying vec3 vDir;
${NOISE}

// One aurora curtain seen from below: a luminous ribbon hanging from a wandering lower edge. The ribbon folds; where it
// turns edge-on to the viewer it glows brighter (the fold factor), and fine vertical rays shimmer along it.
vec3 curtain(float az, float el, float base0, float seed, float t, float amp) {
  float w = az * 1.6 + seed;
  float f1 = 2.3, f2 = 4.6;
  float a1 = 0.3 * 0.6, a2 = 0.3 * 0.36;
  float p1 = w * f1 + t * 0.11, p2 = w * f2 - t * 0.17 + seed;
  float x = az + a1 * sin(p1) + a2 * sin(p2);
  // d(x)/d(az): where it crosses zero the ribbon turns edge-on and doubles back — a bright pleat.
  float dx = 1.0 + 1.6 * (a1 * f1 * cos(p1) + a2 * f2 * cos(p2));
  float edgeOn = clamp(0.42 / (abs(dx) + 0.12), 0.22, 2.6);
  float base = base0 + 0.055 * sin(x * 2.1 + seed * 3.0 + t * 0.07) + 0.032 * sin(x * 5.7 - seed + t * 0.1) + 0.045 * (noise(vec2(x * 3.2 + seed, t * 0.05)) - 0.5);
  float h = el - base;
  float rays = 0.6 * noise(vec2(x * 64.0 + seed * 13.0, t * 0.55)) + 0.4 * noise(vec2(x * 170.0 + seed, t * 1.05));
  rays = rays * rays * rays * 2.2;
  float rayTop = 0.14 + 0.3 * noise(vec2(x * 8.0 + seed * 2.0, t * 0.08));
  float lower = smoothstep(-0.008, 0.006, h);
  float body = 1.25 * exp(-max(h, 0.0) * 26.0) + 0.3 * exp(-max(h, 0.0) * 7.0);
  float upper = smoothstep(rayTop, 0.0, h) * (0.25 + rays);
  // Pleats brighten the whole height of the ribbon, the lower edge only a little (no hot spots where they cross).
  float strength = lower * (body * mix(1.0, edgeOn, 0.35) + 0.6 * upper * edgeOn);
  strength *= 0.25 + 1.0 * smoothstep(0.2, 0.8, noise(vec2(x * 1.4 + seed, t * 0.045)));
  vec3 c = mix(uAurA, uAurB, smoothstep(0.04, 0.34, h));
  c = mix(c, uAurC, smoothstep(1.4, 2.6, edgeOn) * (1.0 - smoothstep(0.0, 0.03, h)) * 0.35);
  return c * strength * amp;
}

void main() {
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(d.x, -d.z);
  vec3 col = mix(uHorizon, uTop, smoothstep(-0.03, 0.52, d.y));
  // Afterglow on the north-west horizon at dusk; it drains away as the night comes on.
  float glow = exp(-max(el, 0.0) * 5.5) * smoothstep(2.7, 0.15, abs(az + 0.6)) * step(-0.08, el);
  col = mix(col, uGlow, glow * uDusk * 0.85);
  // Aurora across the northern half of the sky: three curtains at different heights and distances.
  float north = smoothstep(2.35, 0.65, abs(az));
  float amount = uAur * (1.0 + 1.5 * uFlare);
  float t = uTime;
  vec3 aur = curtain(az, el, 0.19, 0.0, t, 1.0)
           + curtain(az * 1.18 + 0.7, el, 0.1, 4.1, t * 0.9, 0.55)
           + curtain(az * 0.82 - 0.5, el, 0.31, 8.3, t * 1.12, 0.4);
  // A broad glow under the curtains, so the sky itself brightens when they flare.
  aur += uAurA * 0.06 * exp(-abs(el - 0.2) * 5.0);
  aur *= north * amount;
  // Soft shoulder: a flare brightens the curtains without clipping them to white.
  col += aur / (1.0 + 0.55 * max(max(aur.r, aur.g), aur.b));
  // Below the horizon the dome is distant land: the far fells' colour.
  col = mix(uFloor, col, smoothstep(-0.02, 0.005, el));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export const starVert = /* glsl */ `
attribute float aSeed;
uniform float uTime, uSize, uDpr, uNight;
varying float vA;
void main() {
  // Stars come out as the night deepens: the brightest first, the faint ones at full dark.
  float threshold = 0.9 - 0.9 * uNight;
  float on = smoothstep(threshold, threshold + 0.08, aSeed);
  vA = on * (0.62 + 0.38 * sin(uTime * (0.5 + aSeed * 1.7) + aSeed * 40.0));
  gl_PointSize = uSize * uDpr * (0.5 + aSeed * 1.05);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const starFrag = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d) * vA;
  if (a < 0.03) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;
