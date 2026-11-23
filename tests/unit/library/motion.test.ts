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
