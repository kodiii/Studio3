'use client';
/**
 * Community gallery with filters. The FLIP-grid-reorder pattern, rebuilt on the motion module's `flip()` for this
 * page's own entries: tiles that stay glide to their new cells, leaving tiles are removed at once, entering tiles
 * fade and scale in. DOM order always equals reading order. Reduced motion: no glide, entering tiles fade in 160 ms.
 */
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { duration as D, flip, useStudioMotion } from '../../../motion';
import { CATEGORIES, ENTRIES, type Category } from './data';
import { MendMotif } from './motifs';
import styles from './styles.module.css';

type Filter = Category | 'All';

export function Gallery() {
  const { reduced } = useStudioMotion();
  const [filter, setFilter] = useState<Filter>('All');
  const grid = useRef<HTMLUListElement>(null);
  const anims = useRef(new Set<Animation>());
  useEffect(() => { const set = anims.current; return () => { set.forEach((a) => a.cancel()); set.clear(); }; }, []);

  const track = (a: Animation) => {
    anims.current.add(a);
    const done = () => anims.current.delete(a);
    a.finished.then(done, done);
  };

  const choose = (next: Filter) => {
    if (next === filter) return;
    const el = grid.current;
    anims.current.forEach((a) => a.cancel());
    anims.current.clear();
    if (!el) { setFilter(next); return; }
    const tiles = Array.from(el.querySelectorAll<HTMLElement>('[data-tile]'));
    const before = new Set(tiles.filter((t) => !t.hidden));
    flip(before, () => flushSync(() => setFilter(next)), { duration: D.moderate, easing: 'emphasized', reducedMotion: reduced }).forEach(track);
    tiles.filter((t) => !t.hidden && !before.has(t)).forEach((t, i) => {
      if (typeof t.animate !== 'function') return;
      track(t.animate(
        reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'none' }],
        { duration: reduced ? D.fast : D.moderate, delay: reduced ? 0 : 80 + i * 36, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' },
      ));
    });
  };

  const shown = ENTRIES.filter((e) => filter === 'All' || e.category === filter).length;
  return (
    <div>
      <div className={styles.filters} role="group" aria-label="Show mends by kind">
        {(['All', ...CATEGORIES] as const).map((c) => (
          <button key={c} type="button" className={styles.chip} aria-pressed={filter === c} onClick={() => choose(c)}>{c}</button>
        ))}
      </div>
      <p className={styles.count} aria-live="polite">Showing {shown} of {ENTRIES.length} mends{filter === 'All' ? '' : ` · ${filter}`}</p>
      <ul ref={grid} className={styles.grid}>
        {ENTRIES.map((e) => (
          <li key={e.id} data-tile="" className={styles.tile} hidden={filter !== 'All' && e.category !== filter}>
            <div role="img" aria-label={e.alt} className={styles.tileArt}><MendMotif motif={e.motif} /></div>
            <p className={styles.tileTitle}>{e.title}</p>
            <p className={styles.tileMeta}>{e.who} · {e.where}</p>
            <span className={styles.tileTag}>{e.category}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
