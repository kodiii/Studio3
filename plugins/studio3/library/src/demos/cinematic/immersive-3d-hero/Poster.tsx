'use client';
import { useId, useMemo } from 'react';
import s from './styles.module.css';

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Ridgeline print of Kelda Ridge: stacked contour silhouettes, the route, aurora bands, stars. Theme colours via CSS. */
export function Poster({ className }: { className?: string }) {
  const id = useId();
  const art = useMemo(() => {
    const shape = (x: number, k: number) =>
      260 * Math.exp(-(((x - 980 - k * 6) / 360) ** 2)) + 150 * Math.exp(-(((x - 430 + k * 4) / 250) ** 2)) + 22 * Math.sin(x / 61 + k * 0.9) + 12 * Math.sin(x / 23 - k);
    const ridges = Array.from({ length: 15 }, (_, k) => {
      const base = 520 + k * 34;
      const amp = 0.55 + k * 0.035;
      const pts: string[] = [];
      for (let x = -20; x <= 1620; x += 20) pts.push(`${x} ${r1(base - shape(x, k) * amp)}`);
      return { d: `M${pts.join('L')}L1620 1020L-20 1020Z`, index: k % 5 === 4, top: r1(base - shape(800, k) * amp) };
    });
    const route: string[] = [];
    for (let x = 300; x <= 1340; x += 20) route.push(`${x} ${r1(520 + 9 * 34 - shape(x, 9) * (0.55 + 9 * 0.035) - 10)}`);
    let h = 9;
    const rnd = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
    const stars = Array.from({ length: 150 }, () => ({ x: r1(rnd() * 1600), y: r1(rnd() * 470), r: r1(0.8 + rnd() * 1.7) }));
    const bands = [0, 1, 2].map((b) => {
      const top: string[] = [];
      const bottom: string[] = [];
      for (let x = 380; x <= 1500; x += 28) {
        const w = Math.sin((x - 380) / 1120 * Math.PI);
        const y = 150 + b * 70 + 40 * Math.sin(x / 140 + b) + 18 * Math.sin(x / 47 - b * 2);
        top.push(`${x} ${r1(y - 70 * w)}`);
        bottom.unshift(`${x} ${r1(y + 20 * w)}`);
      }
      return `M${top.join('L')}L${bottom.join('L')}Z`;
    });
    return { ridges, route: `M${route.join('L')}`, stars, bands };
  }, []);

  return (
    <svg className={`${s.poster} ${className ?? ''}`} viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}sky`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" className={s.pSkyTop} />
          <stop offset="0.75" className={s.pHorizon} />
        </linearGradient>
        <linearGradient id={`${id}aur`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" className={s.pAurB} />
          <stop offset="0.55" className={s.pAurA} />
          <stop offset="1" className={s.pAurFade} />
        </linearGradient>
      </defs>
      <rect width="1600" height="1000" fill={`url(#${id}sky)`} />
      {art.stars.map((st, i) => <circle key={i} className={s.pStar} cx={st.x} cy={st.y} r={st.r} />)}
      {art.bands.map((d, i) => <path key={i} d={d} fill={`url(#${id}aur)`} className={s.pBand} />)}
      {art.ridges.map((r, i) => (
        <g key={i}>
          <path d={r.d} className={r.index ? s.pRidgeIndex : s.pRidge} />
          {i === 9 ? <path d={art.route} className={s.pRoute} /> : null}
        </g>
      ))}
    </svg>
  );
}
