'use client';
import type { ReactNode } from 'react';
import styles from './styles.module.css';

/** A step of the configurator: numbered heading + current value as text. */
export function Step({ n, title, value, children }: { n: string; title: string; value?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-line-strong pb-6 pt-3">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="flex items-baseline gap-2.5 font-display text-[1.05rem] font-semibold tracking-[-0.01em]">
          <span className="font-mono text-[11px] font-normal tracking-[0.08em] text-muted">{n}</span>{title}
        </h3>
        {value ? <p className="m-0 text-right text-[13px] text-muted">{value}</p> : null}
      </div>
      {children}
    </section>
  );
}

export interface CardOption { id: string; name: string; note?: string; meta?: string; swatch?: readonly string[] }

/** Native radio group drawn as cards: arrow keys move, Space selects, the name is always text. */
export function OptionCards({ name, legend, value, options, onChange, columns = 2, disabled }: {
  name: string; legend: string; value: string; options: readonly CardOption[]; onChange: (id: string) => void; columns?: 1 | 2 | 3; disabled?: boolean;
}) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" disabled={disabled}>
      <legend className="mk-sr-only">{legend}</legend>
      <div className={`grid gap-2 ${columns === 3 ? 'grid-cols-1 @md:grid-cols-3' : columns === 2 ? 'grid-cols-1 @xs:grid-cols-2' : 'grid-cols-1'}`}>
        {options.map((o) => (
          <label key={o.id} className={styles.card}>
            <input type="radio" className="mk-sr-only" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
            {o.swatch ? (
              <span aria-hidden="true" className={styles.swatch}>
                {o.swatch.map((c, i) => <span key={i} style={{ background: c }} />)}
              </span>
            ) : null}
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="flex items-baseline justify-between gap-2">
                <span className={`${styles.cardName} text-[14px] leading-tight`}>{o.name}</span>
                {o.meta ? <span className="whitespace-nowrap font-mono text-[11.5px] text-muted">{o.meta}</span> : null}
              </span>
              {o.note ? <span className="text-[12.5px] leading-snug text-muted">{o.note}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Compact segmented radio group (camera views). */
export function Segmented({ name, legend, value, options, onChange, disabled }: {
  name: string; legend: string; value: string | null; options: readonly { id: string; label: string }[]; onChange: (id: string) => void; disabled?: boolean;
}) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" disabled={disabled}>
      <legend className="mk-sr-only">{legend}</legend>
      <div className={styles.segmented}>
        {options.map((o) => (
          <label key={o.id} className={styles.segment}>
            <input type="radio" className="mk-sr-only" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
