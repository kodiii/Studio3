'use client';
import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { radius: number; intensity: number; surface: boolean; color: string; follow: string };

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{d}</svg>
);

/** Sample modules for an invented writing tool. */
const MODULES: readonly { id: string; name: string; text: string; glyph: ReactNode }[] = [
  { id: 'offline', name: 'Offline drafts', text: 'Write without a connection; changes merge when you are back online.', glyph: icon(<><path d="M7 18h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.4 1.5A3.3 3.3 0 0 0 7 18z" /><path d="M4 4l16 16" /></>) },
  { id: 'history', name: 'Version history', text: 'Every save is kept, with named restore points you can compare side by side.', glyph: icon(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>) },
  { id: 'cursors', name: 'Shared cursors', text: 'See who is reading, who is editing and who has just stepped away.', glyph: icon(<><path d="M5 4l5 14 2-6 6-2z" /><path d="M15 15l4 4" /></>) },
  { id: 'audit', name: 'Audit log', text: 'A plain-language record of who changed what, and when they did it.', glyph: icon(<><path d="M8 6h11M8 12h11M8 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>) },
  { id: 'roles', name: 'Granular roles', text: 'Viewer, commenter, editor and owner, set per page or for a whole space.', glyph: icon(<><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8M16 7l2 2M14 9l2 2" /></>) },
  { id: 'export', name: 'Export anywhere', text: 'PDF, Markdown or a zipped folder of plain files, whenever you like.', glyph: icon(<><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 14v5h14v-5" /></>) },
];
const SPOT: Record<string, string> = { signal: 'var(--mk-signal, #bf2f09)', ink: 'var(--mk-ink, #11110f)', accent: 'var(--mk-accent, #bf2f09)' };

export default function SpotlightBorderCard({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const grid = useRef<HTMLUListElement>(null);
  const frame = useRef(0);
  const point = useRef<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(['history', 'roles']));

  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => { if (reduced) delete grid.current?.dataset.lit; }, [reduced]);

  // The one pointer listener: batch to a frame, read every card rect first, then write.
  const paint = () => {
    frame.current = 0;
    const g = grid.current;
    const p = point.current;
    if (!g || !p) return;
    const cards = [...g.querySelectorAll<HTMLElement>('[data-card]')];
    const rects = cards.map((c) => c.getBoundingClientRect());
    cards.forEach((c, i) => {
      c.style.setProperty('--sbc-x', `${(p.x - rects[i].left).toFixed(1)}px`);
      c.style.setProperty('--sbc-y', `${(p.y - rects[i].top).toFixed(1)}px`);
    });
    g.dataset.lit = '';
  };
  const onMove = (e: PointerEvent<HTMLUListElement>) => {
    if (reduced || e.pointerType === 'touch') return;
    point.current = { x: e.clientX, y: e.clientY };
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  };
  const onLeave = () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (grid.current) delete grid.current.dataset.lit;
  };

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <div
      className={styles.root}
      data-reduced={reduced || undefined}
      data-follow={params.follow === 'instant' ? 'instant' : 'smooth'}
      data-surface={params.surface || undefined}
      style={{ '--sbc-r': `${params.radius}px`, '--sbc-a': `${params.intensity}%`, '--sbc-spot': SPOT[params.color] ?? SPOT.signal } as CSSProperties}
    >
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Ledgerline · workspace setup</p>
          <h3 className={styles.title} id={`${uid}title`}>Choose your modules</h3>
        </div>
        <p className={styles.status} role="status">{selected.size} of {MODULES.length} added · sample</p>
      </header>
      <ul ref={grid} className={styles.grid} aria-labelledby={`${uid}title`} onPointerMove={onMove} onPointerLeave={onLeave}>
        {MODULES.map((m) => {
          const on = selected.has(m.id);
          return (
            <li key={m.id} className={styles.card} data-card data-on={on || undefined}>
              <span className={styles.glyph}>{m.glyph}</span>
              <h4 className={styles.name}>
                <button type="button" className={styles.toggle} aria-pressed={on} aria-describedby={`${uid}${m.id}`} onClick={() => toggle(m.id)}>
                  {m.name}
                </button>
              </h4>
              <p id={`${uid}${m.id}`} className={styles.text}>{m.text}</p>
              <span className={styles.state} aria-hidden="true">
                <span className={styles.tick}>
                  <svg viewBox="0 0 16 16" width="12" height="12"><path d={on ? 'M3.5 8.5l3 3 6-7' : 'M8 3.5v9M3.5 8h9'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                {on ? 'Added' : 'Add'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
