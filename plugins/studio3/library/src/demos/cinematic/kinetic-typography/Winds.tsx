'use client';
import { useRef, type CSSProperties } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import s from './styles.module.css';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Sample forecast (fictional areas). `from` is the compass bearing the wind blows from. */
const WINDS = [
  { area: 'Skerrow', wind: 'Southwest 3 or 4', force: 3.5, from: 225 },
  { area: 'Brannock', wind: 'Southwest 4, increasing 6', force: 5, from: 225 },
  { area: 'Hollin Bank', wind: 'South 5 to 7', force: 6, from: 180 },
  { area: 'Tarrow Deep', wind: 'Southerly gale 8', force: 8, from: 180 },
  { area: 'The Dray', wind: 'Southeast 7 to severe gale 9', force: 9, from: 135 },
  { area: 'Fennick', wind: 'Variable 2, becoming west 4', force: 2.5, from: 270 },
] as const;

/** Wind force → variable axes: calm is light, wide and text-sized in optics; a gale is heavy, narrow, display-cut. */
export const axes = (force: number) => ({ wght: Math.round(220 + force * 64), wdth: +(100 - force * 2.6).toFixed(1), opsz: +(12 + force * 9.3).toFixed(1) });
const CALM = { wght: 300, wdth: 100, opsz: 12 };
const vars = (a: { wght: number; wdth: number; opsz: number }) => ({ '--wght': a.wght, '--wdth': a.wdth, '--opsz': a.opsz }) as CSSProperties;

export function Winds({ reduced }: { reduced: boolean }) {
  const root = useRef<HTMLOListElement>(null);

  useGSAP(() => {
    const list = root.current;
    if (reduced || !list) return;
    const rows = gsap.utils.toArray<HTMLElement>('[data-row]', list);
    // Each row swells from calm to its force as it rises through the lower half of the screen (scrubbed).
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: list, start: 'top 82%', end: 'bottom 48%', scrub: 0.5, invalidateOnRefresh: true },
    });
    rows.forEach((row, i) => {
      const a = axes(Number(row.dataset.force));
      tl.fromTo(row, { '--wght': CALM.wght, '--wdth': CALM.wdth, '--opsz': CALM.opsz }, { '--wght': a.wght, '--wdth': a.wdth, '--opsz': a.opsz, duration: 1 }, i * 0.6);
    });
    // Gusts: scroll velocity leans the whole list for a moment, then it settles back upright.
    const lean = gsap.quickTo(list, 'skewX', { duration: 0.45, ease: 'power3.out' });
    const settle = gsap.delayedCall(0.14, () => lean(0)).pause();
    ScrollTrigger.create({
      trigger: list,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => { lean(gsap.utils.clamp(-7, 7, self.getVelocity() / -320)); settle.restart(true); },
    });
  }, { scope: root, dependencies: [reduced], revertOnUpdate: true });

  return (
    <ol ref={root} className={s.winds}>
      {WINDS.map((w) => (
        <li key={w.area} className={s.windRow} data-row="" data-force={w.force} style={vars(axes(w.force))}>
          <span className={s.windArea}>{w.area}</span>
          <span className={s.windText} data-gale={w.force >= 8 || undefined}>
            <svg className={s.arrow} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ rotate: `${w.from + 180}deg` }}>
              <path d="M12 3v18M12 3l-6 7M12 3l6 7" />
            </svg>
            {w.wind}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A static specimen strip: the same two letters at forces 2–9. */
export function ForceScale() {
  return (
    <figure className={s.scale}>
      <div className={s.scaleRow} aria-hidden="true">
        {[2, 3, 4, 5, 6, 7, 8, 9].map((f) => (
          <span key={f} className={s.scaleCell}>
            <span className={s.scaleGlyph} style={vars(axes(f))}>Aa</span>
            <span className={s.scaleNum}>F{f}</span>
          </span>
        ))}
      </div>
      <figcaption className={s.scaleCap}>Weight, width and optical size follow the wind force: light and wide is calm, heavy and narrow is a gale. Every row also states its force in words.</figcaption>
    </figure>
  );
}
