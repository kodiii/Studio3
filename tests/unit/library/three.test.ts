// @vitest-environment jsdom
import { BoxGeometry, Mesh, MeshStandardMaterial, Object3D, Scene, ShaderMaterial, Texture } from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAdaptiveQuality, createQualityProfiles, defaultQualityProfiles, pickQualityLevel, qualityProfilesFromDesign, stepDownQuality } from '../../../plugins/maquettekit/library/src/three/quality';
import { disposeObject, ResourceTracker } from '../../../plugins/maquettekit/library/src/three/dispose';
import { detectCapabilities, detectWebGPU, type GraphicsCapabilities } from '../../../plugins/maquettekit/library/src/three/capabilities';
import { installDomShims, type Shims } from './dom-shims';

const caps = (o: Partial<GraphicsCapabilities>): GraphicsCapabilities => ({ webgl: true, webgl2: true, webgpuApi: false, maxTextureSize: 8192, renderer: null, softwareRenderer: false, deviceClass: 'desktop', ...o });

describe('quality profiles', () => {
  it('picks a level from capabilities', () => {
    expect(pickQualityLevel(caps({}))).toBe('high');
    expect(pickQualityLevel(caps({ deviceClass: 'mobile' }))).toBe('medium');
    expect(pickQualityLevel(caps({ webgl2: false }))).toBe('medium');
    expect(pickQualityLevel(caps({ deviceClass: 'low-power' }))).toBe('low');
    expect(pickQualityLevel(caps({ webgl: false }))).toBe('low');
    expect(pickQualityLevel(caps({}), { saveData: true })).toBe('low');
  });
  it('profiles get cheaper from high to low and overrides merge', () => {
    const { high, medium, low } = defaultQualityProfiles;
    expect(high.dpr[1]).toBeGreaterThan(low.dpr[1]);
    expect(high.textureMax).toBeGreaterThan(medium.textureMax);
    expect(medium.textureMax).toBeGreaterThan(low.textureMax);
    expect(low.postprocessing).toBe(false);
    const p = createQualityProfiles({ low: { textureMax: 256 } });
    expect(p.low.textureMax).toBe(256);
    expect(p.low.dpr).toEqual(low.dpr);
  });
  it('adaptive quality lowers DPR on slow frames and recovers on fast frames', () => {
    const onChange = vi.fn();
    const q = createAdaptiveQuality({ targetMs: 20, window: 10, onChange });
    for (let i = 0; i < 10; i++) q.sample(40);
    expect(q.dprFactor).toBe(0.875);
    for (let i = 0; i < 10; i++) q.sample(5);
    expect(q.dprFactor).toBe(1);
    expect(onChange).toHaveBeenCalledTimes(2);
    q.sample(1000); // tab switch spikes are ignored
    expect(q.dprFactor).toBe(1);
  });
  it('signals degrade only once the DPR floor is reached and frames stay slow', () => {
    const states: { dprFactor: number; degrade: boolean }[] = [];
    const q = createAdaptiveQuality({ targetMs: 20, window: 5, onChange: (st) => states.push(st) });
    for (let i = 0; i < 5 * 4; i++) q.sample(60); // 1 → 0.5 in four slow windows
    expect(q.dprFactor).toBe(0.5);
    expect(states.some((st) => st.degrade)).toBe(false);
    for (let i = 0; i < 5; i++) q.sample(60); // still slow at the floor
    expect(states.at(-1)).toEqual({ dprFactor: 0.5, degrade: true });
  });
  it('steps quality down one level per degrade signal and never back up', () => {
    expect(stepDownQuality('high')).toBe('medium');
    expect(stepDownQuality('medium')).toBe('low');
    expect(stepDownQuality('low')).toBe('low');
    expect(stepDownQuality('high', 2)).toBe('low');
    expect(stepDownQuality('high', 5)).toBe('low');
    expect(stepDownQuality('medium', 0)).toBe('medium');
    expect(stepDownQuality('medium', -1)).toBe('medium'); // never up
  });
});

describe('design → quality profiles', () => {
  // Shape written by tools/design-intelligence/generate.mjs (threeD.qualityProfiles)
  const threeD = {
    qualityProfiles: {
      note: 'Starting points only',
      desktop: { dprMax: 2, shadows: 'Soft shadow map 2048 or accumulative', postprocessing: 'Selective (tone mapping, light bloom or AO if art direction needs it)', textureMaxPx: 2048, targetFps: 60, antialias: 'MSAA' },
      mobile: { dprMax: 1.5, shadows: 'Contact/blob shadow or 1024 map', postprocessing: 'Tone mapping only', textureMaxPx: 1024, targetFps: 60, antialias: 'MSAA or FXAA' },
      lowPower: { dprMax: 1, shadows: 'None (baked or blob)', postprocessing: 'None', textureMaxPx: 512, targetFps: 30, antialias: 'None', frameloop: 'demand' },
    },
  };
  it('maps desktop/mobile/lowPower to high/medium/low overrides for createQualityProfiles()', () => {
    const o = qualityProfilesFromDesign(threeD);
    expect(o.high).toEqual({ dpr: [1, 2], textureMax: 2048, shadows: true, shadowMapSize: 2048, postprocessing: true, antialias: true });
    expect(o.medium).toEqual({ dpr: [1, 1.5], textureMax: 1024, shadows: true, shadowMapSize: 1024, postprocessing: false, antialias: true });
    expect(o.low).toEqual({ dpr: [0.75, 1], textureMax: 512, shadows: false, postprocessing: false, antialias: false });
    const p = createQualityProfiles(o);
    expect(p.low.modelVariant).toBe('low-power'); // untouched fields keep the kit defaults
    expect(p.high.level).toBe('high');
  });
  it('tolerates missing blocks, tiers, fields and odd values', () => {
    expect(qualityProfilesFromDesign(undefined)).toEqual({});
    expect(qualityProfilesFromDesign({})).toEqual({});
    expect(qualityProfilesFromDesign({ qualityProfiles: { mobile: {} } })).toEqual({});
    const o = qualityProfilesFromDesign({ qualityProfiles: { desktop: { dprMax: 0.5, textureMaxPx: -1, shadows: true }, 'low-power': { postprocessing: false, antialias: 'FXAA' } } });
    expect(o.high).toEqual({ dpr: [0.5, 0.5], shadows: true }); // min clamp never exceeds the max
    expect(o.low).toEqual({ postprocessing: false }); // FXAA alone is a post pass, not context MSAA: left at the default
    expect(o.medium).toBeUndefined();
    // the qualityProfiles block itself is accepted too
    expect(qualityProfilesFromDesign(threeD.qualityProfiles)).toEqual(qualityProfilesFromDesign(threeD));
  });
});

describe('GPU resource disposal', () => {
  it('disposes every geometry, material and texture once, including shader uniforms', () => {
    const disposed: string[] = [];
    const watch = <T extends { addEventListener: (t: 'dispose', l: () => void) => void }>(o: T, name: string) => { o.addEventListener('dispose', () => disposed.push(name)); return o; };
    const geo = watch(new BoxGeometry(), 'geometry');
    const map = watch(new Texture(), 'map');
    const uTex = watch(new Texture(), 'uniformTexture');
    const std = watch(new MeshStandardMaterial({ map }), 'standard');
    const shader = watch(new ShaderMaterial({ uniforms: { uTex: { value: uTex } } }), 'shader');
    const scene = new Scene();
    scene.add(new Mesh(geo, std), new Mesh(geo, shader)); // shared geometry
    const n = disposeObject(scene);
    expect(disposed.sort()).toEqual(['geometry', 'map', 'shader', 'standard', 'uniformTexture']);
    expect(n).toBe(5);
  });
  it('ResourceTracker disposes tracked objects and detaches them', () => {
    const parent = new Object3D();
    const tracker = new ResourceTracker();
    const mesh = tracker.track(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    parent.add(mesh);
    const tex = tracker.track(new Texture());
    const spy = vi.fn();
    tex.addEventListener('dispose', spy);
    expect(tracker.dispose()).toBe(3);
    expect(parent.children).toHaveLength(0);
    expect(spy).toHaveBeenCalledOnce();
    expect(tracker.disposed).toBe(3);
  });
});

describe('capability detection', () => {
  let shims: Shims;
  beforeAll(() => { shims = installDomShims(); });
  afterAll(() => shims.restore());
  it('reports no WebGL and the low-power class when contexts cannot be created', () => {
    const c = detectCapabilities(true);
    expect(c.webgl).toBe(false);
    expect(c.webgl2).toBe(false);
    expect(c.deviceClass).toBe('low-power');
  });
  it('never assumes WebGPU: unavailable without navigator.gpu', async () => {
    const r = await detectWebGPU();
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/navigator\.gpu/);
  });
  it('reports WebGPU available only when an adapter is acquired', async () => {
    Object.defineProperty(navigator, 'gpu', { value: { requestAdapter: async () => null }, configurable: true });
    expect((await detectWebGPU()).available).toBe(false);
    Object.defineProperty(navigator, 'gpu', { value: { requestAdapter: async () => ({}) }, configurable: true });
    expect((await detectWebGPU()).available).toBe(true);
    Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
  });
});
