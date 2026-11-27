'use client';
/**
 * Community gallery with filters — the flip-grid-reorder technique, rebuilt on the motion module's `flip()` for this
 * page's own entries: tiles that stay glide to their new cells (staggered, measured where they visually are, so a new
 * filter can interrupt a glide without a jump), leaving tiles fade and shrink where they stood as aria-hidden ghosts,
 * and entering tiles scale in once the glide is under way. DOM order always equals reading order.
 *
 * Each photo is a card you can pick up: it lifts towards the light on hover, presses down when clicked, and turns over
 * on a spring to show the "before" photo (the same toggle from the keyboard). Reduced motion: no glide or turn —
 * tiles swap in place, entering tiles fade in 160 ms, the photos cross-fade.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { cssEase, duration as D, flip, stagger as ST, useStudioMotion } from '../../../motion';
import { CATEGORIES, ENTRIES, type Category, type Entry } from './data';
import { MendMotif } from './motifs';
import styles from './styles.module.css';

type Filter = Category | 'All';
interface Ghost { e: Entry; x: number; y: number; w: number; h: number }

const matches = (f: Filter) => (e: Entry) => f === 'All' || e.category === f;
const targetOf = (a: Animation): Element | null => (a.effect as KeyframeEffect | null)?.target ?? null;
const opacityOf = (el: Element): number => Number.parseFloat(getComputedStyle(el).opacity) || 0;

function Tile({ e, before, onFlip, uid, ghost }: { e: Entry; before: boolean; onFlip?: () => void; uid: string; ghost?: Ghost }) {
  const desc = `${uid}-${e.id}-desc`;
  return (
    <li
      data-tile={e.id}
      className={styles.tile}
      aria-hidden={ghost ? true : undefined}
      inert={ghost ? true : undefined}
      data-ghost={ghost ? '' : undefined}
      style={ghost ? { position: 'absolute', left: ghost.x, top: ghost.y, width: ghost.w, height: ghost.h, margin: 0 } : undefined}
    >
      <div className={styles.tileCard}>
        <button type="button" className={styles.tileArt} aria-pressed={before} aria-describedby={ghost ? undefined : desc} onClick={onFlip}>
          <span className="mk-sr-only">Show the before photo: {e.title}</span>
          <span className={styles.flipInner} aria-hidden="true">
            <span className={`${styles.face} ${styles.faceAfter}`}><MendMotif motif={e.motif} /></span>
            <span className={`${styles.face} ${styles.faceBefore}`}><MendMotif motif={e.motif} state="before" /></span>
          </span>
          <span className={styles.tileTag} aria-hidden="true">{e.category}</span>
          <span className={styles.flipHint} aria-hidden="true">{before ? 'Before' : 'After'}</span>
        </button>
        <p className={styles.tileTitle}>{e.title}</p>
        <p className={styles.tileMeta}>{e.who} · {e.where}</p>
        {ghost ? null : <p id={desc} className="mk-sr-only">{before ? e.before : e.alt}</p>}
      </div>
    </li>
  );
}

export function Gallery() {
  const { reduced, scale } = useStudioMotion();
  const uid = useId();
  const [filter, setFilter] = useState<Filter>('All');
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [before, setBefore] = useState<Record<string, boolean>>({});
  const grid = useRef<HTMLUListElement>(null);
  const anims = useRef(new Set<Animation>());
  const live = useRef({ filter, ghosts });
  live.current = { filter, ghosts };
  useEffect(() => { const set = anims.current; return () => { set.forEach((a) => a.cancel()); set.clear(); }; }, []);

  const track = (a: Animation): Animation => {
    anims.current.add(a);
    const done = () => anims.current.delete(a);
    a.addEventListener('finish', done);
    a.addEventListener('cancel', done);
    return a;
  };
  const cancelOn = (els: Set<Element>) => {
    for (const a of [...anims.current]) { const t = targetOf(a); if (t && els.has(t)) a.cancel(); }
  };

  const choose = (next: Filter) => {
    const cur = live.current;
    if (next === cur.filter) return;
    const root = grid.current;
    const nextIds = new Set(ENTRIES.filter(matches(next)).map((e) => e.id));
    const commit = (g: Ghost[]) => flushSync(() => { setFilter(next); setGhosts(g); });
    if (!root || typeof root.animate !== 'function') { commit([]); return; }

    const els = new Map<string, HTMLElement>();
    root.querySelectorAll<HTMLElement>('[data-tile]:not([data-ghost])').forEach((el) => { if (el.dataset.tile) els.set(el.dataset.tile, el); });
    const fresh = () => [...root.querySelectorAll<HTMLElement>('[data-tile]:not([data-ghost])')].filter((el) => el.dataset.tile && !els.has(el.dataset.tile));

    if (reduced) {
      cancelOn(new Set(els.values()));
      commit([]);
      for (const el of fresh()) track(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: D.fast, easing: 'linear', fill: 'backwards' }));
      return;
    }

    const box = root.getBoundingClientRect();
    // FIRST — everything where it is on screen now, including tiles caught mid-glide or mid-fade.
    const leaving: Ghost[] = [];
    const leavingFrom: [Entry, number][] = [];
    for (const e of ENTRIES.filter(matches(cur.filter))) {
      const el = els.get(e.id);
      if (!el || nextIds.has(e.id)) continue;
      const r = el.getBoundingClientRect();
      leaving.push({ e, x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height });
      leavingFrom.push([e, opacityOf(el)]);
    }
    const kept = cur.ghosts.filter((g) => !nextIds.has(g.e.id) && !leaving.some((l) => l.e.id === g.e.id));
    const staying = [...els.entries()].filter(([id]) => nextIds.has(id)).map(([, el]) => el);
    const stayingFrom = new Map(staying.map((el) => [el, opacityOf(el)]));
    const ms = Math.round(D.slow * scale.duration);
    const each = ST.tight * scale.stagger;

    // LAST + INVERT + PLAY inside flip(): the mutation cancels in-flight animations first, so "last" is clean layout.
    flip(staying, () => { cancelOn(new Set(els.values())); commit([...kept, ...leaving]); }, { duration: ms, easing: 'emphasized', stagger: each }).forEach(track);
    for (const [el, o] of stayingFrom) if (o < 0.99) track(el.animate([{ opacity: o }, { opacity: 1 }], { duration: D.base, easing: cssEase('standard'), fill: 'backwards' }));

    // Leaving tiles shrink and fade where they stood, then leave the DOM.
    for (const [e, o] of leavingFrom) {
      const ghost = root.querySelector<HTMLElement>(`[data-ghost][data-tile="${e.id}"]`);
      if (!ghost) continue;
      const a = track(ghost.animate([{ opacity: o, transform: 'none' }, { opacity: 0, transform: 'scale(0.9) translateY(6px)' }], { duration: D.base * scale.duration, easing: cssEase('exit'), fill: 'forwards' }));
      a.addEventListener('finish', () => setGhosts((gs) => gs.filter((g) => g.e.id !== e.id)));
    }
    // Entering tiles rise into the space the glide opens up.
    fresh().forEach((el, i) => {
      track(el.animate([{ opacity: 0, transform: 'scale(0.86) translateY(10px)' }, { opacity: 1, transform: 'none' }], {
        duration: Math.round(ms * 0.85), delay: Math.round(ms * 0.2 + i * each), easing: cssEase('emphasized'), fill: 'backwards',
      }));
    });
  };

  const shown = ENTRIES.filter(matches(filter));
  return (
    <div>
      <div className={styles.filters} role="group" aria-label="Show mends by kind">
        {(['All', ...CATEGORIES] as const).map((c) => (
          <button key={c} type="button" className={styles.chip} aria-pressed={filter === c} onClick={() => choose(c)}>
            {c}<span className={styles.chipCount} aria-hidden="true">{c === 'All' ? ENTRIES.length : ENTRIES.filter((e) => e.category === c).length}</span>
          </button>
        ))}
      </div>
      <p className={styles.count} aria-live="polite">Showing {shown.length} of {ENTRIES.length} mends{filter === 'All' ? '' : ` · ${filter}`}. Turn a photo over to see it before the mend.</p>
      <ul ref={grid} className={styles.grid}>
        {shown.map((e) => <Tile key={e.id} e={e} uid={uid} before={!!before[e.id]} onFlip={() => setBefore((b) => ({ ...b, [e.id]: !b[e.id] }))} />)}
        {ghosts.filter((g) => !shown.includes(g.e)).map((g) => <Tile key={`ghost-${g.e.id}`} e={g.e} uid={uid} before={!!before[g.e.id]} ghost={g} />)}
      </ul>
    </div>
  );
}
