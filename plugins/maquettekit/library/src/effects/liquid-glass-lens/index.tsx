'use client';
import {
  useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState,
  type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type Ref, type RefObject,
} from 'react';
import { useStudioMotion } from '../../motion';
import { StudioCanvas } from '../../three';
import type { EffectProps } from '../../types';
import { canvasMeasure, compose, compositionFonts, drawComposition, mix, readTheme, type Theme } from './composition';
import { LensEngine, SHAPE_IDS, type ShapeId } from './engine';
import { GlassFallback, PageSvg } from './fallback';
import { Scene, type GlassLook } from './scene';
import styles from './styles.module.css';

export type { ShapeId } from './engine';

/** Bumps when the document theme changes (class / data-theme / style on <html>, or the OS colour scheme). */
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

function glassLook(t: Theme): GlassLook {
  const p = t.palette;
  // A bright studio for the light page, a dim one for the dark page: the glass reflects ~4% of it face-on, so the
  // ceiling colour sets how much the body veils what is under it.
  return p.dark
    ? { dark: true, envLo: mix(p.paper, '#ffffff', 0.04), envHi: mix(p.paper, '#ffffff', 0.22), light: '#fff7ec', shadow: '#000000', shadowAmount: 0.62, caustic: 1.5 }
    : { dark: false, envLo: mix(p.paper, p.ink, 0.5), envHi: mix(p.paper, p.ink, 0.34), light: '#fffaf2', shadow: '#4d5160', shadowAmount: 0.34, caustic: 0.14 };
}

export interface LensHandle {
  /** Glide the lens back to the centre of the stage. */
  recentre(): void;
}

export interface LiquidGlassLensProps {
  shape: ShapeId;
  /** 0 flat glass … 1.5 heavy bend at the rim. */
  refraction: number;
  /** 0 none … 1 strong colour split at the rim. */
  dispersion: number;
  /** 0 clear … 1 frosted. */
  frost: number;
  /** The highlight and shadow follow the pointer; off keeps the resting upper-left light. */
  followLight: boolean;
  /** Draws the page under the glass in CSS pixels (the context is pre-scaled to the drawing buffer). */
  draw: (g: CanvasRenderingContext2D, width: number, height: number) => void;
  /** Change it to redraw the page texture (theme, fonts or content changed). */
  drawKey: unknown;
  /** The same page as DOM/SVG, shown under a CSS glass panel when WebGL is unavailable. */
  fallback: ReactNode;
  /** Accessible name of the scene; the lens itself is named "Glass lens". */
  label: string;
  description?: string;
  /** Id of visible instructions for the lens; without it the component renders its own (visually hidden). */
  describedBy?: string;
  className?: string;
  ref?: Ref<LensHandle>;
}

/**
 * A draggable liquid-glass lens over any page you can draw: WebGL refraction, dispersion, frost and one moving light,
 * with a CSS glass fallback. The lens is a keyboard control too (arrows, Shift+arrows, Home).
 */
export function LiquidGlassLens({
  shape, refraction, dispersion, frost, followLight, draw, drawKey, fallback, label, description, describedBy, className, ref,
}: LiquidGlassLensProps) {
  const { reduced } = useStudioMotion();
  const ownHint = useId();
  const frame = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const [engine] = useState(() => new LensEngine());
  const wake = useRef<(() => void) | null>(null);
  const onFrame = useRef<(() => void) | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const [cssGlass, setCssGlass] = useState(false);
  const [message, setMessage] = useState('');
  const [look, setLook] = useState<GlassLook>(() => ({ dark: false, envLo: '#8a8780', envHi: '#e0ddd6', light: '#fffaf2', shadow: '#4d5160', shadowAmount: 0.34, caustic: 0.14 }));
  const themeVersion = useThemeVersion();
  const kick = useCallback(() => wake.current?.(), []);

  useEffect(() => { if (frame.current) setLook(glassLook(readTheme(frame.current))); }, [themeVersion]);
  useEffect(() => { engine.reduced = reduced; engine.follow = followLight; kick(); }, [engine, reduced, followLight, kick]);
  const first = useRef(true);
  useEffect(() => { engine.setShape(shape, first.current); first.current = false; kick(); }, [engine, shape, kick]);

  // DOM overlay (focus ring, hit area, CSS glass) follows the lens in the same frame as the canvas, and the frame's
  // own shadow takes the scene's light direction. Writes are skipped when nothing visible changed.
  const last = useRef('');
  const sync = useCallback(() => {
    const el = handle.current, fr = frame.current;
    if (!el || !fr) return;
    const f = engine.frame();
    const corner = f.r * (1 - 0.44 * Math.min(1, Math.max(0, (f.n - 2) / 2.4))); // superellipse ≈ smaller CSS radius
    const key = [f.x, f.y, f.hx, f.hy, corner, f.lx, f.ly, f.lift].map((v) => v.toFixed(2)).join();
    if (key === last.current) return;
    last.current = key;
    el.style.width = `${(2 * f.hx).toFixed(2)}px`;
    el.style.height = `${(2 * f.hy).toFixed(2)}px`;
    el.style.borderRadius = `${corner.toFixed(2)}px`;
    el.style.transform = `translate3d(${(f.x - f.hx).toFixed(2)}px, ${(f.y - f.hy).toFixed(2)}px, 0)`;
    fr.style.setProperty('--lx', f.lx.toFixed(3));
    fr.style.setProperty('--ly', f.ly.toFixed(3));
    fr.style.setProperty('--lift', f.lift.toFixed(3));
  }, [engine]);
  useEffect(() => { onFrame.current = sync; return () => { if (onFrame.current === sync) onFrame.current = null; }; }, [sync]);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => { engine.setSize(el.clientWidth, el.clientHeight); onFrame.current?.(); kick(); };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [engine, kick]);

  // Spoken position after keyboard moves, debounced so held keys do not flood the live region.
  const announceTimer = useRef(0);
  const announce = useCallback((text?: string) => {
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => {
      const { fx, fy } = engine.where();
      setMessage(text ?? `Lens at ${Math.round(fx * 100)}% across, ${Math.round(fy * 100)}% down.`);
    }, 420);
  }, [engine]);
  useEffect(() => () => window.clearTimeout(announceTimer.current), []);

  useImperativeHandle(ref, () => ({ recentre: () => { engine.recentre(); kick(); announce('Lens centred.'); } }), [engine, kick, announce]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = frame.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onFramePointerMove = (e: PointerEvent<HTMLDivElement>) => { const p = local(e); engine.pointerMove(p.x, p.y, true); kick(); };
  const onFramePointerLeave = () => { if (!engine.dragging) { engine.pointerLeave(); kick(); } };
  const onFrameClick = (e: MouseEvent<HTMLDivElement>) => {
    if (handle.current?.contains(e.target as Node)) return;
    const p = local(e);
    engine.placeAt(p.x, p.y);
    kick();
  };
  const onHandleDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    engine.dragStart(p.x, p.y);
    kick();
  };
  const onHandleUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!engine.dragging) return;
    engine.dragEnd();
    if (e.pointerType !== 'mouse') engine.pointerLeave();
    kick();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const step = e.shiftKey ? 64 : 16;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { engine.nudge(...moves[e.key]); announce(); }
    else if (e.key === 'Home') { engine.recentre(); announce('Lens centred.'); }
    else return;
    e.preventDefault();
    kick();
  };

  const onActive = useCallback((on: boolean) => setCssGlass(on), []);
  const glassVars = { '--frost': frost.toFixed(3), '--refract': refraction.toFixed(3), '--disperse': dispersion.toFixed(3) } as Record<string, string>;

  return (
    <div
      ref={frame}
      className={`${styles.frame}${className ? ` ${className}` : ''}`}
      style={glassVars}
      data-css-glass={cssGlass || undefined}
      data-dark={look.dark || undefined}
      onPointerMove={onFramePointerMove}
      onPointerLeave={onFramePointerLeave}
      onClick={onFrameClick}
    >
      <StudioCanvas
        label={label}
        description={description}
        fallback={<GlassFallback engine={engine} wake={wake} onFrame={onFrame} onActive={onActive}>{fallback}</GlassFallback>}
      >
        <Scene engine={engine} draw={drawRef} drawKey={drawKey} refraction={refraction} dispersion={dispersion} frost={frost} look={look} wake={wake} onFrame={onFrame} />
      </StudioCanvas>
      <div
        ref={handle}
        className={styles.lens}
        role="application"
        aria-roledescription="movable lens"
        aria-label="Glass lens"
        aria-describedby={describedBy ?? ownHint}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight Home"
        tabIndex={0}
        onPointerDown={onHandleDown}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
        onLostPointerCapture={onHandleUp}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') { engine.setHover(true); kick(); } }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') { engine.setHover(false); kick(); } }}
        onKeyDown={onKeyDown}
      />
      {describedBy ? null : (
        <p id={ownHint} className={styles.srOnly}>
          {reduced ? 'Drag the lens to move it.' : 'Drag the lens, or throw it.'} Arrow keys move it, Shift with an arrow moves it further, Home centres it.
        </p>
      )}
      <p className={styles.srOnly} role="status">{message}</p>
    </div>
  );
}

type Params = { refraction: number; dispersion: number; frost: number; shape: string; light: boolean };
const isShape = (v: string): v is ShapeId => (SHAPE_IDS as readonly string[]).includes(v);
const SHAPE_LABEL: Record<ShapeId, string> = { pill: 'Pill', circle: 'Circle', squircle: 'Squircle' };
const SHAPE_ICON: Record<ShapeId, string> = {
  pill: 'M5 6.5h8a3.5 3.5 0 010 7H5a3.5 3.5 0 010-7z',
  circle: 'M9 4.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11z',
  squircle: 'M9 4.2c4.3 0 5 .7 5 5.8s-.7 5.8-5 5.8-5-.7-5-5.8.7-5.8 5-5.8z',
};

/**
 * Theme tokens for the sample page, re-read on theme changes and again once the page fonts have loaded. The theme and
 * its version change in the same update, so a redraw keyed on `version` always sees the matching theme.
 */
function usePageTheme(root: RefObject<HTMLElement | null>): { theme: Theme | null; version: number } {
  const themeVersion = useThemeVersion();
  const [state, setState] = useState<{ theme: Theme | null; version: number }>({ theme: null, version: 0 });
  useEffect(() => {
    if (!root.current) return;
    const theme = readTheme(root.current);
    setState((s) => ({ theme, version: s.version + 1 }));
    let alive = true;
    if (document.fonts?.load) {
      Promise.all(compositionFonts(theme.fonts).map((f) => document.fonts.load(f).catch(() => []))).then(() => {
        if (alive) setState((s) => ({ ...s, version: s.version + 1 }));
      });
    }
    return () => { alive = false; };
  }, [root, themeVersion]);
  return state;
}

export default function LiquidGlassLensRecipe({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const hintId = useId();
  const root = useRef<HTMLDivElement>(null);
  const lens = useRef<LensHandle>(null);
  const [shape, setShape] = useState<ShapeId>(isShape(params.shape) ? params.shape : 'pill');
  useEffect(() => { if (isShape(params.shape)) setShape(params.shape); }, [params.shape]);
  const { theme, version } = usePageTheme(root);

  const draw = useCallback((g: CanvasRenderingContext2D, w: number, h: number) => {
    if (theme) drawComposition(g, w, h, compose(w / h, theme, canvasMeasure()));
  }, [theme]);
  const fallback = useMemo(() => <PageSvg theme={theme} />, [theme]);

  return (
    <div ref={root} className={styles.root}>
      <LiquidGlassLens
        ref={lens}
        shape={shape}
        refraction={params.refraction}
        dispersion={params.dispersion}
        frost={params.frost}
        followLight={params.light}
        draw={draw}
        drawKey={version}
        fallback={fallback}
        label="Glass lens over a sample magazine page"
        description="A thick glass lens rests on a typographic proof sheet: a large word, a red sun striped with bars, columns of small text, a colour bar and print marks. Through its flat centre the page is unchanged; around its rim the page bends, splits into colour and catches the light."
        describedBy={hintId}
      />
      <div className={styles.toolbar}>
        <div role="group" aria-label="Lens shape" className={styles.shapes}>
          {SHAPE_IDS.map((id) => (
            <button key={id} type="button" className={styles.shape} aria-pressed={shape === id} onClick={() => setShape(id)}>
              <svg viewBox="0 0 18 20" aria-hidden="true" focusable="false"><path d={SHAPE_ICON[id]} /></svg>
              {SHAPE_LABEL[id]}
            </button>
          ))}
        </div>
        <button type="button" className={styles.centre} onClick={() => lens.current?.recentre()}>
          <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><circle cx="9" cy="9" r="3.2" /><path d="M9 1.5v3.2M9 13.3v3.2M1.5 9h3.2M13.3 9h3.2" /></svg>
          Centre
        </button>
        <p id={hintId} className={styles.hint}>
          {reduced
            ? 'Reduced motion: the lens follows your hand directly and the light stays fixed.'
            : 'Drag or throw the lens, or click the page to send it there.'}{' '}
          <span className={styles.keys}>Arrows move it · Shift for bigger steps · Home centres.</span>
        </p>
      </div>
    </div>
  );
}
