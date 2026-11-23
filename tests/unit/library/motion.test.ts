// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCleanup, createSequence, cssEase, duration, easing, motionTokensCss, profileScale, spring, springToLinear, staggerDelay } from '../../../plugins/studio3/library/src/motion';
import { resolveParams, type ParamSpec } from '../../../plugins/studio3/library/src/types';
import { installDomShims, type AnimateCall } from './dom-shims';

describe('motion tokens', () => {
  it('durations increase monotonically', () => {
    const v = Object.values(duration);
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThan(v[i - 1]);
  });
  it('cssEase formats cubic-bezier from tokens and raw arrays', () => {
    expect(cssEase('standard')).toBe(`cubic-bezier(${easing.standard.join(', ')})`);
    expect(cssEase([0.1, 0.2, 0.3, 0.4])).toBe('cubic-bezier(0.1, 0.2, 0.3, 0.4)');
  });
  it('springToLinear samples a spring that ends at 1 with a positive settle time', () => {
    for (const cfg of Object.values(spring)) {
      const { easing: e, duration: d } = springToLinear(cfg);
      expect(e.startsWith('linear(0')).toBe(true);
      expect(e.endsWith(', 1)')).toBe(true);
      expect(d).toBeGreaterThan(50);
      expect(d).toBeLessThanOrEqual(4000);
    }
    // an under-damped spring overshoots past 1 somewhere in the samples
    const stops = springToLinear(spring.pop).easing.slice(7, -1).split(', ').map(Number);
    expect(Math.max(...stops)).toBeGreaterThan(1);
  });
  it('profile scales keep essential calmer than immersive', () => {
    expect(profileScale.essential.duration).toBeLessThan(profileScale.expressive.duration);
    expect(profileScale.immersive.distance).toBeGreaterThan(profileScale.expressive.distance);
  });
  it('motionTokensCss emits every duration and easing as a custom property', () => {
    const css = motionTokensCss();
    for (const k of Object.keys(duration)) expect(css).toContain(`--s3-duration-${k}:`);
    for (const k of Object.keys(easing)) expect(css).toContain(`--s3-ease-${k}:`);
  });
});

describe('resolveParams', () => {
  const specs: ParamSpec[] = [
    { key: 'n', label: 'N', type: 'number', default: 5, min: 0, max: 10 },
    { key: 'b', label: 'B', type: 'boolean', default: true },
    { key: 's', label: 'S', type: 'select', default: 'a', options: ['a', 'b'] },
    { key: 't', label: 'T', type: 'text', default: 'x' },
  ];
  it('fills defaults, clamps numbers and rejects unknown options', () => {
    expect(resolveParams(specs)).toEqual({ n: 5, b: true, s: 'a', t: 'x' });
    expect(resolveParams(specs, { n: 99, b: false, s: 'zzz', t: 'y' })).toEqual({ n: 10, b: false, s: 'a', t: 'y' });
    expect(resolveParams(specs, { n: Number.NaN })).toMatchObject({ n: 5 });
  });
});

describe('createSequence (WAAPI orchestration)', () => {
  let calls: AnimateCall[];
  let restore: () => void;
  beforeEach(() => { ({ calls, restore } = installDomShims()); });
  afterEach(() => restore());
  const els = (n: number) => Array.from({ length: n }, () => { const d = document.createElement('div'); document.body.append(d); return d; });

  it('places steps sequentially with stagger, labels and relative positions', async () => {
    const [a, b, c, d] = els(4);
    const seq = createSequence();
    seq.add([a, b], [{ opacity: 0 }, { opacity: 1 }], { duration: 200, stagger: 50 })
      .label('mid')
      .add(c, [{ opacity: 0 }, { opacity: 1 }], { duration: 100, at: '+=20' })
      .add(d, [{ opacity: 0 }, { opacity: 1 }], { duration: 100, at: 'mid' });
    await seq.play();
    const delays = calls.map((c) => [c.options.delay, c.options.duration]);
    expect(delays).toEqual([[0, 200], [50, 200], [270, 100], [250, 100]]);
    expect(seq.totalDuration).toBe(370);
  });
  it('collapses to the end state under reduced motion', async () => {
    const [a, b] = els(2);
    const seq = createSequence({ reducedMotion: true });
    seq.add([a, b], [{ opacity: 0 }, { opacity: 1 }], { duration: 400, stagger: 100 });
    await seq.play();
    for (const c of calls) { expect(c.options.delay).toBe(0); expect(c.options.duration).toBeLessThan(1); }
  });
  it('cancel() removes every effect and resolves play() as interrupted', async () => {
    const [a] = els(1);
    const seq = createSequence();
    seq.add(a, [{ opacity: 0 }, { opacity: 1 }], { duration: 1000 });
    const p = seq.play();
    seq.cancel();
    expect(calls.every((c) => c.animation.cancelled)).toBe(true);
    expect(await p).toBe(false);
    expect(seq.playState).toBe('idle');
  });
  it('seek() scrubs proportionally', () => {
    const [a] = els(1);
    const seq = createSequence();
    seq.add(a, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
    seq.seek(0.25);
    expect(calls[0].animation.currentTime).toBe(100);
  });
  it('callbacks fire at their position and finish() fires pending ones', () => {
    vi.useFakeTimers();
    const [a] = els(1);
    const fn = vi.fn();
    const seq = createSequence();
    seq.add(a, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }).call(fn);
    seq.finish();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  const kf = [{ opacity: 0 }, { opacity: 1 }];
  it('durationScale scales durations, numeric/relative positions, labels and calls (one time base); stagger is unscaled', () => {
    vi.useFakeTimers();
    try {
      const [a, b, c, d, e] = els(5);
      const fn = vi.fn();
      const seq = createSequence({ durationScale: 2 });
      seq.add([a, b], kf, { duration: 100, stagger: 30, at: 50 }) // start 100, dur 200, b +30 → end 330
        .label('mark', 40) // 80
        .add(c, kf, { duration: 50, at: '+=10' }) // 330 + 20 → end 450
        .add(d, kf, { duration: 50, at: '-=25' }) // 450 − 50 → end 500
        .add(e, kf, { duration: 50, at: 'mark' }) // 80 → end 180
        .call(fn, 60); // 120
      void seq.play();
      expect(calls.map((x) => [x.options.delay, x.options.duration])).toEqual([[100, 200], [130, 200], [350, 100], [400, 100], [80, 100]]);
      expect(seq.totalDuration).toBe(500);
      // every step is padded to the shared end, so all animations run on one clock
      for (const x of calls) expect(x.options.delay! + x.options.duration! + x.options.endDelay!).toBe(500);
      vi.advanceTimersByTime(119);
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
  it('staggerScale (default 1) scales stagger independently of durationScale', () => {
    const [a, b, c] = els(3);
    createSequence({ durationScale: 2 }).add([a, b, c], kf, { duration: 100, stagger: 40 }).seek(0);
    expect(calls.map((x) => x.options.delay)).toEqual([0, 40, 80]);
    calls.length = 0;
    const seq = createSequence({ durationScale: 2, staggerScale: 0.5 }).add([a, b, c], kf, { duration: 100, stagger: 40 });
    seq.seek(0);
    expect(calls.map((x) => [x.options.delay, x.options.duration])).toEqual([[0, 200], [20, 200], [40, 200]]);
    expect(seq.totalDuration).toBe(240);
  });
  it('progress derives from the live animations, is 1 once finished and 0 after cancel()', async () => {
    const [a, b] = els(2);
    const seq = createSequence();
    expect(seq.progress).toBe(0);
    seq.add(a, kf, { duration: 200 }).add(b, kf, { duration: 200 });
    seq.seek(0.25);
    expect(seq.progress).toBeCloseTo(0.25);
    for (const x of calls) x.animation.currentTime = 300;
    expect(seq.progress).toBeCloseTo(0.75);
    expect(await seq.play()).toBe(true);
    expect(seq.playState).toBe('finished');
    expect(seq.progress).toBe(1);
    seq.cancel();
    expect(seq.progress).toBe(0);
  });
  it('after seek()/pause(), play() counts earlier callbacks as fired and schedules the rest from the current time', () => {
    vi.useFakeTimers();
    try {
      const [a] = els(1);
      const early = vi.fn();
      const late = vi.fn();
      const seq = createSequence();
      seq.add(a, kf, { duration: 400 }).call(early, 100).call(late, 300);
      seq.seek(0.5); // 200 ms
      void seq.play();
      vi.advanceTimersByTime(99);
      expect(late).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(late).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1000);
      expect(early).not.toHaveBeenCalled();
      seq.finish(); // counted as fired → finish() does not fire it either
      expect(early).not.toHaveBeenCalled();

      // finished → play() restarts: every callback is re-armed from 0
      void seq.play();
      vi.advanceTimersByTime(100);
      expect(early).toHaveBeenCalledTimes(1);
      // pause at 150 ms, resume: only the callbacks still ahead fire, relative to 150 ms
      calls[calls.length - 1].animation.currentTime = 150;
      seq.pause();
      vi.advanceTimersByTime(1000);
      expect(late).toHaveBeenCalledTimes(1); // stale timer cleared by pause()
      void seq.play();
      vi.advanceTimersByTime(149);
      expect(late).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1);
      expect(late).toHaveBeenCalledTimes(2);
      expect(early).toHaveBeenCalledTimes(1);

      // seek() and cancel() clear pending timers too
      seq.seek(0);
      void seq.play();
      seq.seek(0.1);
      vi.advanceTimersByTime(1000);
      expect(early).toHaveBeenCalledTimes(1);
      void seq.play();
      seq.cancel();
      vi.advanceTimersByTime(1000);
      expect(early).toHaveBeenCalledTimes(1);
      expect(late).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
});

describe('helpers', () => {
  it('staggerDelay supports start, center and end origins', () => {
    expect([0, 1, 2].map((i) => staggerDelay(i, 3, 10))).toEqual([0, 10, 20]);
    expect([0, 1, 2].map((i) => staggerDelay(i, 3, 10, 'end'))).toEqual([20, 10, 0]);
    expect([0, 1, 2].map((i) => staggerDelay(i, 3, 10, 'center'))).toEqual([10, 0, 10]);
  });
  it('createCleanup runs disposers in reverse order and survives a throwing disposer', () => {
    const order: number[] = [];
    const c = createCleanup();
    c.add(() => order.push(1));
    c.add(() => { throw new Error('boom'); });
    c.add(() => order.push(3));
    c.run();
    expect(order).toEqual([3, 1]);
  });
});
