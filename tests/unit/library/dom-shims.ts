/**
 * jsdom shims for library tests + leak tracking.
 * jsdom lacks WAAPI, matchMedia, Intersection/ResizeObserver, canvas, CSS.supports and more. The shims are
 * deterministic, and every resource created by code under plugins/studio3/library/src is attributed by its
 * creation stack so leak checks ignore third-party internals (GSAP's ticker, Motion's frame loop, React).
 */
const LIB_FRAME = /plugins[\\/]studio3[\\/]library[\\/]src[\\/]/;
const ownedByLibrary = (): boolean => LIB_FRAME.test(new Error().stack ?? '');

export interface AnimateCall {
  target: Element;
  keyframes: unknown;
  options: { duration?: number; delay?: number; endDelay?: number; easing?: string; fill?: string; iterations?: number };
  animation: FakeAnimation;
}

export class FakeAnimation {
  playState: 'idle' | 'running' | 'paused' | 'finished' = 'idle';
  currentTime: number | null = 0;
  playbackRate = 1;
  cancelled = false;
  onfinish: (() => void) | null = null;
  oncancel: (() => void) | null = null;
  finished: Promise<FakeAnimation>;
  effect: { target: Element; getComputedTiming: () => { iterations: number; duration: number }; getKeyframes: () => unknown[] };
  private res!: (a: FakeAnimation) => void;
  private rej!: (e: unknown) => void;
  constructor(target: Element, opts: AnimateCall['options']) {
    this.finished = new Promise((res, rej) => { this.res = res; this.rej = rej; });
    this.finished.catch(() => {});
    this.effect = { target, getComputedTiming: () => ({ iterations: opts.iterations ?? 1, duration: Number(opts.duration ?? 0) }), getKeyframes: () => [] };
    this.play();
  }
  play() {
    this.playState = 'running';
    queueMicrotask(() => {
      if (this.cancelled || this.playState !== 'running' || this.effect.getComputedTiming().iterations === Infinity) return;
      this.playState = 'finished'; this.res(this); this.onfinish?.();
    });
  }
  pause() { this.playState = 'paused'; }
  finish() { this.playState = 'finished'; this.res(this); this.onfinish?.(); }
  cancel() { if (this.cancelled) return; this.cancelled = true; this.playState = 'idle'; this.rej(new DOMException('Animation cancelled', 'AbortError')); this.oncancel?.(); }
  reverse() { this.playbackRate *= -1; this.play(); }
  updatePlaybackRate(r: number) { this.playbackRate = r; }
  commitStyles() {}
  persist() {}
  addEventListener() {}
  removeEventListener() {}
}

interface Tracked { kind: string; detail: string; stack: string }

export interface Shims {
  calls: AnimateCall[];
  /** Run queued rAF callbacks n times (callbacks may re-schedule). */
  flushFrames: (n?: number) => void;
  /** Library-owned resources still alive: listeners on window/document/media queries, rAF, intervals, timeouts, observers. */
  leaks: () => Tracked[];
  /** Start attributing resources from now on (call after a warm-up mount). */
  resetTracking: () => void;
  restore: () => void;
}

export function installDomShims(): Shims {
  const undo: (() => void)[] = [];
  const patch = <T extends object, K extends keyof T>(obj: T, key: K, value: T[K]) => {
    const had = Object.prototype.hasOwnProperty.call(obj, key);
    const prev = obj[key];
    Object.defineProperty(obj, key, { value, configurable: true, writable: true });
    undo.push(() => { if (had) Object.defineProperty(obj, key, { value: prev, configurable: true, writable: true }); else delete (obj as Record<string, unknown>)[key as string]; });
  };

  // ---- WAAPI
  const calls: AnimateCall[] = [];
  patch(Element.prototype, 'animate', function (this: Element, keyframes: unknown, options?: number | AnimateCall['options']) {
    const opts = typeof options === 'number' ? { duration: options } : { ...(options ?? {}) };
    const animation = new FakeAnimation(this, opts);
    calls.push({ target: this, keyframes, options: opts, animation });
    return animation as unknown as Animation;
  } as Element['animate']);
  const live = () => calls.filter((c) => !c.animation.cancelled && c.animation.playState !== 'finished').map((c) => c.animation);
  patch(Element.prototype, 'getAnimations', function (this: Element) { return live().filter((a) => a.effect.target === this) as unknown as Animation[]; } as Element['getAnimations']);
  patch(Document.prototype, 'getAnimations', function () { return live() as unknown as Animation[]; } as Document['getAnimations']);

  // ---- tracked resources
  let tracking = true;
  const alive = new Map<unknown, Tracked>();
  const track = (key: unknown, kind: string, detail: string) => {
    if (!tracking) return;
    const stack = new Error().stack ?? '';
    if (LIB_FRAME.test(stack)) alive.set(key, { kind, detail, stack: stack.split('\n').slice(2, 7).join('\n') });
  };

  // listeners on global targets
  const globalTargets = new Set<EventTarget>([window, document, document.body]);
  const origAdd = EventTarget.prototype.addEventListener;
  const origRemove = EventTarget.prototype.removeEventListener;
  const lkey = (t: EventTarget, type: string, l: unknown, o?: boolean | AddEventListenerOptions) => `${globalTargets.has(t) ? (t === window ? 'window' : t === document ? 'document' : 'body') : 'mql'}|${type}|${typeof o === 'object' ? !!o.capture : !!o}|${String(listenerIds.get(l as object) ?? setId(l as object))}`;
  const listenerIds = new WeakMap<object, number>();
  let nextId = 1;
  const setId = (l: object) => { const id = nextId++; if (l && (typeof l === 'object' || typeof l === 'function')) listenerIds.set(l, id); return id; };
  const isTrackedTarget = (t: EventTarget) => globalTargets.has(t) || mqls.has(t);
  patch(EventTarget.prototype, 'addEventListener', function (this: EventTarget, type: string, l: EventListenerOrEventListenerObject | null, o?: boolean | AddEventListenerOptions) {
    if (l && isTrackedTarget(this) && !(typeof o === 'object' && o.once)) track(lkey(this, type, l, o), 'listener', `${type} on ${globalTargets.has(this) ? (this === window ? 'window' : this === document ? 'document' : 'body') : 'matchMedia'}`);
    return origAdd.call(this, type, l, o);
  });
  patch(EventTarget.prototype, 'removeEventListener', function (this: EventTarget, type: string, l: EventListenerOrEventListenerObject | null, o?: boolean | EventListenerOptions) {
    if (l && isTrackedTarget(this)) alive.delete(lkey(this, type, l, o as AddEventListenerOptions));
    return origRemove.call(this, type, l, o);
  });

  // matchMedia (reduced motion off, fine pointer, light scheme)
  const mqls = new Set<EventTarget>();
  patch(window, 'matchMedia', ((query: string) => {
    const mql = new EventTarget() as MediaQueryList;
    Object.assign(mql, { media: query, matches: /pointer:\s*fine|hover:\s*hover|min-width:\s*(\d+)px/.test(query) && !/prefers-reduced-motion:\s*reduce/.test(query), onchange: null,
      addListener: (l: EventListener) => mql.addEventListener('change', l), removeListener: (l: EventListener) => mql.removeEventListener('change', l) });
    mqls.add(mql);
    return mql;
  }) as typeof window.matchMedia);

  // rAF
  const frames = new Map<number, FrameRequestCallback>();
  let rafId = 0;
  let now = 0;
  patch(window, 'requestAnimationFrame', ((cb: FrameRequestCallback) => { const id = ++rafId; frames.set(id, cb); track(`raf${id}`, 'requestAnimationFrame', cb.name || 'anonymous'); return id; }) as typeof requestAnimationFrame);
  patch(window, 'cancelAnimationFrame', ((id: number) => { frames.delete(id); alive.delete(`raf${id}`); }) as typeof cancelAnimationFrame);
  const flushFrames = (n = 1) => {
    for (let i = 0; i < n; i++) {
      now += 16.7;
      const batch = [...frames.entries()];
      frames.clear();
      for (const [id, cb] of batch) { alive.delete(`raf${id}`); try { cb(now); } catch { /* recipe errors surface elsewhere */ } }
    }
  };
  patch(globalThis, 'requestAnimationFrame', window.requestAnimationFrame);
  patch(globalThis, 'cancelAnimationFrame', window.cancelAnimationFrame);

  // timers (attributed; intervals and timeouts)
  const oSetTimeout = window.setTimeout.bind(window), oClearTimeout = window.clearTimeout.bind(window);
  const oSetInterval = window.setInterval.bind(window), oClearInterval = window.clearInterval.bind(window);
  patch(window, 'setTimeout', ((fn: TimerHandler, ms?: number, ...a: unknown[]) => {
    let id: ReturnType<typeof setTimeout>;
    const wrapped = () => { alive.delete(`t${String(id)}`); if (typeof fn === 'function') (fn as (...x: unknown[]) => void)(...a); };
    id = oSetTimeout(wrapped, ms);
    track(`t${String(id)}`, 'setTimeout', `${ms ?? 0}ms`);
    return id;
  }) as typeof setTimeout);
  patch(window, 'clearTimeout', ((id?: number) => { alive.delete(`t${String(id)}`); oClearTimeout(id); }) as typeof clearTimeout);
  patch(window, 'setInterval', ((fn: TimerHandler, ms?: number, ...a: unknown[]) => { const id = oSetInterval(fn as () => void, ms, ...a); track(`i${String(id)}`, 'setInterval', `${ms ?? 0}ms`); return id; }) as typeof setInterval);
  patch(window, 'clearInterval', ((id?: number) => { alive.delete(`i${String(id)}`); oClearInterval(id); }) as typeof clearInterval);

  // observers
  const makeObserver = (name: string, entryFor: (t: Element) => object) => class {
    private targets = new Set<Element>();
    constructor(private cb: (entries: object[], obs: unknown) => void) {}
    observe(t: Element) { this.targets.add(t); track(this, name, t.tagName.toLowerCase()); queueMicrotask(() => { if (this.targets.has(t)) this.cb([entryFor(t)], this); }); }
    unobserve(t: Element) { this.targets.delete(t); if (!this.targets.size) alive.delete(this); }
    disconnect() { this.targets.clear(); alive.delete(this); }
    takeRecords() { return []; }
  };
  patch(window, 'IntersectionObserver', makeObserver('IntersectionObserver', (t) => ({ target: t, isIntersecting: true, intersectionRatio: 1, boundingClientRect: t.getBoundingClientRect(), intersectionRect: t.getBoundingClientRect(), rootBounds: null, time: now })) as unknown as typeof IntersectionObserver);
  patch(window, 'ResizeObserver', makeObserver('ResizeObserver', (t) => ({ target: t, contentRect: { x: 0, y: 0, top: 0, left: 0, width: 800, height: 480, right: 800, bottom: 480 }, borderBoxSize: [{ inlineSize: 800, blockSize: 480 }], contentBoxSize: [{ inlineSize: 800, blockSize: 480 }] })) as unknown as typeof ResizeObserver);
  patch(globalThis, 'IntersectionObserver', window.IntersectionObserver);
  patch(globalThis, 'ResizeObserver', window.ResizeObserver);

  // canvas: a no-op 2D context; WebGL unavailable
  const ctx2d = (canvas: HTMLCanvasElement) => new Proxy({ canvas } as Record<string | symbol, unknown>, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 });
      if (prop === 'getImageData' || prop === 'createImageData') return (_x: number, _y: number, w = 1, h = 1) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createConicGradient') return () => ({ addColorStop() {} });
      if (prop === 'createPattern') return () => ({ setTransform() {} });
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (prop === 'getLineDash') return () => [];
      if (prop === 'isPointInPath' || prop === 'isPointInStroke') return () => false;
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  patch(HTMLCanvasElement.prototype, 'getContext', function (this: HTMLCanvasElement, type: string) { return type === '2d' ? ctx2d(this) : null; } as unknown as HTMLCanvasElement['getContext']);
  patch(HTMLCanvasElement.prototype, 'toDataURL', (() => 'data:image/png;base64,') as HTMLCanvasElement['toDataURL']);
  patch(HTMLCanvasElement.prototype, 'toBlob', ((cb: BlobCallback) => cb(new Blob())) as HTMLCanvasElement['toBlob']);

  // misc platform APIs
  if (!('CSS' in globalThis)) patch(globalThis as Record<string, unknown>, 'CSS', { supports: () => false, escape: (s: string) => s });
  if (!('fonts' in document)) patch(document as unknown as Record<string, unknown>, 'fonts', { ready: Promise.resolve(), addEventListener() {}, removeEventListener() {}, load: () => Promise.resolve([]) });
  patch(window, 'scrollTo', (() => {}) as typeof window.scrollTo);
  patch(Element.prototype, 'scrollTo', function () {} as Element['scrollTo']);
  patch(Element.prototype, 'scrollBy', function () {} as Element['scrollBy']);
  patch(Element.prototype, 'scrollIntoView', function () {} as Element['scrollIntoView']);
  if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
    patch(HTMLDialogElement.prototype, 'showModal', function (this: HTMLDialogElement) { this.setAttribute('open', ''); } as HTMLDialogElement['showModal']);
    patch(HTMLDialogElement.prototype, 'show', function (this: HTMLDialogElement) { this.setAttribute('open', ''); } as HTMLDialogElement['show']);
    patch(HTMLDialogElement.prototype, 'close', function (this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); } as HTMLDialogElement['close']);
  }
  if (typeof (globalThis as Record<string, unknown>).PointerEvent === 'undefined') {
    class PointerEventShim extends MouseEvent { pointerId: number; pointerType: string; constructor(t: string, i: PointerEventInit = {}) { super(t, i); this.pointerId = i.pointerId ?? 1; this.pointerType = i.pointerType ?? 'mouse'; } }
    patch(globalThis as Record<string, unknown>, 'PointerEvent', PointerEventShim);
  }
  patch(Element.prototype, 'setPointerCapture', function () {} as Element['setPointerCapture']);
  patch(Element.prototype, 'releasePointerCapture', function () {} as Element['releasePointerCapture']);
  patch(Element.prototype, 'hasPointerCapture', function () { return false; } as Element['hasPointerCapture']);

  return {
    calls,
    flushFrames,
    leaks: () => [...alive.values()],
    resetTracking: () => { alive.clear(); tracking = true; },
    restore: () => { tracking = false; while (undo.length) undo.pop()!(); },
  };
}
export { ownedByLibrary };
