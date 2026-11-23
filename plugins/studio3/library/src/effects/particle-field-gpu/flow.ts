/**
 * The flow field, shared by the vertex shader (GLSL string below) and the SVG fallback (JS): the curl of a scalar
 * stream function ψ(x, y, t), so the 2D velocity v = (∂ψ/∂y, −∂ψ/∂x) is divergence-free — particles swirl and
 * braid without bunching up or thinning out — plus a gentle drift to the right.
 */
export const DRIFT = 0.42;

export function velocity(x: number, y: number, t: number): [number, number] {
  const a = 0.9 * x + 0.25 * t, b = 1.1 * y - 0.2 * t, c = 1.7 * x - 1.3 * y + 0.35 * t, e = 2.6 * x + 2.1 * y - 0.15 * t;
  const dPsiDx = 0.9 * Math.cos(a) * Math.cos(b) + 0.935 * Math.cos(c) - 0.78 * Math.sin(e);
  const dPsiDy = -1.1 * Math.sin(a) * Math.sin(b) - 0.715 * Math.cos(c) - 0.63 * Math.sin(e);
  return [dPsiDy + DRIFT, -dPsiDx];
}

export const flowGlsl = /* glsl */ `
vec2 flow(vec2 p, float t) {
  float a = 0.9 * p.x + 0.25 * t, b = 1.1 * p.y - 0.2 * t, c = 1.7 * p.x - 1.3 * p.y + 0.35 * t, e = 2.6 * p.x + 2.1 * p.y - 0.15 * t;
  float dx = 0.9 * cos(a) * cos(b) + 0.935 * cos(c) - 0.78 * sin(e);
  float dy = -1.1 * sin(a) * sin(b) - 0.715 * cos(c) - 0.63 * sin(e);
  return vec2(dy + ${DRIFT.toFixed(2)}, -dx);
}`;
