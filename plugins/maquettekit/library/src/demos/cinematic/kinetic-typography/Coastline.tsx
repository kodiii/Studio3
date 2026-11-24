'use client';
import { useEffect, useId, useRef } from 'react';
import { useRafLoop } from '../../../motion';
import s from './styles.module.css';

export const AREAS = ['Skerrow', 'Brannock', 'Hollin Bank', 'Tarrow Deep', 'The Dray', 'Fennick', 'Low Marra', 'Ossel'] as const;

const COAST = 'M-20 120C80 110 120 190 200 170S300 90 380 140S470 250 560 220S660 150 720 210S800 330 900 300S1010 240 1060 320S1150 420 1220 400';
const TEXT_LINE = 'M-20 196C90 186 130 256 210 241S310 171 390 211S480 316 570 291S670 226 730 281S810 396 910 371S1020 311 1070 391S1160 486 1220 471';
const DEPTH_A = 'M-20 286C120 276 200 330 300 316S470 300 560 356S760 420 900 430S1100 470 1220 540';
const DEPTH_B = 'M-20 392C160 380 260 420 380 420S560 440 680 480S900 540 1000 580';
const SOUNDINGS: readonly [number, number, string][] = [
  [80, 330, '14'], [250, 370, '22'], [420, 352, '19'], [620, 420, '31'], [760, 470, '38'], [960, 500, '44'],
  [520, 470, '27'], [330, 470, '25'], [140, 480, '18'], [1110, 520, '47'], [880, 410, '29'], [690, 330, '16'],
];
const TEXT = AREAS.join('  ·  ');
const LAND = `${COAST}L1220 -20L-20 -20Z`;

/** Sea-area names set along the coast on an SVG textPath. They drift like a slow ticker (pausable) and borrow speed from scrolling. */
export function Coastline({ moving }: { moving: boolean }) {
  const ids = useId();
  const pathId = `${ids}-coast-text`;
  const root = useRef<SVGSVGElement>(null);
  const textEl = useRef<SVGTextElement>(null);
  const tp = useRef<SVGTextPathElement>(null);
  const sim = useRef({ x: 0, copy: 0, impulse: 0, boost: 0, lastY: 0 });

  // One copy's length (the text holds two copies so the loop is seamless); re-measured once fonts arrive.
  useEffect(() => {
    let alive = true;
    const measure = () => { if (alive && textEl.current) sim.current.copy = textEl.current.getComputedTextLength() / 2; };
    measure();
    void document.fonts?.ready.then(measure);
    return () => { alive = false; };
  }, [moving]);

  useEffect(() => {
    if (!moving) return;
    sim.current.lastY = window.scrollY;
    const onScroll = () => { const y = window.scrollY; sim.current.impulse += y - sim.current.lastY; sim.current.lastY = y; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [moving]);

  useRafLoop(root, (dt) => {
    const m = sim.current;
    if (dt <= 0 || !m.copy || !tp.current) return;
    const v = Math.max(-900, Math.min(900, (m.impulse / dt) * 0.6));
    m.impulse = 0;
    m.boost += (v - m.boost) * (1 - Math.exp(-dt * (Math.abs(v) > Math.abs(m.boost) ? 8 : 2.5)));
    m.x = (((m.x + (32 + Math.abs(m.boost)) * dt) % m.copy) + m.copy) % m.copy;
    tp.current.setAttribute('startOffset', (-m.x).toFixed(1));
  }, moving);

  useEffect(() => { if (!moving) { sim.current.x = 0; tp.current?.setAttribute('startOffset', '0'); } }, [moving]);

  return (
    <svg ref={root} className={s.chart} viewBox="0 0 1200 560" role="img" aria-labelledby={`${ids}-t ${ids}-d`} focusable="false" data-moving={moving || undefined}>
      <title id={`${ids}-t`}>Chart of the inner waters (fictional)</title>
      <desc id={`${ids}-d`}>The sea areas are read in order along the coast: {AREAS.join(', ')}.</desc>
      <defs>
        <path id={pathId} d={TEXT_LINE} />
        <clipPath id={`${ids}-land`}><path d={LAND} /></clipPath>
      </defs>
      <path className={s.land} d={LAND} />
      <g className={s.hatch} clipPath={`url(#${ids}-land)`}>
        {Array.from({ length: 22 }, (_, i) => <path key={i} d={`M${i * 64} -20l-460 480`} />)}
      </g>
      <path className={s.coast} d={COAST} />
      <path className={s.depth} d={DEPTH_A} />
      <path className={s.depth} d={DEPTH_B} />
      {SOUNDINGS.map(([x, y, n]) => <text key={`${x}-${y}`} className={s.sounding} x={x} y={y}>{n}</text>)}
      <g className={s.rose} transform="translate(1090 150)">
        <circle r="34" />
        <path d="M0 -48V48M-48 0H48M-24 -24L24 24M24 -24L-24 24" />
        <path className={s.roseN} d="M0 -46L7 -8H-7Z" />
        <text x="-5" y="-54">N</text>
      </g>
      <text ref={textEl} className={s.areaText}>
        <textPath ref={tp} href={`#${pathId}`} startOffset="0">{moving ? `${TEXT}  ·  ${TEXT}  ·  ` : TEXT}</textPath>
      </text>
    </svg>
  );
}
