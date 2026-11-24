'use client';
/**
 * Async submit button — the morph-submit-button recipe's choreography (pill → circle with a decelerating arc →
 * check or "!" → pill), re-implemented as a controlled component: the recipe is a sealed waitlist card with its own
 * copy and email field, while this flow needs the parent to own the request and the phase.
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { cssEase, duration as D, useIsomorphicLayoutEffect } from '../../../motion';
import styles from './styles.module.css';

export type MorphPhase = 'idle' | 'busy' | 'success' | 'error';

interface Props {
  phase: MorphPhase;
  labels: Record<MorphPhase, string>;
  reduced: boolean;
  type?: 'button' | 'submit';
  size?: 'm' | 's';
  onPress?: () => void;
  describedBy?: string;
  /** Accessible name suffix, e.g. the integration name, kept out of the visible label. */
  context?: string;
}

const HOLD = 620;

export function MorphButton({ phase, labels, reduced, type = 'button', size = 'm', onPress, describedBy, context }: Props) {
  const slot = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const ring = useRef<SVGSVGElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const check = useRef<SVGPathElement>(null);
  const bang = useRef<SVGGElement>(null);
  const live = useRef<Partial<Record<'width' | 'label' | 'ring' | 'arc' | 'mark' | 'shake', Animation>>>({});
  const timers = useRef(new Set<number>());
  const settled = useRef(true);

  const stop = (k: keyof typeof live.current) => { live.current[k]?.cancel(); delete live.current[k]; };
  const play = (k: keyof typeof live.current, el: Element | null, kf: Keyframe[], o: KeyframeAnimationOptions) => {
    if (!el || typeof el.animate !== 'function') return null;
    const a = el.animate(kf, o);
    live.current[k] = a;
    return a;
  };
  const opacityOf = (el: Element | null) => (el ? Number(getComputedStyle(el).opacity) : 1);
  const later = (ms: number, fn: () => void) => { const t = window.setTimeout(() => { timers.current.delete(t); fn(); }, ms); timers.current.add(t); };

  useEffect(() => {
    const t = timers.current, l = live.current;
    return () => { for (const id of t) window.clearTimeout(id); for (const a of Object.values(l)) a?.cancel(); };
  }, []);

  useIsomorphicLayoutEffect(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current.clear();
    const b = btn.current, s = slot.current;
    if (!b || !s) return;
    const btnEl = b, slotEl = s;
    if (reduced || phase === 'idle') {
      for (const k of Object.keys(live.current) as (keyof typeof live.current)[]) stop(k);
      settled.current = true;
      btnEl.dataset.settled = 'true';
      return;
    }
    const emph = cssEase('emphasized');
    const toCircle = () => {
      const from = btnEl.getBoundingClientRect().width, h = btnEl.getBoundingClientRect().height;
      stop('width');
      play('width', btnEl, [{ width: `${from}px` }, { width: `${h}px` }], { duration: D.moderate, easing: emph, fill: 'forwards' });
    };
    const toPill = () => {
      const from = btnEl.getBoundingClientRect().width, to = slotEl.getBoundingClientRect().width;
      stop('width');
      const a = play('width', btnEl, [{ width: `${from}px` }, { width: `${to}px` }], { duration: D.moderate, easing: emph, fill: 'forwards' });
      a?.finished.then(() => { if (live.current.width === a) stop('width'); }, () => {});
      const o = opacityOf(label.current);
      stop('label');
      play('label', label.current, [{ opacity: o, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: D.base, delay: D.moderate * 0.4, easing: emph, fill: 'both' });
      settled.current = true;
      btnEl.dataset.settled = 'true';
    };

    if (phase === 'busy') {
      settled.current = false;
      delete btnEl.dataset.settled;
      const o = opacityOf(label.current);
      stop('label'); stop('mark'); stop('shake');
      play('label', label.current, [{ opacity: o }, { opacity: 0 }], { duration: D.fast, easing: 'linear', fill: 'forwards' });
      toCircle();
      stop('ring'); stop('arc');
      play('ring', ring.current, [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: D.base, delay: D.moderate * 0.5, easing: emph, fill: 'both' });
      // A decelerating arc that never completes on its own: progress without a fake percentage or an infinite spin.
      play('arc', arc.current, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0.1 }], { duration: 2400, delay: D.moderate * 0.5, easing: cssEase('enter'), fill: 'both' });
      return;
    }

    const at = arc.current ? parseFloat(getComputedStyle(arc.current).strokeDashoffset) || 0 : 0;
    stop('arc');
    if (phase === 'success') {
      play('arc', arc.current, [{ strokeDashoffset: at }, { strokeDashoffset: 0 }], { duration: D.fast, easing: cssEase('standard'), fill: 'forwards' });
      later(D.fast, () => {
        const ro = opacityOf(ring.current);
        stop('ring');
        play('ring', ring.current, [{ opacity: ro }, { opacity: 0 }], { duration: D.base, easing: 'linear', fill: 'forwards' });
        play('mark', check.current, [{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], { duration: D.moderate, delay: 60, easing: emph, fill: 'both' });
      });
    } else {
      play('arc', arc.current, [{ strokeDashoffset: at }, { strokeDashoffset: at }], { duration: 1, fill: 'forwards' });
      const ro = opacityOf(ring.current);
      stop('ring');
      play('ring', ring.current, [{ opacity: ro }, { opacity: 0 }], { duration: D.base, easing: 'linear', fill: 'forwards' });
      play('mark', bang.current, [{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], { duration: D.moderate, delay: 40, easing: emph, fill: 'both' });
      play('shake', btnEl, [
        { transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' },
        { transform: 'translateX(-3px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' },
      ], { duration: 440, delay: 60, easing: 'ease-out' });
    }
    later(HOLD, () => {
      const mo = opacityOf(phase === 'success' ? check.current : bang.current);
      stop('mark');
      play('mark', phase === 'success' ? check.current : bang.current, [{ opacity: mo }, { opacity: 0 }], { duration: D.fast, easing: 'linear', fill: 'forwards' });
      toPill();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduced]);

  const locked = phase === 'busy' || phase === 'success';
  return (
    <span ref={slot} className={styles.morphSlot} data-size={size}>
      <span className={styles.morphSizer} aria-hidden="true">
        {(['idle', 'busy', 'success', 'error'] as const).map((p) => <span key={p}>{p === 'success' ? <><Check />{labels[p]}</> : labels[p]}</span>)}
      </span>
      <button
        ref={btn}
        type={type}
        className={styles.morph}
        data-phase={phase}
        data-size={size}
        aria-busy={phase === 'busy' || undefined}
        aria-disabled={locked || undefined}
        aria-describedby={describedBy}
        onClick={(e) => { if (locked) { e.preventDefault(); return; } onPress?.(); }}
        style={{ '--morph': `${D.moderate}ms` } as CSSProperties}
      >
        <span ref={label} className={styles.morphLabel}>
          {phase === 'success' ? <Check /> : null}
          {labels[phase]}
          {context ? <span className={styles.srOnly}> {context}</span> : null}
        </span>
        <svg ref={ring} className={styles.morphRing} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle className={styles.morphTrack} cx="12" cy="12" r="9.5" />
          <circle ref={arc} className={styles.morphArc} cx="12" cy="12" r="9.5" pathLength={1} transform="rotate(-90 12 12)" />
        </svg>
        <svg className={styles.morphMark} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path ref={check} className={styles.morphStroke} d="m7 12.5 3.4 3.4L17.2 8.6" pathLength={1} />
          <g ref={bang} className={styles.morphBang}>
            <path className={styles.morphStroke} d="M12 6.75v6.5" pathLength={1} />
            <path className={styles.morphDot} d="M12 17.25h.01" />
          </g>
        </svg>
      </button>
    </span>
  );
}

export function Check({ className }: { className?: string }) {
  return (
    <svg className={className ?? styles.inlineCheck} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="m3.5 8.5 3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
