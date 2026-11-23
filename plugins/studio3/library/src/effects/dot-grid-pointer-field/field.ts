/**
 * Dot field simulation + drawing (framework-free). Every dot is a damped spring pulled towards a target offset
 * that the pointer and the ripples define; the loop can stop as soon as every spring has settled.
 */
import type { SpringConfig } from '../../motion';

export interface Ripple { x: number; y: number; age: number }
export interface Influence { x: number; y: number }

export interface FieldOptions { spacing: number; dotSize: number; radius: number; strength: number }

export interface Palette { dots: string[]; focus: string }

const TAU = Math.PI * 2;
export const RIPPLE_SPEED = 460; // px/s
export const RIPPLE_LIFE = 1.35; // s
const RIPPLE_WIDTH = 34; // px

export class DotField {
  w = 0; h = 0; n = 0;
  bx = new Float32Array(0); by = new Float32Array(0);
  ox = new Float32Array(0); oy = new Float32Array(0); vx = new Float32Array(0); vy = new Float32Array(0);
  sc = new Float32Array(0); vs = new Float32Array(0); heat = new Float32Array(0);
  ripples: Ripple[] = [];

  /** Lay out a centred grid for a w × h CSS-pixel box. Motion state is reset (a resize is a new field). */
  layout(w: number, h: number, spacing: number): void {
    this.w = w; this.h = h;
    const cols = Math.max(1, Math.floor((w - spacing) / spacing) + 1);
    const rows = Math.max(1, Math.floor((h - spacing) / spacing) + 1);
    const x0 = (w - (cols - 1) * spacing) / 2, y0 = (h - (rows - 1) * spacing) / 2;
    const n = cols * rows;
    this.n = n;
    this.bx = new Float32Array(n); this.by = new Float32Array(n);
    this.ox = new Float32Array(n); this.oy = new Float32Array(n); this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.sc = new Float32Array(n).fill(1); this.vs = new Float32Array(n); this.heat = new Float32Array(n);
    for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) { this.bx[i] = x0 + c * spacing; this.by[i] = y0 + r * spacing; }
    this.ripples = [];
  }

  /** Advance `dt` seconds. Returns true when every dot is at rest and no ripple is alive. */
  step(dt: number, pointer: Influence | null, o: FieldOptions, spring: SpringConfig): boolean {
    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter((r) => r.age < RIPPLE_LIFE);
    const { stiffness: k, damping: c, mass: m } = spring;
    const R = o.radius, R2 = R * R;
    let restless = this.ripples.length > 0;
    for (let i = 0; i < this.n; i++) {
      const bx = this.bx[i], by = this.by[i];
      let tx = 0, ty = 0, ts = 1, heat = 0;
      if (pointer) {
        const dx = bx - pointer.x, dy = by - pointer.y, d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) || 1e-3;
          const q = 1 - d2 / R2, f = q * q; // smooth (Wendland-like) falloff, 0 at the radius
          tx += (dx / d) * o.strength * f; ty += (dy / d) * o.strength * f;
          ts += 1.5 * f; heat += f;
        }
      }
      for (const r of this.ripples) {
        const dx = bx - r.x, dy = by - r.y, d = Math.sqrt(dx * dx + dy * dy) || 1e-3;
        const g = Math.exp(-(((d - r.age * RIPPLE_SPEED) / RIPPLE_WIDTH) ** 2));
        if (g < 0.01) continue;
        const life = 1 - r.age / RIPPLE_LIFE, a = g * life * life;
        tx += (dx / d) * o.strength * 0.9 * a; ty += (dy / d) * o.strength * 0.9 * a;
        ts += 1.1 * a; heat += a;
      }
      // Semi-implicit Euler, substepped by the caller.
      this.vx[i] += ((-k * (this.ox[i] - tx) - c * this.vx[i]) / m) * dt; this.ox[i] += this.vx[i] * dt;
      this.vy[i] += ((-k * (this.oy[i] - ty) - c * this.vy[i]) / m) * dt; this.oy[i] += this.vy[i] * dt;
      this.vs[i] += ((-k * (this.sc[i] - ts) - c * this.vs[i]) / m) * dt; this.sc[i] += this.vs[i] * dt;
      this.heat[i] += (Math.min(1, heat) - this.heat[i]) * Math.min(1, dt * 14);
      if (!restless && (Math.abs(this.ox[i] - tx) > 0.02 || Math.abs(this.oy[i] - ty) > 0.02 || Math.abs(this.vx[i]) > 0.05 || Math.abs(this.vy[i]) > 0.05
        || Math.abs(this.sc[i] - ts) > 0.002 || Math.abs(this.vs[i]) > 0.01 || Math.abs(this.heat[i] - Math.min(1, heat)) > 0.004)) restless = true;
    }
    return !restless;
  }

  /** Draw with one path per tint bucket (≤ 5 fills per frame, no per-dot style changes). */
  draw(ctx: CanvasRenderingContext2D, dpr: number, dotSize: number, palette: Palette, cursor: Influence | null): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const buckets = palette.dots.length;
    for (let b = 0; b < buckets; b++) {
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < this.n; i++) {
        const level = Math.min(buckets - 1, Math.floor(this.heat[i] * buckets * 0.999 + 0.25));
        if (level !== b) continue;
        const x = this.bx[i] + this.ox[i], y = this.by[i] + this.oy[i], r = Math.max(0.3, dotSize * this.sc[i]);
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
        any = true;
      }
      if (any) { ctx.fillStyle = palette.dots[b]; ctx.fill(); }
    }
    if (cursor) {
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 11, 0, TAU);
      ctx.lineWidth = 2;
      ctx.strokeStyle = palette.focus;
      ctx.stroke();
    }
  }
}

/** Parse any CSS colour the 2D context understands into [r, g, b]. */
export function toRgb(ctx: CanvasRenderingContext2D, css: string, fallback: string): [number, number, number] {
  ctx.fillStyle = fallback;
  if (css) ctx.fillStyle = css;
  const v = String(ctx.fillStyle);
  if (v.startsWith('#')) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
  const m = v.match(/[\d.]+/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [0, 0, 0];
}

export const mixRgb = (a: [number, number, number], b: [number, number, number], t: number): string =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)} ${Math.round(a[1] + (b[1] - a[1]) * t)} ${Math.round(a[2] + (b[2] - a[2]) * t)})`;
