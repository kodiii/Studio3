'use client';
/**
 * RiveCanvas — a content-agnostic React wrapper around the @rive-app/canvas-lite runtime.
 *
 * - The runtime is a dynamic import inside an effect: pages that never mount a RiveCanvas never download it.
 * - The WASM comes from your origin (`wasmUrl`, `wasmFallbackUrl`): no request goes to a CDN, and Rive's own asset
 *   CDN is off. The binary and the .riv bytes are fetched here first, so a missing file shows `fallback` instead of
 *   Rive logging an error.
 * - The drawing buffer follows the element (ResizeObserver, device pixel ratio capped by `maxPixelRatio`).
 * - Rendering stops offscreen and in hidden tabs; `paused` stops advancing but keeps the frame.
 * - Without a `paused` prop, playback follows reduced motion: a still first frame, no autoplay.
 * - The canvas is aria-hidden: give the element a `label`, and put the meaning in DOM controls.
 *
 * Driving it: `onReady` hands over the Rive instance and `input(name)` for state machine inputs. Files authored with
 * data binding expose view model properties through `api.rive.viewModelInstance` instead.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { DeprecationId, Rive, StateMachineInput } from '@rive-app/canvas-lite';
import { useStudioMotion } from '../../motion';
import styles from './rive-canvas.module.css';

export type RiveRuntime = typeof import('@rive-app/canvas-lite');
export type RiveFit = 'contain' | 'cover' | 'fill' | 'fitWidth' | 'fitHeight' | 'scaleDown' | 'none' | 'layout';
export type RiveAlignment =
  | 'center' | 'topLeft' | 'topCenter' | 'topRight' | 'centerLeft' | 'centerRight' | 'bottomLeft' | 'bottomCenter' | 'bottomRight';

export interface RiveCanvasApi {
  /** The live instance: play(), pause(), reset(), data binding, events. */
  rive: Rive;
  /** The runtime module, for its enums and classes (Layout, Fit, EventType…). */
  runtime: RiveRuntime;
  /** The canvas Rive draws into (aria-hidden). */
  canvas: HTMLCanvasElement;
  /** An input of the state machine by name. Looked up on every call, so it stays valid after stop() or reset(). */
  input: (name: string) => StateMachineInput | undefined;
}

export interface RiveCanvasProps {
  /** URL of the .riv file. */
  src: string;
  artboard?: string;
  stateMachine?: string;
  fit?: RiveFit;
  alignment?: RiveAlignment;
  /** Stop advancing (the frame stays). Leave undefined to follow reduced motion: still under reduce, playing otherwise. */
  paused?: boolean;
  /** Where the runtime's WASM is served from. Defaults to the gallery's copy on the same origin. */
  wasmUrl?: string;
  /** Second WASM build for older engines, tried when the first fails to compile. `null` turns the retry off. */
  wasmFallbackUrl?: string | null;
  /** Upper bound for the device pixel ratio of the drawing buffer. */
  maxPixelRatio?: number;
  /** Accessible name of the picture (the element gets role="img"). Omit for a decorative canvas. */
  label?: string;
  /** Shown instead of the canvas when the runtime or the file cannot load. */
  fallback?: ReactNode;
  /** Shown while loading. */
  loading?: ReactNode;
  /**
   * Let listeners authored inside the file react to the pointer on the canvas. Off by default: a keyboard cannot
   * reach them, so drive inputs from DOM controls instead.
   */
  pointerListeners?: boolean;
  /** Deprecation ids to silence, merged into the page-wide `Rive.suppressDeprecationWarnings`. */
  quietDeprecations?: readonly DeprecationId[];
  onReady?: (api: RiveCanvasApi) => void;
  onError?: (error: Error) => void;
  /** Names of the states the state machine entered. Subscribed only when given at mount. */
  onStateChange?: (states: string[]) => void;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_WASM = '/rive/rive.wasm';
const DEFAULT_WASM_FALLBACK = '/rive/rive_fallback.wasm';

const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(typeof e === 'string' ? e : 'Rive failed to load'));

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} answered HTTP ${res.status}`);
  return res.arrayBuffer();
}

/* One runtime per page (Rive's loader is a singleton): the first mount's URLs win. A failed load is forgotten so the
   next mount retries. */
let runtimeLoad: Promise<RiveRuntime> | null = null;
function loadRuntime(wasmUrl: string, fallbackUrl: string | null): Promise<RiveRuntime> {
  if (runtimeLoad) return runtimeLoad;
  const load = (async () => {
    if (typeof WebAssembly !== 'object' || typeof fetch !== 'function') throw new Error('This browser cannot run WebAssembly');
    const [mod, wasm] = await Promise.all([import('@rive-app/canvas-lite'), fetchBytes(wasmUrl)]);
    // Bundlers expose the UMD build's exports by name; Node's CommonJS interop only as `default`.
    const ns = mod as RiveRuntime & { default?: RiveRuntime };
    const rt = typeof ns.RuntimeLoader === 'function' ? ns : ns.default;
    if (!rt || typeof rt.RuntimeLoader !== 'function') throw new Error('Unexpected @rive-app/canvas-lite module shape');
    rt.RuntimeLoader.setWasmUrl(wasmUrl);
    rt.RuntimeLoader.setWasmFallbackUrl(fallbackUrl);
    rt.RuntimeLoader.setWasmBinary(wasm);
    await rt.RuntimeLoader.awaitInstance();
    rt.RuntimeLoader.setWasmBinary(null); // compiled: let the bytes go
    return rt;
  })();
  runtimeLoad = load;
  load.catch(() => { if (runtimeLoad === load) runtimeLoad = null; });
  return load;
}

/* .riv bytes by URL, shared by every instance (StrictMode remounts and Replay reuse them). Rive copies them into
   WASM memory, so one buffer can feed many instances. */
const files = new Map<string, Promise<ArrayBuffer>>();
function loadFile(url: string): Promise<ArrayBuffer> {
  let p = files.get(url);
  if (!p) {
    p = fetchBytes(url);
    files.set(url, p);
    p.catch(() => { if (files.get(url) === p) files.delete(url); });
    if (files.size > 8) files.delete(files.keys().next().value as string);
  }
  return p;
}

type Status = 'loading' | 'ready' | 'error';

export function RiveCanvas({
  src, artboard, stateMachine, fit = 'contain', alignment = 'center', paused, wasmUrl = DEFAULT_WASM,
  wasmFallbackUrl = DEFAULT_WASM_FALLBACK, maxPixelRatio = 2, label, fallback, loading, pointerListeners = false,
  quietDeprecations, onReady, onError, onStateChange, className, style,
}: RiveCanvasProps) {
  const { reduced } = useStudioMotion();
  const wantPaused = paused ?? reduced;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('loading');

  // Mutable bridge between the instance and React: nothing here triggers a render.
  const ctl = useRef({ rive: null as Rive | null, runtime: null as RiveRuntime | null, appliedPaused: true, inView: true, open: false, w: 0, h: 0 });
  const live = useRef({ wantPaused, onReady, onError, onStateChange, fit, alignment, maxPixelRatio });
  live.current = { wantPaused, onReady, onError, onStateChange, fit, alignment, maxPixelRatio };

  const isOpen = () => ctl.current.inView && !(typeof document !== 'undefined' && document.hidden);

  /** Match the drawing buffer to the element's layout size (transforms do not count) at a capped pixel ratio. */
  const resize = useCallback(() => {
    const c = ctl.current;
    const r = c.rive;
    const canvas = canvasRef.current;
    if (!r || !canvas || c.w <= 0 || c.h <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, live.current.maxPixelRatio);
    const w = Math.max(1, Math.round(c.w * dpr));
    const h = Math.max(1, Math.round(c.h * dpr));
    if (canvas.width === w && canvas.height === h && r.devicePixelRatioUsed === dpr) return;
    canvas.width = w;
    canvas.height = h;
    r.devicePixelRatioUsed = dpr;
    r.resizeToCanvas();
    if (live.current.fit === 'layout') { r.artboardWidth = c.w; r.artboardHeight = c.h; }
    // drawFrame() restarts a playing loop, so only draw while rendering is allowed; startRendering() redraws later.
    if (c.open) r.drawFrame();
  }, []);

  /** Apply playback (paused prop) first, then the offscreen/hidden gate: play() restarts rendering on its own. */
  const sync = useCallback(() => {
    const c = ctl.current;
    const r = c.rive;
    if (!r) return;
    const want = live.current.wantPaused;
    if (c.appliedPaused !== want) {
      c.appliedPaused = want;
      if (want) r.pause();
      else r.play();
    }
    c.open = isOpen();
    if (c.open) r.startRendering();
    else r.stopRendering();
  }, []);

  const stateListener = !!onStateChange;
  const quietKey = quietDeprecations?.join(',') ?? '';

  // Create the instance; recreate it when the source changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let instance: Rive | null = null;
    setStatus('loading');
    const fail = (e: unknown) => {
      if (cancelled) return;
      ctl.current.rive = null;
      setStatus('error');
      live.current.onError?.(toError(e));
    };
    (async () => {
      try {
        const [rt, buffer] = await Promise.all([loadRuntime(wasmUrl, wasmFallbackUrl), loadFile(src)]);
        if (cancelled) return;
        if (quietKey) {
          const ids = new Set([...rt.Rive.suppressDeprecationWarnings, ...(quietKey.split(',') as DeprecationId[])]);
          rt.Rive.suppressDeprecationWarnings = [...ids];
        }
        const startPaused = live.current.wantPaused;
        const fitValue = Object.values(rt.Fit).find((v) => v === live.current.fit) ?? rt.Fit.Contain;
        const alignValue = Object.values(rt.Alignment).find((v) => v === live.current.alignment) ?? rt.Alignment.Center;
        const r: Rive = new rt.Rive({
          canvas,
          buffer,
          artboard,
          stateMachine,
          autoplay: !startPaused,
          layout: new rt.Layout({ fit: fitValue, alignment: alignValue }),
          enableSettling: true,
          enableRiveAssetCDN: false,
          shouldDisableRiveListeners: !pointerListeners,
          shouldDisableGamepad: true,
          isTouchScrollEnabled: true,
          onLoad: () => {
            if (cancelled) return;
            const c = ctl.current;
            c.rive = r;
            c.runtime = rt;
            c.appliedPaused = startPaused;
            c.open = true;
            resize();
            setStatus('ready');
            live.current.onReady?.({
              rive: r,
              runtime: rt,
              canvas,
              input: (name) => (stateMachine ? r.stateMachineInputs(stateMachine)?.find((i) => i.name === name) : undefined),
            });
            // Rive draws (and may schedule frames) right after onLoad returns: gate rendering once it has.
            queueMicrotask(() => { if (!cancelled) sync(); });
          },
          onLoadError: (e) => fail(e.data),
          onStateChange: stateListener
            ? (e) => { if (!cancelled && Array.isArray(e.data)) live.current.onStateChange?.(e.data.map(String)); }
            : undefined,
        });
        instance = r;
      } catch (e) {
        fail(e);
      }
    })();
    return () => {
      cancelled = true;
      if (ctl.current.rive === instance) { ctl.current.rive = null; ctl.current.runtime = null; }
      instance?.cleanup();
    };
  }, [src, artboard, stateMachine, wasmUrl, wasmFallbackUrl, pointerListeners, stateListener, quietKey, resize, sync]);

  // Playback follows `paused` (or reduced motion when uncontrolled).
  useEffect(() => { sync(); }, [wantPaused, sync]);

  // Fit and alignment can change without reloading.
  useEffect(() => {
    const { rive: r, runtime: rt } = ctl.current;
    if (!r || !rt) return;
    const fitValue = Object.values(rt.Fit).find((v) => v === fit) ?? rt.Fit.Contain;
    const alignValue = Object.values(rt.Alignment).find((v) => v === alignment) ?? rt.Alignment.Center;
    if (r.layout.fit === fitValue && r.layout.alignment === alignValue) return;
    r.layout = new rt.Layout({ fit: fitValue, alignment: alignValue });
    r.resizeToCanvas();
    if (ctl.current.open) r.drawFrame();
  }, [fit, alignment, status]);

  // Drawing buffer size: element size from a ResizeObserver, device pixel ratio from a resolution media query.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      ctl.current.w = entry.contentRect.width;
      ctl.current.h = entry.contentRect.height;
      resize();
    });
    ro.observe(canvas);
    let mql: MediaQueryList | null = null;
    const onDpr = () => { watch(); resize(); };
    const watch = () => {
      mql?.removeEventListener('change', onDpr);
      mql = typeof window.matchMedia === 'function' ? window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`) : null;
      mql?.addEventListener('change', onDpr);
    };
    watch();
    return () => { ro.disconnect(); mql?.removeEventListener('change', onDpr); };
  }, [resize]);
  useEffect(() => { resize(); }, [maxPixelRatio, resize]);

  // No frames while offscreen or in a hidden tab.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([e]) => { ctl.current.inView = e.isIntersecting; sync(); })
      : null;
    io?.observe(root);
    document.addEventListener('visibilitychange', sync);
    return () => { io?.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, [sync]);

  const failed = status === 'error';
  return (
    <div
      ref={rootRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      style={style}
      data-status={status}
      data-reduced={reduced || undefined}
      role={label && !failed ? 'img' : undefined}
      aria-label={label && !failed ? label : undefined}
    >
      <canvas ref={canvasRef} className={styles.surface} aria-hidden="true" />
      {status === 'loading' && loading ? <div className={styles.layer}>{loading}</div> : null}
      {failed && fallback ? <div className={styles.layer}>{fallback}</div> : null}
    </div>
  );
}
