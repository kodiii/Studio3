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

export interface ValleyGeometry {
  channel: string; width: number;
  breach: string; breachWidth: number;
  oxbow: string; oxbowOpacity: number;
  scar: string; scarOpacity: number;
  bars: string; barsOpacity: number;
  floor: string;
  contours: string[];
  terraces: string; terraceOpacity: number;
  ground: string; water: string;
}

export function valley(tIn: number): ValleyGeometry {
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
  const axis = (y: number): number => W / 2 + (14 * Math.sin(y / 170 + 0.8) + 8 * Math.sin(y / 63)) * sway;
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

  // Cross-section A–A′ in a 260×110 box: floor half-width and depth from the plan, terraces as steps.
  const half = 120;
  const bed = 96;
  const fw = Math.max(2, (floorW / 300) * half);
  const deep = 18 + depth * 64;
  // Valley-side profile from the floor edge (u = 0) to the rim (u = 1); terraces flatten two short stretches.
  const STEPPED: readonly Pt[] = [[0, 0], [0.1, 0.17], [0.2, 0.18], [0.32, 0.36], [0.44, 0.37], [1, 1]];
  const stepped = (u: number): number => {
    for (let i = 1; i < STEPPED.length; i++) {
      const [u1, l1] = STEPPED[i];
      const [u0, l0] = STEPPED[i - 1];
      if (u <= u1) return l0 + ((u - u0) / (u1 - u0)) * (l1 - l0);
    }
    return 1;
  };
  const section: Pt[] = [];
  for (let i = 0; i <= 64; i++) {
    const dx = -half + (i / 64) * half * 2;
    const u = clamp((Math.abs(dx) - fw) / (half - fw));
    const lift = Math.pow(u, 0.78) * (1 - terr) + stepped(u) * terr;
    section.push([130 + dx, bed - deep * lift]);
  }
  const ground = `${poly(section)}L250 106L10 106Z`;
  const ww = Math.max(5, width * 1.8);
  const water = `M${f1(130 - ww)} ${f1(bed - 0.5)}Q130 ${f1(bed + 6)} ${f1(130 + ww)} ${f1(bed - 0.5)}Z`;

  return {
    channel, width,
    breach, breachWidth: width * cut,
    oxbow: poly(loop), oxbowOpacity: oxbow,
    scar: poly(scarPts), scarOpacity: ramp(t, 3.4, 4),
    bars: barRuns.filter((r) => r.length > 1).map(poly).join(''), barsOpacity: bars,
    floor, contours,
    terraces, terraceOpacity: terr,
    ground, water,
  };
}

/** Writes a geometry into an SVG rendered by `ValleySvg` (no React render per frame). */
export function createPainter(svg: SVGSVGElement): (g: ValleyGeometry) => void {
  const q = (k: string) => svg.querySelector<SVGElement>(`[data-k="${k}"]`);
  const el = {
    chan: q('chan'), breach: q('breach'), oxbow: q('oxbow'), scar: q('scar'), bars: q('bars'), floor: q('floor'),
    terr: q('terr'), ground: q('ground'), water: q('water'),
    contours: Array.from({ length: CONTOURS * 2 }, (_, i) => q(`c${i}`)),
  };
  const set = (e: SVGElement | null, a: string, v: string) => { if (e && e.getAttribute(a) !== v) e.setAttribute(a, v); };
  return (g) => {
    set(el.chan, 'd', g.channel); set(el.chan, 'stroke-width', g.width.toFixed(2));
    set(el.breach, 'd', g.breach); set(el.breach, 'stroke-width', g.breachWidth.toFixed(2));
    set(el.oxbow, 'd', g.oxbow); set(el.oxbow, 'opacity', g.oxbowOpacity.toFixed(3)); set(el.oxbow, 'stroke-width', (g.width + 1.5).toFixed(2));
    set(el.scar, 'd', g.scar); set(el.scar, 'opacity', g.scarOpacity.toFixed(3));
    set(el.bars, 'd', g.bars); set(el.bars, 'opacity', g.barsOpacity.toFixed(3));
    set(el.floor, 'd', g.floor);
    set(el.terr, 'd', g.terraces); set(el.terr, 'opacity', g.terraceOpacity.toFixed(3));
    set(el.ground, 'd', g.ground); set(el.water, 'd', g.water);
    el.contours.forEach((c, i) => set(c, 'd', g.contours[i] ?? ''));
  };
}
