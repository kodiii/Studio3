'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { cssEase, duration as D, useIsomorphicLayoutEffect, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { duration: number; slides: number; transition: string; autoAdvance: boolean };
type Tone = 'signal' | 'ink' | 'tint' | 'paper';

/** Sample content: a fictional field-notes story, drawn with type and CSS only. */
const SLIDES: readonly { tone: Tone; body: ReactNode }[] = [
  {
    tone: 'signal',
    body: (
      <>
        <span className={styles.sun} aria-hidden="true" />
        <span className={styles.horizon} aria-hidden="true" />
        <p className={styles.eyebrow}>Field notes · No. 14</p>
        <p className={styles.hero}>Low tide, 06:40</p>
        <p className={styles.small}>A morning on the flats</p>
      </>
    ),
  },
  {
    tone: 'ink',
    body: (
      <>
        <p className={styles.giant}>40</p>
        <p className={styles.lede}>minutes before the water turns around and comes back for the sand.</p>
      </>
    ),
  },
  {
    tone: 'tint',
    body: (
      <>
        <p className={styles.quote}>“The sea had left its handwriting everywhere.”</p>
        <p className={styles.small}>Notebook, page 3</p>
      </>
    ),
  },
  {
    tone: 'paper',
    body: (
      <>
        <p className={styles.eyebrow}>Found on the walk</p>
        <ol className={styles.list}>
          <li>Razor shells, by the dozen</li>
          <li>A blue rope, knotted twice</li>
          <li>One boot (left)</li>
        </ol>
      </>
    ),
  },
  {
    tone: 'signal',
    body: (
      <>
        <svg className={styles.route} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <path d="M14 86 C 30 70, 22 52, 44 46 S 70 30, 84 14" />
          <circle cx="14" cy="86" r="3.5" />
          <circle cx="84" cy="14" r="3.5" />
        </svg>
        <p className={styles.eyebrow}>The route</p>
        <p className={styles.hero}>Sea wall to the channel marker</p>
      </>
    ),
  },
  {
    tone: 'ink',
    body: (
      <>
        <p className={styles.eyebrow}>Next low tide</p>
        <p className={styles.hero}>19:12</p>
        <p className={styles.small}>See you out there.</p>
      </>
    ),
  },
];

const TAP_MS = 250; // shorter presses are taps (navigate); longer ones were holds (pause only)

export default function StoryProgressSegments({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const count = Math.max(3, Math.min(SLIDES.length, Math.round(params.slides)));
  const auto = params.autoAdvance && !reduced;
  const [index, setIndex] = useState(0);
  const [restart, setRestart] = useState(0);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [ended, setEnded] = useState(false);
  const segFills = useRef<(HTMLSpanElement | null)[]>([]);
  const slideEls = useRef<(HTMLDivElement | null)[]>([]);
  const segAnim = useRef<Animation | null>(null);
  const shown = useRef(0);
  const hold = useRef<{ t: number; x: number; w: number } | null>(null);
  const current = Math.min(index, count - 1);
  const playing = auto && !paused && !holding && !ended;

  const next = () => { if (current + 1 >= count) setEnded(true); else { setEnded(false); setIndex(current + 1); } };
  const prev = () => { setEnded(false); if (current === 0) setRestart((r) => r + 1); else setIndex(current - 1); };
  const toggle = () => {
    if (ended) { setEnded(false); setPaused(false); setIndex(0); setRestart((r) => r + 1); return; }
    setPaused((p) => !p);
  };

  // The current segment's fill is the clock: its finish advances the story.
  useIsomorphicLayoutEffect(() => {
    segAnim.current = null;
    const el = segFills.current[current];
    if (!auto || ended || !el || typeof el.animate !== 'function') return;
    const a = el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: params.duration, easing: 'linear', fill: 'forwards' });
    segAnim.current = a;
    a.onfinish = () => {
      if (segAnim.current !== a) return;
      if (current + 1 >= count) setEnded(true);
      else setIndex(current + 1);
    };
    return () => { a.onfinish = null; a.cancel(); };
  }, [current, auto, ended, count, params.duration, restart]);

  // Pause / hold / resume without restarting the segment.
  useEffect(() => {
    const a = segAnim.current;
    if (!a) return;
    if (paused || holding) a.pause();
    else if (a.playState === 'paused') a.play();
  }, [paused, holding, current, restart, auto, ended]);

  // Slide change: a short push or fade between the outgoing and incoming slide.
  useIsomorphicLayoutEffect(() => {
    const from = shown.current;
    shown.current = current;
    if (from === current) return;
    const inEl = slideEls.current[current];
    const outEl = slideEls.current[from];
    const dir = current > from ? 1 : -1;
    const mode = reduced ? 'fade' : params.transition;
    if (mode === 'none') return;
    const ms = reduced ? 160 : mode === 'fade' ? D.base : D.moderate;
    const ease = reduced ? 'linear' : cssEase('emphasized');
    const dx = mode === 'slide' ? 14 : 0;
    const list: Animation[] = [];
    if (inEl) list.push(inEl.animate([{ opacity: 0, transform: `translateX(${dir * dx}%)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: ms, easing: ease }));
    if (outEl) list.push(outEl.animate([{ opacity: 1, visibility: 'visible', transform: 'translateX(0)' }, { opacity: 0, visibility: 'visible', transform: `translateX(${-dir * dx}%)` }], { duration: ms, easing: ease }));
    return () => { for (const a of list) a.cancel(); };
  }, [current]);

  // Tap zones (left 30 % back, rest forward) and press-and-hold to pause.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    hold.current = { t: performance.now(), x: e.clientX - r.left, w: r.width };
    if (auto && !ended) setHolding(true);
  };
  const endHold = (tap: boolean) => {
    const h = hold.current;
    if (!h) return;
    hold.current = null;
    setHolding(false);
    if (tap && performance.now() - h.t < TAP_MS) { if (h.x < h.w * 0.3) prev(); else next(); }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.key === ' ' && !(e.target as HTMLElement).closest('button') && auto) { e.preventDefault(); toggle(); }
  };

  const tone = SLIDES[current].tone;
  const position = `Slide ${current + 1} of ${count}`;
  const state = ended ? 'end of story' : !auto ? (reduced ? 'auto-advance off (reduced motion)' : 'auto-advance off') : paused ? 'paused' : holding ? 'held' : 'playing';

  return (
    <div className={styles.root} data-reduced={reduced || undefined} onKeyDown={onKeyDown}>
      <section
        className={styles.frame}
        data-tone={tone}
        data-manual={!auto || undefined}
        tabIndex={0}
        aria-label="Story: Tidewater Notes (sample content)"
        aria-describedby={`${uid}help`}
      >
        <div className={styles.slides} aria-live={playing ? 'off' : 'polite'}>
          {SLIDES.slice(0, count).map((s, i) => (
            <div
              key={i}
              ref={(el) => { slideEls.current[i] = el; }}
              className={styles.slide}
              data-tone={s.tone}
              data-current={i === current || undefined}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              inert={i !== current}
            >
              {s.body}
            </div>
          ))}
        </div>

        <div className={styles.overlay} aria-hidden="true">
          <div className={styles.segments}>
            {Array.from({ length: count }, (_, i) => (
              <span key={i} className={styles.seg} data-state={ended || i < current ? 'done' : i === current ? 'current' : 'next'}>
                <span ref={(el) => { segFills.current[i] = el; }} className={styles.segFill} />
              </span>
            ))}
          </div>
          <div className={styles.byline}>
            <span className={styles.avatar}>TN</span>
            <span className={styles.who}>Tidewater Notes</span>
            {auto && (paused || holding) && !ended ? <span className={styles.pill}>Paused</span> : null}
          </div>
        </div>

        {/* Tap zones: pointer-only duplicates of Previous / Next (and press-and-hold to pause). */}
        <div
          className={styles.zones}
          aria-hidden="true"
          onPointerDown={onPointerDown}
          onPointerUp={() => endHold(true)}
          onPointerCancel={() => endHold(false)}
          onPointerLeave={() => endHold(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className={styles.chev} data-side="prev">‹</span>
          <span className={styles.chev} data-side="next">›</span>
        </div>
      </section>

      <div className={styles.controls}>
        <button type="button" className={styles.ctrl} onClick={prev}>
          <span aria-hidden="true">‹</span> Previous
        </button>
        {auto ? (
          <button type="button" className={styles.ctrl} data-primary="" onClick={toggle}>
            <span aria-hidden="true">{ended ? '↺' : paused ? '▶' : '❚❚'}</span> {ended ? 'Replay' : paused ? 'Play' : 'Pause'}
          </button>
        ) : null}
        <button type="button" className={styles.ctrl} onClick={next}>
          Next <span aria-hidden="true">›</span>
        </button>
      </div>
      <p className={styles.status}><span>{position}</span><span>{state}</span></p>
      <p id={`${uid}help`} className={styles.help}>
        {auto ? '← → move · Space pauses · tap the left third to go back · press and hold to pause' : '← → move · tap the left third to go back, the rest to go forward'}
      </p>
    </div>
  );
}
