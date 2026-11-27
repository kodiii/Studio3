'use client';
/**
 * The masthead's FM dial is a real tuner. Drag the band (or click anywhere on it) and the red needle follows with a
 * slight pull into each 0.2 MHz detent, like a notched tuning wheel; let go and a `release` spring carries the throw's
 * velocity into the nearest detent, with a magnetic catch on Quay FM's 98.2. The signal meter (the same lit segments
 * as the poll results) and the frequency readout answer continuously; off-station the masthead says so and offers
 * "Back to 98.2". Keyboard: it is a slider (←/→ 0.2 MHz, Page Up/Down 1 MHz, Home/End the ends of the band).
 * Nothing is played or streamed: the dial only shows where the station is. Reduced motion: the needle jumps to each
 * detent; dragging still follows the pointer.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { animate } from 'motion/react';
import { spring, useStudioMotion } from '../../../motion';
import styles from './styles.module.css';

const LO = 87.6, HI = 108, STEP = 0.2, HOME = 98.2;
const MHZ = [88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108];
const LEDS = 12;
const X0 = 8, W = 384;
const xOf = (f: number) => X0 + ((f - 87.5) / (108 - 87.5)) * W;
const fOf = (x: number) => 87.5 + ((x - X0) / W) * (108 - 87.5);
const clamp = (f: number) => Math.min(HI, Math.max(LO, f));
const detent = (f: number) => Math.round((clamp(f) - LO) / STEP) * STEP + LO;
const fmt = (f: number) => (Math.round(f * 10) / 10).toFixed(1);
/** Signal strength 0..1: full on the station, fading out over ±1.6 MHz. */
const signal = (f: number) => Math.pow(Math.max(0, 1 - Math.abs(f - HOME) / 1.6), 0.8);

export function Tuner() {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const band = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const needle = useRef<SVGGElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const leds = useRef<(HTMLElement | null)[]>([]);
  const freq = useRef(HOME);
  const anim = useRef<{ stop: () => void } | null>(null);
  const drag = useRef<{ id: number; samples: { f: number; t: number }[] } | null>(null);
  const [value, setValue] = useState(HOME);
  const [say, setSay] = useState('');
  const locked = Math.abs(value - HOME) < 0.05;

  const paint = useCallback((f: number) => {
    freq.current = f;
    needle.current?.setAttribute('transform', `translate(${xOf(f).toFixed(2)} 0)`);
    if (readout.current) readout.current.textContent = fmt(f);
    const lit = Math.round(signal(f) * LEDS);
    leds.current.forEach((el, i) => { if (el) el.toggleAttribute('data-on', i < lit); });
    const d = Math.round(detent(f) * 10) / 10;
    setValue((v) => (v === d ? v : d));
  }, []);
  useEffect(() => { paint(HOME); return () => anim.current?.stop(); }, [paint]);

  const settle = useCallback((target: number, velocity = 0) => {
    anim.current?.stop();
    anim.current = null;
    const to = Math.round(target * 10) / 10;
    const announce = () => setSay(Math.abs(to - HOME) < 0.05 ? 'Tuned to Quay FM, 98.2.' : `${fmt(to)} megahertz. No station here; Quay FM is on 98.2.`);
    if (reduced) { paint(to); announce(); return; }
    const a = animate(freq.current, to, { type: 'spring', ...spring.release, velocity, onUpdate: (v) => paint(Math.min(HI + 0.5, Math.max(LO - 0.5, v))) });
    anim.current = a;
    void a.then(() => { if (anim.current === a) { anim.current = null; paint(to); announce(); } });
  }, [paint, reduced]);

  const freqAt = (clientX: number) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return freq.current;
    return fOf(new DOMPoint(clientX, 0).matrixTransform(m.inverse()).x);
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    anim.current?.stop();
    anim.current = null;
    drag.current = { id: e.pointerId, samples: [{ f: freq.current, t: e.timeStamp }] };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.currentTarget.dataset.dragging = '';
    onMove(e);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const raw = freqAt(e.clientX);
    // Rubber band past the ends; a gentle pull into each detent so the dial feels notched.
    const banded = raw < LO ? LO - Math.sqrt(LO - raw) * 0.25 : raw > HI ? HI + Math.sqrt(raw - HI) * 0.25 : raw;
    const f = banded + (detent(banded) - banded) * 0.35;
    paint(f);
    d.samples.push({ f: raw, t: e.timeStamp });
    if (d.samples.length > 6) d.samples.shift();
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    delete e.currentTarget.dataset.dragging;
    const a = d.samples[0], b = d.samples[d.samples.length - 1];
    // MHz per second, clamped to a hard flick (events can arrive a few ms apart and spike the estimate).
    const v = b.t - a.t > 16 ? Math.max(-24, Math.min(24, ((b.f - a.f) / (b.t - a.t)) * 1000)) : 0;
    let target = detent(freq.current + v * 0.12);
    if (Math.abs(target - HOME) <= 0.4) target = HOME; // the station catches the needle
    settle(target, v);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    const base = detent(freq.current);
    const to = k === 'ArrowRight' || k === 'ArrowUp' ? base + STEP : k === 'ArrowLeft' || k === 'ArrowDown' ? base - STEP
      : k === 'PageUp' ? base + 1 : k === 'PageDown' ? base - 1 : k === 'Home' ? LO : k === 'End' ? HI : null;
    if (to === null) return;
    e.preventDefault();
    settle(detent(to));
  };

  return (
    <div className={styles.tuner}>
      <div ref={band} className={styles.band} role="slider" tabIndex={0} aria-label="Tuning dial"
        aria-valuemin={LO} aria-valuemax={HI} aria-valuenow={value}
        aria-valuetext={locked ? '98.2 megahertz, Quay FM' : `${fmt(value)} megahertz, no station`}
        aria-describedby={`${uid}-help`}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}>
        <svg ref={svg} viewBox="0 0 400 64" className={styles.dial} aria-hidden="true" focusable="false">
          <rect x="0" y="0" width="400" height="64" fill="transparent" />
          <path d="M8 40H392" className={styles.dialLine} />
          {Array.from({ length: 103 }, (_, i) => 87.6 + i * 0.2).map((f) => (
            <path key={f.toFixed(1)} d={`M${xOf(f).toFixed(1)} 40v${Math.abs(f - Math.round(f)) < 0.05 ? -10 : -5}`} className={styles.dialTick} />
          ))}
          {MHZ.map((f) => <text key={f} x={xOf(f)} y="58" textAnchor="middle" className={styles.dialNum}>{f}</text>)}
          <path d={`M${xOf(HOME) - 5} 47h10l-5 -5z`} className={styles.station} />
          <g ref={needle} className={styles.needleG}>
            <path d="M0 2V48" className={styles.needleGlow} />
            <path d="M0 4V48" className={styles.needle} />
            <circle cy="4" r="4" className={styles.needleCap} />
          </g>
        </svg>
      </div>
      <div className={styles.tunerBar}>
        <span className={styles.readout}><span ref={readout}>98.2</span> MHz</span>
        <span className={styles.signal} aria-hidden="true">
          {Array.from({ length: LEDS }, (_, i) => <i key={i} ref={(el) => { leds.current[i] = el; }} />)}
        </span>
        <p id={`${uid}-help`} className={styles.tunerText}>
          {locked ? 'Tuned to Quay FM. Drag the dial, or use the arrow keys, to look around the band.' : 'No station here — Quay FM is on 98.2.'}
        </p>
        {locked ? null : <button type="button" className={styles.ghost} onClick={() => { settle(HOME); band.current?.focus(); }}>Back to 98.2</button>}
      </div>
      <p className="mk-sr-only" role="status">{say}</p>
    </div>
  );
}
