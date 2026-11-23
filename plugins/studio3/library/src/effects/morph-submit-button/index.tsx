'use client';
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { cssEase, duration as D, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { outcome: string; latency: number; morph: number; shake: boolean; label: string };
type Phase = 'idle' | 'sending' | 'success' | 'done' | 'failed' | 'retry';
type Status = { tone: 'info' | 'success' | 'error'; text: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Phases in which the button must not submit again. */
const LOCKED: readonly Phase[] = ['sending', 'success', 'failed', 'done'];
const HOLD = 950; // ms the round result stays on screen before reopening

const MESSAGES = {
  invalid: 'Enter an email address, like name@example.org.',
  sending: 'Sending…',
  success: 'You are on the list. This is a demo, so nothing was sent.',
  error: 'That did not go through: the simulated server did not answer. Try again.',
};

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="m3.5 8.5 3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MorphSubmitButton({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const [phase, setPhase] = useState<Phase>('idle');
  const [email, setEmail] = useState('mara@example.org');
  const [invalid, setInvalid] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [attempt, setAttempt] = useState(0);

  const slotRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<SVGSVGElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const checkRef = useRef<SVGPathElement>(null);
  const bangRef = useRef<SVGGElement>(null);

  // Everything asynchronous is owned here so reset / resubmit / unmount can stop it in one call.
  const run = useRef(0);
  const live = useRef(new Set<Animation>());
  const timers = useRef(new Set<number>());
  const slots = useRef<{ morph?: Animation; label?: Animation; arc?: Animation }>({});

  const stopAll = () => {
    for (const a of live.current) a.cancel();
    live.current.clear();
    for (const t of timers.current) window.clearTimeout(t);
    timers.current.clear();
    slots.current = {};
  };
  useEffect(() => {
    const anims = live.current;
    const pending = timers.current;
    return () => {
      run.current++;
      for (const a of anims) a.cancel();
      for (const t of pending) window.clearTimeout(t);
    };
  }, []);

  const track = (a: Animation): Animation => {
    live.current.add(a);
    const done = () => { live.current.delete(a); };
    a.finished.then(done, done);
    return a;
  };
  const animate = (el: Element | null, keyframes: Keyframe[], opts: KeyframeAnimationOptions): Animation | null =>
    el && typeof el.animate === 'function' ? track(el.animate(keyframes, opts)) : null;
  const wait = (ms: number) => new Promise<void>((resolve) => {
    const t = window.setTimeout(() => { timers.current.delete(t); resolve(); }, ms);
    timers.current.add(t);
  });

  /** Width morph that always starts from the width currently on screen. */
  const morphTo = (shape: 'circle' | 'pill', fromWidth?: number): Promise<boolean> => {
    const btn = btnRef.current;
    const slot = slotRef.current;
    if (!btn || !slot) return Promise.resolve(false);
    const box = btn.getBoundingClientRect();
    const from = fromWidth ?? box.width;
    const to = shape === 'circle' ? box.height : slot.getBoundingClientRect().width;
    slots.current.morph?.cancel();
    const a = animate(btn, [{ width: `${from}px` }, { width: `${to}px` }], { duration: params.morph, easing: cssEase('emphasized'), fill: 'forwards' });
    if (!a) return Promise.resolve(false);
    slots.current.morph = a;
    return a.finished.then(() => {
      // Back at full width: hand control back to CSS (width: 100%) so the slot can resize freely.
      if (shape === 'pill' && slots.current.morph === a) { a.cancel(); slots.current.morph = undefined; }
      return true;
    }, () => false);
  };

  const fadeLabel = (to: 0 | 1, delay = 0, fromOpacity?: number) => {
    const el = labelRef.current;
    if (!el) return;
    const from = fromOpacity ?? Number(getComputedStyle(el).opacity);
    slots.current.label?.cancel();
    slots.current.label = animate(el, [
      { opacity: from, transform: `translateY(${to ? 6 : 0}px)` },
      { opacity: to, transform: `translateY(${to ? 0 : -6}px)` },
    ], { duration: to ? D.base : D.fast, delay, easing: cssEase(to ? 'emphasized' : 'exit'), fill: 'both' }) ?? undefined;
  };

  const drawMark = (el: Element | null, delay: number) => animate(el, [{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], { duration: D.moderate, delay, easing: cssEase('emphasized'), fill: 'both' });
  const hide = (el: Element | null, ms: number = D.fast) => {
    if (!el) return;
    const from = Number(getComputedStyle(el).opacity);
    animate(el, [{ opacity: from }, { opacity: 0 }], { duration: ms, easing: 'linear', fill: 'forwards' });
  };

  const submit = async () => {
    if (LOCKED.includes(phase)) return;
    if (!EMAIL.test(email.trim())) {
      setInvalid(true);
      setStatus({ tone: 'error', text: MESSAGES.invalid });
      return;
    }
    const my = ++run.current;
    const ok = params.outcome === 'success' ? true : params.outcome === 'error' ? false : attempt % 2 === 0;
    // Capture what is on screen before cancelling, so a resubmit mid-reopen continues smoothly.
    const fromWidth = btnRef.current?.getBoundingClientRect().width;
    const fromOpacity = labelRef.current ? Number(getComputedStyle(labelRef.current).opacity) : 1;
    setAttempt((n) => n + 1);
    setInvalid(false);
    stopAll();
    setPhase('sending');
    setStatus({ tone: 'info', text: MESSAGES.sending });

    if (reduced) {
      await wait(params.latency);
      if (my !== run.current) return;
      setPhase(ok ? 'done' : 'retry');
      setStatus(ok ? { tone: 'success', text: MESSAGES.success } : { tone: 'error', text: MESSAGES.error });
      return;
    }

    // 1 · collapse to a circle, then grow the arc on a decelerating curve that never completes by itself.
    fadeLabel(0, 0, fromOpacity);
    void morphTo('circle', fromWidth);
    const ringDelay = params.morph * 0.55;
    animate(ringRef.current, [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: D.base, delay: ringDelay, easing: cssEase('emphasized'), fill: 'both' });
    slots.current.arc = animate(arcRef.current, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0.08 }], { duration: params.latency * 1.4, delay: ringDelay, easing: cssEase('enter'), fill: 'both' }) ?? undefined;

    await wait(params.latency);
    if (my !== run.current) return;

    const arc = arcRef.current;
    const at = arc ? parseFloat(getComputedStyle(arc).strokeDashoffset) || 0 : 0;
    slots.current.arc?.cancel();
    if (ok) {
      // 2a · close the ring, flood the circle, draw the check; then reopen as a success pill.
      animate(arc, [{ strokeDashoffset: at }, { strokeDashoffset: 0 }], { duration: D.fast, easing: cssEase('standard'), fill: 'forwards' });
      await wait(D.fast);
      if (my !== run.current) return;
      setPhase('success');
      setStatus({ tone: 'success', text: MESSAGES.success });
      hide(ringRef.current, D.base);
      drawMark(checkRef.current, 90);
      await wait(HOLD);
      if (my !== run.current) return;
      setPhase('done');
      hide(checkRef.current);
      void morphTo('pill');
      fadeLabel(1, params.morph * 0.4);
    } else {
      // 2b · freeze the arc, turn the circle to the error colour, draw "!" and shake (≤ 3 oscillations).
      animate(arc, [{ strokeDashoffset: at }, { strokeDashoffset: at }], { duration: 1, fill: 'forwards' });
      setPhase('failed');
      setStatus({ tone: 'error', text: MESSAGES.error });
      hide(ringRef.current, D.base);
      drawMark(bangRef.current, 60);
      if (params.shake) {
        animate(btnRef.current, [
          { transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' },
          { transform: 'translateX(-3px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' },
        ], { duration: 460, delay: 60, easing: 'ease-out' });
      }
      await wait(HOLD + 150);
      if (my !== run.current) return;
      setPhase('retry');
      hide(bangRef.current);
      void morphTo('pill');
      fadeLabel(1, params.morph * 0.4);
    }
  };

  const reset = () => {
    run.current++;
    stopAll();
    setPhase('idle');
    setStatus(null);
    setInvalid(false);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); void submit(); };

  const label = params.label.trim() || 'Join waitlist';
  const labels: Record<Phase, string> = { idle: label, sending: 'Sending…', success: 'Joined', done: 'On the list', failed: 'Not sent', retry: 'Try again' };
  const locked = LOCKED.includes(phase);
  const nextOutcome = params.outcome === 'alternate' ? (attempt % 2 === 0 ? 'success' : 'error') : params.outcome;

  return (
    <div className={styles.root} data-reduced={reduced || undefined} style={{ '--morph': `${params.morph}ms` } as CSSProperties}>
      <section className={styles.card} aria-labelledby={`${uid}title`}>
        <p className={styles.kicker}><span>Waitlist · fictional app</span><span>Sample form</span></p>
        <h3 id={`${uid}title`} className={styles.title}>Fernhouse is almost ready.</h3>
        <p className={styles.dek}>One email when the beta opens. Nothing else, ever.</p>

        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <label htmlFor={`${uid}email`} className={styles.fieldLabel}>Email address</label>
          <div className={styles.row}>
            <input
              id={`${uid}email`}
              className={styles.input}
              type="email"
              name="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              readOnly={locked}
              aria-invalid={invalid || undefined}
              aria-describedby={`${uid}status`}
              onChange={(e) => { setEmail(e.target.value); if (invalid) setInvalid(false); }}
            />
            <span ref={slotRef} className={styles.slot}>
              {/* Invisible sizer: the slot is as wide as the longest label, so nothing around it ever shifts. */}
              <span className={styles.sizer} aria-hidden="true">
                {[label, labels.sending, labels.retry].map((t) => <span key={t}>{t}</span>)}
                <span><CheckGlyph className={styles.inlineIcon} />{labels.done}</span>
              </span>
              <button
                ref={btnRef}
                type="submit"
                className={styles.button}
                data-phase={phase}
                aria-busy={phase === 'sending'}
                aria-disabled={locked || undefined}
                aria-describedby={`${uid}status`}
              >
                <span ref={labelRef} className={styles.label}>
                  {phase === 'done' ? <CheckGlyph className={styles.inlineIcon} /> : null}
                  {labels[phase]}
                </span>
                <svg ref={ringRef} className={styles.ring} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <circle className={styles.track} cx="12" cy="12" r="10" />
                  <circle ref={arcRef} className={styles.arc} cx="12" cy="12" r="10" pathLength={1} transform="rotate(-90 12 12)" />
                </svg>
                <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path ref={checkRef} className={`${styles.stroke} ${styles.check}`} d="m7 12.5 3.4 3.4L17.2 8.6" pathLength={1} />
                  <g ref={bangRef} className={styles.bang}>
                    <path className={styles.stroke} d="M12 6.75v6.5" pathLength={1} />
                    <path className={styles.dot} d="M12 17.25h.01" />
                  </g>
                </svg>
              </button>
            </span>
          </div>
          <p id={`${uid}status`} className={styles.status} data-tone={status?.tone} role="status">
            {status ? (
              <>
                <span className={styles.statusIcon} aria-hidden="true">{status.tone === 'success' ? '✓' : status.tone === 'error' ? '!' : '…'}</span>
                <span>{status.text}</span>
              </>
            ) : <span className={styles.hint}>We will never share it. Unsubscribe in one click.</span>}
          </p>
        </form>

        <footer className={styles.footer}>
          <span>Simulated · next reply: {nextOutcome}</span>
          <button type="button" className={styles.reset} onClick={reset}>Reset demo</button>
        </footer>
      </section>
    </div>
  );
}
