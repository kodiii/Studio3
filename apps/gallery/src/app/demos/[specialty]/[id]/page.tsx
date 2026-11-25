import { demoMetas, getDemoMeta } from '@maquettekit/library/meta';
import { notFound } from 'next/navigation';
import { DemoFrame } from '@/components/DemoFrame';
import { pageMeta } from '@/lib/site';

export const dynamicParams = false;
export function generateStaticParams() {
  // A placeholder keeps static generation valid while the demo collection is empty.
  const list = demoMetas.map((m) => ({ specialty: m.specialty, id: m.id }));
  return list.length ? list : [{ specialty: 'none', id: 'none' }];
}
export async function generateMetadata({ params }: { params: Promise<{ specialty: string; id: string }> }) {
  const { specialty, id } = await params;
  const m = getDemoMeta(specialty, id);
  return pageMeta({ title: m?.name ?? 'Demo', description: m?.summary, path: `/demos/${specialty}/${id}` });
}

export default async function DemoPage({ params }: { params: Promise<{ specialty: string; id: string }> }) {
  const { specialty, id } = await params;
  const meta = getDemoMeta(specialty, id);
  if (!meta) notFound();
  return <DemoFrame meta={meta} />;
}
