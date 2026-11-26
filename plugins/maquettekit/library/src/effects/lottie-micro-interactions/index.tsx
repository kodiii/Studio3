'use client';
import { useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { spring, springToLinear, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import { FPS, ICONS, type IconId } from './icons';
import type { LottieAnimation } from './lottie-kit';
import { LottieIcon, type LottieIconHandle } from './LottieIcon';
import { Timeline, type TimelineApi, type TimelineLane } from './Timeline';
import styles from './styles.module.css';

export { LottieIcon } from './LottieIcon';
export type { LottieIconHandle, LottieIconProps } from './LottieIcon';
export type { LottieSegments } from './segments';
export { ICONS } from './icons';

type Params = { size: number; weight: number; tint: string; speed: number; hover: boolean };

/** Accessible names: constant, the state lives in aria-pressed / aria-expanded. */
const LABEL: Record<IconId, string> = { menu: 'Queue', play: 'Play', heart: 'Like', bookmark: 'Save', bell: 'New-episode alerts', theme: 'Night mode' };
const LANE: Record<IconId, string> = { menu: 'Queue', play: 'Play', heart: 'Like', bookmark: 'Save', bell: 'Alerts', theme: 'Night' };
const ORDER: readonly IconId[] = ['menu', 'play', 'heart', 'bookmark', 'bell', 'theme'];
const OFF: Record<IconId, boolean> = { menu: false, play: false, heart: false, bookmark: false, bell: false, theme: false };

/** Fictional show, sample data. */
const LIKES = 214;
const QUEUE = [
  { n: 13, title: 'The lighthouse keeper’s ledger', min: 41 },
  { n: 14, title: 'Fog signals, decoded', min: 33 },
  { n: 15, title: 'Night shift on the slipway', min: 47 },
];

export default function LottieMicroInteractions({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const [on, setOn] = useState(OFF);
  const weight = params.weight;
  const data = useMemo(
    () => Object.fromEntries(ORDER.map((id) => [id, ICONS[id].build(weight)])) as Record<IconId, LottieAnimation>,
    [weight],
  );
  const handles = useRef<Partial<Record<IconId, LottieIconHandle | null>>>({});
  const timeline = useRef<TimelineApi | null>(null);
  const press = useMemo(() => springToLinear(spring.press), []);
  const tint = ['duotone', 'accent', 'ink'].includes(params.tint) ? params.tint : 'duotone';
  const size = Math.round(params.size);

  const icon = (id: IconId, opts: { size: number; className: string; children?: ReactNode; disclosure?: boolean }) => (
    <LottieIcon
      animationData={data[id]}
      segments={ICONS[id].segments}
      grid={24}
      label={LABEL[id]}
      pressed={on[id]}
      onToggle={(v) => setOn((s) => ({ ...s, [id]: v }))}
      kind={opts.disclosure ? 'disclosure' : 'toggle'}
      controls={opts.disclosure ? `${uid}queue` : undefined}
      size={opts.size}
      speed={params.speed}
      hover={params.hover}
      className={opts.className}
      onFrame={(f) => timeline.current?.update(id, f)}
      handle={(h) => { handles.current[id] = h; }}
    >
      {opts.children}
    </LottieIcon>
  );

  const lanes: TimelineLane[] = ORDER.map((id) => ({
    id,
    name: LANE[id],
    segments: ICONS[id].segments,
    rest: on[id] ? ICONS[id].segments.on[1] : ICONS[id].segments.on[0],
    scrub: (f) => handles.current[id]?.scrub(f),
    release: () => handles.current[id]?.release(),
  }));

  return (
    <div
      className={styles.root}
      data-reduced={reduced || undefined}
      style={{ '--press-ease': press.easing, '--press-duration': `${press.duration}ms` } as CSSProperties}
    >
      <div className={styles.layout}>
        <div className={styles.column}>
          <section className={styles.card} data-tint={tint} data-night={on.theme || undefined} data-playing={on.play || undefined} aria-label="Sample podcast player">
            <header className={styles.bar}>
              {icon('menu', { size, className: styles.iconButton, disclosure: true })}
              <p className={styles.brand}>
                <span className={styles.show}>Tidewater FM</span>
                <span className={styles.sample}>Fictional show · sample UI</span>
              </p>
              <div className={styles.barEnd}>
                {icon('bell', { size, className: styles.iconButton })}
                {icon('theme', { size, className: styles.iconButton })}
              </div>
            </header>

            <div id={`${uid}queue`} className={styles.queue} data-open={on.menu || undefined}>
              <div className={styles.queueInner}>
                <p className={styles.queueTitle}>Up next</p>
                <ol className={styles.queueList}>
                  {QUEUE.map((q) => (
                    <li key={q.n}><span className={styles.queueNo}>{q.n}</span><span className={styles.queueName}>{q.title}</span><span className={styles.queueMin}>{q.min} min</span></li>
                  ))}
                </ol>
              </div>
            </div>

            <div className={styles.now}>
              <div className={styles.cover} aria-hidden="true">
                <span className={styles.sun} />
                <span className={styles.moon} />
                <svg className={styles.waves} viewBox="0 0 80 32" preserveAspectRatio="none" focusable="false">
                  <path d="M0 10 C 10 4, 20 4, 30 10 S 50 16, 60 10 S 75 4, 80 8" />
                  <path d="M0 19 C 12 13, 22 13, 34 19 S 56 25, 66 19 S 76 14, 80 16" />
                  <path d="M0 28 C 10 23, 22 23, 32 28 S 54 33, 64 28 S 76 24, 80 26" />
                </svg>
              </div>
              <div className={styles.meta}>
                <p className={styles.kicker}>Episode 12 · 38 min</p>
                <h3 className={styles.title}>Salt, static and the night ferry</h3>
                <p className={styles.byline}>Ines Varga &amp; Tomasz Ode</p>
              </div>
            </div>

            <div className={styles.progress}>
              <div className={styles.track} aria-hidden="true"><span className={styles.fill} /><span className={styles.knob} /></div>
              <p className={styles.times}>
                <span className={styles.status}>
                  <span className={styles.eq} aria-hidden="true"><i /><i /><i /></span>
                  {on.play ? 'Playing' : 'Paused'}
                </span>
                <span>12:04 / 38:00</span>
              </p>
            </div>

            <div className={styles.controls}>
              <div className={styles.side}>
                {icon('heart', { size: Math.round(size * 1.08), className: styles.pill, children: <span className={styles.caption}>Like</span> })}
                <span className={styles.count}>{LIKES + (on.heart ? 1 : 0)}<span className={styles.srOnly}> likes (sample)</span></span>
              </div>
              {icon('play', { size: Math.round(size * 1.9), className: styles.primary })}
              <div className={`${styles.side} ${styles.sideEnd}`}>
                {icon('bookmark', { size: Math.round(size * 1.08), className: styles.pill, children: <span className={styles.caption}>Save</span> })}
              </div>
            </div>
          </section>
          <p className={styles.hint}>Hover or focus an icon to preview its wind-up · click to commit from that frame · click again mid-way to reverse</p>
        </div>

        <Timeline lanes={lanes} api={timeline} fps={FPS} />
      </div>
    </div>
  );
}
