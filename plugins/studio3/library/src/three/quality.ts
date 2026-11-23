/**
 * Quality profiles. Values are STARTING POINTS to be verified on the project's
 * target devices — there is no universal polygon or texture budget.
 * Override per project via `createQualityProfiles()` or studio3.design.json → threeD.qualityProfiles.
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
  /** Asset manifest variant to load (see `studio3 assets variants`). */
  modelVariant: 'desktop' | 'mobile' | 'low-power';
  /** Multiplier for particle / instance counts. */
  density: number;
  /** Environment map resolution for generated environments. */
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
 * automatically past the initial level, to avoid oscillation).
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
