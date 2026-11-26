/**
 * Liquid glass over a page texture, in one full-frame pass.
 *
 * The lens is a signed distance field (a rounded box whose corners are superellipse arcs: pill, circle and squircle
 * are parameter sets of the same function). Inside it, the distance to the edge drives a convex bezel profile: the top
 * is flat in the middle and curves down to the rim, so its normal is vertical at the centre and tips outward at the
 * edge. The view ray is refracted through that surface and through the flat underside (Snell, per wavelength), so the
 * centre shows the page untouched and the rim gathers and splits it into colour. Fresnel mixes in a studio reflection,
 * a Blinn–Phong highlight answers the one scene light, and the glass casts a light shadow with a caustic away from it.
 * Coordinates are drawing-buffer pixels with the origin at the bottom left (gl_FragCoord).
 */
export const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0); // clip-space quad
}`;

export const fragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uPage;
uniform vec2 uRes;        // drawing buffer size (px)
uniform float uDpr;       // drawing-buffer px per CSS px
uniform vec2 uCenter;     // lens centre (px)
uniform vec4 uShape;      // half width, half height, corner radius (px), corner exponent
uniform vec3 uStretch;    // unit direction, amount (> 0 stretch along it, < 0 squash)
uniform vec3 uLight;      // unit vector toward the light (x right, y up, z toward the viewer)
uniform float uLift;      // height of the glass above the page (px)
uniform float uRefract;   // 0 … 1.5
uniform float uDisperse;  // 0 … 1
uniform float uFrost;     // 0 … 1
uniform float uMaxLod;
uniform vec3 uEnvLo;      // studio reflection at grazing angles (the walls)
uniform vec3 uEnvHi;      // … and straight up (the ceiling); the light adds its own lobe
uniform vec3 uLightColor;
uniform vec3 uShadowColor;
uniform float uShadow;    // shadow density on this page colour
uniform float uCaustic;   // focused light inside the shadow
uniform float uDark;

varying vec2 vUv;

#ifndef SAMPLES
#define SAMPLES 8
#endif

float lpLength(vec2 v, float n) {
  v = abs(v);
  float m = max(v.x, v.y);
  if (m <= 0.0) return 0.0;
  v /= m;
  return m * pow(pow(v.x, n) + pow(v.y, n), 1.0 / n);
}

// Rounded box with superellipse corners; exact for the pill and circle (n = 2), close for the squircle.
float sdLens(vec2 p) {
  vec2 b = uShape.xy;
  float r = min(uShape.z, min(b.x, b.y));
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + lpLength(max(q, 0.0), uShape.w) - r;
}

// Squash and stretch along the motion, area-preserving: evaluate the field in the un-stretched frame.
vec2 lensSpace(vec2 frag, vec2 centre) {
  vec2 p = frag - centre;
  float s = 1.0 + uStretch.z;
  float a = dot(p, uStretch.xy);
  return uStretch.xy * (a / s) + (p - uStretch.xy * a) * s;
}

// x: Euclidean-corrected signed distance (px), yz: outward unit normal of the outline.
vec3 field(vec2 frag) {
  float d = sdLens(lensSpace(frag, uCenter));
  const float e = 0.75;
  vec2 g = vec2(
    sdLens(lensSpace(frag + vec2(e, 0.0), uCenter)) - sdLens(lensSpace(frag - vec2(e, 0.0), uCenter)),
    sdLens(lensSpace(frag + vec2(0.0, e), uCenter)) - sdLens(lensSpace(frag - vec2(0.0, e), uCenter))
  ) / (2.0 * e);
  float gl = max(length(g), 1e-4);
  return vec3(d / gl, g / gl);
}

vec3 page(vec2 px, float lod) {
  return textureLod(uPage, clamp(px / uRes, vec2(0.0), vec2(1.0)), lod).rgb;
}

// Smooth spectral weights from the red end (c = 0) to the blue end (c = 1); normalised per channel later.
vec3 spectrum(float c) {
  return clamp(vec3(1.4 - abs(c - 0.12) * 3.2, 1.0 - abs(c - 0.5) * 2.6, 1.4 - abs(c - 0.88) * 3.2), 0.0, 1.0);
}

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

// Shadow of the glass on the page, cast away from the light. Light through the flat middle goes straight down, so
// only a band under the bezel darkens (its light was bent inward) and a caustic ring forms where that light lands;
// a wide, faint occlusion grows with the lift. Returns (darkening, caustic).
vec2 shadowAt(vec2 px, float rim) {
  vec2 off = -uLight.xy / max(uLight.z, 0.3) * uLift;
  float ds = sdLens(lensSpace(px, uCenter + off));
  float soft = 1.5 * uDpr + uLift * 0.45;
  float foot = 1.0 - smoothstep(-soft, soft * 1.5, ds);
  float band = smoothstep(-rim * 0.95, -rim * 0.05, ds);
  // Occlusion only around the footprint: glass transmits, so the page under it is not occluded.
  float wide = (1.0 - smoothstep(-rim * 0.5, rim * 0.7 + uLift * 2.4, ds)) * smoothstep(-rim * 0.45, rim * 0.15, ds) * 0.3;
  float dark = max(foot * band * 0.9, wide) * uShadow;
  float ring = foot * exp(-pow((ds + rim * 0.68) / (rim * 0.12 + uDpr), 2.0)) * uCaustic;  // irradiance gain
  return vec2(dark, ring);
}

// Light added like a screen: it brightens toward white but never clips, and leaves the page itself untouched.
vec3 addLight(vec3 c, vec3 light) { return 1.0 - (1.0 - c) * exp(-light); }

// Shadow and caustic change the light falling on the page, so both scale its colour (black ink stays black).
vec3 shadePage(vec3 c, vec2 px, float rim) {
  vec2 s = shadowAt(px, rim);
  return c * mix(vec3(1.0), uShadowColor, s.x) * (1.0 + uLightColor * s.y);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float rim = 0.46 * min(uShape.x, uShape.y);
  vec3 base = page(frag, 0.0);

  // Far from the lens and its shadow: just the page.
  float reach = max(uShape.x, uShape.y) * (1.0 + abs(uStretch.z)) + uLift * 3.5 + rim + 8.0 * uDpr;
  vec2 rel = frag - uCenter;
  if (dot(rel, rel) > reach * reach) {
    gl_FragColor = vec4(base, 1.0);
    #include <colorspace_fragment>
    return;
  }

  vec3 f = field(frag);
  float d = f.x;
  vec2 g = f.yz;
  vec3 outside = shadePage(base, frag, rim);
  if (d > 1.5) {
    gl_FragColor = vec4(outside, 1.0);
    #include <colorspace_fragment>
    return;
  }

  // Bezel profile: h(u) = (1 - (1 - u)^p)^(1/p), u = 0 at the rim, 1 where the flat top begins.
  float t = max(-d, 0.0);
  float u = clamp(t / rim, 0.0, 1.0);
  const float P = 2.6;
  float k = 1.0 - u;
  float h = pow(max(1.0 - pow(k, P), 1e-4), 1.0 / P);
  float rimH = rim * 0.85;
  float slope = min(pow(k, P - 1.0) * pow(h, 1.0 - P) * (rimH / rim), 14.0);
  vec3 N = normalize(vec3(g * slope, 1.0));
  vec3 I = vec3(0.0, 0.0, -1.0);
  float thick = rimH * (0.4 + h);           // flat slab under a domed bezel
  float gap = uLift;

  float ior = 1.0 + 0.5 * uRefract;
  float blurR = uFrost * 13.0 * uDpr;
  float lod = clamp(log2(1.0 + blurR * 0.45) + 0.9 * (1.0 - u) * smoothstep(1.0, 8.0, slope), 0.0, uMaxLod);
  float rot = 6.2831853 * ign(frag);

  vec3 acc = vec3(0.0);
  vec3 wsum = vec3(0.0);
  vec2 offG = vec2(0.0);
  for (int i = 0; i < SAMPLES; i++) {
    float fi = float(i);
    float c = fract((fi + 0.5) * 0.6180339887);             // wavelength, decorrelated from the frost tap
    float iorC = 1.0 + (ior - 1.0) * (1.0 + uDisperse * 0.62 * (c - 0.5));
    vec3 r1 = refract(I, N, 1.0 / iorC);
    vec2 off = r1.xy / max(-r1.z, 0.2) * thick;
    vec3 r2 = refract(r1, vec3(0.0, 0.0, 1.0), iorC);        // out through the flat underside
    off += dot(r2, r2) > 0.0 ? r2.xy / max(-r2.z, 0.2) * gap : r1.xy * gap * 3.0;
    float a = fi * 2.3999632 + rot;
    vec2 tap = vec2(cos(a), sin(a)) * sqrt((fi + 0.5) / float(SAMPLES)) * blurR;
    vec3 w = spectrum(c);
    acc += page(frag + off + tap, lod) * w;
    wsum += w;
    offG += off;
  }
  vec3 seen = acc / max(wsum, vec3(1e-4));
  offG /= float(SAMPLES);
  // The page seen through the glass carries the glass's own shadow and caustic.
  vec2 sh = shadowAt(frag + offG, rim);
  seen *= mix(vec3(1.0), uShadowColor, sh.x * 0.85) * (1.0 + uLightColor * sh.y);

  // Absorption: a faint cool tint, a touch stronger along the slanted paths through the bezel.
  seen *= exp(-vec3(0.05, 0.016, 0.01) * (thick / max(rimH, 1.0)) * (0.35 + 0.65 * (1.0 - u)));
  // Frost scatters a little light back toward the viewer.
  seen = mix(seen, uEnvHi * mix(0.92, 0.35, uDark), uFrost * 0.09);

  // Fresnel reflection of a soft studio: the bright room above at normal incidence, darker walls at grazing angles,
  // brighter again toward the light.
  vec3 V = vec3(0.0, 0.0, 1.0);
  float cosI = clamp(N.z, 0.0, 1.0);
  float F = 0.04 + 0.96 * pow(1.0 - cosI, 5.0);
  vec3 R = reflect(I, N);
  float lobe = pow(max(dot(R, uLight), 0.0), 14.0);
  vec3 env = mix(uEnvLo, uEnvHi, smoothstep(0.25, 0.95, R.z)) + uLightColor * lobe * 0.8;
  vec3 col = mix(seen, env, F * 0.92);

  // Highlights from the one light: a crisp glint and a broad sheen on the lit side of the bezel,
  // and the light that crossed the glass catching the far rim.
  vec3 H = normalize(uLight + V);
  float nh = max(dot(N, H), 0.0);
  // Polished glass: the flat top only mirrors the light near the reflection direction, so the broad sheen lives on
  // the curved bezel alone.
  float curve = 1.0 - u;
  float spec = pow(nh, 110.0) * 1.1 + pow(nh, 22.0) * 0.14 * curve;
  vec3 Nb = normalize(vec3(-N.xy, N.z));
  float back = pow(max(dot(Nb, H), 0.0), 80.0) * 0.2 * (1.0 - u) * (1.0 - u);
  vec2 lxy = uLight.xy / max(length(uLight.xy), 1e-4);
  float facing = dot(g, lxy);
  // Edge definition: a bright hairline where the rim meets the light (fading round to the far side), and a thin band
  // of rim light just inside it, as a curved edge catches a soft light.
  float lit = smoothstep(-0.35, 1.0, facing);
  float hair = exp(-t / (1.15 * uDpr));
  float band = exp(-t / (5.0 * uDpr)) * (1.0 - hair);
  col = addLight(col, uLightColor * (spec + hair * (0.3 + 0.9 * lit) * (0.75 + 0.25 * uDark) + band * (0.05 + 0.22 * lit * lit))
    + mix(uLightColor, seen * 1.6 + 0.1, 0.5) * back);
  float inner = exp(-abs(t - 2.4 * uDpr) / (1.2 * uDpr)) * smoothstep(0.35, -0.9, facing);
  col *= 1.0 - inner * mix(0.2, 0.32, uDark);
  // The bezel turned away from the light looks through the glass's own shadow at the darker side of the room.
  col *= 1.0 - smoothstep(0.15, -1.0, facing) * curve * curve * mix(0.09, 0.16, uDark);

  float cover = clamp(0.5 - d / 1.1, 0.0, 1.0);             // ~1px anti-aliased outline
  gl_FragColor = vec4(mix(outside, col, cover), 1.0);
  #include <colorspace_fragment>
}`;
