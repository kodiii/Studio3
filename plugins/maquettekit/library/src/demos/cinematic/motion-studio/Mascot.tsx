'use client';
/**
 * Birb, the studio mascot, sitting in the screening room: the rive-state-machine recipe's RiveCanvas with birb.riv,
 * driven only from the DOM. Adapted from the recipe's BirdStage: Birb looks up when the pointer comes in above its
 * head (or on Look up), dances while the reel plays (or on Dance), and has a Pause control because its idle loop runs
 * for longer than five seconds. Under reduced motion Birb holds a still frame; Dance, Look up and Play still animate
 * because they are explicit, and Birb settles back to a still frame afterwards.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { DeprecationId } from '@rive-app/canvas-lite';
import { duration as D, useStudioMotion } from '../../../motion';
import { RiveCanvas, type RiveCanvasApi } from '../../../effects/rive-state-machine';
import { useNear } from './near';
import s from './stage.module.css';

const BIRB = { src: '/rive/birb.riv', artboard: 'birb', stateMachine: 'birb' } as const;
/** birb artboard geometry in its 600 × 600 units (measured by the recipe): body x 111–486, eyes at y ≈ 200. */
const ART = { size: 600, cx: 299, eyeY: 200, half: 188 };
const QUIET: readonly DeprecationId[] = ['state-machine-inputs', 'state-change-events'];
const SAY: Record<string, string> = { idle: 'idling', lookUp: 'looking up', slowDance: 'dancing' };
const SAFETY_MS = 4000;

export function Mascot({ reelPlaying }: { reelPlaying: boolean }) {
  const { reduced } = useStudioMotion();
  const api = useRef<RiveCanvasApi | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const near = useNear(box);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dance, setDance] = useState(false);
  const [playing, setPlaying] = useState(!reduced);
  const [state, setState] = useState('idle');
  const [said, setSaid] = useState({ text: '', n: 0 });
  const paused = !playing;
  const dancing = dance || reelPlaying;
  const reactive = !reduced && ready && playing;

  const live = useRef({ reduced, settle: false, seen: false, inZone: false });
  live.current.reduced = reduced;
  const timer = useRef<number | undefined>(undefined);
  const clearTimer = () => { if (timer.current !== undefined) { window.clearTimeout(timer.current); timer.current = undefined; } };
  useEffect(() => clearTimer, []);
  const holdStill = () => { clearTimer(); live.current.settle = false; setPlaying(false); };
  const playThenSettle = (seen: boolean, safetyMs?: number) => {
    clearTimer();
    Object.assign(live.current, { settle: true, seen });
    setPlaying(true);
    if (safetyMs) timer.current = window.setTimeout(holdStill, safetyMs);
  };

  const firstReduced = useRef(reduced);
  useEffect(() => {
    if (firstReduced.current === reduced) return;
    firstReduced.current = reduced;
    clearTimer();
    live.current.settle = false;
    setPlaying(!reduced);
  }, [reduced]);

  // The boolean input mirrors the toggle and the reel (also when the file finishes loading after a press).
  useEffect(() => {
    const input = api.current?.input('dance');
    if (input) input.value = dancing;
  }, [dancing, ready]);

  // The reel is an explicit Play: Birb joins in even when its own loop is paused or motion is reduced.
  const prevReel = useRef(reelPlaying);
  useEffect(() => {
    if (prevReel.current === reelPlaying) return;
    prevReel.current = reelPlaying;
    if (reelPlaying) {
      if (reduced) { if (!playing) playThenSettle(false); } else setPlaying(true);
      say('Birb is dancing to the reel.');
    } else if (!dance && reduced && (live.current.settle || !playing)) playThenSettle(true, SAFETY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reelPlaying]);

  const say = (text: string) => setSaid((x) => ({ text, n: x.n + 1 }));

  const onStateChange = useCallback((states: string[]) => {
    const st = states[states.length - 1];
    if (!st) return;
    setState(st);
    const l = live.current;
    if (st !== 'idle') { l.seen = true; return; }
    if (l.reduced && l.settle && l.seen) {
      clearTimer();
      timer.current = window.setTimeout(holdStill, D.slow);
    }
  }, []);

  const toggleDance = () => {
    const next = !dance;
    setDance(next);
    if (!reduced) setPlaying(true);
    else if (next) { if (!playing) playThenSettle(false); }
    else if (!reelPlaying && (!playing || live.current.settle)) playThenSettle(true, SAFETY_MS);
  };
  const lookUp = (from: 'button' | 'pointer') => {
    const input = api.current?.input('look up');
    if (from === 'button') {
      if (!reduced) setPlaying(true);
      else if (!playing || live.current.settle) playThenSettle(false, dancing ? undefined : SAFETY_MS);
      say(ready ? 'Birb looks up.' : 'Birb is still loading.');
    }
    input?.fire();
  };
  const togglePlay = () => {
    clearTimer();
    live.current.settle = false;
    setPlaying(!playing);
    say(playing ? 'Birb paused.' : 'Birb playing.');
  };

  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (!reactive || (e.target as Element).closest('button')) return;
    const b = box.current?.getBoundingClientRect();
    if (!b) return;
    const sc = Math.min(b.width, b.height) / ART.size;
    const eyeX = b.left + (b.width - ART.size * sc) / 2 + ART.cx * sc;
    const eyeY = b.top + (b.height - ART.size * sc) + ART.eyeY * sc;
    const half = ART.half * sc;
    const dx = e.clientX - eyeX, dy = eyeY - e.clientY;
    const l = live.current;
    const inside = dy > 0 && Math.abs(dx) < half + dy * 0.8;
    const outside = dy < -half * 0.2 || Math.abs(dx) > half * 1.25 + Math.max(0, dy) * 0.8;
    if (inside && !l.inZone) { l.inZone = true; lookUp('pointer'); } else if (outside) l.inZone = false;
  };

  const word = failed ? 'unavailable' : !ready ? 'loading' : paused ? 'paused' : (SAY[state] ?? state);
  return (
    <figure className={s.mascot} aria-labelledby="ll-birb-cap">
      <div className={s.mascotStage} data-lit="" onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={() => { live.current.inZone = false; }}>
        <span className={s.mascotPool} aria-hidden="true" />
        <div ref={box} className={s.mascotBox}>
          {near ? <RiveCanvas
            className={s.fill}
            src={BIRB.src}
            artboard={BIRB.artboard}
            stateMachine={BIRB.stateMachine}
            fit="contain"
            alignment="bottomCenter"
            paused={paused}
            quietDeprecations={QUIET}
            label={`Birb, the studio mascot: a round blue cartoon bird, ${word}`}
            loading={<span className={s.mascotNote}>Birb is on the way</span>}
            fallback={<p className={s.mascotNote}>Birb could not load here (the Rive runtime or birb.riv is unavailable). The controls still work.</p>}
            onReady={(a) => { api.current = a; setReady(true); setFailed(false); }}
            onError={() => { api.current = null; setReady(false); setFailed(true); }}
            onStateChange={onStateChange}
          /> : <span className={s.mascotWaiting}><span className={s.mascotNote}>Birb is on the way</span></span>}
        </div>
        <button type="button" className={s.roundButton} data-cursor="magnet" onClick={togglePlay} aria-label={paused ? 'Play Birb' : 'Pause Birb'}>
          {paused
            ? <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M6.5 4.5v11l9-5.5z" fill="currentColor" /></svg>
            : <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M6 4.5h2.6v11H6zM11.4 4.5H14v11h-2.6z" fill="currentColor" /></svg>}
        </button>
      </div>
      <figcaption id="ll-birb-cap" className={s.mascotCap}>
        <span className={s.mascotName}>Birb <span className={s.mascotState}><i data-live={(!paused && ready) || undefined} />{word}</span></span>
        <span className={s.mascotControls}>
          <button type="button" className={s.chip} aria-pressed={dance} onClick={toggleDance}>
            <span className={s.eq} aria-hidden="true" data-on={(dancing && !paused) || undefined}><i /><i /><i /></span>Dance
          </button>
          <button type="button" className={s.chip} onClick={() => lookUp('button')}>
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 15.5v-11M5.5 9 10 4.5 14.5 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Look up
          </button>
        </span>
      </figcaption>
      <p className={s.srOnly} role="status">{said.text}{said.n % 2 ? ' ' : ''}</p>
    </figure>
  );
}
