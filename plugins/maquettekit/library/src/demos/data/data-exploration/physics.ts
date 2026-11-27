/**
 * Small, dependency-free motion physics for the explorer: springs driven by the motion-token presets
 * (`spring.*` = stiffness / damping / mass), an iOS-style rubber band for limits, a release-velocity tracker and
 * the token cubic-béziers as JS easing functions. Everything here is pure; loops are owned by the components and
 * cancelled on unmount.
 */
import { easing as EASE, type EasingToken, type SpringConfig } from '../../../motion';

/** Advance a damped spring toward `to` by `dt` seconds (semi-implicit Euler, sub-stepped at 240 Hz). Returns [x, v]. */
export function stepSpring(x: number, v: number, to: number, cfg: SpringConfig, dt: number): [number, number] {
  const n = Math.max(1, Math.ceil(dt * 240));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const a = (-cfg.stiffness * (x - to) - cfg.damping * v) / cfg.mass;
    v += a * h;
    x += v * h;
  }
  return [x, v];
}

/** Rubber band: how far past a limit to draw a pull of `over`, given the band's reach `dim` (never reaches `dim`). */
export function rubber(over: number, dim: number, c = 0.55): number {
  if (dim <= 0) return 0;
  const o = Math.abs(over);
  return Math.sign(over) * (1 - 1 / ((o * c) / dim + 1)) * dim;
}

/** Velocity of a 1D pointer-driven value over the last ~100 ms (units per second); 0 if the hand stopped first. */
export function createVelocity() {
  const pts: { t: number; x: number }[] = [];
  return {
    reset() { pts.length = 0; },
    push(x: number, t = performance.now()) {
      pts.push({ t, x });
      while (pts.length > 2 && t - pts[0].t > 100) pts.shift();
    },
    get(t = performance.now()): number {
      if (pts.length < 2) return 0;
      const a = pts[0], b = pts[pts.length - 1];
      if (t - b.t > 70) return 0;
      const dt = (b.t - a.t) / 1000;
      return dt > 0.004 ? (b.x - a.x) / dt : 0;
    },
  };
}

/** A token cubic-bézier as an easing function of progress 0..1 (Newton–Raphson with a bisection fallback). */
export function bezier(token: EasingToken): (t: number) => number {
  const [x1, y1, x2, y2] = EASE[token];
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) { const e = sx(t); if (Math.abs(e - x) < 1e-5) break; if (e < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return t;
  };
  return (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : sy(solve(p)));
}

/** rAF driver for short-lived motion: runs `step(dt)` every frame while it returns true; `stop()` on unmount. */
export function createLoop(step: (dt: number) => boolean) {
  let raf = 0, prev = 0;
  const frame = (now: number) => {
    const dt = prev ? Math.min(0.034, (now - prev) / 1000) : 1 / 60;
    prev = now;
    if (step(dt)) raf = requestAnimationFrame(frame);
    else { raf = 0; prev = 0; }
  };
  return {
    start() { if (!raf && typeof requestAnimationFrame === 'function') { prev = 0; raf = requestAnimationFrame(frame); } },
    stop() { if (raf) cancelAnimationFrame(raf); raf = 0; prev = 0; },
    get running() { return raf !== 0; },
  };
}
