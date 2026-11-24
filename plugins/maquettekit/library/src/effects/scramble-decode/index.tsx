'use client';
import { useCallback, useEffect, useMemo, useRef, type FocusEvent, type PointerEvent } from 'react';
import { duration as D, useIsomorphicLayoutEffect, useRafLoop, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { text: string; duration: number; churn: number; glyphs: string; seed: number };

const GLYPHS: Record<string, string> = {
  alphanumeric: 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789',
  symbols: '!<>-_\\/[]{}=+*^?#%&',
  binary: '01',
  blocks: '░▒▓█▚▞▙▟',
};

/** Deterministic integer hash of (seed, index, frame): the same inputs always give the same glyph. */
function hash(seed: number, i: number, frame: number): number {
  let h = Math.imul(seed | 0, 374761393) + Math.imul(i | 0, 668265263) + Math.imul(frame | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return (h ^ (h >>> 16)) >>> 0;
}

/** How long a just-resolved character keeps its highlight, in ms. */
const FRESH = 140;

export default function ScrambleDecode({ params }: EffectProps<Params>) {
  const { text, duration, churn, seed } = params;
  const set = GLYPHS[params.glyphs] ?? GLYPHS.alphanumeric;
  const { reduced } = useStudioMotion();

  const root = useRef<HTMLDivElement>(null);
  const visual = useRef<HTMLParagraphElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const run = useRef({ active: false, elapsed: 0, frame: -1, fade: null as Animation | null });

  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text]);
  const chars = useMemo(() => words.flatMap((w) => Array.from(w)), [words]);
  /** Resolve time per character: mostly left-to-right, with a little seeded jitter so it does not look mechanical. */
  const resolveAt = useMemo(() => {
    const n = Math.max(1, chars.length - 1);
    return chars.map((_, i) => ((i / n) * 0.82 + ((hash(seed, i, 9973) % 1000) / 1000) * 0.18) * duration);
  }, [chars, seed, duration]);

  const paint = useCallback((elapsed: number, force = false) => {
    const el = visual.current;
    if (!el) return;
    const r = run.current;
    const frame = Math.floor(elapsed / churn);
    const cells = el.querySelectorAll<HTMLElement>('[data-cell]');
    let done = 0;
    cells.forEach((cell, i) => {
      const at = resolveAt[i] ?? 0;
      const final = chars[i] ?? '';
      let glyph = final;
      let state = 'done';
      if (elapsed < at) { glyph = set[hash(seed, i, frame) % set.length] ?? final; state = 'noise'; }
      else { done++; if (elapsed - at < FRESH && elapsed < duration + FRESH) state = 'fresh'; }
      if (force || frame !== r.frame || state !== cell.dataset.cell) {
        if (cell.textContent !== glyph) cell.textContent = glyph;
        if (cell.dataset.cell !== state) cell.dataset.cell = state;
      }
    });
    r.frame = frame;
    if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, elapsed / Math.max(1, duration)).toFixed(4)})`;
    if (count.current) {
      const label = `${String(done).padStart(2, '0')}/${String(cells.length).padStart(2, '0')}`;
      if (count.current.textContent !== label) count.current.textContent = label;
    }
  }, [chars, churn, duration, resolveAt, seed, set]);

  const start = useCallback(() => {
    const r = run.current;
    if (reduced) {
      paint(duration + FRESH * 2, true);
      r.fade?.cancel();
      r.fade = visual.current?.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: D.fast, easing: 'ease-out' }) ?? null;
      return;
    }
    r.active = true; r.elapsed = 0; r.frame = -1;
    paint(0, true);
  }, [duration, paint, reduced]);

  // Decode on mount, on replay (remount) and whenever a param changes.
  useIsomorphicLayoutEffect(() => {
    const r = run.current;
    if (reduced) { r.active = false; paint(duration + FRESH * 2, true); }
    else start();
    return () => { r.active = false; };
  }, [start, paint, reduced, duration]);
  useEffect(() => () => { run.current.fade?.cancel(); }, []);

  useRafLoop(root, (dt) => {
    const r = run.current;
    if (!r.active) return;
    r.elapsed += dt * 1000;
    paint(r.elapsed);
    if (r.elapsed >= duration + FRESH) { r.active = false; paint(duration + FRESH * 2, true); }
  }, !reduced);

  const onPointerEnter = (e: PointerEvent<HTMLParagraphElement>) => {
    if (e.pointerType === 'mouse' && !reduced && !run.current.active) start();
  };
  const onFocus = (e: FocusEvent<HTMLButtonElement>) => {
    if (e.currentTarget.matches(':focus-visible') && !run.current.active) start();
  };

  let index = 0;
  return (
    <div ref={root} className={styles.root}>
      <div className={styles.head}>
        <span className={styles.label}>Incoming / sample copy</span>
        <span className={styles.count} aria-hidden="true">resolved <span ref={count} className={styles.num}>00/00</span></span>
      </div>
      <div className={styles.body}>
        <p className={styles.srOnly}>{text}</p>
        <p ref={visual} className={styles.text} aria-hidden="true" onPointerEnter={onPointerEnter}>
          {words.map((w, wi) => (
            <span key={wi} className={styles.word}>
              {Array.from(w).map((ch) => {
                const i = index++;
                return <span key={i} data-cell="done" className={styles.cell}>{ch}</span>;
              })}
            </span>
          ))}
        </p>
      </div>
      <div className={styles.foot}>
        <span className={styles.rule} aria-hidden="true"><span ref={bar} className={styles.bar} /></span>
        <button type="button" className={styles.replay} onClick={start} onFocus={onFocus}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Decode again
        </button>
      </div>
    </div>
  );
}
