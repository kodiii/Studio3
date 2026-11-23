/**
 * The whole field moves in the vertex shader: the CPU only updates a handful of uniforms per frame.
 * Each particle carries its point on all three forms (aSphere, aTorus, aGlyph) and a random seed vector.
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

varying float vPick;
varying float vGlow;

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

  float ring = exp(-pow(length(pos) - uPulse.x * 3.4, 2.0) * 5.0) * uPulse.y;
  pos += normalize(pos + vec3(1e-4)) * ring * 0.55;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = uSize * (0.55 + aSeed.y * 0.9) * (1.0 + push * 1.4 + ring * 1.2);
  gl_PointSize = size * uPixelRatio * (6.0 / max(0.5, -mv.z));
  vPick = aSeed.z;
  vGlow = clamp(0.45 + 0.55 * uIntensity + push * 0.6 + ring, 0.0, 1.6);
}
`;

export const fragmentShader = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uAccentShare;
varying float vPick;
varying float vGlow;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.05, r);
  vec3 col = vPick > 1.0 - uAccentShare ? uColorB : uColorA;
  gl_FragColor = vec4(col * vGlow, a * 0.85);
  #include <colorspace_fragment>
}
`;
