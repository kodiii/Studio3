'use client';
import { demosFor } from '@studio3/library/registry';
import Link from 'next/link';
import { ModelViewer } from './ModelViewer';
import './three-gallery.css';

export function ThreeGallery() {
  const demos = demosFor('3d');
  return (
    <div data-specialty="3d" className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-[1320px] px-4 pb-24 sm:px-8">
        <section className="grid gap-6 border-b border-line pb-10 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end lg:gap-8">
          <div>
            <p className="s3-label mb-5 flex items-center gap-2 text-accent"><span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent" />05 — Make digital experiences feel tangible</p>
            <h1 className="s3-display text-[clamp(2.6rem,8vw,6.5rem)]">Objects you can<br />turn over <span className="font-serif font-normal italic tracking-[-0.02em]">in your hands.</span></h1>
          </div>
          <p className="max-w-[44ch] text-[15px] leading-relaxed text-muted">
            One viewer, two original sample assets, and every number on the page read from the file or the renderer. Orbit the model, change its finish and
            light, scrub its clips, switch builds — or turn 3D off and see what ships instead.
          </p>
        </section>

        <section aria-labelledby="viewer-heading" className="pt-8">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 id="viewer-heading" className="font-display text-2xl font-bold tracking-[-0.02em]">Model viewer</h2>
            <span className="s3-label text-muted">GLB · meshopt · render on demand</span>
          </div>
          <ModelViewer />
        </section>

        <section aria-labelledby="demos-heading" className="mt-20 border-t border-line-strong pt-6">
          <div className="mb-8 flex items-baseline justify-between gap-4">
            <h2 id="demos-heading" className="font-display text-2xl font-bold tracking-[-0.02em]">Five demos</h2>
            <span className="s3-label text-muted">{String(demos.length).padStart(2, '0')} scenes · live source</span>
          </div>
          <ol className="m-0 grid list-none gap-px border border-line bg-line p-0 sm:grid-cols-2 lg:grid-cols-3">
            {demos.map((d, i) => (
              <li key={d.meta.id} className="bg-bg">
                <Link href={`/demos/3d/${d.meta.id}`} className="group flex h-full min-h-48 flex-col gap-3 p-5 transition-colors duration-150 hover:bg-surface">
                  <span className="s3-label flex justify-between text-muted"><span>{String(i + 1).padStart(2, '0')}</span><span>{d.meta.technology.slice(0, 3).join(' · ')}</span></span>
                  <span className="font-display text-[1.6rem] font-bold leading-[1.02] tracking-[-0.03em]">{d.meta.name}</span>
                  <span className="text-[14px] leading-snug text-muted">{d.meta.summary}</span>
                  <span className="s3-label mt-auto text-accent">Open demo <span aria-hidden="true" className="inline-block transition-transform duration-150 group-hover:translate-x-1">→</span></span>
                </Link>
              </li>
            ))}
            <li className="flex min-h-48 flex-col justify-between gap-3 bg-surface-2 p-5">
              <span className="s3-label text-muted">Kit</span>
              <p className="m-0 text-[14px] leading-snug text-muted">All five are built from the same parts as this viewer: <code className="font-mono text-[12px] text-ink">StudioCanvas</code>, <code className="font-mono text-[12px] text-ink">Model</code>, <code className="font-mono text-[12px] text-ink">CameraRig</code>, <code className="font-mono text-[12px] text-ink">OrbitInspect</code>, <code className="font-mono text-[12px] text-ink">PartController</code>, <code className="font-mono text-[12px] text-ink">LightingRig</code>, <code className="font-mono text-[12px] text-ink">AnimationPlayer</code> and <code className="font-mono text-[12px] text-ink">Hotspots</code>.</p>
            </li>
          </ol>
        </section>

        <section aria-labelledby="honesty-heading" className="mt-20 grid gap-8 border-t border-line pt-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <h2 id="honesty-heading" className="font-display text-2xl font-bold tracking-[-0.02em]">Performance honesty</h2>
          <div className="grid gap-6 text-[14px] leading-relaxed sm:grid-cols-3">
            <div>
              <h3 className="s3-label mb-2 text-ink">Measured</h3>
              <p className="m-0 text-muted">Triangles, vertices, meshes, materials and clips are counted from the loaded geometry. File size is the number of bytes received. Draw calls, per-frame triangles and memory counts come from <code className="font-mono text-[12px]">renderer.info</code> on this device, for the last frame drawn.</p>
            </div>
            <div>
              <h3 className="s3-label mb-2 text-ink">Estimated</h3>
              <p className="m-0 text-muted">Texture memory assumes uncompressed RGBA with a mip chain; real drivers differ. Manifest figures are what the asset pipeline recorded at build time. Both are labelled as such wherever they appear.</p>
            </div>
            <div>
              <h3 className="s3-label mb-2 text-ink">Not claimed</h3>
              <p className="m-0 text-muted">No frame rate is shown. The viewer renders on demand, so an idle scene draws zero frames, and a frame rate from one machine says little about another. Budgets in the kit are starting points to verify on your target devices.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
