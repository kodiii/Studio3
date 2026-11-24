'use client';
/**
 * Odometer figure — the number-ticker recipe's digit columns (effects/number-ticker), reworked to take any value
 * and formatted string from the dashboard. The recipe component ships its own sample series, so it cannot be fed
 * fund data; the rolling-column technique is the same. Durations follow the data-motion guidance (≤ base).
 */
import { useEffect, useRef, useState } from 'react';
import { cssEase, duration as D, stagger as ST, useIsomorphicLayoutEffect, useStudioMotion } from '../../../motion';
import s from './styles.module.css';

interface DigitProps { digit: number; dir: 1 | -1; duration: number; delay: number; roll: boolean }

function Digit({ digit, dir, duration, delay, roll: animate }: DigitProps) {
  const [roll, setRoll] = useState<{ strip: number[]; dir: 1 | -1; id: number }>({ strip: [digit], dir: 1, id: 0 });
  const shown = useRef(digit);
  const strip = useRef<HTMLSpanElement>(null);

  useIsomorphicLayoutEffect(() => {
    const from = shown.current;
    if (from === digit) return;
    shown.current = digit;
    if (!animate) { setRoll((r) => ({ strip: [digit], dir: 1, id: r.id + 1 })); return; }
    const seq = [from];
    for (let d = from; d !== digit;) { d = (d + (dir > 0 ? 1 : 9)) % 10; seq.push(d); }
    setRoll((r) => ({ strip: dir > 0 ? seq : seq.reverse(), dir, id: r.id + 1 }));
  }, [digit, dir, animate]);

  useIsomorphicLayoutEffect(() => {
    const el = strip.current;
    const steps = roll.strip.length - 1;
    if (!el || steps < 1 || typeof el.animate !== 'function') return;
    const far = `translateY(${(-steps / (steps + 1)) * 100}%)`;
    const a = el.animate({ transform: roll.dir > 0 ? ['translateY(0)', far] : [far, 'translateY(0)'] }, { duration, delay, easing: cssEase('emphasized'), fill: 'both' });
    const id = roll.id;
    a.finished.then(() => setRoll((r) => (r.id === id ? { strip: [shown.current], dir: 1, id: r.id + 1 } : r)), () => {});
    return () => a.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roll.id]);

  return (
    <span className={s.digit}>
      <span ref={strip} className={s.strip}>{roll.strip.map((d, i) => <span key={i} className={s.cell}>{d}</span>)}</span>
    </span>
  );
}

/** Rolling figure. The parent renders the accessible text once; this visual copy is aria-hidden. */
export function Ticker({ value, text, animate = true }: { value: number; text: string; animate?: boolean }) {
  const { reduced, scale } = useStudioMotion();
  const last = useRef(value);
  const dir: 1 | -1 = value < last.current ? -1 : 1;
  useEffect(() => { last.current = value; });
  const roll = animate && !reduced;
  const chars = Array.from(text);
  let order = 0;
  const cells = chars.map((ch, k) => ({ ch, fromRight: chars.length - 1 - k }));
  const delays = new Map<number, number>();
  for (let k = cells.length - 1; k >= 0; k--) if (/\d/.test(cells[k].ch)) delays.set(cells[k].fromRight, order++ * ST.tight * 0.5 * scale.stagger);
  return (
    <span className={s.ticker} aria-hidden="true">
      {cells.map((c) => (/\d/.test(c.ch)
        ? <Digit key={`d${c.fromRight}`} digit={Number(c.ch)} dir={dir} roll={roll} duration={D.base * scale.duration} delay={delays.get(c.fromRight) ?? 0} />
        : <span key={`s${c.fromRight}${c.ch}`} className={s.symbol}>{c.ch}</span>))}
    </span>
  );
}
