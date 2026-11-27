'use client';
/**
 * Ranked dot plot for the drill-down, drawn as dots and 10th–90th percentile whiskers because cup scores cluster far
 * from zero (bars would need a zero baseline and would hide every difference).
 *
 * Motion keeps every row identifiable:
 *  - Within a level (filters, brushes), rows keep identity and glide to their new rank while their values
 *    interpolate (the bar-race-transition technique, effects/bar-race-transition).
 *  - Changing level uses the flip-grid-reorder technique (effects/flip-grid-reorder), adapted to a ranked list:
 *    FIRST is where the anchor row is on screen now (its rank and its values), LAST is each new row's slot; the new rows
 *    are inverted onto the anchor and played back to their slots. Drilling down, the children emerge from the row
 *    you chose — from its slot and from its mean, so the aggregate visibly splits into its parts — staggered by rank
 *    (`stagger.tight`), while the old rows leave as aria-hidden ghosts where they stood (exit shorter than enter).
 *    Drilling up reverses it exactly: the children fold back into their parent's new slot and value.
 *  - A new change interrupts from the values on screen; nothing jumps.
 * Reduced motion: rows cut to their rank and value; a level change cross-fades the new rows in 160 ms.
 */
import { useEffect, useRef, useState } from 'react';
import { duration as D, stagger as ST, useIsomorphicLayoutEffect, useStudioMotion } from '../../../motion';
import { SCORE, fmt } from './data';
import { bezier, createLoop } from './physics';
import s from './styles.module.css';

export interface Row { id: string; name: string; n: number; mean: number; p10: number; p90: number; a: number; b: number; drill: boolean; pinned?: boolean }
interface Vals { mean: number; p10: number; p90: number; a: number; b: number; rank: number; o: number }
interface Track { from: Vals; to: Vals; delay: number; dur: number; ease: (t: number) => number }
interface View { vals: Map<string, Vals>; ghosts: { row: Row; v: Vals }[]; h: number }

const ROW = 40;
const EASE = { glide: bezier('emphasized'), rerank: bezier('inOut'), settle: bezier('standard'), exit: bezier('exit') };
const pos = (v: number) => `${(((Math.min(SCORE[1], Math.max(SCORE[0], v)) - SCORE[0]) / (SCORE[1] - SCORE[0])) * 100).toFixed(2)}%`;
const mix = (p: number, q: number, e: number) => (Number.isFinite(p) && Number.isFinite(q) ? p + (q - p) * e : q);

function ranked(rows: Row[], compare: boolean): Map<string, Vals> {
  const key = (r: Row) => (compare ? (Number.isFinite(r.a) && Number.isFinite(r.b) ? r.a - r.b : -Infinity) : Number.isFinite(r.mean) ? r.mean : -Infinity);
  const order = [...rows].sort((p, q) => key(q) - key(p) || p.name.localeCompare(q.name));
  return new Map(order.map((r, i) => [r.id, { mean: r.mean, p10: r.p10, p90: r.p90, a: r.a, b: r.b, rank: i, o: 1 }]));
}

/** Value of a track at time t (ms). Position and values ease; opacity is linear (fade-ins finish early). */
function at(tr: Track, t: number): Vals {
  const p = Math.min(1, Math.max(0, (t - tr.delay) / Math.max(1, tr.dur)));
  const e = tr.ease(p);
  const f = tr.from, g = tr.to;
  const op = g.o > f.o ? Math.min(1, p / 0.45) : p;
  return { mean: mix(f.mean, g.mean, e), p10: mix(f.p10, g.p10, e), p90: mix(f.p90, g.p90, e), a: mix(f.a, g.a, e), b: mix(f.b, g.b, e), rank: f.rank + (g.rank - f.rank) * e, o: f.o + (g.o - f.o) * op };
}

/** How the level changed: down into `anchor` (a row of the old list), up out of `anchor` (a row of the new list), or a jump. */
function relation(prev: string, next: string): { kind: 'same' | 'down' | 'up' | 'jump'; anchor?: string } {
  if (prev === next) return { kind: 'same' };
  const p = prev ? prev.split('/') : [], n = next ? next.split('/') : [];
  let c = 0;
  while (c < p.length && c < n.length && p[c] === n[c]) c++;
  if (c === p.length && n.length > p.length) return { kind: 'down', anchor: n[c] };
  if (c === n.length && p.length > n.length) return { kind: 'up', anchor: p[c] };
  return { kind: 'jump' };
}

function RowBody({ r, v, compare }: { r: Row; v: Vals; compare: boolean }) {
  const empty = compare ? !(Number.isFinite(r.a) && Number.isFinite(r.b)) : !r.n;
  return (
    <>
      <span className={s.dotName}><span className={s.dotNameText}>{r.name}</span><span className={s.dotN}>{r.n ? `n ${r.n}` : 'n 0'}</span></span>
      <span className={s.dotTrack} aria-hidden="true">
        {empty ? null : compare ? (
          <>
            <span className={s.dumbbell} style={{ left: pos(Math.min(v.a, v.b)), right: `calc(100% - ${pos(Math.max(v.a, v.b))})` }} />
            <span className={s.dotA} style={{ left: pos(v.a) }} />
            <span className={s.dotB} style={{ left: pos(v.b) }} />
          </>
        ) : (
          <>
            {r.n > 1 && <span className={s.whisker} style={{ left: pos(v.p10), right: `calc(100% - ${pos(v.p90)})` }} />}
            <span className={s.dot} data-pinned={r.pinned || undefined} style={{ left: pos(v.mean) }} />
          </>
        )}
      </span>
      <span className={s.dotVal}>{empty ? '—' : compare ? fmt.signed1.format(r.a - r.b) : fmt.mean(r.mean)}</span>
    </>
  );
}

export function Breakdown({ rows, levelKey, compare, onSelect }: { rows: Row[]; levelKey: string; compare: boolean; onSelect: (r: Row) => void; noun?: string }) {
  const { reduced, scale } = useStudioMotion();
  const target = ranked(rows, compare);
  const [view, setView] = useState<View>(() => ({ vals: target, ghosts: [], h: rows.length * ROW }));
  const viewRef = useRef(view);
  viewRef.current = view;
  const prev = useRef({ levelKey, rows });
  const plan = useRef<{ rows: Map<string, Track>; ghosts: { row: Row; track: Track }[]; h: Track; t: number } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const refocus = useRef(false);
  const sig = rows.map((r) => `${r.id}:${r.n}:${r.mean}:${r.p10}:${r.p90}:${r.a}:${r.b}`).join('|') + String(compare);

  const frame = (t: number): boolean => {
    const pl = plan.current;
    if (!pl) return false;
    let busy = false;
    const vals = new Map<string, Vals>();
    for (const [id, tr] of pl.rows) { vals.set(id, at(tr, t)); if (t < tr.delay + tr.dur) busy = true; }
    const ghosts = pl.ghosts.filter((g) => t < g.track.delay + g.track.dur).map((g) => ({ row: g.row, v: at(g.track, t) }));
    if (ghosts.length) busy = true;
    const h = at(pl.h, t).rank;
    if (t < pl.h.delay + pl.h.dur) busy = true;
    setView({ vals, ghosts, h });
    if (!busy) plan.current = null;
    return busy;
  };
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const loop = useRef<ReturnType<typeof createLoop> | null>(null);
  if (!loop.current) loop.current = createLoop((dt) => { const pl = plan.current; if (!pl) return false; pl.t += dt * 1000; return frameRef.current(pl.t); });
  useEffect(() => () => loop.current?.stop(), []);

  // Plan the transition before paint, so the first frame already shows FIRST (no flash of the final layout).
  useIsomorphicLayoutEffect(() => {
    const was = prev.current;
    prev.current = { levelKey, rows };
    const rel = relation(was.levelKey, levelKey);
    const shown = viewRef.current;
    const to = ranked(rows, compare);
    const H = rows.length * ROW;
    const k = scale.duration;
    const hTrack = (dur: number, ease: (t: number) => number, delay = 0): Track => ({ from: { ...ZERO, rank: shown.h }, to: { ...ZERO, rank: H }, delay, dur, ease });
    const cur = (id: string) => shown.vals.get(id);

    if (reduced) {
      loop.current?.stop();
      if (rel.kind === 'same') { plan.current = null; setView({ vals: to, ghosts: [], h: H }); return; }
      const tracks = new Map<string, Track>();
      for (const [id, t] of to) tracks.set(id, { from: { ...t, o: 0 }, to: t, delay: 0, dur: 160, ease: (p) => p });
      plan.current = { rows: tracks, ghosts: [], h: hTrack(1, (p) => p), t: 0 };
      frame(0);
      loop.current?.start();
      return;
    }

    // Ghosts already leaving keep leaving from where they are.
    const carried = (plan.current?.ghosts ?? []).map((g) => {
      const v = shown.ghosts.find((x) => x.row.id === g.row.id)?.v ?? g.track.from;
      return { row: g.row, track: { from: v, to: { ...v, o: 0 }, delay: 0, dur: D.fast * k, ease: EASE.exit } };
    }).filter((g) => g.track.from.o > 0.02 && !to.has(g.row.id));
    const leaving = (keep: (r: Row) => boolean, make: (r: Row, v: Vals) => Track) => was.rows.filter((r) => !to.has(r.id) && keep(r)).flatMap((r) => {
      const v = cur(r.id);
      return v && v.o > 0.02 ? [{ row: r, track: make(r, v) }] : [];
    });
    const tracks = new Map<string, Track>();

    if (rel.kind === 'same') {
      const still = !carried.length && shown.h === H && [...to].every(([id, t]) => {
        const f = cur(id);
        return f && f.rank === t.rank && f.o === 1 && Object.is(f.mean, t.mean) && Object.is(f.p10, t.p10) && Object.is(f.p90, t.p90) && Object.is(f.a, t.a) && Object.is(f.b, t.b);
      }) && was.rows.every((r) => to.has(r.id));
      if (still) return;
      for (const [id, t] of to) {
        const f = cur(id);
        tracks.set(id, f ? { from: f, to: t, delay: 0, dur: D.moderate * k, ease: EASE.rerank } : { from: { ...t, o: 0 }, to: t, delay: 0, dur: D.base * k, ease: EASE.settle });
      }
      plan.current = { rows: tracks, ghosts: [...carried, ...leaving(() => true, (_, v) => ({ from: v, to: { ...v, o: 0 }, delay: 0, dur: D.fast * k, ease: EASE.exit }))], h: hTrack(D.moderate * k, EASE.rerank), t: 0 };
    } else if (rel.kind === 'down' && rel.anchor && cur(rel.anchor)) {
      // FIRST: the chosen row as it is on screen. LAST: each child's slot. Invert onto the parent, play out by rank.
      const A = cur(rel.anchor)!;
      for (const [id, t] of to) {
        tracks.set(id, { from: { mean: A.mean, p10: A.p10, p90: A.p90, a: A.a, b: A.b, rank: A.rank, o: 0 }, to: t, delay: t.rank * ST.tight * scale.stagger, dur: D.moderate * k, ease: EASE.glide });
      }
      const ghosts = leaving(() => true, (r, v) => (r.id === rel.anchor
        ? { from: v, to: { ...v, o: 0 }, delay: 0, dur: D.fast * k, ease: EASE.exit }
        : { from: v, to: { ...v, o: 0, rank: v.rank + (v.rank < A.rank ? -0.4 : 0.4) }, delay: 0, dur: D.fast * k, ease: EASE.exit }));
      plan.current = { rows: tracks, ghosts: [...carried, ...ghosts], h: hTrack(D.moderate * k, EASE.glide), t: 0 };
    } else if (rel.kind === 'up' && rel.anchor && to.has(rel.anchor)) {
      // The reverse: children fold back into their parent's new slot and value; the parent level settles in around it.
      const A = to.get(rel.anchor)!;
      const ghosts = leaving(() => true, (_, v) => ({
        from: v, to: { mean: A.mean, p10: A.p10, p90: A.p90, a: A.a, b: A.b, rank: A.rank, o: 0 },
        delay: 0, dur: D.base * k, ease: EASE.settle,
      }));
      for (const [id, t] of to) {
        const d = Math.abs(t.rank - A.rank);
        tracks.set(id, id === rel.anchor
          ? { from: { ...t, o: 0 }, to: t, delay: D.instant * k, dur: D.base * k, ease: EASE.settle }
          : { from: { ...t, o: 0, rank: t.rank + (t.rank < A.rank ? 0.35 : -0.35) }, to: t, delay: (D.instant + d * ST.tight * scale.stagger) * k, dur: D.moderate * k, ease: EASE.glide });
      }
      plan.current = { rows: tracks, ghosts: [...carried, ...ghosts], h: hTrack(D.moderate * k, EASE.glide), t: 0 };
    } else {
      // An unrelated jump (Reset, a shared link, another branch): nothing to track, so cross-fade in place.
      for (const [id, t] of to) tracks.set(id, { from: { ...t, o: 0 }, to: t, delay: D.instant * k, dur: D.base * k, ease: EASE.settle });
      plan.current = { rows: tracks, ghosts: [...carried, ...leaving(() => true, (_, v) => ({ from: v, to: { ...v, o: 0 }, delay: 0, dur: D.fast * k, ease: EASE.exit }))], h: hTrack(D.base * k, EASE.settle), t: 0 };
    }
    frame(0);
    loop.current?.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, levelKey, reduced]);

  // After a level change made from this list, keep keyboard focus here: on the first row of the new level.
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const first = [...target.entries()].sort((p, q) => p[1].rank - q[1].rank)[0]?.[0];
    const btn = first ? listRef.current?.querySelector<HTMLButtonElement>(`[data-row="${CSS.escape(first)}"] button`) : null;
    btn?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey]);

  const ticks = [80, 82, 84, 86, 88, 90];
  return (
    <div className={s.dots}>
      <div className={s.dotAxis} aria-hidden="true">
        <span />
        <span className={s.dotAxisTrack}>{ticks.map((t) => <span key={t} style={{ left: pos(t) }}>{t}</span>)}</span>
        <span />
      </div>
      <ol ref={listRef} className={s.dotList} style={{ height: Math.max(0, view.h) }}>
        {rows.map((r) => {
          const v = view.vals.get(r.id) ?? target.get(r.id)!;
          const empty = compare ? !(Number.isFinite(r.a) && Number.isFinite(r.b)) : !r.n;
          const detail = empty
            ? (compare ? ': not enough lots in both groups.' : ': no lots match.')
            : compare
              ? ` points, group A minus group B (A mean ${fmt.mean(r.a)}, B mean ${fmt.mean(r.b)}).${r.drill ? ' Drill down.' : ''}`
              : ` mean score${r.n > 1 ? `; 10th to 90th percentile ${fmt.mean(r.p10)} to ${fmt.mean(r.p90)}` : ''}.${r.drill ? ' Drill down.' : ''}`;
          return (
            <li key={r.id} data-row={r.id} className={s.dotRow} style={{ transform: `translateY(${(v.rank * ROW).toFixed(1)}px)`, opacity: v.o < 0.999 ? v.o : undefined }}>
              <button type="button" className={s.dotBtn} data-drill={r.drill || undefined}
                onClick={() => { if (r.drill) refocus.current = true; onSelect(r); }}
                aria-pressed={r.drill ? undefined : !!r.pinned} disabled={empty && r.drill}>
                <RowBody r={r} v={v} compare={compare} />
                <span className={s.srOnly}>{detail}</span>
                {r.drill ? <span className={s.chev} aria-hidden="true">›</span> : <span className={s.chev} aria-hidden="true" />}
              </button>
            </li>
          );
        })}
        {view.ghosts.map(({ row, v }) => (
          <li key={`ghost:${row.id}`} className={`${s.dotRow} ${s.dotGhost}`} aria-hidden="true" style={{ transform: `translateY(${(v.rank * ROW).toFixed(1)}px)`, opacity: v.o }}>
            <div className={s.dotBtn}>
              <RowBody r={row} v={v} compare={compare} />
              <span className={s.chev}>{row.drill ? '›' : ''}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const ZERO: Vals = { mean: NaN, p10: NaN, p90: NaN, a: NaN, b: NaN, rank: 0, o: 1 };
