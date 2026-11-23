// @vitest-environment jsdom
import { BoxGeometry, Mesh, MeshStandardMaterial, Object3D, Scene, ShaderMaterial, Texture } from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAdaptiveQuality, createQualityProfiles, defaultQualityProfiles, pickQualityLevel } from '../../../plugins/studio3/library/src/three/quality';
import { disposeObject, ResourceTracker } from '../../../plugins/studio3/library/src/three/dispose';
import { detectCapabilities, detectWebGPU, type GraphicsCapabilities } from '../../../plugins/studio3/library/src/three/capabilities';
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
