'use client';
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { cssEase, useIsomorphicLayoutEffect, useRafLoop, useStudioMotion, type EasingToken } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { duration: number; stagger: number; easing: string; highlight: string; countUp: boolean };

/** Sample data: a fictional poll with fixed starting tallies. */
const QUESTION = 'Where do you read best on a rainy Sunday?';
const OPTIONS = ['Window seat', 'Library corner', 'Corner café', 'Sofa, under a blanket'] as const;
const BASE = [412, 298, 175, 384];
const EASINGS: readonly EasingToken[] = ['emphasized', 'standard', 'inOut', 'overshoot'];

/** Whole-number shares that always add up to 100 (largest remainder). */
function shares(votes: number[]): number[] {
  const total = votes.reduce((a, b) => a + b, 0) || 1;
  const raw = votes.map((v) => (v / total) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f).forEach(({ i }) => { if (left > 0) { out[i]++; left--; } });
  return out;
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="m3.5 8.5 3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PollResultBars({ params }: EffectProps<Params>) {
  const { reduced, scale } = useStudioMotion();
  const uid = useId();
  const [choice, setChoice] = useState<number | null>(null);
  const [voted, setVoted] = useState<number | null>(null);
  const [hint, setHint] = useState('');
  const [counting, setCounting] = useState(false);
  const [announce, setAnnounce] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const counts = useRef<(HTMLSpanElement | null)[]>([]);
  const anims = useRef<Animation[]>([]);
  const changeRef = useRef<HTMLButtonElement>(null);
  const focusRadio = useRef(false);

  const votes = useMemo(() => BASE.map((v, i) => v + (i === voted ? 1 : 0)), [voted]);
  const pct = useMemo(() => shares(votes), [votes]);
  const total = votes.reduce((a, b) => a + b, 0);
  const leader = pct.indexOf(Math.max(...pct));
  const showResults = voted !== null;

  // Results enter: every fill slides from empty to its share; labels count with the bar's own eased progress.
  useIsomorphicLayoutEffect(() => {
    if (voted === null) return;
    const list: Animation[] = [];
    const ease = cssEase(EASINGS.includes(params.easing as EasingToken) ? (params.easing as EasingToken) : 'emphasized');
    fills.current.forEach((el, i) => {
      if (!el || typeof el.animate !== 'function') return;
      if (reduced) {
        list.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear', fill: 'backwards' }));
        return;
      }
      const end = `translateX(${pct[i] - 100}%)`;
      list.push(el.animate([{ transform: 'translateX(-100%)' }, { transform: end }], {
        duration: params.duration * scale.duration,
        delay: i * params.stagger * scale.stagger,
        easing: ease,
        fill: 'backwards',
      }));
    });
    anims.current = list;
    const doCount = params.countUp && !reduced;
    if (doCount) counts.current.forEach((el) => { if (el) el.textContent = '0%'; });
    setCounting(doCount);
    if (changeRef.current) changeRef.current.focus();
    return () => { for (const a of list) a.cancel(); anims.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voted]);

  useRafLoop(rootRef, () => {
    let running = false;
    anims.current.forEach((a, i) => {
      const el = counts.current[i];
      if (!el) return;
      const p = a.effect?.getComputedTiming().progress;
      const done = a.playState === 'finished' || p === null || p === undefined;
      if (!done) running = true;
      const v = done ? pct[i] : Math.max(0, Math.min(pct[i], Math.round((p as number) * pct[i])));
      el.textContent = `${v}%`;
    });
    if (!running) setCounting(false);
  }, counting);

  // After "Change vote", return focus to the checked radio.
  useIsomorphicLayoutEffect(() => {
    if (voted !== null || !focusRadio.current) return;
    focusRadio.current = false;
    const root = rootRef.current;
    (root?.querySelector<HTMLInputElement>('input[type="radio"]:checked') ?? root?.querySelector<HTMLInputElement>('input[type="radio"]'))?.focus();
  }, [voted]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (choice === null) { setHint('Choose one option, then vote.'); return; }
    setHint('');
    const next = BASE.map((v, i) => v + (i === choice ? 1 : 0));
    const s = shares(next);
    setAnnounce(`Vote counted. Results: ${OPTIONS.map((o, i) => `${o} ${s[i]}%${i === choice ? ' (your vote)' : ''}`).join(', ')}.`);
    setVoted(choice);
  };
  const change = () => { focusRadio.current = true; setAnnounce(''); setVoted(null); };

  const accent = (i: number) => (params.highlight === 'choice' && i === voted) || (params.highlight === 'leader' && i === leader);

  return (
    <div ref={rootRef} className={styles.root} data-reduced={reduced || undefined}>
      <section className={styles.card} aria-labelledby={`${uid}q`}>
        <p className={styles.kicker}><span>Community poll</span><span>Sample data</span></p>
        {!showResults ? (
          <form onSubmit={submit} className={styles.form} noValidate>
            <fieldset className={styles.fieldset}>
              <legend id={`${uid}q`} className={styles.question}>{QUESTION}</legend>
              <div className={styles.rows}>
                {OPTIONS.map((o, i) => (
                  <label key={o} className={styles.row} data-checked={choice === i || undefined}>
                    <input
                      type="radio"
                      className={styles.radio}
                      name={`${uid}poll`}
                      value={i}
                      checked={choice === i}
                      onChange={() => { setChoice(i); setHint(''); }}
                    />
                    <span className={styles.name}>{o}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className={styles.actions}>
              <button type="submit" className={styles.primary}>Vote</button>
              <p className={styles.hint} role="status">{hint || `${(total).toLocaleString('en-US')} votes so far · sample data`}</p>
            </div>
          </form>
        ) : (
          <div className={styles.form}>
            <h3 id={`${uid}q`} className={styles.question}>{QUESTION}</h3>
            <ul className={styles.rows} aria-label="Results">
              {OPTIONS.map((o, i) => (
                <li key={o} className={styles.row} data-result="" data-accent={accent(i) || undefined}>
                  <span className={styles.track} aria-hidden="true">
                    <span ref={(el) => { fills.current[i] = el; }} className={styles.fill} style={{ transform: `translateX(${pct[i] - 100}%)` }} />
                  </span>
                  <span className={styles.mark} aria-hidden="true">{i === voted ? <Check /> : null}</span>
                  <span className={styles.name}>
                    {o}
                    {i === voted ? <span className={styles.tag}>Your vote</span> : null}
                    {i === leader ? <span className={styles.tag}>Leading</span> : null}
                  </span>
                  <span ref={(el) => { counts.current[i] = el; }} className={styles.pct}>{pct[i]}%</span>
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              <button ref={changeRef} type="button" className={styles.secondary} onClick={change}>Change vote</button>
              <p className={styles.hint}>{total.toLocaleString('en-US')} votes · sample data</p>
            </div>
          </div>
        )}
        <p className={styles.srOnly} role="status">{announce}</p>
      </section>
    </div>
  );
}
