'use client';
/**
 * SceneFallback — the standard "3D is not available" block for `StudioCanvas`'s `fallback` prop.
 * A static render + the same facts the scene communicates, so nothing is lost without WebGL.
 * Inline styles + theme variables only (portable, no Tailwind).
 */
import type { CSSProperties, ReactNode } from 'react';

export interface SceneFallbackProps {
  title: string;
  /** Static render of the scene (poster). Decorative when `imageAlt` is empty. */
  image?: string;
  imageAlt?: string;
  /** Short description of what the scene shows. */
  description?: ReactNode;
  /** Key facts as term/value pairs (dimensions, materials, selected options…). */
  facts?: readonly { label: string; value: ReactNode }[];
  /** Why the fallback is showing (already announced by StudioCanvas; use for model-load errors). */
  reason?: ReactNode;
  /** Actions, e.g. a retry button. */
  children?: ReactNode;
  /** 'cover' fills the stage with the image and overlays the text; 'stack' puts the text under it. */
  layout?: 'cover' | 'stack';
  style?: CSSProperties;
}

export function SceneFallback({ title, image, imageAlt = '', description, facts, reason, children, layout = 'stack', style }: SceneFallbackProps) {
  const cover = layout === 'cover';
  return (
    <div data-scene-fallback="" style={{ ...wrap, ...style }}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={imageAlt} decoding="async" style={cover ? imgCover : imgStack} />
      ) : null}
      <div style={cover ? panelCover : panelStack}>
        <p style={kicker}>Static preview</p>
        <p style={heading}>{title}</p>
        {description ? <p style={body}>{description}</p> : null}
        {facts?.length ? (
          <dl style={dl}>
            {facts.map((f) => (
              <div key={f.label} style={row}>
                <dt style={dt}>{f.label}</dt>
                <dd style={dd}>{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {reason ? <p role="alert" style={{ ...body, color: 'var(--s3-ink, #11110f)' }}>{reason}</p> : null}
        {children}
      </div>
    </div>
  );
}

const wrap: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16, overflow: 'auto', color: 'var(--s3-ink, #11110f)', textAlign: 'left' };
const imgStack: CSSProperties = { display: 'block', maxWidth: '100%', maxHeight: '55%', minHeight: 0, objectFit: 'contain', flex: '0 1 auto' };
const imgCover: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
const panelStack: CSSProperties = { width: '100%', maxWidth: 420, display: 'grid', gap: 6 };
const panelCover: CSSProperties = { ...panelStack, position: 'relative', marginTop: 'auto', padding: 14, background: 'color-mix(in srgb, var(--s3-surface, #fbf9f4) 88%, transparent)', border: '1px solid var(--s3-line, #11110f24)', borderRadius: 'var(--s3-radius-m, 10px)' };
const kicker: CSSProperties = { margin: 0, fontFamily: 'var(--s3-font-mono, ui-monospace, monospace)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--s3-ink-muted, #5c5a52)' };
const heading: CSSProperties = { margin: 0, fontFamily: 'var(--s3-font-display, system-ui, sans-serif)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.1 };
const body: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--s3-ink-muted, #5c5a52)' };
const dl: CSSProperties = { margin: '4px 0 0', display: 'grid', gap: 0, borderTop: '1px solid var(--s3-line, #11110f24)' };
const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid var(--s3-line, #11110f24)', fontSize: 13 };
const dt: CSSProperties = { color: 'var(--s3-ink-muted, #5c5a52)' };
const dd: CSSProperties = { margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
