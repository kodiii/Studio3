'use client';
import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { spring, useRafLoop, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import { DotField, mixRgb, toRgb, type Influence, type Palette } from './field';
import styles from './styles.module.css';

type Params = { spacing: number; dotSize: number; radius: number; strength: number; ripple: boolean };

const BUCKETS = 5;

/** Re-render trigger when the theme changes (data-theme/class/style on <html>, or the OS colour scheme). */
function useThemeVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((n) => n + 1);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener('change', bump);
    return () => { mo.disconnect(); mq?.removeEventListener('change', bump); };
  }, []);
  return v;
}

export default function DotGridPointerField({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const hintId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef(new DotField());
  const view = useRef({ dpr: 1, palette: { dots: ['#5c5a52'], focus: '#1d4ed8' } as Palette });
  const pointer = useRef<Influence | null>(null);
  const cursor = useRef<Influence | null>(null); // keyboard-driven influence point (drawn as a ring)
  const [active, setActive] = useState(false);
  const theme = useThemeVersion();
  const opts = useRef(params);
  opts.current = params;

  const paint = useCallback(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    field.current.draw(ctx, view.current.dpr, opts.current.dotSize, view.current.palette, cursor.current);
  }, []);

  // Colours from the theme tokens, resolved on the element itself (so an always-dark stage is respected too).
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const cs = getComputedStyle(el);
    const base = toRgb(ctx, cs.getPropertyValue('--s3-ink-muted').trim(), '#5c5a52');
    const hot = toRgb(ctx, cs.getPropertyValue('--s3-signal').trim(), '#bf2f09');
    const dots = Array.from({ length: BUCKETS }, (_, b) => mixRgb(base, hot, b / (BUCKETS - 1)));
    ctx.fillStyle = '#1d4ed8';
    ctx.fillStyle = cs.getPropertyValue('--s3-focus').trim() || '#1d4ed8';
    view.current.palette = { dots, focus: String(ctx.fillStyle) };
    paint();
  }, [theme, paint]);

  // Size (DPR ≤ 2) and re-layout on every resize of the box; spacing changes rebuild the grid too.
  useEffect(() => {
    const box = wrap.current, el = canvas.current;
    if (!box || !el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const w = box.clientWidth, h = box.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      view.current.dpr = dpr;
      el.width = Math.round(w * dpr); el.height = Math.round(h * dpr);
      field.current.layout(w, h, opts.current.spacing);
      if (cursor.current) cursor.current = { x: Math.min(w, cursor.current.x), y: Math.min(h, cursor.current.y) };
      paint();
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [params.spacing, paint]);

  useEffect(() => { paint(); }, [params.dotSize, paint]);

  // The loop runs only while something moves; it stops itself once every spring has settled.
  useRafLoop(wrap, (dt) => {
    const f = field.current;
    let rest = false;
    for (let left = dt; left > 1e-6; left -= 1 / 120) rest = f.step(Math.min(left, 1 / 120), pointer.current ?? cursor.current, opts.current, spring.release);
    paint();
    if (rest) setActive(false);
  }, active && !reduced);

  const wake = () => { if (!reduced) setActive(true); };
  const local = (e: PointerEvent<HTMLDivElement>): Influence => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const ripple = (at: Influence) => {
    if (reduced || !params.ripple) return;
    const f = field.current;
    f.ripples = [...f.ripples.slice(-3), { ...at, age: 0 }];
    wake();
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => { if (reduced) return; pointer.current = local(e); wake(); };
  const onPointerLeave = () => { pointer.current = null; wake(); };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => ripple(local(e));

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (reduced || !e.currentTarget.matches(':focus-visible')) return;
    cursor.current = { x: field.current.w / 2, y: field.current.h / 2 };
    wake();
  };
  const onBlur = () => { cursor.current = null; wake(); paint(); };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (reduced) return;
    const f = field.current;
    const stepPx = params.spacing * (e.shiftKey ? 4 : 1);
    const c = cursor.current ?? { x: f.w / 2, y: f.h / 2 };
    let used = true;
    switch (e.key) {
      case 'ArrowLeft': cursor.current = { x: Math.max(0, c.x - stepPx), y: c.y }; break;
      case 'ArrowRight': cursor.current = { x: Math.min(f.w, c.x + stepPx), y: c.y }; break;
      case 'ArrowUp': cursor.current = { x: c.x, y: Math.max(0, c.y - stepPx) }; break;
      case 'ArrowDown': cursor.current = { x: c.x, y: Math.min(f.h, c.y + stepPx) }; break;
      case 'Enter': case ' ': cursor.current = c; ripple(c); break;
      case 'Escape': cursor.current = null; break;
      default: used = false;
    }
    if (used) { e.preventDefault(); wake(); paint(); }
  };

  return (
    <div className={styles.root}>
      <div
        ref={wrap}
        className={styles.field}
        tabIndex={reduced ? undefined : 0}
        role={reduced ? 'img' : 'application'}
        aria-label={reduced ? 'Dot grid (static: motion is reduced)' : 'Interactive dot field'}
        aria-describedby={hintId}
        aria-keyshortcuts={reduced ? undefined : 'ArrowLeft ArrowRight ArrowUp ArrowDown Enter Escape'}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
      </div>
      <div className={styles.bar}>
        <p id={hintId} className={styles.hint}>
          {reduced
            ? 'Motion is reduced, so the grid stays still.'
            : `Move the pointer through the field${params.ripple ? ' and click to send a ripple' : ''}. Keyboard: focus the field, arrows move the influence${params.ripple ? ', Enter sends a ripple' : ''}, Esc clears it.`}
        </p>
        {params.ripple && !reduced ? (
          <button type="button" className={styles.button} onClick={() => ripple({ x: field.current.w / 2, y: field.current.h / 2 })}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="2" /><circle cx="8" cy="8" r="6" /></svg>
            Send ripple
          </button>
        ) : null}
      </div>
    </div>
  );
}
