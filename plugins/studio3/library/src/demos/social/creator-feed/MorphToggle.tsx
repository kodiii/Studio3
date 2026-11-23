'use client';
/**
 * Like / save toggle that morphs instead of swapping icons — the like-heart-morph recipe's technique
 * (createSequence + a spring sampled into linear()), reworked as a CONTROLLED button so the feed's optimistic store
 * can drive it: a rollback after a failed request plays the same quiet reverse as an undo.
 * Each change cancels the running sequence and starts from the current computed pose, so rapid taps never desync.
 */
import { useEffect, useRef } from 'react';
import { createSequence, duration as D, spring, springToLinear, useStudioMotion, type Sequence } from '../../../motion';
import styles from './styles.module.css';

const HEART = 'M24 40.500 9.800 26.300a9.600 9.600 0 0 1 0-13.600 9.500 9.500 0 0 1 13.400 0l.8.8.8-.8a9.500 9.500 0 0 1 13.400 0 9.600 9.600 0 0 1 0 13.600z';
const BOOKMARK = 'M13.500 7.500h21v33L24 32.200l-10.500 8.300z';
const POP = springToLinear(spring.pop);
const RAYS = 8;

export const compact = (n: number): string => (n >= 10_000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function MorphToggle({ kind, pressed, onToggle, count, showCount = true }: {
  kind: 'like' | 'save';
  pressed: boolean;
  onToggle: () => void;
  count?: number;
  showCount?: boolean;
}) {
  const { reduced } = useStudioMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const seq = useRef<Sequence | null>(null);
  const prev = useRef(pressed);
  const like = kind === 'like';

  useEffect(() => () => { seq.current?.cancel(); seq.current = null; }, []);

  useEffect(() => {
    if (prev.current === pressed) return;
    prev.current = pressed;
    const btn = ref.current;
    if (!btn) return;
    const q = (sel: string) => btn.querySelector(sel);
    const fill = q('[data-fill]');
    const on = like ? 'scale(1)' : 'scaleY(1)';
    const off = like ? 'scale(0)' : 'scaleY(0)';
    // A running sequence still overrides the CSS end state: read the live pose so an interrupted morph continues from it.
    const live = seq.current?.playState === 'running' && fill ? getComputedStyle(fill) : null;
    const from = live ? { transform: live.transform === 'none' ? on : live.transform, opacity: live.opacity } : { transform: pressed ? off : on, opacity: pressed ? '0' : '1' };
    seq.current?.cancel();
    const s = createSequence();
    seq.current = s;
    if (reduced) {
      s.add(fill, [{ opacity: from.opacity, transform: on }, { opacity: pressed ? 1 : 0, transform: on }], { duration: D.fast, easing: 'linear' });
    } else if (pressed) {
      s.add(q('[data-outline]'), [{ transform: 'scale(0.82)' }, { transform: 'scale(1)' }], { duration: POP.duration, easing: POP.easing, at: 0 });
      s.add(fill, [{ ...from }, { transform: on, opacity: 1 }], { duration: POP.duration, easing: POP.easing, at: 0 });
      if (like) {
        s.add(q('[data-ring]'), [{ transform: 'scale(0.35)', opacity: 0.9, strokeWidth: 5 }, { transform: 'scale(1.25)', opacity: 0, strokeWidth: 0.5 }], { duration: D.slow, easing: 'emphasized', at: 40 });
        btn.querySelectorAll<SVGElement>('[data-ray]').forEach((ray, i) => {
          const a = ray.dataset.ray;
          s.add(ray, [
            { transform: `rotate(${a}deg) translateY(4px) scaleY(0.2)`, opacity: 1 },
            { transform: `rotate(${a}deg) translateY(-7px) scaleY(1)`, opacity: 1, offset: 0.6 },
            { transform: `rotate(${a}deg) translateY(-10px) scaleY(0)`, opacity: 0 },
          ], { duration: D.slow, easing: 'enter', at: 70 + (i % 2) * 40 });
        });
        s.add(q('[data-count]'), [{ transform: 'translateY(70%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: D.moderate, easing: 'emphasized', at: 60 });
      } else {
        s.add(q('[data-icon]'), [{ transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }], { duration: POP.duration, easing: POP.easing, at: 0 });
      }
    } else {
      // Undo (or a rollback): shorter, no overshoot, no burst.
      s.add(fill, [{ ...from }, { transform: like ? 'scale(0.4)' : off, opacity: 0 }], { duration: D.fast, easing: 'exit', at: 0 });
      s.add(q('[data-outline]'), [{ transform: 'scale(0.94)' }, { transform: 'scale(1)' }], { duration: D.base, easing: 'standard', at: 0 });
      if (like) s.add(q('[data-count]'), [{ transform: 'translateY(-50%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: D.base, easing: 'standard', at: 0 });
    }
    void s.play().then((done) => { if (done && seq.current === s) { s.cancel(); seq.current = null; } });
  }, [pressed, like, reduced]);

  const d = like ? HEART : BOOKMARK;
  return (
    <button ref={ref} type="button" className={styles.morph} data-kind={kind} aria-pressed={pressed} onClick={onToggle}>
      <svg data-icon viewBox="0 0 48 48" width="26" height="26" aria-hidden="true" focusable="false" className={styles.morphIcon}>
        {like ? (
          <g className={styles.morphBurst}>
            <circle data-ring cx="24" cy="24" r="21" />
            {Array.from({ length: RAYS }, (_, i) => <line key={i} data-ray={(360 / RAYS) * i + 360 / RAYS / 2} x1="24" y1="0.500" x2="24" y2="6.500" />)}
          </g>
        ) : null}
        <path data-fill d={d} className={styles.morphFill} />
        <path data-outline d={d} className={styles.morphOutline} />
      </svg>
      <span className="s3-sr-only">{like ? 'Like, ' : 'Save'}</span>
      <span aria-hidden="true" className={styles.morphCaption}>{like ? (pressed ? 'Liked' : 'Like') : pressed ? 'Saved' : 'Save'}</span>
      {like && showCount && count !== undefined ? (
        <span className={styles.morphCount}><span data-count>{compact(count)}</span><span className="s3-sr-only"> likes</span></span>
      ) : null}
    </button>
  );
}
