'use client';
/**
 * <CursorFollower scope={ref} /> — a dot and a spring ring that trail the native cursor inside `scope` and react
 * to what is under it. Mark targets with data attributes:
 *   data-cursor="magnet"        the ring wraps the element's rounded rect and pulls it gently toward the pointer
 *   data-cursor-label="View"    the ring blooms into a filled disc showing the label
 *   data-cursor="text"          the ring narrows to a caret that lands between real characters
 *   data-cursor="none"          the follower steps aside (inputs, canvases with their own cursor)
 * The closest marked ancestor of the element under the pointer wins. The native cursor is never hidden.
 */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { spring as SPRING, useRafLoop, useStudioMotion, type SpringConfig, type SpringToken } from '../../motion';
import { FollowerEngine, type CursorState, type FollowerOptions } from './engine';
import { clamp } from './physics';
import styles from './follower.module.css';

export type { CursorState } from './engine';

export interface CursorFollowerProps {
  /** Element the follower lives in. Pass `'document'` to follow across the whole page (opt-in). */
  scope: RefObject<HTMLElement | null> | 'document';
  /** Spring the ring follows with: a motion token or a custom config. Default `release` (keeps velocity). */
  follow?: SpringToken | SpringConfig;
  /** Ring diameter at rest, px. Default 36. */
  size?: number;
  /** Squash and stretch along the direction of travel, 0 (rigid) to 1 (liquid). Default 0.55. */
  stretch?: number;
  /** Invert what is underneath with mix-blend-mode: difference (ring and dot only; labels stay legible). */
  blend?: boolean;
  /** Show the precise dot under the native cursor. Default true. */
  dot?: boolean;
  /** Fraction of the pointer's offset a magnet travels toward it, 0 to 1. Default 0.3. */
  magnetPull?: number;
  /** Gap between a magnet and the ring wrapped around it, px. Default 8. */
  magnetPadding?: number;
  /** Render label content; receives the `data-cursor-label` text. Defaults to the text itself. */
  renderLabel?: (label: string) => ReactNode;
  /** Called when the visible state changes (`hidden` included). */
  onStateChange?: (state: CursorState) => void;
  className?: string;
  /** Also accepts the theming custom properties: --cursor-ring, --cursor-dot, --cursor-fill, --cursor-on-fill, --cursor-halo, --cursor-z. */
  style?: CSSProperties;
}

/* A follower only makes sense for a precise pointer that can hover. */
const FINE_QUERY = '(hover: hover) and (pointer: fine)';
function subscribeFine(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(FINE_QUERY);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}
const fineSnapshot = (): boolean => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(FINE_QUERY).matches;
const serverSnapshot = (): boolean => false;

/** Live `(hover: hover) and (pointer: fine)` (SSR-safe). */
export function useFinePointer(): boolean {
  return useSyncExternalStore(subscribeFine, fineSnapshot, serverSnapshot);
}

const resolveSpring = (s: SpringToken | SpringConfig | undefined): SpringConfig =>
  typeof s === 'string' ? (SPRING[s] ?? SPRING.release) : s ?? SPRING.release;

/** Renders nothing on touch, pen or coarse pointers and under reduced motion (the follower is decoration). */
export function CursorFollower(props: CursorFollowerProps) {
  const { reduced } = useStudioMotion();
  const fine = useFinePointer();
  if (!fine || reduced) return null;
  return <FollowerLayers {...props} />;
}

function FollowerLayers({
  scope, follow, size = 36, stretch = 0.55, blend = false, dot = true, magnetPull = 0.3, magnetPadding = 8,
  renderLabel, onStateChange, className, style,
}: CursorFollowerProps) {
  const ringLayer = useRef<HTMLDivElement>(null);
  const labelLayer = useRef<HTMLDivElement>(null);
  const ringBody = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGRectElement>(null);
  const dotEl = useRef<HTMLDivElement>(null);
  const labelBody = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const fillRect = useRef<SVGRectElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const engine = useRef<FollowerEngine | null>(null);
  const running = useRef(false);
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState('');

  const options: FollowerOptions = {
    follow: resolveSpring(follow),
    size: clamp(size, 8, 160),
    stretch: clamp(stretch, 0, 1.5),
    dot,
    pull: clamp(magnetPull, 0, 1),
    padding: Math.max(0, magnetPadding),
  };
  const opts = useRef(options);
  opts.current = options;
  const stateCb = useRef(onStateChange);
  stateCb.current = onStateChange;

  useEffect(() => {
    const scopeEl = scope === 'document' ? document.documentElement : scope.current;
    const nodes = [ringLayer.current, labelLayer.current, ringBody.current, ring.current, dotEl.current, labelBody.current, fill.current, fillRect.current, shadow.current, text.current];
    if (!scopeEl || nodes.some((x) => !x)) return;
    const e = new FollowerEngine(
      {
        scope: scopeEl, layers: [ringLayer.current!, labelLayer.current!], ringBody: ringBody.current!, ring: ring.current!, dot: dotEl.current!,
        labelBody: labelBody.current!, fill: fill.current!, fillRect: fillRect.current!, shadow: shadow.current!, text: text.current!,
      },
      () => opts.current,
      {
        wake: () => { if (!running.current) { running.current = true; setActive(true); } },
        sleep: () => { if (running.current) { running.current = false; setActive(false); } },
        label: setLabel,
        state: (s) => stateCb.current?.(s),
      },
      scope === 'document',
    );
    e.attach();
    engine.current = e;
    return () => {
      e.detach();
      engine.current = null;
      running.current = false;
      setActive(false);
    };
  }, [scope]);

  // Parameter changes animate to their new values when the follower is on screen.
  const followKey = typeof follow === 'string' || follow === undefined ? String(follow) : `${follow.stiffness}/${follow.damping}/${follow.mass}`;
  useEffect(() => { engine.current?.nudge(); }, [followKey, size, stretch, dot, magnetPull, magnetPadding]);

  // Label width decides the pill: measured once per label, after React commits it.
  useLayoutEffect(() => { engine.current?.setLabelWidth(text.current?.offsetWidth ?? 0); }, [label]);

  const visibility: RefObject<HTMLElement | null> = scope === 'document' ? ringLayer : scope;
  useRafLoop(visibility, (dt) => engine.current?.tick(dt), active);

  const cls = (...c: (string | undefined | false)[]) => c.filter(Boolean).join(' ');
  return (
    <>
      <div ref={ringLayer} className={cls(styles.layer, styles.ringLayer, className)} data-blend={blend || undefined} data-idle="" aria-hidden="true" style={style}>
        <div ref={ringBody} className={styles.body}>
          <svg className={styles.svg} width="1" height="1" focusable="false"><rect ref={ring} className={styles.ring} /></svg>
        </div>
        <div ref={dotEl} className={styles.dot} />
      </div>
      <div ref={labelLayer} className={cls(styles.layer, className)} data-idle="" aria-hidden="true" style={style}>
        <div ref={labelBody} className={styles.body}>
          <div ref={shadow} className={styles.shadow} />
          <div ref={fill} className={styles.fill}>
            <svg className={styles.svg} width="1" height="1" focusable="false"><rect ref={fillRect} className={styles.fillRect} /></svg>
          </div>
          <span ref={text} className={styles.text}>{renderLabel ? renderLabel(label) : label}</span>
        </div>
      </div>
    </>
  );
}
