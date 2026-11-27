'use client';
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode, type RefObject } from 'react';
import { createSequence, useIsomorphicLayoutEffect, useRafLoop } from '../../../motion';
import {
  RIM_R, VIEW, VIEW_H, VIEW_W, along, frameOf, lerp, mm, paintOf, pt, sizeOf, solve, toPct, tyreOf, barOf,
  type BarId, type Build, type ExtraId, type Fit, type Pt,
} from './bike';
import styles from './styles.module.css';

/* Model (y up) → SVG user units (y down). */
const P = (p: Pt) => `${p.x.toFixed(1)} ${(-p.y).toFixed(1)}`;
const off = (c: Pt, dx: number, dy: number): Pt => pt(c.x + dx, c.y + dy);
const seg = (a: Pt, b: Pt) => `M${P(a)}L${P(b)}`;
const onCircle = (c: Pt, r: number, deg: number): Pt => pt(c.x + r * Math.cos((deg * Math.PI) / 180), c.y + r * Math.sin((deg * Math.PI) / 180));
const O = pt(0, 0);

function arc(c: Pt, r: number, a0: number, a1: number, steps = 36): string {
  let d = '';
  for (let i = 0; i <= steps; i++) d += `${i ? 'L' : 'M'}${P(onCircle(c, r, a0 + ((a1 - a0) * i) / steps))}`;
  return d;
}

function spokes(c: Pt, hub: number, rim: number, n = 32): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 360;
    d += `M${P(onCircle(c, hub, a))}L${P(onCircle(c, rim, a + (i % 2 ? 28 : -28)))}`;
  }
  return d;
}

/** External tangent between two circles (chain runs). side −1 = upper run, +1 = lower run for bb → rear. */
function tangent(c1: Pt, r1: number, c2: Pt, r2: number, side: 1 | -1): [Pt, Pt] {
  const dx = c2.x - c1.x, dy = c2.y - c1.y, d = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
  const a = th + side * Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / d)));
  return [pt(c1.x + r1 * Math.cos(a), c1.y + r1 * Math.sin(a)), pt(c2.x + r2 * Math.cos(a), c2.y + r2 * Math.sin(a))];
}

type Tone = 'tape' | 'metal';
interface Stroke { d: string; w: number; tone: Tone }

/** Handlebar silhouettes relative to the stem clamp — shared by the drawing and the option pictograms. */
export function barStrokes(id: BarId, c: Pt): Stroke[] {
  if (id === 'flat') {
    return [
      { d: seg(off(c, 8, 0), off(c, 98, -24)), w: 9, tone: 'metal' },
      { d: seg(off(c, -4, -16), off(c, 12, -30)), w: 14, tone: 'tape' },
      { d: seg(off(c, -2, 2), off(c, 4, 2)), w: 36, tone: 'tape' },
    ];
  }
  if (id === 'swept') {
    return [
      { d: `M${P(c)}C${P(off(c, -30, 8))} ${P(off(c, -92, 22))} ${P(off(c, -150, 20))}`, w: 22, tone: 'metal' },
      { d: seg(off(c, -140, 14), off(c, -104, -22)), w: 9, tone: 'metal' },
      { d: seg(off(c, -150, 20), off(c, -214, 15)), w: 32, tone: 'tape' },
    ];
  }
  return [
    { d: `M${P(off(c, -6, 0))}L${P(off(c, 44, 2))}C${P(off(c, 96, 4))} ${P(off(c, 112, -46))} ${P(off(c, 96, -86))}C${P(off(c, 84, -114))} ${P(off(c, 56, -128))} ${P(off(c, 24, -126))}C${P(off(c, 6, -125))} ${P(off(c, -6, -118))} ${P(off(c, -10, -110))}`, w: 24, tone: 'tape' },
    { d: `M${P(off(c, 88, -12))}C${P(off(c, 100, -48))} ${P(off(c, 94, -80))} ${P(off(c, 80, -98))}`, w: 9, tone: 'metal' },
    { d: seg(off(c, 52, 8), off(c, 84, -4)), w: 30, tone: 'tape' },
  ];
}

/** Small side-on pictogram of a handlebar for the option cards. */
export function BarIcon({ id }: { id: BarId }) {
  const c = pt(0, 0);
  return (
    <svg className={styles.barIcon} viewBox="-235 -40 365 180" aria-hidden="true" focusable="false">
      <path d={seg(pt(-99, -14), c)} className={styles.icStem} strokeWidth={30} />
      {barStrokes(id, c).map((s, i) => <path key={i} d={s.d} strokeWidth={s.w + 10} className={styles.icOutline} />)}
      {barStrokes(id, c).map((s, i) => <path key={i} d={s.d} strokeWidth={s.w} className={s.tone === 'tape' ? styles.icTape : styles.icMetal} />)}
    </svg>
  );
}

const BARS: BarId[] = ['drop', 'flat', 'swept'];

export function describeBuild(b: Build): string {
  const extras = b.extras.length
    ? `, fitted with ${b.extras.map((e) => ({ fenders: 'full-length fenders', rack: 'a rear rack', lights: 'dynamo lighting' })[e]).join(' and ')}`
    : ', no extras';
  const paint = b.frame === 'titanium' ? `raw titanium frame with a ${paintOf(b).name} fork` : `chromoly steel frame in ${paintOf(b).name}`;
  return `Size ${sizeOf(b).name}: ${paint}, ${barOf(b).name.toLowerCase()}, ${tyreOf(b).name} tyres${extras}.`;
}

/** Parts of the drawing that answer the pointer. Each maps to the option group that changes it. */
export type PartId = 'frame' | 'wheels' | 'drivetrain' | 'saddle' | 'cockpit' | 'fenders' | 'rack' | 'lights';

/* ── The drivetrain as a toy with weight ───────────────────────────────────
   Crank, rear wheel and front wheel each have an angle and an angular velocity (deg/s). Drag the crank round and the
   chain drives the rear wheel (a freehub: the wheel may overrun the cranks); drag a wheel and it spins on its own.
   Let go and each keeps its velocity, then slows on bearing friction (stopped well within five seconds). The front
   hub is a dynamo: with lights fitted, they glow with the front wheel's speed. Angles are written straight to the
   rotation groups from a useRafLoop that sleeps when everything stands still. */
const RATIO = 48 / 17;
const MAX_W = 900;
type Spin = 'crank' | 'rear' | 'front';
interface Wheel { a: number; w: number }

export function useDrivetrain(root: RefObject<HTMLElement | null>, reduced: boolean) {
  const sim = useRef<Record<Spin, Wheel>>({ crank: { a: 0, w: 0 }, rear: { a: 0, w: 0 }, front: { a: 0, w: 0 } });
  const groups = useRef<Partial<Record<Spin | 'pedal' | 'chain', SVGElement | null>>>({});
  const chainLen = useRef(1);
  const drag = useRef<{ part: Spin; id: number; centre: { x: number; y: number }; last: number; t: number; w: number; moved: number } | null>(null);
  const pedal = useRef(false);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const wake = () => { if (!runningRef.current) { runningRef.current = true; setRunning(true); } };

  const write = () => {
    const s = sim.current, g = groups.current;
    g.rear?.setAttribute('transform', `rotate(${s.rear.a.toFixed(2)})`);
    g.front?.setAttribute('transform', `rotate(${s.front.a.toFixed(2)})`);
    g.crank?.setAttribute('transform', `rotate(${s.crank.a.toFixed(2)})`);
    g.pedal?.setAttribute('transform', `rotate(${(-s.crank.a).toFixed(2)})`);
    // The chain moves with the chainring's teeth (89-unit pitch radius).
    g.chain?.setAttribute('stroke-dashoffset', (-((s.crank.a * Math.PI) / 180) * 89 / chainLen.current * 100).toFixed(3));
    root.current?.style.setProperty('--dynamo', Math.min(1, Math.abs(s.front.w) / 540).toFixed(3));
  };
  // React re-renders the drawing during geometry tweens; re-apply the current angles after every render.
  useIsomorphicLayoutEffect(() => { write(); });

  useRafLoop(root, (dt) => {
    const s = sim.current, d = drag.current;
    for (const k of ['crank', 'rear', 'front'] as Spin[]) {
      if (d?.part === k) continue;
      const wh = s[k];
      if (k === 'crank' && pedal.current) wh.w += (300 - wh.w) * (1 - Math.exp(-dt * 5));
      else if (reduced) wh.w = 0;
      else {
        const tau = k === 'crank' ? 0.45 : 0.85;
        wh.w *= Math.exp(-dt / tau);
        wh.w -= Math.sign(wh.w) * Math.min(Math.abs(wh.w), 45 * dt);
      }
      wh.a += wh.w * dt;
    }
    // Freehub: pedalling forward drives the rear wheel; spinning the wheel backwards drags the cranks with it.
    if (s.crank.w > 0 && s.rear.w < s.crank.w * RATIO) { s.rear.w = s.crank.w * RATIO; if (d?.part !== 'rear') s.rear.a += 0; }
    if (d?.part === 'rear' && s.rear.w < 0) { s.crank.w = s.rear.w / RATIO; }
    write();
    const still = !d && !pedal.current && Math.abs(s.crank.w) < 2 && Math.abs(s.rear.w) < 2 && Math.abs(s.front.w) < 2;
    if (still) { s.crank.w = 0; s.rear.w = 0; s.front.w = 0; write(); runningRef.current = false; setRunning(false); }
  }, running);

  const angleAt = (e: { clientX: number; clientY: number }, c: { x: number; y: number }) => (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI;

  /** Start a drag on a rotating part; `centre` is the axle in page coordinates. */
  const grab = (part: Spin, e: RPointerEvent<SVGElement>, centre: { x: number; y: number }) => {
    if (e.button !== 0) return false;
    drag.current = { part, id: e.pointerId, centre, last: angleAt(e, centre), t: performance.now(), w: 0, moved: 0 };
    sim.current[part].w = 0;
    wake();
    return true;
  };
  const move = (e: RPointerEvent<SVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const a = angleAt(e, d.centre);
    let delta = a - d.last;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const now = performance.now(), dt = Math.max(1, now - d.t) / 1000;
    d.last = a; d.t = now; d.moved += Math.abs(delta);
    d.w = d.w * 0.6 + (delta / dt) * 0.4;
    const wh = sim.current[d.part];
    wh.a += delta;
    wh.w = d.w;
    if (d.part === 'crank' && delta > 0) { const r = sim.current.rear; r.a += delta * RATIO; r.w = Math.max(r.w, d.w * RATIO); }
    if (d.part === 'rear' && delta < 0) sim.current.crank.a += delta / RATIO;
  };
  /** Release keeps the throw (clamped); returns how far the part turned, so a press without a turn can act as a click. */
  const release = (e: RPointerEvent<SVGElement>): number => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return 0;
    drag.current = null;
    const wh = sim.current[d.part];
    wh.w = reduced || performance.now() - d.t > 90 ? 0 : Math.max(-MAX_W, Math.min(MAX_W, d.w));
    wake();
    return d.moved;
  };
  /** Button twins: hold to pedal; a flick of the front wheel. */
  const setPedal = (on: boolean) => { pedal.current = on; wake(); };
  const flick = (part: Spin, w: number) => { if (reduced) { sim.current[part].a += Math.sign(w) * 90; write(); return; } sim.current[part].w += w; wake(); };
  return { groups, chainLen, grab, move, release, setPedal, flick, dragging: () => !!drag.current };
}

export type Drive = ReturnType<typeof useDrivetrain>;

interface DrawingProps {
  build: Build; fit: Fit; uid: string; reduced: boolean; drive: Drive;
  /** Paint currently on the frame; while a new colour flows along the tubes this is still the old one. */
  shownPaint: string;
  flow: { key: number; colour: string } | null;
  onFlowEnd: () => void;
  hover: PartId | null;
  onHover: (p: PartId | null) => void;
  onPick: (p: PartId) => void;
  /** Controls laid over the drawing (the button twins of the drag). */
  children?: ReactNode;
}

const LABEL: Record<PartId, (b: Build) => string> = {
  frame: (b) => (b.frame === 'titanium' ? `Frame · raw titanium, ${paintOf(b).name} fork` : `Frame · chromoly in ${paintOf(b).name}`),
  wheels: (b) => `Wheels · ${tyreOf(b).name} · drag to spin`,
  drivetrain: () => 'Cranks · drag round to pedal',
  saddle: (b) => `Saddle height · size ${sizeOf(b).name}`,
  cockpit: (b) => `Handlebar · ${barOf(b).name}`,
  fenders: () => 'Full-length fenders',
  rack: () => 'Rear rack',
  lights: () => 'Dynamo lights · spin the front wheel',
};

export function BikeDrawing({ build, fit, uid, reduced, drive, shownPaint, flow, onFlowEnd, hover, onHover, onPick, children }: DrawingProps) {
  const s = solve(fit);
  const svg = useRef<SVGSVGElement>(null);
  const flowRef = useRef<SVGGElement>(null);
  const titanium = frameOf(build).id === 'titanium';
  const paint = paintOf(build);
  const tyre = tyreOf(build);
  const has = (e: ExtraId) => build.extras.includes(e);
  const frameColour = titanium ? 'var(--hc-ti)' : shownPaint;
  const lightPaint = titanium || paint.id === 'chalk' || paint.id === 'marigold';

  const tubes = [
    { k: 'ht', a: along(s.htTop, s.down, -8), b: along(s.htBot, s.down, 6), d: 36 },
    { k: 'tt', a: s.ttFront, b: s.seatCluster, d: 28.6 },
    { k: 'dt', a: s.dtFront, b: s.bb, d: 31.8 },
    { k: 'st', a: s.stTop, b: s.bb, d: 28.6 },
    { k: 'ss', a: s.ssTop, b: s.rear, d: 16 },
    { k: 'cs', a: s.bb, b: s.rear, d: 19 },
  ];
  const fork = `M${P(s.crown)}Q${P(s.forkCtrl)} ${P(s.front)}`;
  const crown = seg(s.htBot, along(s.htBot, s.down, 24));

  // Drivetrain (chainring and crank are drawn around their own origin, then placed at the bottom bracket).
  const ringR = 89, cogR = 40;
  const upper = tangent(s.bb, ringR, s.rear, cogR, -1);
  const jockeyHi = off(s.rear, 8, -44), jockeyLo = off(s.rear, 22, -92);
  const lower = tangent(s.bb, ringR, jockeyLo, 13, 1);
  const crankEnd = onCircle(O, 170, -38);
  const chainD = `${seg(upper[0], upper[1])}${seg(lower[0], lower[1])}${seg(off(jockeyLo, -13, 0), off(jockeyHi, -13, 0))}${seg(off(jockeyHi, 13, 0), onCircle(s.rear, cogR, 290))}`;
  drive.chainLen.current = Math.hypot(upper[1].x - upper[0].x, upper[1].y - upper[0].y) + Math.hypot(lower[1].x - lower[0].x, lower[1].y - lower[0].y) + 48 + 60;

  // Fitted extras
  const fenderR = s.radius + 14;
  const platY = s.rear.y + s.radius + 52;
  const rackRear = pt(s.rear.x - 140, platY), rackFront = pt(s.rear.x + 132, platY);
  const t = Math.min(0.98, Math.max(0, (platY + 14 - s.rear.y) / (s.ssTop.y - s.rear.y)));
  const rackAttach = lerp(s.rear, s.ssTop, t);
  const eyelet = off(s.rear, -18, 26);
  const headlight = along(along(s.htBot, s.down, 26), s.perp, 46);
  const tail = has('rack') ? off(rackRear, -6, -26) : has('fenders') ? onCircle(s.rear, fenderR + 4, 168) : along(s.bb, s.stDir, fit.st + 60);
  const beam = `M${P(off(headlight, 30, 10))}L${P(off(headlight, 300, 70))}L${P(off(headlight, 300, -95))}L${P(off(headlight, 30, -10))}Z`;

  // Dimension lines (labels are HTML, laid over the drawing)
  const wbY = s.ground - 70;
  const dtAngle = (Math.atan2(s.dtFront.y - s.bb.y, s.dtFront.x - s.bb.x) * 180) / Math.PI;
  const decal = lerp(s.bb, s.dtFront, 0.56);

  // Paint flows down the tubes from the head tube when the colour changes.
  useIsomorphicLayoutEffect(() => {
    const g = flowRef.current;
    if (!flow || !g) return;
    if (reduced) { onFlowEnd(); return; }
    const paths = [...g.querySelectorAll<SVGPathElement>('path')];
    const seq = createSequence();
    paths.forEach((p, i) => seq.add(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { at: i * 70, duration: 420, easing: 'inOut' }));
    void seq.play().then((done) => { if (done) onFlowEnd(); });
    return () => seq.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow?.key]);

  // Pen-and-ink entrance: outlines draw themselves, then the paint and parts arrive.
  useEffect(() => {
    const el = svg.current;
    if (reduced || !el) return;
    const seq = createSequence()
      .add(el.querySelectorAll('[data-ink]'), [{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }], { duration: 620, stagger: 26, easing: 'inOut', fill: 'backwards' })
      .add(el.querySelectorAll('[data-wash]'), [{ opacity: 0 }, { opacity: 1 }], { at: 360, duration: 360, stagger: 60, easing: 'standard', fill: 'backwards' });
    void seq.play();
    return () => seq.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const centreOf = (p: Pt) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    return { x: m.a * p.x + m.c * -p.y + m.e, y: m.b * p.x + m.d * -p.y + m.f };
  };
  const pressed = useRef<{ part: PartId; spin: Spin | null } | null>(null);
  const down = (part: PartId, spin: Spin | null, axle?: Pt) => (e: RPointerEvent<SVGGElement>) => {
    if (e.button !== 0) return;
    pressed.current = { part, spin };
    if (spin && axle && drive.grab(spin, e, centreOf(axle))) svg.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent<SVGSVGElement>) => { drive.move(e); };
  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    const turned = drive.release(e);
    const p = pressed.current;
    pressed.current = null;
    // A press that did not turn anything is a click: it opens the option group that changes this part.
    if (p && turned < 4 && e.type === 'pointerup') onPick(p.part);
  };
  const hoverProps = (part: PartId) => ({
    'data-part': part,
    'data-hover': hover === part || undefined,
    onPointerEnter: (e: RPointerEvent<SVGGElement>) => { if (e.pointerType !== 'touch') onHover(part); },
    onPointerLeave: () => { if (!drive.dragging()) onHover(null); },
  });


  return (
    <div className={styles.drawing} data-hovering={hover ?? undefined}>
      <svg ref={svg} className={styles.svg} viewBox={`${VIEW.minX} ${-VIEW.maxY} ${VIEW_W} ${VIEW_H}`} role="img" aria-labelledby={`${uid}-dt ${uid}-dd`} preserveAspectRatio="xMidYMid meet"
        onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={(e) => drive.release(e)}>
        <title id={`${uid}-dt`}>Side elevation of the Hollin Drover</title>
        <desc id={`${uid}-dd`}>{`${describeBuild(build)} Stack ${mm(fit.stack)} mm, reach ${mm(fit.reach)} mm, wheelbase ${mm(s.wheelbase)} mm.`}</desc>
        <defs>
          <linearGradient id={`${uid}-beam`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--hc-beam)" stopOpacity="0.85" />
            <stop offset="1" stopColor="var(--hc-beam)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${uid}-glow`}>
            <stop offset="0" stopColor="var(--hc-tail)" stopOpacity="0.75" />
            <stop offset="1" stopColor="var(--hc-tail)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <path d={seg(pt(VIEW.minX + 40, s.ground), pt(VIEW.maxX - 40, s.ground))} className={styles.ground} />

        <g className={styles.hit} {...hoverProps('wheels')}>
          {([['rear', s.rear], ['front', s.front]] as const).map(([k, c]) => (
            <g key={k} className={styles.wheel} onPointerDown={down('wheels', k, c)}>
              <g transform={`translate(${c.x.toFixed(1)} ${(-c.y).toFixed(1)})`}>
                <circle r={s.radius - fit.tyre / 2} strokeWidth={fit.tyre} className={styles.tyre} />
                <g ref={(el) => { drive.groups.current[k] = el; }}>
                  <circle r={RIM_R - 7} strokeWidth={14} className={styles.rim} pathLength={1} data-ink="" />
                  <path d={spokes(O, k === 'front' && has('lights') ? 26 : 18, RIM_R - 14)} className={styles.spokes} />
                  <circle r={s.radius - fit.tyre * 0.68} strokeWidth={fit.tyre * 0.5} className={`${styles.part} ${styles.tan}`} data-on={tyre.tan} />
                  <circle r={s.radius - 3} strokeWidth={10} strokeDasharray="11 9" className={`${styles.part} ${styles.knobs}`} data-on={tyre.id === 'gravel45'} />
                  <rect x={-5} y={-(RIM_R + 4)} width={10} height={22} rx={3} className={styles.valve} />
                </g>
                <circle r={k === 'front' && has('lights') ? 30 : k === 'rear' ? 22 : 17} className={styles.hub} />
                <circle r={s.radius + 1} className={styles.edge} pathLength={1} data-ink="" />
                <circle r={s.radius - fit.tyre - 1} className={styles.edge} />
              </g>
            </g>
          ))}
        </g>

        <g className={`${styles.part} ${styles.lift} ${styles.hit}`} data-on={has('fenders')} {...hoverProps('fenders')} onPointerDown={down('fenders', null)}>
          <path d={arc(s.front, fenderR, 208, 18)} strokeWidth={17} className={styles.outline} />
          <path d={arc(s.rear, fenderR, 172, 4)} strokeWidth={17} className={styles.outline} />
          <path d={arc(s.front, fenderR, 208, 18)} strokeWidth={11} className={styles.alloy} />
          <path d={arc(s.rear, fenderR, 172, 4)} strokeWidth={11} className={styles.alloy} />
          <path d={seg(onCircle(s.front, fenderR, 208), onCircle(s.front, fenderR + 70, 214))} strokeWidth={9} className={styles.rubber} />
          <path d={`${seg(onCircle(s.front, fenderR - 4, 200), s.front)}${seg(onCircle(s.rear, fenderR - 4, 160), s.rear)}`} className={styles.stay} />
        </g>

        <g className={`${styles.part} ${styles.lift} ${styles.hit}`} data-on={has('rack')} {...hoverProps('rack')} onPointerDown={down('rack', null)}>
          <path d={`${seg(rackRear, rackFront)}${seg(off(rackRear, 20, 0), eyelet)}${seg(off(rackRear, 170, 0), eyelet)}${seg(rackFront, rackAttach)}`} strokeWidth={11} className={styles.rack} />
        </g>

        <g className={styles.hit} {...hoverProps('saddle')} onPointerDown={down('saddle', null)}>
          <path d={seg(along(s.bb, s.stDir, fit.st - 40), s.postTop)} strokeWidth={27} className={styles.metalOutlined} />
          <path d={`M${P(off(s.saddle, -150, -18))}C${P(off(s.saddle, -152, 2))} ${P(off(s.saddle, -110, 6))} ${P(off(s.saddle, -40, 2))}L${P(off(s.saddle, 110, -6))}C${P(off(s.saddle, 122, -8))} ${P(off(s.saddle, 124, -20))} ${P(off(s.saddle, 112, -24))}L${P(off(s.saddle, -30, -30))}C${P(off(s.saddle, -100, -36))} ${P(off(s.saddle, -148, -36))} ${P(off(s.saddle, -150, -18))}Z`} className={styles.saddle} />
          <path d={seg(off(s.saddle, -70, -40), off(s.saddle, 70, -36))} strokeWidth={7} className={styles.alloy} />
        </g>

        <g className={styles.hit} {...hoverProps('frame')} onPointerDown={down('frame', null)}>
          {tubes.map((tb) => <path key={tb.k} d={seg(tb.a, tb.b)} strokeWidth={tb.d + 7} className={styles.outline} pathLength={1} data-ink="" />)}
          <path d={fork} strokeWidth={29} className={styles.outline} pathLength={1} data-ink="" />
          <path d={crown} strokeWidth={47} className={styles.outline} />
          <circle cx={s.bb.x} cy={-s.bb.y} r={26.5} className={styles.outlineFill} />
          <circle cx={s.rear.x} cy={-s.rear.y} r={18.5} className={styles.outlineFill} />

          <g data-wash="">
            {tubes.map((tb) => <path key={tb.k} d={seg(tb.a, tb.b)} strokeWidth={tb.d} className={styles.paint} style={{ stroke: frameColour }} />)}
            <circle cx={s.bb.x} cy={-s.bb.y} r={23} className={styles.paintFill} style={{ fill: frameColour }} />
            <circle cx={s.rear.x} cy={-s.rear.y} r={15} className={styles.paintFill} style={{ fill: frameColour }} />
            <path d={fork} strokeWidth={22} className={styles.paint} style={{ stroke: shownPaint }} />
            <path d={crown} strokeWidth={40} className={styles.paint} style={{ stroke: shownPaint }} />
            <circle cx={s.front.x} cy={-s.front.y} r={14} className={styles.paintFill} style={{ fill: shownPaint }} />
          </g>
          {flow ? (
            <g ref={flowRef} key={flow.key} className={styles.flow} aria-hidden="true">
              <path d={crown} strokeWidth={40} pathLength={1} style={{ stroke: flow.colour }} />
              {(titanium ? [] : tubes).map((tb) => <path key={tb.k} d={seg(tb.a, tb.b)} strokeWidth={tb.d} pathLength={1} style={{ stroke: flow.colour }} />)}
              <path d={fork} strokeWidth={22} pathLength={1} style={{ stroke: flow.colour }} />
            </g>
          ) : null}

          <g className={styles.part} data-on={titanium}>
            {tubes.filter((tb) => tb.k !== 'ht').map((tb) => {
              const n = (() => { const dx = tb.b.x - tb.a.x, dy = tb.b.y - tb.a.y, l = Math.hypot(dx, dy) || 1; return pt(-dy / l, dx / l); })();
              const k = tb.d * 0.22;
              return <path key={tb.k} d={seg(lerp(along(tb.a, n, k), along(tb.b, n, k), 0.08), lerp(along(tb.a, n, k), along(tb.b, n, k), 0.92))} strokeWidth={tb.d * 0.14} className={styles.tiShine} />;
            })}
          </g>

          <circle cx={along(lerp(s.htTop, s.htBot, 0.4), s.perp, 19).x} cy={-along(lerp(s.htTop, s.htBot, 0.4), s.perp, 19).y} r={9} className={styles.badge} />
          <text className={styles.decal} data-light={lightPaint} transform={`translate(${decal.x.toFixed(1)} ${(-decal.y).toFixed(1)}) rotate(${(-dtAngle).toFixed(2)})`}>HOLLIN</text>
        </g>

        <g className={`${styles.hit} ${styles.spin}`} {...hoverProps('drivetrain')} onPointerDown={down('drivetrain', 'crank', s.bb)}>
          <path d={chainD} className={styles.chain} strokeWidth={8} pathLength={100} strokeDasharray="0.9 0.6" ref={(el) => { drive.groups.current.chain = el; }} />
          <path d={seg(off(s.rear, 6, -10), jockeyLo)} strokeWidth={14} className={styles.mech} />
          <circle cx={jockeyHi.x} cy={-jockeyHi.y} r={13} className={styles.jockey} />
          <circle cx={jockeyLo.x} cy={-jockeyLo.y} r={13} className={styles.jockey} />
          <circle cx={s.rear.x} cy={-s.rear.y} r={cogR} strokeWidth={7} className={styles.cog} />
          <g transform={`translate(${s.bb.x.toFixed(1)} ${(-s.bb.y).toFixed(1)})`}>
            <g ref={(el) => { drive.groups.current.crank = el; }}>
              <circle r={ringR} strokeWidth={12} className={styles.ring} />
              <circle r={ringR + 7} strokeWidth={7} strokeDasharray="5 5" className={styles.ring} />
              <path d={seg(O, crankEnd)} strokeWidth={30} className={styles.outline} />
              <path d={seg(O, crankEnd)} strokeWidth={23} className={styles.crank} />
              <g transform={`translate(${crankEnd.x.toFixed(1)} ${(-crankEnd.y).toFixed(1)})`}>
                <g ref={(el) => { drive.groups.current.pedal = el; }}>
                  <path d={seg(pt(-44, -6), pt(44, -6))} strokeWidth={22} className={styles.rubber} />
                </g>
              </g>
            </g>
            <circle r={14} className={styles.hub} />
          </g>
        </g>

        <g className={styles.hit} {...hoverProps('cockpit')} onPointerDown={down('cockpit', null)}>
          <path d={seg(along(s.htTop, s.down, -2), along(s.htTop, s.down, -40))} strokeWidth={30} className={styles.metalOutlined} />
          <path d={seg(s.steererTop, s.clamp)} strokeWidth={34} className={styles.outline} />
          <path d={seg(s.steererTop, s.clamp)} strokeWidth={28} className={styles.stem} />
          {BARS.map((id) => (
            <g key={id} className={`${styles.part} ${styles.drop}`} data-on={build.bar === id}>
              {barStrokes(id, s.clamp).map((st, i) => <path key={`o${i}`} d={st.d} strokeWidth={st.w + 7} className={styles.outline} />)}
              {barStrokes(id, s.clamp).map((st, i) => <path key={`f${i}`} d={st.d} strokeWidth={st.w} className={st.tone === 'tape' ? styles.tape : styles.alloy} />)}
            </g>
          ))}
        </g>

        <g className={`${styles.part} ${styles.lift} ${styles.hit}`} data-on={has('lights')} {...hoverProps('lights')} onPointerDown={down('lights', null)}>
          <path d={beam} fill={`url(#${uid}-beam)`} className={styles.beam} />
          <circle cx={tail.x - 10} cy={-tail.y} r={70} fill={`url(#${uid}-glow)`} className={styles.beam} />
          <path d={`M${P(off(s.front, -8, 28))}Q${P(off(s.forkCtrl, -16, 0))} ${P(along(s.crown, s.perp, 14))}`} className={styles.wire} />
          <path d={seg(along(s.htBot, s.down, 22), headlight)} strokeWidth={8} className={styles.alloy} />
          <rect x={headlight.x - 26} y={-headlight.y - 15} width={52} height={30} rx={9} className={styles.lamp} />
          <circle cx={headlight.x + 22} cy={-headlight.y} r={11} className={styles.lens} />
          <rect x={tail.x - 13} y={-tail.y - 20} width={26} height={40} rx={7} className={styles.tail} />
        </g>

        <g className={styles.dimLines} data-wash="">
          <path d={`${seg(off(s.rear, 0, -s.radius - 14), pt(s.rear.x, wbY - 18))}${seg(off(s.front, 0, -s.radius - 14), pt(s.front.x, wbY - 18))}`} className={styles.ext} />
          <path d={`${seg(pt(s.rear.x, wbY), pt(s.front.x, wbY))}${seg(pt(s.rear.x, wbY - 14), pt(s.rear.x, wbY + 14))}${seg(pt(s.front.x, wbY - 14), pt(s.front.x, wbY + 14))}`} className={styles.dim} />
          <path d={`${seg(pt(s.htTop.x, 0), pt(s.htTop.x, s.htTop.y))}${seg(pt(s.htTop.x - 14, 0), pt(s.htTop.x + 14, 0))}${seg(pt(0, s.htTop.y), pt(s.htTop.x, s.htTop.y))}${seg(pt(0, s.htTop.y - 14), pt(0, s.htTop.y + 14))}`} className={styles.dim} />
          <path d={seg(pt(0, 0), pt(0, s.htTop.y - 14))} className={styles.ext} />
        </g>
      </svg>

      <div className={styles.dims} aria-hidden="true">
        <span className={styles.dimLabel} data-align="start" style={toPct(pt(s.htTop.x + 22, s.htTop.y * 0.5))}>Stack <b>{mm(fit.stack)}</b></span>
        <span className={styles.dimLabel} data-align="center" style={toPct(pt(s.htTop.x * 0.5, s.htTop.y + 40))}>Reach <b>{mm(fit.reach)}</b></span>
        <span className={styles.dimLabel} data-align="center" style={toPct(pt((s.rear.x + s.front.x) / 2, wbY - 44))}>Wheelbase <b>{mm(s.wheelbase)}</b></span>
        {hover ? <span key={hover} className={styles.partTag}>{LABEL[hover](build)}</span> : null}
      </div>
      {children}
    </div>
  );
}
