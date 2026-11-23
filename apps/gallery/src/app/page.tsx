import { demos, effects } from '@studio3/library/registry';
import Link from 'next/link';
import { EffectStage } from '@/components/EffectStage';
import { Shell } from '@/components/SiteHeader';
import { MODULES, SPECIALTIES } from '@/lib/site';

const pick = (ids: string[]): string | null => ids.find((id) => effects.some((e) => e.meta.id === id)) ?? effects[0]?.meta.id ?? null;

export default function Home() {
  const featured = pick(['variable-weight-wave', 'split-line-reveal']);
  const trio = ['line-chart-morph', 'tilt-parallax-card', 'reaction-burst', 'svg-path-draw', 'magnetic-button', 'flip-grid-reorder']
    .filter((id) => effects.some((e) => e.meta.id === id)).slice(0, 3);
  const categories = new Set(effects.map((e) => e.meta.category)).size;
  const stats: [string, string][] = [
    [String(SPECIALTIES.length).padStart(2, '0'), 'design specialties'],
    [String(effects.length), 'effect recipes'],
    [String(demos.length), 'working demos'],
    ['12', 'agent skills'],
  ];
  return (
    <Shell>
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="grid gap-8 border-b border-line-strong pb-10 pt-10 lg:grid-cols-12 lg:pt-16">
          <div className="lg:col-span-8">
            <p className="s3-label text-muted">A design engineering plugin for Claude Code &amp; Codex — v4.0</p>
            <h1 className="s3-display mt-5 text-[clamp(4.5rem,17vw,15rem)] leading-[0.82]">
              Studio<sup className="text-[0.42em] text-signal" style={{ verticalAlign: '0.95em' }}>3</sup>
            </h1>
          </div>
          <div className="flex flex-col justify-end gap-6 lg:col-span-4">
            <p className="font-serif text-[clamp(1.6rem,2.6vw,2.4rem)] italic leading-[1.1]">Design intelligence. Motion engineering. Digital experiences.</p>
            <p className="max-w-md text-sm leading-relaxed text-muted">Five specialties share one motion engine, one browser-based reviewer and one component library. This gallery runs that library’s actual source: change a parameter, shrink the viewport, turn motion off, read the code.</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/effects" className="s3-label rounded-full bg-ink px-5 py-3 text-bg transition-transform duration-200 ease-emphasized hover:-translate-y-0.5">Browse {effects.length} recipes</Link>
              <Link href="/studios" className="s3-label rounded-full border border-line-strong px-5 py-3 transition-transform duration-200 ease-emphasized hover:-translate-y-0.5">Enter the studios</Link>
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 border-b border-line md:grid-cols-4">
          {stats.map(([n, l], i) => (
            <div key={l} className={`py-5 ${i ? 'md:border-l md:border-line md:pl-6' : ''} ${i % 2 ? 'border-l border-line pl-4 md:pl-6' : ''}`}>
              <dd className="font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-none tracking-tighter tabular-nums">{n}</dd>
              <dt className="s3-label mt-2 text-muted">{l}</dt>
            </div>
          ))}
        </dl>
      </section>

      {featured ? (
        <section aria-labelledby="live-h" className="mx-auto max-w-[1400px] px-4 pt-10 sm:px-6">
          <div className="flex items-baseline justify-between gap-4 pb-3">
            <h2 id="live-h" className="s3-label text-muted">Running now — <code className="font-mono normal-case tracking-normal">{featured}</code></h2>
            <Link href={`/effects/${featured}`} className="s3-label underline underline-offset-4">Open in playground →</Link>
          </div>
          <div className="overflow-hidden border border-line"><EffectStage id={featured} /></div>
        </section>
      ) : null}

      <section aria-labelledby="studios-h" className="mx-auto max-w-[1400px] px-4 pt-20 sm:px-6">
        <div className="flex items-end justify-between gap-6 border-b border-line-strong pb-4">
          <h2 id="studios-h" className="s3-display text-[clamp(2rem,5vw,3.75rem)]">Five studios</h2>
          <p className="s3-label hidden text-muted sm:block">Independently usable · cross-invoking</p>
        </div>
        <ol>
          {SPECIALTIES.map((s, i) => (
            <li key={s.id} data-specialty={s.id} className="group relative grid items-baseline gap-2 border-b border-line py-6 transition-[padding] duration-300 ease-emphasized hover:pl-3 md:grid-cols-[64px_minmax(0,1fr)_minmax(0,1fr)_auto] md:gap-6">
              <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="font-display text-[clamp(1.75rem,4vw,3rem)] font-bold leading-none tracking-tight"><Link href={`/studios/${s.id}`} className="after:absolute after:inset-0">{s.name}</Link></h3>
              <p className="font-serif text-xl italic text-muted">{s.philosophy}</p>
              <p className="s3-label text-muted">{demos.filter((d) => d.meta.specialty === s.id).length} demos <span aria-hidden="true" className="ml-2 inline-block transition-transform duration-300 ease-emphasized group-hover:translate-x-1">→</span></p>
            </li>
          ))}
        </ol>
      </section>

      {trio.length ? (
        <section aria-labelledby="sample-h" className="mx-auto max-w-[1400px] px-4 pt-20 sm:px-6">
          <div className="flex items-end justify-between gap-6 border-b border-line-strong pb-4">
            <h2 id="sample-h" className="s3-display text-[clamp(2rem,5vw,3.75rem)]">From the Motion Lab</h2>
            <Link href="/effects" className="s3-label underline underline-offset-4">{effects.length} recipes in {categories} categories →</Link>
          </div>
          <ul className="grid gap-px border-x border-b border-line bg-line md:grid-cols-3">
            {trio.map((id) => {
              const m = effects.find((e) => e.meta.id === id)!.meta;
              return (
                <li key={id} className="bg-surface">
                  <div className="border-b border-line [&>div]:!min-h-[280px]"><EffectStage id={id} /></div>
                  <div className="flex items-baseline justify-between gap-3 p-4">
                    <Link href={`/effects/${id}`} className="font-display text-lg font-semibold tracking-tight underline-offset-4 hover:underline">{m.name}</Link>
                    <span className="s3-label text-muted">{m.category}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="modules-h" className="mx-auto max-w-[1400px] px-4 pt-20 sm:px-6">
        <div className="border-b border-line-strong pb-4"><h2 id="modules-h" className="s3-display text-[clamp(2rem,5vw,3.75rem)]">Shared intelligence</h2></div>
        <ul className="grid md:grid-cols-2 lg:grid-cols-5">
          {MODULES.map((m, i) => (
            <li key={m.id} className={`border-b border-line py-6 lg:border-b-0 lg:px-5 ${i ? 'lg:border-l lg:border-line' : 'lg:pl-0'}`}>
              <p className="s3-label text-muted">{String.fromCharCode(65 + i)}</p>
              <h3 className="font-display mt-2 text-xl font-semibold tracking-tight">{m.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{m.line}</p>
              <code className="mt-3 block font-mono text-xs">/studio3:{m.skill}</code>
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}
