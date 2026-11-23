'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { DELIVERIES, INBOX_URL, type Delivery } from './content';
import styles from './styles.module.css';

/** Minimal JSON tokeniser for the payload view (keys, strings, numbers, punctuation). */
export function Json({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?)|(true|false|null)|([{}[\],])/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] && m[2]) out.push(<span key={k++} className={styles.jKey}>{m[1]}</span>, m[2]);
    else if (m[1]) out.push(<span key={k++} className={styles.jStr}>{m[1]}</span>);
    else if (m[3] || m[4]) out.push(<span key={k++} className={styles.jNum}>{m[3] ?? m[4]}</span>);
    else out.push(<span key={k++} className={styles.jPunct}>{m[5]}</span>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

export function StatusChip({ status }: { status: number }) {
  const ok = status < 400;
  return <span className={styles.status} data-ok={ok}>{status}<span className={styles.srOnly}>{ok ? ' OK' : ' error'}</span></span>;
}

interface Attempt { status: number; ms: number; label: string }

export function Inbox({ reduced }: { reduced: boolean }) {
  const uid = useId();
  const [selected, setSelected] = useState<Delivery>(DELIVERIES[0]);
  const [attempts, setAttempts] = useState<Record<string, Attempt[]>>({});
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const list = attempts[selected.id] ?? [];
  const fixed = list.some((a) => a.status < 400);
  const replay = () => {
    if (busy) return;
    setBusy(true);
    setSaid('Replaying to localhost:3000…');
    timer.current = window.setTimeout(() => {
      const a: Attempt = { status: 200, ms: 84, label: 'Replay to localhost:3000' };
      setAttempts((m) => ({ ...m, [selected.id]: [...(m[selected.id] ?? []), a] }));
      setBusy(false);
      setSaid(`Replay finished: 200 OK in ${a.ms} milliseconds (simulated).`);
    }, reduced ? 350 : 900);
  };

  return (
    <div className={styles.window} role="group" aria-label="Tarn inbox, sample data">
      <div className={styles.winBar}>
        <span className={styles.winDots} aria-hidden="true"><i /><i /><i /></span>
        <span className={styles.winTitle}>payments</span>
        <span className={styles.winUrl}>{INBOX_URL}</span>
        <span className={styles.sampleTag}>Sample data</span>
      </div>
      <div className={styles.winBody}>
        <ul className={styles.deliveries} aria-label="Deliveries">
          {DELIVERIES.map((d) => {
            const st = (attempts[d.id] ?? []).at(-1)?.status ?? d.status;
            return (
              <li key={d.id}>
                <button type="button" className={styles.delivery} aria-pressed={selected.id === d.id} onClick={() => setSelected(d)}>
                  <StatusChip status={st} />
                  <span className={styles.dEvent}>{d.event}</span>
                  <span className={styles.dMeta}>{d.source} · {d.at}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className={styles.detail}>
          <p className={styles.reqLine}><span className={styles.method}>POST</span> /hooks/{selected.source} <span className={styles.dimText}>· {selected.id}</span></p>
          <p className={styles.respLine}>
            <StatusChip status={selected.status} /> <span>{selected.status >= 400 ? 'Your endpoint answered 500: TypeError, lines.map is not a function' : `Delivered in ${selected.ms} ms`}</span>
          </p>
          <pre className={styles.code}><code><Json text={selected.body} /></code></pre>
          {list.length ? (
            <ol className={styles.attempts} aria-label="Replays">
              {list.map((a, i) => <li key={i}><StatusChip status={a.status} /> {a.label} · {a.ms} ms <span className={styles.dimText}>(simulated)</span></li>)}
            </ol>
          ) : null}
          <div className={styles.replayRow}>
            <button type="button" className={styles.replayBtn} onClick={replay} aria-busy={busy || undefined} aria-describedby={`${uid}said`}>
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" /><path d="M2.5 2.5v3h3" /></svg>
              {busy ? 'Replaying…' : fixed ? 'Replay again' : 'Replay to localhost:3000'}
            </button>
            <p id={`${uid}said`} className={styles.said} role="status">{said || (selected.status >= 400 ? 'Fixed the bug? Replay the exact delivery that failed.' : 'Replay any delivery, as many times as you need.')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
