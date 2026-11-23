'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cssEase, useIsomorphicLayoutEffect, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { series: string; format: string; locale: string; duration: number; stagger: number };
type Format = 'integer' | 'currency' | 'compact' | 'percent';

const CURRENCY: Record<string, string> = { 'en-US': 'USD', 'de-DE': 'EUR', 'fr-FR': 'EUR', 'en-IN': 'INR', 'ja-JP': 'JPY' };
const LABEL: Record<Format, string> = {
  integer: 'Seed-library loans this season',
  currency: 'Membership income this month',
  compact: 'Catalogue searches to date',
  percent: 'Workshop seats filled',
};
const COUNT = 8;

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

/** Normalised 0..1 readings for a preset; mapped to a plausible magnitude per format. */
function buildSeries(series: string, format: Format): number[] {
  const rnd = mulberry32(series.length * 31 + 5);
  const unit = Array.from({ length: COUNT }, (_, i) => {
    const u = i / (COUNT - 1);
    if (series === 'steady climb') return Math.min(1, 0.08 + u * 0.8 + rnd() * 0.08);
    if (series === 'countdown') return Math.max(0, 1 - u * 1.02 - rnd() * 0.04) * (i === COUNT - 1 ? 0 : 1);
    return 0.06 + rnd() * 0.9;
  });
  return unit.map((u) => {
    if (format === 'percent') return Math.round(u * 1000) / 1000;
    if (format === 'currency') return Math.round(u * 4820000) / 100;
    if (format === 'compact') return Math.round(u * u * 42_600_000);
    return Math.round(u * 98400);
  });
}

function formatter(format: Format, locale: string): Intl.NumberFormat {
  if (format === 'currency') return new Intl.NumberFormat(locale, { style: 'currency', currency: CURRENCY[locale] ?? 'USD' });
  if (format === 'compact') return new Intl.NumberFormat(locale, { notation: 'compact', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (format === 'percent') return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
}

interface DigitProps { digit: number; dir: 1 | -1; duration: number; delay: number; reduced: boolean }

/** One odometer column. On change it lays out the digits between old and new and rolls through them. */
function Digit({ digit, dir, duration, delay, reduced }: DigitProps) {
  const [roll, setRoll] = useState<{ strip: number[]; dir: 1 | -1; id: number }>({ strip: [digit], dir: 1, id: 0 });
  const shown = useRef(digit);
  const strip = useRef<HTMLSpanElement>(null);
  const anim = useRef<Animation | null>(null);

  useIsomorphicLayoutEffect(() => {
    const from = shown.current;
    if (from === digit) return;
    shown.current = digit;
    if (reduced) { setRoll((r) => ({ strip: [digit], dir: 1, id: r.id + 1 })); return; }
    const seq = [from];
    for (let d = from; d !== digit;) { d = (d + (dir > 0 ? 1 : 9)) % 10; seq.push(d); }
    // Increasing: new digits arrive from below (strip moves up). Decreasing: from above (strip moves down).
    setRoll((r) => ({ strip: dir > 0 ? seq : seq.reverse(), dir, id: r.id + 1 }));
  }, [digit, dir, reduced]);

  useIsomorphicLayoutEffect(() => {
    const el = strip.current;
    anim.current?.cancel();
    anim.current = null;
    const steps = roll.strip.length - 1;
    if (!el || steps < 1 || typeof el.animate !== 'function') return;
    const far = `translateY(${(-steps / (steps + 1)) * 100}%)`;
    const a = el.animate(
      { transform: roll.dir > 0 ? ['translateY(0)', far] : [far, 'translateY(0)'] },
      { duration, delay, easing: cssEase('emphasized'), fill: 'both' },
    );
    anim.current = a;
    const id = roll.id;
    a.finished.then(() => setRoll((r) => (r.id === id ? { strip: [shown.current], dir: 1, id: r.id + 1 } : r)), () => {});
    return () => a.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roll.id]);

  return (
    <span className={styles.digit}>
      <span ref={strip} className={styles.strip}>
        {roll.strip.map((d, i) => <span key={i} className={styles.cell}>{d}</span>)}
      </span>
    </span>
  );
}

export default function NumberTicker({ params }: EffectProps<Params>) {
  const { reduced, scale } = useStudioMotion();
  const format = (['integer', 'currency', 'compact', 'percent'].includes(params.format) ? params.format : 'integer') as Format;
  const values = useMemo(() => buildSeries(params.series, format), [params.series, format]);
  const fmt = useMemo(() => formatter(format, params.locale), [format, params.locale]);
  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  useEffect(() => { setIndex(0); setPrevIndex(null); }, [values]);

  const value = values[index];
  const previous = prevIndex === null ? null : values[prevIndex];
  const diff = previous === null ? 0 : value - previous;
  const dir: 1 | -1 = diff < 0 ? -1 : 1;
  const text = fmt.format(value);
  const chars = Array.from(text);

  const step = (by: number) => { setPrevIndex(index); setIndex((index + by + COUNT) % COUNT); };

  const diffText = format === 'percent'
    ? `${new Intl.NumberFormat(params.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(diff) * 100)} pts`
    : fmt.format(Math.abs(diff));
  const word = diff > 0 ? 'Up' : diff < 0 ? 'Down' : 'No change';
  const live = `${LABEL[format]}: ${text}${previous === null ? '' : diff === 0 ? ', no change' : `, ${word.toLowerCase()} ${diffText} from the previous reading`}.`;

  // Stagger from the least significant digit so the roll reads right-to-left like a mechanical counter.
  let digitOrder = 0;
  const cells = chars.map((_, k) => chars.length - 1 - k).map((fromRight) => {
    const ch = chars[chars.length - 1 - fromRight];
    return /\d/.test(ch) ? { fromRight, ch, digit: Number(ch) } : { fromRight, ch, digit: null };
  });
  const delays = new Map<number, number>();
  for (let k = cells.length - 1; k >= 0; k--) if (cells[k].digit !== null) delays.set(cells[k].fromRight, digitOrder++ * params.stagger * scale.stagger);

  return (
    <div className={styles.root} data-reduced={reduced || undefined}>
      <section className={styles.tile} aria-label={LABEL[format]}>
        <p className={styles.kicker}>
          <span>{LABEL[format]}</span>
          <span className={styles.badge}>Sample data</span>
        </p>

        <p className={styles.srOnly} role="status">{live}</p>

        <div className={styles.number} aria-hidden="true" style={{ ['--chars' as string]: Math.max(4, chars.length) }}>
          {cells.map((c) => c.digit === null
            ? <span key={`${c.fromRight}-s-${c.ch}`} className={styles.symbol}>{c.ch === ' ' || c.ch === ' ' || c.ch === ' ' ? ' ' : c.ch}</span>
            : <Digit key={`${c.fromRight}-d`} digit={c.digit} dir={dir} duration={params.duration * scale.duration} delay={delays.get(c.fromRight) ?? 0} reduced={reduced} />)}
        </div>

        <div className={styles.meta}>
          <p className={styles.delta} data-dir={diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'} aria-hidden="true">
            <span className={styles.arrow}>{diff > 0 ? '▲' : diff < 0 ? '▼' : '■'}</span>
            <span>{previous === null ? 'First reading' : diff === 0 ? 'No change' : `${word} ${diffText}`}</span>
          </p>
          <p className={styles.count}>Reading {index + 1} of {COUNT}</p>
        </div>

        <div className={styles.controls}>
          <button type="button" className={styles.btn} onClick={() => step(-1)}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
            Previous reading
          </button>
          <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={() => step(1)}>
            Next reading
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
          </button>
        </div>
      </section>
    </div>
  );
}
