/**
 * Lens state and physics, independent of the renderer: the WebGL scene and the CSS fallback both drive `step()` from
 * their own frame loop and read `frame()`. Coordinates are CSS pixels inside the stage, y pointing down.
 *
 * - Drag tracks the pointer 1:1 (rubber-banded past the edges); release keeps the pointer's velocity and glides with
 *   friction; past an edge a `spring.settle` pulls the lens back, so a throw bounces gently instead of stopping dead.
 * - Keyboard steps, "centre" and click-to-place seek with springs that keep the current velocity.
 * - Speed stretches the glass along its motion (area-preserving, `spring.pop`), so it wobbles when it stops.
 * - One light direction for the whole scene, eased with `spring.glide` toward the pointer.
 * Reduced motion: positions, shape and lift jump; no glide, rubber band, stretch or light animation.
 */
import { duration, sec, spring, type SpringConfig } from '../../motion';

export type ShapeId = 'pill' | 'circle' | 'squircle';
export const SHAPE_IDS: readonly ShapeId[] = ['pill', 'circle', 'squircle'];

/** SDF parameters in units of the lens radius: half extents, corner radius, corner exponent (2 round, >2 squircle). */
export const SHAPES: Record<ShapeId, { hx: number; hy: number; r: number; n: number }> = {
  pill: { hx: 1.62, hy: 0.8, r: 0.8, n: 2 },
  circle: { hx: 1, hy: 1, r: 1, n: 2 },
  squircle: { hx: 1.01, hy: 1.01, r: 1.01, n: 4.4 },
};

interface Spring1 { x: number; v: number; to: number }
const make = (x: number): Spring1 => ({ x, v: 0, to: x });
const SUB = 1 / 240; // fixed sub-step: semi-implicit Euler stays stable for the stiffest token at any frame time
function advance(s: Spring1, c: SpringConfig, dt: number): void {
  for (let t = 0; t < dt; t += SUB) {
    const h = Math.min(SUB, dt - t);
    s.v += ((-c.stiffness * (s.x - s.to) - c.damping * s.v) / c.mass) * h;
    s.x += s.v * h;
  }
}
const still = (s: Spring1, eps: number) => Math.abs(s.x - s.to) < eps && Math.abs(s.v) < eps * 8;
const snap = (s: Spring1, x = s.to) => { s.x = x; s.to = x; s.v = 0; };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** iOS-style resistance: the further past the edge, the less the lens follows. */
const band = (over: number, d: number) => (1 - 1 / ((over * 0.55) / d + 1)) * d;

/** Velocity decays with this time constant while gliding (throw distance ≈ speed × GLIDE). */
const GLIDE = sec(duration.moderate);
/** Sliding friction (px/s²): ends the exponential tail of a glide crisply. */
const FRICTION = 160;
const MAX_SPEED = 3600;
const STRETCH_MAX = 0.085;
const MARGIN = 10;
const DEG = Math.PI / 180;
/** Resting light: from the upper left, 38° above the page. */
const REST_AZ: [number, number] = [-0.6, -0.8];
const REST_EL = 38 * DEG;
const lightVec = (az: [number, number], el: number): [number, number, number] => [az[0] * Math.cos(el), az[1] * Math.cos(el), Math.sin(el)];

export interface LensFrame {
  /** centre */ x: number; y: number;
  /** half extents and corner radius (px) and corner exponent, lift scale applied */ hx: number; hy: number; r: number; n: number;
  /** stretch amount (+ along dir, − squash) and its unit direction */ stretch: number; dirX: number; dirY: number;
  /** 0 resting, 0.35 hovered, 1 held */ lift: number;
  /** unit vector toward the light (x right, y down, z toward the viewer) */ lx: number; ly: number; lz: number;
}

export class LensEngine {
  w = 0;
  h = 0;
  /** Base radius of the lens (px), from the stage size. */
  R = 80;
  reduced = false;
  follow = true;
  private x = make(0);
  private y = make(0);
  private mode: 'rest' | 'drag' | 'glide' | 'seek' = 'rest';
  private seekCfg: SpringConfig = spring.settle;
  private placed = false;
  private grab = { x: 0, y: 0 };
  private raw = { x: 0, y: 0 };
  private samples: { t: number; x: number; y: number }[] = [];
  private shape = { hx: make(SHAPES.pill.hx), hy: make(SHAPES.pill.hy), r: make(SHAPES.pill.r), n: make(SHAPES.pill.n) };
  private stretch = make(0);
  private dir = { x: 1, y: 0 };
  private lift = make(0);
  private mouse = true;
  private pointer = { x: 0, y: 0, inside: false };
  private az: [number, number] = [...REST_AZ];
  private light = { x: make(lightVec(REST_AZ, REST_EL)[0]), y: make(lightVec(REST_AZ, REST_EL)[1]), z: make(lightVec(REST_AZ, REST_EL)[2]) };

  get dragging(): boolean { return this.mode === 'drag'; }

  /** Stage size. The first call places the lens; later calls keep its relative position. */
  setSize(w: number, h: number): void {
    if (w <= 0 || h <= 0) return;
    this.R = clamp(Math.min(w, h) * 0.2, 40, 132);
    if (!this.placed) {
      this.placed = true;
      // Resting spot: across the display word and the edge of the sun, where there is most to bend.
      snap(this.x, w * 0.56);
      snap(this.y, h * 0.6);
      // Arrival: the glass is set down onto the page, its shadow tightening as it lands.
      if (!this.reduced) this.lift.x = 1.2;
    } else if (this.w > 0 && this.h > 0) {
      const sx = w / this.w, sy = h / this.h;
      for (const [s, k] of [[this.x, sx], [this.y, sy]] as const) { s.x *= k; s.to *= k; }
      this.raw.x *= sx; this.raw.y *= sy;
    }
    this.w = w;
    this.h = h;
    const [lx, hx, ly, hy] = this.bounds();
    if (this.mode === 'rest') { snap(this.x, clamp(this.x.x, lx, hx)); snap(this.y, clamp(this.y.x, ly, hy)); }
  }

  setShape(id: ShapeId, instant = false): void {
    const t = SHAPES[id];
    const grow = t.hx - this.shape.hx.to;
    for (const k of ['hx', 'hy', 'r', 'n'] as const) {
      this.shape[k].to = t[k];
      if (instant || this.reduced) snap(this.shape[k]);
    }
    if (instant || this.reduced || Math.abs(grow) < 1e-3) return;
    // Liquid follow-through: the glass lags the change of width, then wobbles through it.
    if (Math.abs(this.stretch.x) < 0.01) this.dir = { x: 1, y: 0 };
    this.stretch.v -= Math.sign(grow) * Math.sign(this.dir.x || 1) * 1.1;
  }

  /** Lens centre limits for the target shape. */
  private bounds(): [number, number, number, number] {
    const hx = this.shape.hx.to * this.R + MARGIN, hy = this.shape.hy.to * this.R + MARGIN;
    const lx = Math.min(hx, this.w / 2), ly = Math.min(hy, this.h / 2);
    return [lx, Math.max(lx, this.w - hx), ly, Math.max(ly, this.h - hy)];
  }

  /** True when (px, py) falls on the lens as drawn (squircle corners approximated by their Lp norm). */
  private contains(px: number, py: number): boolean {
    const f = this.frame();
    const qx = Math.abs(px - f.x) - f.hx + f.r, qy = Math.abs(py - f.y) - f.hy + f.r;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    const corner = ox || oy ? (ox ** f.n + oy ** f.n) ** (1 / f.n) : 0;
    return Math.min(Math.max(qx, qy), 0) + corner - f.r <= 0;
  }

  /**
   * Pointer over the stage. Hover is derived from geometry each frame, so a lens that glides out from under a still
   * mouse stops looking hovered without waiting for the next pointer event. Returns whether a frame is needed: not
   * when the light is fixed and the move changes nothing else.
   */
  pointerMove(px: number, py: number, inside = true, mouse = true): boolean {
    const wasOver = this.mouse && this.pointer.inside && this.contains(this.pointer.x, this.pointer.y);
    this.pointer = { x: px, y: py, inside };
    this.mouse = mouse;
    const over = mouse && inside && this.contains(px, py);
    if (this.mode === 'drag') {
      this.raw = { x: px, y: py };
      const t = performance.now();
      this.samples.push({ t, x: px, y: py });
      while (this.samples.length > 8 || (this.samples.length > 2 && t - this.samples[0].t > 160)) this.samples.shift();
    }
    return this.mode === 'drag' || (this.follow && !this.reduced) || over !== wasOver;
  }
  pointerLeave(): void { this.pointer = { ...this.pointer, inside: false }; }

  dragStart(px: number, py: number): void {
    this.mode = 'drag';
    this.grab = { x: px - this.x.x, y: py - this.y.x };
    this.raw = { x: px, y: py };
    this.samples = [{ t: performance.now(), x: px, y: py }];
    this.pointer = { x: px, y: py, inside: true };
  }

  dragEnd(): void {
    if (this.mode !== 'drag') return;
    const [vx, vy] = this.pointerVelocity(performance.now());
    const speed = Math.hypot(vx, vy);
    const k = speed > MAX_SPEED ? MAX_SPEED / speed : 1;
    this.samples = [];
    if (this.reduced) { this.mode = 'rest'; this.x.v = this.y.v = 0; return; }
    this.x.v = vx * k;
    this.y.v = vy * k;
    this.mode = 'glide';
  }

  /** Move by (dx, dy): keyboard steps accumulate on the running target, so held keys stay smooth. */
  nudge(dx: number, dy: number): void {
    const [lx, hx, ly, hy] = this.bounds();
    const bx = this.mode === 'seek' ? this.x.to : this.x.x, by = this.mode === 'seek' ? this.y.to : this.y.x;
    this.seek(clamp(bx + dx, lx, hx), clamp(by + dy, ly, hy), spring.settle);
  }
  recentre(): void { this.seek(this.w / 2, this.h / 2, spring.glide); }
  /** Send the lens to a point (clamped inside the stage). */
  placeAt(px: number, py: number): void {
    const [lx, hx, ly, hy] = this.bounds();
    this.seek(clamp(px, lx, hx), clamp(py, ly, hy), spring.glide);
  }
  private seek(tx: number, ty: number, cfg: SpringConfig): void {
    if (this.reduced) { snap(this.x, tx); snap(this.y, ty); this.mode = 'rest'; return; }
    this.x.to = tx;
    this.y.to = ty;
    this.seekCfg = cfg;
    this.mode = 'seek';
  }

  /** Position as a fraction of the stage, for announcements. */
  where(): { fx: number; fy: number } {
    return { fx: this.w ? this.x.to / this.w : 0.5, fy: this.h ? this.y.to / this.h : 0.5 };
  }

  private pointerVelocity(now: number): [number, number] {
    const s = this.samples;
    if (s.length < 2) return [0, 0];
    const last = s[s.length - 1];
    if (now - last.t > 70) return [0, 0]; // the pointer stopped before letting go
    let i = s.length - 1;
    while (i > 0 && last.t - s[i - 1].t <= 100) i--;
    const first = s[i];
    const dt = (last.t - first.t) / 1000;
    return dt < 0.008 ? [0, 0] : [(last.x - first.x) / dt, (last.y - first.y) / dt];
  }

  /** Advance by dt seconds. Returns true while another frame is needed. */
  step(rawDt: number): boolean {
    const dt = clamp(rawDt, 0, 1 / 20);
    const now = performance.now();
    const [lx, hx, ly, hy] = this.bounds();
    let vx = 0, vy = 0;
    let busy = false;

    if (this.mode === 'drag') {
      const tx = this.raw.x - this.grab.x, ty = this.raw.y - this.grab.y;
      const px = this.x.x, py = this.y.x;
      if (this.reduced) { this.x.x = clamp(tx, lx, hx); this.y.x = clamp(ty, ly, hy); }
      else {
        const d = this.R * 1.2;
        this.x.x = tx < lx ? lx - band(lx - tx, d) : tx > hx ? hx + band(tx - hx, d) : tx;
        this.y.x = ty < ly ? ly - band(ly - ty, d) : ty > hy ? hy + band(ty - hy, d) : ty;
      }
      this.x.to = this.x.x;
      this.y.to = this.y.x;
      [vx, vy] = this.pointerVelocity(now);
      busy = px !== this.x.x || py !== this.y.x || vx !== 0 || vy !== 0;
    } else if (this.mode === 'glide') {
      this.glideAxis(this.x, lx, hx, dt);
      this.glideAxis(this.y, ly, hy, dt);
      vx = this.x.v; vy = this.y.v;
      const inside = this.x.x >= lx - 0.5 && this.x.x <= hx + 0.5 && this.y.x >= ly - 0.5 && this.y.x <= hy + 0.5;
      if (inside && Math.hypot(vx, vy) < 6) {
        snap(this.x, clamp(this.x.x, lx, hx));
        snap(this.y, clamp(this.y.x, ly, hy));
        this.mode = 'rest';
      } else busy = true;
    } else if (this.mode === 'seek') {
      advance(this.x, this.seekCfg, dt);
      advance(this.y, this.seekCfg, dt);
      vx = this.x.v; vy = this.y.v;
      if (still(this.x, 0.05) && still(this.y, 0.05)) { snap(this.x); snap(this.y); this.mode = 'rest'; } else busy = true;
    } else if (this.x.x < lx - 0.5 || this.x.x > hx + 0.5 || this.y.x < ly - 0.5 || this.y.x > hy + 0.5) {
      // A morph to a wider shape (or a resize) pushed the lens past an edge: slide it back in.
      this.seek(clamp(this.x.x, lx, hx), clamp(this.y.x, ly, hy), spring.settle);
      busy = true;
    }

    // Shape morph: a slightly under-damped spring, so the glass settles like a liquid.
    for (const k of ['hx', 'hy', 'r', 'n'] as const) {
      const s = this.shape[k];
      if (this.reduced) snap(s); else { advance(s, spring.release, dt); if (still(s, 0.0005)) snap(s); else busy = true; }
    }

    // Squash and stretch along the motion.
    const speed = Math.hypot(vx, vy);
    if (this.reduced) snap(this.stretch, 0);
    else {
      if (speed > 30) {
        let nx = vx / speed, ny = vy / speed;
        if (nx * this.dir.x + ny * this.dir.y < 0) { nx = -nx; ny = -ny; } // a stretch has no front: never flip
        const k = 1 - Math.exp(-dt * 18);
        const dx = this.dir.x + (nx - this.dir.x) * k, dy = this.dir.y + (ny - this.dir.y) * k;
        const l = Math.hypot(dx, dy) || 1;
        this.dir = { x: dx / l, y: dy / l };
      }
      this.stretch.to = Math.min(speed / 2600, 1) * STRETCH_MAX;
      advance(this.stretch, spring.pop, dt);
      if (still(this.stretch, 0.0004)) snap(this.stretch); else busy = true;
    }

    // Lift: held glass rises (its shadow grows and softens), hovered glass rises a little.
    const hovered = this.mouse && this.pointer.inside && this.contains(this.pointer.x, this.pointer.y);
    this.lift.to = this.mode === 'drag' ? 1 : hovered ? 0.35 : 0;
    if (this.reduced) snap(this.lift); else { advance(this.lift, spring.settle, dt); if (still(this.lift, 0.002)) snap(this.lift); else busy = true; }

    // One light for the scene: toward the pointer when it follows, else the resting upper-left light.
    let target = lightVec(REST_AZ, REST_EL);
    if (this.follow && !this.reduced && this.pointer.inside) {
      const dx = this.pointer.x - this.x.x, dy = this.pointer.y - this.y.x;
      const dist = Math.hypot(dx, dy);
      if (dist > this.R * 0.45) this.az = [dx / dist, dy / dist]; // close to the centre the azimuth is noise: keep it
      target = lightVec(this.az, (56 - 30 * smooth(this.R * 0.6, this.R * 5, dist)) * DEG);
    }
    const L = this.light;
    L.x.to = target[0]; L.y.to = target[1]; L.z.to = target[2];
    for (const s of [L.x, L.y, L.z]) {
      if (this.reduced) snap(s); else { advance(s, spring.glide, dt); if (still(s, 0.001)) snap(s); else busy = true; }
    }
    return busy;
  }

  /** Free glide: drag plus a little sliding friction (a clean stop, no long creep); past an edge a spring pulls back. */
  private glideAxis(s: Spring1, lo: number, hi: number, dt: number): void {
    const c = spring.settle;
    for (let t = 0; t < dt; t += SUB) {
      const h = Math.min(SUB, dt - t);
      const edge = s.x < lo ? lo : s.x > hi ? hi : null;
      if (edge === null) {
        s.v *= Math.exp(-h / GLIDE);
        s.v -= Math.sign(s.v) * Math.min(Math.abs(s.v), FRICTION * h);
      } else s.v += ((-c.stiffness * (s.x - edge) - c.damping * s.v) / c.mass) * h;
      s.x += s.v * h;
    }
    s.to = s.x;
  }

  frame(): LensFrame {
    const k = this.R * (1 + 0.03 * this.lift.x);
    const hx = Math.max(0.05, this.shape.hx.x) * k, hy = Math.max(0.05, this.shape.hy.x) * k;
    const L = this.light;
    const l = Math.hypot(L.x.x, L.y.x, L.z.x) || 1;
    return {
      x: this.x.x, y: this.y.x, hx, hy, r: Math.min(Math.max(0, this.shape.r.x * k), hx, hy), n: Math.max(1.5, this.shape.n.x),
      stretch: this.stretch.x, dirX: this.dir.x, dirY: this.dir.y, lift: this.lift.x,
      lx: L.x.x / l, ly: L.y.x / l, lz: L.z.x / l,
    };
  }
}
