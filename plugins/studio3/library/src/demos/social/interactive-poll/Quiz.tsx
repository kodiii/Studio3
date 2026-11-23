'use client';
/**
 * Quiz variant: one question at a time, no timer. "Check answer" turns into "Next question" on the same button,
 * so keyboard focus never jumps; feedback is words plus a mark (never colour alone) and is announced politely.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { QUIZ } from './data';
import styles from './styles.module.css';

export function Quiz() {
  const uid = useId();
  const [qi, setQi] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [hint, setHint] = useState('');
  const firstRadio = useRef<HTMLInputElement>(null);
  const doneHead = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const q = QUIZ[qi];

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    if (done) doneHead.current?.focus(); else firstRadio.current?.focus();
  }, [qi, done]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!checked) {
      if (choice === null) { setHint('Choose an answer first.'); return; }
      setHint('');
      setChecked(true);
      if (choice === q.answer) setScore((s) => s + 1);
      return;
    }
    moved.current = true;
    if (qi + 1 >= QUIZ.length) { setDone(true); return; }
    setQi(qi + 1); setChoice(null); setChecked(false);
  };
  const restart = () => { moved.current = true; setQi(0); setChoice(null); setChecked(false); setScore(0); setDone(false); };

  if (done) {
    return (
      <div className={styles.poll}>
        <h4 ref={doneHead} tabIndex={-1} className={styles.question}>You got {score} of {QUIZ.length}</h4>
        <p className={styles.small}>{score === QUIZ.length ? 'Full marks — you have clearly been listening.' : 'Every answer was on this week’s show; the archive has the episodes.'} Nothing is scored or stored.</p>
        <button type="button" className={styles.ghost} onClick={restart}>Try again</button>
      </div>
    );
  }

  const right = checked && choice === q.answer;
  return (
    <form className={styles.poll} onSubmit={submit} noValidate>
      <fieldset className={styles.fieldset}>
        <legend className={styles.question}><span className={styles.qNo}>{qi + 1}/{QUIZ.length}</span> {q.q}</legend>
        <div className={styles.options}>
          {q.options.map((o, i) => (
            <label key={o} className={styles.option} data-answer={checked && i === q.answer ? 'right' : checked && i === choice ? 'wrong' : undefined}>
              <input ref={i === 0 ? firstRadio : undefined} type="radio" name={`${uid}-q${qi}`} checked={choice === i} aria-describedby={checked ? `${uid}-fb` : undefined}
                onChange={() => { if (checked) return; setChoice(i); setHint(''); }} />
              <span>{o}</span>
              {checked && i === q.answer ? <span className={styles.tag}>Answer</span> : null}
              {checked && i === choice && i !== q.answer ? <span className={styles.tag}>Your answer</span> : null}
            </label>
          ))}
        </div>
      </fieldset>
      <div id={`${uid}-fb`} className={styles.feedback} role="status" aria-live="polite">
        {checked ? (
          <p className={styles.feedbackText} data-right={right || undefined}>
            <span className={styles.feedbackMark} aria-hidden="true">{right ? '✓' : '✕'}</span>
            <strong>{right ? 'Correct.' : 'Not quite.'}</strong> {q.explain}
          </p>
        ) : hint ? <p className={styles.small}>{hint}</p> : null}
      </div>
      <div className={styles.actions}>
        <button type="submit" className={styles.primary}>{checked ? (qi + 1 >= QUIZ.length ? 'See my score' : 'Next question') : 'Check answer'}</button>
        <p className={styles.small}>Score so far: {score}</p>
      </div>
    </form>
  );
}
