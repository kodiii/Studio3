import { effects } from '@maquettekit/library/registry';
import { EffectCatalog } from '@/components/EffectCatalog';
import { Shell } from '@/components/SiteHeader';

export const metadata = { title: 'Effects' };

export default function EffectsPage() {
  const metas = effects.map((e) => e.meta);
  return (
    <Shell>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <header className="grid gap-4 border-b border-line py-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="mk-label text-muted">Motion Lab · Component &amp; Effect Library</p>
            <h1 className="mk-display mt-3 text-[clamp(2.75rem,8vw,6.5rem)]">{metas.length} recipes,<br /><span className="font-serif font-normal italic tracking-normal">all of them running.</span></h1>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted">Every card mounts the real component from the plugin’s library. Open one to change its parameters, preview it at device widths, toggle reduced motion and copy the source.</p>
        </header>
        <EffectCatalog metas={metas} />
      </div>
    </Shell>
  );
}
