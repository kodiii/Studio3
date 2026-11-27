/**
 * Pulse Night — the stage: camera shots per chapter, the light plan, the springs that give things weight, and the
 * builders for the plinth and the contact shadow. Plain data and maths (no React), so the Director stays readable.
 *
 * Camera shots are spherical (azimuth/elevation/distance around a focus point) plus a LENS SHIFT: the projection
 * window slides sideways instead of the camera looking away, like a shift lens on a product camera. The speaker is
 * placed opposite the copy without keystoning, and drag, sway and arcs still turn around the speaker itself.
 */
import {
  CanvasTexture, Color, Float32BufferAttribute, LatheGeometry, MathUtils, RepeatWrapping, SRGBColorSpace, Vector2,
} from 'three';
import { springAtRest, type SpringState } from '../../../motion';
import type { LightingPreset } from '../../../three';

export type V3 = [number, number, number];

/**
 * az/el in degrees (az 0 = in front of the speaker, positive = to its right); shift = fraction of the frame;
 * turn = the speaker's own pose on its plinth (degrees), part of the shot like a turntable in a studio.
 */
export interface Shot { az: number; el: number; dist: number; fx: number; fy: number; fz: number; fov: number; sx: number; sy: number; turn: number }
const shot = (az: number, el: number, dist: number, focus: V3, fov: number, shift: [number, number], turn = 0): Shot =>
  ({ az, el, dist, fx: focus[0], fy: focus[1], fz: focus[2], fov, sx: shift[0], sy: shift[1], turn });

export type Framing = 'wide' | 'tall';
/** Shots are authored at these aspect ratios; narrower canvases pull back so the horizontal extent holds. */
export const REFERENCE_ASPECT: Record<Framing, number> = { wide: 1.68, tall: 0.5 };

/**
 * One shot per chapter. Wide: copy left (01), right (02), left (03) — the speaker sits in the other half.
 * Tall (stacked layout): the copy card owns the bottom of the screen, so the speaker is lifted into the top half.
 */
export const SHOTS: Record<Framing, Shot[]> = {
  wide: [
    shot(34, 11, 7.9, [0, 0.66, 0], 27, [0.215, -0.01]),
    shot(-38, 5, 6.4, [-0.1, 0.58, 0.1], 27, [-0.255, 0.02]),
    // 03: the speaker turns half round on its plinth: the dial comes to the near end, the body runs away from the copy
    shot(26, 40, 5.3, [-0.36, 0.98, 0.02], 28, [0.13, -0.02], -180),
  ],
  tall: [
    shot(30, 12, 11.6, [0, 0.66, 0], 31, [0, 0.215]),
    shot(-34, 6, 9.6, [-0.1, 0.58, 0.1], 31, [0, 0.215]),
    shot(26, 44, 7.8, [-0.3, 0.95, 0.02], 31, [0, 0.2], -180),
  ],
};
/** Where the opening move starts: low, far and dark, already on the speaker's side of the frame. */
export const INTRO_FROM: Record<Framing, Shot> = {
  wide: shot(-66, 2, 15.5, [0, 0.6, 0], 22, [0.215, -0.01]),
  tall: shot(-60, 3, 20, [0, 0.6, 0], 26, [0, 0.215]),
};

/** The light plan per chapter (multipliers), blended with the camera. 01 hero key; 02 raking key across the grille; 03 the room goes dark and the dial is lit by a narrow spot and its own ring. */
export interface Light { key: number; keyAz: number; rim: number; env: number; spot: number; ring: number }
export const BEAT_LIGHT: Light[] = [
  { key: 1, keyAz: 0, rim: 1, env: 1, spot: 0, ring: 1 },
  { key: 1.08, keyAz: 0.42, rim: 1.15, env: 0.85, spot: 0, ring: 1 },
  { key: 0.3, keyAz: -0.2, rim: 0.7, env: 0.32, spot: 1, ring: 1.5 },
];

/** Night stage: one warm key from the upper right, a cool rim behind, a faint ember bounce, a dark room. */
export const NIGHT: LightingPreset = {
  label: 'Night stage', description: 'Warm key upper right, cool rim behind, ember bounce, dark room.', exposure: 1,
  ambient: { color: '#fff3e6', intensity: 0.05 },
  key: { color: '#ffe8d1', intensity: 2.9, position: [4.6, 5.0, 3.2] },
  fill: { color: '#ff8a4a', intensity: 0.3, position: [-4.2, 0.9, 2.6] },
  rim: { color: '#b4caff', intensity: 3.3, position: [-3.8, 3.2, -5.2] },
  env: { room: '#060606', intensity: 0.85, panels: [
    { color: '#ffeedd', intensity: 14, position: [4.8, 4.4, 3.4], size: [2.8, 2.0] },
    { color: '#dce7ff', intensity: 16, position: [-5.6, 2.8, -3.2], size: [0.8, 6.0] },
    { color: '#ffffff', intensity: 5, position: [0, 6.6, -1.2], size: [5.5, 1.1] },
    { color: '#f4f1ec', intensity: 2.6, position: [0.8, 3.2, 6.5], size: [6.5, 2.6] },
    { color: '#ff7a3a', intensity: 0.35, position: [-2.5, -2.2, 4.5], size: [6, 1.4] },
  ] },
};
const K = NIGHT.key.position;
/** The key light in spherical terms: the pointer and the drift turn it around the speaker. */
export const KEY_ORBIT = { az: Math.atan2(K[0], K[2]), el: Math.atan2(K[1], Math.hypot(K[0], K[2])), r: Math.hypot(K[0], K[1], K[2]) };
/** How far the pointer swings the key (radians) and how far the camera sways (degrees). */
export const LIGHT_SWING = { az: 0.55, el: 0.12 };
export const SWAY_DEG = { az: 3, el: 2 };

/* ── Easing and blending ─────────────────────────────────────────────────────────────────────────────── */
export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
export const smooth = (t: number): number => { const c = clamp01(t); return c * c * (3 - 2 * c); };
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = (t: number): number => 1 - (1 - clamp01(t)) ** 3;
export const easeIn = (t: number): number => clamp01(t) ** 2.2;
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

function lerpShot(a: Shot, b: Shot, k: { az: number; el: number; dist: number; focus: number; fov: number; shift: number }, out: Shot): Shot {
  out.turn = mix(a.turn, b.turn, k.focus);
  out.az = mix(a.az, b.az, k.az); out.el = mix(a.el, b.el, k.el); out.dist = mix(a.dist, b.dist, k.dist);
  out.fx = mix(a.fx, b.fx, k.focus); out.fy = mix(a.fy, b.fy, k.focus); out.fz = mix(a.fz, b.fz, k.focus);
  out.fov = mix(a.fov, b.fov, k.fov); out.sx = mix(a.sx, b.sx, k.shift); out.sy = mix(a.sy, b.sy, k.shift);
  return out;
}

/**
 * The shot for a scroll position. Each chapter is held for the middle of its range and the camera travels in
 * between, with a different move per transition: 01→02 swings round and pulls back on an arc; 02→03 is a crane
 * (it rises first, then turns). `weights` blends the light plan the same way. Reduced motion: no travel, the
 * nearest chapter's shot.
 */
export function shotForProgress(p: number, frame: Framing, reduced: boolean, out: Shot, weights: [number, number, number]): Shot {
  const list = SHOTS[frame];
  const x = clamp01(p) * (list.length - 1);
  if (reduced) {
    const i = Math.round(x);
    Object.assign(out, list[i]);
    weights[0] = i === 0 ? 1 : 0; weights[1] = i === 1 ? 1 : 0; weights[2] = i === 2 ? 1 : 0;
    return out;
  }
  const i = Math.min(list.length - 2, Math.floor(x));
  const k = smooth((x - i - 0.18) / 0.64);
  if (i === 0) {
    lerpShot(list[0], list[1], { az: easeInOut(k), el: k, dist: k, focus: smooth(k), fov: k, shift: easeInOut(k) }, out);
    out.dist += Math.sin(Math.PI * k) * 1.4;
    out.el += Math.sin(Math.PI * k) * 5;
  } else {
    lerpShot(list[1], list[2], { az: easeIn(k), el: easeOut(k), dist: smooth(k), focus: smooth(k), fov: k, shift: easeInOut(k) }, out);
    out.dist += Math.sin(Math.PI * k) * 0.6;
  }
  weights[0] = i === 0 ? 1 - k : 0; weights[1] = i === 0 ? k : 1 - k; weights[2] = i === 1 ? k : 0;
  return out;
}

/** The opening move from INTRO_FROM to the first chapter: a wide arc that ends exactly on the held shot. */
export function introShot(t: number, from: Shot, to: Shot, out: Shot): Shot {
  const e = easeInOut(clamp01(t));
  lerpShot(from, to, { az: e, el: easeOut(t) * 0.35 + e * 0.65, dist: easeOut(t * 1.1), focus: smooth(t), fov: e, shift: 1 }, out);
  out.el += Math.sin(Math.PI * e) * 6;
  return out;
}

export function blendLight(w: readonly number[], out: Light): Light {
  out.key = 0; out.keyAz = 0; out.rim = 0; out.env = 0; out.spot = 0; out.ring = 0;
  BEAT_LIGHT.forEach((b, i) => {
    out.key += b.key * w[i]; out.keyAz += b.keyAz * w[i]; out.rim += b.rim * w[i];
    out.env += b.env * w[i]; out.spot += b.spot * w[i]; out.ring += b.ring * w[i];
  });
  return out;
}

/* ── Weight: springs that keep the hand's velocity ───────────────────────────────────────────────────── */
/* Stepped with `stepSpring` from motion/; `atRest` is this stage's tolerance (velocity eps per 1/4 s). */
export type Axis = SpringState;
export const atRest = (a: Axis, target: number, eps = 1e-3): boolean => springAtRest(a, target, { restDelta: eps, restSpeed: eps * 4 });

/** Critically damped follow (SmoothDamp); `vel` is mutated. */
export function damp(cur: number, goal: number, vel: { v: number }, smoothTime: number, dt: number): number {
  const omega = 2 / Math.max(1e-4, smoothTime), x = omega * dt, k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - goal, temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * k;
  return goal + (change + temp) * k;
}

/** Rubber band: 1:1 up to `free`, then resistance that never passes `limit`. */
export function softLimit(x: number, free: number, limit: number): number {
  const a = Math.abs(x);
  if (a <= free) return x;
  return Math.sign(x) * (free + (limit - free) * Math.tanh((a - free) / (limit - free)));
}

/** Release velocity from the last ~90 ms of samples; a pointer that stopped before letting go throws nothing. */
export function releaseVelocity(samples: readonly { t: number; x: number }[], now: number): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  if (now - last.t > 70) return 0;
  let first = samples[0];
  for (let i = samples.length - 1; i >= 0; i--) { first = samples[i]; if (last.t - samples[i].t >= 90) break; }
  const dt = (last.t - first.t) / 1000;
  return dt > 0.008 ? (last.x - first.x) / dt : 0;
}

/** The dial's detents: the angle sticks near each notch and hops between them (a notched encoder). */
export const DETENT = (2 * Math.PI) / 30;
export const VOLUME = { start: 12, max: 30 };
export function detented(angle: number, strength = 0.78): number {
  return angle - (DETENT / (2 * Math.PI)) * strength * Math.sin((2 * Math.PI * angle) / DETENT);
}
/** Clockwise from above (negative Y rotation) turns the volume up. */
export const volumeAt = (angle: number): number => Math.min(VOLUME.max, Math.max(0, VOLUME.start + Math.round(-angle / DETENT)));

/* ── The plinth and its contact shadow ───────────────────────────────────────────────────────────────── */
export const PLINTH = { radius: 1.74, height: 0.7, fillet: 0.08 };

/**
 * A low drum with a filleted top edge (LatheGeometry). Vertex colours (RGBA) darken the side and fade it out from the
 * fillet down, so the plinth has a soft edge that dissolves into the stage instead of a hard rim. Planar UVs on the
 * top, cylindrical UVs on the side (a whole number of repeats around, so there is no seam).
 */
export function buildPlinthGeometry(): LatheGeometry {
  const { radius: R, height: H, fillet: f } = PLINTH;
  const pts: Vector2[] = [new Vector2(0, 0), new Vector2(R * 0.5, 0), new Vector2(R - f, 0)];
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * (Math.PI / 2); pts.push(new Vector2(R - f + f * Math.sin(a), -f + f * Math.cos(a))); }
  for (let i = 1; i <= 4; i++) pts.push(new Vector2(R, -f - ((H - f) * i) / 4));
  const geo = new LatheGeometry(pts, 112);
  const side = pts.map((p) => smooth((-p.y - f * 0.6) / (H - f)));
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 4);
  const uvs = new Float32Array(pos.count * 2);
  const around = Math.round(Math.PI); // the top's texel density, a whole number of repeats around the side
  for (let v = 0; v < pos.count; v++) {
    const k = side[v % pts.length];
    const c = MathUtils.lerp(1, 0.3, k);
    colors[v * 4] = c; colors[v * 4 + 1] = c; colors[v * 4 + 2] = c; colors[v * 4 + 3] = 1 - k;
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    if (y > -f * 0.6) { uvs[v * 2] = x / (2 * R) + 0.5; uvs[v * 2 + 1] = z / (2 * R) + 0.5; }
    else { uvs[v * 2] = ((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * around; uvs[v * 2 + 1] = -y / (2 * R); }
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 4));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return geo;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Honed-stone surface: a seeded value-noise albedo (sRGB) and roughness (linear) pair, 256 px, tiling. */
export function buildStoneTextures(): { map: CanvasTexture; roughness: CanvasTexture } {
  const N = 256, cell = 16, rand = rng(7);
  const grid = Array.from({ length: (N / cell + 1) ** 2 }, () => rand());
  const g = (x: number, y: number) => grid[(y % (N / cell)) * (N / cell + 1) + (x % (N / cell))];
  const make = (fn: (n: number, fine: number) => number, srgb: boolean) => {
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const ctx = c.getContext('2d');
    if (ctx) {
      const img = ctx.createImageData(N, N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const gx = Math.floor(x / cell), gy = Math.floor(y / cell), tx = smooth((x % cell) / cell), ty = smooth((y % cell) / cell);
        const n = mix(mix(g(gx, gy), g(gx + 1, gy), tx), mix(g(gx, gy + 1), g(gx + 1, gy + 1), tx), ty);
        const v = Math.round(255 * clamp01(fn(n, rand())));
        const o = (y * N + x) * 4; img.data[o] = v; img.data[o + 1] = v; img.data[o + 2] = v; img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    const t = new CanvasTexture(c);
    t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(3, 3);
    if (srgb) t.colorSpace = SRGBColorSpace;
    return t;
  };
  return {
    map: make((n, fine) => 0.9 + n * 0.08 + (fine - 0.5) * 0.05, true),
    roughness: make((n, fine) => 0.52 + n * 0.16 + (fine - 0.5) * 0.08, false),
  };
}

/** Footprint of the speaker (scene units) for the contact shadow: body, and the four rubber feet. */
const FOOT: V3[] = [[-0.74, 0, 0.24], [0.74, 0, 0.24], [-0.74, 0, -0.24], [0.74, 0, -0.24]];
export const SHADOW_PLANE: [number, number] = [3.6, 1.8];

/**
 * Two-layer contact shadow drawn once on a canvas: a wide soft occlusion and a tight core, plus the feet. Shadows are
 * drawn with `shadowBlur` from shapes kept off-canvas, which every 2D canvas supports (unlike `ctx.filter`).
 */
export function buildContactShadow(): CanvasTexture {
  const W = 512, H = 256, ppu = W / SHADOW_PLANE[0];
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const blurred = (draw: (x: number, y: number) => void, blurUnits: number, alpha: number) => {
    if (!ctx) return;
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${alpha})`;
    ctx.shadowBlur = blurUnits * ppu;
    ctx.shadowOffsetX = W * 2;
    ctx.fillStyle = '#000';
    ctx.beginPath(); draw(W / 2 - W * 2, H / 2 + 0.03 * ppu); ctx.fill();
    ctx.restore();
  };
  const rrect = (w: number, h: number, r: number) => (cx: number, cy: number) => ctx?.roundRect(cx - (w * ppu) / 2, cy - (h * ppu) / 2, w * ppu, h * ppu, r * ppu);
  blurred(rrect(2.5, 1.12, 0.48), 0.34, 0.5);
  blurred(rrect(2.2, 0.8, 0.34), 0.09, 0.5);
  for (const [x, , z] of FOOT) blurred((cx, cy) => ctx?.arc(cx + x * ppu, cy + z * ppu, 0.09 * ppu, 0, Math.PI * 2), 0.03, 0.65);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export const RING_LIGHT = new Color('#7fe8ff');
