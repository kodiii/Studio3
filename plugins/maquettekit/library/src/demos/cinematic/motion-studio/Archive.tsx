'use client';
/**
 * The archive as a strip of film on the light table. It is a native horizontal scroller (touch, wheel, trackpad,
 * arrow keys once focused); a mouse drag moves it 1:1 and a throw keeps its velocity: the strip glides on a cubic
 * ease-out that starts at the release speed and lands on a frame, or springs back (spring.release) past either end,
 * where the drag meets rubber-band resistance. Adapted from the cursor-follower recipe's archive strip.
 * Reduced motion: the strip stops where you let go.
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { spring as SPRING, stepSpring, useRafLoop, useStudioMotion } from '../../../motion';
import { ARCHIVE } from './content';
import { ArchiveArt } from './art';
import s from './styles.module.css';

interface Axis { x: number; v: number }
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rubberBand = (over: number, d: number, c = 0.55) => (d <= 0 || over === 0 ? 0 : Math.sign(over) * (1 - 1 / ((Math.abs(over) * c) / d + 1)) * d);
/** Release velocity is projected this far ahead (s) to pick the frame the strip glides to. */
const PROJECTION = 0.26;

interface Drag { id: number; x0: number; s0: number; max: number; width: number; moved: boolean; samples: { t: number; x: number }[] }

export function Archive({ headingId, hintId }: { headingId: string; hintId: string }) {
  const { reduced } = useStudioMotion();
  const strip = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const coast = useRef({ mode: 'spring' as 'glide' | 'spring', pos: { x: 0, v: 0 } as Axis, from: 0, target: 0, span: 0, t: 0, max: 0, width: 0, virtual: 0 });
  const [coasting, setCoasting] = useState(false);
  const [dragging, setDragging] = useState(false);

  /** Scroll natively inside the range; past an edge, stretch the strip with rubber-band resistance. */
  const apply = (virtual: number, max: number, width: number) => {
    const el = strip.current;
    if (!el) return;
    const inside = clamp(virtual, 0, max);
    el.scrollLeft = inside;
    const over = reduced ? 0 : virtual - inside;
    const track = el.firstElementChild as HTMLElement | null;
    if (track) track.style.transform = over ? `translate3d(${(-rubberBand(over, width * 0.5)).toFixed(2)}px, 0, 0)` : '';
    coast.current.virtual = virtual;
  };
  const stop = () => {
    if (!coasting) return;
    setCoasting(false);
    const c = coast.current;
    apply(clamp(c.virtual, 0, c.max), c.max, c.width);
  };

  useRafLoop(strip, (dt) => {
    const c = coast.current;
    let x: number;
    let done: boolean;
    if (c.mode === 'glide') {
      c.t = Math.min(c.span, c.t + dt);
      const u = 1 - c.t / c.span;
      x = c.target + (c.from - c.target) * u * u * u;
      done = c.t >= c.span;
    } else {
      done = stepSpring(c.pos, c.target, SPRING.release, dt, { restDelta: 0.3, restSpeed: 3 });
      x = c.pos.x;
    }
    apply(done ? c.target : x, c.max, c.width);
    if (done) setCoasting(false);
  }, coasting && !reduced);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = strip.current;
    if (!el || e.pointerType !== 'mouse' || e.button !== 0) return; // touch and pen scroll natively
    const start = coasting ? coast.current.virtual : el.scrollLeft;
    if (coasting) setCoasting(false);
    coast.current.virtual = start;
    drag.current = { id: e.pointerId, x0: e.clientX, s0: start, max: Math.max(0, el.scrollWidth - el.clientWidth), width: el.clientWidth, moved: false, samples: [{ t: e.timeStamp, x: e.clientX }] };
    el.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    if (!d.moved && Math.abs(e.clientX - d.x0) < 3) return;
    d.moved = true;
    apply(d.s0 - (e.clientX - d.x0), d.max, d.width);
    d.samples.push({ t: e.timeStamp, x: e.clientX });
    while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > 100) d.samples.shift();
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = strip.current;
    if (!d || !el || e.pointerId !== d.id) return;
    drag.current = null;
    setDragging(false);
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    const virtual = coast.current.virtual;
    if (!d.moved) return;
    if (reduced) { apply(clamp(virtual, 0, d.max), d.max, d.width); return; }
    const recent = d.samples.filter((q) => e.timeStamp - q.t <= 80);
    const a = recent[0], b = recent[recent.length - 1];
    const v = a && b && b.t - a.t > 8 && e.timeStamp - b.t < 50 ? -((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-tile]'));
    const first = items[0]?.offsetLeft ?? 0;
    const points = [...items.map((i) => i.offsetLeft - first).filter((p) => p < d.max - 1), d.max];
    const projected = clamp(virtual + v * PROJECTION, 0, d.max);
    const target = points.reduce((best, p) => (Math.abs(p - projected) < Math.abs(best - projected) ? p : best), points[0] ?? 0);
    const c = coast.current;
    c.max = d.max; c.width = d.width; c.target = target; c.from = virtual; c.t = 0; c.pos.x = virtual; c.pos.v = v;
    // Glide when the throw heads for the chosen frame: a span of 3·distance/speed starts the ease-out at the release speed.
    const span = (3 * (target - virtual)) / v;
    const inRange = virtual >= 0 && virtual <= d.max;
    c.mode = inRange && Number.isFinite(span) && span > 0.12 && span < 1.4 ? 'glide' : 'spring';
    c.span = span;
    if (Math.abs(target - virtual) > 0.5 || Math.abs(v) > 1) setCoasting(true);
    else apply(target, d.max, d.width);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key.startsWith('Page')) stop(); };

  return (
    <div className={s.filmFrame}>
      <div
        ref={strip}
        className={s.film}
        tabIndex={0}
        role="region"
        aria-labelledby={headingId}
        aria-describedby={hintId}
        data-cursor-label="Drag"
        data-dragging={dragging || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onWheel={stop}
        onKeyDown={onKeyDown}
      >
        <ol className={s.filmTrack}>
          {ARCHIVE.map((p, i) => (
            <li key={p.title} className={s.filmTile} data-tile="">
              <span className={s.filmNo} aria-hidden="true">{String(i + 1).padStart(2, '0')}A</span>
              <span className={s.filmArt}><ArchiveArt art={p.art} /></span>
              <span className={s.filmCap}><span className={s.filmTitle}>{p.title}</span><span className={s.filmYear}>{p.year}</span></span>
            </li>
          ))}
        </ol>
      </div>
      <div className={s.filmProgress} aria-hidden="true"><span /></div>
    </div>
  );
}
