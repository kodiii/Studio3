'use client';
/**
 * "How did this page feel?" — rating_animation.riv through the rive-state-machine recipe's RiveCanvas, under a native
 * radio group laid exactly over the drawn stars (the recipe's RatingStars geometry). Hover, focus and a touch drag
 * preview; a click, tap, release or arrow key commits. The artwork keeps its lights and darks but takes its hue from
 * the page's signal colour (luminosity blend). Reduced motion stops the state machine and scrubs each state's
 * animation to its last frame under a 160 ms cross-fade.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent } from 'react';
import type { DeprecationId } from '@rive-app/canvas-lite';
import { cssEase, duration as D, useStudioMotion } from '../../../motion';
import { RiveCanvas, type RiveCanvasApi } from '../../../effects/rive-state-machine';
import { FEEL } from './content';
import { useNear } from './near';
import s from './stage.module.css';

const RATING = { src: '/rive/rating_animation.riv', artboard: 'New Artboard', stateMachine: 'State Machine 1' } as const;
const STARS = [1, 2, 3, 4, 5] as const;
const animFor = (n: number) => (n <= 0 ? 'Idle_empty' : n === 1 ? '1_star' : `${n}_stars`);
const QUIET: readonly DeprecationId[] = ['state-machine-inputs', 'state-change-events', 'animation-names', 'scrub'];
const STAR = 'M12 3.2c.4 0 .8.2 1 .6l2.2 4.6 5 .7c.9.1 1.3 1.2.6 1.9l-3.6 3.5.9 5c.2.9-.8 1.6-1.6 1.2L12 18.3l-4.5 2.4c-.8.4-1.8-.3-1.6-1.2l.9-5-3.6-3.5c-.7-.7-.3-1.8.6-1.9l5-.7 2.2-4.6c.2-.4.6-.6 1-.6z';

export function Rating() {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const api = useRef<RiveCanvasApi | null>(null);
  const ghost = useRef<HTMLCanvasElement>(null);
  const burst = useRef<HTMLSpanElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const near = useNear(bandRef);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [value, setValue] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const [said, setSaid] = useState({ text: '', n: 0 });
  const shown = preview ?? value;
  const previewing = preview !== null && preview !== value;

  const mode = useRef<'machine' | 'frames'>('machine');
  const first = useRef(true);
  const fade = useRef<Animation | null>(null);
  const ring = useRef<Animation | null>(null);
  useEffect(() => () => { fade.current?.cancel(); ring.current?.cancel(); }, []);
  useEffect(() => {
    const a = api.current;
    if (!ready || !a) return;
    const { rive } = a;
    if (reduced) {
      const g = ghost.current, src = a.canvas;
      if (!first.current && g && src.width && src.height && typeof g.animate === 'function') {
        g.width = src.width;
        g.height = src.height;
        const ctx = g.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, g.width, g.height);
          ctx.drawImage(src, 0, 0);
          fade.current?.cancel();
          fade.current = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D.fast, easing: 'linear', fill: 'forwards' });
        }
      }
      const anim = animFor(shown);
      rive.stop();
      rive.pause(anim);
      rive.scrub(anim, 60);
      mode.current = 'frames';
    } else {
      if (mode.current === 'frames') { rive.stop(); rive.play(RATING.stateMachine); mode.current = 'machine'; }
      const input = a.input('rating');
      if (input) input.value = shown;
    }
    first.current = false;
  }, [shown, reduced, ready]);

  const say = (text: string) => setSaid((x) => ({ text, n: x.n + 1 }));
  const committed = useRef(0);
  const commit = (n: number) => {
    if (n === committed.current) return;
    committed.current = n;
    setValue(n);
    say(`Rated ${n} out of 5: ${FEEL[n]}. Thank you.`);
    const el = burst.current;
    if (!reduced && el && typeof el.animate === 'function') {
      el.style.setProperty('--at', String(n));
      ring.current?.cancel();
      ring.current = el.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 1, borderWidth: '3px' },
          { transform: 'translate(-50%, -50%) scale(1.3)', opacity: 0.75, borderWidth: '2px', offset: 0.4 },
          { transform: 'translate(-50%, -50%) scale(1.8)', opacity: 0, borderWidth: '1px' },
        ],
        { duration: D.slow + D.base, easing: cssEase('standard') },
      );
    }
  };
  const clear = () => {
    if (!committed.current) return;
    committed.current = 0;
    setValue(0);
    setPreview(null);
    say('Rating cleared.');
  };

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
    <div className={s.rating}>
      <fieldset className={s.fieldset} onBlur={onBlur}>
        <legend className={s.legend}>How did this page feel?</legend>
        <div ref={bandRef} className={s.band} data-lit="" data-ready={ready || undefined} data-failed={failed || undefined} data-cursor="none">
          <div className={s.bandArt} aria-hidden="true">
            {STARS.map((i) => (
              <svg key={i} className={s.bandStar} viewBox="0 0 24 24" data-on={i <= shown || undefined} style={{ '--at': i } as CSSProperties}>
                <path d={STAR} />
              </svg>
            ))}
          </div>
          {near ? <RiveCanvas
            className={s.bandCanvas}
            src={RATING.src}
            artboard={RATING.artboard}
            stateMachine={RATING.stateMachine}
            fit="cover"
            paused={reduced}
            quietDeprecations={QUIET}
            onReady={(a) => { api.current = a; first.current = true; mode.current = 'machine'; setReady(true); setFailed(false); }}
            onError={() => { api.current = null; setReady(false); setFailed(true); }}
          /> : null}
          {near ? <canvas ref={ghost} className={s.ghost} aria-hidden="true" /> : null}
          <span ref={burst} className={s.burst} aria-hidden="true" />
          <div className={s.slots} onPointerMove={onMove} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onLeave} onPointerLeave={onLeave}>
            {STARS.map((i) => (
              <label key={i} className={s.slot}>
                <input className={s.radio} type="radio" name={`${uid}feel`} value={i} checked={value === i} onChange={() => commit(i)} onFocus={() => setPreview(i)} />
                <span className={s.ring} aria-hidden="true" />
                <span className={s.srOnly}>{i === 1 ? '1 star' : `${i} stars`}: {FEEL[i]}</span>
              </label>
            ))}
          </div>
        </div>
      </fieldset>
      <div className={s.verdict}>
        <p className={s.score} data-preview={previewing || undefined} data-empty={!shown || undefined}>
          <span key={shown} className={s.scoreNum}>{shown || '–'}</span><span className={s.scoreOf}>/ 5</span>
        </p>
        <p className={s.word}>{previewing ? <><span className={s.tag}>Preview</span>{FEEL[shown]}</> : FEEL[value]}</p>
        <button type="button" className={s.textButton} onClick={clear} aria-disabled={!value || undefined}>Clear</button>
      </div>
      <p className={s.ratingNote}>
        {failed
          ? 'The animation could not load, so the page draws the stars. The radio buttons work the same.'
          : 'Hover or focus a star to preview; click, tap, drag or use the arrow keys to rate. Your answer stays in this tab: nothing is sent.'}
      </p>
      <p className={s.srOnly} role="status">{said.text}{said.n % 2 ? ' ' : ''}</p>
    </div>
  );
}
