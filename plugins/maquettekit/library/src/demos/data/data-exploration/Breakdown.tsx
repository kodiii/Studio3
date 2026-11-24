'use client';
/**
 * Ranked dot plot for the drill-down. Rows keep their identity while filters change: values are interpolated and rows
 * glide to their new rank together (the bar-race-transition recipe's technique, effects/bar-race-transition), drawn as
 * dots and 10th–90th percentile whiskers because cup scores cluster far from zero — bars would need a zero baseline
 * and would hide every difference. Changing level swaps identities, so it cuts instead of tweening.
 */
import { useEffect, useRef, useState } from 'react';
import { easeCubicInOut } from 'd3';
import { duration as D, useStudioMotion } from '../../../motion';
import { SCORE, fmt } from './data';
import s from './styles.module.css';

export interface Row { id: string; name: string; n: number; mean: number; p10: number; p90: number; a: number; b: number; drill: boolean; pinned?: boolean }
interface Vals { mean: number; p10: number; p90: number; a: number; b: number; rank: number }
const ROW = 40;
const pos = (v: number) => `${(((Math.min(SCORE[1], Math.max(SCORE[0], v)) - SCORE[0]) / (SCORE[1] - SCORE[0])) * 100).toFixed(2)}%`;

function ranked(rows: Row[], compare: boolean): Map<string, Vals> {
  const key = (r: Row) => (compare ? (Number.isFinite(r.a) && Number.isFinite(r.b) ? r.a - r.b : -Infinity) : Number.isFinite(r.mean) ? r.mean : -Infinity);
  const order = [...rows].sort((p, q) => key(q) - key(p) || p.name.localeCompare(q.name));
  return new Map(order.map((r, i) => [r.id, { mean: r.mean, p10: r.p10, p90: r.p90, a: r.a, b: r.b, rank: i }]));
}

export function Breakdown({ rows, levelKey, compare, onSelect, noun }: { rows: Row[]; levelKey: string; compare: boolean; onSelect: (r: Row) => void; noun: string }) {
  const { reduced, scale } = useStudioMotion();
  const target = ranked(rows, compare);
  const [shown, setShown] = useState(target);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const prevLevel = useRef(levelKey);
  const sig = rows.map((r) => `${r.id}:${r.mean}:${r.a}:${r.b}`).join('|') + String(compare);

  useEffect(() => {
    const t = ranked(rows, compare);
    const levelChanged = prevLevel.current !== levelKey;
    prevLevel.current = levelKey;
    const from = shownRef.current;
    if (levelChanged || reduced || ![...t.keys()].every((k) => from.has(k))) { setShown(t); return; }
    const dur = D.moderate * scale.duration;
    let raf = 0, t0 = 0;
    const mix = (p: number, q: number, e: number) => (Number.isFinite(p) && Number.isFinite(q) ? p + (q - p) * e : q);
    const frame = (now: number) => {
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / dur);
      const e = easeCubicInOut(p);
      const next = new Map<string, Vals>();
      for (const [k, to] of t) {
        const f = from.get(k)!;
        next.set(k, { mean: mix(f.mean, to.mean, e), p10: mix(f.p10, to.p10, e), p90: mix(f.p90, to.p90, e), a: mix(f.a, to.a, e), b: mix(f.b, to.b, e), rank: f.rank + (to.rank - f.rank) * e });
      }
      setShown(next);
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, levelKey, reduced, scale.duration]);

  const ticks = [80, 82, 84, 86, 88, 90];
  return (
    <div className={s.dots}>
      <div className={s.dotAxis} aria-hidden="true">
        <span />
        <span className={s.dotAxisTrack}>{ticks.map((t) => <span key={t} style={{ left: pos(t) }}>{t}</span>)}</span>
        <span />
      </div>
      <ol className={s.dotList} style={{ height: rows.length * ROW }}>
        {rows.map((r) => {
          const v = shown.get(r.id) ?? target.get(r.id)!;
          const empty = compare ? !(Number.isFinite(r.a) && Number.isFinite(r.b)) : !r.n;
          const detail = empty
            ? (compare ? ': not enough lots in both groups.' : ': no lots match.')
            : compare
              ? ` points, group A minus group B (A mean ${fmt.mean(r.a)}, B mean ${fmt.mean(r.b)}).${r.drill ? ' Drill down.' : ''}`
              : ` mean score${r.n > 1 ? `; 10th to 90th percentile ${fmt.mean(r.p10)} to ${fmt.mean(r.p90)}` : ''}.${r.drill ? ' Drill down.' : ''}`;
          return (
            <li key={r.id} className={s.dotRow} style={{ transform: `translateY(${(v.rank * ROW).toFixed(1)}px)` }}>
              <button type="button" className={s.dotBtn} onClick={() => onSelect(r)} aria-pressed={r.drill ? undefined : !!r.pinned} disabled={empty && r.drill}>
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
                <span className={s.srOnly}>{detail}</span>
                {r.drill ? <span className={s.chev} aria-hidden="true">›</span> : <span className={s.chev} aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
