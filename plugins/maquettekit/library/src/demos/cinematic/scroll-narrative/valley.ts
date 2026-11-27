/**
 * Plan-view and cross-section geometry of the (fictional) Vell valley at a continuous stage t ∈ [0, 4].
 * Pure and deterministic: the same t always gives the same drawing, so the scrubbed figure, the static
 * reduced-motion figures and a reload mid-page all agree.
 *
 * The channel is a sine-generated curve (direction angle θ = ω·sin(2πs) along the arc length s), the standard
 * approximation of real meander bends: small ω is a nearly straight stream, ω near 2 rad gives looping bends.
 */

export interface Step { id: string; numeral: string; short: string; title: string; body: string; look: string; caption: string }

export const STEPS: readonly Step[] = [
  {
    id: 'rain', numeral: 'I', short: 'Rain', title: 'Rain finds the low line',
    body: 'Water falling on the moor runs to the lowest line it can find, and keeps finding it. The young Vell is a thread of a stream, straight because the slope is steep and nothing has stood in its way yet.',
    look: 'A narrow channel, stones scoured clean, banks barely higher than the water.',
    caption: 'Stage I — a straight stream in a narrow valley.',
  },
  {
    id: 'down', numeral: 'II', short: 'Cutting down', title: 'Cutting down',
    body: 'While the slope stays steep, the river spends its energy downward. Grit carried in the current works like sandpaper on the bed, and the valley deepens into a V faster than it widens.',
    look: 'Steep, even valley sides and almost no flat ground beside the water.',
    caption: 'Stage II — the contours crowd in as the valley deepens.',
  },
  {
    id: 'swing', numeral: 'III', short: 'Swinging wide', title: 'Swinging wide',
    body: 'Where the land flattens, the current starts to swing. Water on the outside of a bend runs fastest and eats the bank; on the inside it slows and drops sand. Each bend grows by cutting one side and building the other.',
    look: 'A steep cut bank on the outside of a bend, facing a gentle beach of sand on the inside.',
    caption: 'Stage III — bends grow; sand (dotted) gathers inside each one.',
  },
  {
    id: 'cut', numeral: 'IV', short: 'The shortcut', title: 'The shortcut',
    body: 'Bends grow until two of them nearly meet. In a flood the river breaks through the narrow neck between them, takes the short way, and leaves the old loop behind as a curved lake.',
    look: 'A crescent of still water beside the river, often edged with reeds: an oxbow lake.',
    caption: 'Stage IV — the neck is breached; the loop becomes an oxbow lake.',
  },
  {
    id: 'floor', numeral: 'V', short: 'The floor', title: 'A floor of its own making',
    body: 'Over thousands of years the river wanders from side to side, spreading silt every time it floods. The flat floor is its own work. When it later cuts down again, older floors are left as steps on the valley sides.',
    look: 'Level fields that end in a sudden low bank: a terrace, the edge of an older floor.',
    caption: 'Stage V — a wide floodplain, an old channel scar and two terraces.',
  },
];

export const FIGURE_DESCRIPTION =
  'Schematic plan of the Vell valley with a cross-section. Across five stages the river changes from a straight stream in a narrow V-shaped valley into wide looping bends, cuts off one loop as an oxbow lake, and finally sits on a broad flat floor edged by terraces.';

type Pt = [number, number];

const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
const smooth = (x: number): number => x * x * (3 - 2 * x);
const ramp = (t: number, a: number, b: number): number => smooth(clamp((t - a) / (b - a)));
const key = (values: readonly number[], t: number): number => {
  const i = Math.min(values.length - 2, Math.max(0, Math.floor(t)));
  return values[i] + (values[i + 1] - values[i]) * smooth(clamp(t - i));
};

const OMEGA = [0.22, 0.32, 1.25, 1.72, 1.86];
const FLOOR = [14, 11, 92, 150, 214];
const SPACING = [15, 8.5, 13, 15, 17];
const WIDTH = [2.2, 2.8, 4.2, 5, 5.6];
const DEPTH = [0.4, 0.95, 0.9, 0.84, 0.78];

const W = 600;
const H = 800;
const PERIODS = 3.4;
const N = 520;
export const CONTOURS = 8;

const f1 = (n: number): string => n.toFixed(1);
const poly = (pts: readonly Pt[]): string => (pts.length ? `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L')}` : '');

/** Sine-generated meander centreline, fitted to span the plan from top to bottom. Returns points and the phase s per point. */
function centreline(omega: number, phase: number): { pts: Pt[]; s: number[] } {
  const raw: Pt[] = [];
  const ss: number[] = [];
  const ds = PERIODS / N;
  let x = 0;
  let y = 0;
  for (let i = 0; i <= N; i++) {
    const s = phase + i * ds;
    raw.push([x, y]);
    ss.push(s);
    const th = omega * Math.sin(2 * Math.PI * s);
    x += Math.sin(th) * ds;
    y += Math.cos(th) * ds;
  }
  const y0 = raw[0][1];
  const k = (H + 60) / (raw[N][1] - y0);
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of raw) { lo = Math.min(lo, p[0]); hi = Math.max(hi, p[0]); }
  const cx = (lo + hi) / 2;
  return { pts: raw.map(([px, py]) => [W / 2 + (px - cx) * k, -30 + (py - y0) * k]), s: ss };
}

/** The plan at one stage, plus what a cross-section needs (kept so a moving section line never redraws the plan). */
export interface PlanGeometry {
  channel: string; width: number;
  breach: string; breachWidth: number;
  oxbow: string; oxbowOpacity: number;
  scar: string; scarOpacity: number;
  bars: string; barsOpacity: number;
  floor: string;
  contours: string[];
  terraces: string; terraceOpacity: number;
  /** Section inputs: the live channel and the cut-off loop as polylines, the valley shape at this stage. */
  chanPts: Pt[]; loopPts: Pt[]; floorW: number; depth: number; terr: number; sway: number;
}
export interface SectionGeometry {
  /** y of the section line on the plan (viewBox units). */
  y: number;
  ground: string; water: string; still: string;
  /** How many times the line crosses the live channel and the oxbow lake (for the label and the slider's text). */
  crossings: number; lakes: number;
}
export type ValleyGeometry = PlanGeometry & SectionGeometry;

/** The section line's range on the plan (it stays clear of the title and of the inset). */
export const SECTION = { min: 84, max: 640, start: 612 } as const;

/** Valley axis at plan height y for a given stage sway (shared by contours, floor and the section). */
const axisAt = (y: number, sway: number): number => W / 2 + (14 * Math.sin(y / 170 + 0.8) + 8 * Math.sin(y / 63)) * sway;

/** Where a polyline crosses the horizontal line at y. */
function crossingsAt(pts: readonly Pt[], y: number): number[] {
  const out: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if ((y0 - y) * (y1 - y) <= 0 && y0 !== y1) out.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
  }
  return out;
}

/** Cross-section A–A′ along plan height y, drawn in the inset's 260 × 110 box. */
export function section(p: PlanGeometry, yIn: number): SectionGeometry {
  const y = clamp(yIn, SECTION.min, SECTION.max);
  const half = 120;
  const bed = 96;
  const k = (half * 2) / 552; // plan x 24…576 → section x 10…250
  const toS = (x: number): number => 130 + (x - 300) * k;
  const fw = Math.max(2, p.floorW * k);
  const deep = 18 + p.depth * 64;
  const ax = toS(axisAt(y, p.sway));
  const STEPPED: readonly Pt[] = [[0, 0], [0.1, 0.17], [0.2, 0.18], [0.32, 0.36], [0.44, 0.37], [1, 1]];
  const stepped = (u: number): number => {
    for (let i = 1; i < STEPPED.length; i++) {
      const [u1, l1] = STEPPED[i];
      const [u0, l0] = STEPPED[i - 1];
      if (u <= u1) return l0 + ((u - u0) / (u1 - u0)) * (l1 - l0);
    }
    return 1;
  };
  const prof: Pt[] = [];
  for (let i = 0; i <= 64; i++) {
    const sx = 10 + (i / 64) * half * 2;
    const u = clamp((Math.abs(sx - ax) - fw) / (half - fw));
    const lift = Math.pow(u, 0.78) * (1 - p.terr) + stepped(u) * p.terr;
    prof.push([sx, bed - deep * lift]);
  }
  const ground = `${poly(prof)}L250 106L10 106Z`;
  const ww = Math.max(5, p.width * 1.8);
  const lens = (x: number, w: number): string => `M${f1(x - w)} ${f1(bed - 0.5)}Q${f1(x)} ${f1(bed + 6)} ${f1(x + w)} ${f1(bed - 0.5)}Z`;
  const inBox = (x: number): boolean => x > 14 && x < 246;
  const live = crossingsAt(p.chanPts, y).map(toS).filter(inBox);
  const lakes = crossingsAt(p.loopPts, y).map(toS).filter(inBox);
  return {
    y,
    ground,
    water: live.map((x) => lens(x, ww)).join(''),
    still: lakes.map((x) => lens(x, ww * 0.9)).join(''),
    crossings: live.length,
    lakes: lakes.length,
  };
}

export function valley(tIn: number, sy: number = SECTION.start): ValleyGeometry {
  const p = plan(tIn);
  return { ...p, ...section(p, sy) };
}

export function plan(tIn: number): PlanGeometry {
  const t = clamp(tIn, 0, 4);
  const omega = key(OMEGA, t);
  const floorW = key(FLOOR, t);
  const spacing = key(SPACING, t);
  const width = key(WIDTH, t);
  const depth = key(DEPTH, t);
  const bars = ramp(t, 1.3, 2.05);
  const cut = ramp(t, 2.45, 3.0);
  const oxbow = ramp(t, 2.75, 3.08);
  const terr = ramp(t, 3.35, 4);
  const sway = ramp(t, 1.4, 3);

  // Meanders migrate slowly downstream as the stages pass.
  const { pts, s } = centreline(omega, 0.1 - 0.11 * t);

  // The loop nearest the middle of the plan is the one that will be cut off.
  const perPeriod = N / PERIODS;
  let apex = 0;
  let best = Infinity;
  for (let n = 0; n <= PERIODS * 2 + 1; n++) {
    const i = Math.round((n / 2 - s[0]) / (PERIODS / N));
    if (i < perPeriod * 0.5 || i > N - perPeriod * 0.5) continue;
    const d = Math.abs(pts[i][1] - H * 0.47);
    if (d < best) { best = d; apex = i; }
  }
  let ia = apex;
  let ib = apex;
  if (cut > 0 && apex) {
    let dMin = Infinity;
    const lo = Math.max(1, Math.round(apex - perPeriod * 0.48));
    const hi = Math.min(N - 1, Math.round(apex + perPeriod * 0.48));
    for (let a = lo; a < apex - perPeriod * 0.12; a++) {
      for (let b = Math.round(apex + perPeriod * 0.12); b <= hi; b++) {
        const dx = pts[a][0] - pts[b][0];
        const dy = pts[a][1] - pts[b][1];
        const d = dx * dx + dy * dy;
        if (d < dMin) { dMin = d; ia = a; ib = b; }
      }
    }
  }

  const bypassed = cut >= 0.5 && ib > ia;
  // The new channel leaves and rejoins the old one along the flow direction (a smooth cubic, not a ruler line).
  let shortcut = '';
  if (cut > 0 && ib > ia) {
    const [ax, ay] = pts[ia];
    const [bx, by] = pts[ib];
    const ta = omega * Math.sin(2 * Math.PI * s[ia]);
    const tb = omega * Math.sin(2 * Math.PI * s[ib]);
    const k = Math.hypot(bx - ax, by - ay) * 0.45 + 6;
    shortcut = `C${f1(ax + Math.sin(ta) * k)} ${f1(ay + Math.cos(ta) * k)} ${f1(bx - Math.sin(tb) * k)} ${f1(by - Math.cos(tb) * k)} ${f1(bx)} ${f1(by)}`;
  }
  const channel = bypassed ? `${poly(pts.slice(0, ia + 1))}${shortcut}L${poly(pts.slice(ib)).slice(1)}` : poly(pts);
  // The live channel as points (the shortcut sampled along its cubic), for cross-sections.
  let chanPts: Pt[] = pts;
  if (bypassed) {
    const [ax, ay] = pts[ia];
    const [bx, by] = pts[ib];
    const ta = omega * Math.sin(2 * Math.PI * s[ia]);
    const tb = omega * Math.sin(2 * Math.PI * s[ib]);
    const kk = Math.hypot(bx - ax, by - ay) * 0.45 + 6;
    const c1: Pt = [ax + Math.sin(ta) * kk, ay + Math.cos(ta) * kk];
    const c2: Pt = [bx - Math.sin(tb) * kk, by - Math.cos(tb) * kk];
    const bez: Pt[] = Array.from({ length: 13 }, (_, i) => {
      const u = i / 12;
      const v = 1 - u;
      return [v * v * v * ax + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * bx, v * v * v * ay + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * by];
    });
    chanPts = [...pts.slice(0, ia + 1), ...bez, ...pts.slice(ib)];
  }
  const breach = shortcut ? `M${f1(pts[ia][0])} ${f1(pts[ia][1])}${shortcut}` : '';
  const trim = Math.round((ib - ia) * 0.13 * oxbow);
  const loop = bypassed ? pts.slice(ia + trim, ib - trim + 1) : [];
  const scarPts = loop.map(([x, y]): Pt => [W - x, y - 250]);

  // Sand on the inside of tight bends: offset toward the centre of curvature, drawn dotted.
  const barRuns: Pt[][] = [];
  if (bars > 0.01) {
    let run: Pt[] = [];
    for (let i = 0; i <= N; i += 3) {
      const ph = 2 * Math.PI * s[i];
      const c = Math.cos(ph);
      const inLoop = bypassed && i > ia && i < ib;
      if (Math.abs(c) > 0.55 && !inLoop) {
        const th = omega * Math.sin(ph);
        const side = Math.sign(c);
        const off = width * 1.6 + 7;
        run.push([pts[i][0] + Math.cos(th) * side * off, pts[i][1] - Math.sin(th) * side * off]);
      } else if (run.length) { barRuns.push(run); run = []; }
    }
    if (run.length) barRuns.push(run);
  }

  // Valley sides: contours follow a gently swaying valley axis outside the floor.
  const axis = (y: number): number => axisAt(y, sway);
  const ys = Array.from({ length: 42 }, (_, i) => -20 + i * 20.5);
  const terraceBand = terr * 64;
  const contours: string[] = [];
  for (let k = 1; k <= CONTOURS; k++) {
    for (const side of [-1, 1]) {
      contours.push(poly(ys.map((y): Pt => {
        const wob = 3 * Math.sin(y / 41 + k * 1.7 + side) + 2 * Math.sin(y / 17 + k);
        return [axis(y) + side * (floorW + terraceBand + k * spacing + wob), y];
      })));
    }
  }
  const terraces = [-1, 1].flatMap((side) => [14, 46].map((o) => poly(ys.map((y): Pt => [axis(y) + side * (floorW + o * terr + 2 * Math.sin(y / 29 + o)), y])))).join('');
  const floor = `${poly(ys.map((y): Pt => [axis(y) - floorW, y]))}L${poly([...ys].reverse().map((y): Pt => [axis(y) + floorW, y])).slice(1)}Z`;

  return {
    channel, width,
    breach, breachWidth: width * cut,
    oxbow: poly(loop), oxbowOpacity: oxbow,
    scar: poly(scarPts), scarOpacity: ramp(t, 3.4, 4),
    bars: barRuns.filter((r) => r.length > 1).map(poly).join(''), barsOpacity: bars,
    floor, contours,
    terraces, terraceOpacity: terr,
    chanPts, loopPts: loop, floorW, depth, terr, sway,
  };
}

/** Writes geometry into an SVG rendered by `ValleySvg` (no React render per frame). `plan` and `section` are separate so
 *  a moving section line rewrites a handful of attributes, not the whole drawing. */
export function createPainter(svg: SVGSVGElement): { plan: (g: PlanGeometry) => void; section: (c: SectionGeometry) => void } {
  const q = (k: string) => svg.querySelector<SVGElement>(`[data-k="${k}"]`);
  const el = {
    chan: q('chan'), flow: q('flow'), breach: q('breach'), oxbow: q('oxbow'), scar: q('scar'), bars: q('bars'), floor: q('floor'),
    terr: q('terr'), ground: q('ground'), water: q('water'), still: q('still'), line: q('secline'), a: q('secA'), a2: q('secA2'),
    knob: q('secknob'), label: q('seclabel'),
    contours: Array.from({ length: CONTOURS * 2 }, (_, i) => q(`c${i}`)),
  };
  const set = (e: SVGElement | null, a: string, v: string) => { if (e && e.getAttribute(a) !== v) e.setAttribute(a, v); };
  return {
    plan: (g) => {
      set(el.chan, 'd', g.channel); set(el.chan, 'stroke-width', g.width.toFixed(2));
      set(el.flow, 'd', g.channel); set(el.flow, 'stroke-width', (g.width * 0.34).toFixed(2));
      set(el.breach, 'd', g.breach); set(el.breach, 'stroke-width', g.breachWidth.toFixed(2));
      set(el.oxbow, 'd', g.oxbow); set(el.oxbow, 'opacity', g.oxbowOpacity.toFixed(3)); set(el.oxbow, 'stroke-width', (g.width + 1.5).toFixed(2));
      set(el.scar, 'd', g.scar); set(el.scar, 'opacity', g.scarOpacity.toFixed(3));
      set(el.bars, 'd', g.bars); set(el.bars, 'opacity', g.barsOpacity.toFixed(3));
      set(el.floor, 'd', g.floor);
      set(el.terr, 'd', g.terraces); set(el.terr, 'opacity', g.terraceOpacity.toFixed(3));
      el.contours.forEach((c, i) => set(c, 'd', g.contours[i] ?? ''));
    },
    section: (c) => {
      const y = c.y.toFixed(1);
      set(el.ground, 'd', c.ground); set(el.water, 'd', c.water); set(el.still, 'd', c.still);
      set(el.line, 'd', `M24 ${y}H576`);
      set(el.a, 'y', (c.y - 8).toFixed(1)); set(el.a2, 'y', (c.y - 8).toFixed(1));
      set(el.knob, 'transform', `translate(584 ${y})`);
      if (el.label) { const t = sectionLabel(c); if (el.label.textContent !== t) el.label.textContent = t; }
    },
  };
}

/** The inset's label: what the section line crosses. */
export const sectionLabel = (c: SectionGeometry): string =>
  `A–A′ · river ×${c.crossings}${c.lakes ? ' · oxbow' : ''}`;
