'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { spring, springToLinear, useInView, useStudioMotion } from '../../../motion';
import { resolveParams, type EffectMeta, type ParamValues } from '../../../types';
import VariableWeightWave from '../../../effects/variable-weight-wave';
import { meta as waveMeta } from '../../../effects/variable-weight-wave/meta';
import ScrambleDecode from '../../../effects/scramble-decode';
import { meta as scrambleMeta } from '../../../effects/scramble-decode/meta';
import SplitLineReveal from '../../../effects/split-line-reveal';
import { meta as splitMeta } from '../../../effects/split-line-reveal/meta';
import KineticMarquee from '../../../effects/kinetic-marquee';
import { meta as marqueeMeta } from '../../../effects/kinetic-marquee/meta';
import { AREAS, Coastline } from './Coastline';
import { Dial } from './Dial';
import { ForceScale, Winds } from './Winds';
import s from './styles.module.css';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Every recipe param from its meta (defaults), then this demo's overrides. */
const recipe = <T,>(m: EffectMeta, overrides: ParamValues = {}): T => resolveParams(m.params, overrides) as unknown as T;

/** Default lamp: upper left. Shadows (--kt-sx/--kt-sy, −1…1) fall away from it. */
const LAMP = { x: 0.22, y: 0.12 };

/** Mounts a time-based recipe only once it is well inside the viewport, so its entrance is actually seen. */
function OnView({ children, placeholder, className }: { children: ReactNode; placeholder: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { amount: 0.45 });
  const { reduced } = useStudioMotion();
  return <div ref={ref} className={className}>{near || reduced ? children : placeholder}</div>;
}

function Cue({ time, children, className, labelledBy }: { time: string; children: ReactNode; className?: string; labelledBy?: string }) {
  return (
    <section className={`${s.cue} ${className ?? ''}`} aria-labelledby={labelledBy}>
      <p className={s.time} aria-hidden="true">{time}</p>
      <div className={s.cueBody}>{children}</div>
    </section>
  );
}

export default function KineticTypography() {
  const { reduced } = useStudioMotion();
  const [paused, setPaused] = useState(false);
  const moving = !reduced && !paused;
  const root = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const lamp = useRef<HTMLDivElement>(null);
  const marquee = useRef<HTMLDivElement>(null);
  const press = useState(() => springToLinear(spring.press))[0];

  // Trigger refreshes for the wind list: every trigger on the page depends on fonts and on the frame width.
  useGSAP(() => {
    const el = root.current;
    if (reduced || !el) return;
    let width = el.clientWidth;
    let timer = 0;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 140);
    });
    ro.observe(el);
    let alive = true;
    void document.fonts?.ready.then(() => { if (alive) ScrollTrigger.refresh(); });
    return () => { alive = false; ro.disconnect(); window.clearTimeout(timer); };
  }, { scope: root, dependencies: [reduced], revertOnUpdate: true });

  // The pointer is a desk lamp: a warm pool follows it and the display type's shadows swing away from it. Damped,
  // one rAF loop that sleeps once settled; mouse and pen only (on touch the lamp stays upper left).
  useEffect(() => {
    const el = root.current;
    const pool = lamp.current;
    if (!el || !pool || reduced) return;
    const st = { tx: -1, ty: -1, x: -1, y: -1, cx: -1, cy: -1, raf: 0, last: 0, key: '' };
    const place = () => {
      const r = pool.getBoundingClientRect();
      if (st.cx < 0) return;
      st.tx = st.cx - r.left;
      st.ty = st.cy - r.top;
      if (st.x < 0) { st.x = st.tx; st.y = st.ty; }
    };
    const tick = (now: number) => {
      st.raf = 0;
      const dt = Math.min(0.05, st.last ? (now - st.last) / 1000 : 0.016);
      st.last = now;
      const k = 1 - Math.exp(-dt * 7);
      st.x += (st.tx - st.x) * k;
      st.y += (st.ty - st.y) * k;
      const w = Math.max(1, pool.clientWidth);
      const h = Math.max(1, pool.clientHeight);
      const sx = Math.max(-1, Math.min(1, (0.5 - st.x / w) * 2));
      const sy = Math.max(-1, Math.min(1, (0.5 - st.y / h) * 2));
      const key = `${st.x.toFixed(1)} ${st.y.toFixed(1)}`;
      if (key !== st.key) {
        st.key = key;
        pool.style.setProperty('--kt-lamp-x', `${st.x.toFixed(1)}px`);
        pool.style.setProperty('--kt-lamp-y', `${st.y.toFixed(1)}px`);
        el.style.setProperty('--kt-sx', sx.toFixed(3));
        el.style.setProperty('--kt-sy', sy.toFixed(3));
      }
      if (Math.abs(st.tx - st.x) + Math.abs(st.ty - st.y) > 0.3) st.raf = requestAnimationFrame(tick);
      else st.last = 0;
    };
    const wake = () => { if (!st.raf) st.raf = requestAnimationFrame(tick); };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      st.cx = e.clientX;
      st.cy = e.clientY;
      place();
      wake();
    };
    const onScroll = () => { place(); wake(); };
    el.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(st.raf);
      ['--kt-sx', '--kt-sy'].forEach((p) => el.style.removeProperty(p));
      ['--kt-lamp-x', '--kt-lamp-y'].forEach((p) => pool.style.removeProperty(p));
    };
  }, [reduced]);

  // One pause control for the whole piece: the marquee recipe keeps its own button, so mirror the state onto it.
  useEffect(() => {
    const btn = marquee.current?.querySelector<HTMLButtonElement>('button[aria-pressed]');
    if (btn && (btn.getAttribute('aria-pressed') === 'true') !== paused) btn.click();
  }, [paused, reduced]);

  return (
    <div
      ref={root}
      className={s.root}
      data-paused={paused || undefined}
      style={{ '--kt-sx': (0.5 - LAMP.x) * 2, '--kt-sy': (0.5 - LAMP.y) * 2, '--kt-press': press.easing, '--kt-press-dur': `${press.duration}ms` } as CSSProperties}
    >
      <div ref={lamp} className={s.lampPool} aria-hidden="true" />
      <div className={s.bar}>
        <p className={s.station}>
          <span className={s.lamp} aria-hidden="true" />
          <span className={s.stationName}>Radio Haar</span>
          <span>97.4 FM</span>
          <span className={s.fict}>fictional station</span>
        </p>
        {reduced ? (
          <p className={s.barNote}>Reduced motion: all type is still</p>
        ) : (
          <button type="button" className={s.pause} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
              {paused ? <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" /> : <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor" />}
            </svg>
            Pause motion
          </button>
        )}
      </div>

      <section ref={hero} className={`${s.cue} ${s.hero}`}>
        <p className={s.time} aria-hidden="true">00:48:00</p>
        <div className={s.cueBody}>
          <p className={s.kicker}>Inner waters <span aria-hidden="true">·</span> read at 00:48 and 05:20 <span aria-hidden="true">·</span> sample content</p>
          <div className={s.wave}>
            <VariableWeightWave params={recipe(waveMeta, { text: 'The night forecast', minWeight: 250, maxWeight: 800, radius: 1.2, squeeze: true, idle: !paused })} />
          </div>
          <p className={s.voice}>Read slowly, for the boats that are still out.</p>
          <Dial host={hero} reduced={reduced} paused={paused} />
          <p className={s.dialHint} aria-hidden="true">{reduced ? 'Tuned to 97.4' : 'Drag the needle to tune · arrow keys on the dial'}</p>
        </div>
      </section>

      <Cue time="00:48:06" className={s.tune} labelledBy="kt-tune">
        <h2 id="kt-tune" className={s.label}>Tuning in</h2>
        <OnView className={s.decode} placeholder={<p className={s.decodeHold}>Ossel coastguard, 00:48. The forecast for the inner waters for the next 24 hours.</p>}>
          <ScrambleDecode params={recipe(scrambleMeta, { text: 'Ossel coastguard, 00:48. The forecast for the inner waters for the next 24 hours.', duration: 1500, churn: 48, glyphs: 'alphanumeric', seed: 31 })} />
        </OnView>
      </Cue>

      <Cue time="00:48:21" labelledBy="kt-areas">
        <h2 id="kt-areas" className={s.label}>Sea areas, in the order they are read</h2>
        <div className={s.chartFrame}><Coastline moving={moving} /></div>
        <p className={s.areaList}>{AREAS.join(' · ')}</p>
      </Cue>

      <Cue time="00:48:40" labelledBy="kt-wind">
        <h2 id="kt-wind" className={s.label}>Wind</h2>
        <Winds reduced={reduced} />
        <ForceScale />
      </Cue>

      <Cue time="00:49:32" className={s.state}>
        <p className={s.label}>Sea state and visibility</p>
        <OnView placeholder={<h2 className={s.stateHold}>Rough, occasionally very rough. Visibility good, becoming poor in haar.</h2>}>
          <SplitLineReveal params={recipe(splitMeta, { text: 'Rough, occasionally very rough. Visibility good, becoming poor in haar.', stagger: 52, duration: 760, rise: 115, skew: true })} />
        </OnView>
      </Cue>

      <Cue time="00:49:50" className={s.gale} labelledBy="kt-gale">
        <h2 id="kt-gale" className={s.label}>Gale warnings in force</h2>
        <div ref={marquee} className={s.marquee}>
          <KineticMarquee params={recipe(marqueeMeta, { text: 'Tarrow Deep / The Dray / Low Marra / Fennick, later', speed: 64, reactivity: 1.1, skew: 8, direction: 'left', pauseOnHover: true, label: '' })} />
        </div>
      </Cue>

      <Cue time="00:50:14" className={s.end} labelledBy="kt-end">
        <h2 id="kt-end" className={s.endLine}>That was the forecast.</h2>
        <p className={s.next}>The next one is read at 05:20, after the news.</p>
        <p className={s.fine}>Radio Haar, its coast and its sea areas are fictional; every wind, sea state and time on this page is sample content, not a forecast.</p>
      </Cue>
    </div>
  );
}
