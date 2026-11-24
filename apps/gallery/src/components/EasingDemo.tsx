'use client';
import { useReducedMotion } from '@maquettekit/library/motion';
import { useRef } from 'react';

interface Curve { name: string; css: string; ms: number; note?: string }

export function EasingDemo({ easings, springs }: { easings: Curve[]; springs: Curve[] }) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const play = () => {
    root.current?.querySelectorAll<HTMLElement>('[data-dot]').forEach((dot) => {
      const track = dot.parentElement!;
      const dist = track.clientWidth - dot.offsetWidth;
      dot.getAnimations().forEach((a) => a.cancel());
      dot.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dist}px)` }], {
        duration: reduced ? 1 : Number(dot.dataset.ms), easing: reduced ? 'linear' : dot.dataset.ease!, fill: 'forwards',
      });
    });
  };
  const Row = ({ c }: { c: Curve }) => (
    <li className="grid grid-cols-[96px_1fr_auto] items-center gap-3 border-b border-line py-2">
      <span className="font-mono text-xs">{c.name}</span>
      <span className="relative block h-4 border-x border-line"><span data-dot="" data-ease={c.css} data-ms={c.ms} className="absolute left-0 top-0 block h-4 w-4 rounded-full bg-signal" /></span>
      <span className="font-mono text-[11px] tabular-nums text-muted">{c.note ?? `${c.ms}ms`}</span>
    </li>
  );
  return (
    <div ref={root}>
      <button type="button" onClick={play} className="mk-label mb-3 rounded-full bg-ink px-4 py-2 text-bg">Play all</button>
      {reduced ? <p className="mb-2 text-xs text-muted">Reduced motion is on: dots jump to their end state.</p> : null}
      <ul>{easings.map((c) => <Row key={c.name} c={c} />)}</ul>
      <p className="mk-label mb-1 mt-6 text-muted">Springs (sampled to CSS linear())</p>
      <ul>{springs.map((c) => <Row key={c.name} c={c} />)}</ul>
    </div>
  );
}
