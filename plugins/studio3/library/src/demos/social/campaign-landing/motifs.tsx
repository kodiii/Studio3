/**
 * The mended objects, drawn as small SVGs: each shows the object and its visible mend in saffron.
 * Decorative — the gallery tile carries the description in role="img" / aria-label.
 */
import type { ReactNode } from 'react';
import type { Motif } from './data';

const LINE = '#2b3550';
const SAFFRON = '#e3a53c';
const THREAD = '#f3efe6';
const stroke = { stroke: LINE, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function Darn({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const v = Array.from({ length: Math.floor(w / 4) }, (_, i) => <path key={`v${i}`} d={`M${x + 2 + i * 4} ${y}v${h}`} />);
  const hz = Array.from({ length: Math.floor(h / 4) }, (_, i) => <path key={`h${i}`} d={`M${x} ${y + 2 + i * 4}h${w}`} strokeDasharray="2 2" strokeDashoffset={i % 2 ? 2 : 0} />);
  return <g stroke={SAFFRON} strokeWidth={1.6}>{v}{hz}</g>;
}

const DRAW: Record<Motif, () => ReactNode> = {
  jumper: () => (
    <>
      <path d="M18 34c10-8 28-10 40-6l48 40-16 22-44-30-10 50H20z" fill="#7d8aa8" {...stroke} />
      <path d="M90 90l16-22" {...stroke} strokeDasharray="3 4" />
      <Darn x={60} y={52} w={20} h={16} />
    </>
  ),
  jeans: () => (
    <>
      <path d="M38 10h46l-4 100H58l-4-58-6 58H34z" fill="#3b4f8a" {...stroke} />
      <rect x="40" y="56" width="22" height="20" fill="#5d72b0" transform="rotate(-4 51 66)" />
      <rect x="40" y="56" width="22" height="20" fill="none" stroke={THREAD} strokeWidth={1.8} strokeDasharray="3 3" transform="rotate(-4 51 66)" />
    </>
  ),
  mug: () => (
    <>
      <path d="M28 34h52v50a12 12 0 0 1-12 12H40a12 12 0 0 1-12-12z" fill="#4f6fb0" {...stroke} />
      <path d="M80 46h8a12 12 0 0 1 0 24h-8" fill="none" {...stroke} />
      <path d="M50 34l-4 14 8 10-6 14 6 10-4 14" fill="none" stroke={SAFFRON} strokeWidth={3} strokeLinejoin="round" />
    </>
  ),
  lamp: () => (
    <>
      <path d="M30 104h44" {...stroke} strokeWidth={4} />
      <path d="M52 104 40 64l34-26" fill="none" {...stroke} strokeWidth={3} />
      <path d="M66 30l26 4-6 26-24-12z" fill="#8c929c" {...stroke} />
      <path d="M30 104c-10 0-14-14-6-20s22 4 14 14" fill="none" stroke={SAFFRON} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  tube: () => (
    <>
      <circle cx="60" cy="60" r="40" fill="none" stroke="#3a3d44" strokeWidth={12} />
      <circle cx="60" cy="60" r="40" fill="none" stroke={LINE} strokeWidth={1.4} strokeDasharray="2 6" />
      <rect x="86" y="30" width="16" height="12" rx="2" fill={SAFFRON} transform="rotate(40 94 36)" />
      <rect x="20" y="70" width="16" height="12" rx="2" fill={SAFFRON} transform="rotate(-70 28 76)" />
    </>
  ),
  chair: () => (
    <>
      <path d="M36 14v92M84 14v92M36 56h48M36 20h48M36 34h48" fill="none" stroke="#a8743f" strokeWidth={6} strokeLinecap="round" />
      <path d="M40 84h40" stroke="#a8743f" strokeWidth={5} strokeLinecap="round" />
      <rect x="52" y="78" width="16" height="12" fill={SAFFRON} />
      <path d="M52 81h16M52 87h16" stroke={LINE} strokeWidth={1.2} />
    </>
  ),
  teapot: () => (
    <>
      <path d="M26 58a34 30 0 0 1 68 0v20a20 20 0 0 1-20 20H46a20 20 0 0 1-20-20z" fill="#c9d4c2" {...stroke} />
      <path d="M94 62c10 0 12 14 2 18M26 64c-12-6-16 8-6 14" fill="none" {...stroke} />
      <path d="M46 28h28l-4-10H50z" fill="#c9d4c2" {...stroke} />
      <path d="M50 22l6 4-2 4 6 2" fill="none" stroke={LINE} strokeWidth={1.4} />
      {[44, 52, 60, 68, 76].map((x) => <circle key={x} cx={x} cy={27} r={1.8} fill={SAFFRON} />)}
    </>
  ),
  tote: () => (
    <>
      <path d="M24 44h72l-6 62H30z" fill="#d8cdb5" {...stroke} />
      <path d="M44 44c0-28 32-28 32 0" fill="none" stroke="#d8cdb5" strokeWidth={6} />
      <path d="M44 44c0-28 32-28 32 0" fill="none" {...stroke} strokeWidth={1.4} />
      <path d="M72 30l6 16M78 32l-4 4" stroke={SAFFRON} strokeWidth={2} strokeLinecap="round" strokeDasharray="3 2" />
    </>
  ),
  radio: () => (
    <>
      <rect x="16" y="38" width="88" height="58" rx="8" fill="#b98a5a" {...stroke} />
      <circle cx="80" cy="66" r="13" fill="#efe6d6" {...stroke} />
      <path d="M26 54h36M26 62h36M26 70h36M26 78h36" stroke={LINE} strokeWidth={1.6} />
      <path d="M80 66 104 96M80 66 16 96" stroke={SAFFRON} strokeWidth={2} />
      <path d="M40 38 30 20" {...stroke} />
    </>
  ),
  drawer: () => (
    <>
      <path d="M18 40h84v52H18z" fill="#c08a52" {...stroke} />
      <path d="M18 40l14-14h84l-14 14M102 92l14-14V26" fill="#a8743f" {...stroke} />
      <rect x="50" y="58" width="20" height="8" rx="4" fill="#efe6d6" {...stroke} />
      <path d="M102 40v52" stroke={SAFFRON} strokeWidth={4} />
    </>
  ),
  wheel: () => (
    <>
      <circle cx="60" cy="60" r="44" fill="none" stroke={SAFFRON} strokeWidth={5} />
      <circle cx="60" cy="60" r="38" fill="none" stroke="#3a3d44" strokeWidth={3} />
      {Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return <path key={i} d={`M60 60L${(60 + Math.cos(a) * 38).toFixed(1)} ${(60 + Math.sin(a) * 38).toFixed(1)}`} stroke={LINE} strokeWidth={1.2} />; })}
      <circle cx="60" cy="60" r="6" fill="#8c929c" {...stroke} />
    </>
  ),
  sock: () => (
    <>
      <path d="M44 10h30v58c0 8 4 12 16 16 14 4 14 26-2 26H52c-12 0-18-10-14-22l6-20z" fill="#9b6b8e" {...stroke} />
      <path d="M44 22h30M44 28h30" stroke={THREAD} strokeWidth={1.6} />
      <Darn x={64} y={80} w={22} h={14} />
    </>
  ),
};

export function MendMotif({ motif }: { motif: Motif }) {
  return <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" style={{ display: 'block', width: '100%', height: '100%' }}>{DRAW[motif]()}</svg>;
}
