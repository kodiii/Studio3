'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Section({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-line py-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="mk-label text-muted">{label}</h3>
        {hint ? <span className="mk-label text-muted normal-case tracking-normal">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** Radio group rendered as chips. Native radios → arrow-key navigation and form semantics for free. */
export function ChipGroup<T extends string>({ name, legend, value, options, onChange, columns }: {
  name: string; legend: string; value: T; options: readonly { value: T; label: string; swatch?: readonly string[]; disabled?: boolean }[]; onChange: (v: T) => void; columns?: number;
}) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mk-sr-only">{legend}</legend>
      <div className={columns ? 'grid gap-1.5' : 'flex flex-wrap gap-1.5'} style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
        {options.map((o) => (
          <label
            key={o.value}
            className="relative flex min-h-9 cursor-pointer items-center gap-2 rounded-[4px] border border-line px-2.5 py-1.5 text-[13px] leading-tight transition-colors duration-150 hover:border-line-strong has-[:checked]:border-line-strong has-[:checked]:bg-ink has-[:checked]:text-bg has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"
          >
            <input type="radio" className="mk-sr-only" name={name} value={o.value} checked={value === o.value} disabled={o.disabled} onChange={() => onChange(o.value)} />
            {o.swatch ? (
              <span aria-hidden="true" className="flex h-4 w-4 flex-none overflow-hidden rounded-full border border-line-strong/40">
                {o.swatch.map((c, i) => <span key={i} className="h-full flex-1" style={{ background: c }} />)}
              </span>
            ) : null}
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ToolButton({ label, children, className = '', ...rest }: { label: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button" aria-label={label} title={label}
      className={`grid h-9 min-w-9 place-items-center rounded-[4px] border border-line bg-surface px-2 font-mono text-[13px] text-ink transition-colors duration-150 hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-ink aria-pressed:text-bg ${className}`}
      {...rest}
    >{children}</button>
  );
}

export function Stat({ label, value, note, id }: { label: string; value: ReactNode; note?: string; id?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5">
      <dt className="text-[13px] text-muted">{label}{note ? <span className="ml-1.5 font-mono text-[10.5px] uppercase tracking-wider">{note}</span> : null}</dt>
      <dd className="m-0 text-right font-mono text-[13px] tabular-nums" data-stat={id}>{value}</dd>
    </div>
  );
}
