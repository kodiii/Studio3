'use client';
/**
 * Ranking poll: the drag-reorder-list recipe is the ballot (pointer drag on the handle, or Space + arrows + Space;
 * Esc cancels). The recipe has no onChange, so "Send my order" reads the order it rendered — the titles are known
 * sample data — and adds it to the sample ballots. Results: average position per segment, yours alongside.
 */
import { useId, useRef, useState } from 'react';
import DragReorderList from '../../../effects/drag-reorder-list';
import { meta as reorderMeta } from '../../../effects/drag-reorder-list/meta';
import type { EffectMeta, ParamValues } from '../../../types';
import { RUNNING, RUNNING_BALLOTS } from './data';
import styles from './styles.module.css';

const defaults = (m: EffectMeta): ParamValues => Object.fromEntries(m.params.map((p) => [p.key, p.default]));
type Result = { id: string; title: string; avg: number; yours: number };

function readBallot(root: HTMLElement | null): string[] | null {
  const rows = root ? Array.from(root.querySelectorAll('ol > li')) : [];
  const ids = rows.map((li) => RUNNING.find((r) => (li.textContent ?? '').includes(r.title))?.id).filter((x): x is (typeof RUNNING)[number]['id'] => !!x);
  return ids.length === RUNNING.length && new Set(ids).size === RUNNING.length ? ids : null;
}

export function Ranking() {
  const uid = useId();
  const ballot = useRef<HTMLDivElement>(null);
  const resultsHead = useRef<HTMLHeadingElement>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState('');

  const send = () => {
    const order = readBallot(ballot.current);
    if (!order) { setError('Your order could not be read. Nothing was sent; please try again.'); return; }
    setError('');
    const n = RUNNING_BALLOTS;
    const next = RUNNING.map((r) => {
      const yours = order.indexOf(r.id) + 1;
      return { id: r.id, title: r.title, yours, avg: (r.avg * n + yours) / (n + 1) };
    }).sort((a, b) => a.avg - b.avg);
    setResults(next);
    requestAnimationFrame(() => resultsHead.current?.focus());
  };

  return (
    <div className={styles.ranking}>
      <div ref={ballot} className={styles.ballot}>
        <DragReorderList params={{ ...defaults(reorderMeta), lift: 1.03, spring: 'settle', dragFrom: 'handle', times: true, density: 'compact' }} />
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={send}>{results ? 'Send my new order' : 'Send my order'}</button>
        <p className={styles.small}>You can send again after changing it; only your latest order counts.</p>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {results ? (
        <section className={styles.rankResults} aria-labelledby={`${uid}-rr`}>
          <h4 id={`${uid}-rr`} ref={resultsHead} tabIndex={-1} className={styles.question}>Listeners’ running order</h4>
          <p className={styles.small}>{(RUNNING_BALLOTS + 1).toLocaleString('en-GB')} ballots: {RUNNING_BALLOTS} sample ballots plus yours. Lower average = earlier in the show.</p>
          <ol className={styles.rankList}>
            {results.map((r, i) => (
              <li key={r.id}>
                <span className={styles.rankPos} aria-hidden="true">{i + 1}</span>
                <span className={styles.rankTitle}>{r.title}</span>
                <span className={styles.rankAvg}>avg {r.avg.toFixed(1)}</span>
                <span className={styles.rankYours} data-same={r.yours === i + 1 || undefined}>yours {r.yours}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
