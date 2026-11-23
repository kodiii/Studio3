'use client';
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

export function BikeDrawing({ build, fit, uid }: { build: Build; fit: Fit; uid: string }) {
  const s = solve(fit);
  const titanium = frameOf(build).id === 'titanium';
  const paint = paintOf(build);
  const tyre = tyreOf(build);
  const has = (e: ExtraId) => build.extras.includes(e);
  const frameColour = titanium ? 'var(--hc-ti)' : paint.colour;
  const lightPaint = titanium || paint.id === 'chalk' || paint.id === 'marigold';

  const tubes = [
    { k: 'cs', a: s.bb, b: s.rear, d: 19 },
    { k: 'ss', a: s.ssTop, b: s.rear, d: 16 },
    { k: 'st', a: s.bb, b: s.stTop, d: 28.6 },
    { k: 'tt', a: s.seatCluster, b: s.ttFront, d: 28.6 },
    { k: 'dt', a: s.bb, b: s.dtFront, d: 31.8 },
    { k: 'ht', a: along(s.htTop, s.down, -8), b: along(s.htBot, s.down, 6), d: 36 },
  ];
  const fork = `M${P(s.crown)}Q${P(s.forkCtrl)} ${P(s.front)}`;
  const crown = seg(s.htBot, along(s.htBot, s.down, 24));

  // Drivetrain
  const ringR = 89, cogR = 40;
  const upper = tangent(s.bb, ringR, s.rear, cogR, -1);
  const jockeyHi = off(s.rear, 8, -44), jockeyLo = off(s.rear, 22, -92);
  const lower = tangent(s.bb, ringR, jockeyLo, 13, 1);
  const crankEnd = onCircle(s.bb, 170, -38);

  // Fitted extras
  const fenderR = s.radius + 14;
  const platY = s.rear.y + s.radius + 52;
  const rackRear = pt(s.rear.x - 140, platY), rackFront = pt(s.rear.x + 132, platY);
  const t = Math.min(0.98, Math.max(0, (platY + 14 - s.rear.y) / (s.ssTop.y - s.rear.y)));
  const rackAttach = lerp(s.rear, s.ssTop, t);
  const eyelet = off(s.rear, -18, 26);
  const headlight = along(along(s.htBot, s.down, 26), s.perp, 46);
  const tail = has('rack') ? off(rackRear, -6, -26) : has('fenders') ? onCircle(s.rear, fenderR + 4, 168) : along(s.bb, s.stDir, fit.st + 60);

  // Dimension lines (labels are HTML, laid over the drawing)
  const wbY = s.ground - 70;
  const dtAngle = (Math.atan2(s.dtFront.y - s.bb.y, s.dtFront.x - s.bb.x) * 180) / Math.PI;
  const decal = lerp(s.bb, s.dtFront, 0.56);

  return (
    <div className={styles.drawing}>
      <svg className={styles.svg} viewBox={`${VIEW.minX} ${-VIEW.maxY} ${VIEW_W} ${VIEW_H}`} role="img" aria-labelledby={`${uid}-dt ${uid}-dd`} preserveAspectRatio="xMidYMid meet">
        <title id={`${uid}-dt`}>Side elevation of the Hollin Drover</title>
        <desc id={`${uid}-dd`}>{`${describeBuild(build)} Stack ${mm(fit.stack)} mm, reach ${mm(fit.reach)} mm, wheelbase ${mm(s.wheelbase)} mm.`}</desc>

        <path d={seg(pt(VIEW.minX + 40, s.ground), pt(VIEW.maxX - 40, s.ground))} className={styles.ground} />

        {[s.rear, s.front].map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={-c.y} r={RIM_R - 7} strokeWidth={14} className={styles.rim} />
            <path d={spokes(c, i === 1 && has('lights') ? 26 : 18, RIM_R - 14)} className={styles.spokes} />
            <circle cx={c.x} cy={-c.y} r={i === 1 && has('lights') ? 30 : i === 0 ? 22 : 17} className={styles.hub} />
            <circle cx={c.x} cy={-c.y} r={s.radius - fit.tyre / 2} strokeWidth={fit.tyre} className={styles.tyre} />
            <circle cx={c.x} cy={-c.y} r={s.radius - fit.tyre * 0.68} strokeWidth={fit.tyre * 0.5} className={`${styles.part} ${styles.tan}`} data-on={tyre.tan} />
            <circle cx={c.x} cy={-c.y} r={s.radius - 3} strokeWidth={10} strokeDasharray="11 9" className={`${styles.part} ${styles.knobs}`} data-on={tyre.id === 'gravel45'} />
            <circle cx={c.x} cy={-c.y} r={s.radius + 1} className={styles.edge} />
            <circle cx={c.x} cy={-c.y} r={s.radius - fit.tyre - 1} className={styles.edge} />
          </g>
        ))}

        <g className={`${styles.part} ${styles.extra}`} data-on={has('fenders')}>
          <path d={arc(s.front, fenderR, 208, 18)} strokeWidth={17} className={styles.outline} />
          <path d={arc(s.rear, fenderR, 172, 4)} strokeWidth={17} className={styles.outline} />
          <path d={arc(s.front, fenderR, 208, 18)} strokeWidth={11} className={styles.alloy} />
          <path d={arc(s.rear, fenderR, 172, 4)} strokeWidth={11} className={styles.alloy} />
          <path d={seg(onCircle(s.front, fenderR, 208), onCircle(s.front, fenderR + 70, 214))} strokeWidth={9} className={styles.rubber} />
          <path d={`${seg(onCircle(s.front, fenderR - 4, 200), s.front)}${seg(onCircle(s.rear, fenderR - 4, 160), s.rear)}`} className={styles.stay} />
        </g>

        <g className={`${styles.part} ${styles.extra}`} data-on={has('rack')}>
          <path d={`${seg(rackRear, rackFront)}${seg(off(rackRear, 20, 0), eyelet)}${seg(off(rackRear, 170, 0), eyelet)}${seg(rackFront, rackAttach)}`} strokeWidth={11} className={styles.rack} />
        </g>

        <path d={seg(along(s.bb, s.stDir, fit.st - 40), s.postTop)} strokeWidth={27} className={styles.metalOutlined} />

        <g>
          {tubes.map((tb) => <path key={tb.k} d={seg(tb.a, tb.b)} strokeWidth={tb.d + 7} className={styles.outline} />)}
          <path d={fork} strokeWidth={29} className={styles.outline} />
          <path d={crown} strokeWidth={47} className={styles.outline} />
          <circle cx={s.bb.x} cy={-s.bb.y} r={26.5} className={styles.outlineFill} />
          <circle cx={s.rear.x} cy={-s.rear.y} r={18.5} className={styles.outlineFill} />

          {tubes.map((tb) => <path key={tb.k} d={seg(tb.a, tb.b)} strokeWidth={tb.d} className={styles.paint} style={{ stroke: frameColour }} />)}
          <circle cx={s.bb.x} cy={-s.bb.y} r={23} className={styles.paintFill} style={{ fill: frameColour }} />
          <circle cx={s.rear.x} cy={-s.rear.y} r={15} className={styles.paintFill} style={{ fill: frameColour }} />
          <path d={fork} strokeWidth={22} className={styles.paint} style={{ stroke: paint.colour }} />
          <path d={crown} strokeWidth={40} className={styles.paint} style={{ stroke: paint.colour }} />
          <circle cx={s.front.x} cy={-s.front.y} r={14} className={styles.paintFill} style={{ fill: paint.colour }} />

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

        <g>
          <path d={`${seg(upper[0], upper[1])}${seg(lower[0], lower[1])}${seg(off(jockeyLo, -13, 0), off(jockeyHi, -13, 0))}${seg(off(jockeyHi, 13, 0), onCircle(s.rear, cogR, 290))}`} className={styles.chain} strokeWidth={8} />
          <path d={seg(off(s.rear, 6, -10), jockeyLo)} strokeWidth={14} className={styles.mech} />
          <circle cx={jockeyHi.x} cy={-jockeyHi.y} r={13} className={styles.jockey} />
          <circle cx={jockeyLo.x} cy={-jockeyLo.y} r={13} className={styles.jockey} />
          <circle cx={s.rear.x} cy={-s.rear.y} r={cogR} strokeWidth={7} className={styles.cog} />
          <circle cx={s.bb.x} cy={-s.bb.y} r={ringR} strokeWidth={12} className={styles.ring} />
          <circle cx={s.bb.x} cy={-s.bb.y} r={ringR + 7} strokeWidth={7} strokeDasharray="5 5" className={styles.ring} />
          <path d={seg(s.bb, crankEnd)} strokeWidth={30} className={styles.outline} />
          <path d={seg(s.bb, crankEnd)} strokeWidth={23} className={styles.crank} />
          <circle cx={s.bb.x} cy={-s.bb.y} r={14} className={styles.hub} />
          <path d={seg(off(crankEnd, -44, -6), off(crankEnd, 44, -6))} strokeWidth={22} className={styles.rubber} />
        </g>

        <g>
          <path d={`M${P(off(s.saddle, -150, -18))}C${P(off(s.saddle, -152, 2))} ${P(off(s.saddle, -110, 6))} ${P(off(s.saddle, -40, 2))}L${P(off(s.saddle, 110, -6))}C${P(off(s.saddle, 122, -8))} ${P(off(s.saddle, 124, -20))} ${P(off(s.saddle, 112, -24))}L${P(off(s.saddle, -30, -30))}C${P(off(s.saddle, -100, -36))} ${P(off(s.saddle, -148, -36))} ${P(off(s.saddle, -150, -18))}Z`} className={styles.saddle} />
          <path d={seg(off(s.saddle, -70, -40), off(s.saddle, 70, -36))} strokeWidth={7} className={styles.alloy} />
          <path d={seg(along(s.htTop, s.down, -2), along(s.htTop, s.down, -40))} strokeWidth={30} className={styles.metalOutlined} />
          <path d={seg(s.steererTop, s.clamp)} strokeWidth={34} className={styles.outline} />
          <path d={seg(s.steererTop, s.clamp)} strokeWidth={28} className={styles.stem} />
          {BARS.map((id) => (
            <g key={id} className={styles.part} data-on={build.bar === id}>
              {barStrokes(id, s.clamp).map((st, i) => <path key={`o${i}`} d={st.d} strokeWidth={st.w + 7} className={styles.outline} />)}
              {barStrokes(id, s.clamp).map((st, i) => <path key={`f${i}`} d={st.d} strokeWidth={st.w} className={st.tone === 'tape' ? styles.tape : styles.alloy} />)}
            </g>
          ))}
        </g>

        <g className={`${styles.part} ${styles.extra}`} data-on={has('lights')}>
          <path d={`M${P(off(s.front, -8, 28))}Q${P(off(s.forkCtrl, -16, 0))} ${P(along(s.crown, s.perp, 14))}`} className={styles.wire} />
          <path d={seg(along(s.htBot, s.down, 22), headlight)} strokeWidth={8} className={styles.alloy} />
          <rect x={headlight.x - 26} y={-headlight.y - 15} width={52} height={30} rx={9} className={styles.lamp} />
          <circle cx={headlight.x + 22} cy={-headlight.y} r={11} className={styles.lens} />
          <rect x={tail.x - 13} y={-tail.y - 20} width={26} height={40} rx={7} className={styles.tail} />
        </g>

        <g className={styles.dimLines}>
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
      </div>
    </div>
  );
}
