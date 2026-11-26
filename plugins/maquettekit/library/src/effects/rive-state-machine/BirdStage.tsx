'use client';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { DeprecationId } from '@rive-app/canvas-lite';
import { duration as D, useStudioMotion } from '../../motion';
import { useCueSweep } from './cue';
import { RiveCanvas, type RiveCanvasApi } from './RiveCanvas';
import styles from './styles.module.css';

const BIRB = { src: '/rive/birb.riv', artboard: 'birb', stateMachine: 'birb' } as const;
/** birb artboard geometry, in its 600 × 600 units (measured): body spans x 111–486, the eyes sit at y ≈ 200. */
const ART = { size: 600, cx: 299, eyeY: 200, half: 188 };
/** The sample file predates data binding: it is driven by inputs and reports states, which Rive now flags. */
const QUIET: readonly DeprecationId[] = ['state-machine-inputs', 'state-change-events'];
const SAY: Record<string, string> = { idle: 'idling', lookUp: 'looking up', slowDance: 'dancing' };

type Props = { index: string; pointer: boolean; backdrop: string };

export function BirdStage({ index, pointer, backdrop }: Props) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const api = useRef<RiveCanvasApi | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const cueRefs = useRef<Record<'dance' | 'look', HTMLElement | null>>({ dance: null, look: null });
  const sweep = useCueSweep(reduced);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dance, setDance] = useState(false);
  /** Whether the state machine advances. Off by default under reduced motion; Pause/Play always wins. */
  const [playing, setPlaying] = useState(!reduced);
  const [state, setState] = useState('idle');
  const [said, setSaid] = useState({ text: '', n: 0 });

  const paused = !playing;
  const reactive = pointer && !reduced && ready && playing;

  /**
   * Reduced motion: Dance and Look up are explicit, so they play; `settle` marks that Birb should hold still again
   * once it is back to idle (`seen`: a non-idle state has been entered since). Pressing Play clears it.
   */
  const live = useRef({ reduced, settle: false, seen: false, inZone: false });
  live.current.reduced = reduced;
  const timer = useRef<number | undefined>(undefined);
  const clearTimer = () => { if (timer.current !== undefined) { window.clearTimeout(timer.current); timer.current = undefined; } };
  useEffect(() => clearTimer, []);
  const holdStill = () => { clearTimer(); live.current.settle = false; setPlaying(false); };
  /** Play a reaction under reduced motion, then hold still. `seen`: it already left idle (dance → idle). */
  const playThenSettle = (seen: boolean, safetyMs?: number) => {
    clearTimer();
    Object.assign(live.current, { settle: true, seen });
    setPlaying(true);
    // If no state change comes back (file without the expected states), still stop.
    if (safetyMs) timer.current = window.setTimeout(holdStill, safetyMs);
  };

  // Turning reduced motion on or off resets playback to the new default.
  const firstReduced = useRef(reduced);
  useEffect(() => {
    if (firstReduced.current === reduced) return;
    firstReduced.current = reduced;
    clearTimer();
    live.current.settle = false;
    setPlaying(!reduced);
  }, [reduced]);

  // The boolean input mirrors the toggle (also when the file finishes loading after a press).
  useEffect(() => {
    const input = api.current?.input('dance');
    if (input) input.value = dance;
  }, [dance, ready]);

  const say = (text: string) => setSaid((s) => ({ text, n: s.n + 1 }));

  const onStateChange = useCallback((states: string[]) => {
    const s = states[states.length - 1];
    if (!s) return;
    setState(s);
    const l = live.current;
    if (s !== 'idle') { l.seen = true; return; }
    // Back to idle after an explicit reaction: let the blend land, then hold still.
    if (l.reduced && l.settle && l.seen) {
      clearTimer();
      timer.current = window.setTimeout(holdStill, D.slow);
    }
  }, []);

  const toggleDance = () => {
    const next = !dance;
    setDance(next);
    if (!reduced) setPlaying(true);
    else if (next) { if (!playing) playThenSettle(false); } // dances until toggled off or paused
    else if (!playing || live.current.settle) playThenSettle(true, 4000); // ease back to idle, then hold
    sweep(cueRefs.current.dance);
  };

  const lookUp = (from: 'button' | 'pointer') => {
    const input = api.current?.input('look up');
    if (from === 'button') {
      if (!reduced) setPlaying(true);
      else if (!playing || live.current.settle) playThenSettle(false, 4000);
      say(ready ? 'Birb looks up.' : 'Birb is still loading.');
    }
    input?.fire();
    sweep(cueRefs.current.look);
  };

  const togglePlay = () => {
    clearTimer();
    live.current.settle = false;
    setPlaying(!playing);
    say(playing ? 'Animation paused.' : 'Animation playing.');
  };

  // ── Pointer: Birb looks up when the pointer comes in above its eyes; the back wall's light leans toward it.
  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (!reactive || (e.target as Element).closest('button')) return;
    const box = boxRef.current?.getBoundingClientRect();
    const stage = e.currentTarget.getBoundingClientRect();
    if (!box) return;
    // Fit "contain", aligned bottom-centre: where the artboard lands inside the box.
    const s = Math.min(box.width, box.height) / ART.size;
    const eyeX = box.left + (box.width - ART.size * s) / 2 + ART.cx * s;
    const eyeY = box.top + (box.height - ART.size * s) + ART.eyeY * s;
    const half = ART.half * s;
    const dx = e.clientX - eyeX;
    const dy = eyeY - e.clientY;
    const l = live.current;
    // A cone opening upward from the eye line; leaving needs a margin, so the edge does not flicker.
    const inside = dy > 0 && Math.abs(dx) < half + dy * 0.8;
    const outside = dy < -half * 0.2 || Math.abs(dx) > half * 1.25 + Math.max(0, dy) * 0.8;
    if (inside && !l.inZone) { l.inZone = true; lookUp('pointer'); }
    else if (outside) l.inZone = false;
    if (e.pointerType !== 'touch' && wallRef.current) {
      const nx = ((e.clientX - stage.left) / stage.width) * 2 - 1;
      const ny = ((e.clientY - stage.top) / stage.height) * 2 - 1;
      wallRef.current.style.transform = `translate3d(${(nx * 7).toFixed(2)}%, ${(ny * 4).toFixed(2)}%, 0)`;
    }
  };
  const onPointerLeave = () => {
    live.current.inZone = false;
    if (wallRef.current) wallRef.current.style.transform = '';
  };
  useEffect(() => { if (!reactive && wallRef.current) wallRef.current.style.transform = ''; }, [reactive]);

  const stateWord = failed ? 'unavailable' : !ready ? 'loading' : paused ? 'paused' : (SAY[state] ?? state);
  const hint = reduced
    ? 'Reduced motion: Birb holds still until you press Dance, Look up or Play, then settles again.'
    : pointer
      ? 'Bring the pointer in above Birb’s head and it looks up at you; Look up does the same from the keyboard, Dance toggles the routine.'
      : 'Pointer reactions are off: Dance and Look up drive the state machine.';

  return (
    <section className={styles.panel} aria-labelledby={`${uid}t`} style={{ '--i': 0 } as CSSProperties}>
      <header className={styles.head}>
        <span className={styles.index} aria-hidden="true">{index}</span>
        <h3 id={`${uid}t`} className={styles.title}>Character</h3>
        <span className={styles.status} data-live={(!paused && ready) || undefined}>
          <span className={styles.dot} aria-hidden="true" />
          {stateWord}
        </span>
      </header>

      <div
        className={styles.stage}
        data-backdrop={backdrop}
        data-reactive={reactive || undefined}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={onPointerLeave}
      >
        <div ref={wallRef} className={styles.wall} aria-hidden="true" />
        <div className={styles.floor} aria-hidden="true" />
        <div ref={boxRef} className={styles.birdBox}>
          <RiveCanvas
            className={styles.fill}
            src={BIRB.src}
            artboard={BIRB.artboard}
            stateMachine={BIRB.stateMachine}
            fit="contain"
            alignment="bottomCenter"
            paused={paused}
            quietDeprecations={QUIET}
            label={`Birb, a round blue cartoon bird on a small stage, ${stateWord}`}
            loading={<span className={styles.loadingNote}>loading birb.riv</span>}
            fallback={(
              <div className={styles.birdFallback}>
                <svg viewBox="0 0 120 120" width="88" height="88" aria-hidden="true">
                  <ellipse cx="60" cy="108" rx="40" ry="6" className={styles.fbShadow} />
                  <circle cx="60" cy="62" r="38" className={styles.fbBody} />
                  <circle cx="47" cy="56" r="6" className={styles.fbEye} />
                  <circle cx="73" cy="56" r="6" className={styles.fbEye} />
                  <path d="M54 68h12l-6 8z" className={styles.fbEye} />
                </svg>
                <p>Birb could not load here (Rive runtime or birb.riv unavailable). The buttons still set its inputs.</p>
              </div>
            )}
            onReady={(a) => { api.current = a; setReady(true); setFailed(false); }}
            onError={() => { api.current = null; setReady(false); setFailed(true); }}
            onStateChange={onStateChange}
          />
        </div>
        <button
          type="button"
          className={styles.playButton}
          onClick={togglePlay}
          aria-label={paused ? 'Play animation' : 'Pause animation'}
        >
          {paused ? (
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M6.5 4.5v11l9-5.5z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M6 4.5h2.6v11H6zM11.4 4.5H14v11h-2.6z" fill="currentColor" /></svg>
          )}
        </button>
      </div>

      <div className={styles.controls}>
        <button type="button" className={styles.button} data-kind="dance" aria-pressed={dance} onClick={toggleDance}>
          <span className={styles.eq} aria-hidden="true" data-on={(dance && !paused) || undefined}><i /><i /><i /></span>
          Dance
        </button>
        <button type="button" className={styles.button} data-kind="look" onClick={() => lookUp('button')}>
          <svg className={styles.lookIcon} viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M10 15.5v-11M5.5 9 10 4.5 14.5 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Look up
        </button>
      </div>

      <ul className={styles.cues} aria-label="State machine inputs">
        <li className={styles.cue}><span className={styles.cueKey}>dance</span><span ref={(el) => { cueRefs.current.dance = el; }} className={styles.cueValue}>{String(dance)}</span></li>
        <li className={styles.cue}><span className={styles.cueKey}>look up</span><span ref={(el) => { cueRefs.current.look = el; }} className={styles.cueValue}>trigger</span></li>
        <li className={styles.cue}><span className={styles.cueKey}>state</span><span className={styles.cueValue}>{failed ? '—' : state}</span></li>
      </ul>
      <p className={styles.hint}>{hint}</p>
      <p className={styles.srOnly} role="status">{said.text}{said.n % 2 ? ' ' : ''}</p>
    </section>
  );
}
