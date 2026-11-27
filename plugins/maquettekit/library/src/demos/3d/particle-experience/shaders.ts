/**
 * The whole field moves in the vertex shader: the CPU only updates a handful of uniforms per frame.
 * Each particle carries its point on all three forms (aSphere, aTorus, aGlyph) and a random seed vector.
 *
 * Light and depth without a postprocessing pass:
 *  - every point is a glowing sprite: a white-hot core inside a soft halo (additive blending does the bloom);
 *  - depth falls off like a lens and an atmosphere: points far behind the focus plane dim and cool, points away
 *    from the focus plane in either direction spread into larger, fainter discs (a cheap depth of field).
 */
export const vertexShader = /* glsl */ `
attribute vec3 aSphere;
attribute vec3 aTorus;
attribute vec3 aGlyph;
attribute vec4 aSeed;

uniform float uTime;
uniform float uFrom;
uniform float uTo;
uniform float uProgress;
uniform float uIntensity;
uniform float uSize;
uniform float uPixelRatio;
uniform vec3 uPointer;
uniform float uPointerStrength;
uniform vec2 uPulse;
uniform float uFocus;

varying float vPick;
varying float vGlow;
varying float vAlpha;
varying float vDepth;

vec3 formAt(float i) { return i < 0.5 ? aSphere : (i < 1.5 ? aTorus : aGlyph); }

// Cheap divergence-light swirl: sums of offset sines, phase-shifted per particle.
vec3 flow(vec3 p, float t) {
  float ph = aSeed.w * 6.2831;
  return vec3(
    sin(p.y * 1.7 + t * 0.9 + ph) + sin(p.z * 2.3 - t * 0.6),
    sin(p.z * 1.9 + t * 0.7 + ph * 0.5) + sin(p.x * 2.1 + t * 0.5),
    sin(p.x * 1.5 - t * 0.8 + ph * 0.75) + sin(p.y * 2.6 + t * 0.4)
  ) * 0.5;
}

void main() {
  float stagger = 0.65;
  float p = clamp(uProgress * (1.0 + stagger) - aSeed.x * stagger, 0.0, 1.0);
  p = p * p * (3.0 - 2.0 * p);
  vec3 pos = mix(formAt(uFrom), formAt(uTo), p);
  float flight = sin(p * 3.14159265);
  // mid-flight the particles bloom outwards, then settle onto the new form
  pos += normalize(pos + vec3(1e-4)) * flight * (0.35 + 0.5 * aSeed.y);
  pos += flow(pos * 0.9, uTime) * (0.03 + 0.2 * uIntensity) * (0.7 + flight);

  vec3 d = pos - uPointer;
  float push = uPointerStrength * exp(-dot(d, d) * 2.4);
  pos += normalize(d + vec3(1e-4)) * push * 0.85;

  float rr = length(pos) - uPulse.x * 3.4;          // squared explicitly: pow() of a negative base is undefined
  float ring = exp(-rr * rr * 5.0) * uPulse.y;
  pos += normalize(pos + vec3(1e-4)) * ring * 0.55;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  float depth = clamp((dist - uFocus + 1.7) / 3.4, 0.0, 1.0);      // 0 = nearest, 1 = farthest
  float defocus = min(1.5, abs(dist - uFocus) / 1.45);
  float size = uSize * (0.55 + aSeed.y * 0.9) * (1.0 + push * 1.4 + ring * 1.2);
  size *= 1.0 + defocus * defocus * 0.85;                          // out of focus: wider…
  gl_PointSize = size * uPixelRatio * (6.0 / max(0.5, dist)) * 2.3; // ×2.3 leaves room for the halo
  vPick = aSeed.z;
  vGlow = clamp(0.5 + 0.55 * uIntensity + push * 0.9 + ring * 1.3 + flight * 0.45, 0.0, 2.4);
  vAlpha = (1.0 - depth * 0.6) / (1.0 + defocus * defocus * 1.25); // …and fainter; far points fade
  vDepth = depth;
}
`;

export const fragmentShader = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorFar;
uniform float uAccentShare;
varying float vPick;
varying float vGlow;
varying float vAlpha;
varying float vDepth;

void main() {
  vec2 c = (gl_PointCoord - 0.5) * 2.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * 24.0);
  float halo = exp(-r2 * 4.6) * 0.3;
  vec3 base = vPick > 1.0 - uAccentShare ? uColorB : uColorA;
  base = mix(base, uColorFar, vDepth * 0.55);                      // atmospheric: far points cool and grey
  vec3 col = base * vGlow + vec3(1.0, 0.93, 0.82) * core * 0.5 * vGlow;
  gl_FragColor = vec4(col, (core + halo) * vAlpha);
  #include <colorspace_fragment>
}
`;
