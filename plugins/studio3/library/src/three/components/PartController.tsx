'use client';
/**
 * PartController — per-part / per-material overrides, highlight, exploded view and visibility for a loaded model.
 *
 * Ownership rules:
 *  - The model's materials belong to the model cache and may be shared between parts and between clones.
 *    The controller therefore clones a material the first time a part needs to differ (once per mesh+material),
 *    never mutates an original, and on dispose puts every original back and disposes its clones.
 *  - Node transforms are restored on dispose, so the same scene clone can be handed to another controller.
 *
 * Parts are the NAMED nodes of the model. Exploded view reads glTF node `extras` (three puts them in
 * `userData`): `explodeDirection: [x, y, z]` (in the node's parent space) and `explodeDistance`.
 * Selection/highlight is a mild emissive lift — never the only signal: `onSelect`/`onHover` give the part to the
 * DOM so the name can be shown as text.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Color, Vector3, type ColorRepresentation, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { useStudioMotion } from '../../motion';

export interface PartInfo {
  name: string;
  /** `extras.label` or the node name. */
  label: string;
  description?: string;
  /** Has explode metadata. */
  explodes: boolean;
  /** Material names used under this part. */
  materials: string[];
  object: Object3D;
}

/** Subset of MeshStandardMaterial/MeshPhysicalMaterial props that make sense to switch at runtime. */
export interface MaterialOverride {
  color?: ColorRepresentation;
  roughness?: number;
  metalness?: number;
  emissive?: ColorRepresentation;
  emissiveIntensity?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenRoughness?: number;
  sheenColor?: ColorRepresentation;
  envMapIntensity?: number;
  opacity?: number;
}

/** `part:Body` targets one named part (and its descendants); `material:ShellMatte` targets every use of a material. */
export type PartSelector = `part:${string}` | `material:${string}`;

interface Slot { mesh: Mesh; index: number; original: Material; clone: Material | null; part: string | null; emissive?: Color; emissiveIntensity?: number }
interface Explode { object: Object3D; base: Vector3; dir: Vector3; distance: number; order: number }

const COLOR_KEYS = new Set(['color', 'emissive', 'sheenColor']);
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class PartControllerCore {
  readonly parts: PartInfo[] = [];
  private slots: Slot[] = [];
  private explode: Explode[] = [];
  private hidden = new Map<Object3D, boolean>();
  private highlighted: string | null = null;
  private selected: string | null = null;
  private amount = 0;
  private disposed = false;

  constructor(readonly root: Object3D, private opts: { highlightColor?: ColorRepresentation; highlightIntensity?: number; stagger?: number } = {}) {
    // Which nodes are "parts"? Prefer authored intent: named nodes carrying `label` / `explodeDirection` extras.
    // Models without such extras fall back to "every named node".
    const authored = (o: Object3D): boolean => !!o.name && (typeof o.userData?.label === 'string' || Array.isArray(o.userData?.explodeDirection));
    let anyAuthored = false;
    root.traverse((o) => { if (o !== root && authored(o)) anyAuthored = true; });
    const isPart = (o: Object3D): boolean => (anyAuthored ? authored(o) : !!o.name);
    const partOf = new Map<Object3D, string>();
    const owners = new Set<string>();
    root.traverse((o) => {
      // nearest part at or above the node (a nested part, e.g. Grille under Body, owns its own meshes)
      const own = isPart(o) ? o.name : o.parent ? partOf.get(o.parent) : undefined;
      if (own) partOf.set(o, own);
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        if (own) owners.add(own);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m, index) => this.slots.push({ mesh, index, original: m, clone: null, part: own ?? null }));
      }
    });
    const seen = new Set<string>();
    root.traverse((o) => {
      const name = partOf.get(o);
      if (!name || o.name !== name || seen.has(name) || !owners.has(name)) return;
      seen.add(name);
      const ud = o.userData ?? {};
      const dir = Array.isArray(ud.explodeDirection) && ud.explodeDirection.length === 3 ? new Vector3(...(ud.explodeDirection as [number, number, number])) : null;
      const distance = typeof ud.explodeDistance === 'number' ? ud.explodeDistance : 0;
      if (dir && dir.lengthSq() > 0 && distance !== 0) this.explode.push({ object: o, base: o.position.clone(), dir: dir.normalize(), distance, order: 0 });
      this.parts.push({
        name, label: typeof ud.label === 'string' ? ud.label : name, description: typeof ud.description === 'string' ? ud.description : undefined,
        explodes: !!dir && distance !== 0, object: o,
        materials: [...new Set(this.slots.filter((s) => s.part === name).map((s) => s.original.name).filter(Boolean))],
      });
    });
    // Stagger order: farthest travellers leave first.
    [...this.explode].sort((a, b) => Math.abs(b.distance) - Math.abs(a.distance)).forEach((e, i) => { e.order = i; });
  }

  /** The named part an object (e.g. a raycast hit) belongs to. */
  partOf(object: Object3D | null | undefined): PartInfo | null {
    for (let o = object; o; o = o.parent) {
      const p = this.parts.find((x) => x.object === o);
      if (p) return p;
      if (o === this.root) break;
    }
    return null;
  }

  private writable(slot: Slot): Material {
    if (!slot.clone) {
      slot.clone = slot.original.clone();
      slot.clone.name = slot.original.name;
      if (Array.isArray(slot.mesh.material)) slot.mesh.material[slot.index] = slot.clone; else slot.mesh.material = slot.clone;
    }
    return slot.clone;
  }
  private match(selector: PartSelector): Slot[] {
    const i = selector.indexOf(':');
    const kind = selector.slice(0, i), name = selector.slice(i + 1);
    return this.slots.filter((s) => (kind === 'part' ? s.part === name : s.original.name === name));
  }

  /**
   * Replace ALL overrides in one go (declarative). Slots that no longer have an override return to the
   * original values. Later selectors win; `part:` beats `material:` when both are listed in that order.
   */
  setOverrides(overrides: Readonly<Partial<Record<PartSelector, MaterialOverride>>>): void {
    if (this.disposed) return;
    const merged = new Map<Slot, MaterialOverride>();
    for (const [sel, o] of Object.entries(overrides) as [PartSelector, MaterialOverride | undefined][]) {
      if (!o) continue;
      for (const slot of this.match(sel)) merged.set(slot, { ...merged.get(slot), ...o });
    }
    for (const slot of this.slots) {
      const o = merged.get(slot);
      if (!o && !slot.clone) continue;
      const m = this.writable(slot) as unknown as Record<string, unknown>;
      const src = slot.original as unknown as Record<string, unknown>;
      // reset the switchable props to the original, then apply the override
      for (const k of ['color', 'roughness', 'metalness', 'emissive', 'emissiveIntensity', 'clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'sheenColor', 'envMapIntensity', 'opacity']) {
        if (!(k in src)) continue;
        if (COLOR_KEYS.has(k)) (m[k] as Color).copy(src[k] as Color); else m[k] = src[k];
      }
      if (o) for (const [k, val] of Object.entries(o)) {
        if (val === undefined || !(k in m)) continue;
        if (COLOR_KEYS.has(k)) (m[k] as Color).set(val as ColorRepresentation); else m[k] = val;
      }
      (m as unknown as Material).transparent = (slot.original.transparent || ((m.opacity as number) ?? 1) < 1);
      slot.emissive = undefined; // re-capture the base emissive for highlighting
      (m as unknown as Material).needsUpdate = true;
    }
    this.paintHighlight();
  }

  /** Hover highlight (transient) and selection (sticky) — both lift emissive on the part's materials. */
  setHighlight(part: string | null): void { if (this.highlighted !== part) { this.highlighted = part; this.paintHighlight(); } }
  setSelected(part: string | null): void { if (this.selected !== part) { this.selected = part; this.paintHighlight(); } }

  private paintHighlight(): void {
    if (this.disposed) return;
    const color = new Color(this.opts.highlightColor ?? '#ffb347');
    const strength = this.opts.highlightIntensity ?? 0.35;
    for (const slot of this.slots) {
      const on = slot.part !== null && (slot.part === this.selected || slot.part === this.highlighted);
      if (!on && slot.emissive === undefined) continue;
      const m = this.writable(slot) as MeshStandardMaterial;
      if (!m.emissive) continue;
      if (slot.emissive === undefined) { slot.emissive = m.emissive.clone(); slot.emissiveIntensity = m.emissiveIntensity; }
      if (on) {
        const k = slot.part === this.selected ? strength : strength * 0.6;
        m.emissive.copy(slot.emissive).multiplyScalar(slot.emissiveIntensity ?? 1).lerp(color, k);
        m.emissiveIntensity = 1;
      } else {
        m.emissive.copy(slot.emissive); m.emissiveIntensity = slot.emissiveIntensity ?? 1;
        slot.emissive = undefined;
      }
    }
  }

  /** Show/hide named parts (declarative: pass the full hidden list). */
  setHidden(names: readonly string[]): void {
    if (this.disposed) return;
    for (const p of this.parts) {
      if (!this.hidden.has(p.object)) this.hidden.set(p.object, p.object.visible);
      p.object.visible = names.includes(p.name) ? false : (this.hidden.get(p.object) ?? true);
    }
  }

  /** Exploded view amount 0..1, applied immediately. Parts leave in a stagger (farthest first) with ease-in-out. */
  setExplode(amount: number): void {
    if (this.disposed) return;
    this.amount = Math.min(1, Math.max(0, amount));
    const n = this.explode.length;
    const stagger = this.opts.stagger ?? 0.35;
    for (const e of this.explode) {
      const delay = n > 1 ? (e.order / (n - 1)) * stagger : 0;
      const p = easeInOut(Math.min(1, Math.max(0, (this.amount - delay) / (1 - stagger))));
      e.object.position.copy(e.base).addScaledVector(e.dir, e.distance * p);
    }
  }
  get explodeAmount(): number { return this.amount; }

  /**
   * Take control of the root again after `dispose()` (no-op otherwise; returns whether it re-attached). React
   * StrictMode — and any effect re-run — cleans up and sets up the SAME instance: dispose() restored every original,
   * so this starts from that clean state (no overrides, highlight or hidden parts) and re-applies the explode amount.
   */
  reattach(): boolean {
    if (!this.disposed) return false;
    this.disposed = false;
    this.hidden.clear();
    this.highlighted = null;
    this.selected = null;
    for (const slot of this.slots) { slot.emissive = undefined; slot.emissiveIntensity = undefined; }
    this.setExplode(this.amount);
    return true;
  }

  /** Restore originals and release clones. Undo with `reattach()`. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const e of this.explode) e.object.position.copy(e.base);
    for (const [o, v] of this.hidden) o.visible = v;
    for (const slot of this.slots) {
      if (!slot.clone) continue;
      if (Array.isArray(slot.mesh.material)) slot.mesh.material[slot.index] = slot.original; else slot.mesh.material = slot.original;
      slot.clone.dispose(); // textures are shared with the original — not disposed here
      slot.clone = null;
    }
  }
}

export interface PartControllerProps {
  /** The model clone to control (from `useModel().scene` / `<Model onLoaded>`). */
  root: Object3D | null;
  overrides?: Readonly<Partial<Record<PartSelector, MaterialOverride>>>;
  highlight?: string | null;
  selected?: string | null;
  hidden?: readonly string[];
  /** Target explode amount 0..1; animated with a critically damped approach (cut under reduced motion). */
  explode?: number;
  /** Seconds to settle the explode animation. */
  explodeTime?: number;
  highlightColor?: ColorRepresentation;
  highlightIntensity?: number;
  /** Receives the parts list once the controller is built — mirror it in the DOM. */
  onReady?: (parts: PartInfo[], core: PartControllerCore) => void;
}

/** Declarative wrapper around `PartControllerCore`. Renders nothing; invalidates the demand loop on every change. */
export const PartController = forwardRef<PartControllerCore | null, PartControllerProps>(function PartController(
  { root, overrides, highlight = null, selected = null, hidden, explode = 0, explodeTime = 0.6, highlightColor, highlightIntensity, onReady }, ref,
) {
  const invalidate = useThree((s) => s.invalidate);
  const { reduced } = useStudioMotion();
  const core = useMemo(() => (root ? new PartControllerCore(root, { highlightColor, highlightIntensity }) : null), [root, highlightColor, highlightIntensity]);
  useImperativeHandle<PartControllerCore | null, PartControllerCore | null>(ref, () => core, [core]);
  const ready = useRef(onReady);
  ready.current = onReady;
  const latest = useRef({ overrides, highlight, selected, hidden });
  latest.current = { overrides, highlight, selected, hidden };
  const anim = useRef({ value: 0, vel: 0, target: 0 });

  // Setup mirrors cleanup: cleanup disposes (restores the model), setup (re)attaches and applies the current props,
  // so a StrictMode / re-run setup on the same core is live again. onReady sees the model with its overrides applied.
  useEffect(() => {
    if (!core) return;
    core.reattach();
    const p = latest.current;
    core.setOverrides(p.overrides ?? {});
    core.setHidden(p.hidden ?? []);
    core.setHighlight(p.highlight);
    core.setSelected(p.selected);
    core.setExplode(anim.current.value);
    ready.current?.(core.parts, core);
    invalidate();
    return () => { core.dispose(); invalidate(); };
  }, [core, invalidate]);
  useEffect(() => { core?.setOverrides(overrides ?? {}); invalidate(); }, [core, overrides, invalidate]);
  useEffect(() => { core?.setHighlight(highlight); invalidate(); }, [core, highlight, invalidate]);
  useEffect(() => { core?.setSelected(selected); invalidate(); }, [core, selected, invalidate]);
  useEffect(() => { core?.setHidden(hidden ?? []); invalidate(); }, [core, hidden, invalidate]);
  useEffect(() => {
    anim.current.target = Math.min(1, Math.max(0, explode));
    if (reduced && core) { anim.current.value = anim.current.target; anim.current.vel = 0; core.setExplode(anim.current.value); }
    invalidate();
  }, [core, explode, reduced, invalidate]);

  useFrame((_, rawDt) => {
    const a = anim.current;
    if (!core || a.value === a.target) return;
    const dt = Math.min(rawDt, 1 / 20);
    const omega = 2 / Math.max(0.05, explodeTime / 2);
    const x = omega * dt, exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = a.value - a.target, temp = (a.vel + omega * change) * dt;
    a.vel = (a.vel - omega * temp) * exp;
    a.value = a.target + (change + temp) * exp;
    if (Math.abs(a.value - a.target) < 5e-4) { a.value = a.target; a.vel = 0; }
    core.setExplode(a.value);
    invalidate();
  });
  return null;
});
