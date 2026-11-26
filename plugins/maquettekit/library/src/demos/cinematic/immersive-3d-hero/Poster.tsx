'use client';
import { useId, useMemo } from 'react';
import { NIGHT } from './palette';
import s from './styles.module.css';

const r1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Ridgeline print of Kelda Ridge at dusk, in the scene's own night palette: stacked contour silhouettes, the route,
 * the afterglow and the first aurora curtains, stars. Paints with the page (first paint), stays under the canvas, and
 * is the whole picture without WebGL or with 3D turned off.
 */
export function Poster({ className }: { className?: string }) {
  const id = useId();
  const art = useMemo(() => {
    const shape = (x: number, k: number) =>
      260 * Math.exp(-(((x - 980 - k * 6) / 360) ** 2)) + 150 * Math.exp(-(((x - 430 + k * 4) / 250) ** 2)) + 22 * Math.sin(x / 61 + k * 0.9) + 12 * Math.sin(x / 23 - k);
    const ridges = Array.from({ length: 15 }, (_, k) => {
      const base = 540 + k * 34;
      const amp = 0.55 + k * 0.035;
      const pts: string[] = [];
      for (let x = -20; x <= 1620; x += 20) pts.push(`${x} ${r1(base - shape(x, k) * amp)}`);
      return { d: `M${pts.join('L')}L1620 1020L-20 1020Z`, index: k % 5 === 4, k };
    });
    const route: string[] = [];
    for (let x = 300; x <= 1340; x += 20) route.push(`${x} ${r1(540 + 9 * 34 - shape(x, 9) * (0.55 + 9 * 0.035) - 10)}`);
    let h = 9;
    const rnd = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
    const stars = Array.from({ length: 170 }, () => ({ x: r1(rnd() * 1600), y: r1(rnd() * 420), r: r1(0.7 + rnd() * 1.6), o: r1(0.25 + rnd() * 0.7) }));
    // Curtains: a ribbon with a wandering lower edge; rays rise from it.
    const curtains = [0, 1].map((b) => {
      const top: string[] = [];
      const bottom: string[] = [];
      const rays: string[] = [];
      for (let x = 260 + b * 180; x <= 1520 - b * 120; x += 14) {
        const w = Math.sin(((x - 260) / 1260) * Math.PI);
        const y = 250 + b * 64 + 34 * Math.sin(x / 150 + b * 2) + 14 * Math.sin(x / 41 - b);
        bottom.unshift(`${x} ${r1(y)}`);
        top.push(`${x} ${r1(y - (110 + 50 * Math.sin(x / 90 + b)) * w)}`);
        if (Math.round(x / 14) % 3 === 0) rays.push(`M${x} ${r1(y)}V${r1(y - (60 + 120 * rnd()) * w)}`);
      }
      return { d: `M${top.join('L')}L${bottom.join('L')}Z`, rays: rays.join('') };
    });
    return { ridges, route: `M${route.join('L')}`, stars, curtains };
  }, []);

  return (
    <svg className={`${s.poster} ${className ?? ''}`} viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}sky`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={NIGHT.duskTop} />
          <stop offset="0.5" stopColor={NIGHT.duskHorizon} />
        </linearGradient>
        <radialGradient id={`${id}glow`} cx="0.3" cy="0.52" r="0.55" gradientTransform="translate(0.3 0.52) scale(1 0.32) translate(-0.3 -0.52)">
          <stop offset="0" stopColor={NIGHT.afterglow} stopOpacity="0.85" />
          <stop offset="1" stopColor={NIGHT.afterglow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}aur`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={NIGHT.aurViolet} stopOpacity="0" />
          <stop offset="0.6" stopColor={NIGHT.aurViolet} stopOpacity="0.18" />
          <stop offset="1" stopColor={NIGHT.aurGreen} stopOpacity="0.42" />
        </linearGradient>
      </defs>
      <rect width="1600" height="1000" fill={`url(#${id}sky)`} />
      <rect width="1600" height="1000" fill={`url(#${id}glow)`} />
      {art.stars.map((st, i) => <circle key={i} cx={st.x} cy={st.y} r={st.r} fill={NIGHT.star} opacity={st.o} />)}
      {art.curtains.map((c, i) => (
        <g key={i} opacity={i ? 0.6 : 0.9}>
          <path d={c.d} fill={`url(#${id}aur)`} />
          <path d={c.rays} stroke={NIGHT.aurGreen} strokeOpacity="0.22" strokeWidth="3" />
        </g>
      ))}
      {art.ridges.map((r) => (
        <g key={r.k}>
          <path d={r.d} fill={NIGHT.groundDusk} stroke={r.index ? NIGHT.index : NIGHT.line} strokeWidth={r.index ? 1.8 : 1.2} />
          {r.k === 9 ? <path d={art.route} fill="none" stroke={NIGHT.route} strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" /> : null}
        </g>
      ))}
    </svg>
  );
}
