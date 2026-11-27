'use client';
import { forwardRef, useId, type CSSProperties } from 'react';
import { CONTOURS, sectionLabel, type ValleyGeometry } from './valley';
import s from './styles.module.css';

/**
 * The survey drawing. Every animated path carries a data-k key so `createPainter` can rewrite it per frame. Contours
 * carry their height (--k) so the pointer can tilt the relief: higher ground shifts further, the river stays put.
 */
export const ValleySvg = forwardRef<SVGSVGElement, { g: ValleyGeometry; label?: string; labelId?: string }>(function ValleySvg({ g, label, labelId }, ref) {
  const named = label || labelId;
  const y = g.y.toFixed(1);
  const clip = `${useId()}paper`;
  return (
    <svg
      ref={ref}
      className={s.plan}
      viewBox="0 0 600 800"
      preserveAspectRatio="xMidYMid meet"
      role={named ? 'img' : undefined}
      aria-label={label}
      aria-labelledby={labelId}
      aria-hidden={named ? undefined : true}
      focusable="false"
    >
      <defs><clipPath id={clip}><rect x="0" y="0" width="600" height="800" /></clipPath></defs>
      <rect className={s.paper} x="0" y="0" width="600" height="800" />
      <g clipPath={`url(#${clip})`}>
        <g className={s.grid} aria-hidden="true">
          {[100, 200, 300, 400, 500].map((x) => <path key={`x${x}`} d={`M${x} 0V800`} />)}
          {[100, 200, 300, 400, 500, 600, 700].map((yy) => <path key={`y${yy}`} d={`M0 ${yy}H600`} />)}
        </g>
        <path data-k="floor" className={s.floor} d={g.floor} />
        {Array.from({ length: CONTOURS * 2 }, (_, i) => (
          <path key={i} data-k={`c${i}`} className={Math.floor(i / 2) % 4 === 3 ? s.contourIndex : s.contour} d={g.contours[i]} style={{ '--k': Math.floor(i / 2) + 1 } as CSSProperties} />
        ))}
        <path data-k="terr" className={s.terrace} d={g.terraces} opacity={g.terraceOpacity} style={{ '--k': 0.6 } as CSSProperties} />
        <path data-k="scar" className={s.scar} d={g.scar} opacity={g.scarOpacity} />
        <path data-k="bars" className={s.bars} d={g.bars} opacity={g.barsOpacity} />
        <path data-k="oxbow" className={s.oxbow} d={g.oxbow} opacity={g.oxbowOpacity} strokeWidth={g.width + 1.5} />
        <path data-k="chan" className={s.channel} d={g.channel} strokeWidth={g.width} />
        <path data-k="flow" className={s.flow} d={g.channel} strokeWidth={g.width * 0.34} />
        <path data-k="breach" className={s.channel} d={g.breach} strokeWidth={g.breachWidth} />
      </g>

      {/* Section line A–A′ (movable), north point, scale note */}
      <path data-k="secline" className={s.sectionLine} d={`M24 ${y}H576`} />
      <text data-k="secA" className={s.mapLabel} x="24" y={(g.y - 8).toFixed(1)}>A</text>
      <text data-k="secA2" className={s.mapLabel} x="550" y={(g.y - 8).toFixed(1)}>A′</text>
      <g data-k="secknob" className={s.secKnob} transform={`translate(584 ${y})`}>
        <circle className={s.secKnobShadow} r="13" cx="2" cy="3" />
        <circle r="13" />
        <path d="M-5 -4h10M-5 0h10M-5 4h10" />
      </g>
      <g transform="translate(548 52)">
        <path className={s.north} d="M0 -26L9 10L0 4L-9 10Z" />
        <text className={s.mapLabel} x="-4" y="30">N</text>
      </g>
      <text className={s.mapLabel} x="24" y="40">The Vell · plan</text>

      {/* Cross-section inset: follows the section line */}
      <g transform="translate(320 662)">
        <rect className={s.inset} x="0" y="0" width="260" height="122" rx="6" />
        <path data-k="ground" className={s.ground} d={g.ground} />
        <path data-k="still" className={s.stillWater} d={g.still} />
        <path data-k="water" className={s.water} d={g.water} />
        <text data-k="seclabel" className={s.mapLabel} x="12" y="20">{sectionLabel(g)}</text>
      </g>
      <text className={s.mapLabel} x="24" y="780">Schematic · not to scale</text>
    </svg>
  );
});
