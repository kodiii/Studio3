import { flowGlsl } from './flow';

/**
 * Every particle's position is a pure function of its seed and time: start at the seed, then integrate the flow
 * for `life` of the path in a few Euler steps. No CPU work per particle, ever — only uniforms change per frame.
 */
export const vertexShader = /* glsl */ `
uniform float uTime, uFlow, uSize, uPixelRatio, uIntensity, uPointerStrength, uFieldScale;
uniform vec2 uBounds, uPointer;
attribute vec4 aSeed; // phase, speed, size, tint
varying float vAlpha;
varying float vTint;
${flowGlsl}
void main() {
  float life = fract(aSeed.x + uTime * uFlow * (0.05 + 0.05 * aSeed.y));
  vec2 p = position.xy * uBounds * 1.25;
  float h = life * 2.6 / 7.0;
  for (int i = 0; i < 7; i++) p += flow(p * uFieldScale, uTime * 0.12) * h;
  vec2 d = p - uPointer;
  float r2 = dot(d, d);
  p += (r2 > 1e-6 ? d * inversesqrt(r2) : vec2(0.0)) * uPointerStrength * exp(-r2 * 2.2) * 0.55;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, position.z, 1.0);
  gl_PointSize = uSize * uPixelRatio * (0.55 + aSeed.z * 0.9);
  vAlpha = smoothstep(0.0, 0.14, life) * (1.0 - smoothstep(0.72, 1.0, life)) * uIntensity;
  vTint = aSeed.w;
}`;

export const fragmentShader = /* glsl */ `
precision highp float;
uniform vec3 uColor, uAccent;
varying float vAlpha;
varying float vTint;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, r) * vAlpha;
  if (a < 0.003) discard;
  vec3 c = mix(uColor, uAccent, step(0.9, vTint));
  // Blending is chosen by the theme: additive light on dark stages, ordinary alpha (ink builds up like graphite) on light.
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}`;
