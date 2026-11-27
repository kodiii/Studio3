'use client';
/**
 * LottieIcon — a real toggle button (aria-pressed) or disclosure button (aria-expanded) whose icon is a Lottie
 * animation played in segments. Content-agnostic: pass any Bodymovin JSON plus its segment map.
 *
 * - lottie-web's light SVG player is imported lazily, once, on first mount; each icon owns one instance, destroyed
 *   on unmount. Until it is ready (or where it cannot run) a static SVG of the rest frame is shown instead.
 * - Colours come from CSS: fills and strokes tagged `lmi-fl|lmi-st` + `lmi-ink|tint|solid|on|knock` (see
 *   ./lottie-kit) follow the theme tokens live; untagged shapes keep the colours in the data.
 * - Reduced motion: no hover previews; state changes jump to the rest frame under a 160 ms cross-fade.
 * - `ref` reaches the <button>, and `data-*` / `aria-*` props land on it (a cursor magnet, a View Transition origin,
 *   aria-describedby); the state attributes the icon owns (aria-pressed / aria-expanded / aria-controls, its name and
 *   data-state) always win.
 */
import { createElement, useEffect, useImperativeHandle, useMemo, useRef, useState, type AriaAttributes, type CSSProperties, type ReactNode, type Ref } from 'react';
import type { LottiePlayer } from 'lottie-web/build/player/lottie_light';
import { duration, useIsomorphicLayoutEffect, useStudioMotion } from '../../motion';
import { renderFrame, type LottieAnimation, type SvgNode } from './lottie-kit';
import { IconPlayer, type PlayerSnapshot } from './player';
import type { LottieSegments } from './segments';
import styles from './LottieIcon.module.css';

let lottieReady: LottiePlayer | null = null;
let lottieLoading: Promise<LottiePlayer> | null = null;

/** lottie-web's light SVG player, loaded on first use and shared by every icon. */
function loadLottie(): Promise<LottiePlayer> {
  // A plain promise chain (no await) so nothing outside lottie-web owns the module's evaluation.
  lottieLoading ??= import('lottie-web/build/player/lottie_light').then((m) => {
    const lottie = ((m as { default?: LottiePlayer }).default ?? m) as LottiePlayer;
    if (typeof lottie?.loadAnimation !== 'function') throw new Error('lottie-web is not available here');
    lottieReady = lottie;
    return lottie;
  });
  return lottieLoading;
}

export interface LottieIconHandle {
  /** Show any frame (direct manipulation). */
  scrub: (frame: number) => void;
  /** End a scrub: play from the shown frame to the rest pose of the current state. */
  release: () => void;
}

/** `data-*` attributes, passed to the button. */
type DataAttributes = { [key: `data-${string}`]: string | number | boolean | undefined };

export interface LottieIconProps extends AriaAttributes, DataAttributes {
  /** Bodymovin JSON. It is copied before lottie-web sees it (the player mutates its input). Keep it referentially stable. */
  animationData: object;
  /** Frame ranges of the transitions and the hover wind-up. */
  segments: LottieSegments;
  /** Accessible name. Constant: the state is carried by aria-pressed / aria-expanded. */
  label: string;
  /** Controlled state. Omit to let the button keep its own (starting at `defaultPressed`). */
  pressed?: boolean;
  defaultPressed?: boolean;
  onToggle?: (pressed: boolean) => void;
  /** `toggle` → aria-pressed; `disclosure` → aria-expanded (+ `controls`). */
  kind?: 'toggle' | 'disclosure';
  controls?: string;
  /** Rendered size in px of the design grid (`grid` composition units; the rest of the composition is bleed). */
  size?: number;
  grid?: number;
  /** Playback rate (1 = authored timing). */
  speed?: number;
  /** Preview the wind-up on hover and keyboard focus. */
  hover?: boolean;
  /** Force reduced motion on or off; defaults to useStudioMotion().reduced. */
  reduced?: boolean;
  /** Shown until lottie-web paints, and wherever it cannot run. `'auto'` renders the rest frame of shape-layer data. */
  fallback?: ReactNode | 'auto';
  className?: string;
  style?: CSSProperties;
  /** Visible content after the icon (a caption). When present it names the button and `label` is not used. */
  children?: ReactNode;
  /** Called with the frame on screen while the icon plays or is scrubbed. */
  onFrame?: (frame: number) => void;
  handle?: Ref<LottieIconHandle>;
  /** The <button> element. */
  ref?: Ref<HTMLButtonElement>;
}

/** Only `data-*` and `aria-*` keys reach the DOM from the rest props. */
function passThrough(rest: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k in rest) if (k.startsWith('data-') || k.startsWith('aria-')) out[k] = rest[k];
  return out;
}

const ATTR: Record<string, string> = {
  class: 'className', 'fill-opacity': 'fillOpacity', 'fill-rule': 'fillRule', 'stroke-opacity': 'strokeOpacity',
  'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin',
};
const toReact = (n: SvgNode, key: number): ReactNode => {
  const props: Record<string, string | number> = { key };
  for (const [k, v] of Object.entries(n.attrs)) props[ATTR[k] ?? k] = v;
  return createElement(n.tag, props, ...(n.children ?? []).map(toReact));
};

/** Fade a frozen copy of the current drawing over the new one (reduced motion: no movement, just a short cross-fade). */
function crossfade(host: HTMLElement | null, live: Set<Animation>, apply: () => void): void {
  const svg = host?.querySelector('svg');
  if (!host || !svg || typeof svg.animate !== 'function') { apply(); return; }
  const ghost = svg.cloneNode(true) as SVGSVGElement;
  ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  ghost.removeAttribute('id');
  ghost.setAttribute('class', styles.ghost);
  host.appendChild(ghost);
  apply();
  const a = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: duration.fast, easing: 'linear', fill: 'forwards' });
  live.add(a);
  const done = () => { live.delete(a); ghost.remove(); };
  a.finished.then(done, done);
}

export function LottieIcon({
  animationData, segments, label, pressed: controlled, defaultPressed = false, onToggle, kind = 'toggle', controls,
  size = 32, grid, speed = 1, hover = true, reduced: reducedProp, fallback = 'auto', className, style, children, onFrame, handle,
  ref, ...rest
}: LottieIconProps) {
  const motion = useStudioMotion();
  const reduced = reducedProp ?? motion.reduced;
  const [own, setOwn] = useState(defaultPressed);
  const pressed = controlled ?? own;
  const data = animationData as LottieAnimation;

  const hostRef = useRef<HTMLSpanElement>(null);
  const glyphRef = useRef<HTMLSpanElement>(null);
  const playerRef = useRef<IconPlayer | null>(null);
  const resume = useRef<PlayerSnapshot | null>(null);
  const engaged = useRef({ pointer: false, focus: false });
  const ghosts = useRef(new Set<Animation>());
  const latest = useRef({ pressed, speed, hover, reduced, segments, onFrame });
  latest.current = { pressed, speed, hover, reduced, segments, onFrame };

  // One lottie instance per icon, rebuilt only when the data changes (keeping its frame); destroyed on unmount.
  useEffect(() => {
    const host = hostRef.current;
    const glyph = glyphRef.current;
    if (!host || !glyph) return;
    let alive = true;
    let player: IconPlayer | null = null;
    const stop = () => {
      player?.dispose();
      player = null;
      playerRef.current = null;
      glyph.removeAttribute('data-ready');
    };
    const start = (lottie: LottiePlayer) => {
      if (!alive) return;
      try {
        const copy = JSON.parse(JSON.stringify(data)) as LottieAnimation;
        const anim = lottie.loadAnimation({
          container: host, renderer: 'svg', loop: false, autoplay: false, animationData: copy,
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet', progressiveLoad: false, hideOnTransparent: true },
        });
        anim.addEventListener('error', stop);
        anim.addEventListener('data_failed', stop);
        const s = latest.current;
        player = new IconPlayer(anim, s.segments, s.pressed, copy.op, (f) => latest.current.onFrame?.(f));
        player.setSpeed(s.speed);
        player.setHoverEnabled(s.hover && !s.reduced);
        if (resume.current) player.restore(resume.current);
        player.pointer(engaged.current.pointer);
        player.focus(engaged.current.focus);
        playerRef.current = player;
        if (anim.isLoaded) glyph.setAttribute('data-ready', '');
        else anim.addEventListener('DOMLoaded', () => { if (player) glyph.setAttribute('data-ready', ''); });
      } catch {
        stop();
      }
    };
    if (lottieReady) start(lottieReady);
    else loadLottie().then(start, () => { /* stays on the static fallback */ });
    const live = ghosts.current;
    return () => {
      alive = false;
      resume.current = player ? player.snapshot() : null;
      for (const a of live) a.cancel();
      stop();
    };
  }, [data]);

  // State changes: animate from the frame on screen, or cross-fade to the rest frame when motion is reduced.
  useIsomorphicLayoutEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    if (latest.current.reduced) crossfade(hostRef.current, ghosts.current, () => p.setPressed(pressed, false));
    else p.setPressed(pressed, true);
  }, [pressed]);

  const segKey = JSON.stringify(segments);
  useEffect(() => { playerRef.current?.setSpeed(speed); }, [speed]);
  useEffect(() => { playerRef.current?.setSegments(latest.current.segments); }, [segKey]);
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    p.setHoverEnabled(hover && !reduced);
    if (reduced) p.jumpToRest();
  }, [hover, reduced]);

  useImperativeHandle(handle, () => ({
    scrub: (frame: number) => playerRef.current?.scrub(frame),
    release: () => {
      const p = playerRef.current;
      if (!p) return;
      if (latest.current.reduced) crossfade(hostRef.current, ghosts.current, () => p.release(false));
      else p.release();
    },
  }), []);

  const restFrame = pressed ? segments.on[1] : segments.on[0];
  const auto = fallback === 'auto';
  const staticArt = useMemo(() => {
    if (!auto) return null;
    try { return renderFrame(data, restFrame).map(toReact); } catch { return null; }
  }, [auto, data, restFrame]);

  const box = grid ?? data.w;
  const bleed = Math.max(0, (data.w - box) / 2 / box);
  const engage = (key: 'pointer' | 'focus', on: boolean) => {
    engaged.current[key] = on;
    if (key === 'pointer') playerRef.current?.pointer(on);
    else playerRef.current?.focus(on);
  };

  return (
    <button
      {...passThrough(rest)}
      ref={ref}
      type="button"
      className={className ? `${styles.button} ${className}` : styles.button}
      style={{ ...style, '--lmi-size': `${size}px`, '--lmi-bleed': bleed } as CSSProperties}
      aria-pressed={kind === 'toggle' ? pressed : undefined}
      aria-expanded={kind === 'disclosure' ? pressed : undefined}
      aria-controls={kind === 'disclosure' ? controls : undefined}
      aria-label={children ? undefined : label}
      data-state={pressed ? 'on' : 'off'}
      onClick={() => {
        const next = !pressed;
        if (controlled === undefined) setOwn(next);
        onToggle?.(next);
      }}
      onPointerEnter={(e) => { if (e.pointerType !== 'touch') engage('pointer', true); }}
      onPointerLeave={() => engage('pointer', false)}
      onFocus={(e) => {
        let keyboard = false;
        try { keyboard = e.currentTarget.matches(':focus-visible'); } catch { /* engines without :focus-visible */ }
        if (keyboard) engage('focus', true);
      }}
      onBlur={() => engage('focus', false)}
    >
      <span ref={glyphRef} className={styles.glyph} aria-hidden="true">
        <span ref={hostRef} className={styles.player} />
        {auto ? (
          staticArt ? <svg className={styles.fallback} viewBox={`0 0 ${data.w} ${data.h}`} focusable="false">{staticArt}</svg> : null
        ) : fallback ? <span className={styles.fallback}>{fallback}</span> : null}
      </span>
      {children}
    </button>
  );
}
