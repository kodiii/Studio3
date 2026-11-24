'use client';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createSequence, duration as D, useIsomorphicLayoutEffect, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { latency: number; stagger: number; rows: number; shimmer: string; speed: number };
type Phase = 'loading' | 'handoff' | 'ready';
type Art = 'sun' | 'stripes' | 'moon' | 'dots' | 'arch' | 'split';
interface Item { title: string; author: string; minutes: number; topic: string; art: Art }

/** Sample data: fictional articles and authors. */
const POOL: readonly Item[] = [
  { title: 'Why every kitchen ends up with exactly one junk drawer', author: 'Ines Okafor', minutes: 6, topic: 'Home', art: 'sun' },
  { title: 'A field guide to the clouds above a commuter train', author: 'Tomas Brekke', minutes: 9, topic: 'Weather', art: 'stripes' },
  { title: 'The slow return of the neighbourhood repair café', author: 'Priya Lindgren', minutes: 5, topic: 'Cities', art: 'moon' },
  { title: 'Keeping a sourdough starter alive through a dark winter', author: 'Wen Adeyemi', minutes: 7, topic: 'Food', art: 'dots' },
  { title: 'What a lighthouse logbook teaches about paying attention', author: 'Ada Moreau', minutes: 11, topic: 'History', art: 'arch' },
  { title: 'How to read a bus timetable like a short novel', author: 'Kofi Sandoval', minutes: 4, topic: 'Transit', art: 'split' },
];

/** One rounded rectangle as an SVG path (clockwise), so several can be unioned in one clip-path. */
function roundedRect(x: number, y: number, w: number, h: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  const n = (v: number) => Math.round(v * 100) / 100;
  return `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)}V${n(y + h - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + h - r)}V${n(y + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}Z`;
}

export default function SkeletonShimmerHandoff({ params }: EffectProps<Params>) {
  const { reduced, scale } = useStudioMotion();
  const uid = useId();
  const rows = Math.round(params.rows);
  const [phase, setPhase] = useState<Phase>('loading');
  const [batch, setBatch] = useState(0);
  const [status, setStatus] = useState('Loading reading list…');
  const listRef = useRef<HTMLUListElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => Array.from({ length: rows }, (_, i) => POOL[(batch * 2 + i) % POOL.length]), [rows, batch]);
  const shimmer = !reduced && params.shimmer !== 'none' && phase !== 'ready';
  const busy = phase !== 'ready';

  // 1 · Simulated request.
  useEffect(() => {
    if (phase !== 'loading') return;
    const t = window.setTimeout(() => setPhase('handoff'), params.latency);
    return () => window.clearTimeout(t);
  }, [phase, batch, params.latency]);

  // 2 · Clip the single shimmer layer to the union of every bone. Rebuilt on resize only, never per frame.
  useIsomorphicLayoutEffect(() => {
    const host = shimmerRef.current;
    const list = listRef.current;
    if (!shimmer || !host || !list) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const o = host.getBoundingClientRect();
      const d: string[] = [];
      list.querySelectorAll<HTMLElement>('[data-bone]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        d.push(roundedRect(r.left - o.left, r.top - o.top, r.width, r.height, parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0));
      });
      host.style.clipPath = d.length ? `path('${d.join('')}')` : 'inset(50%)';
      host.dataset.ready = '';
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(measure); });
    ro?.observe(list);
    return () => { ro?.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [shimmer, rows, batch]);

  // 3 · Handoff: shimmer off, then each row cross-fades skeleton → content in the same grid cell.
  useIsomorphicLayoutEffect(() => {
    const list = listRef.current;
    if (phase !== 'handoff' || !list) return;
    const content = list.querySelectorAll('[data-layer="content"]');
    const bones = list.querySelectorAll('[data-layer="skeleton"]');
    const seq = createSequence(reduced ? {} : { durationScale: scale.duration });
    if (reduced) {
      seq.add(content, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear', at: 0 });
      seq.add(bones, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'linear', at: 0 });
    } else {
      const each = params.stagger * scale.stagger;
      seq.add(shimmerRef.current, [{ opacity: 1 }, { opacity: 0 }], { duration: D.fast, easing: 'standard', at: 0 });
      seq.add(bones, [{ opacity: 1 }, { opacity: 0 }], { duration: D.base, easing: 'standard', stagger: each, at: 40 });
      seq.add(content, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: D.moderate, easing: 'emphasized', stagger: each, at: 40 });
    }
    let live = true;
    void seq.play().then((finished) => {
      if (!live || !finished) return;
      setPhase('ready');
      setStatus(`Reading list loaded: ${rows} ${rows === 1 ? 'article' : 'articles'}.`);
    });
    return () => { live = false; seq.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const reload = () => {
    if (busy) return;
    setBatch((b) => b + 1);
    setPhase('loading');
    setStatus('Loading reading list…');
  };

  return (
    <div className={styles.root} data-reduced={reduced || undefined} data-shimmer={params.shimmer} style={{ '--speed': `${params.speed}ms` } as CSSProperties}>
      <section className={styles.card} aria-labelledby={`${uid}title`}>
        <header className={styles.head}>
          <div>
            <h3 id={`${uid}title`} className={styles.title}>Reading list</h3>
            <p className={styles.sub}>Sample data · fictional articles</p>
          </div>
          <button type="button" className={styles.reload} onClick={reload} aria-disabled={busy || undefined}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
              <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Reload
          </button>
        </header>
        <p className={styles.status} role="status">{status}</p>

        <div className={styles.listWrap}>
          <ul ref={listRef} className={styles.list} aria-busy={busy} aria-labelledby={`${uid}title`}>
            {items.map((item, i) => (
              <li key={`${batch}-${i}`} className={styles.row}>
                {phase !== 'loading' ? (
                  <article data-layer="content" className={styles.layer}>
                    <span className={styles.thumb} data-art={item.art} aria-hidden="true" />
                    <div className={styles.text}>
                      <h4 className={styles.itemTitle}>{item.title}</h4>
                      <p className={styles.meta}>{item.author} · {item.minutes} min · {item.topic}</p>
                    </div>
                  </article>
                ) : null}
                {phase !== 'ready' ? (
                  <div data-layer="skeleton" className={styles.layer} aria-hidden="true">
                    <span data-bone="" className={styles.thumb} />
                    <div className={styles.text}>
                      <span className={styles.boneTitle}>
                        <span data-bone="" style={{ width: '94%' }} />
                        <span data-bone="" style={{ width: `${46 + ((i * 17) % 30)}%` }} />
                      </span>
                      <span className={styles.boneMeta}><span data-bone="" style={{ width: `${32 + ((i * 11) % 18)}%` }} /></span>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {shimmer ? <div ref={shimmerRef} className={styles.shimmer} aria-hidden="true" /> : null}
        </div>
      </section>
    </div>
  );
}
