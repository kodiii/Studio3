'use client';
import { forwardRef } from 'react';
import { CONTOURS, type ValleyGeometry } from './valley';
import s from './styles.module.css';

/** The survey drawing. Every animated path carries a data-k key so `createPainter` can rewrite it per frame. */
export const ValleySvg = forwardRef<SVGSVGElement, { g: ValleyGeometry; label?: string; labelId?: string }>(function ValleySvg({ g, label, labelId }, ref) {
  const named = label || labelId;
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
      <rect className={s.paper} x="0" y="0" width="600" height="800" />
      <g className={s.grid} aria-hidden="true">
        {[100, 200, 300, 400, 500].map((x) => <path key={`x${x}`} d={`M${x} 0V800`} />)}
        {[100, 200, 300, 400, 500, 600, 700].map((y) => <path key={`y${y}`} d={`M0 ${y}H600`} />)}
      </g>
      <path data-k="floor" className={s.floor} d={g.floor} />
      {Array.from({ length: CONTOURS * 2 }, (_, i) => (
        <path key={i} data-k={`c${i}`} className={Math.floor(i / 2) % 4 === 3 ? s.contourIndex : s.contour} d={g.contours[i]} />
      ))}
      <path data-k="terr" className={s.terrace} d={g.terraces} opacity={g.terraceOpacity} />
      <path data-k="scar" className={s.scar} d={g.scar} opacity={g.scarOpacity} />
      <path data-k="bars" className={s.bars} d={g.bars} opacity={g.barsOpacity} />
      <path data-k="oxbow" className={s.oxbow} d={g.oxbow} opacity={g.oxbowOpacity} strokeWidth={g.width + 1.5} />
      <path data-k="chan" className={s.channel} d={g.channel} strokeWidth={g.width} />
      <path data-k="breach" className={s.channel} d={g.breach} strokeWidth={g.breachWidth} />

      {/* Section line A–A′, north point, scale note */}
      <path className={s.sectionLine} d="M24 612H576" />
      <text className={s.mapLabel} x="24" y="604">A</text>
      <text className={s.mapLabel} x="566" y="604">A′</text>
      <g transform="translate(548 52)">
        <path className={s.north} d="M0 -26L9 10L0 4L-9 10Z" />
        <text className={s.mapLabel} x="-4" y="30">N</text>
      </g>
      <text className={s.mapLabel} x="24" y="40">The Vell · plan</text>

      {/* Cross-section inset */}
      <g transform="translate(320 662)">
        <rect className={s.inset} x="0" y="0" width="260" height="122" rx="6" />
        <path data-k="ground" className={s.ground} d={g.ground} />
        <path data-k="water" className={s.water} d={g.water} />
        <text className={s.mapLabel} x="12" y="20">Section A–A′</text>
      </g>
      <text className={s.mapLabel} x="24" y="780">Schematic · not to scale</text>
    </svg>
  );
});
