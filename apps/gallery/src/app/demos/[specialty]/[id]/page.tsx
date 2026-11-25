import { demos } from '@maquettekit/library/registry';
import { notFound } from 'next/navigation';
import { DemoFrame } from '@/components/DemoFrame';
import { pageMeta } from '@/lib/site';

export const dynamicParams = false;
export function generateStaticParams() {
  // A placeholder keeps static generation valid while the demo collection is empty.
  const list = demos.map((d) => ({ specialty: d.meta.specialty, id: d.meta.id }));
  return list.length ? list : [{ specialty: 'none', id: 'none' }];
}
export async function generateMetadata({ params }: { params: Promise<{ specialty: string; id: string }> }) {
  const { specialty, id } = await params;
  const m = demos.find((d) => d.meta.specialty === specialty && d.meta.id === id)?.meta;
  return pageMeta({ title: m?.name ?? 'Demo', description: m?.summary, path: `/demos/${specialty}/${id}` });
}

export default async function DemoPage({ params }: { params: Promise<{ specialty: string; id: string }> }) {
  const { specialty, id } = await params;
  const entry = demos.find((d) => d.meta.specialty === specialty && d.meta.id === id);
  if (!entry) notFound();
  return <DemoFrame meta={entry.meta} />;
}
