'use client';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { spring, useStudioMotion, type SpringToken } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { tabs: string; shape: string; spring: string; activation: string; ghost: boolean };

/** Sample panel copy, cycled by tab index. */
const BLURBS = [
  'A calm summary of what moved since you last looked, with the noisy parts folded away.',
  'Every change in order, newest first. Nothing is hidden, only grouped.',
  'Who can see this space, and what each of them is able to do in it.',
  'Plan, seats and the next invoice date, kept on one quiet screen.',
  'Fine-grained switches for the things most people never need to touch.',
  'Keys, webhooks and the audit trail for everything automated.',
];

const isSpringToken = (v: string): v is SpringToken => v in spring;

export default function MorphingNavPill({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const tabs = useMemo(() => {
    const t = params.tabs.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6);
    return t.length ? t : ['Tab'];
  }, [params.tabs]);
  const [selectedRaw, setSelected] = useState(0);
  const [ghostAt, setGhostAt] = useState<number | null>(null);
  const selected = Math.min(selectedRaw, tabs.length - 1);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const shape = params.shape === 'underline' || params.shape === 'block' ? params.shape : 'pill';
  const token: SpringToken = isSpringToken(params.spring) ? params.spring : 'settle';
  const transition = reduced ? { duration: 0 } : { type: 'spring' as const, ...spring[token] };
  const radius = shape === 'pill' ? 999 : shape === 'block' ? 7 : 1;
  const showGhost = params.ghost && !reduced && ghostAt !== null && ghostAt !== selected;

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = i === last ? 0 : i + 1;
    else if (e.key === 'ArrowLeft') next = i === 0 ? last : i - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    if (params.activation !== 'manual') setSelected(next);
  };

  return (
    <div className={styles.root} data-shape={shape} data-reduced={reduced || undefined}>
      <motion.div
        layoutScroll
        role="tablist"
        aria-label="Workspace sections (sample)"
        className={styles.tablist}
        onPointerLeave={() => setGhostAt(null)}
      >
        {tabs.map((label, i) => {
          const active = i === selected;
          return (
            <button
              key={`${label}-${i}`}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="tab"
              id={`${uid}tab${i}`}
              aria-selected={active}
              aria-controls={`${uid}panel${i}`}
              tabIndex={active ? 0 : -1}
              className={styles.tab}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') setGhostAt(i); }}
              onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setGhostAt(i); }}
              onBlur={() => setGhostAt(null)}
            >
              {showGhost && ghostAt === i ? (
                <motion.span layoutId={`${uid}ghost`} className={styles.ghost} style={{ borderRadius: radius }} transition={transition} aria-hidden="true" />
              ) : null}
              {active ? (
                <motion.span layoutId={`${uid}indicator`} className={styles.indicator} style={{ borderRadius: radius }} transition={transition} aria-hidden="true" />
              ) : null}
              <span className={styles.tabLabel}>{label}</span>
            </button>
          );
        })}
      </motion.div>

      <div className={styles.panels}>
        {tabs.map((label, i) => {
          const active = i === selected;
          return (
            <div
              key={`${label}-${i}`}
              role="tabpanel"
              id={`${uid}panel${i}`}
              aria-labelledby={`${uid}tab${i}`}
              tabIndex={active ? 0 : -1}
              inert={!active}
              data-active={active || undefined}
              className={styles.panel}
            >
              <p className={styles.index}>{String(i + 1).padStart(2, '0')} / {String(tabs.length).padStart(2, '0')} <span className={styles.sample}>sample content</span></p>
              <h3 className={styles.title}>{label}</h3>
              <p className={styles.copy}>{BLURBS[i % BLURBS.length]}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
