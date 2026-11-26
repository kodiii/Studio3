'use client';
/**
 * Timeline — one lane per icon showing its segments (wind-up, on, off) and a live playhead fed by the icon's
 * enterFrame events (lottie only emits them while playing, so an idle timeline does no work). Each lane is a native
 * range input: drag it, or focus it and use the arrow keys, to scrub the icon frame by frame; letting go (pointer up
 * or moving focus away) plays the icon from that frame back to its current state.
 */
import { useId, useImperativeHandle, useRef, type CSSProperties, type Ref } from 'react';
import type { LottieSegments } from './segments';
import styles from './styles.module.css';

export interface TimelineLane {
  id: string;
  name: string;
  segments: LottieSegments;
  /** Frame the icon rests on right now (on[0] or on[1]). */
  rest: number;
  scrub: (frame: number) => void;
  release: () => void;
}
export interface TimelineApi { update: (id: string, frame: number) => void }

interface LaneEls { li: HTMLLIElement | null; input: HTMLInputElement | null; out: HTMLSpanElement | null; last: number; scrubbing: boolean }

const two = (n: number): string => String(Math.round(n)).padStart(2, '0');
const STEP_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

export function Timeline({ lanes, api, fps }: { lanes: readonly TimelineLane[]; api: Ref<TimelineApi>; fps: number }) {
  const uid = useId();
  const els = useRef(new Map<string, LaneEls>());
  // Seeds for the first render only: afterwards the playhead, frame number and value text are written per frame.
  const seed = useRef(new Map<string, number>());
  const lane = (id: string, last: number): LaneEls => {
    let e = els.current.get(id);
    if (!e) { e = { li: null, input: null, out: null, last, scrubbing: false }; els.current.set(id, e); }
    e.last = last;
    return e;
  };
  const show = (e: LaneEls, frame: number, syncInput: boolean) => {
    e.li?.style.setProperty('--pos', String(Math.min(1, Math.max(0, frame / e.last))));
    if (e.out) e.out.textContent = two(frame);
    if (e.input && syncInput) {
      e.input.value = String(frame);
      e.input.setAttribute('aria-valuetext', `Frame ${Math.round(frame)} of ${e.last}`);
    }
  };

  useImperativeHandle(api, () => ({
    update(id, frame) {
      const e = els.current.get(id);
      if (e) show(e, frame, !e.scrubbing);
    },
  }), []);

  return (
    <section className={styles.timeline} aria-labelledby={`${uid}h`}>
      <header className={styles.timelineHead}>
        <h4 id={`${uid}h`} className={styles.timelineTitle}>Timeline <span>{fps} fps</span></h4>
        <ul className={styles.legend} aria-label="Segments">
          <li data-kind="wind">wind-up</li><li data-kind="on">on</li><li data-kind="off">off</li>
        </ul>
      </header>
      <ol className={styles.lanes}>
        {lanes.map((l) => {
          const [a, b] = l.segments.on;
          const last = (l.segments.off ?? l.segments.on)[1];
          const wind = l.segments.hover?.on ?? 0;
          const e = lane(l.id, last);
          if (!seed.current.has(l.id)) seed.current.set(l.id, l.rest);
          const first = seed.current.get(l.id) ?? 0;
          const pct = (f: number) => `${(f / last) * 100}%`;
          const end = () => { if (!e.scrubbing) return; e.scrubbing = false; l.release(); };
          return (
            <li key={l.id} ref={(el) => { e.li = el; }} className={styles.lane} style={{ '--pos': first / last } as CSSProperties}>
              <label htmlFor={`${uid}${l.id}`} className={styles.laneName}>{l.name}<span className={styles.srOnly}> timeline</span></label>
              <div className={styles.laneTrack}>
                <span className={styles.seg} data-kind="wind" style={{ left: pct(a), width: pct(wind) }} />
                <span className={styles.seg} data-kind="on" style={{ left: pct(a + wind), width: pct(b - a - wind) }} />
                {l.segments.off ? <span className={styles.seg} data-kind="off" style={{ left: pct(l.segments.off[0]), width: pct(l.segments.off[1] - l.segments.off[0]) }} /> : null}
                <span className={styles.head} aria-hidden="true" />
                <input
                  ref={(el) => { e.input = el; }}
                  id={`${uid}${l.id}`}
                  className={styles.scrubber}
                  type="range"
                  min={0}
                  max={last}
                  step={1}
                  defaultValue={first}
                  aria-valuetext={`Frame ${first} of ${last}`}
                  onPointerDown={(ev) => { e.scrubbing = true; try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* not capturable */ } }}
                  onKeyDown={(ev) => { if (STEP_KEYS.has(ev.key)) e.scrubbing = true; }}
                  onInput={(ev) => {
                    e.scrubbing = true;
                    const f = Number(ev.currentTarget.value);
                    show(e, f, false);
                    ev.currentTarget.setAttribute('aria-valuetext', `Frame ${f} of ${last}`);
                    l.scrub(f);
                  }}
                  onPointerUp={end}
                  onPointerCancel={end}
                  onLostPointerCapture={end}
                  onBlur={end}
                />
              </div>
              <span ref={(el) => { e.out = el; }} className={styles.frameNo} aria-hidden="true">{two(first)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
