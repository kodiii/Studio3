'use client';
import type { EffectMeta } from '@studio3/library/types';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SPECIALTIES, TECH_LABEL, isWebGL } from '@/lib/site';
import { EffectStage } from './EffectStage';

type Facet = 'category' | 'technology' | 'interaction' | 'specialty' | 'complexity' | 'intensity';
type Filters = Record<Facet, string | null>;
const EMPTY: Filters = { category: null, technology: null, interaction: null, specialty: null, complexity: null, intensity: null };
const COMPLEXITY = { '1': 'Drop-in', '2': 'Integrate', '3': 'Advanced' } as const;

function matches(m: EffectMeta, f: Filters, q: string): boolean {
  if (f.category && m.category !== f.category) return false;
  if (f.technology && !m.technology.includes(f.technology as never)) return false;
  if (f.interaction && !m.interaction.includes(f.interaction as never)) return false;
  if (f.specialty && !m.specialties.includes(f.specialty as never)) return false;
  if (f.complexity && String(m.complexity) !== f.complexity) return false;
  if (f.intensity && m.intensity !== f.intensity) return false;
  if (!q) return true;
  const hay = `${m.id} ${m.name} ${m.description} ${m.category} ${m.technology.join(' ')} ${m.applications.join(' ')}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}

function CardPreview({ meta }: { meta: EffectMeta }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [hot, setHot] = useState(false);
  const gl = isWebGL(meta.technology);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '100px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // WebGL previews mount only on hover/focus of the card: browsers cap live GL contexts.
  const live = gl ? hot && inView : inView;
  return (
    <div ref={ref} className="relative aspect-[16/10] overflow-hidden border-b border-line bg-surface-2"
      onPointerEnter={() => setHot(true)} onPointerLeave={() => setHot(false)}>
      {live ? (
        <div inert aria-hidden="true" className="pointer-events-none absolute inset-0 [&>div]:!min-h-0 [&>div]:h-full"><EffectStage id={meta.id} /></div>
      ) : (
        <div aria-hidden="true" className="absolute inset-0 grid place-items-center" style={{ backgroundImage: 'radial-gradient(var(--s3-line) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
          <span className="s3-label rounded-full bg-surface px-2.5 py-1 text-muted">{meta.category}</span>
        </div>
      )}
      {gl && !live ? <span className="s3-label absolute bottom-2 left-2 rounded-full bg-ink px-2 py-1 text-bg">WebGL · hover to run</span> : null}
    </div>
  );
}

function FacetRow({ label, facet, options, filters, set, render }: { label: string; facet: Facet; options: readonly string[]; filters: Filters; set: (f: Facet, v: string | null) => void; render?: (v: string) => string }) {
  return (
    <fieldset className="grid gap-2 border-t border-line pt-3 md:grid-cols-[110px_1fr]">
      <legend className="s3-label float-left text-muted md:pt-1.5">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = filters[facet] === o;
          return (
            <button key={o} type="button" aria-pressed={on} onClick={() => set(facet, on ? null : o)}
              className="rounded-full border border-line px-2.5 py-1 text-xs transition-colors duration-150 hover:border-line-strong aria-pressed:border-line-strong aria-pressed:bg-ink aria-pressed:text-bg">
              {render ? render(o) : o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function EffectCatalog({ metas, initialSpecialty = null }: { metas: readonly EffectMeta[]; initialSpecialty?: string | null }) {
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>({ ...EMPTY, specialty: initialSpecialty });
  const [showFilters, setShowFilters] = useState(true);
  const set = (f: Facet, v: string | null) => setFilters((s) => ({ ...s, [f]: v }));
  const options = useMemo(() => ({
    category: [...new Set(metas.map((m) => m.category))],
    technology: [...new Set(metas.flatMap((m) => m.technology))],
    interaction: [...new Set(metas.flatMap((m) => m.interaction))],
  }), [metas]);
  const results = useMemo(() => metas.filter((m) => matches(m, filters, q)), [metas, filters, q]);
  const activeCount = Object.values(filters).filter(Boolean).length + (q ? 1 : 0);

  return (
    <div>
      <div className="sticky top-14 z-30 -mx-4 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[220px] flex-1">
            <span className="s3-sr-only">Search effects</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recipes — “scroll”, “button”, “shader”…" data-effect-search=""
              className="h-11 w-full rounded-full border border-line bg-surface px-4 text-sm placeholder:text-muted focus-visible:border-line-strong" />
          </label>
          <button type="button" aria-expanded={showFilters} aria-controls="effect-filters" onClick={() => setShowFilters((s) => !s)} className="s3-label h-11 rounded-full border border-line px-4 transition-colors duration-150 hover:border-line-strong">Filters{activeCount ? ` (${activeCount})` : ''}</button>
          <p className="s3-label text-muted" role="status" aria-live="polite" data-result-count={results.length}>{results.length} of {metas.length} recipes</p>
          {activeCount ? <button type="button" className="s3-label underline underline-offset-4" onClick={() => { setFilters(EMPTY); setQ(''); }}>Clear all</button> : null}
        </div>
        <div id="effect-filters" hidden={!showFilters} className="mt-3 grid max-h-[46vh] gap-3 overflow-y-auto pb-1">
          <FacetRow label="Specialty" facet="specialty" options={SPECIALTIES.map((s) => s.id)} filters={filters} set={set} render={(v) => SPECIALTIES.find((s) => s.id === v)?.name ?? v} />
          <FacetRow label="Category" facet="category" options={options.category} filters={filters} set={set} />
          <FacetRow label="Technology" facet="technology" options={options.technology} filters={filters} set={set} render={(v) => TECH_LABEL[v] ?? v} />
          <FacetRow label="Interaction" facet="interaction" options={options.interaction} filters={filters} set={set} />
          <FacetRow label="Complexity" facet="complexity" options={['1', '2', '3']} filters={filters} set={set} render={(v) => COMPLEXITY[v as '1']} />
          <FacetRow label="Intensity" facet="intensity" options={['subtle', 'moderate', 'bold']} filters={filters} set={set} />
        </div>
      </div>

      {results.length ? (
        <ul className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2 xl:grid-cols-3" data-effect-grid="">
          {results.map((m) => (
            <li key={m.id} className="group relative bg-surface" data-effect-card={m.id}>
              <CardPreview meta={m} />
              <div className="grid gap-2 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-xl font-semibold tracking-tight">
                    <Link href={`/effects/${m.id}`} className="after:absolute after:inset-0 group-hover:underline group-hover:decoration-signal group-hover:underline-offset-4">{m.name}</Link>
                  </h3>
                  <span className="s3-label shrink-0 text-muted">{m.category}</span>
                </div>
                <p className="line-clamp-2 text-sm text-muted">{m.description}</p>
                <p className="s3-label flex flex-wrap gap-x-3 gap-y-1 pt-1 text-muted">
                  <span>{m.technology.map((t) => TECH_LABEL[t] ?? t).join(' + ')}</span>
                  <span>{COMPLEXITY[String(m.complexity) as '1']}</span>
                  <span>{m.intensity}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10 border border-dashed border-line p-10 text-center">
          <p className="font-display text-2xl font-semibold">No recipe matches.</p>
          <p className="mt-2 text-sm text-muted">Loosen a filter or clear the search.</p>
        </div>
      )}
    </div>
  );
}
