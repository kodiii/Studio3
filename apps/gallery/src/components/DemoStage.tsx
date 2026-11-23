'use client';
import { demos } from '@studio3/library/registry';
import type { DemoComponent } from '@studio3/library/types';
import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';

const cache = new Map<string, React.LazyExoticComponent<DemoComponent>>();

class DemoBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
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
  const entry = demos.find((d) => d.meta.specialty === specialty && d.meta.id === id);
  if (!entry) return <p role="alert">Unknown demo “{key}”.</p>;
  let Demo = cache.get(key);
  if (!Demo) { Demo = lazy(entry.load); cache.set(key, Demo); }
  return (
    <div data-demo-stage={key} data-specialty={specialty} className="relative min-h-[100dvh] w-full" style={{ containerType: 'inline-size' }}>
      {mounted ? (
        <DemoBoundary>
          <Suspense fallback={<p className="s3-label p-6 text-muted" aria-live="polite">Loading demo…</p>}>
            <Demo />
          </Suspense>
        </DemoBoundary>
      ) : <p className="s3-label p-6 text-muted" aria-live="polite">Loading demo…</p>}
    </div>
  );
}
