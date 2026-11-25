'use client';
import { effectLoaders } from '@maquettekit/library/effect-loaders';
import { resolveParams, type EffectComponent, type ParamValues } from '@maquettekit/library/types';
import { Component, Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { StageMeta } from '@/lib/site';

// Loaders only — the metadata comes in as a prop, so this bundle never carries the whole catalogue's metadata.
const cache = new Map<string, React.LazyExoticComponent<EffectComponent>>();
function lazyEffect(id: string) {
  let c = cache.get(id);
  if (!c) {
    const load = effectLoaders[id];
    if (!load) return null;
    c = lazy(load);
    cache.set(id, c);
  }
  return c;
}

class StageBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return <p role="alert" data-effect-error="" className="p-6 font-mono text-sm text-danger">Preview failed: {this.state.error.message}</p>;
    return this.props.children;
  }
}

/** Mounts one effect recipe with resolved params. `replayKey` remounts it (exercising cleanup). */
export function EffectStage({ meta, overrides, replayKey = 0 }: { meta: StageMeta; overrides?: ParamValues; replayKey?: number }) {
  // Recipes mount in the browser only: previews are interactive, and server HTML cached by the dev server can
  // otherwise go stale when a recipe changes (hydration mismatch). The server renders the stable stage shell.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const Effect = lazyEffect(meta.id);
  const params = useMemo(() => resolveParams(meta.params, overrides), [meta.params, overrides]);
  if (!Effect) return <p role="alert">Unknown effect “{meta.id}”.</p>;
  const stage = meta.preview?.stage ?? 'surface';
  return (
    <div
      data-effect-stage={meta.id}
      data-stage={stage === 'ink' ? 'ink' : undefined}
      className="relative grid h-full w-full place-items-center overflow-hidden"
      style={{ containerType: 'inline-size', minHeight: meta.preview?.height ?? 360, background: stage === 'none' ? 'transparent' : 'var(--mk-surface)', color: 'var(--mk-ink)' }}
    >
      {mounted ? (
        <StageBoundary key={replayKey}>
          <Suspense fallback={<span className="mk-label text-muted" aria-live="polite">Loading preview…</span>}>
            <Effect key={replayKey} params={params} />
          </Suspense>
        </StageBoundary>
      ) : <span className="mk-label text-muted" aria-live="polite">Loading preview…</span>}
    </div>
  );
}
