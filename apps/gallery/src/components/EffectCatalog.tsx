'use client';
import type { EffectMeta } from '@maquettekit/library/types';
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
        <div aria-hidden="true" className="absolute inset-0 grid place-items-center" style={{ backgroundImage: 'radial-gradient(var(--mk-line) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
          <span className="mk-label rounded-full bg-surface px-2.5 py-1 text-muted">{meta.category}</span>
        </div>
      )}
      {gl && !live ? <span className="mk-label absolute bottom-2 left-2 rounded-full bg-ink px-2 py-1 text-bg">WebGL · hover to run</span> : null}
    </div>
  );
}

function FacetRow({ label, facet, options, filters, set, render }: { label: string; facet: Facet; options: readonly string[]; filters: Filters; set: (f: Facet, v: string | null) => void; render?: (v: string) => string }) {
  return (
    <fieldset className="grid gap-2 border-t border-line pt-3 md:grid-cols-[110px_1fr]">
      <legend className="mk-label float-left text-muted md:pt-1.5">{label}</legend>
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
  // Collapsed by default: the previews are the content; filters are a tool you open when you need them.
  const [showFilters, setShowFilters] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const set = (f: Facet, v: string | null) => setFilters((s) => ({ ...s, [f]: v }));
  const options = useMemo(() => ({
    category: [...new Set(metas.map((m) => m.category))],
    technology: [...new Set(metas.flatMap((m) => m.technology))],
    interaction: [...new Set(metas.flatMap((m) => m.interaction))],
  }), [metas]);
  const results = useMemo(() => metas.filter((m) => matches(m, filters, q)), [metas, filters, q]);
  const activeCount = Object.values(filters).filter(Boolean).length + (q ? 1 : 0);
  // Facets that live in the panel (category has its own always-visible chip row).
  const panelFacets = (['specialty', 'technology', 'interaction', 'complexity', 'intensity'] as const).filter((f) => filters[f]);
  const chipLabel = (f: Facet, v: string) =>
    f === 'specialty' ? SPECIALTIES.find((x) => x.id === v)?.name ?? v
      : f === 'technology' ? TECH_LABEL[v] ?? v
        : f === 'complexity' ? COMPLEXITY[v as '1']
          : v;

  useEffect(() => {
    if (!showFilters) return;
    const el = panel.current;
    if (!el) return;
    // Opened from the sticky bar while scrolled down: bring the panel into view.
    const top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.reduced === 'true';
      el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [showFilters]);

  const close = () => { setShowFilters(false); toggle.current?.focus(); };

  return (
    <div>
      <div className="sticky top-14 z-30 -mx-4 border-b border-line bg-bg/95 px-4 py-2.5 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label className="relative min-w-[200px] flex-1">
            <span className="mk-sr-only">Search effects</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recipes — “scroll”, “button”, “shader”…" data-effect-search=""
              className="h-10 w-full rounded-full border border-line bg-surface px-4 text-sm placeholder:text-muted focus-visible:border-line-strong" />
          </label>
          <button ref={toggle} type="button" aria-expanded={showFilters} aria-controls="effect-filters" onClick={() => setShowFilters((s) => !s)} data-filters-toggle=""
            className="mk-label inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 transition-colors duration-150 hover:border-line-strong aria-expanded:border-line-strong aria-expanded:bg-ink aria-expanded:text-bg">
            Filters
            {panelFacets.length ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-signal px-1 text-on-signal">{panelFacets.length}</span> : null}
          </button>
          <p className="mk-label text-muted" role="status" aria-live="polite" data-result-count={results.length}>{results.length} of {metas.length}</p>
          {activeCount ? <button type="button" className="mk-label underline underline-offset-4 hover:text-signal" onClick={() => { setFilters(EMPTY); setQ(''); }}>Clear all</button> : null}
        </div>
        {/* Category: the most-used facet stays one tap away, as a single horizontally scrolling row. */}
        <div role="group" aria-label="Category" className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:-mx-6 sm:px-6">
          <button type="button" aria-pressed={!filters.category} onClick={() => set('category', null)}
            className="shrink-0 rounded-full border border-line px-3 py-1 text-xs transition-colors duration-150 hover:border-line-strong aria-pressed:border-line-strong aria-pressed:bg-ink aria-pressed:text-bg">All</button>
          {options.category.map((c) => (
            <button key={c} type="button" aria-pressed={filters.category === c} onClick={() => set('category', filters.category === c ? null : c)}
              className="shrink-0 rounded-full border border-line px-3 py-1 text-xs transition-colors duration-150 hover:border-line-strong aria-pressed:border-line-strong aria-pressed:bg-ink aria-pressed:text-bg">{c}</button>
          ))}
        </div>
        {panelFacets.length && !showFilters ? (
          <ul aria-label="Active filters" className="mt-2 flex flex-wrap gap-1.5">
            {panelFacets.map((f) => (
              <li key={f}>
                <button type="button" onClick={() => set(f, null)} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs hover:bg-line">
                  <span className="text-muted">{f}:</span> {chipLabel(f, filters[f]!)} <span aria-hidden="true">×</span><span className="mk-sr-only">remove filter</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* The panel is part of the page flow (not the sticky bar): it pushes the grid down and scrolls away, so it never covers the previews. */}
      <div id="effect-filters" ref={panel} hidden={!showFilters} className="scroll-mt-40 border-b border-line py-4"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
        <div className="grid gap-3">
          <FacetRow label="Specialty" facet="specialty" options={SPECIALTIES.map((x) => x.id)} filters={filters} set={set} render={(v) => SPECIALTIES.find((x) => x.id === v)?.name ?? v} />
          <FacetRow label="Technology" facet="technology" options={options.technology} filters={filters} set={set} render={(v) => TECH_LABEL[v] ?? v} />
          <FacetRow label="Interaction" facet="interaction" options={options.interaction} filters={filters} set={set} />
          <FacetRow label="Complexity" facet="complexity" options={['1', '2', '3']} filters={filters} set={set} render={(v) => COMPLEXITY[v as '1']} />
          <FacetRow label="Intensity" facet="intensity" options={['subtle', 'moderate', 'bold']} filters={filters} set={set} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="mk-label text-muted">{results.length} matching</p>
          <button type="button" onClick={close} className="mk-label rounded-full bg-ink px-5 py-2 text-bg hover:bg-signal hover:text-on-signal">Done</button>
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
                  <span className="mk-label shrink-0 text-muted">{m.category}</span>
                </div>
                <p className="line-clamp-2 text-sm text-muted">{m.description}</p>
                <p className="mk-label flex flex-wrap gap-x-3 gap-y-1 pt-1 text-muted">
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
