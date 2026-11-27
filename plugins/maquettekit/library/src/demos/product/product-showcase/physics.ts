/**
 * Spring helpers for the pointer-driven parts of the page (stage tilt, loupe). The axes are stepped with motion's
 * `stepSpring`; this file keeps the page's own rest tolerance and small maths.
 */
import { springAtRest, springState, type SpringState } from '../../../motion';

export type Axis = SpringState;
export const axis = (x = 0): Axis => springState(x);

/** Close enough to the target and slow enough that the spring can be put to sleep. */
export const atRest = (a: Axis, target: number, eps: number): boolean => springAtRest(a, target, { restDelta: eps, restSpeed: eps * 4 });

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const smoothstep = (t: number): number => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };
