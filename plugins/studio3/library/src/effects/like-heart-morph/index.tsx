'use client';
import { useEffect, useRef, useState } from 'react';
import { createSequence, duration as D, spring, springToLinear, useStudioMotion, type Sequence, type SpringToken } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { size: number; spring: string; rays: number; speed: number };
type Kind = 'like' | 'save';

const HEART = 'M24 40.500 9.800 26.300a9.600 9.600 0 0 1 0-13.600 9.500 9.500 0 0 1 13.400 0l.8.8.8-.8a9.500 9.500 0 0 1 13.400 0 9.600 9.600 0 0 1 0 13.600z';
const BOOKMARK = 'M13.500 7.500h21v33L24 32.200l-10.500 8.300z';
const BASE_LIKES = 128;

function Control({ kind, params }: { kind: Kind; params: Params }) {
  const { reduced } = useStudioMotion();
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const seq = useRef<Sequence | null>(null);
  useEffect(() => () => seq.current?.cancel(), []);

  const toggle = () => {
    const next = !on;
    const btn = ref.current;
    setOn(next);
    if (!btn) return;
    const q = <T extends Element>(sel: string) => btn.querySelector<T>(sel);
    const fill = q<SVGElement>('[data-fill]');
    // Start from wherever the previous run left the fill, so interruptions do not jump.
    const cs = fill ? getComputedStyle(fill) : null;
    const from = { transform: cs?.transform && cs.transform !== 'none' ? cs.transform : kind === 'like' ? 'scale(0)' : 'scaleY(0)', opacity: cs?.opacity ?? '0' };
    seq.current?.cancel();
    const s = createSequence({ durationScale: 1 / params.speed });
    seq.current = s;
    const rest = kind === 'like' ? 'scale(1)' : 'scaleY(1)';
    const empty = kind === 'like' ? 'scale(0.4)' : 'scaleY(0)';

    if (reduced) {
      s.add(fill, [{ opacity: from.opacity, transform: next ? rest : from.transform }, { opacity: next ? 1 : 0, transform: next ? rest : from.transform }], { duration: D.fast, easing: 'linear' });
    } else if (next) {
      const token = (params.spring in spring ? params.spring : 'pop') as SpringToken;
      const sp = springToLinear(spring[token]);
      s.add(q('[data-outline]'), [{ transform: 'scale(0.82)' }, { transform: 'scale(1)' }], { duration: sp.duration, easing: sp.easing, at: 0 });
      s.add(fill, [{ ...from }, { transform: rest, opacity: 1 }], { duration: sp.duration, easing: sp.easing, at: 0 });
      if (kind === 'like') {
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
        s.add(q('[data-icon]'), [{ transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }], { duration: sp.duration, easing: sp.easing, at: 0 });
      }
    } else {
      // Quieter reverse: short, no overshoot, no burst.
      s.add(fill, [{ ...from }, { transform: empty, opacity: 0 }], { duration: D.fast, easing: 'exit', at: 0 });
      s.add(q('[data-outline]'), [{ transform: 'scale(0.94)' }, { transform: 'scale(1)' }], { duration: D.base, easing: 'standard', at: 0 });
      if (kind === 'like') s.add(q('[data-count]'), [{ transform: 'translateY(-50%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: D.base, easing: 'standard', at: 0 });
    }
    void s.play().then((finished) => { if (finished && seq.current === s) { s.cancel(); seq.current = null; } });
  };

  const rays = Math.round(params.rays);
  const d = kind === 'like' ? HEART : BOOKMARK;
  return (
    <button ref={ref} type="button" className={styles.control} data-kind={kind} aria-pressed={on} aria-label={kind === 'like' ? 'Like' : 'Save'} onClick={toggle}>
      <svg data-icon viewBox="0 0 48 48" width={params.size} height={params.size} aria-hidden="true" className={styles.icon}>
        {kind === 'like' && (
          <g className={styles.burst}>
            <circle data-ring cx="24" cy="24" r="21" />
            {Array.from({ length: rays }, (_, i) => (
              <line key={i} data-ray={(360 / rays) * i + 360 / rays / 2} x1="24" y1="0.500" x2="24" y2="6.500" />
            ))}
          </g>
        )}
        <path data-fill d={d} className={styles.fill} />
        <path data-outline d={d} className={styles.outline} />
      </svg>
      <span className={styles.caption} aria-hidden="true">
        <span>{kind === 'like' ? (on ? 'Liked' : 'Like') : on ? 'Saved' : 'Save'}</span>
        {kind === 'like' && <span className={styles.count}><span data-count>{BASE_LIKES + (on ? 1 : 0)}</span></span>}
      </span>
      {kind === 'like' && <span className={styles.srOnly}>, {BASE_LIKES + (on ? 1 : 0)} likes</span>}
    </button>
  );
}

export default function LikeHeartMorph({ params }: EffectProps<Params>) {
  return (
    <div className={styles.root}>
      <article className={styles.card}>
        <p className={styles.kicker}>Essay · 9 min</p>
        <h3 className={styles.title}>The quiet arithmetic of a well-kept allotment</h3>
        <p className={styles.dek}>On rhubarb, borrowed tools and counting the years in compost. By Oskar Lindqvist-Amadi.</p>
        <div className={styles.actions}>
          <Control kind="like" params={params} />
          <Control kind="save" params={params} />
        </div>
        <p className={styles.note}>Fictional article · like count is sample data</p>
      </article>
    </div>
  );
}
