/**
 * Small, allocation-free spring kit shared by the follower engine and the showcase strip.
 * Springs use the Motion Lab tokens (stiffness / damping / mass) and are stepped with motion's `stepSpring`, which keeps
 * their velocity between frames, so a retargeted value bends toward its new goal instead of restarting from rest.
 */
import { springAtRest, springState, type SpringConfig, type SpringState } from '../../motion';

export type Axis = SpringState;

export const axis = (x = 0): Axis => springState(x);

/** At rest within `eps` of the target (velocity tolerance scales with it: eps per 1/10 s). */
export const atRest = (a: Axis, target: number, eps: number): boolean => springAtRest(a, target, { restDelta: eps, restSpeed: eps * 10 });

/** Park an axis exactly on its target. */
export const park = (a: Axis, target: number): void => { a.x = target; a.v = 0; };

/**
 * The same spring curve played `k` times faster: stiffness × k², damping × k keeps the damping ratio (so the
 * character of the token) while scaling its natural frequency.
 */
export const quicken = (c: SpringConfig, k: number): SpringConfig => ({ stiffness: c.stiffness * k * k, damping: c.damping * k, mass: c.mass });

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Rubber-band resistance past an edge: the offset grows ever more slowly and never exceeds `d`.
 * `c` is the classic 0.55 platform coefficient.
 */
export const rubberBand = (over: number, d: number, c = 0.55): number => {
  if (d <= 0 || over === 0) return 0;
  const a = Math.abs(over);
  return Math.sign(over) * (1 - 1 / ((a * c) / d + 1)) * d;
};
