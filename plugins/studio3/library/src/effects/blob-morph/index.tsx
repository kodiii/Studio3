'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FocusEvent, type PointerEvent } from 'react';
import { cssEase, duration, spring as springs, useIsomorphicLayoutEffect, useRafLoop, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import { blobPath, makeShapes } from './geometry';
import styles from './styles.module.css';

type SpringName = 'glide' | 'settle' | 'release';
type Fill = 'Landscape' | 'Portrait' | 'Solid';
type Params = { points: number; wobble: number; seed: number; drift: boolean; spring: SpringName; fill: Fill };

const FORMS = 6;
const VIEW = 200;
const C = VIEW / 2;
const RADIUS = 88;
const pad = (n: number) => String(n).padStart(2, '0');

interface Anim { x: Float64Array; v: Float64Array; rot: number; vr: number; drift: number; n: number }

function Art({ fill }: { fill: Fill }) {
  if (fill === 'Portrait') {
    return (
      <g>
        <rect width={VIEW} height={VIEW} className={styles.sky} />
        <circle cx={100} cy={92} r={58} className={styles.sun} />
        <path d="M34 214c4-44 30-66 66-66s62 22 66 66z" className={styles.near} />
        <circle cx={100} cy={88} r={31} className={styles.near} />
        <path d="M80 150l20 22 20-22" className={styles.collar} />
      </g>
    );
  }
  if (fill === 'Solid') {
    return (
      <g>
        <rect width={VIEW} height={VIEW} className={styles.sky} />
        <circle cx={70} cy={62} r={120} className={styles.sheen} />
      </g>
    );
  }
  return (
    <g>
      <rect width={VIEW} height={VIEW} className={styles.sky} />
      <g className={styles.rays}>
        {[40, 52, 64, 76, 88, 100].map((y) => <line key={y} x1={0} x2={VIEW} y1={y} y2={y} />)}
      </g>
      <circle cx={124} cy={74} r={28} className={styles.sun} />
      <path d="M0 112c26-14 52-18 80-8s52 10 74 0 34-12 46-8v104H0z" className={styles.far} />
      <path d="M0 130c34-16 64-10 94 2s62 8 106-10v78H0z" className={styles.mid} />
      <path d="M0 150c40-18 84-14 122-2s58 4 78-6v58H0z" className={styles.near} />
    </g>
  );
}

export default function BlobMorph({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId().replace(/:/g, '');
  const maskId = `blob-mask-${uid}`;
  const root = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const ghostRef = useRef<SVGPathElement>(null);
  const echoRef = useRef<SVGPathElement>(null);
  const anim = useRef<Anim | null>(null);
  const target = useRef(0);
  const fades = useRef<Animation[]>([]);
  const [index, setIndex] = useState(0);
  const [moving, setMoving] = useState(false);

  const shapes = useMemo(() => makeShapes(FORMS, params.points, params.wobble, params.seed), [params.points, params.wobble, params.seed]);
  const thumbs = useMemo(() => shapes.map((s) => blobPath(s.radii, s.rotation, 22, 22, 17)), [shapes]);
  const driftOn = params.drift && !reduced;
  const live = useRef({ shapes, cfg: springs[params.spring] ?? springs.glide, driftOn });
  live.current = { shapes, cfg: springs[params.spring] ?? springs.glide, driftOn };

  const paint = useCallback((radii: ArrayLike<number>, rot: number) => {
    const d = blobPath(radii, rot, C, C, RADIUS);
    pathRef.current?.setAttribute('d', d);
    echoRef.current?.setAttribute('d', d);
  }, []);

  // New shape set: a different point count (or reduced motion) cuts to the new form; same count morphs.
  useIsomorphicLayoutEffect(() => {
    const goal = shapes[target.current];
    const a = anim.current;
    if (!a || a.n !== goal.radii.length || reduced) {
      anim.current = { x: Float64Array.from(goal.radii), v: new Float64Array(goal.radii.length), rot: goal.rotation, vr: 0, drift: 0, n: goal.radii.length };
      paint(anim.current.x, anim.current.rot);
    } else setMoving(true);
  }, [shapes, reduced, paint]);

  // Drift toggled: keep the loop alive until its amplitude has eased in or out.
  useEffect(() => { if (!reduced) setMoving(true); }, [driftOn, reduced]);

  useEffect(() => () => { for (const f of fades.current) f.cancel(); fades.current = []; }, []);

  useRafLoop(root, (dt, t) => {
    const a = anim.current;
    if (!a) return;
    const { shapes: list, cfg, driftOn: drifting } = live.current;
    const goal = list[target.current];
    if (!goal || goal.radii.length !== a.n) return;
    const { stiffness: k, damping: c, mass: m } = cfg;
    // Semi-implicit Euler in ≤ 1/120 s substeps: stable for every spring token, frame-rate independent.
    for (let rest = dt; rest > 1e-6; rest -= 1 / 120) {
      const h = Math.min(rest, 1 / 120);
      for (let i = 0; i < a.n; i++) {
        a.v[i] += ((-k * (a.x[i] - goal.radii[i]) - c * a.v[i]) / m) * h;
        a.x[i] += a.v[i] * h;
      }
      a.vr += ((-k * (a.rot - goal.rotation) - c * a.vr) / m) * h;
      a.rot += a.vr * h;
    }
    a.drift += ((drifting ? 1 : 0) - a.drift) * (1 - Math.exp(-dt * 1.6));
    let settled = Math.abs(a.rot - goal.rotation) < 1e-4 && Math.abs(a.vr) < 1e-3 && (drifting || a.drift < 1e-3);
    for (let i = 0; i < a.n && settled; i++) if (Math.abs(a.x[i] - goal.radii[i]) > 1e-4 || Math.abs(a.v[i]) > 1e-3) settled = false;
    if (settled) { a.x.set(goal.radii); a.v.fill(0); a.rot = goal.rotation; a.vr = 0; if (!drifting) a.drift = 0; }
    if (a.drift > 1e-4) {
      // Slow breathing: every anchor swells on its own period (≈ 9–15 s), the whole form turns a few degrees.
      const shown = new Float64Array(a.n);
      for (let i = 0; i < a.n; i++) shown[i] = a.x[i] * (1 + a.drift * 0.04 * Math.sin(t * (0.42 + (i % 4) * 0.09) + i * 2.1));
      paint(shown, a.rot + a.drift * 0.07 * Math.sin(t * 0.19));
    } else paint(a.x, a.rot);
    if (settled && !drifting) setMoving(false);
  }, !reduced && (moving || driftOn));

  const go = useCallback((i: number) => {
    const nextIndex = ((i % FORMS) + FORMS) % FORMS;
    if (nextIndex === target.current) return;
    target.current = nextIndex;
    setIndex(nextIndex);
    const a = anim.current;
    if (!reduced || !a) { setMoving(true); return; }
    // Reduced motion: no morph — cut to the form and cross-fade (≤ 200 ms) from a ghost of the old one.
    const path = pathRef.current, ghost = ghostRef.current;
    const goal = live.current.shapes[nextIndex];
    if (!path || !ghost || !goal || goal.radii.length !== a.n) return;
    ghost.setAttribute('d', path.getAttribute('d') ?? '');
    a.x.set(goal.radii); a.v.fill(0); a.rot = goal.rotation; a.vr = 0;
    paint(a.x, a.rot);
    for (const f of fades.current) f.cancel();
    const opts = { duration: duration.fast, easing: cssEase('standard') };
    fades.current = [path.animate([{ opacity: 0 }, { opacity: 1 }], opts), ghost.animate([{ opacity: 1 }, { opacity: 0 }], opts)];
  }, [reduced, paint]);

  const next = useCallback(() => go(target.current + 1), [go]);
  const onEnter = (e: PointerEvent<HTMLButtonElement>) => { if (e.pointerType !== 'touch') next(); };
  // Keyboard focus morphs; a mouse press also focuses the button, and the click that follows already morphs.
  const onFocus = (e: FocusEvent<HTMLButtonElement>) => { if (e.currentTarget.matches(':focus-visible')) next(); };

  return (
    <div ref={root} className={styles.root}>
      <div className={styles.layout}>
        <button
          type="button"
          className={styles.blob}
          aria-label={`Morph to the next form. Showing form ${index + 1} of ${FORMS}.`}
          onClick={next}
          onPointerEnter={onEnter}
          onFocus={onFocus}
        >
          <svg viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true" focusable="false" className={styles.svg}>
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={VIEW} height={VIEW}>
                <path ref={ghostRef} className={styles.ghost} fill="#fff" />
                <path ref={pathRef} fill="#fff" />
              </mask>
            </defs>
            <path ref={echoRef} className={styles.echo} transform={`translate(${C} ${C}) scale(1.055) translate(${-C} ${-C})`} />
            <g mask={`url(#${maskId})`}>
              <Art fill={params.fill} />
            </g>
          </svg>
        </button>

        <div className={styles.panel}>
          <p className={styles.kicker}>
            <span aria-live="polite">Form {pad(index + 1)} / {pad(FORMS)}</span>
            <span className={styles.meta}>Seed {pad(params.seed)} · {params.points} points</span>
          </p>
          <div role="group" aria-label="Forms" className={styles.thumbs}>
            {thumbs.map((d, i) => (
              <button key={i} type="button" className={styles.thumb} aria-label={`Form ${i + 1}`} aria-pressed={i === index} onClick={() => go(i)}>
                <svg viewBox="0 0 44 44" aria-hidden="true" focusable="false"><path d={d} /></svg>
              </button>
            ))}
          </div>
          <button type="button" className={styles.next} onClick={next}>
            Next form
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
          </button>
          <p className={styles.hint}>
            {reduced ? 'Reduced motion: forms swap with a short cross-fade.' : 'Hover or focus the shape to morph it.'}
          </p>
        </div>
      </div>
    </div>
  );
}
