'use client';
import { useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent } from 'react';
import type { DeprecationId } from '@rive-app/canvas-lite';
import { duration as D, useStudioMotion } from '../../motion';
import { useCueSweep } from './cue';
import { RiveCanvas, type RiveCanvasApi } from './RiveCanvas';
import styles from './styles.module.css';

const RATING = { src: '/rive/rating_animation.riv', artboard: 'New Artboard', stateMachine: 'State Machine 1' } as const;
/**
 * The 500 × 500 artboard is cropped to a band (fit "cover" on a 500 : 170 box, rows 165–335). Its stars sit at
 * x = 110 + 70·i, y = 245, so five equal slots from 15 % to 85 % of the width each hold one star: the native radios
 * are laid exactly over the drawn stars.
 */
const STARS = [1, 2, 3, 4, 5] as const;
const WORDS = ['Not rated yet', 'Not for me', 'It was fine', 'Good', 'Great', 'Loved it'] as const;
/** Reduced motion scrubs these animations (the states of the machine carry the same names). */
const animFor = (n: number) => (n <= 0 ? 'Idle_empty' : n === 1 ? '1_star' : `${n}_stars`);
/** A pre-data-binding sample: inputs, state names, and (for reduced motion) scrubbed animations. */
const QUIET: readonly DeprecationId[] = ['state-machine-inputs', 'state-change-events', 'animation-names', 'scrub'];
/** Sample data: an invented spread of earlier ratings (5★ … 1★). The visitor's own rating is added to it. */
const SAMPLE = [64, 38, 15, 7, 4] as const;
const STAR = 'M12 3.2c.4 0 .8.2 1 .6l2.2 4.6 5 .7c.9.1 1.3 1.2.6 1.9l-3.6 3.5.9 5c.2.9-.8 1.6-1.6 1.2L12 18.3l-4.5 2.4c-.8.4-1.8-.3-1.6-1.2l.9-5-3.6-3.5c-.7-.7-.3-1.8.6-1.9l5-.7 2.2-4.6c.2-.4.6-.6 1-.6z';

type Props = { index: string; tint: string };

export function RatingStars({ index, tint }: Props) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const api = useRef<RiveCanvasApi | null>(null);
  const ghostRef = useRef<HTMLCanvasElement>(null);
  const burstRef = useRef<HTMLSpanElement>(null);
  const cueRef = useRef<HTMLSpanElement>(null);
  const sweep = useCueSweep(reduced);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [value, setValue] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const [state, setState] = useState('Idle_empty');
  const [said, setSaid] = useState({ text: '', n: 0 });
  const shown = preview ?? value;
  const previewing = preview !== null && preview !== value;

  // ── Canvas: full motion sets the number input and the state machine animates; reduced motion stops the machine
  // and scrubs the matching animation to its last frame, with a 160 ms cross-fade from a snapshot of the old frame.
  const mode = useRef<'machine' | 'frames'>('machine');
  const first = useRef(true);
  const fade = useRef<Animation | null>(null);
  useEffect(() => () => fade.current?.cancel(), []);
  useEffect(() => {
    const a = api.current;
    if (!ready || !a) return;
    const { rive } = a;
    if (reduced) {
      const ghost = ghostRef.current;
      const src = a.canvas;
      if (!first.current && ghost && src.width && src.height && typeof ghost.animate === 'function') {
        ghost.width = src.width;
        ghost.height = src.height;
        const ctx = ghost.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, ghost.width, ghost.height);
          ctx.drawImage(src, 0, 0);
          fade.current?.cancel();
          fade.current = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D.fast, easing: 'linear', fill: 'forwards' });
        }
      }
      const anim = animFor(shown);
      rive.stop();
      rive.pause(anim);
      rive.scrub(anim, 60); // one-shot animations clamp at their end: the settled frame
      mode.current = 'frames';
      setState(anim);
    } else {
      if (mode.current === 'frames') { rive.stop(); rive.play(RATING.stateMachine); mode.current = 'machine'; }
      const input = a.input('rating');
      if (input) input.value = shown;
    }
    first.current = false;
  }, [shown, reduced, ready]);

  const say = (text: string) => setSaid((s) => ({ text, n: s.n + 1 }));
  const committed = useRef(0);
  const commit = (n: number) => {
    if (n === committed.current) return;
    committed.current = n;
    setValue(n);
    say(`Rated ${n} out of 5: ${WORDS[n]}.`);
    sweep(cueRef.current);
    // Reward the person's own choice once: a ring leaves the chosen star (decorative, full motion only).
    const ring = burstRef.current;
    if (!reduced && ring && typeof ring.animate === 'function') {
      ring.style.setProperty('--at', String(n));
      ring.animate(
        [{ transform: 'translate(-50%, -50%) scale(0.55)', opacity: 0.95 }, { transform: 'translate(-50%, -50%) scale(1.7)', opacity: 0 }],
        { duration: D.slow, easing: 'cubic-bezier(0.05, 0.7, 0.1, 1)' },
      );
    }
  };
  const clear = () => {
    if (!committed.current) return;
    committed.current = 0;
    setValue(0);
    setPreview(null);
    say('Rating cleared.');
    sweep(cueRef.current);
  };

  // ── Pointer: hover previews (mouse, pen); a touch drag across the stars previews and commits on release.
  const drag = useRef<number | null>(null);
  const slotAt = (x: number, row: HTMLElement) => {
    const r = row.getBoundingClientRect();
    return Math.min(5, Math.max(1, Math.floor(((x - r.left) / r.width) * 5) + 1));
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' && drag.current !== e.pointerId) return;
    setPreview(slotAt(e.clientX, e.currentTarget));
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    drag.current = e.pointerId;
    setPreview(slotAt(e.clientX, e.currentTarget));
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current !== e.pointerId) return;
    drag.current = null;
    commit(slotAt(e.clientX, e.currentTarget));
    setPreview(null);
  };
  const onLeave = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current === e.pointerId) drag.current = null;
    setPreview(null);
  };
  const onBlur = (e: FocusEvent<HTMLFieldSetElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPreview(null);
  };

  return (
    <section className={styles.panel} aria-labelledby={`${uid}t`} style={{ '--i': 1 } as CSSProperties}>
      <header className={styles.head}>
        <span className={styles.index} aria-hidden="true">{index}</span>
        <h3 id={`${uid}t`} className={styles.title}>Rating</h3>
        <span className={styles.status} data-live={(ready && !!value) || undefined}>
          <span className={styles.dot} aria-hidden="true" />
          {value ? `${value} of 5` : 'not rated'}
        </span>
      </header>

      <div className={styles.rateBody}>
        <fieldset className={styles.fieldset} onBlur={onBlur}>
          <legend className={styles.prompt}>How was the performance?</legend>
          <div className={styles.band} data-tint={tint} data-ready={ready || undefined} data-failed={failed || undefined}>
            {/* Drawn DOM stars: the static picture while the runtime loads, and the fallback if it never does. */}
            <div className={styles.bandArt} aria-hidden="true">
              {STARS.map((i) => (
                <svg key={i} className={styles.bandStar} viewBox="0 0 24 24" data-on={i <= shown || undefined} style={{ '--at': i } as CSSProperties}>
                  <path d={STAR} />
                </svg>
              ))}
            </div>
            <RiveCanvas
              className={styles.bandCanvas}
              src={RATING.src}
              artboard={RATING.artboard}
              stateMachine={RATING.stateMachine}
              fit="cover"
              paused={reduced}
              quietDeprecations={QUIET}
              onReady={(a) => { api.current = a; first.current = true; mode.current = 'machine'; setReady(true); setFailed(false); }}
              onError={() => { api.current = null; setReady(false); setFailed(true); }}
              onStateChange={(states) => { if (!reduced && states.length) setState(states[states.length - 1]); }}
            />
            <canvas ref={ghostRef} className={styles.ghost} data-ghost="" aria-hidden="true" />
            <span ref={burstRef} className={styles.burst} aria-hidden="true" />
            <div
              className={styles.slots}
              onPointerMove={onMove}
              onPointerDown={onDown}
              onPointerUp={onUp}
              onPointerCancel={onLeave}
              onPointerLeave={onLeave}
            >
              {STARS.map((i) => (
                <label key={i} className={styles.slot}>
                  <input
                    className={styles.radio}
                    type="radio"
                    name={`${uid}rating`}
                    value={i}
                    checked={value === i}
                    onChange={() => commit(i)}
                    onFocus={() => setPreview(i)}
                  />
                  <span className={styles.ring} aria-hidden="true" />
                  <span className={styles.srOnly}>{i === 1 ? '1 star' : `${i} stars`}</span>
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <div className={styles.result}>
          <p className={styles.score} data-preview={previewing || undefined}>
            <span key={shown} className={styles.scoreNum}>{shown || '–'}</span>
            <span className={styles.scoreOf}>/ 5</span>
          </p>
          <p className={styles.word}>
            {previewing ? <><span className={styles.tag}>Preview</span>{WORDS[shown]}</> : WORDS[value]}
          </p>
          <button type="button" className={styles.textButton} onClick={clear} aria-disabled={!value || undefined}>Clear</button>
        </div>

        <Breakdown value={value} />
      </div>

      <ul className={styles.cues} aria-label="State machine inputs">
        <li className={styles.cue}><span className={styles.cueKey}>rating</span><span ref={cueRef} className={styles.cueValue}>{shown}</span></li>
        <li className={styles.cue}><span className={styles.cueKey}>{reduced ? 'frame' : 'state'}</span><span className={styles.cueValue}>{failed ? '—' : state}</span></li>
      </ul>
      <p className={styles.hint}>
        {failed
          ? 'The animation could not load, so the stars are drawn by the page. The radio buttons work the same.'
          : 'Hover or focus a star to preview it; click, tap, drag or use the arrow keys to rate.'}
      </p>
      <p className={styles.srOnly} role="status">{said.text}{said.n % 2 ? ' ' : ''}</p>
    </section>
  );
}

/** Sample ratings with the visitor's vote added: bars spring to their new length, the average follows. */
function Breakdown({ value }: { value: number }) {
  const uid = useId();
  const counts = SAMPLE.map((c, i) => c + (value === 5 - i ? 1 : 0));
  const total = counts.reduce((a, b) => a + b, 0);
  const mean = counts.reduce((a, c, i) => a + c * (5 - i), 0) / total;
  const max = Math.max(...counts);
  return (
    <div className={styles.breakdown} aria-labelledby={`${uid}h`} role="group">
      <p className={styles.breakdownHead}>
        <span id={`${uid}h`}>Sample ratings{value ? ', yours included' : ''}</span>
        <span className={styles.breakdownMean}><strong>{mean.toFixed(2)}</strong> avg · {total}</span>
      </p>
      <ul className={styles.bars}>
        {counts.map((c, i) => {
          const stars = 5 - i;
          return (
            <li key={stars} className={styles.bar} data-mine={value === stars || undefined}>
              <span className={styles.barKey} aria-hidden="true">{stars}</span>
              <span className={styles.srOnly}>{stars === 1 ? '1 star' : `${stars} stars`}: </span>
              <span className={styles.barTrack} aria-hidden="true">
                <span className={styles.barFill} style={{ transform: `scaleX(${(c / max).toFixed(4)})` }} />
              </span>
              <span className={styles.barCount}>{c}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
