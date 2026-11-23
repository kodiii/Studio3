/**
 * International maritime signal flags (public-domain shapes) used as account marks and as the town's banner,
 * plus the flat drawings behind some story cards. All decorative: callers provide the words.
 */
import type { ReactNode } from 'react';
import type { Flag, Segment } from './data';

const C = { red: '#c8262c', yellow: '#f2c230', blue: '#2456a6', navy: '#1b2a4e', white: '#fbfaf6', black: '#16181d' };

const FLAGS: Record<Flag | 'E' | 'R' | 'Y', ReactNode> = {
  H: <><rect width="15" height="20" fill={C.white} /><rect x="15" width="15" height="20" fill={C.red} /></>,
  B: <path d="M0 0h30l-9 10 9 10H0z" fill={C.red} />,
  L: <><rect width="30" height="20" fill={C.black} /><rect width="15" height="10" fill={C.yellow} /><rect x="15" y="10" width="15" height="10" fill={C.yellow} /></>,
  F: <><rect width="30" height="20" fill={C.white} /><path d="M15 1.500 28 10 15 18.500 2 10z" fill={C.red} /></>,
  G: <>{[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={i * 5} width="5" height="20" fill={i % 2 ? C.blue : C.yellow} />)}</>,
  E: <><rect width="30" height="10" fill={C.blue} /><rect y="10" width="30" height="10" fill={C.red} /></>,
  R: <><rect width="30" height="20" fill={C.red} /><rect x="12.500" width="5" height="20" fill={C.yellow} /><rect y="7.500" width="30" height="5" fill={C.yellow} /></>,
  Y: <><rect width="30" height="20" fill={C.yellow} />{[-20, -8, 4, 16, 28].map((x) => <path key={x} d={`M${x} 20 ${x + 20} 0h6L${x + 6} 20z`} fill={C.red} />)}</>,
};

export function FlagMark({ flag, className }: { flag: keyof typeof FLAGS; className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
      {FLAGS[flag]}
      {flag === 'H' || flag === 'F' ? <rect x="0.250" y="0.250" width="29.500" height="19.500" fill="none" stroke="#16181d" strokeOpacity="0.25" strokeWidth="0.500" /> : null}
    </svg>
  );
}

/** "ELLERY" spelled in signal flags. */
export function FlagBanner({ className }: { className?: string }) {
  const word = ['E', 'L', 'L', 'E', 'R', 'Y'] as const;
  return (
    <svg viewBox="0 0 204 30" className={className} aria-hidden="true" focusable="false">
      <path d="M0 4.500h204" stroke="currentColor" strokeWidth="1" />
      {word.map((f, i) => (
        <g key={i} transform={`translate(${6 + i * 33} 5)`}>
          <svg width="30" height="20" viewBox="0 0 30 20">{FLAGS[f]}</svg>
        </g>
      ))}
    </svg>
  );
}

/** Flat drawings behind some cards; colours follow the card's field via currentColor. */
export function CardArt({ art }: { art: NonNullable<Segment['art']> }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (art) {
    case 'tide': return <svg viewBox="0 0 200 100" aria-hidden="true" focusable="false"><path d="M0 80C40 80 60 18 100 18s60 62 100 62" {...common} /><path d="M100 18v-10" {...common} /><circle cx="100" cy="18" r="5" fill="currentColor" /></svg>;
    case 'wind': return <svg viewBox="0 0 200 100" aria-hidden="true" focusable="false"><path d="M40 20l110 60M150 80l-26-2M150 80l-12-23" {...common} strokeWidth={5} /><path d="M40 20l-6 14M52 27l-6 14M64 34l-6 14" {...common} /></svg>;
    case 'bun': return <svg viewBox="0 0 200 100" aria-hidden="true" focusable="false"><path d="M20 84h160" {...common} />{[50, 100, 150].map((x) => <g key={x}><ellipse cx={x} cy={62} rx={22} ry={17} fill="currentColor" /><path d={`M${x - 10} 58c5-5 15-5 20 0`} stroke="#1b2a4e" strokeWidth={2.5} fill="none" strokeLinecap="round" /></g>)}</svg>;
    case 'boat': return <svg viewBox="0 0 200 100" aria-hidden="true" focusable="false"><path d="M20 70c30-10 40 10 80 0s50-10 80 0" {...common} /><path d="M50 60h100l-14 16H66z" fill="currentColor" /><path d="M86 60V36h30l10 24" {...common} /><path d="M100 36V22" {...common} /></svg>;
    case 'ferry': return <svg viewBox="0 0 200 100" aria-hidden="true" focusable="false"><path d="M0 70h40M160 70h40" {...common} strokeWidth={6} /><path d="M60 62h80l-8 12H68z" fill="currentColor" /><path d="M78 62V48h36v14M92 48v-8" {...common} /><path d="M40 82c40 6 80 6 120 0" {...common} strokeDasharray="6 8" /></svg>;
    case 'knot': return <svg viewBox="0 0 200 100" aria-hidden="true" focusable="false"><path d="M30 50c30 0 40-34 70-34s34 34 0 34-40 34-70 34M100 50c30 0 40 34 70 34" {...common} strokeWidth={6} /></svg>;
  }
}
