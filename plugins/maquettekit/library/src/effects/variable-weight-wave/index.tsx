'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { useIsomorphicLayoutEffect, useRafLoop, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { text: string; minWeight: number; maxWeight: number; radius: number; squeeze: boolean; idle: boolean };

/** Width-axis units removed at full influence (Bricolage Grotesque: wdth 75–100). */
const SQUEEZE = 16;
/** Keyboard wave travel speed in letters per second. */
const SWEEP_SPEED = 16;

export default function VariableWeightWave({ params }: EffectProps<Params>) {
  const { text, radius, squeeze, idle } = params;
  const minWeight = Math.min(params.minWeight, params.maxWeight);
  const maxWeight = Math.max(params.minWeight, params.maxWeight);
  const { reduced } = useStudioMotion();

  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const sizer = useRef<HTMLSpanElement>(null);
  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text]);
  /** Word indices per visual line, measured from the hidden sizer. null = not measured yet. */
  const [lines, setLines] = useState<number[][] | null>(null);

  // Mutable simulation state (never triggers a render).
  const sim = useRef({
    letters: [] as HTMLElement[], cx: [] as number[], cy: [] as number[], cur: [] as number[], written: [] as number[],
    fontSize: 16, pointer: false, px: 0, py: 0, key: false, k: 0, kTarget: 0,
  });

  const measureLines = useCallback(() => {
    const el = sizer.current;
    if (!el) return;
    const next: number[][] = [];
    let top = Number.NaN;
    el.querySelectorAll<HTMLElement>('[data-word]').forEach((w, i) => {
      if (w.offsetTop !== top) { top = w.offsetTop; next.push([]); }
      next[next.length - 1].push(i);
    });
    setLines((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  const measureLetters = useCallback(() => {
    const h = heading.current;
    if (!h) return;
    const s = sim.current;
    const box = h.getBoundingClientRect();
    s.letters = Array.from(h.querySelectorAll<HTMLElement>('[data-letter]'));
    s.cx = []; s.cy = [];
    for (const l of s.letters) {
      const r = l.getBoundingClientRect();
      s.cx.push(r.left - box.left + r.width / 2);
      s.cy.push(r.top - box.top + r.height / 2);
    }
    if (s.cur.length !== s.letters.length) { s.cur = s.letters.map(() => 0); s.written = s.letters.map(() => -1); }
    s.fontSize = Number.parseFloat(getComputedStyle(h).fontSize) || 16;
  }, []);

  useIsomorphicLayoutEffect(() => {
    measureLines();
    const el = root.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { measureLines(); measureLetters(); });
    ro.observe(el);
    let alive = true;
    void document.fonts?.ready.then(() => { if (alive) { measureLines(); measureLetters(); } });
    return () => { alive = false; ro.disconnect(); };
  }, [measureLines, measureLetters, words]);

  useIsomorphicLayoutEffect(() => { measureLetters(); }, [measureLetters, lines, words]);

  // Under reduced motion clear any influence written by a previous (animated) run.
  useEffect(() => {
    if (!reduced) return;
    const s = sim.current;
    s.letters.forEach((l) => l.style.removeProperty('--w'));
    s.cur.fill(0); s.written.fill(-1);
  }, [reduced, lines]);

  useRafLoop(root, (dt, t) => {
    const s = sim.current;
    const n = s.letters.length;
    if (!n) return;
    const sigma = Math.max(8, radius * s.fontSize);
    const sigmaLetters = Math.max(0.8, radius * 1.8);
    if (s.key && !s.pointer) {
      const step = SWEEP_SPEED * dt;
      s.k = Math.abs(s.kTarget - s.k) <= step ? s.kTarget : s.k + Math.sign(s.kTarget - s.k) * step;
    }
    const ease = 1 - Math.exp(-dt * (s.pointer ? 14 : 8));
    for (let i = 0; i < n; i++) {
      let target = 0;
      if (s.pointer) {
        const dx = s.px - s.cx[i];
        const dy = (s.py - s.cy[i]) * 0.55; // lines above/below feel the wave a little
        target = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      } else if (s.key) {
        const d = i - s.k;
        target = Math.exp(-(d * d) / (2 * sigmaLetters * sigmaLetters));
      } else if (idle) {
        const wave = 0.5 + 0.5 * Math.sin(t * 1.5 - i * 0.38);
        target = 0.42 * wave * wave;
      }
      const v = s.cur[i] + (target - s.cur[i]) * ease;
      s.cur[i] = v;
      if (Math.abs(v - s.written[i]) > 0.004) {
        s.written[i] = v;
        s.letters[i].style.setProperty('--w', v.toFixed(3));
      }
    }
  }, !reduced);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const h = heading.current;
    if (!h || e.pointerType === 'touch') return;
    const box = h.getBoundingClientRect();
    const s = sim.current;
    s.pointer = true; s.px = e.clientX - box.left; s.py = e.clientY - box.top;
  };
  const onPointerLeave = () => { sim.current.pointer = false; };

  const onFocus = (e: FocusEvent<HTMLHeadingElement>) => {
    if (!e.currentTarget.matches(':focus-visible')) return;
    const s = sim.current;
    // Sweep in from before the first letter and come to rest on the last one.
    s.key = true; s.k = -3; s.kTarget = Math.max(0, s.letters.length - 1);
  };
  const onBlur = () => { sim.current.key = false; };
  const onKeyDown = (e: KeyboardEvent<HTMLHeadingElement>) => {
    const s = sim.current;
    const last = Math.max(0, s.letters.length - 1);
    const from = Math.min(last, Math.max(0, Math.round(s.kTarget)));
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = Math.min(last, from + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, from - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    s.key = true; s.kTarget = next;
  };

  const vars = {
    '--vw-min': minWeight,
    '--vw-max': maxWeight,
    '--vw-squeeze': squeeze ? SQUEEZE : 0,
  } as CSSProperties;

  const renderWord = (wi: number) => (
    <span key={wi} className={styles.word}>
      {Array.from(words[wi] ?? '').map((ch, ci) => (
        <span key={ci} data-letter className={styles.letter}>{ch}</span>
      ))}
    </span>
  );

  return (
    <div ref={root} className={styles.root} style={vars} data-reduced={reduced || undefined} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <h2 ref={heading} className={styles.heading} aria-label={text} tabIndex={0} onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown}>
        <span ref={sizer} className={styles.sizer} aria-hidden="true">
          {words.map((w, i) => <span key={i}><span data-word className={styles.word}>{w}</span>{' '}</span>)}
        </span>
        {lines
          ? lines.map((line, li) => (
              <span key={li} className={styles.line} aria-hidden="true">
                {line.filter((wi) => wi < words.length).map((wi, j) => <span key={wi}>{j > 0 ? ' ' : ''}{renderWord(wi)}</span>)}
              </span>
            ))
          : <span className={styles.lineFree} aria-hidden="true">{words.map((_, wi) => <span key={wi}>{wi > 0 ? ' ' : ''}{renderWord(wi)}</span>)}</span>}
      </h2>
      <p className={styles.caption}>
        <span className={styles.axis}>wght {minWeight}–{maxWeight}</span>
        {squeeze ? <span className={styles.axis}>wdth 100–{100 - SQUEEZE}</span> : null}
        <span className={styles.hintText}>{reduced ? 'Motion reduced: static weight' : <>Move across the line, or focus it and use <span className={styles.keys}>← →</span></>}</span>
      </p>
    </div>
  );
}
