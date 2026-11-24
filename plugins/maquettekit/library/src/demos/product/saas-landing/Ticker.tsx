'use client';
/**
 * Odometer figure — the number-ticker recipe's rolling digit columns (effects/number-ticker), reworked to take any
 * value (the recipe itself only plays its own preset series). The rolling digits are aria-hidden; the formatted value
 * is a single text node for assistive technology.
 */
import { useEffect, useRef, useState } from 'react';
import { cssEase, duration as D, useIsomorphicLayoutEffect } from '../../../motion';
import styles from './styles.module.css';

function Digit({ digit, dir, delay, reduced }: { digit: number; dir: 1 | -1; delay: number; reduced: boolean }) {
  const [roll, setRoll] = useState<{ strip: number[]; dir: 1 | -1; id: number }>({ strip: [digit], dir: 1, id: 0 });
  const shown = useRef(digit);
  const strip = useRef<HTMLSpanElement>(null);

  useIsomorphicLayoutEffect(() => {
    const from = shown.current;
    if (from === digit) return;
    shown.current = digit;
    if (reduced) { setRoll((r) => ({ strip: [digit], dir: 1, id: r.id + 1 })); return; }
    const seq = [from];
    for (let d = from; d !== digit;) { d = (d + (dir > 0 ? 1 : 9)) % 10; seq.push(d); }
    setRoll((r) => ({ strip: dir > 0 ? seq : seq.reverse(), dir, id: r.id + 1 }));
  }, [digit, dir, reduced]);

  useIsomorphicLayoutEffect(() => {
    const el = strip.current;
    const steps = roll.strip.length - 1;
    if (!el || steps < 1 || typeof el.animate !== 'function') return;
    const far = `translateY(${(-steps / (steps + 1)) * 100}%)`;
    const a = el.animate({ transform: roll.dir > 0 ? ['translateY(0)', far] : [far, 'translateY(0)'] }, { duration: D.moderate + steps * 20, delay, easing: cssEase('emphasized'), fill: 'both' });
    const id = roll.id;
    a.finished.then(() => setRoll((r) => (r.id === id ? { strip: [shown.current], dir: 1, id: r.id + 1 } : r)), () => {});
    return () => a.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roll.id]);

  return (
    <span className={styles.tickDigit}>
      <span ref={strip} className={styles.tickStrip}>{roll.strip.map((d, i) => <span key={i} className={styles.tickCell}>{d}</span>)}</span>
    </span>
  );
}

export function Ticker({ value, format, reduced, className }: { value: number; format: (n: number) => string; reduced: boolean; className?: string }) {
  // Direction of travel: compared with the value committed last time (the ref updates after commit).
  const prev = useRef(value);
  useEffect(() => { prev.current = value; }, [value]);

  const text = format(value);
  const chars = Array.from(text);
  let order = 0;
  const cells = chars.map((ch, k) => ({ ch, fromRight: chars.length - 1 - k }));
  const delays = new Map<number, number>();
  for (let k = cells.length - 1; k >= 0; k--) if (/\d/.test(cells[k].ch)) delays.set(cells[k].fromRight, order++ * 28);
  const liveDir: 1 | -1 = value < prev.current ? -1 : 1;

  return (
    <span className={`${styles.ticker} ${className ?? ''}`}>
      <span className={styles.srOnly}>{text}</span>
      <span aria-hidden="true" className={styles.tickRow}>
        {cells.map((c) => /\d/.test(c.ch)
          ? <Digit key={`${c.fromRight}d`} digit={Number(c.ch)} dir={liveDir} delay={delays.get(c.fromRight) ?? 0} reduced={reduced} />
          : <span key={`${c.fromRight}s${c.ch}`} className={styles.tickSymbol}>{c.ch}</span>)}
      </span>
    </span>
  );
}
