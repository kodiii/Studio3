import { demos, effects } from '@maquettekit/library/registry';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DemoList } from '@/components/DemoList';
import { EffectCatalog } from '@/components/EffectCatalog';
import { Shell } from '@/components/SiteHeader';
import { SPECIALTIES, specialtyIndex, pageMeta } from '@/lib/site';

export const dynamicParams = false;
export function generateStaticParams() { return SPECIALTIES.map((s) => ({ specialty: s.id })); }
export async function generateMetadata({ params }: { params: Promise<{ specialty: string }> }) {
  const { specialty } = await params;
  const s = SPECIALTIES.find((x) => x.id === specialty);
  return pageMeta({ title: s?.name ?? 'Studio', description: s ? `${s.name}: ${s.philosophy} The skill, playbook and reference demos for this Maquettekit specialty.` : undefined, path: `/studios/${specialty}` });
}

export default async function StudioPage({ params }: { params: Promise<{ specialty: string }> }) {
  const { specialty } = await params;
  const s = SPECIALTIES.find((x) => x.id === specialty);
  if (!s) notFound();
  const list = demos.filter((d) => d.meta.specialty === s.id).map((d) => d.meta);
  const metas = effects.map((e) => e.meta).filter((m) => m.specialties.includes(s.id));
  return (
    <Shell>
      <div data-specialty={s.id} className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <header className="grid gap-6 border-b border-line-strong py-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="mk-label text-accent">Specialty {specialtyIndex(s.id)} / 05</p>
            <h1 className="mk-display mt-3 text-[clamp(2.75rem,9vw,7.5rem)]">{s.name}</h1>
            <p className="font-serif mt-3 text-[clamp(1.5rem,3vw,2.5rem)] italic leading-tight text-muted">{s.philosophy}</p>
          </div>
          <div className="mk-label grid gap-2 text-muted">
            <p>Claude Code <code className="ml-2 font-mono normal-case tracking-normal text-ink">/maquettekit:{s.skill}</code></p>
            <p>Codex <code className="ml-2 font-mono normal-case tracking-normal text-ink">$maquettekit:{s.skill}</code></p>
            {s.id === '3d' ? <Link href="/3d" className="text-ink underline underline-offset-4">Open the 3D model gallery →</Link> : null}
          </div>
        </header>
        <section aria-labelledby="demos-h" className="py-10">
          <h2 id="demos-h" className="mk-label mb-4 text-muted">Demonstrations — {list.length}</h2>
          <DemoList demos={list} />
        </section>
        <section aria-labelledby="recipes-h" className="pb-10">
          <h2 id="recipes-h" className="mk-label mb-2 text-muted">Recipes used by this studio — {metas.length}</h2>
          <EffectCatalog metas={metas} />
        </section>
      </div>
    </Shell>
  );
}
