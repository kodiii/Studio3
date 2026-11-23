'use client';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { cssEase, duration as D, flip, useStudioMotion, type EasingToken } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { duration: number; stagger: number; easing: string; entrance: string; tileSize: number; filterMode: string };

type Category = 'Paper' | 'Textile' | 'Metal' | 'Stone';
type SortKey = 'number' | 'name' | 'tone' | 'shuffle';

interface Material {
  id: string;
  no: number;
  name: string;
  category: Category;
  /** Perceived lightness 0–100, used by the tone sort and printed on the tile. */
  tone: number;
  pattern: string;
  colors: readonly [string, string, string?];
}

/** Sample data: an invented swatch library. Colours are the physical sample, so they stay fixed in both themes. */
const MATERIALS: readonly Material[] = [
  { id: 'cotton', no: 1, name: 'Cotton rag', category: 'Paper', tone: 93, pattern: 'fibre', colors: ['#f1ece1', '#d8cfbd'] },
  { id: 'laid', no: 2, name: 'Laid ivory', category: 'Paper', tone: 87, pattern: 'laid', colors: ['#e9ddc4', '#c9b893'] },
  { id: 'kraft', no: 3, name: 'Kraft board', category: 'Paper', tone: 58, pattern: 'fibre', colors: ['#b4855a', '#916a42'] },
  { id: 'linen', no: 4, name: 'Raw linen', category: 'Textile', tone: 79, pattern: 'weave', colors: ['#d2c7b0', '#aa9d7f'] },
  { id: 'madder', no: 5, name: 'Madder twill', category: 'Textile', tone: 36, pattern: 'twill', colors: ['#8c3a2a', '#6e2b1d'] },
  { id: 'felt', no: 6, name: 'Moss felt', category: 'Textile', tone: 42, pattern: 'felt', colors: ['#62664f', '#4b4f3c', '#7b7f66'] },
  { id: 'steel', no: 7, name: 'Brushed steel', category: 'Metal', tone: 71, pattern: 'brushed', colors: ['#a7aaa6', '#d0d3ce'] },
  { id: 'copper', no: 8, name: 'Copper sheet', category: 'Metal', tone: 54, pattern: 'brushed', colors: ['#a95d35', '#d49066'] },
  { id: 'zinc', no: 9, name: 'Perforated zinc', category: 'Metal', tone: 49, pattern: 'perforated', colors: ['#7c807d', '#2f3230'] },
  { id: 'travertine', no: 10, name: 'Travertine', category: 'Stone', tone: 82, pattern: 'strata', colors: ['#dccdb1', '#c2ad8a'] },
  { id: 'terrazzo', no: 11, name: 'Terrazzo', category: 'Stone', tone: 85, pattern: 'terrazzo', colors: ['#e6dfd2', '#a14b30', '#3d3c37'] },
  { id: 'slate', no: 12, name: 'Welsh slate', category: 'Stone', tone: 25, pattern: 'slate', colors: ['#3b4043', '#4c5357'] },
];
const CATEGORIES: readonly Category[] = ['Paper', 'Textile', 'Metal', 'Stone'];
const SORTS: readonly { key: Exclude<SortKey, 'shuffle'>; label: string; spoken: string }[] = [
  { key: 'number', label: 'Number', spoken: 'catalogue number' },
  { key: 'name', label: 'Name', spoken: 'name' },
  { key: 'tone', label: 'Tone', spoken: 'tone, light to dark' },
];
const EASINGS: readonly EasingToken[] = ['emphasized', 'standard', 'inOut', 'overshoot'];

/** Deterministic per-seed shuffle key, so a shuffle is stable across re-renders. */
function rank(id: string, seed: number): number {
  let h = Math.imul(seed + 0x9e3779b9, 0x85ebca6b) >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0xc2b2ae35) >>> 0;
  return h;
}

function arrange(filter: readonly Category[], sort: SortKey, seed: number): Material[] {
  const list = MATERIALS.filter((m) => !filter.length || filter.includes(m.category));
  if (sort === 'name') return list.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'tone') return list.sort((a, b) => b.tone - a.tone);
  if (sort === 'shuffle') return list.sort((a, b) => rank(a.id, seed) - rank(b.id, seed));
  return list.sort((a, b) => a.no - b.no);
}

/** A tile that has left the list but is still fading out, pinned where it stood. */
interface Ghost { m: Material; x: number; y: number; w: number; h: number }

const targetOf = (a: Animation): Element | null => (a.effect as KeyframeEffect | null)?.target ?? null;
const opacityOf = (el: Element): number => Number.parseFloat(getComputedStyle(el).opacity) || 0;

export default function FlipGridReorder({ params }: EffectProps<Params>) {
  const { reduced, scale } = useStudioMotion();
  const uid = useId();
  const [filter, setFilter] = useState<Category[]>([]);
  const [sort, setSort] = useState<SortKey>('number');
  const [seed, setSeed] = useState(1);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const grid = useRef<HTMLUListElement>(null);
  const anims = useRef(new Set<Animation>());

  const visible = useMemo(() => arrange(filter, sort, seed), [filter, sort, seed]);
  // Latest committed state for event handlers (a transition can start before React re-renders the handler).
  const state = useRef({ filter, sort, seed, visible, ghosts });
  state.current = { filter, sort, seed, visible, ghosts };

  useEffect(() => {
    const running = anims.current;
    return () => { for (const a of running) a.cancel(); running.clear(); };
  }, []);

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

  const transition = (nextFilter: Category[], nextSort: SortKey, nextSeed: number) => {
    const cur = state.current;
    const next = arrange(nextFilter, nextSort, nextSeed);
    const nextIds = new Set(next.map((m) => m.id));
    const root = grid.current;
    const commit = (g: Ghost[]) => flushSync(() => { setFilter(nextFilter); setSort(nextSort); setSeed(nextSeed); setGhosts(g); });
    if (!root || typeof root.animate !== 'function') { commit([]); return; }

    const els = new Map<string, HTMLElement>();
    root.querySelectorAll<HTMLElement>('[data-tile]').forEach((el) => { if (el.dataset.tile) els.set(el.dataset.tile, el); });
    const tileEl = (id: string) => els.get(id) ?? null;
    const freshTiles = () => [...root.querySelectorAll<HTMLElement>('[data-tile]')].filter((el) => el.dataset.tile && !els.has(el.dataset.tile) && nextIds.has(el.dataset.tile));

    if (reduced) {
      // Tier 2: no travel. Leaving tiles go at once, entering tiles fade in.
      cancelOn(new Set(els.values()));
      commit([]);
      for (const el of freshTiles()) track(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear', fill: 'backwards' }));
      return;
    }

    const ms = Math.round(params.duration * scale.duration);
    const each = params.stagger * scale.stagger;
    const ease = EASINGS.includes(params.easing as EasingToken) ? (params.easing as EasingToken) : 'emphasized';
    const box = root.getBoundingClientRect();

    // FIRST: where everything is right now, including tiles caught mid-animation.
    const leaving: Ghost[] = [];
    const leavingEls: HTMLElement[] = [];
    for (const m of cur.visible) {
      const el = tileEl(m.id);
      if (!el || nextIds.has(m.id)) continue;
      const r = el.getBoundingClientRect();
      leaving.push({ m, x: r.left - box.left - root.clientLeft, y: r.top - box.top - root.clientTop, w: r.width, h: r.height });
      leavingEls.push(el);
    }
    const leavingFrom = new Map(leavingEls.map((el) => [el, opacityOf(el)]));
    const kept = cur.ghosts.filter((g) => !nextIds.has(g.m.id));
    const staying = next.flatMap((m) => tileEl(m.id) ?? []);
    const stayingFrom = new Map(staying.map((el) => [el, opacityOf(el)]));

    // LAST + INVERT + PLAY happen inside flip(); the mutation cancels in-flight animations first
    // so the "last" measurement is the clean layout position.
    const glides = flip(staying, () => {
      cancelOn(new Set([...staying, ...leavingEls]));
      commit([...kept, ...leaving]);
    }, { duration: ms, easing: ease, stagger: each });
    glides.forEach(track);

    // Tiles that were half faded (a ghost brought back, an entrance interrupted) recover their opacity.
    for (const [el, o] of stayingFrom) {
      if (o < 0.99) track(el.animate([{ opacity: o }, { opacity: 1 }], { duration: D.base, easing: cssEase('standard'), fill: 'backwards' }));
    }
    // Leaving tiles fade where they stood, then leave the DOM.
    for (const [el, o] of leavingFrom) {
      const id = el.dataset.tile;
      const a = track(el.animate(
        [{ opacity: o, transform: 'none' }, { opacity: 0, transform: 'scale(0.92)' }],
        { duration: D.fast * scale.duration, easing: cssEase('exit'), fill: 'forwards' },
      ));
      a.addEventListener('finish', () => setGhosts((gs) => gs.filter((g) => g.m.id !== id)));
    }
    // Entering tiles arrive once the glide is under way.
    const enter: Keyframe = params.entrance === 'rise'
      ? { opacity: 0, transform: 'translateY(18px)' }
      : params.entrance === 'fade' ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.82)' };
    freshTiles().forEach((el, i) => {
      track(el.animate([enter, { opacity: 1, transform: 'none' }], {
        duration: Math.round(ms * 0.85), delay: Math.round(ms * 0.22 + i * each), easing: cssEase(ease === 'overshoot' ? 'overshoot' : 'emphasized'), fill: 'backwards',
      }));
    });
  };

  const multi = params.filterMode === 'multiple';
  const onFilter = (c: Category | null) => {
    const cur = state.current;
    let next: Category[];
    if (c === null) next = [];
    else if (multi) {
      next = cur.filter.includes(c) ? cur.filter.filter((x) => x !== c) : CATEGORIES.filter((x) => x === c || cur.filter.includes(x));
      if (next.length === CATEGORIES.length) next = [];
    } else next = cur.filter.length === 1 && cur.filter[0] === c ? [] : [c];
    if (next.join() === cur.filter.join()) return;
    transition(next, cur.sort, cur.seed);
  };
  const onSort = (s: Exclude<SortKey, 'shuffle'>) => {
    const cur = state.current;
    if (s !== cur.sort) transition(cur.filter, s, cur.seed);
  };
  const onShuffle = () => {
    const cur = state.current;
    const order = cur.visible.map((m) => m.id).join();
    let s = cur.seed + 1;
    // Never "shuffle" into the order already on screen.
    while (s < cur.seed + 12 && arrange(cur.filter, 'shuffle', s).map((m) => m.id).join() === order) s++;
    transition(cur.filter, 'shuffle', s);
  };

  // Switching filter mode keeps at most one filter when going back to single.
  useEffect(() => {
    if (!multi && state.current.filter.length > 1) setFilter((f) => f.slice(0, 1));
  }, [multi]);

  const count = (c: Category) => MATERIALS.filter((m) => m.category === c).length;
  const filterText = filter.length ? filter.join(' and ').toLowerCase() : 'all categories';
  const sortText = sort === 'shuffle' ? 'shuffled' : `sorted by ${SORTS.find((s) => s.key === sort)?.spoken}`;
  const rows = [...visible.map((m) => ({ m, ghost: null as Ghost | null })), ...ghosts.filter((g) => !visible.includes(g.m)).map((g) => ({ m: g.m, ghost: g }))];

  return (
    <div className={styles.root} data-reduced={reduced || undefined} style={{ '--tile-min': `${params.tileSize}px` } as CSSProperties}>
      <header className={styles.head}>
        <h3 className={styles.title} id={`${uid}title`}>Material library</h3>
        <p className={styles.status} role="status">
          <span className={styles.statusCount}>{visible.length} of {MATERIALS.length}</span> materials · {filterText} · {sortText}
        </p>
      </header>

      <div className={styles.controls}>
        <div className={styles.group} role="group" aria-label={multi ? 'Filter by category, several allowed' : 'Filter by category'}>
          <button type="button" className={styles.chip} aria-pressed={filter.length === 0} onClick={() => onFilter(null)}>
            All <span className={styles.chipCount} aria-hidden="true">{MATERIALS.length}</span>
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className={styles.chip} aria-pressed={filter.includes(c)} onClick={() => onFilter(c)}>
              {c} <span className={styles.chipCount} aria-hidden="true">{count(c)}</span>
            </button>
          ))}
        </div>
        <div className={styles.group} role="group" aria-label="Sort materials">
          <span className={styles.groupLabel} aria-hidden="true">Sort</span>
          {SORTS.map((s) => (
            <button key={s.key} type="button" className={styles.chip} aria-pressed={sort === s.key} onClick={() => onSort(s.key)}>
              {s.label}
            </button>
          ))}
          <button type="button" className={`${styles.chip} ${styles.shuffle}`} onClick={onShuffle}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 4.5h2.6c1.3 0 2 .5 2.8 1.6l1.2 1.8c.8 1.1 1.5 1.6 2.8 1.6H14M2 11.5h2.6c1.3 0 2-.5 2.8-1.6M9.6 6.1c.8-1.1 1.5-1.6 2.8-1.6H14M12 2.5l2 2-2 2M12 9.5l2 2-2 2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Shuffle
          </button>
        </div>
      </div>

      <ul ref={grid} className={styles.grid} aria-labelledby={`${uid}title`}>
        {rows.map(({ m, ghost }) => (
          <li
            key={m.id}
            data-tile={m.id}
            className={styles.tile}
            aria-hidden={ghost ? true : undefined}
            data-leaving={ghost ? '' : undefined}
            style={ghost ? { position: 'absolute', left: ghost.x, top: ghost.y, width: ghost.w, height: ghost.h } : undefined}
          >
            <span
              className={styles.swatch}
              data-pattern={m.pattern}
              style={{ '--c1': m.colors[0], '--c2': m.colors[1], '--c3': m.colors[2] ?? m.colors[1] } as CSSProperties}
            />
            <span className={styles.label}>
              <span className={styles.name}>{m.name}</span>
              <span className={styles.no}><span className={styles.srOnly}>Number </span>{String(m.no).padStart(2, '0')}</span>
            </span>
            <span className={styles.meta}>{m.category} · <abbr title="Tone (lightness)">L</abbr>{m.tone}</span>
          </li>
        ))}
      </ul>
      <p className={styles.note}>Sample data · swatches drawn with CSS gradients</p>
    </div>
  );
}
