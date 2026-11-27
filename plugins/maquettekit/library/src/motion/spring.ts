/**
 * Motion Lab — a one-dimensional spring you step yourself, for rAF loops that follow the hand.
 * It keeps its velocity between calls, so a retargeted or thrown value bends toward the new goal instead of
 * restarting from rest. Configs are the `spring` tokens (stiffness / damping / mass) from `./tokens`.
 */
import type { SpringConfig } from './tokens';

/** Position and velocity of one spring axis (mutated in place by `stepSpring`). */
export interface SpringState { x: number; v: number }

/** When a spring counts as settled: within `restDelta` of the target and slower than `restSpeed` (units / s). */
export interface SpringRest { restDelta?: number; restSpeed?: number }

/** Largest integration step (s). Semi-implicit Euler stays stable for the stiffest token at this step. */
export const SPRING_SUBSTEP = 1 / 240;
const DEFAULT_REST_DELTA = 1e-4;

/** A spring axis at `x`, at rest. */
export const springState = (x = 0, v = 0): SpringState => ({ x, v });

/** Within the rest thresholds of `target`. `restSpeed` defaults to ten times `restDelta`. */
export function springAtRest(s: SpringState, target: number, rest: SpringRest = {}): boolean {
  const delta = rest.restDelta ?? DEFAULT_REST_DELTA;
  const speed = rest.restSpeed ?? delta * 10;
  return Math.abs(s.x - target) < delta && Math.abs(s.v) < speed;
}

/**
 * Advance `s` toward `target` by `dt` seconds: semi-implicit Euler, sub-stepped at ≤ 1/240 s so a slow frame cannot
 * blow up a stiff token. Once it is within the rest thresholds it is parked exactly on the target (v = 0).
 * Returns true when it is at rest, so a loop can stop: `if (stepSpring(s, to, spring.settle, dt)) stop();`.
 */
export function stepSpring(s: SpringState, target: number, cfg: SpringConfig, dt: number, rest?: SpringRest): boolean {
  if (dt > 0) {
    const n = Math.max(1, Math.ceil(dt / SPRING_SUBSTEP - 1e-9));
    const h = dt / n;
    const { stiffness: k, damping: c, mass: m } = cfg;
    for (let i = 0; i < n; i++) {
      s.v += ((-k * (s.x - target) - c * s.v) / m) * h;
      s.x += s.v * h;
    }
  }
  if (springAtRest(s, target, rest)) { s.x = target; s.v = 0; return true; }
  return false;
}
