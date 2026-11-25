import { demos, effects } from '@maquettekit/library/registry';
import Link from 'next/link';
import { Shell } from '@/components/SiteHeader';
import { SPECIALTIES, pageMeta } from '@/lib/site';

export const metadata = pageMeta({ title: 'Studios', description: 'Product, Cinematic, Data, Social and 3D: five design specialties, each with its own skill, playbook and reference demos.', path: '/studios' });

export default function StudiosPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <header className="border-b border-line-strong py-10">
          <p className="mk-label text-muted">Five specialties · one shared engine</p>
          <h1 className="mk-display mt-3 text-[clamp(2.75rem,8vw,6.5rem)]">The studios</h1>
        </header>
        <ol>
          {SPECIALTIES.map((s, i) => {
            const d = demos.filter((x) => x.meta.specialty === s.id).length;
            const e = effects.filter((x) => x.meta.specialties.includes(s.id)).length;
            return (
              <li key={s.id} data-specialty={s.id} className="group relative grid gap-4 border-b border-line py-10 md:grid-cols-[96px_1fr_auto] md:items-end">
                <span className="font-mono text-sm text-accent">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h2 className="mk-display text-[clamp(2.25rem,6vw,5rem)]"><Link href={`/studios/${s.id}`} className="after:absolute after:inset-0 group-hover:text-accent">{s.name}</Link></h2>
                  <p className="font-serif mt-2 text-2xl italic text-muted">{s.philosophy}</p>
                </div>
                <p className="mk-label text-muted">{d} demos · {e} recipes · <code className="font-mono normal-case tracking-normal">/maquettekit:{s.skill}</code></p>
              </li>
            );
          })}
        </ol>
      </div>
    </Shell>
  );
}
