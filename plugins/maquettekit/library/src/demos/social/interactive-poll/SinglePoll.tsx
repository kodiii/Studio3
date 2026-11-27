'use client';
/**
 * Single-choice poll — the poll-result-bars technique rebuilt flat inside the station's cue card (the recipe draws its
 * own card, which nested a card in a card). Option rows turn into result bars in place: each fill slides out to its
 * share on the heavy `glide` spring, staggered, while its percentage counts up with the bar's own progress.
 * Shares use the largest-remainder method so they always add up to 100; the person's pick keeps its row and gains
 * "Your vote" in words; the result is announced once; "Change vote" returns focus to the checked radio.
 * Reduced motion: bars appear at their final width with a 160 ms fade and the numbers are shown at once.
 */
import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { spring, springToLinear, stagger as ST, useIsomorphicLayoutEffect, useRafLoop, useStudioMotion } from '../../../motion';
import styles from './styles.module.css';

const QUESTION = 'Where do you read best on a rainy Sunday?';
const OPTIONS = ['Window seat', 'Library corner', 'Corner café', 'Sofa, under a blanket'] as const;
const BASE = [412, 298, 175, 384];
const GLIDE = springToLinear(spring.glide);

/** Whole-number shares that always add up to 100 (largest remainder). */
function shares(votes: number[]): number[] {
  const total = votes.reduce((a, b) => a + b, 0) || 1;
  const raw = votes.map((v) => (v / total) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f).forEach(({ i }) => { if (left > 0) { out[i]++; left--; } });
  return out;
}

export function SinglePoll() {
  const { reduced, scale } = useStudioMotion();
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [voted, setVoted] = useState<number | null>(null);
  const [hint, setHint] = useState('');
  const [say, setSay] = useState('');
  const [counting, setCounting] = useState(false);
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const counts = useRef<(HTMLSpanElement | null)[]>([]);
  const anims = useRef<Animation[]>([]);
  const changeRef = useRef<HTMLButtonElement>(null);
  const backToRadio = useRef(false);

  const votes = useMemo(() => BASE.map((v, i) => v + (i === voted ? 1 : 0)), [voted]);
  const pct = useMemo(() => shares(votes), [votes]);
  const total = votes.reduce((a, b) => a + b, 0);
  const leader = pct.indexOf(Math.max(...pct));

  useIsomorphicLayoutEffect(() => {
    if (voted === null) {
      if (backToRadio.current) {
        backToRadio.current = false;
        (root.current?.querySelector<HTMLInputElement>('input:checked') ?? root.current?.querySelector<HTMLInputElement>('input'))?.focus();
      }
      return;
    }
    const list: Animation[] = [];
    fills.current.forEach((el, i) => {
      if (!el || typeof el.animate !== 'function') return;
      list.push(reduced
        ? el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear', fill: 'backwards' })
        : el.animate([{ transform: 'translateX(-100%)' }, { transform: `translateX(${pct[i] - 100}%)` }], {
          duration: GLIDE.duration * scale.duration, delay: i * ST.loose * scale.stagger, easing: GLIDE.easing, fill: 'backwards',
        }));
    });
    anims.current = list;
    if (!reduced) counts.current.forEach((el) => { if (el) el.textContent = '0%'; });
    setCounting(!reduced);
    changeRef.current?.focus();
    return () => { list.forEach((a) => a.cancel()); anims.current = []; };
  }, [voted]); // eslint-disable-line react-hooks/exhaustive-deps

  useRafLoop(root, () => {
    let running = false;
    anims.current.forEach((a, i) => {
      const el = counts.current[i];
      if (!el) return;
      const p = a.effect?.getComputedTiming().progress;
      const done = a.playState === 'finished' || p === null || p === undefined;
      if (!done) running = true;
      el.textContent = `${done ? pct[i] : Math.max(0, Math.min(pct[i], Math.round((p as number) * pct[i])))}%`;
    });
    if (!running) setCounting(false);
  }, counting);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (choice === null) { setHint('Choose one place, then vote.'); return; }
    setHint('');
    const s = shares(BASE.map((v, i) => v + (i === choice ? 1 : 0)));
    setSay(`Vote counted. Results: ${OPTIONS.map((o, i) => `${o} ${s[i]}%${i === choice ? ' (your vote)' : ''}`).join(', ')}.`);
    setVoted(choice);
  };
  const change = () => { backToRadio.current = true; setSay(''); setVoted(null); };

  return (
    <div ref={root} className={styles.poll}>
      {voted === null ? (
        <form onSubmit={submit} noValidate>
          <fieldset className={styles.fieldset} aria-describedby={`${uid}-rules`}>
            <legend className={styles.question}>{QUESTION}</legend>
            <p id={`${uid}-rules`} className={styles.small}>One answer. Results appear after you vote, and you can change it while the poll is open.</p>
            <div className={styles.options}>
              {OPTIONS.map((o, i) => (
                <label key={o} className={styles.option}>
                  <input type="radio" name={`${uid}-poll`} checked={choice === i} onChange={() => { setChoice(i); setHint(''); }} />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className={styles.actions}>
            <button type="submit" className={styles.primary}>Vote</button>
            <p className={styles.small} role="status">{hint || `${total.toLocaleString('en-GB')} votes so far · sample data`}</p>
          </div>
        </form>
      ) : (
        <div>
          <h4 className={styles.question}>{QUESTION}</h4>
          <ul className={styles.bars} aria-label="Results">
            {OPTIONS.map((o, i) => (
              <li key={o} className={styles.barRow} data-mine={i === voted || undefined}>
                <span className={styles.barTrack} aria-hidden="true">
                  <span ref={(el) => { fills.current[i] = el; }} className={styles.barFill} style={{ transform: `translateX(${pct[i] - 100}%)` }} />
                </span>
                <span className={styles.barName}>
                  {o}
                  {i === voted ? <span className={styles.tag}>Your vote</span> : null}
                  {i === leader ? <span className={styles.tag}>Leading</span> : null}
                </span>
                <span ref={(el) => { counts.current[i] = el; }} className={styles.barPct}>{pct[i]}%</span>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <button ref={changeRef} type="button" className={styles.ghost} onClick={change}>Change vote</button>
            <p className={styles.small}>{total.toLocaleString('en-GB')} votes · sample data</p>
          </div>
        </div>
      )}
      <p className="mk-sr-only" role="status">{say}</p>
    </div>
  );
}
