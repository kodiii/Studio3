'use client';
/**
 * Hotspots — annotations anchored to 3D points, drawn as real DOM buttons.
 *
 * Three pieces share a store (create it with `useHotspotStore()`):
 *  - `<HotspotAnchors>`  inside the canvas: projects each anchor to screen space after every RENDERED frame (so it
 *                        costs nothing while a demand-driven scene is idle), tests occlusion with one ray per
 *                        hotspot and writes transform/opacity straight to the marker elements (no React re-render).
 *  - `<HotspotLayer>`    DOM overlay, absolutely positioned over the canvas (same positioned parent): numbered
 *                        marker buttons + the open annotation card.
 *  - `<HotspotList>`     the mirrored, always-readable list of the same annotations for keyboard and screen-reader
 *                        users (and for the no-WebGL fallback, where there is nothing to anchor to).
 * Occluded markers fade (they stay clickable — the list is the stable path); markers behind the camera are hidden.
 */
import { addAfterEffect, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { Box3, Raycaster, Vector3, type Object3D } from 'three';
import type { Vec3 } from './OrbitInspect';

export interface Hotspot {
  id: string;
  label: string;
  description?: string;
  /** Anchor to a named node (its bounding-box centre) … */
  node?: string;
  /** … and/or a fixed point / offset (model space when `node` is set, otherwise world space). */
  position?: Vec3;
}

export interface HotspotStore { elements: Map<string, HTMLElement>; register(id: string, el: HTMLElement | null): void }
export function useHotspotStore(): HotspotStore {
  return useMemo(() => {
    const elements = new Map<string, HTMLElement>();
    return { elements, register(id, el) { if (el) elements.set(id, el); else elements.delete(id); } };
  }, []);
}

export interface HotspotAnchorsProps {
  store: HotspotStore;
  hotspots: readonly Hotspot[];
  /** Model root used to resolve `node` names and as the occluder. */
  root?: Object3D | null;
  /** Fade markers hidden behind geometry. One raycast per hotspot per rendered frame. */
  occlude?: boolean;
}

export function HotspotAnchors({ store, hotspots, root, occlude = true }: HotspotAnchorsProps) {
  const invalidate = useThree((s) => s.invalidate);
  const get = useThree((s) => s.get);
  const tmp = useMemo(() => ({ world: new Vector3(), ndc: new Vector3(), dir: new Vector3(), box: new Box3(), ray: new Raycaster() }), []);
  const nodes = useMemo(() => {
    const map = new Map<string, Object3D>();
    if (root) for (const h of hotspots) { if (h.node) { const o = root.getObjectByName(h.node); if (o) map.set(h.id, o); } }
    return map;
  }, [root, hotspots]);
  useEffect(() => { invalidate(); }, [nodes, hotspots, invalidate]);
  const live = useRef({ hotspots, nodes, root, occlude });
  live.current = { hotspots, nodes, root, occlude };

  // Project AFTER the frame is rendered: by then every useFrame (camera rigs, controls, exploded parts) has run and
  // the matrices match the pixels. Projecting inside useFrame lags one frame, which a demand loop never corrects.
  useEffect(() => addAfterEffect(() => {
    const { camera, size } = get();
    const { hotspots, nodes, root, occlude } = live.current;
    camera.updateMatrixWorld();
    root?.updateWorldMatrix(true, true);
    for (const h of hotspots) {
      const el = store.elements.get(h.id);
      if (!el) continue;
      const node = nodes.get(h.id);
      if (node) {
        tmp.box.setFromObject(node);
        tmp.box.getCenter(tmp.world);
        if (h.position) tmp.world.add(tmp.dir.set(...h.position));
      } else if (h.position) tmp.world.set(...h.position);
      else { el.style.visibility = 'hidden'; continue; }
      tmp.ndc.copy(tmp.world).project(camera);
      const behind = tmp.ndc.z > 1 || tmp.ndc.z < -1;
      if (behind) { el.style.visibility = 'hidden'; continue; }
      const x = (tmp.ndc.x * 0.5 + 0.5) * size.width, y = (-tmp.ndc.y * 0.5 + 0.5) * size.height;
      let hiddenByGeometry = false;
      if (occlude && root) {
        const dist = tmp.dir.copy(tmp.world).sub(camera.position).length();
        tmp.ray.set(camera.position, tmp.dir.divideScalar(dist));
        tmp.ray.far = dist - 0.02;
        hiddenByGeometry = tmp.ray.intersectObject(root, true).some((i) => i.object.visible && i.distance < dist - 0.03);
      }
      el.style.visibility = 'visible';
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      el.style.opacity = hiddenByGeometry ? '0.28' : '1';
      el.dataset.occluded = String(hiddenByGeometry);
    }
  }), [get, store, tmp]);
  return null;
}

export interface HotspotLayerProps {
  store: HotspotStore;
  hotspots: readonly Hotspot[];
  active?: string | null;
  onSelect?: (id: string | null) => void;
  /** Render the open annotation card next to the marker (default true). */
  card?: boolean;
  style?: CSSProperties;
}

/** DOM overlay with the marker buttons. Place it as a sibling of the StudioCanvas inside a `position: relative` box. */
export function HotspotLayer({ store, hotspots, active = null, onSelect, card = true, style }: HotspotLayerProps) {
  return (
    <div data-hotspot-layer="" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', ...style }}>
      {hotspots.map((h, i) => {
        const open = active === h.id;
        return (
          <div key={h.id} ref={(el) => store.register(h.id, el)} style={{ ...anchor, zIndex: open ? 2 : 1 }}>
            <button
              type="button" aria-label={`Annotation ${i + 1}: ${h.label}`} aria-expanded={open} data-hotspot={h.id}
              onClick={() => onSelect?.(open ? null : h.id)}
              onKeyDown={(e) => { if (e.key === 'Escape' && open) onSelect?.(null); }}
              style={{ ...marker, ...(open ? markerOn : null) }}
            >{i + 1}</button>
            {open && card ? (
              <div role="note" style={cardStyle}>
                <strong style={{ display: 'block', fontSize: 13 }}>{h.label}</strong>
                {h.description ? <span style={{ display: 'block', marginTop: 2, fontSize: 12, lineHeight: 1.4, color: 'var(--s3-ink-muted, #5c5a52)' }}>{h.description}</span> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export interface HotspotListProps {
  hotspots: readonly Hotspot[];
  active?: string | null;
  onSelect?: (id: string | null) => void;
  /** Accessible name of the list. */
  label?: string;
  renderItem?: (h: Hotspot, index: number, active: boolean) => ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** The same annotations as an ordered list — the stable, keyboard-first equivalent of the floating markers. */
export function HotspotList({ hotspots, active = null, onSelect, label = 'Annotations', renderItem, className, style }: HotspotListProps) {
  const ref = useRef<HTMLOListElement>(null);
  return (
    <ol ref={ref} aria-label={label} className={className} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 0, ...style }}>
      {hotspots.map((h, i) => {
        const on = active === h.id;
        return (
          <li key={h.id} style={{ borderTop: '1px solid var(--s3-line, #11110f24)' }}>
            <button type="button" aria-pressed={on} onClick={() => onSelect?.(on ? null : h.id)} style={listButton}>
              {renderItem ? renderItem(h, i, on) : (
                <>
                  <span aria-hidden="true" style={{ ...marker, ...(on ? markerOn : null), position: 'static', flex: 'none', width: 24, height: 24, fontSize: 11 }}>{i + 1}</span>
                  <span style={{ display: 'grid', gap: 2, textAlign: 'left' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{h.label}</span>
                    {h.description ? <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--s3-ink-muted, #5c5a52)' }}>{h.description}</span> : null}
                  </span>
                </>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const anchor: CSSProperties = { position: 'absolute', left: 0, top: 0, visibility: 'hidden', transition: 'opacity 160ms linear', willChange: 'transform' };
const marker: CSSProperties = {
  display: 'grid', placeItems: 'center', width: 30, height: 30, padding: 0, borderRadius: '50%', pointerEvents: 'auto', cursor: 'pointer',
  font: '600 12px/1 var(--s3-font-mono, ui-monospace, monospace)', color: 'var(--s3-ink, #11110f)', background: 'var(--s3-surface, #fbf9f4)',
  border: '1.5px solid var(--s3-line-strong, #11110f)', boxShadow: '0 1px 6px rgb(0 0 0 / 0.25)',
};
const markerOn: CSSProperties = { background: 'var(--s3-ink, #11110f)', color: 'var(--s3-surface, #fbf9f4)' };
const cardStyle: CSSProperties = {
  position: 'absolute', left: '50%', top: 'calc(100% + 8px)', transform: 'translateX(-50%)', width: 'max-content', maxWidth: 220, padding: '8px 10px', pointerEvents: 'auto',
  color: 'var(--s3-ink, #11110f)', background: 'var(--s3-surface, #fbf9f4)', border: '1px solid var(--s3-line-strong, #11110f)', borderRadius: 'var(--s3-radius-s, 4px)',
  boxShadow: '0 6px 24px rgb(0 0 0 / 0.18)', textAlign: 'left',
};
const listButton: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', minHeight: 44, padding: '10px 0', background: 'none', border: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' };
