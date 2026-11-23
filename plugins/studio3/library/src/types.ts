/**
 * Studio³ Component & Effect Library — shared contracts.
 * Every effect lives in `src/effects/<id>/` with:
 *   meta.ts    → `export const meta: EffectMeta` (pure data, no JSX, type-only imports)
 *   index.tsx  → `export default function Effect(props: EffectProps)`
 * Every demo lives in `src/demos/<specialty>/<id>/` with meta.ts (DemoMeta) + index.tsx.
 * `scripts/build-catalog.mjs` scans these folders and generates the registry.
 */
import type { ComponentType } from 'react';

export type Specialty = 'product' | 'cinematic' | 'data' | 'social' | '3d';

export type EffectCategory =
  | 'typography' | 'navigation' | 'scroll' | 'layout' | 'gestures' | 'cards' | 'buttons' | 'loading'
  | 'charts' | 'social' | 'svg' | 'backgrounds' | '3d-transforms' | 'camera' | 'spatial' | 'shaders';

export type Technology =
  | 'css' | 'waapi' | 'view-transitions' | 'motion' | 'gsap' | 'svg' | 'canvas2d' | 'd3'
  | 'three' | 'r3f' | 'drei' | 'rapier' | 'glsl';

export type InteractionType = 'none' | 'hover' | 'press' | 'drag' | 'scroll' | 'pointer' | 'keyboard' | 'time' | 'data';

/** 1 = drop-in, 2 = needs integration thought, 3 = advanced (state, WebGL, orchestration). */
export type Complexity = 1 | 2 | 3;
export type Intensity = 'subtle' | 'moderate' | 'bold';

export type ParamSpec =
  | { key: string; label: string; type: 'number'; default: number; min: number; max: number; step?: number; unit?: string }
  | { key: string; label: string; type: 'boolean'; default: boolean }
  | { key: string; label: string; type: 'select'; default: string; options: readonly string[] }
  | { key: string; label: string; type: 'color'; default: string }
  | { key: string; label: string; type: 'text'; default: string; maxLength?: number };

export type ParamValues = Record<string, number | boolean | string>;

export interface Dependency {
  /** npm package name. */
  name: string;
  /** semver range the recipe was verified against. */
  version: string;
  optional?: boolean;
}

export interface EffectMeta {
  /** Unique kebab-case id; equals the folder name. */
  id: string;
  name: string;
  /** One or two sentences: what it does and what makes it distinctive. */
  description: string;
  category: EffectCategory;
  specialties: readonly Specialty[];
  technology: readonly Technology[];
  interaction: readonly InteractionType[];
  complexity: Complexity;
  intensity: Intensity;
  /** Suitable applications, concrete ("pricing toggle", "hero headline"). */
  applications: readonly string[];
  /** npm dependencies beyond react/react-dom. Empty for CSS/WAAPI recipes. */
  dependencies: readonly Dependency[];
  params: readonly ParamSpec[];
  accessibility: readonly string[];
  /** What happens under prefers-reduced-motion (or the Studio³ reduced toggle). */
  reducedMotion: string;
  performance: readonly string[];
  preview?: {
    /** Preview stage min height in px (default 360). */
    height?: number;
    /** Stage background: themed surface (default), always-dark ink, or none. */
    stage?: 'surface' | 'ink' | 'none';
    /** The preview needs a scrollable stage (scroll-driven recipes). */
    scroll?: boolean;
  };
}

export interface EffectProps<P extends ParamValues = ParamValues> {
  /** Resolved parameter values (defaults merged with user overrides). */
  params: P;
}

export type EffectComponent = ComponentType<EffectProps<any>>;

export interface DemoMeta {
  id: string;
  name: string;
  specialty: Specialty;
  /** One sentence. */
  summary: string;
  /** What this demo proves about the specialty. */
  highlights: readonly string[];
  technology: readonly Technology[];
  /** Effect recipe ids imported and rendered by this demo (verified by tests/unit/library/contract.test.ts). */
  uses: readonly string[];
  /** Recipe ids whose technique this demo re-implements locally (e.g. against its own data) instead of importing. */
  adapts?: readonly string[];
  /** Other specialties/modules this demo invokes (cross-studio collaboration). */
  collaborates?: readonly (Specialty | 'motion-lab')[];
  has3d: boolean;
  accessibility: readonly string[];
  reducedMotion: string;
  performance: readonly string[];
  /** All data shown is simulated; say how. Required for data demos. */
  dataNote?: string;
}

export type DemoComponent = ComponentType<Record<string, never>>;

export interface EffectEntry { meta: EffectMeta; load: () => Promise<{ default: EffectComponent }>; }
export interface DemoEntry { meta: DemoMeta; load: () => Promise<{ default: DemoComponent }>; }

export const SPECIALTIES: readonly { id: Specialty; name: string; philosophy: string; skill: string }[] = [
  { id: 'product', name: 'Product Studio', philosophy: 'Make people want to use it.', skill: 'studio-product' },
  { id: 'cinematic', name: 'Cinematic Studio', philosophy: 'Make people remember it.', skill: 'studio-cinematic' },
  { id: 'data', name: 'Data Studio', philosophy: 'Make complex information immediately understandable.', skill: 'studio-data' },
  { id: 'social', name: 'Social Studio', philosophy: 'Make people participate.', skill: 'studio-social' },
  { id: '3d', name: '3D Studio', philosophy: 'Make digital experiences feel tangible.', skill: 'studio-3d' },
];

export const EFFECT_CATEGORIES: readonly EffectCategory[] = [
  'typography', 'navigation', 'scroll', 'layout', 'gestures', 'cards', 'buttons', 'loading',
  'charts', 'social', 'svg', 'backgrounds', '3d-transforms', 'camera', 'spatial', 'shaders',
];

/** Merge param defaults with overrides, clamping numbers and rejecting unknown select options. */
export function resolveParams(specs: readonly ParamSpec[], overrides: ParamValues = {}): ParamValues {
  const out: ParamValues = {};
  for (const s of specs) {
    const v = overrides[s.key];
    if (s.type === 'number') {
      const n = typeof v === 'number' && Number.isFinite(v) ? v : s.default;
      out[s.key] = Math.min(s.max, Math.max(s.min, n));
    } else if (s.type === 'boolean') out[s.key] = typeof v === 'boolean' ? v : s.default;
    else if (s.type === 'select') out[s.key] = typeof v === 'string' && s.options.includes(v) ? v : s.default;
    else out[s.key] = typeof v === 'string' ? v : s.default;
  }
  return out;
}
