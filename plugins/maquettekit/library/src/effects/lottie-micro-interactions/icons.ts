/**
 * Six original interactive icons, authored with ./lottie-kit on a 24-unit grid (8 units of bleed around it for
 * overshoot and bursts). Every transition starts with a wind-up that hover/focus previews, commits with overshoot,
 * and settles with follow-through; timings differ per icon so the set never moves in lockstep.
 *
 * Frame numbers are at 60 fps. The wind-up length is the `fast` motion token (hover, small state changes).
 */
import { duration } from '../../motion';
import {
  arc, circle, compose, draw, ellipse, ellipseAt, group, line, oscillation, polar, polyline, roundedPolygon, track,
  vertexAngles, type Ease, type LottieAnimation, type Path, type SceneNode, type StrokePaint, type Vec2,
} from './lottie-kit';
import type { LottieSegments } from './segments';

export const FPS = 60;
const fr = (ms: number): number => Math.round((ms / 1000) * FPS);
/** Hover/focus preview: the wind-up at the start of each transition. */
const WIND = fr(duration.fast);

export type IconId = 'menu' | 'play' | 'bookmark' | 'bell' | 'heart' | 'theme';

export interface IconDesign {
  id: IconId;
  segments: LottieSegments;
  /** Build the Lottie data for a stroke weight in grid units. */
  build: (weight: number) => LottieAnimation;
}

const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
type Keys = readonly (readonly [number, number, Ease])[];
/** A follower: the same keys `by` frames later and `gain` times larger, landing on `end` (clapper behind the bell). */
const lagged = (keys: Keys, by: number, gain: number, end: number): [number, number, Ease][] =>
  keys.map(([t, v, e], n) => [n === keys.length - 1 ? end : t + by, v * gain, e]);

/* ── Menu ⇄ close ──────────────────────────────────────────────────────────────────────────────────────────────
   The outer bars breathe apart and the middle bar draws back (wind-up), then the outer bars converge and cross on an
   overshoot while the middle one is swallowed; the cross lands with a small squash. Reversible as it stands. */
function menu(w: number): LottieAnimation {
  const W = WIND, MEET = 16, END = 32;
  const stroke: StrokePaint = { tone: 'ink', width: w };
  // The cross lands on a spring: past 45° to 53°, back to 43°, and settles.
  const land = (sign: number): Keys => [[20, 53 * sign, 'emphasized'], [24, 43 * sign, 'swing'], [27.5, 45.6 * sign, 'swing'], [31, 45 * sign, 'swing']];
  const bar = (name: string, y: number, spread: number, sign: number): SceneNode => draw(name, {
    paths: [line([-8, 0], [8, 0])],
    stroke,
    transform: {
      position: track<Vec2>([12, y]).to(W, [12, y + spread], 'standard').to(MEET, [12, 12], 'inOut'),
      rotation: track(0).hold(MEET - 2).keysTo(land(sign)),
    },
  });
  const middle = draw('middle', {
    paths: [line([0, 0], [16, 0])],
    stroke: { ...stroke, opacity: track(1).hold(12).to(15, 0, 'linear') },
    transform: { position: [4, 12], scale: track<Vec2>([1, 1]).to(W, [0.55, 1], 'standard').to(15, [0, 1], 'exit') },
  });
  const cross = group('menu', [middle, bar('bottom', 18, 1.2, -1), bar('top', 6, -1.2, 1)], {
    pivot: [12, 12],
    scale: track(1).hold(MEET - 1).to(MEET + 1, 0.9, 'exit').to(MEET + 6, 1.04, 'swing').to(MEET + 12, 1, 'swing'),
  });
  return compose({ name: 'Menu', frames: END, scene: [cross], markers: { on: [0, END] } });
}

/* ── Play ⇄ pause ──────────────────────────────────────────────────────────────────────────────────────────────
   The disc presses in while the triangle compresses against its back edge, then the two halves of the triangle
   spring apart into bars (the right half a beat later), stretch tall and settle. */
function play(w: number): LottieAnimation {
  const W = 8, END = 30;
  const left = track(polyline([[10, 8], [13.2, 10], [13.2, 14], [10, 16]], true))
    .hold(W).to(W + 9, polyline([[8.8, 8.2], [9.8, 8.2], [9.8, 15.8], [8.8, 15.8]], true), 'inOut');
  const right = track(polyline([[13.2, 10], [16.4, 12], [16.4, 12], [13.2, 14]], true))
    .hold(W + 1).to(W + 10, polyline([[14.2, 8.2], [15.2, 8.2], [15.2, 15.8], [14.2, 15.8]], true), 'inOut');
  const paint = { fill: { tone: 'on' as const }, stroke: { tone: 'on' as const, width: w } }; // round joins round the corners
  const disc = draw('disc', {
    paths: [circle([12, 12], 11)],
    fill: { tone: 'solid' },
    transform: { pivot: [12, 12], scale: track(1).to(W, 0.94, 'standard').to(W + 8, 1.05, 'emphasized').to(W + 15, 0.99, 'swing').to(END, 1, 'swing') },
  });
  const glyph = group('glyph', [
    group('stretch', [draw('left', { paths: [left], ...paint }), draw('right', { paths: [right], ...paint })], {
      pivot: [12, 12],
      scale: track<Vec2>([1, 1]).hold(W + 4).to(W + 10, [1.04, 1.14], 'emphasized').to(W + 16, [1, 0.95], 'swing').to(END, [1, 1], 'swing'),
    }),
  ], {
    pivot: [10, 12],
    scale: track<Vec2>([1, 1]).to(W, [0.86, 1.05], 'standard').to(W + 6, [1, 1], 'emphasized'),
    rotation: track(0).to(W, -7, 'standard').to(W + 9, 2, 'emphasized').to(W + 15, 0, 'swing'),
  });
  return compose({ name: 'Play / pause', frames: END, scene: [disc, glyph], markers: { on: [0, END] } });
}

/* ── Bookmark ──────────────────────────────────────────────────────────────────────────────────────────────────
   A drop of ink beads above the ribbon (wind-up), falls stretching, splats on the top edge and floods the ribbon;
   the ribbon, hanging from its top edge, stretches under the weight and bounces back. Unsaving lifts the ribbon and
   rolls the ink back up into the top edge. */
function bookmark(w: number): LottieAnimation {
  const W = WIND, HIT = 16, SPLAT = 18, FULL = 27, END = 42, OFF_W = END + 6, OFF_END = 58;
  const ribbon = roundedPolygon([[6.5, 3.5], [17.5, 3.5], [17.5, 20.5], [12, 16.4], [6.5, 20.5]], [2.2, 2.2, 0.6, 0.6, 0.6]);
  const angles = vertexAngles(ribbon, [12, 11]);
  const blob = (c: Vec2, rx: number, ry: number): Path => ellipseAt(c, rx, ry, angles);
  // A drop: the blob with its two top vertices (the ribbon's top edge) drawn up into a point.
  const tear = (c: Vec2, rx: number, ry: number, tip: number): Path => {
    const b = blob(c, rx, ry);
    const top = c[1] - ry - tip;
    return {
      ...b,
      v: b.v.map((p, n) => (n === 1 ? [c[0] - 0.04, top] : n === 2 ? [c[0] + 0.04, top] : p)),
      i: b.i.map((t, n) => (n === 1 ? [-rx * 0.42, ry * 0.7] : n === 2 ? [0, 0] : t)),
      o: b.o.map((t, n) => (n === 1 ? [0, 0] : n === 2 ? [rx * 0.42, ry * 0.7] : t)),
    };
  };
  const inkShape = track(blob([12, -0.8], 0.05, 0.05))
    .to(5, blob([12, -0.8], 1.65, 1.35), 'emphasized') // beads, a little wide (surface tension)
    .to(W, tear([12, -0.8], 1.45, 1.5, 1.4), 'swing') // hangs as a drop
    .to(HIT, tear([12, 8], 1.1, 2.1, 1.2), 'exit') //     falls, stretching as it speeds up
    .to(SPLAT, blob([12, 8.6], 3.5, 1.45), 'enter') //    splats on the top edge
    .to(FULL, ribbon, 'emphasized'); //                    floods the ribbon
  const ink = draw('ink', {
    paths: [inkShape],
    fill: { tone: 'tint' },
    stroke: { tone: 'tint', width: w },
    transform: {
      pivot: [12, 3.5],
      scale: track(1).hold(OFF_W).to(OFF_END - 2, 0, 'exit'),
      opacity: track(0).to(3, 1, 'linear').hold(OFF_END - 6).to(OFF_END - 2, 0, 'linear'),
    },
  });
  const outline = draw('outline', {
    paths: [ribbon],
    stroke: { tone: 'ink', width: w, opacity: track(1).hold(FULL).to(FULL + 3, 0, 'linear').hold(END).to(END + 2, 1, 'linear') },
  });
  // The ribbon hangs from its top edge: the impact stretches it down, it recoils, then settles.
  const hanging = group('ribbon', [outline, ink], {
    pivot: [12, 3.5],
    scale: track<Vec2>([1, 1]).hold(SPLAT).keysTo([
      [SPLAT + 5, [0.96, 1.09], 'enter'], [SPLAT + 12, [1.02, 0.965], 'swing'], [SPLAT + 18, [0.995, 1.012], 'swing'], [END, [1, 1], 'swing'],
      [OFF_W, [1.01, 0.95], 'standard'], [OFF_END - 4, [0.99, 1.02], 'emphasized'], [OFF_END, [1, 1], 'swing'],
    ]),
  });
  return compose({ name: 'Bookmark', frames: OFF_END, scene: [hanging], markers: { on: [0, END], off: [END, OFF_END] } });
}

/* ── Bell ──────────────────────────────────────────────────────────────────────────────────────────────────────
   Alerts off shows a struck-through bell. Turning alerts on pulls the slash out, tilts the bell back and lets it go:
   a damped ring about the hanger, with the clapper lagging two frames behind at a wider swing, and sound waves
   thrown out on the first swings. Turning off muffles the bell with a short dead swing and strikes the slash back. */
function bell(w: number): LottieAnimation {
  const W = 8, END = 42, OFF_W = END + 6, OFF_END = 62;
  const PIVOT: Vec2 = [12, 3.2];
  const ring = oscillation(0, 18, { start: W, halfPeriod: 5.5, decay: 0.58, swings: 5 });
  const muffle: Keys = [[OFF_W, 4, 'standard'], [OFF_W + 5, -3, 'swing'], [OFF_W + 9, 1.2, 'swing'], [OFF_W + 12, 0, 'swing']];
  const body = draw('bell', {
    paths: [{ v: [[12, 4.4], [17.4, 10.2], [19.2, 16.6], [4.8, 16.6], [6.6, 10.2]], i: [[-3, 0], [0, -3.2], [-1.4, -1.2], [0, 0], [0, 3.6]], o: [[3, 0], [0, 3.6], [0, 0], [1.4, -1.2], [0, -3.2]], c: true }],
    stroke: { tone: 'ink', width: w },
    transform: { pivot: PIVOT, rotation: track(0).to(W, -9, 'standard').keysTo(ring).hold(END).keysTo(muffle) },
  });
  const clapper = draw('clapper', {
    paths: [arc([12, 17.3], 2.3, 115, 245, 2)],
    stroke: { tone: 'ink', width: w },
    transform: { pivot: PIVOT, rotation: track(0).to(W + 1, -5, 'standard').keysTo(lagged(ring, 2, 1.3, END)).keysTo(lagged(muffle, 1.5, 1.4, OFF_END - 1)) },
  });
  const wave = (name: string, from: number, to: number, delay: number): SceneNode => draw(name, {
    paths: [arc([12, 11], 9.6, from, to, 1)],
    stroke: { tone: 'tint', width: w, opacity: track(0).hold(W + delay).to(W + delay + 3, 1, 'linear').hold(OFF_W + 2).to(OFF_W + 6, 0, 'linear') },
    transform: {
      pivot: [12, 11],
      scale: track(0.6).hold(W + delay).to(W + delay + 7, 1.14, 'emphasized').to(W + delay + 16, 1, 'swing').hold(END).to(OFF_W, 0.88, 'standard').to(OFF_W + 6, 0.5, 'exit'),
    },
  });
  const S: Vec2 = [3.8, 3.8], E: Vec2 = [20.2, 20.2];
  const slashShape = track(line(S, E)).to(W, line(lerp2(S, E, 0.12), E), 'standard').to(W + 9, line(E, E), 'exit')
    .to(OFF_W, line(S, S), 'hold').to(OFF_W + 9, line(S, E), 'emphasized');
  const slashOpacity = track(1).hold(W + 7).to(W + 9, 0, 'linear').to(OFF_W, 1, 'hold');
  // The knock-out is the slash drawn wider in the background colour: it opens a gap where the slash crosses the bell.
  const knock = draw('knock', { paths: [slashShape], stroke: { tone: 'knock', width: w + 2.4, opacity: slashOpacity } });
  const slash = draw('slash', { paths: [slashShape], stroke: { tone: 'ink', width: w, opacity: slashOpacity } });
  return compose({
    name: 'Bell', frames: OFF_END,
    scene: [body, clapper, wave('wave right', 58, 92, 3), wave('wave left', 268, 302, 9), knock, slash],
    markers: { on: [0, END], off: [END, OFF_END] },
  });
}

/* ── Heart ─────────────────────────────────────────────────────────────────────────────────────────────────────
   The heart crouches on its tip (wind-up), springs up stretched while the fill pops out from its centre, then lands
   with a squash; a ring and two orbits of particles burst out on curved paths. Un-liking is quieter: a small squash
   and the fill sinks back into the centre. */
function heartPath(R = 4.3, half = 4.1, cy = 9, tipY = 19.8): Path {
  const rise = Math.sqrt(R * R - half * half);
  const dipY = cy - rise;
  const lobe = Math.asin(half / R); // angle of the dip on each lobe circle, from 12 o'clock
  const hD = (4 / 3) * Math.tan(lobe / 4) * R; // handle for the arc from the dip to the lobe top
  const hQ = (4 / 3) * Math.tan(Math.PI / 8) * R; // quarter circle
  const cx = Math.cos(lobe), sy = Math.sin(lobe);
  const k1 = R * 0.86, k2: Vec2 = [R * 0.84, R * 0.78];
  return {
    v: [[12, dipY], [12 + half, cy - R], [12 + half + R, cy], [12, tipY], [12 - half - R, cy], [12 - half, cy - R]],
    i: [[-cx * hD, -sy * hD], [-hD, 0], [0, -hQ], [k2[0], -k2[1]], [0, k1], [-hQ, 0]],
    o: [[cx * hD, -sy * hD], [hQ, 0], [0, k1], [-k2[0], -k2[1]], [0, -hQ], [hD, 0]],
    c: true,
  };
}

function heart(w: number): LottieAnimation {
  const W = 9, END = 34, OFF_W = END + 6, OFF_END = 50;
  const shape = heartPath();
  const C: Vec2 = [12, 12.5];
  const outline = draw('outline', {
    paths: [shape],
    stroke: { tone: 'ink', width: w, opacity: track(1).hold(22).to(26, 0, 'linear').hold(END).to(END + 2, 1, 'linear') },
  });
  const fillHeart = draw('fill', {
    paths: [shape],
    fill: { tone: 'tint' },
    stroke: { tone: 'tint', width: w },
    transform: {
      pivot: [12, 12],
      scale: track(0).hold(W + 1).to(22, 1, 'overshoot').hold(OFF_W).to(OFF_END - 2, 0, 'exit'),
      opacity: track(0).hold(W + 1).to(W + 3, 1, 'linear').hold(OFF_END - 6).to(OFF_END - 2, 0, 'linear'),
    },
  });
  const body = group('heart', [outline, fillHeart], {
    pivot: [12, 19.8],
    position: track<Vec2>([12, 19.8]).hold(W).to(14, [12, 18.6], 'enter').to(20, [12, 19.8], 'standard'),
    scale: track<Vec2>([1, 1]).keysTo([
      [W, [1.08, 0.88], 'standard'], [14, [0.88, 1.14], 'exit'], [19, [1.1, 0.92], 'enter'], [25, [0.97, 1.03], 'swing'], [31, [1, 1], 'swing'],
      [OFF_W, [1.04, 0.95], 'standard'], [OFF_END - 4, [0.98, 1.02], 'swing'], [OFF_END, [1, 1], 'swing'],
    ]),
  });
  const ring = draw('ring', {
    paths: [ellipse(C, track<Vec2>([11, 11]).hold(13).to(27, [30, 30], 'emphasized'))],
    stroke: { tone: 'tint', width: track(2.6).hold(13).to(27, 0, 'emphasized'), opacity: track(0).to(13, 1, 'hold').to(27, 0, 'hold') },
  });
  const particles = Array.from({ length: 8 }, (_, n): SceneNode => {
    const big = n % 2 === 0;
    const a = 22.5 + n * 45;
    const size = big ? 2.6 : 1.5;
    return draw(`particle ${n}`, {
      paths: [ellipse(
        track(polar(C, big ? 8.5 : 7.5, a)).hold(14).to(30, polar(C, big ? 15.5 : 12.5, a), 'enter'),
        track<Vec2>([size, size]).hold(20).to(31, [0, 0], 'exit'),
      )],
      fill: { tone: big ? 'tint' : 'ink', opacity: track(0).to(14, 1, 'hold') },
    });
  });
  const burst = group('burst', [ring, ...particles], { pivot: C, rotation: track(0).hold(14).to(32, 14, 'enter') });
  return compose({ name: 'Heart', frames: OFF_END, scene: [burst, body], markers: { on: [0, END], off: [END, OFF_END] } });
}

/* ── Sun ⇄ moon ────────────────────────────────────────────────────────────────────────────────────────────────
   The rays shorten and the sun swells (wind-up); the rays fold away in a sweep starting next to the coming bite,
   the disc grows into a full moon and a bite sweeps across it from the right to leave a crescent; two stars twinkle
   in after it. Reversible as it stands. */
function crescent(c1: Vec2, r1: number, biteDeg: number, d: number, r2: number): { path: Path; angles: number[] } {
  const c2 = polar(c1, d, biteDeg);
  const beta = (Math.acos((r1 * r1 - r2 * r2 + d * d) / (2 * d * r1)) * 180) / Math.PI;
  const start = biteDeg + beta, end = biteDeg - beta + 360;
  const outer = arc(c1, r1, start, end, 4);
  const about = (p: Vec2, c: Vec2): number => (Math.atan2(p[0] - c[0], -(p[1] - c[1])) * 180) / Math.PI;
  // Inner edge: the part of the bite circle inside the moon, from the last cusp back to the first, through the
  // point of the bite circle nearest the moon's centre (so it bulges inward).
  const from = about(outer.v[4], c2);
  let to = about(outer.v[0], c2);
  const via = biteDeg + 180;
  const norm = (x: number) => ((x % 360) + 360) % 360;
  const cw = norm(via - from) < norm(to - from); // does going clockwise from `from` reach `via` before `to`?
  to = cw ? from + norm(to - from) : from - norm(from - to);
  const inner = arc(c2, r2, from, to, 2);
  const path: Path = {
    v: [...outer.v, inner.v[1]],
    i: [inner.i[2], outer.i[1], outer.i[2], outer.i[3], outer.i[4], inner.i[1]],
    o: [outer.o[0], outer.o[1], outer.o[2], outer.o[3], inner.o[0], inner.o[1]],
    c: true,
  };
  // Sun vertices at the outer vertices' angles; the inner vertex sits midway between the cusps, on the bite side,
  // so morphing sun → moon drives it straight across the disc: the bite sweeps in.
  const angles = [...outer.v.map((p) => about(p, c1)), biteDeg];
  return { path, angles };
}

function sparkle(c: Vec2, r: number): Path {
  const tips = [0, 90, 180, 270].map((a) => polar(c, r, a));
  const pull = (p: Vec2): Vec2 => [(c[0] - p[0]) * 0.62, (c[1] - p[1]) * 0.62];
  return { v: tips, i: tips.map(pull), o: tips.map(pull), c: true };
}

function theme(w: number): LottieAnimation {
  const W = 9, END = 42;
  const C: Vec2 = [12, 12];
  const moon = crescent(C, 8.2, 45, 4.6, 6.4);
  const disc = (r: number): Path => ellipseAt(C, r, r, moon.angles);
  // Staged: the sun gathers (wind-up), the rays fold into it, then the disc swells into a full moon and is bitten.
  const body = draw('body', {
    paths: [track(disc(4.4)).to(W, disc(4.1), 'standard').hold(13).to(21, disc(7.6), 'inOut').to(31, moon.path, 'emphasized')],
    stroke: { tone: 'ink', width: w },
  });
  const orb = group('orb', [body], {
    pivot: C,
    rotation: track(32).hold(13).to(33, 0, 'emphasized'),
    scale: track(1).hold(25).to(30, 1.05, 'standard').to(37, 1, 'swing'),
  });
  const order = [45, 0, 90, 315, 135, 270, 180, 225]; // fold from the bite side round to the far side
  const rays = order.map((a, n): SceneNode => {
    const t0 = W + 1 + n * 0.8;
    return draw(`ray ${a}`, {
      paths: [track(line(polar(C, 7.2, a), polar(C, 9.6, a))).to(W, line(polar(C, 7, a), polar(C, 8.9, a)), 'standard').hold(t0).to(t0 + 5, line(polar(C, 6.6, a), polar(C, 6.7, a)), 'exit')],
      stroke: { tone: 'ink', width: w, opacity: track(1).hold(t0 + 2).to(t0 + 5, 0, 'linear') },
    });
  });
  const rayGroup = group('rays', rays, { pivot: C, rotation: track(0).to(W, -12, 'standard').to(W + 12, -36, 'standard') });
  const star = (name: string, c: Vec2, r: number, t0: number): SceneNode => draw(name, {
    paths: [sparkle(c, r)],
    fill: { tone: 'tint' },
    transform: {
      pivot: c,
      scale: track(0).hold(t0).to(t0 + 6, 1.25, 'emphasized').to(t0 + 11, 1, 'swing'),
      rotation: track(-45).hold(t0).to(t0 + 11, 0, 'emphasized'),
    },
  });
  return compose({
    name: 'Sun / moon', frames: END,
    scene: [rayGroup, orb, star('star', [19.4, 4.6], 2.6, 27), star('star small', [21.5, 10.6], 1.6, 31)],
    markers: { on: [0, END] },
  });
}

export const ICONS: Record<IconId, IconDesign> = {
  menu: { id: 'menu', segments: { on: [0, 32], hover: { on: WIND, off: 10 } }, build: menu },
  play: { id: 'play', segments: { on: [0, 30], hover: { on: 8, off: 8 } }, build: play },
  bookmark: { id: 'bookmark', segments: { on: [0, 42], off: [42, 58], hover: { on: WIND, off: 6 } }, build: bookmark },
  bell: { id: 'bell', segments: { on: [0, 42], off: [42, 62], hover: { on: 8, off: 6 } }, build: bell },
  heart: { id: 'heart', segments: { on: [0, 34], off: [34, 50], hover: { on: 9, off: 6 } }, build: heart },
  theme: { id: 'theme', segments: { on: [0, 42], hover: { on: 9, off: 8 } }, build: theme },
};
