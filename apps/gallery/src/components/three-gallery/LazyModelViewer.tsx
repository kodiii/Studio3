'use client';
import dynamic from 'next/dynamic';

/**
 * The viewer pulls in three.js and React Three Fiber (about 1.2 MB of JavaScript before compression). Loading it
 * after the page has hydrated keeps it out of the first load: the text, navigation and demo links work at once, and
 * the viewer streams in behind a placeholder of the same size (so nothing below it moves on wide screens).
 */
export const LazyModelViewer = dynamic(() => import('./ModelViewer').then((m) => m.ModelViewer), {
  ssr: false,
  loading: () => (
    <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div
          data-viewer-placeholder=""
          className="mk-viewer-stage relative grid aspect-[4/5] max-h-[78dvh] w-full place-items-center overflow-hidden rounded-[10px] border border-line sm:aspect-[4/3]"
        >
          <span className="mk-label text-muted" aria-live="polite">Loading the 3D viewer…</span>
        </div>
      </div>
    </div>
  ),
});
