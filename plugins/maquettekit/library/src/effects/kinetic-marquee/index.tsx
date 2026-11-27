'use client';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useRafLoop, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { text: string; speed: number; reactivity: number; skew: number; direction: string; pauseOnHover: boolean; label: string };

/** The secondary rail runs the other way at this fraction of the primary speed. */
const COUNTER = -0.55;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export default function KineticMarquee({ params }: EffectProps<Params>) {
  const { speed, reactivity, skew, pauseOnHover } = params;
  const dir = params.direction === 'right' ? -1 : 1;
  const { reduced } = useStudioMotion();
  const phrases = useMemo(() => {
    const p = params.text.split('/').map((s) => s.trim()).filter(Boolean);
    return p.length ? p : ['Marquee'];
  }, [params.text]);

  const root = useRef<HTMLDivElement>(null);
  const railA = useRef<HTMLDivElement>(null);
  const railB = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const [copies, setCopies] = useState(2);
  const [paused, setPaused] = useState(false);
  // Pause eases the rails to a stop, then the loop sleeps until Play (no frames while paused).
  const [asleep, setAsleep] = useState(false);
  const sim = useRef({ xA: 0, xB: 0, wA: 0, wB: 0, impulse: 0, boost: 0, flow: 1, hover: false, focus: false, lastX: null as number | null, frame: 0 });
  useEffect(() => {
    if (paused) return;
    sim.current.impulse = 0; // scrolling while asleep must not kick the rails on wake
    setAsleep(false);
  }, [paused]);

  // Measure one set per rail; render enough copies to cover the container plus one.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const a = railA.current?.firstElementChild as HTMLElement | null;
      const b = railB.current?.firstElementChild as HTMLElement | null;
      const s = sim.current;
      s.wA = a?.offsetWidth ?? 0;
      s.wB = b?.offsetWidth ?? 0;
      const smallest = Math.min(s.wA || Infinity, s.wB || Infinity);
      if (Number.isFinite(smallest) && smallest > 0) setCopies(clamp(Math.ceil(el.offsetWidth / smallest) + 1, 2, 12));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (railA.current?.firstElementChild) ro.observe(railA.current.firstElementChild);
    measure();
    let alive = true;
    void document.fonts?.ready.then(() => { if (alive) measure(); });
    return () => { alive = false; ro.disconnect(); };
  }, [phrases]);

  // Scroll velocity: any scroller on the page (capture) feeds the same impulse.
  useEffect(() => {
    if (reduced) return;
    const last = new WeakMap<object, number>();
    const onScroll = (e: Event) => {
      const t = e.target === document ? document.scrollingElement : e.target;
      if (!(t instanceof Element)) return;
      const top = t.scrollTop;
      const prev = last.get(t);
      last.set(t, top);
      if (prev !== undefined) sim.current.impulse += top - prev;
    };
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [reduced]);

  useRafLoop(root, (dt) => {
    const s = sim.current;
    if (dt <= 0) return;
    // Raw input velocity in px/s, smoothed into a boost that decays on its own once input stops.
    const v = clamp((s.impulse / dt) * reactivity, -2400, 2400);
    s.impulse = 0;
    s.boost += (v - s.boost) * (1 - Math.exp(-dt * (Math.abs(v) > Math.abs(s.boost) ? 10 : 3.2)));
    const wantFlow = paused || s.focus || (pauseOnHover && s.hover) ? 0 : 1;
    s.flow += (wantFlow - s.flow) * (1 - Math.exp(-dt * 7));
    const velocity = (dir * speed + s.boost) * s.flow;
    const lean = clamp(s.boost * 0.012, -skew, skew) * s.flow;
    if (s.wA > 0 && railA.current) {
      s.xA = (((s.xA + velocity * dt) % s.wA) + s.wA) % s.wA;
      railA.current.style.transform = `translate3d(${(-s.xA).toFixed(2)}px,0,0) skewX(${(-lean).toFixed(2)}deg)`;
    }
    if (s.wB > 0 && railB.current) {
      s.xB = (((s.xB + velocity * COUNTER * dt) % s.wB) + s.wB) % s.wB;
      railB.current.style.transform = `translate3d(${(-s.xB).toFixed(2)}px,0,0) skewX(${(lean * 0.6).toFixed(2)}deg)`;
    }
    if (readout.current && ++s.frame % 6 === 0) {
      const label = `${velocity < 0 ? '−' : ''}${String(Math.round(Math.abs(velocity))).padStart(3, '0')}`;
      if (readout.current.textContent !== label) readout.current.textContent = label;
    }
    if (paused && s.flow < 0.002 && Math.abs(s.boost) < 1) {
      s.flow = 0;
      s.impulse = 0;
      if (readout.current) readout.current.textContent = '000';
      setAsleep(true);
    }
  }, !reduced && !asleep);

  // Reduced motion: rails rest at their origin.
  useEffect(() => {
    if (!reduced) return;
    if (railA.current) railA.current.style.transform = '';
    if (railB.current) railB.current.style.transform = '';
  }, [reduced]);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (s.lastX !== null) s.impulse += (e.clientX - s.lastX) * -1.4;
    s.lastX = e.clientX;
  };
  const onPointerLeave = () => { sim.current.lastX = null; };

  const set = (hidden: boolean, key: number) => (
    <ul key={key} className={styles.set} aria-hidden={hidden || undefined}>
      {phrases.map((p, i) => (
        <li key={i} className={styles.item}>
          <span>{p}</span>
          <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
        </li>
      ))}
    </ul>
  );

  return (
    <div ref={root} className={styles.root} data-reduced={reduced || undefined} onPointerMove={reduced ? undefined : onPointerMove} onPointerLeave={onPointerLeave}>
      <div className={styles.head}>
        {params.label ? <span className={styles.label}>{params.label}</span> : <span aria-hidden="true" />}
        {reduced ? (
          <span className={styles.label}>Motion off</span>
        ) : (
          <span className={styles.controls}>
            <span className={styles.speed} aria-hidden="true"><span ref={readout} className={styles.num}>000</span> px/s</span>
            <button type="button" className={styles.pause} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
              <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                {paused ? <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" /> : <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor" />}
              </svg>
              <span>{paused ? 'Play' : 'Pause'}</span>
              <span className={styles.srOnly}> marquee</span>
            </button>
          </span>
        )}
      </div>
      <div
        className={styles.band}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') sim.current.hover = true; }}
        onPointerLeave={() => { sim.current.hover = false; }}
        onFocus={() => { sim.current.focus = true; }}
        onBlur={() => { sim.current.focus = false; }}
      >
        <div ref={railA} className={styles.rail}>
          {Array.from({ length: copies }, (_, i) => set(i > 0, i))}
        </div>
        <div ref={railB} className={`${styles.rail} ${styles.railSmall}`} aria-hidden="true">
          {Array.from({ length: copies }, (_, i) => (
            <span key={i} className={styles.setSmall}>
              {phrases.map((p, j) => <span key={j} className={styles.itemSmall}>{p}<span className={styles.dot} /></span>)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
