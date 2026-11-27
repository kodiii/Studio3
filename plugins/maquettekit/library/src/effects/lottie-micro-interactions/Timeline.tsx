'use client';
/**
 * Timeline — one lane per icon showing its segments (wind-up, on, off) and a live playhead fed by the icon's
 * enterFrame events (lottie only emits them while playing or seeking, so an idle timeline does no work). Each lane is
 * a native range input: drag it, or focus it and use the arrow keys, to scrub the icon frame by frame; letting go
 * (pointer up, or focus leaving the lane) plays the icon from that frame back to its current state.
 *
 * Playheads are written straight to the DOM. Lanes are found through one stable list ref (not per-lane ref callbacks,
 * which React detaches and re-attaches on every render and would miss a frame written from a layout effect).
 */
import { useId, useImperativeHandle, useRef, type CSSProperties, type Ref } from 'react';
import type { LottieSegments } from './segments';
import styles from './styles.module.css';

export interface TimelineLane {
  id: string;
  name: string;
  segments: LottieSegments;
  /** Frame the icon rests on right now (on[0] or on[1]). Only the first value seeds the lane. */
  rest: number;
  scrub: (frame: number) => void;
  release: () => void;
}
export interface TimelineApi { update: (id: string, frame: number) => void }

const two = (n: number): string => String(Math.round(n)).padStart(2, '0');
const STEP_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
const valueText = (f: number, last: number): string => `Frame ${Math.round(f)} of ${last}`;

export function Timeline({ lanes, api, fps }: { lanes: readonly TimelineLane[]; api: Ref<TimelineApi>; fps: number }) {
  const uid = useId();
  const list = useRef<HTMLOListElement>(null);
  /** Lanes being scrubbed by the user: their input is the source of truth, so playback does not overwrite it. */
  const scrubbing = useRef(new Set<string>());
  /** First rest frame per lane: seeds the markup once; afterwards everything is written per frame. */
  const seed = useRef(new Map<string, number>());

  const show = (id: string, frame: number, syncInput: boolean) => {
    const li = list.current?.querySelector<HTMLLIElement>(`[data-lane="${id}"]`);
    if (!li) return;
    const last = Number(li.dataset.last) || 1;
    li.style.setProperty('--pos', String(Math.min(1, Math.max(0, frame / last))));
    const out = li.querySelector<HTMLElement>('[data-frame]');
    if (out) out.textContent = two(frame);
    const input = li.querySelector<HTMLInputElement>('input');
    if (input && syncInput) {
      input.value = String(frame);
      input.setAttribute('aria-valuetext', valueText(frame, last));
    }
  };

  useImperativeHandle(api, () => ({ update: (id, frame) => show(id, frame, !scrubbing.current.has(id)) }), []);

  return (
    <section className={styles.timeline} aria-labelledby={`${uid}h`}>
      <header className={styles.timelineHead}>
        <h4 id={`${uid}h`} className={styles.timelineTitle}>Timeline <span>{fps} fps</span></h4>
        <ul className={styles.legend} aria-label="Segments">
          <li data-kind="wind">wind&#8209;up</li><li data-kind="on">on</li><li data-kind="off">off</li>
        </ul>
      </header>
      <ol ref={list} className={styles.lanes}>
        {lanes.map((l) => {
          const [a, b] = l.segments.on;
          const last = (l.segments.off ?? l.segments.on)[1];
          const wind = l.segments.hover?.on ?? 0;
          if (!seed.current.has(l.id)) seed.current.set(l.id, l.rest);
          const first = seed.current.get(l.id) ?? 0;
          const pct = (f: number) => `${(f / last) * 100}%`;
          const end = () => {
            if (!scrubbing.current.delete(l.id)) return;
            l.release();
          };
          return (
            <li key={l.id} data-lane={l.id} data-last={last} className={styles.lane} style={{ '--pos': first / last } as CSSProperties}>
              <label htmlFor={`${uid}${l.id}`} className={styles.laneName}>{l.name}<span className={styles.srOnly}> timeline</span></label>
              <div className={styles.laneTrack}>
                <span className={styles.seg} data-kind="wind" style={{ left: pct(a), width: pct(wind) }} />
                <span className={styles.seg} data-kind="on" style={{ left: pct(a + wind), width: pct(b - a - wind) }} />
                {l.segments.off ? <span className={styles.seg} data-kind="off" style={{ left: pct(l.segments.off[0]), width: pct(l.segments.off[1] - l.segments.off[0]) }} /> : null}
                <span className={styles.head} aria-hidden="true" />
                <input
                  id={`${uid}${l.id}`}
                  className={styles.scrubber}
                  type="range"
                  min={0}
                  max={last}
                  step={1}
                  defaultValue={first}
                  aria-valuetext={valueText(first, last)}
                  onPointerDown={(ev) => {
                    scrubbing.current.add(l.id);
                    try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* not capturable */ }
                  }}
                  onKeyDown={(ev) => { if (STEP_KEYS.has(ev.key)) scrubbing.current.add(l.id); }}
                  onInput={(ev) => {
                    scrubbing.current.add(l.id);
                    const f = Number(ev.currentTarget.value);
                    show(l.id, f, false);
                    ev.currentTarget.setAttribute('aria-valuetext', valueText(f, last));
                    l.scrub(f);
                  }}
                  onPointerUp={end}
                  onPointerCancel={end}
                  onLostPointerCapture={end}
                  onBlur={end}
                />
              </div>
              <span data-frame="" className={styles.frameNo} aria-hidden="true">{two(first)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
