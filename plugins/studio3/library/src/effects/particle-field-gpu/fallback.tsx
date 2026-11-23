'use client';
/** No-WebGL fallback: streamlines of the very same flow field, integrated in JS and drawn once as SVG paths. */
import { useMemo } from 'react';
import { velocity } from './flow';

const W = 600, H = 360, S = H / 4.66; // the WebGL view is ~4.66 world units tall

export function FlowLines() {
  const paths = useMemo(() => {
    const out: { d: string; accent: boolean }[] = [];
    let k = 0;
    for (let gy = -2.2; gy <= 2.2; gy += 0.3) {
      for (let gx = -4.6; gx <= 3.2; gx += 0.95) {
        let x = gx + ((k * 0.37) % 0.4), y = gy + ((k * 0.21) % 0.2);
        let d = `M${(W / 2 + x * S).toFixed(1)} ${(H / 2 - y * S).toFixed(1)}`;
        for (let i = 0; i < 26; i++) {
          const [vx, vy] = velocity(x * 0.8, y * 0.8, 7.5 * 0.12);
          x += vx * 0.07; y += vy * 0.07;
          d += `L${(W / 2 + x * S).toFixed(1)} ${(H / 2 - y * S).toFixed(1)}`;
        }
        out.push({ d, accent: k % 11 === 0 });
        k++;
      }
    }
    return out;
  }, []);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Still drawing of the flow field: fine streamlines drifting left to right, braiding into slow eddies." style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill="none" strokeWidth={p.accent ? 1.4 : 0.9} strokeLinecap="round" style={{ stroke: p.accent ? 'var(--s3-signal, #bf2f09)' : 'var(--s3-ink-muted, #5c5a52)' }} />
      ))}
    </svg>
  );
}
