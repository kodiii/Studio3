/**
 * Tiny spring integrator for the pointer-driven parts of the page (stage tilt, loupe).
 * Semi-implicit Euler, sub-stepped at ≤ 1/240 s so every motion-token spring stays stable on slow frames.
 */
import type { SpringConfig } from '../../../motion';

export interface Axis { x: number; v: number }
export const axis = (x = 0): Axis => ({ x, v: 0 });

export function stepAxis(a: Axis, target: number, c: SpringConfig, dt: number): void {
  const n = Math.max(1, Math.ceil(dt * 240));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    a.v += ((-c.stiffness * (a.x - target) - c.damping * a.v) / c.mass) * h;
    a.x += a.v * h;
  }
}

/** Close enough to the target and slow enough that the spring can be put to sleep. */
export const atRest = (a: Axis, target: number, eps: number): boolean => Math.abs(a.x - target) < eps && Math.abs(a.v) < eps * 4;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const smoothstep = (t: number): number => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };
