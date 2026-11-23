import { effects } from '@studio3/library/registry';
import { notFound } from 'next/navigation';
import { EffectStage } from '@/components/EffectStage';

export const dynamicParams = false;
export function generateStaticParams() { return effects.map((e) => ({ id: e.meta.id })); }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: effects.find((e) => e.meta.id === id)?.meta.name ?? 'Effect' };
}

export default async function EffectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = effects.find((e) => e.meta.id === id);
  if (!entry) notFound();
  return (
    <main className="mx-auto max-w-5xl p-6">
      <p className="s3-label text-muted">{entry.meta.category}</p>
      <h1 className="s3-display mt-2 text-4xl">{entry.meta.name}</h1>
      <p className="mt-3 max-w-prose text-muted">{entry.meta.description}</p>
      <div className="mt-6 overflow-hidden rounded-[var(--s3-radius-m)] border border-line"><EffectStage id={id} /></div>
    </main>
  );
}
