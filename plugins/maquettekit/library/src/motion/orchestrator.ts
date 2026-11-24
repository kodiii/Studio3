/**
 * Motion Lab — orchestration on the Web Animations API (no dependencies).
 *
 * `createSequence()` builds an interruptible, reversible timeline of WAAPI
 * animations with labels, parent→child stagger and guaranteed cleanup. One time
 * base: `durationScale` stretches durations and positions together; stagger has
 * its own `staggerScale`.
 * Use it for UI choreography; reach for GSAP only when you need scrubbed
 * scroll timelines, pinning or morphing.
 */
import { cssEase, duration as D, type EasingToken, type Bezier } from './tokens';

export interface StepOptions {
  /** Step duration in ms (default `duration.base`); multiplied by the sequence's `durationScale`. */
  duration?: number;
  easing?: EasingToken | Bezier | string;
  /**
   * Absolute ms, a label name, or relative to the previous step end: "+=80" / "-=120" / "<" (previous start).
   * Numbers and `+=`/`-=` offsets are unscaled ms: they are multiplied by the sequence's `durationScale`
   * (labels and "<" already hold scaled times).
   */
  at?: number | string;
  /** Per-target delay in ms for multi-target steps (parent → child stagger); multiplied by `staggerScale`, not by `durationScale`. */
  stagger?: number;
  fill?: FillMode;
}

/** Options for {@link createSequence}. */
export interface SequenceOptions {
  /** Collapse every step to its end state (≈0 ms, no delays or stagger); callbacks fire at 0. */
  reducedMotion?: boolean;
  /**
   * One time base for the whole timeline (default 1): multiplies every step `duration`, numeric `at` positions,
   * `+=N` / `-=N` offsets and numeric positions given to `label()` / `call()`, so a motion profile
   * (`profileScale[p].duration`) or a speed control (`1 / speed`) stretches the choreography without distorting it.
   * Stagger is not affected — see `staggerScale`.
   */
  durationScale?: number;
  /**
   * Multiplies every `stagger` (default 1). Kept separate from `durationScale` because profiles scale stagger on
   * their own axis (`profileScale[p].stagger`); leave it at 1 when the stagger you pass is already scaled.
   */
  staggerScale?: number;
}

export interface Sequence {
  add(targets: Element | Iterable<Element> | null | undefined, keyframes: Keyframe[] | PropertyIndexedKeyframes, opts?: StepOptions): Sequence;
  /** Name a position (default: the current end) for later `at` references. */
  label(name: string, at?: number | string): Sequence;
  /**
   * Run `fn` when playback passes `at` (default: the current end). Fires on forward play only; `finish()` fires
   * the pending ones. After `seek()`/`pause()`, `play()` treats callbacks before the current time as already fired
   * and schedules the rest from the current time.
   */
  call(fn: () => void, at?: number | string): Sequence;
  /**
   * Start, resume from the current time (after `pause()` / `seek()`), or restart from 0 once finished or when
   * sitting at the end. Resolves true when finished, false when interrupted.
   */
  play(): Promise<boolean>;
  reverse(): Promise<boolean>;
  pause(): void;
  /** 0..1 — scrub the whole sequence (for scroll synchronisation). Callbacks before that point count as fired. */
  seek(progress: number): void;
  /** Jump to the end state, committing final styles. */
  finish(): void;
  /** Stop and remove all effects; elements return to their CSS state. */
  cancel(): void;
  readonly totalDuration: number;
  /**
   * 0..1 position on the timeline, from the live animations' currentTime / `totalDuration`: 1 once finished
   * (0 after a completed `reverse()`), 0 before the first play and after `cancel()`.
   */
  readonly progress: number;
  readonly playState: 'idle' | 'running' | 'paused' | 'finished';
}

interface Planned { el: Element; keyframes: Keyframe[] | PropertyIndexedKeyframes; start: number; dur: number; easing: string; fill: FillMode }

const toEase = (e: StepOptions['easing']): string =>
  e === undefined ? cssEase('standard') : typeof e === 'string' ? (e.includes('(') || !(e in { linear: 1, standard: 1, enter: 1, exit: 1, emphasized: 1, inOut: 1, anticipate: 1, overshoot: 1 }) ? e : cssEase(e as EasingToken)) : cssEase(e);

const toList = (t: Element | Iterable<Element> | null | undefined): Element[] =>
  !t ? [] : t instanceof Element ? [t] : Array.from(t);

export function createSequence(opts: SequenceOptions = {}): Sequence {
  const planned: Planned[] = [];
  const calls: { at: number; fn: () => void; done: boolean }[] = [];
  const labels = new Map<string, number>();
  let cursor = 0;
  let prevStart = 0;
  let total = 0;
  let live: Animation[] = [];
  let timers: number[] = [];
  let state: Sequence['playState'] = 'idle';
  let direction: 1 | -1 = 1;
  /** Timeline position (ms) when no animation is live to read it from. */
  let pos = 0;
  let token = 0;
  const scale = opts.durationScale ?? 1;
  const staggerScale = opts.staggerScale ?? 1;

  const resolveAt = (at: StepOptions['at']): number => {
    if (at === undefined) return cursor;
    if (typeof at === 'number') return Math.max(0, at * scale);
    if (at === '<') return prevStart;
    if (at.startsWith('+=')) return cursor + Number(at.slice(2)) * scale;
    if (at.startsWith('-=')) return Math.max(0, cursor - Number(at.slice(2)) * scale);
    return labels.get(at) ?? cursor;
  };

  const clearTimers = () => {
    for (const t of timers) clearTimeout(t);
    timers = [];
  };

  const clear = () => {
    for (const a of live) { try { a.cancel(); } catch { /* detached */ } }
    live = [];
    clearTimers();
  };

  const build = (): void => {
    clear();
    for (const p of planned) {
      if (!p.el.isConnected || typeof p.el.animate !== 'function') continue;
      const dur = Math.max(p.dur, 0.01);
      // endDelay pads every step to the sequence end, so all animations share one clock: pause()/seek() → play()
      // resumes in place (WAAPI would otherwise auto-rewind steps that already ended) and reverse() mirrors the timeline.
      const a = p.el.animate(p.keyframes, { duration: dur, delay: p.start, endDelay: Math.max(0, total - p.start - dur), easing: p.easing, fill: p.fill });
      a.pause();
      live.push(a);
    }
  };

  /** Current timeline time in ms (the live animations share one clock; the furthest one wins). */
  const now = (): number => {
    let t = -1;
    for (const a of live) {
      if (a.currentTime === null) continue;
      const c = Number(a.currentTime);
      if (Number.isFinite(c) && c > t) t = c;
    }
    return t < 0 ? pos : t;
  };

  const run = (dir: 1 | -1): Promise<boolean> => {
    const my = ++token;
    clearTimers();
    if (!live.length) build();
    let t0 = now();
    const restart = dir === 1 && (state === 'idle' || state === 'finished' || t0 >= total);
    if (restart) t0 = 0;
    if (dir === 1) {
      // Resume: callbacks before the current time count as fired; the rest are scheduled from here.
      for (const c of calls) c.done = restart ? false : c.done || c.at < t0;
    } else {
      for (const c of calls) c.done = false;
    }
    direction = dir;
    state = 'running';
    for (const a of live) {
      a.playbackRate = dir;
      if (restart) a.currentTime = 0;
      a.play();
    }
    if (dir === 1) {
      for (const c of calls) {
        if (c.done) continue;
        timers.push(window.setTimeout(() => { if (my === token && !c.done) { c.done = true; c.fn(); } }, Math.max(0, c.at - t0)));
      }
    }
    return Promise.all(live.map((a) => a.finished.then(() => true, () => false))).then((r) => {
      if (my !== token) return false;
      const ok = r.every(Boolean);
      if (ok) state = 'finished';
      return ok;
    });
  };

  const api: Sequence = {
    add(targets, keyframes, o = {}) {
      const els = toList(targets);
      const start = resolveAt(o.at);
      const reduced = !!opts.reducedMotion;
      const dur = reduced ? 0.01 : (o.duration ?? D.base) * scale;
      const st = reduced ? 0 : (o.stagger ?? 0) * staggerScale;
      els.forEach((el, i) => planned.push({ el, keyframes, start: reduced ? 0 : start + i * st, dur, easing: toEase(o.easing), fill: o.fill ?? 'both' }));
      prevStart = start;
      const end = reduced ? 0.01 : start + dur + Math.max(0, els.length - 1) * st;
      cursor = end;
      total = Math.max(total, end);
      return api;
    },
    label(name, at) { labels.set(name, resolveAt(at)); return api; },
    call(fn, at) { calls.push({ at: opts.reducedMotion ? 0 : resolveAt(at), fn, done: false }); return api; },
    play: () => run(1),
    reverse: () => run(-1),
    pause() {
      token++;
      clearTimers();
      for (const a of live) a.pause();
      pos = now();
      state = 'paused';
    },
    seek(progress) {
      if (!live.length) build();
      token++;
      clearTimers();
      const t = (Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0) * total;
      for (const a of live) { a.pause(); a.currentTime = t; }
      for (const c of calls) c.done = c.at < t;
      pos = t;
      state = 'paused';
    },
    finish() {
      if (!live.length) build();
      token++;
      clearTimers();
      for (const a of live) { try { a.finish(); } catch { /* infinite */ } }
      for (const c of calls) if (!c.done) { c.done = true; c.fn(); }
      pos = direction === 1 ? total : 0;
      state = 'finished';
    },
    cancel() { token++; clear(); pos = 0; direction = 1; state = 'idle'; },
    get totalDuration() { return total; },
    get progress() {
      if (state === 'finished') return direction === 1 ? 1 : 0;
      return total > 0 ? Math.min(1, Math.max(0, now() / total)) : 0;
    },
    get playState() { return state; },
  };
  return api;
}

/**
 * FLIP shared-element transition between two layout states.
 * Call `flip(elements, mutate)`; `mutate` performs the DOM/layout change
 * synchronously. Transforms are composited (translate/scale) and cleaned up.
 */
export function flip(
  elements: Iterable<HTMLElement>,
  mutate: () => void,
  opts: { duration?: number; easing?: EasingToken | string; stagger?: number; reducedMotion?: boolean } = {},
): Animation[] {
  const els = Array.from(elements);
  const first = new Map(els.map((el) => [el, el.getBoundingClientRect()]));
  mutate();
  if (opts.reducedMotion) return [];
  const out: Animation[] = [];
  els.forEach((el, i) => {
    const a = first.get(el)!;
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) return;
    const dx = a.left - b.left, dy = a.top - b.top, sx = a.width / b.width, sy = a.height / b.height;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
    out.push(el.animate(
      [{ transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transformOrigin: '0 0', transform: 'none' }],
      { duration: opts.duration ?? D.moderate, delay: i * (opts.stagger ?? 0), easing: toEase(opts.easing ?? 'emphasized'), fill: 'backwards' },
    ));
  });
  return out;
}

/**
 * Shared-element / page transition using the View Transitions API when the
 * browser supports it, falling back to an immediate update.
 * Returns a promise resolving when the transition (or the update) is done.
 */
export function viewTransition(update: () => void | Promise<void>, opts: { reducedMotion?: boolean } = {}): Promise<void> {
  const doc = typeof document !== 'undefined' ? (document as Document & { startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> } }) : null;
  if (!doc?.startViewTransition || opts.reducedMotion) return Promise.resolve(update());
  return doc.startViewTransition(update).finished.catch(() => {});
}

/** Stagger helper: delay for index `i` with optional origin ("start" | "center" | "end"). */
export function staggerDelay(i: number, count: number, each: number, from: 'start' | 'center' | 'end' = 'start'): number {
  if (from === 'end') return (count - 1 - i) * each;
  if (from === 'center') return Math.abs(i - (count - 1) / 2) * each;
  return i * each;
}

/** Track every disposer registered during an effect so cleanup is one call. */
export function createCleanup(): { add: (fn: () => void) => void; run: () => void } {
  const fns: (() => void)[] = [];
  return { add: (fn) => { fns.push(fn); }, run: () => { while (fns.length) { try { fns.pop()!(); } catch { /* keep disposing */ } } } };
}
