'use client';
import { demoLoaders } from '@maquettekit/library/demo-loaders';
import type { DemoComponent } from '@maquettekit/library/types';
import { Component, Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Revealed } from './Revealed';

const cache = new Map<string, React.LazyExoticComponent<DemoComponent>>();

class DemoBoundary extends Component<{ children: ReactNode; onError?: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch() { this.props.onError?.(); }
  render() {
    if (this.state.error) return <p role="alert" data-demo-error="" className="p-6 font-mono text-sm text-danger">Demo failed: {this.state.error.message}</p>;
    return this.props.children;
  }
}

export function DemoStage({ specialty, id }: { specialty: string; id: string }) {
  // Client-only mount (see EffectStage): the server renders a stable shell, so cached HTML never goes stale.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const key = `${specialty}/${id}`;
  // aria-busy until the demo is on screen (or has failed)
  const [shown, setShown] = useState<string | null>(null);
  const reveal = useCallback(() => setShown(key), [key]);
  const load = demoLoaders[key];
  if (!load) return <p role="alert">Unknown demo “{key}”.</p>;
  let Demo = cache.get(key);
  if (!Demo) { Demo = lazy(load); cache.set(key, Demo); }
  return (
    <div data-demo-stage={key} data-specialty={specialty} aria-busy={shown === key ? undefined : true} className="relative min-h-[100dvh] w-full" style={{ containerType: 'inline-size' }}>
      {mounted ? (
        <DemoBoundary onError={reveal}>
          <Suspense fallback={<p className="mk-label p-6 text-muted" aria-live="polite">Loading demo…</p>}>
            <Demo />
            <Revealed onReveal={reveal} />
          </Suspense>
        </DemoBoundary>
      ) : <p className="mk-label p-6 text-muted" aria-live="polite">Loading demo…</p>}
    </div>
  );
}
