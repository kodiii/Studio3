import type { DemoMeta } from '@maquettekit/library/types';
import Link from 'next/link';
import { TECH_LABEL } from '@/lib/site';

export function DemoList({ demos }: { demos: readonly DemoMeta[] }) {
  if (!demos.length) return <p className="border border-dashed border-line p-6 text-sm text-muted">No demos registered for this specialty yet.</p>;
  return (
    <ol className="border-t border-line-strong" data-demo-list="">
      {demos.map((d, i) => (
        <li key={`${d.specialty}/${d.id}`} className="group relative grid gap-3 border-b border-line py-6 transition-colors duration-200 hover:bg-surface md:grid-cols-[72px_minmax(0,1.1fr)_minmax(0,1fr)_auto] md:items-baseline md:gap-6 md:px-3">
          <span className="mk-label text-muted">{String(i + 1).padStart(2, '0')}</span>
          <h3 className="font-display text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-none tracking-tight">
            <Link href={`/demos/${d.specialty}/${d.id}`} className="after:absolute after:inset-0">{d.name}</Link>
          </h3>
          <p className="text-sm leading-relaxed text-muted">{d.summary}</p>
          <p className="mk-label flex flex-wrap gap-x-3 gap-y-1 text-muted md:justify-end">
            {d.has3d ? <span className="text-accent">Real-time 3D</span> : null}
            <span>{d.technology.slice(0, 3).map((t) => TECH_LABEL[t] ?? t).join(' · ')}</span>
            <span aria-hidden="true" className="transition-transform duration-200 ease-emphasized group-hover:translate-x-1">→</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
