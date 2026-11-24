'use client';
import { useId, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { createSequence, useIsomorphicLayoutEffect, useRafLoop, useStudioMotion, type EasingToken, type Sequence } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { speed: number; stagger: number; easing: string; fill: boolean; strokeWidth: number };

/* Original line art: a lute, 26 stroked paths + 2 fills on a 240 × 320 grid. Every stroke has pathLength="1". */
const BODY = 'M120 128C152 128 190 160 196 214C202 266 168 300 120 300C72 300 38 266 44 214C50 160 88 128 120 128Z';
const BINDING = 'M120 139C147 139 180 167 185 214C190 258 160 289 120 289C80 289 50 258 55 214C60 167 93 139 120 139Z';
const FRETS = ['M109.7 116H130.3', 'M110.2 99H129.8', 'M110.7 84H129.3', 'M111.1 70H128.9', 'M111.5 57H128.5'];
const PEGS: readonly { line: string; cx: number; cy: number }[] = [
  { line: 'M109 31.6H98.4', cx: 95.8, cy: 31.6 },
  { line: 'M124.4 30.4H135', cx: 137.6, cy: 30.4 },
  { line: 'M105 20.4H94.4', cx: 91.8, cy: 20.4 },
  { line: 'M119.6 17.6H130.2', cx: 132.8, cy: 17.6 },
];
const STRINGS = ['M113 262L114.5 40', 'M117.7 262L118.2 40', 'M122.3 262L121.8 40', 'M127 262L125.5 40'];

/** Draw plan: when each part starts, how long it takes and how it moves (ms at 1×). */
const PLAN: readonly { part: string; at: number; dur: number; ease: EasingToken; stagger?: boolean }[] = [
  { part: 'body', at: 0, dur: 1200, ease: 'inOut' },
  { part: 'binding', at: 350, dur: 900, ease: 'emphasized' },
  { part: 'neck', at: 500, dur: 700, ease: 'standard', stagger: true },
  { part: 'hole', at: 700, dur: 700, ease: 'emphasized' },
  { part: 'rosette', at: 950, dur: 600, ease: 'inOut' },
  { part: 'nut', at: 1150, dur: 220, ease: 'standard' },
  { part: 'pegbox', at: 1200, dur: 600, ease: 'enter' },
  { part: 'frets', at: 1300, dur: 260, ease: 'standard', stagger: true },
  { part: 'pegs', at: 1500, dur: 320, ease: 'emphasized', stagger: true },
  { part: 'bridge', at: 1700, dur: 360, ease: 'exit' },
  { part: 'strings', at: 1800, dur: 700, ease: 'linear', stagger: true },
];
const FILLS = [{ part: 'bodyFill', at: 2500, dur: 700 }, { part: 'holeFill', at: 2650, dur: 500 }];

export default function SvgPathDraw({ params }: EffectProps<Params>) {
  const { reduced, scale } = useStudioMotion();
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const readoutRef = useRef<HTMLOutputElement>(null);
  const seqRef = useRef<Sequence | null>(null);
  const clock = useRef({ start: 0, total: 1 });
  const [playing, setPlaying] = useState(false);

  const show = (p: number) => {
    const v = Math.round(p * 100);
    if (sliderRef.current) { sliderRef.current.value = String(Math.round(p * 1000)); sliderRef.current.setAttribute('aria-valuetext', `${v}% drawn`); }
    if (readoutRef.current) readoutRef.current.textContent = `${v}%`;
  };

  const start = (seq: Sequence) => {
    clock.current = { start: performance.now(), total: Math.max(1, seq.totalDuration) };
    seq.seek(0);
    setPlaying(true);
    void seq.play().then((done) => {
      if (!done || seqRef.current !== seq) return;
      setPlaying(false);
      show(1);
    });
  };

  // One timeline for every stroke and fill; rebuilt only when a parameter changes.
  useIsomorphicLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const k = (reduced ? 1 : scale.duration) / params.speed;
    const q = (part: string) => svg.querySelectorAll(`[data-part="${part}"]`);
    const seq = createSequence();
    for (const s of PLAN) {
      seq.add(q(s.part), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        at: s.at * k,
        duration: s.dur * k,
        easing: params.easing === 'uniform' ? 'standard' : s.ease,
        stagger: s.stagger ? params.stagger * k : 0,
      });
    }
    if (params.fill) for (const f of FILLS) seq.add(q(f.part), [{ fillOpacity: 0 }, { fillOpacity: 1 }], { at: f.at * k, duration: f.dur * k, easing: 'standard' });
    seqRef.current = seq;
    if (reduced) { seq.finish(); setPlaying(false); show(1); } else start(seq);
    return () => { seq.cancel(); if (seqRef.current === seq) seqRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.speed, params.stagger, params.easing, params.fill, reduced, scale.duration]);

  // Slider follows playback (DOM writes only, no re-render per frame).
  useRafLoop(rootRef, () => {
    const c = clock.current;
    show(Math.min(1, (performance.now() - c.start) / c.total));
  }, playing);

  const replay = () => {
    const seq = seqRef.current;
    if (!seq) return;
    if (reduced) {
      seq.finish();
      show(1);
      svgRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear' });
      return;
    }
    start(seq);
  };

  const scrub = (e: ChangeEvent<HTMLInputElement>) => {
    const p = Number(e.currentTarget.value) / 1000;
    seqRef.current?.seek(p);
    setPlaying(false);
    show(p);
  };

  return (
    <div ref={rootRef} className={styles.root} data-fill={params.fill || undefined} style={{ '--sw': params.strokeWidth } as CSSProperties}>
      <figure className={styles.card}>
        <div className={styles.canvas}>
          <svg ref={svgRef} className={styles.art} viewBox="0 0 240 320" role="img" aria-labelledby={`${uid}t ${uid}d`}>
            <title id={`${uid}t`}>Lute, drawn in single lines</title>
            <desc id={`${uid}d`}>An original line drawing of a lute: a pear-shaped body with an inner binding, a round sound hole ringed by a rosette, a fretted neck, four strings running down to a bridge, and a pegbox tilted back with four pegs.</desc>
            <path data-part="bodyFill" className={styles.bodyFill} d={BODY} />
            <circle data-part="holeFill" className={styles.holeFill} cx="120" cy="198" r="20" />
            <g className={styles.lines}>
              <path data-part="body" d={BODY} pathLength={1} />
              <path data-part="binding" className={styles.binding} d={BINDING} pathLength={1} />
              <path data-part="neck" d="M109 132L112 40" pathLength={1} />
              <path data-part="neck" d="M131 132L128 40" pathLength={1} />
              <circle data-part="hole" cx="120" cy="198" r="20" pathLength={1} transform="rotate(-90 120 198)" />
              <circle data-part="rosette" className={styles.rosette} cx="120" cy="198" r="12.5" pathLength={1} transform="rotate(90 120 198)" />
              <path data-part="nut" d="M111 40H129" pathLength={1} />
              <path data-part="pegbox" d="M112 40L102 12L116 8L128 40" pathLength={1} />
              {FRETS.map((d) => <path key={d} data-part="frets" className={styles.fret} d={d} pathLength={1} />)}
              {PEGS.flatMap((p) => [
                <path key={p.line} data-part="pegs" d={p.line} pathLength={1} />,
                <circle key={`${p.cx}`} data-part="pegs" cx={p.cx} cy={p.cy} r="2.6" pathLength={1} />,
              ])}
              <path data-part="bridge" className={styles.bridge} d="M101 262H139" pathLength={1} />
              {STRINGS.map((d) => <path key={d} data-part="strings" className={styles.string} d={d} pathLength={1} />)}
            </g>
          </svg>
        </div>
        <figcaption className={styles.copy}>
          <p className={styles.kicker}>Line study · original art</p>
          <p className={styles.title}>Lute, in twenty‑six strokes</p>
          <p className={styles.dek}>One timeline draws every path through its dash offset. Each part keeps its own easing: the body breathes, frets tick, strings run straight. Then the colour floods in.</p>
          <div className={styles.controls}>
            <button type="button" className={styles.replay} onClick={replay}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Replay
            </button>
            <label className={styles.scrub}>
              <span className={styles.scrubLabel}>Timeline</span>
              <input ref={sliderRef} type="range" min={0} max={1000} step={1} defaultValue={1000} aria-valuetext="100% drawn" onChange={scrub} />
            </label>
            <output ref={readoutRef} className={styles.readout} aria-hidden="true">100%</output>
          </div>
        </figcaption>
      </figure>
    </div>
  );
}
