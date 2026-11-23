'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { easeCubicInOut, scaleLinear } from 'd3';
import { useElementSize, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { visible: number; stepDuration: number; autoplay: boolean; seed: number };

const NAMES = ['Aster Row', 'Brindle Co.', 'Calloway', 'Dune & Fen', 'Ember Hall', 'Foxglove', 'Garnet Yard', 'Hollis', 'Inkwell', 'Juniper St.'];
const FIRST_YEAR = 2016;
const PERIODS = 10;
const ROW = 44;
const nf = new Intl.NumberFormat('en-US');

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** values[entity][period] — seeded growth curves with different momentum so ranks really change. */
function buildData(seed: number): number[][] {
  const rnd = mulberry32(seed * 104729 + 3);
  return NAMES.map(() => {
    let v = 180 + rnd() * 520;
    let momentum = (rnd() - 0.35) * 0.3;
    return Array.from({ length: PERIODS }, () => {
      momentum = momentum * 0.7 + (rnd() - 0.42) * 0.22;
      v = Math.max(60, v * (1 + momentum));
      return Math.round(v);
    });
  });
}

/** Rank by value (desc), ties broken by index so order is stable. */
function rankOf(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const ranks = new Array<number>(values.length);
  order.forEach(([, i], r) => { ranks[i] = r; });
  return ranks;
}

export default function BarRaceTransition({ params }: EffectProps<Params>) {
  const { reduced, scale } = useStudioMotion();
  const data = useMemo(() => buildData(params.seed), [params.seed]);
  const visible = Math.round(params.visible);
  const scrubId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const { width: trackW } = useElementSize(trackRef);

  /** Continuous position on the period axis: 3.4 = 40 % of the way from period 3 to period 4. */
  const [pos, setPos] = useState(0);
  const [period, setPeriod] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [announce, setAnnounce] = useState('');
  const posRef = useRef(0);
  const raf = useRef(0);
  const timer = useRef(0);

  const stop = useCallback(() => { cancelAnimationFrame(raf.current); window.clearTimeout(timer.current); }, []);
  useEffect(() => stop, [stop]);

  const leaderAt = useCallback((p: number): string => {
    const vals = data.map((d) => d[p]);
    const i = rankOf(vals).indexOf(0);
    return `${FIRST_YEAR + p}: ${NAMES[i]} leads with ${nf.format(vals[i])} subscriptions.`;
  }, [data]);

  const tweenTo = useCallback((to: number, onDone?: () => void) => {
    stop();
    setPeriod(to);
    const from = posRef.current;
    const dur = params.stepDuration * scale.duration * Math.min(1, Math.abs(to - from));
    if (reduced || dur < 1) { posRef.current = to; setPos(to); onDone?.(); return; }
    let t0 = 0;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / dur);
      const v = from + (to - from) * easeCubicInOut(p);
      posRef.current = v;
      setPos(v);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else onDone?.();
    };
    raf.current = requestAnimationFrame(tick);
  }, [params.stepDuration, scale.duration, reduced, stop]);

  const go = useCallback((to: number) => {
    const p = Math.min(PERIODS - 1, Math.max(0, to));
    setPlaying(false);
    tweenTo(p);
    setAnnounce(leaderAt(p));
  }, [tweenTo, leaderAt]);

  // Playback: tween one period, hold briefly, repeat. Under reduced motion each step is an instant swap on a timer.
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    const hold = reduced ? Math.max(900, params.stepDuration) : 260;
    const advance = () => {
      if (cancelled) return;
      const next = Math.round(posRef.current) + 1;
      if (next > PERIODS - 1) { setPlaying(false); setAnnounce(leaderAt(PERIODS - 1)); return; }
      tweenTo(next, () => { timer.current = window.setTimeout(advance, hold); });
    };
    timer.current = window.setTimeout(advance, reduced ? hold : 0);
    return () => { cancelled = true; stop(); };
  }, [playing, reduced, params.stepDuration, tweenTo, leaderAt, stop]);

  useEffect(() => { if (params.autoplay) setPlaying(true); }, [params.autoplay]);
  useEffect(() => { stop(); setPlaying(false); posRef.current = 0; setPos(0); setPeriod(0); }, [data, stop]);

  const togglePlay = () => {
    if (playing) { setPlaying(false); stop(); const p = Math.round(posRef.current); tweenTo(p); return; }
    if (Math.round(posRef.current) >= PERIODS - 1) { posRef.current = 0; setPos(0); setPeriod(0); }
    setAnnounce('');
    setPlaying(true);
  };

  // Interpolate VALUES between the two neighbouring periods; ranks, bar lengths and the axis all derive from them.
  const i0 = Math.min(PERIODS - 1, Math.floor(pos));
  const i1 = Math.min(PERIODS - 1, i0 + 1);
  const f = pos - i0;
  const values = data.map((d) => d[i0] + (d[i1] - d[i0]) * f);
  const ranks = rankOf(values);
  const maxAt = (p: number): number => Math.max(...data.map((d) => d[p]));
  const x = scaleLinear().domain([0, (maxAt(i0) + (maxAt(i1) - maxAt(i0)) * f) * 1.02]).range([0, Math.max(0, trackW)]);
  const ticks = x.ticks(trackW < 360 ? 3 : 5);
  const finalRanks = rankOf(data.map((d) => d[period]));

  return (
    <div className={styles.root} data-reduced={reduced || undefined}>
      <figure className={styles.figure}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Independent bookshops · active subscriptions</p>
            <p className={styles.year} aria-hidden="true">{FIRST_YEAR + period}</p>
          </div>
          <div className={styles.controls} role="group" aria-label="Period controls">
            <button type="button" className={styles.btn} onClick={() => go(period - 1)} disabled={period === 0 && !playing} aria-label="Previous period">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
            </button>
            <button type="button" className={`${styles.btn} ${styles.play}`} onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
              {playing
                ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3v10M10.5 3v10" /></svg>
                : <svg viewBox="0 0 16 16" aria-hidden="true"><path className={styles.solid} d="M5 3l8 5-8 5z" /></svg>}
              <span>{playing ? 'Pause' : 'Play'}</span>
            </button>
            <button type="button" className={styles.btn} onClick={() => go(period + 1)} disabled={period === PERIODS - 1} aria-label="Next period">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
            </button>
          </div>
        </header>

        <div className={styles.chart} aria-hidden="true" style={{ height: visible * ROW + 22 }}>
          <div ref={trackRef} className={styles.track}>
            {ticks.map((t) => (
              <div key={t} className={styles.tick} style={{ transform: `translateX(${x(t)}px)` }}>
                <span>{nf.format(t)}</span>
              </div>
            ))}
          </div>
          {NAMES.map((name, i) => {
            const r = ranks[i];
            const shown = r < visible;
            const w = x(values[i]);
            return (
              <div
                key={name}
                className={styles.row}
                data-leader={r === 0 || undefined}
                data-hidden={!shown || undefined}
                style={{ transform: `translateY(${22 + Math.min(r, visible) * ROW}px)` }}
              >
                <span className={styles.rank}>{String(r + 1).padStart(2, '0')}</span>
                <span className={styles.name}>{name}</span>
                <span className={styles.barWrap}>
                  <span className={styles.bar} style={{ transform: `scaleX(${trackW > 0 ? w / trackW : 0})` }} />
                  <span className={styles.val} data-inside={w > trackW - 64 || undefined} style={{ transform: `translateX(${w}px)` }}>
                    <span>{nf.format(Math.round(values[i]))}</span>
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <div className={styles.scrub}>
          <label className={styles.srOnly} htmlFor={scrubId}>Period</label>
          <input
            id={scrubId}
            type="range"
            min={0}
            max={PERIODS - 1}
            step={1}
            value={period}
            onChange={(e) => go(Number(e.target.value))}
            aria-valuetext={String(FIRST_YEAR + period)}
            style={{ ['--p' as string]: pos / (PERIODS - 1) }}
          />
          <div className={styles.years} aria-hidden="true">
            <span>{FIRST_YEAR}</span>
            <span>{FIRST_YEAR + PERIODS - 1}</span>
          </div>
        </div>

        <figcaption className={styles.caption}>
          <span className={styles.badge}>Sample data</span>
          <span>Fictional shops and seeded figures. Axis starts at zero; top {visible} of {NAMES.length} shown.</span>
        </figcaption>

        <p className={styles.srOnly} role="status" aria-live="polite">{announce}</p>
        <table className={styles.srOnly}>
          <caption>Active subscriptions by bookshop, {FIRST_YEAR + period} (sample data)</caption>
          <thead><tr><th scope="col">Rank</th><th scope="col">Bookshop</th><th scope="col">Subscriptions</th></tr></thead>
          <tbody>
            {NAMES.map((name, i) => [finalRanks[i], name, data[i][period]] as const).sort((a, b) => a[0] - b[0]).map(([r, name, v]) => (
              <tr key={name}><td>{r + 1}</td><th scope="row">{name}</th><td>{nf.format(v)}</td></tr>
            ))}
          </tbody>
        </table>
      </figure>
    </div>
  );
}
