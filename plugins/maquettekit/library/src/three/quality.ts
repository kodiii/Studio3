/**
 * Quality profiles. Values are STARTING POINTS to be verified on the project's
 * target devices — there is no universal polygon or texture budget.
 * Override per project via `createQualityProfiles()`, or from maquettekit.design.json → threeD.qualityProfiles with
 * `createQualityProfiles(qualityProfilesFromDesign(design.threeD))`.
 */
import type { GraphicsCapabilities } from './capabilities';

export type QualityLevel = 'high' | 'medium' | 'low';

export interface QualityProfile {
  level: QualityLevel;
  /** Device pixel ratio clamp [min, max]. */
  dpr: [number, number];
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  postprocessing: boolean;
  /** Largest texture edge to request from the asset manifest. */
  textureMax: number;
  /** Asset manifest variant to load (see `maquettekit assets variants`). */
  modelVariant: 'desktop' | 'mobile' | 'low-power';
  /** Multiplier for particle / instance counts. */
  density: number;
  /**
   * Environment map resolution for generated environments. three's PMREMGenerator upsamples every input to a fixed
   * minimum cube size (`MIN_SIZE = 256` in r163+), so values below 256 have no effect on PMREM-prefiltered
   * environments (`LightingRig`, drei `<Environment>`, `scene.environment` from `fromScene`/`fromEquirectangular`);
   * only values above 256 change their cost and sharpness. Smaller values still apply to non-PMREM uses
   * (e.g. a raw `CubeCamera` render target).
   */
  envResolution: number;
}

export interface Budgets {
  /** Soft per-frame budgets used for diagnostics warnings; configure per project. */
  drawCalls: number;
  triangles: number;
  textureBytes: number;
}

export const defaultQualityProfiles: Record<QualityLevel, QualityProfile> = {
  high: { level: 'high', dpr: [1, 2], antialias: true, shadows: true, shadowMapSize: 2048, postprocessing: true, textureMax: 2048, modelVariant: 'desktop', density: 1, envResolution: 256 },
  medium: { level: 'medium', dpr: [1, 1.5], antialias: true, shadows: true, shadowMapSize: 1024, postprocessing: false, textureMax: 1024, modelVariant: 'mobile', density: 0.6, envResolution: 128 },
  low: { level: 'low', dpr: [0.75, 1], antialias: false, shadows: false, shadowMapSize: 512, postprocessing: false, textureMax: 512, modelVariant: 'low-power', density: 0.3, envResolution: 64 },
};

export const defaultBudgets: Record<QualityLevel, Budgets> = {
  high: { drawCalls: 200, triangles: 1_500_000, textureBytes: 256 * 1024 * 1024 },
  medium: { drawCalls: 120, triangles: 500_000, textureBytes: 96 * 1024 * 1024 },
  low: { drawCalls: 60, triangles: 150_000, textureBytes: 32 * 1024 * 1024 },
};

export function createQualityProfiles(overrides: Partial<Record<QualityLevel, Partial<QualityProfile>>> = {}): Record<QualityLevel, QualityProfile> {
  return {
    high: { ...defaultQualityProfiles.high, ...overrides.high },
    medium: { ...defaultQualityProfiles.medium, ...overrides.medium },
    low: { ...defaultQualityProfiles.low, ...overrides.low },
  };
}

const LEVELS: readonly QualityLevel[] = ['high', 'medium', 'low'];

/** `steps` levels cheaper than `level` (high → medium → low; low stays low). Never steps up. */
export function stepDownQuality(level: QualityLevel, steps = 1): QualityLevel {
  const i = Math.max(0, LEVELS.indexOf(level)) + Math.max(0, Math.floor(steps) || 0);
  return LEVELS[Math.min(LEVELS.length - 1, i)];
}

/** One tier of maquettekit.design.json → `threeD.qualityProfiles` (written by the design generator). */
export interface DesignQualityTier {
  dprMax?: number;
  /** Boolean, or prose such as "Soft shadow map 2048 or accumulative" / "None (baked or blob)". */
  shadows?: boolean | string;
  /** Boolean, or prose such as "Tone mapping only" / "None" (both → no post-processing pass) / "Selective (…)". */
  postprocessing?: boolean | string;
  textureMaxPx?: number;
  /** Boolean, or prose such as "MSAA" / "MSAA or FXAA" / "None". */
  antialias?: boolean | string;
  targetFps?: number;
  frameloop?: string;
}

const designTier = { high: 'desktop', medium: 'mobile', low: 'lowPower' } as const;
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);

/**
 * Converts maquettekit.design.json `threeD.qualityProfiles` into `createQualityProfiles()` overrides
 * (desktop → high, mobile → medium, lowPower / "low-power" → low). Accepts the `threeD` block or the
 * `qualityProfiles` block itself; missing tiers, fields and unparseable prose are skipped, so the kit defaults
 * stay in place. Mapping: `dprMax` → `dpr[1]` (the minimum is kept, capped at the max), `textureMaxPx` →
 * `textureMax`, `shadows` "None…" → off, otherwise on with the map size named in the text, `postprocessing`
 * "None" / "Tone mapping only" → off (tone mapping is a renderer setting, not a pass), `antialias` "MSAA…" → on,
 * "None" → off. `targetFps` and `frameloop` have no profile field and are ignored.
 * @example createQualityProfiles(qualityProfilesFromDesign(design.threeD))
 */
export function qualityProfilesFromDesign(threeD: unknown): Partial<Record<QualityLevel, Partial<QualityProfile>>> {
  const block = (threeD && typeof threeD === 'object' ? threeD : {}) as Record<string, unknown>;
  const qp = (block.qualityProfiles && typeof block.qualityProfiles === 'object' ? block.qualityProfiles : block) as Record<string, unknown>;
  const out: Partial<Record<QualityLevel, Partial<QualityProfile>>> = {};
  for (const level of LEVELS) {
    const raw = qp[designTier[level]] ?? (level === 'low' ? qp['low-power'] : undefined);
    if (!raw || typeof raw !== 'object') continue;
    const t = raw as DesignQualityTier;
    const o: Partial<QualityProfile> = {};
    const dprMax = num(t.dprMax);
    if (dprMax) o.dpr = [Math.min(defaultQualityProfiles[level].dpr[0], dprMax), dprMax];
    const tex = num(t.textureMaxPx);
    if (tex) o.textureMax = tex;
    if (typeof t.shadows === 'boolean') o.shadows = t.shadows;
    else if (typeof t.shadows === 'string' && t.shadows.trim()) {
      o.shadows = !/^\s*(none|no|off)\b/i.test(t.shadows);
      const size = /\b(256|512|1024|2048|4096)\b/.exec(t.shadows);
      if (o.shadows && size) o.shadowMapSize = Number(size[1]);
    }
    if (typeof t.postprocessing === 'boolean') o.postprocessing = t.postprocessing;
    else if (typeof t.postprocessing === 'string' && t.postprocessing.trim()) o.postprocessing = !/^\s*(none|no|off|tone[- ]?mapping only)\b/i.test(t.postprocessing);
    if (typeof t.antialias === 'boolean') o.antialias = t.antialias;
    else if (typeof t.antialias === 'string') { if (/msaa/i.test(t.antialias)) o.antialias = true; else if (/^\s*(none|no|off)\b/i.test(t.antialias)) o.antialias = false; }
    if (Object.keys(o).length) out[level] = o;
  }
  return out;
}

/** Initial level from coarse capability signals; refine at runtime with `createAdaptiveQuality`. */
export function pickQualityLevel(caps: GraphicsCapabilities, opts: { saveData?: boolean } = {}): QualityLevel {
  if (!caps.webgl) return 'low';
  if (caps.deviceClass === 'low-power' || opts.saveData) return 'low';
  if (caps.deviceClass === 'mobile' || !caps.webgl2) return 'medium';
  return 'high';
}

/**
 * Frame-time driven adaptive quality with hysteresis. Feed it frame deltas;
 * it emits a DPR factor (0.5..1) and can step the level down (never up
 * automatically past the initial level, to avoid oscillation): `degrade: true`
 * means the DPR floor is reached and frames are still slow. StudioCanvas with
 * `quality="auto"` answers it with `stepDownQuality()`.
 */
export function createAdaptiveQuality(opts: { targetMs?: number; window?: number; onChange: (state: { dprFactor: number; degrade: boolean }) => void }) {
  const target = opts.targetMs ?? 1000 / 50;
  const size = opts.window ?? 45;
  const samples: number[] = [];
  let factor = 1;
  let slowWindows = 0;
  return {
    /** @param dtMs frame delta in milliseconds */
    sample(dtMs: number) {
      if (dtMs <= 0 || dtMs > 250) return; // ignore tab switches
      samples.push(dtMs);
      if (samples.length < size) return;
      const sorted = samples.splice(0).sort((a, b) => a - b);
      const median = sorted[sorted.length >> 1];
      if (median > target * 1.25) {
        slowWindows++;
        const next = Math.max(0.5, +(factor - 0.125).toFixed(3));
        const degrade = slowWindows >= 4 && next === factor;
        if (next !== factor || degrade) { factor = next; opts.onChange({ dprFactor: factor, degrade }); }
      } else if (median < target * 0.75 && factor < 1) {
        slowWindows = 0;
        factor = Math.min(1, +(factor + 0.125).toFixed(3));
        opts.onChange({ dprFactor: factor, degrade: false });
      } else slowWindows = Math.max(0, slowWindows - 1);
    },
    get dprFactor() { return factor; },
  };
}
