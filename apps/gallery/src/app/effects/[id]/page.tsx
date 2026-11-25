import { effectMetas, getEffectMeta } from '@maquettekit/library/meta';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EffectPlayground } from '@/components/EffectPlayground';
import { Shell } from '@/components/SiteHeader';
import { SPECIALTIES, pageMeta } from '@/lib/site';

export const dynamicParams = false;
export function generateStaticParams() { return effectMetas.map((m) => ({ id: m.id })); }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getEffectMeta(id);
  return pageMeta({ title: m?.name ?? 'Effect', description: m?.description, path: `/effects/${id}` });
}

export default async function EffectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idx = effectMetas.findIndex((m) => m.id === id);
  if (idx === -1) notFound();
  const meta = effectMetas[idx];
  const prev = effectMetas[(idx + effectMetas.length - 1) % effectMetas.length];
  const next = effectMetas[(idx + 1) % effectMetas.length];
  return (
    <Shell>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <nav aria-label="Breadcrumb" className="mk-label flex gap-2 pt-6 text-muted">
          <Link href="/effects" className="hover:text-ink">Effects</Link><span aria-hidden="true">/</span><span>{meta.category}</span>
        </nav>
        <header className="grid gap-6 border-b border-line pb-8 pt-4 lg:grid-cols-[1fr_300px] lg:items-end">
          <div>
            <h1 className="mk-display text-[clamp(2.25rem,6vw,4.75rem)]">{meta.name}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{meta.description}</p>
          </div>
          <dl className="mk-label grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-muted">
            <dt>ID</dt><dd className="text-ink normal-case tracking-normal"><code className="font-mono text-xs">{meta.id}</code></dd>
            <dt>Complexity</dt><dd className="text-ink">{['Drop-in', 'Integrate', 'Advanced'][meta.complexity - 1]}</dd>
            <dt>Intensity</dt><dd className="text-ink">{meta.intensity}</dd>
            <dt>Interaction</dt><dd className="text-ink">{meta.interaction.join(', ')}</dd>
            <dt>Studios</dt><dd className="text-ink">{meta.specialties.map((s) => SPECIALTIES.find((x) => x.id === s)?.name.replace(' Studio', '')).join(', ')}</dd>
          </dl>
        </header>
        <div className="py-8"><EffectPlayground meta={meta} /></div>
        <nav aria-label="More recipes" className="grid grid-cols-2 border-t border-line">
          <Link href={`/effects/${prev.id}`} className="group border-r border-line py-6 pr-4"><span className="mk-label text-muted">Previous</span><span className="font-display mt-1 block text-xl font-semibold group-hover:underline">{prev.name}</span></Link>
          <Link href={`/effects/${next.id}`} className="group py-6 pl-4 text-right"><span className="mk-label text-muted">Next</span><span className="font-display mt-1 block text-xl font-semibold group-hover:underline">{next.name}</span></Link>
        </nav>
      </div>
    </Shell>
  );
}
