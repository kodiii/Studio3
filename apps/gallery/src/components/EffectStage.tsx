'use client';
import { effects } from '@studio3/library/registry';
import { resolveParams, type EffectComponent, type ParamValues } from '@studio3/library/types';
import { Component, Suspense, lazy, useMemo, type ReactNode } from 'react';

const cache = new Map<string, React.LazyExoticComponent<EffectComponent>>();
function lazyEffect(id: string) {
  let c = cache.get(id);
  if (!c) {
    const entry = effects.find((e) => e.meta.id === id);
    if (!entry) return null;
    c = lazy(entry.load);
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

/** Mounts one effect recipe by id with resolved params. `replayKey` remounts it (exercising cleanup). */
export function EffectStage({ id, overrides, replayKey = 0 }: { id: string; overrides?: ParamValues; replayKey?: number }) {
  const entry = effects.find((e) => e.meta.id === id);
  const Effect = lazyEffect(id);
  const params = useMemo(() => (entry ? resolveParams(entry.meta.params, overrides) : {}), [entry, overrides]);
  if (!entry || !Effect) return <p role="alert">Unknown effect “{id}”.</p>;
  const stage = entry.meta.preview?.stage ?? 'surface';
  return (
    <div
      data-effect-stage={id}
      data-stage={stage === 'ink' ? 'ink' : undefined}
      className="relative grid h-full w-full place-items-center overflow-hidden"
      style={{ containerType: 'inline-size', minHeight: entry.meta.preview?.height ?? 360, background: stage === 'none' ? 'transparent' : 'var(--s3-surface)', color: 'var(--s3-ink)' }}
    >
      <StageBoundary key={replayKey}>
        <Suspense fallback={<span className="s3-label text-muted" aria-live="polite">Loading preview…</span>}>
          <Effect key={replayKey} params={params} />
        </Suspense>
      </StageBoundary>
    </div>
  );
}
