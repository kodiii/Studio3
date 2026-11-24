'use client';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { spring as SPRING, springToLinear, useStudioMotion, type SpringToken } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { depth: number; travel: number; spring: string; tone: string; loadTime: number };
type Tone = 'signal' | 'ink' | 'paper';

const isToken = (v: string): v is SpringToken => v in SPRING;
const isActivationKey = (k: string) => k === ' ' || k === 'Enter';

interface KeyProps {
  tone: Tone;
  wide?: boolean;
  locked?: boolean;
  busy?: boolean;
  describedBy?: string;
  onActivate: () => void;
  children: ReactNode;
  busyLabel?: string;
}

/** One keycap. The pressed look is local state; busy/locked come from the panel. */
function Key({ tone, wide, locked = false, busy = false, describedBy, onActivate, children, busyLabel }: KeyProps) {
  const [pressed, setPressed] = useState(false);
  const inert = locked || busy;
  const down = () => { if (!inert) setPressed(true); };
  const up = () => setPressed(false);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!isActivationKey(e.key)) return;
    // Holding Enter auto-repeats clicks on a native button: one press, one activation.
    if (e.repeat) { e.preventDefault(); return; }
    down();
  };
  return (
    <button
      type="button"
      className={styles.key}
      data-tone={tone}
      data-wide={wide || undefined}
      data-pressed={pressed || undefined}
      data-busy={busy || undefined}
      data-locked={locked || undefined}
      aria-disabled={inert || undefined}
      aria-describedby={describedBy}
      onPointerDown={(e) => { if (e.button === 0) down(); }}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      onKeyDown={onKeyDown}
      onKeyUp={(e) => { if (isActivationKey(e.key)) up(); }}
      onBlur={up}
      onClick={() => { if (!inert) onActivate(); }}
    >
      <span className={styles.shadow} aria-hidden="true" />
      <span className={styles.side} aria-hidden="true" />
      <span className={styles.face}>
        <span className={styles.labels}>
          <span data-shown={!busy || undefined}>{children}</span>
          {busyLabel ? <span data-shown={busy || undefined}>{busyLabel}</span> : null}
        </span>
        {busyLabel ? <span className={styles.bar} aria-hidden="true" /> : null}
      </span>
    </button>
  );
}

export default function PressDepthButton({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const tone: Tone = params.tone === 'ink' || params.tone === 'paper' ? params.tone : 'signal';
  const release = useMemo(() => springToLinear(SPRING[isToken(params.spring) ? params.spring : 'pop']), [params.spring]);

  const [printing, setPrinting] = useState<null | 'print' | 'reprint'>(null);
  const [printed, setPrinted] = useState(0);
  const [display, setDisplay] = useState('Ready');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const run = (kind: 'print' | 'reprint') => {
    if (printing) return;
    const n = kind === 'print' ? printed + 1 : printed;
    const no = String(n).padStart(2, '0');
    setPrinting(kind);
    setDisplay(kind === 'print' ? `Printing badge ${no}…` : `Reprinting badge ${no}…`);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setPrinting(null);
      if (kind === 'print') setPrinted(n);
      setDisplay(`Badge ${no} ${kind === 'print' ? 'printed' : 'reprinted'} (demo)`);
    }, params.loadTime);
  };

  const style = {
    '--depth': params.depth,
    '--travel': params.travel / 100,
    '--release-ease': release.easing,
    '--release-dur': `${release.duration}ms`,
    '--load': `${params.loadTime}ms`,
  } as CSSProperties;

  return (
    <div className={styles.root} data-reduced={reduced || undefined} style={style}>
      <section className={styles.panel} aria-labelledby={`${uid}title`}>
        <header className={styles.head}>
          <h3 id={`${uid}title`} className={styles.title}>Badge printer</h3>
          <span className={styles.model}>Fictional device · BP-02</span>
        </header>

        <div className={styles.display}>
          <p className={styles.readout} role="status">{display}</p>
          <p className={styles.count}><span>{String(printed).padStart(2, '0')}</span> printed</p>
        </div>

        <div className={styles.keys}>
          <Key tone={tone} wide busy={printing === 'print'} busyLabel="Printing…" onActivate={() => run('print')}>Print badge</Key>
          <Key tone="paper" onActivate={() => setDisplay(`Preview: badge ${String(printed + 1).padStart(2, '0')} (demo)`)}>Preview</Key>
          <Key tone="paper" locked={printed === 0} busy={printing === 'reprint'} busyLabel="Printing…" describedBy={`${uid}reprint`} onActivate={() => run('reprint')}>Reprint</Key>
        </div>

        <p id={`${uid}reprint`} className={styles.note}>
          {printed === 0 ? 'Reprint unlocks after the first badge is printed.' : 'Reprint repeats the last badge.'}
        </p>
      </section>
    </div>
  );
}
