'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useInView, useStudioMotion } from '../../../motion';
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
import { ForceScale, Winds } from './Winds';
import s from './styles.module.css';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Every recipe param from its meta (defaults), then this demo's overrides. */
const recipe = <T,>(m: EffectMeta, overrides: ParamValues = {}): T => resolveParams(m.params, overrides) as unknown as T;

const DIAL = { min: 87.5, max: 108, from: 89.1, station: 97.4 };
const fx = (f: number): number => ((f - DIAL.min) / (DIAL.max - DIAL.min)) * 1000;
const TICKS = Array.from({ length: 42 }, (_, i) => DIAL.min + i * 0.5);

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
  const needle = useRef<SVGGElement>(null);
  const readout = useRef<SVGTextElement>(null);
  const marquee = useRef<HTMLDivElement>(null);

  // Tuning: the dial needle sweeps onto the station as the hero scrolls away (scrubbed, so it is reversible).
  useGSAP(() => {
    const el = root.current;
    const h = hero.current;
    const paint = (f: number) => {
      needle.current?.setAttribute('transform', `translate(${fx(f).toFixed(1)} 0)`);
      if (readout.current) readout.current.textContent = f.toFixed(1);
    };
    if (reduced || !el || !h) { paint(DIAL.station); return; }
    const state = { f: DIAL.from };
    paint(state.f);
    gsap.to(state, { f: DIAL.station, ease: 'none', onUpdate: () => paint(state.f), scrollTrigger: { trigger: h, start: 'top top+=44', end: 'bottom 40%', scrub: 0.4 } });

    // Every trigger on the page (here and in the wind list) depends on fonts and on the frame width.
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
    return () => { alive = false; ro.disconnect(); window.clearTimeout(timer); paint(DIAL.station); };
  }, { scope: root, dependencies: [reduced], revertOnUpdate: true });

  // One pause control for the whole piece: the marquee recipe keeps its own button, so mirror the state onto it.
  useEffect(() => {
    const btn = marquee.current?.querySelector<HTMLButtonElement>('button[aria-pressed]');
    if (btn && (btn.getAttribute('aria-pressed') === 'true') !== paused) btn.click();
  }, [paused, reduced]);

  return (
    <div ref={root} className={s.root} data-paused={paused || undefined}>
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
          <svg className={s.dial} viewBox="-12 0 1024 70" aria-hidden="true" focusable="false">
            <path className={s.dialRule} d="M0 40H1000" />
            {TICKS.map((f) => {
              const major = Number.isInteger(f) && f % 4 === 0;
              return <path key={f} className={major ? s.tickMajor : s.tick} d={`M${fx(f).toFixed(1)} ${major ? 22 : 30}V40`} />;
            })}
            {TICKS.filter((f) => Number.isInteger(f) && f % 4 === 0).map((f) => <text key={f} className={s.dialNum} x={fx(f)} y="60">{f}</text>)}
            <g ref={needle} className={s.needle} transform={`translate(${fx(DIAL.station).toFixed(1)} 0)`}>
              <path d="M0 6V44" />
              <circle cy="6" r="4" />
              <text ref={readout} className={s.readout} x="10" y="14">{DIAL.station.toFixed(1)}</text>
            </g>
          </svg>
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
