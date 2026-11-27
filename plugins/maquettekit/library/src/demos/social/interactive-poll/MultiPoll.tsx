'use client';
/**
 * Multiple-choice poll. Results stay hidden until you vote (the promise is stated up front), then show as
 * meter bars on one shared scale. Percentages are "of respondents", so they do not add up to 100 — said in words.
 * After voting, simulated live votes arrive about every 1.4 s: clearly labelled, pausable, finite (40 votes),
 * and paused from the start under reduced motion.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useStudioMotion } from '../../../motion';
import { CLOSES, SLOTS, SLOT_BASE, SLOT_ODDS, SLOT_RESPONDENTS, type SlotId } from './data';
import styles from './styles.module.css';

const LIVE_MS = 1400;
const LIVE_CAP = 40;
const LEDS = 24;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function MultiPoll() {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const [picks, setPicks] = useState<Set<SlotId>>(new Set());
  const [voted, setVoted] = useState<Set<SlotId> | null>(null);
  const [counts, setCounts] = useState<Record<SlotId, number>>({ ...SLOT_BASE });
  const [people, setPeople] = useState(SLOT_RESPONDENTS);
  const [added, setAdded] = useState(0);
  const [live, setLive] = useState<'running' | 'paused' | 'done'>('paused');
  const [hint, setHint] = useState('');
  const [say, setSay] = useState('');
  const random = useRef(rng(97));
  const addedRef = useRef(0);
  const resultsHead = useRef<HTMLHeadingElement>(null);
  const firstBox = useRef<HTMLInputElement>(null);
  const focusTo = useRef<'results' | 'form' | null>(null);

  useEffect(() => {
    const to = focusTo.current;
    focusTo.current = null;
    if (to === 'results') resultsHead.current?.focus();
    if (to === 'form') firstBox.current?.focus();
  }, [voted]);

  useEffect(() => {
    if (live !== 'running') return;
    const t = setInterval(() => {
      const r = random.current;
      const ticked = SLOTS.filter((s) => r() < SLOT_ODDS[s.id]).map((s) => s.id);
      const pick = ticked.length ? ticked : [SLOTS[1].id];
      setCounts((c) => { const n = { ...c }; for (const id of pick) n[id] += 1; return n; });
      setPeople((p) => p + 1);
      addedRef.current += 1;
      setAdded(addedRef.current);
      if (addedRef.current >= LIVE_CAP) setLive('done');
    }, LIVE_MS);
    return () => clearInterval(t);
  }, [live]);

  const toggle = (id: SlotId) => setPicks((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!picks.size) { setHint('Tick at least one slot, then vote.'); return; }
    setHint('');
    const next = { ...counts };
    for (const id of picks) next[id] += 1;
    const total = people + 1;
    setCounts(next);
    setPeople(total);
    setVoted(new Set(picks));
    setLive(added >= LIVE_CAP ? 'done' : reduced ? 'paused' : 'running');
    setSay(`Vote counted. ${SLOTS.map((s) => `${s.label}: ${Math.round((next[s.id] / total) * 100)}%${picks.has(s.id) ? ', your pick' : ''}`).join('. ')}.`);
    focusTo.current = 'results';
  };
  const change = () => {
    if (!voted) return;
    setCounts((c) => { const n = { ...c }; for (const id of voted) n[id] -= 1; return n; });
    setPeople((p) => p - 1);
    setLive((l) => (l === 'done' ? l : 'paused'));
    setVoted(null);
    setSay('');
    focusTo.current = 'form';
  };

  const max = Math.max(...SLOTS.map((s) => counts[s.id] / people));
  return (
    <div className={styles.poll}>
      {voted ? (
        <div>
          <h4 ref={resultsHead} tabIndex={-1} className={styles.question}>Which parts of the morning do you listen to?</h4>
          <ul className={styles.meters}>
            {SLOTS.map((s) => {
              const share = counts[s.id] / people;
              const lit = Math.round((share / Math.max(max, 0.0001)) * LEDS * 0.92);
              return (
                <li key={s.id} className={styles.meterRow}>
                  <span className={styles.meterLabel}>
                    {s.label}
                    {voted.has(s.id) ? <span className={styles.tag}>Your pick</span> : null}
                  </span>
                  <span className={styles.meterValue}>{Math.round(share * 100)}% <span className={styles.muted}>({counts[s.id].toLocaleString('en-GB')})</span></span>
                  <span className={styles.meter} aria-hidden="true">
                    {Array.from({ length: LEDS }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} data-on={i < lit || undefined} data-peak={(i < lit && i >= LEDS - 3) || undefined} />)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={styles.small}>
            {people.toLocaleString('en-GB')} listeners answered (sample data). You could pick more than one slot, so the percentages don’t add up to 100.
          </p>
          <div className={styles.liveRow}>
            <p className={styles.liveText}>
              <span className={styles.liveDot} data-on={live === 'running' || undefined} aria-hidden="true" />
              Simulated live votes, generated in your browser — not real listeners: +{added}
              {live === 'done' ? ' · simulation finished' : live === 'paused' ? ' · paused' : ''}
            </p>
            {live === 'done' ? null : (
              <button type="button" className={styles.ghost} aria-pressed={live === 'paused'} onClick={() => setLive((l) => (l === 'running' ? 'paused' : 'running'))}>
                {live === 'running' ? 'Pause live votes' : 'Resume live votes'}
              </button>
            )}
          </div>
          <button type="button" className={styles.ghost} onClick={change}>Change my answer</button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <fieldset className={styles.fieldset} aria-describedby={`${uid}-rules`}>
            <legend className={styles.question}>Which parts of the morning do you listen to?</legend>
            <p id={`${uid}-rules`} className={styles.small}>Pick as many as you like. Results appear after you vote; the poll closes {CLOSES.text}.</p>
            <div className={styles.options}>
              {SLOTS.map((s, i) => (
                <label key={s.id} className={styles.option}>
                  <input ref={i === 0 ? firstBox : undefined} type="checkbox" checked={picks.has(s.id)} onChange={() => { toggle(s.id); setHint(''); }} />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className={styles.actions}>
            <button type="submit" className={styles.primary}>Vote</button>
            <p className={styles.small} role="status">{hint || `${SLOT_RESPONDENTS.toLocaleString('en-GB')} listeners so far · sample data`}</p>
          </div>
        </form>
      )}
      <p className="mk-sr-only" role="status">{say}</p>
    </div>
  );
}
