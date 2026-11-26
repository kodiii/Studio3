/**
 * The mended objects, drawn as small SVGs. Each motif has three parts: the object, its visible mend in saffron
 * (the "after" photo) and the damage it came in with (the "before" photo). Decorative — the gallery tile carries the
 * description in words.
 */
import type { ReactNode } from 'react';
import type { Motif } from './data';

const LINE = '#2b3550';
const SAFFRON = '#e3a53c';
const THREAD = '#f3efe6';
const HOLE = '#2b3550';
const stroke = { stroke: LINE, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function Darn({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const v = Array.from({ length: Math.floor(w / 4) }, (_, i) => <path key={`v${i}`} d={`M${x + 2 + i * 4} ${y}v${h}`} />);
  const hz = Array.from({ length: Math.floor(h / 4) }, (_, i) => <path key={`h${i}`} d={`M${x} ${y + 2 + i * 4}h${w}`} strokeDasharray="2 2" strokeDashoffset={i % 2 ? 2 : 0} />);
  return <g stroke={SAFFRON} strokeWidth={1.6}>{v}{hz}</g>;
}

/** A worn-through hole with a few loose yarn ends. */
function Hole({ d, frays }: { d: string; frays: string }) {
  return (
    <>
      <path d={d} fill={HOLE} />
      <path d={frays} fill="none" stroke={LINE} strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
    </>
  );
}

interface Drawing { base: () => ReactNode; mend: () => ReactNode; damage: () => ReactNode }

const DRAW: Record<Motif, Drawing> = {
  jumper: {
    base: () => (
      <>
        <path d="M18 34c10-8 28-10 40-6l48 40-16 22-44-30-10 50H20z" fill="#7d8aa8" {...stroke} />
        <path d="M90 90l16-22" {...stroke} strokeDasharray="3 4" />
      </>
    ),
    mend: () => <Darn x={60} y={52} w={20} h={16} />,
    damage: () => <Hole d="M63 57c4-5 13-4 15 1 3 5-2 11-8 10-6 0-10-6-7-11z" frays="M62 55l-3-3M78 58l4-2M70 67l1 4M66 66l-3 3" />,
  },
  jeans: {
    base: () => <path d="M38 10h46l-4 100H58l-4-58-6 58H34z" fill="#3b4f8a" {...stroke} />,
    mend: () => (
      <>
        <rect x="40" y="56" width="22" height="20" fill="#5d72b0" transform="rotate(-4 51 66)" />
        <rect x="40" y="56" width="22" height="20" fill="none" stroke={THREAD} strokeWidth={1.8} strokeDasharray="3 3" transform="rotate(-4 51 66)" />
      </>
    ),
    damage: () => (
      <>
        <path d="M42 64c4-3 8 1 11-1s6-3 9 0c-3 4-7 2-10 4s-7 2-10-3z" fill={HOLE} />
        <path d="M43 61h18M42 70h19" stroke={THREAD} strokeWidth={1} strokeLinecap="round" opacity={0.8} />
      </>
    ),
  },
  mug: {
    base: () => (
      <>
        <path d="M28 34h52v50a12 12 0 0 1-12 12H40a12 12 0 0 1-12-12z" fill="#4f6fb0" {...stroke} />
        <path d="M80 46h8a12 12 0 0 1 0 24h-8" fill="none" {...stroke} />
      </>
    ),
    mend: () => <path d="M50 34l-4 14 8 10-6 14 6 10-4 14" fill="none" stroke={SAFFRON} strokeWidth={3} strokeLinejoin="round" />,
    damage: () => <path d="M50 34l-4 14 8 10-6 14 6 10-4 14" fill="none" stroke={HOLE} strokeWidth={1.6} strokeLinejoin="round" />,
  },
  lamp: {
    base: () => (
      <>
        <path d="M30 104h44" {...stroke} strokeWidth={4} />
        <path d="M52 104 40 64l34-26" fill="none" {...stroke} strokeWidth={3} />
        <path d="M66 30l26 4-6 26-24-12z" fill="#8c929c" {...stroke} />
      </>
    ),
    mend: () => <path d="M30 104c-10 0-14-14-6-20s22 4 14 14" fill="none" stroke={SAFFRON} strokeWidth={3} strokeLinecap="round" />,
    damage: () => (
      <>
        <path d="M30 104c-10 0-14-14-6-20" fill="none" stroke="#8c929c" strokeWidth={3} strokeLinecap="round" />
        <path d="M30 88c4 0 8 2 8 6" fill="none" stroke="#8c929c" strokeWidth={3} strokeLinecap="round" />
        <path d="M24 84l-3-3M25 84l-1-4M30 88l3-3M30 88l-1-4" stroke="#c0773a" strokeWidth={1.2} strokeLinecap="round" />
      </>
    ),
  },
  tube: {
    base: () => (
      <>
        <circle cx="60" cy="60" r="40" fill="none" stroke="#3a3d44" strokeWidth={12} />
        <circle cx="60" cy="60" r="40" fill="none" stroke={LINE} strokeWidth={1.4} strokeDasharray="2 6" />
      </>
    ),
    mend: () => (
      <>
        <rect x="86" y="30" width="16" height="12" rx="2" fill={SAFFRON} transform="rotate(40 94 36)" />
        <rect x="20" y="70" width="16" height="12" rx="2" fill={SAFFRON} transform="rotate(-70 28 76)" />
      </>
    ),
    damage: () => (
      <>
        <ellipse cx="94" cy="36" rx="3" ry="1.6" fill={THREAD} transform="rotate(40 94 36)" />
        <ellipse cx="28" cy="76" rx="3" ry="1.6" fill={THREAD} transform="rotate(-70 28 76)" />
      </>
    ),
  },
  chair: {
    base: () => (
      <path d="M36 14v92M84 14v92M36 56h48M36 20h48M36 34h48" fill="none" stroke="#a8743f" strokeWidth={6} strokeLinecap="round" />
    ),
    mend: () => (
      <>
        <path d="M40 84h40" stroke="#a8743f" strokeWidth={5} strokeLinecap="round" />
        <rect x="52" y="78" width="16" height="12" fill={SAFFRON} />
        <path d="M52 81h16M52 87h16" stroke={LINE} strokeWidth={1.2} />
      </>
    ),
    damage: () => (
      <>
        <path d="M40 84h15l2 3" fill="none" stroke="#a8743f" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M80 84H66l-3 4" fill="none" stroke="#a8743f" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  teapot: {
    base: () => (
      <>
        <path d="M26 58a34 30 0 0 1 68 0v20a20 20 0 0 1-20 20H46a20 20 0 0 1-20-20z" fill="#c9d4c2" {...stroke} />
        <path d="M94 62c10 0 12 14 2 18M26 64c-12-6-16 8-6 14" fill="none" {...stroke} />
        <path d="M46 28h28l-4-10H50z" fill="#c9d4c2" {...stroke} />
        <path d="M50 22l6 4-2 4 6 2" fill="none" stroke={LINE} strokeWidth={1.4} />
      </>
    ),
    mend: () => <>{[44, 52, 60, 68, 76].map((x) => <circle key={x} cx={x} cy={27} r={1.8} fill={SAFFRON} />)}</>,
    damage: () => <path d="M58 18l-2 4 6 4-2 4" fill="none" stroke={HOLE} strokeWidth={1.6} strokeLinecap="round" />,
  },
  tote: {
    base: () => <path d="M24 44h72l-6 62H30z" fill="#d8cdb5" {...stroke} />,
    mend: () => (
      <>
        <path d="M44 44c0-28 32-28 32 0" fill="none" stroke="#d8cdb5" strokeWidth={6} />
        <path d="M44 44c0-28 32-28 32 0" fill="none" {...stroke} strokeWidth={1.4} />
        <path d="M72 30l6 16M78 32l-4 4" stroke={SAFFRON} strokeWidth={2} strokeLinecap="round" strokeDasharray="3 2" />
      </>
    ),
    damage: () => (
      <>
        <path d="M44 44c0-24 22-28 30-16 6 9 14 14 20 26" fill="none" stroke="#d8cdb5" strokeWidth={6} />
        <path d="M44 44c0-24 22-28 30-16 6 9 14 14 20 26" fill="none" {...stroke} strokeWidth={1.4} />
        <path d="M76 44l-2-5M78 44l1-5" stroke={LINE} strokeWidth={1.2} strokeLinecap="round" />
      </>
    ),
  },
  radio: {
    base: () => (
      <>
        <rect x="16" y="38" width="88" height="58" rx="8" fill="#b98a5a" {...stroke} />
        <circle cx="80" cy="66" r="13" fill="#efe6d6" {...stroke} />
        <path d="M26 54h36M26 62h36M26 70h36M26 78h36" stroke={LINE} strokeWidth={1.6} />
        <path d="M40 38 30 20" {...stroke} />
      </>
    ),
    mend: () => <path d="M80 66 104 96M80 66 16 96" stroke={SAFFRON} strokeWidth={2} />,
    damage: () => <path d="M80 66l-6 12c-3 4 1 6-2 9" fill="none" stroke="#8a6a46" strokeWidth={1.6} strokeLinecap="round" />,
  },
  drawer: {
    base: () => (
      <>
        <path d="M18 40h84v52H18z" fill="#c08a52" {...stroke} />
        <path d="M18 40l14-14h84l-14 14M102 92l14-14V26" fill="#a8743f" {...stroke} />
        <rect x="50" y="58" width="20" height="8" rx="4" fill="#efe6d6" {...stroke} />
      </>
    ),
    mend: () => <path d="M102 40v52" stroke={SAFFRON} strokeWidth={4} />,
    damage: () => <path d="M101 40l3 14-2 12 3 13-2 13" fill="none" stroke={HOLE} strokeWidth={2.6} strokeLinejoin="round" />,
  },
  wheel: {
    base: () => (
      <>
        <circle cx="60" cy="60" r="38" fill="none" stroke="#3a3d44" strokeWidth={3} />
        {Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return <path key={i} d={`M60 60L${(60 + Math.cos(a) * 38).toFixed(1)} ${(60 + Math.sin(a) * 38).toFixed(1)}`} stroke={LINE} strokeWidth={1.2} />; })}
        <circle cx="60" cy="60" r="6" fill="#8c929c" {...stroke} />
      </>
    ),
    mend: () => <circle cx="60" cy="60" r="44" fill="none" stroke={SAFFRON} strokeWidth={5} />,
    damage: () => <path d="M16 58a44 44 0 0 1 88 0c0 18-9 31-23 38-7-6-16-4-24 2C31 92 16 78 16 58z" fill="none" stroke="#8c929c" strokeWidth={5} strokeLinejoin="round" />,
  },
  sock: {
    base: () => (
      <>
        <path d="M44 10h30v58c0 8 4 12 16 16 14 4 14 26-2 26H52c-12 0-18-10-14-22l6-20z" fill="#9b6b8e" {...stroke} />
        <path d="M44 22h30M44 28h30" stroke={THREAD} strokeWidth={1.6} />
      </>
    ),
    mend: () => <Darn x={64} y={80} w={22} h={14} />,
    damage: () => <Hole d="M68 84c5-3 14-2 16 3 2 5-3 9-9 9s-10-7-7-12z" frays="M66 83l-3-2M85 86l3-1M75 96l1 3" />,
  },
};

export function MendMotif({ motif, state = 'after' }: { motif: Motif; state?: 'before' | 'after' }) {
  const d = DRAW[motif];
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" style={{ display: 'block', width: '100%', height: '100%' }}>
      {d.base()}
      {state === 'after' ? d.mend() : d.damage()}
    </svg>
  );
}
