import { demos } from '@studio3/library/registry';
import { notFound } from 'next/navigation';
import { DemoStage } from '@/components/DemoStage';

export const dynamicParams = false;
export function generateStaticParams() {
  // A placeholder keeps static generation valid while the demo collection is empty.
  const list = demos.map((d) => ({ specialty: d.meta.specialty, id: d.meta.id }));
  return list.length ? list : [{ specialty: 'none', id: 'none' }];
}
export async function generateMetadata({ params }: { params: Promise<{ specialty: string; id: string }> }) {
  const { specialty, id } = await params;
  return { title: demos.find((d) => d.meta.specialty === specialty && d.meta.id === id)?.meta.name ?? 'Demo' };
}

export default async function DemoPage({ params }: { params: Promise<{ specialty: string; id: string }> }) {
  const { specialty, id } = await params;
  if (!demos.some((d) => d.meta.specialty === specialty && d.meta.id === id)) notFound();
  return <DemoStage specialty={specialty} id={id} />;
}
