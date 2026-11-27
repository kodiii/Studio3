'use client';
/* Sample artwork for the showcase: fictional project covers drawn with SVG in theme tokens (no images, no network). */
import type { ReactNode } from 'react';
import styles from './styles.module.css';

const { fi, fs, fp, fm, si, ss, sp, serif, mono } = styles;

const wave = (y: number, amp = 9, step = 50): string => {
  let d = `M-10 ${y}`;
  for (let x = -10; x < 410; x += step) d += ` q ${step / 4} ${-amp} ${step / 2} 0 t ${step / 2} 0`;
  return d;
};

export interface Project { id: string; title: string; kind: string; year: string; art: ReactNode }

export const PROJECTS: readonly Project[] = [
  {
    id: 'tidewater',
    title: 'Tidewater Museum',
    kind: 'Identity',
    year: '2025',
    art: (
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <circle className={fs} cx="262" cy="150" r="62" />
        <rect className={fi} x="0" y="150" width="400" height="150" />
        {[176, 204, 232, 260, 288].map((y, i) => (
          <path key={y} className={sp} d={wave(y, 8 - i, 50 + i * 6)} strokeWidth={2.4 - i * 0.3} strokeLinecap="round" opacity={0.92 - i * 0.14} />
        ))}
        {[64, 46, 30, 16].map((w, i) => <rect key={w} className={fs} x={262 - w / 2} y={163 + i * 11} width={w} height="3" rx="1.5" opacity={0.9 - i * 0.16} />)}
        <circle className={si} cx="42" cy="44" r="15" strokeWidth="2" />
        <path className={si} d="M31 47 q 5.5 -6 11 0 t 11 0" strokeWidth="2" strokeLinecap="round" />
        <text className={`${mono} ${fi}`} x="66" y="48" fontSize="11" letterSpacing="1.6">TIDEWATER</text>
      </svg>
    ),
  },
  {
    id: 'kiln',
    title: 'Kiln & Co.',
    kind: 'Packaging',
    year: '2024',
    art: (
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <path className={fi} d="M66 246V128a44 44 0 0 1 88 0v118z" />
        {[[92, 150], [118, 176], [100, 206], [128, 222]].map(([x, y]) => <circle key={`${x}${y}`} className={fp} cx={x} cy={y} r="3.2" />)}
        <path className={fs} d="M164 246V102a52 52 0 0 1 104 0v144z" />
        <circle className={fp} cx="216" cy="112" r="19" />
        <rect className={fp} x="164" y="174" width="104" height="26" />
        <text className={`${mono} ${fi}`} x="216" y="191" fontSize="10" letterSpacing="1.4" textAnchor="middle">KILN &amp; CO.</text>
        <path className={si} d="M280 246V160a32 32 0 0 1 64 0v86z" strokeWidth="2.5" />
        <path className={si} d="M24 246h352" strokeWidth="2" strokeLinecap="round" />
        <path className={si} d="M24 262h120" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
  },
  {
    id: 'northlight',
    title: 'Northlight',
    kind: 'Typeface',
    year: '2023',
    art: (
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <rect className={fi} x="0" y="0" width="400" height="300" />
        <path className={sp} d="M24 82h352M24 148h352" strokeWidth="1" strokeDasharray="3 5" opacity="0.45" />
        <text className={`${serif} ${fp}`} x="40" y="232" fontSize="214">Ag</text>
        <path className={ss} d="M24 232h352" strokeWidth="2" />
        <circle className={fs} cx="338" cy="82" r="7" />
        <text className={`${mono} ${fp}`} x="372" y="74" fontSize="9" letterSpacing="1.2" textAnchor="end" opacity="0.7">CAP</text>
        <text className={`${mono} ${fp}`} x="372" y="140" fontSize="9" letterSpacing="1.2" textAnchor="end" opacity="0.7">X-HEIGHT</text>
        <text className={`${mono} ${fp}`} x="372" y="252" fontSize="9" letterSpacing="1.2" textAnchor="end" opacity="0.7">BASELINE</text>
      </svg>
    ),
  },
];

export interface Piece { title: string; year: string; art: ReactNode }

const tile = (body: ReactNode): ReactNode => (
  <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">{body}</svg>
);

export const ARCHIVE: readonly Piece[] = [
  { title: 'Ferry timetable', year: '2024', art: tile(<>{[26, 40, 54, 68, 82, 96].map((y, i) => <rect key={y} className={fi} x="18" y={y} width={[96, 64, 112, 48, 88, 72][i]} height="4" rx="2" />)}<circle className={fs} cx="132" cy="34" r="11" /></>) },
  { title: 'Market signage', year: '2023', art: tile(<>{Array.from({ length: 28 }, (_, i) => <circle key={i} className={i === 17 ? fs : fi} cx={26 + (i % 7) * 18} cy={26 + Math.floor(i / 7) * 22} r={i === 17 ? 7 : 3} />)}</>) },
  { title: 'Concert posters', year: '2023', art: tile(<>{[52, 42, 32, 22, 12].map((r) => <circle key={r} className={r === 32 ? ss : si} cx="80" cy="60" r={r} strokeWidth={r === 32 ? 4 : 1.6} />)}<circle className={fi} cx="80" cy="60" r="4" /></>) },
  { title: 'Tea labels', year: '2022', art: tile(<><path className={fs} d="M34 92a46 46 0 0 1 92 0z" /><path className={si} d="M18 92h124" strokeWidth="2" strokeLinecap="round" /><circle className={fi} cx="80" cy="30" r="7" /></>) },
  { title: 'Gallery wayfinding', year: '2021', art: tile(<><path className={fi} d="M28 52h66V30l40 30-40 30V68H28z" /><rect className={fs} x="28" y="88" width="34" height="8" rx="2" /></>) },
  { title: 'Book series', year: '2020', art: tile(<>{[[30, 34, fi], [46, 22, fm], [60, 40, fs], [82, 28, fi], [96, 46, fm], [118, 30, fi]].map(([x, h, c]) => <rect key={String(x)} className={String(c)} x={Number(x)} y={96 - Number(h) * 1.5} width="12" height={Number(h) * 1.5} rx="1.5" />)}<path className={si} d="M20 97h120" strokeWidth="2" strokeLinecap="round" /></>) },
  { title: 'Radio idents', year: '2019', art: tile(<>{[40, 60, 80].map((y, i) => <path key={y} className={i === 1 ? ss : si} d={`M14 ${y} q 11 -${12 - i * 2} 22 0 t 22 0 t 22 0 t 22 0 t 22 0 t 22 0`} strokeWidth={i === 1 ? 3.2 : 1.8} strokeLinecap="round" />)}</>) },
  { title: 'Bakery boxes', year: '2018', art: tile(<>{Array.from({ length: 12 }, (_, i) => ((i + Math.floor(i / 4)) % 2 === 0 ? <rect key={i} className={i === 6 ? fs : fi} x={32 + (i % 4) * 24} y={24 + Math.floor(i / 4) * 24} width="24" height="24" /> : null))}<rect className={si} x="32" y="24" width="96" height="72" strokeWidth="1.6" /></>) },
  { title: 'Festival map', year: '2017', art: tile(<><path className={si} d="M18 96c26-6 18-44 44-48s26 30 50 22 18-34 30-40" strokeWidth="2.2" strokeDasharray="2 6" strokeLinecap="round" /><circle className={fs} cx="142" cy="30" r="8" /><circle className={fp} cx="142" cy="30" r="3" /><circle className={fi} cx="18" cy="96" r="4" /></>) },
];
