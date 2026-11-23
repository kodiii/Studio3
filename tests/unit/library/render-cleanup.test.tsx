// @vitest-environment jsdom
/**
 * React rendering + animation lifecycle cleanup for every non-WebGL recipe (WebGL recipes are covered in
 * Chromium by tests/e2e). Each recipe is mounted in StrictMode, warmed up, re-mounted, then unmounted: any
 * listener on window/document/media queries, rAF loop, timer or observer created by library code that is still
 * alive afterwards is a leak. GSAP recipes must also leave no live tweens or ScrollTriggers behind.
 */
import fs from 'node:fs';
import path from 'node:path';
import { StrictMode, type ComponentType } from 'react';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { installDomShims, type Shims } from './dom-shims';
import { resolveParams, type EffectMeta } from '../../../plugins/studio3/library/src/types';
import { StudioMotionProvider, useStudioMotion } from '../../../plugins/studio3/library/src/motion';

const catalog = JSON.parse(fs.readFileSync(path.resolve('plugins/studio3/library/catalog.json'), 'utf8')) as { effects: EffectMeta[] };
const WEBGL = new Set(['three', 'r3f', 'glsl', 'drei', 'rapier']);
const domEffects = catalog.effects.filter((e) => !e.technology.some((t) => WEBGL.has(t)));

let shims: Shims;
beforeAll(() => { shims = installDomShims(); });
afterAll(() => shims.restore());
afterEach(() => cleanup());

const settle = async (frames: number) => {
  await act(async () => {
    for (let i = 0; i < frames; i++) { shims.flushFrames(1); await Promise.resolve(); }
    await new Promise((r) => setTimeout(r, 0));
  });
};

async function gsapState() {
  try {
    const { gsap } = await import('gsap');
    const { ScrollTrigger } = await import('gsap/ScrollTrigger');
    return { tweens: gsap.globalTimeline.getChildren(true, true, true).filter((t) => !t.isActive() ? t.progress() < 1 : true).length, triggers: ScrollTrigger.getAll().length };
  } catch { return { tweens: 0, triggers: 0 }; }
}

describe('useStudioMotion', () => {
  it('follows the provider override and never removes an OS-level reduction', () => {
    const wrapper = (reduced: boolean) => ({ children }: { children: React.ReactNode }) => <StudioMotionProvider reduced={reduced} profile="immersive">{children}</StudioMotionProvider>;
    const on = renderHook(() => useStudioMotion(), { wrapper: wrapper(true) }).result.current;
    expect(on.reduced).toBe(true);
    expect(on.scale.distance).toBe(0);
    const off = renderHook(() => useStudioMotion(), { wrapper: wrapper(false) }).result.current;
    expect(off.reduced).toBe(false);
    expect(off.profile).toBe('immersive');
  });
});

describe.each(domEffects.map((e) => [e.id, e] as const))('recipe %s', (id, meta) => {
  it('renders in StrictMode and releases every resource on unmount', async () => {
    const mod = (await import(`../../../plugins/studio3/library/src/effects/${id}/index.tsx`)) as { default: ComponentType<{ params: Record<string, unknown> }> };
    const Effect = mod.default;
    const params = resolveParams(meta.params);
    // warm-up mount: module-level singletons initialise here
    let r = render(<StrictMode><Effect params={params} /></StrictMode>);
    await settle(6);
    r.unmount();
    await settle(6);
    const before = meta.technology.includes('gsap') ? await gsapState() : null;

    shims.resetTracking();
    r = render(<StrictMode><Effect params={params} /></StrictMode>);
    await settle(12);
    expect(r.container.childElementCount, 'renders markup').toBeGreaterThan(0);
    expect((r.container.textContent ?? '').length + r.container.querySelectorAll('svg, canvas, img, [aria-label]').length, 'renders content').toBeGreaterThan(0);
    r.unmount();
    await settle(12);

    const leaks = shims.leaks().map((l) => `${l.kind} (${l.detail})\n${l.stack}`);
    expect(leaks, `resources still alive after unmount:\n${leaks.join('\n---\n')}`).toEqual([]);
    if (before) {
      const after = await gsapState();
      expect(after.triggers, 'ScrollTriggers killed').toBeLessThanOrEqual(before.triggers);
      expect(after.tweens, 'GSAP tweens reverted').toBeLessThanOrEqual(before.tweens);
    }
  });
});
