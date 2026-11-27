'use client';
import { useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { spring, stepSpring, useRafLoop, type SpringConfig } from '../../../motion';
import s from './styles.module.css';

export const DIAL = { min: 87.5, max: 108, from: 89.1, station: 97.4 };
const fx = (f: number): number => ((f - DIAL.min) / (DIAL.max - DIAL.min)) * 1000;
const TICKS = Array.from({ length: 42 }, (_, i) => DIAL.min + i * 0.5);
/** How clearly the station comes through: 1 on 97.4, gone about half a megahertz either side. */
export const signalAt = (f: number): number => Math.exp(-(((f - DIAL.station) / 0.34) ** 2));
const clampF = (f: number): number => Math.min(DIAL.max, Math.max(DIAL.min, f));

type Mode = 'rest' | 'drag' | 'glide' | 'seek';

/**
 * The tuning dial as an instrument you can handle. Drag the needle (or anywhere on the scale) and it follows with a
 * little weight; let go and it keeps the throw's velocity, slows with friction and is caught by a detent when it passes
 * the station slowly enough. The needle is a real slider: arrows step 0.1 MHz, Page Up/Down 1 MHz, Home/End the ends.
 * It writes --kt-noise (1 − signal) on `host`, so the presenter's line blurs and jitters off-station.
 */
export function Dial({ host, reduced, paused }: { host: RefObject<HTMLElement | null>; reduced: boolean; paused: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const needle = useRef<SVGGElement>(null);
  const shadow = useRef<SVGGElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const readout = useRef<SVGTextElement>(null);
  const m = useRef({
    // Entrance: the radio tunes itself in — a throw from 89.1 that friction slows and the detent catches on 97.4.
    f: reduced ? DIAL.station : DIAL.from, v: reduced ? 0 : 18.5, mode: (reduced ? 'rest' : 'glide') as Mode, target: DIAL.station, cfg: spring.press as SpringConfig,
    delay: reduced ? 0 : 0.45, id: -1, grab: 0, samples: [] as { t: number; f: number }[], jitT: 0, shown: '', bars: -1, noise: -1,
  });

  const paint = () => {
    const st = m.current;
    const x = fx(st.f).toFixed(1);
    needle.current?.setAttribute('transform', `translate(${x} 0)`);
    shadow.current?.setAttribute('transform', `translate(${x} 0)`);
    const shown = st.f.toFixed(1);
    const sig = signalAt(st.f);
    if (shown !== st.shown) {
      st.shown = shown;
      if (readout.current) readout.current.textContent = shown;
      const h = handle.current;
      if (h) {
        h.style.left = `${((fx(st.f) + 12) / 1024) * 100}%`;
        h.setAttribute('aria-valuenow', shown);
        h.setAttribute('aria-valuetext', `${shown} FM, ${sig > 0.85 ? 'Radio Haar, clear' : sig > 0.25 ? 'Radio Haar, faint' : 'static'}`);
      }
    }
    const bars = Math.round(sig * 5);
    if (bars !== st.bars) { st.bars = bars; wrap.current?.setAttribute('data-bars', String(bars)); }
    const noise = 1 - sig;
    if (Math.abs(noise - st.noise) > 0.01 || (noise < 0.01 && st.noise !== 0)) {
      st.noise = noise < 0.01 ? 0 : noise;
      host.current?.style.setProperty('--kt-noise', st.noise.toFixed(3));
      host.current?.toggleAttribute('data-locked', st.noise === 0);
    }
  };

  useEffect(() => {
    const st = m.current;
    if (reduced) { st.f = DIAL.station; st.v = 0; st.mode = 'rest'; }
    st.shown = '';
    st.bars = -1;
    st.noise = -1;
    paint();
    const h = host.current;
    return () => { h?.style.removeProperty('--kt-noise'); h?.style.removeProperty('--kt-jit'); h?.removeAttribute('data-locked'); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useRafLoop(wrap, (dt) => {
    const st = m.current;
    if (dt <= 0) return;
    if (st.delay > 0) { st.delay -= dt; return; }
    const step = (target: number, cfg: SpringConfig) => {
      const a = { x: st.f, v: st.v };
      stepSpring(a, target, cfg, dt);
      st.f = a.x; st.v = a.v;
    };
    if (st.mode === 'drag') step(st.target, spring.press);
    else if (st.mode === 'glide') {
      st.v *= Math.exp(-dt * 2.1);
      st.f += st.v * dt;
      // Past either end of the band the needle meets a soft stop and is pushed back.
      if (st.f < DIAL.min || st.f > DIAL.max) { st.v += (clampF(st.f) - st.f) * 220 * dt; st.v *= Math.exp(-dt * 10); }
      // The detent: passing the station slowly enough, it is caught and pulled in with a small overshoot.
      if (Math.abs(st.f - DIAL.station) < 0.6 && Math.abs(st.v) < 7) { st.mode = 'seek'; st.target = DIAL.station; st.cfg = spring.pop; }
      else if (Math.abs(st.v) < 0.04 && st.f >= DIAL.min && st.f <= DIAL.max) st.mode = 'rest';
    } else if (st.mode === 'seek') {
      step(st.target, st.cfg);
      if (Math.abs(st.f - st.target) < 0.002 && Math.abs(st.v) < 0.01) { st.f = st.target; st.v = 0; st.mode = 'rest'; }
    }
    // Static on the line while detuned: a jitter re-rolled about 20 times a second (frozen by Pause motion).
    const noise = 1 - signalAt(st.f);
    if (!paused && noise > 0.02) {
      st.jitT -= dt;
      if (st.jitT <= 0) { st.jitT = 0.05; host.current?.style.setProperty('--kt-jit', (Math.random() * 2 - 1).toFixed(2)); }
    } else if (noise <= 0.02) host.current?.style.setProperty('--kt-jit', '0');
    if (st.mode !== 'rest' || st.shown !== st.f.toFixed(1)) paint();
  }, !reduced);

  const fAt = (clientX: number): number => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return m.current.f;
    const x = -12 + ((clientX - r.left) / Math.max(1, r.width)) * 1024;
    return DIAL.min + (x / 1000) * (DIAL.max - DIAL.min);
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const st = m.current;
    const at = fAt(e.clientX);
    st.id = e.pointerId;
    // Grabbing the needle keeps the hand's offset; pressing elsewhere on the scale tunes toward that point.
    st.grab = Math.abs(at - st.f) < 0.9 ? st.f - at : 0;
    st.samples = [{ t: performance.now(), f: at + st.grab }];
    st.delay = 0;
    if (reduced) { st.f = clampF(at + st.grab); paint(); }
    else { st.mode = 'drag'; st.target = clampF(at + st.grab); }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* gone */ }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = m.current;
    if (e.pointerId !== st.id) return;
    const raw = fAt(e.clientX) + st.grab;
    // Rubber band past the ends of the band.
    const t = raw < DIAL.min ? DIAL.min - (DIAL.min - raw) * 0.3 : raw > DIAL.max ? DIAL.max + (raw - DIAL.max) * 0.3 : raw;
    if (reduced) { st.f = clampF(t); paint(); return; }
    st.target = t;
    const now = performance.now();
    st.samples.push({ t: now, f: t });
    while (st.samples.length > 2 && now - st.samples[0].t > 100) st.samples.shift();
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = m.current;
    if (e.pointerId !== st.id) return;
    st.id = -1;
    if (reduced) return;
    const a = st.samples[0];
    const b = st.samples[st.samples.length - 1];
    const throwV = a && b && b.t - a.t > 8 ? ((b.f - a.f) / (b.t - a.t)) * 1000 : 0;
    st.v = Math.max(-40, Math.min(40, (st.v + throwV) / 2));
    st.mode = 'glide';
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const st = m.current;
    const from = st.mode === 'seek' ? st.target : st.f;
    const keys: Record<string, number> = { ArrowRight: 0.1, ArrowUp: 0.1, ArrowLeft: -0.1, ArrowDown: -0.1, PageUp: 1, PageDown: -1 };
    let to: number | null = null;
    if (e.key in keys) to = Math.round((from + keys[e.key]) * 10) / 10;
    else if (e.key === 'Home') to = DIAL.min;
    else if (e.key === 'End') to = DIAL.max;
    if (to === null) return;
    e.preventDefault();
    to = clampF(to);
    // Stepping toward the station drops into its detent; stepping away never snaps back.
    if (Math.sign(DIAL.station - from) === Math.sign(to - from) && Math.abs(to - DIAL.station) < 0.25) to = DIAL.station;
    st.delay = 0;
    if (reduced) { st.f = to; st.v = 0; st.mode = 'rest'; paint(); return; }
    st.mode = 'seek';
    st.target = to;
    st.cfg = Math.abs(to - DIAL.station) < 0.05 ? spring.pop : spring.press;
  };

  return (
    <div
      ref={wrap}
      className={s.dialWrap}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <svg className={s.dial} viewBox="-12 0 1024 70" aria-hidden="true" focusable="false">
        <path className={s.dialRule} d="M0 40H1000" />
        {TICKS.map((f) => {
          const major = Number.isInteger(f) && f % 4 === 0;
          return <path key={f} className={major ? s.tickMajor : s.tick} d={`M${fx(f).toFixed(1)} ${major ? 22 : 30}V40`} />;
        })}
        {TICKS.filter((f) => Number.isInteger(f) && f % 4 === 0).map((f) => <text key={f} className={s.dialNum} x={fx(f)} y="60">{f}</text>)}
        <path className={s.stationMark} d={`M${fx(DIAL.station).toFixed(1)} 44V50`} />
        <g ref={shadow} className={s.needleShadow} transform={`translate(${fx(DIAL.from).toFixed(1)} 0)`}>
          <path d="M0 6V44" />
          <circle cy="6" r="5" />
        </g>
        <g ref={needle} className={s.needle} transform={`translate(${fx(DIAL.from).toFixed(1)} 0)`}>
          <path d="M0 6V44" />
          <circle cy="6" r="5" />
          <text ref={readout} className={s.readout} x="11" y="14">{DIAL.from.toFixed(1)}</text>
        </g>
        <g className={s.meter} transform="translate(930 4)">
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={i * 9} y={14 - i * 3} width="5" height={6 + i * 3} rx="1" data-bar={i} />)}
        </g>
      </svg>
      <div
        ref={handle}
        className={s.dialHandle}
        role="slider"
        tabIndex={0}
        aria-label="Tuning"
        aria-valuemin={DIAL.min}
        aria-valuemax={DIAL.max}
        aria-valuenow={DIAL.from}
        aria-valuetext={`${DIAL.from.toFixed(1)} FM, static`}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
