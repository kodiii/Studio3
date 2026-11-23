'use client';
/* Drawings for Larkwell Organ Works (fictional). Everything is procedural SVG; the scene colours are fixed
   "image" colours (the inside of an oak case), the line drawings use theme tokens. */
import { useId } from 'react';
import s from './styles.module.css';

interface Pipe { x: number; w: number; h: number; base: number }

const mirror = (list: readonly Pipe[]): Pipe[] => list.map((p) => ({ ...p, x: 1600 - p.x }));
const FRONT_LEFT: readonly Pipe[] = [
  { x: 758, w: 76, h: 730, base: 900 }, { x: 674, w: 76, h: 640, base: 900 },
  { x: 532, w: 62, h: 380, base: 900 }, { x: 460, w: 62, h: 420, base: 900 }, { x: 388, w: 62, h: 462, base: 900 },
  { x: 316, w: 62, h: 506, base: 900 }, { x: 244, w: 62, h: 552, base: 900 }, { x: 172, w: 62, h: 600, base: 900 },
];
const FRONT_RIGHT = mirror(FRONT_LEFT);
const MID: readonly Pipe[] = Array.from({ length: 17 }, (_, i) => ({ x: 224 + i * 72, w: 40, h: 300 + 210 * Math.abs(Math.sin(i * 0.52 + 0.3)), base: 872 }));
const BACK: readonly Pipe[] = Array.from({ length: 29 }, (_, i) => ({ x: 128 + i * 48.6, w: 24, h: 170 + 190 * Math.abs(Math.cos(i * 0.37)), base: 846 }));

function pipe(p: Pipe, fill: string, mouth: string, key: string | number) {
  const foot = Math.max(64, p.h * 0.2);
  const top = p.base - p.h;
  const my = p.base - foot;
  const r = p.w / 2;
  return (
    <g key={key}>
      <rect x={p.x - r} y={top} width={p.w} height={my - top} rx={p.w * 0.06} fill={fill} />
      <path d={`M${p.x - r} ${my}L${p.x - p.w * 0.09} ${p.base}H${p.x + p.w * 0.09}L${p.x + r} ${my}Z`} fill={fill} />
      <path d={`M${p.x - p.w * 0.3} ${my - p.w * 0.04}h${p.w * 0.6}v${-p.w * 0.2}q${-p.w * 0.3} ${-p.w * 0.2} ${-p.w * 0.6} 0Z`} fill={mouth} />
    </g>
  );
}

function Grad({ id, stops }: { id: string; stops: readonly [number, string][] }) {
  return <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">{stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}</linearGradient>;
}

const VB = { viewBox: '0 0 1600 1000', preserveAspectRatio: 'xMidYMax slice' } as const;

/** The case interior in layers (back → front). Each layer is its own element so it can move in depth. */
export function FacadeScene({ className }: { className?: string }) {
  const id = useId();
  const tin = `${id}tin`;
  const pale = `${id}pale`;
  return (
    <div className={`${s.scene} ${className ?? ''}`} aria-hidden="true">
      <div className={s.glow} />
      <div className={s.layer} data-layer="back">
        <svg {...VB} focusable="false">{BACK.map((p, i) => pipe(p, '#a07b58', '#5b4330', i))}</svg>
      </div>
      <div className={s.layer} data-layer="mid">
        <svg {...VB} focusable="false">
          <defs><Grad id={pale} stops={[[0, '#4c4339'], [0.34, '#a99a83'], [0.44, '#cdbfa7'], [0.62, '#6f6556'], [1, '#3e362e']]} /></defs>
          {MID.map((p, i) => pipe(p, `url(#${pale})`, '#231d17', i))}
        </svg>
      </div>
      {([['frontL', FRONT_LEFT, 30], ['frontR', FRONT_RIGHT, 1500]] as const).map(([key, list, post]) => (
        <div key={key} className={s.layer} data-layer={key}>
          <svg {...VB} focusable="false">
            <defs><Grad id={`${tin}${key}`} stops={[[0, '#26211c'], [0.3, '#8f8371'], [0.4, '#d6c9b2'], [0.58, '#5a5145'], [1, '#211c17']]} /></defs>
            <rect x={post} y="0" width="70" height="1000" fill="#241d16" />
            <path d={`M${post + 12} 0V1000M${post + 58} 0V1000`} stroke="#4a3c2d" strokeWidth="2" />
            {list.map((p, i) => pipe(p, `url(#${tin}${key})`, '#120f0c', i))}
          </svg>
        </div>
      ))}
      <div className={s.layer} data-layer="impost">
        <svg {...VB} focusable="false">
          <rect x="0" y="900" width="1600" height="100" fill="#1c1712" />
          <path d="M0 907H1600M0 921H1600" stroke="#6b5a45" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}

/** Section through St Aldhelm's Hall: sound from the west gallery reflects off the vault to the seats. */
export function HallSection() {
  const rays = [
    'M140 214L420 62L630 404', 'M140 214L300 104L520 404', 'M140 214L600 40L800 398', 'M140 214L770 58L912 352',
  ];
  return (
    <svg className={s.hall} viewBox="0 0 1000 520" aria-hidden="true" focusable="false">
      <path className={s.hallLine} d="M40 440V214Q500 -26 960 214V440" />
      <path className={s.hallLine} d="M20 440H980" />
      <path className={s.hallFine} d="M40 270H236V440M236 270V250" />
      {[78, 104, 130, 156, 182, 208].map((x, i) => (
        <rect key={x} className={s.hallPipe} x={x - 7} y={270 - (i < 3 ? 52 + i * 12 : 88 - (i - 3) * 12)} width="14" height={i < 3 ? 52 + i * 12 : 88 - (i - 3) * 12} rx="2" />
      ))}
      {Array.from({ length: 9 }, (_, i) => 380 + i * 62).map((x) => (
        <g key={x} className={s.hallSeat}>
          <circle cx={x} cy="388" r="9" />
          <path d={`M${x - 12} 440V408Q${x} 398 ${x + 12} 408V440M${x - 24} 426H${x + 26}`} />
        </g>
      ))}
      <path className={s.hallSoft} d="M360 440V426H930V440" />
      {rays.map((d) => <path key={d} className={s.ray} d={d} pathLength={1} data-ray="" />)}
      <path className={`${s.ray} ${s.rayLost}`} d="M140 214L520 420" pathLength={1} data-ray="" />
      <text className={s.hallLabel} x="500" y="32" textAnchor="middle">Hard plaster vault — reflects</text>
      <text className={s.hallLabel} x="645" y="478" textAnchor="middle">Upholstered seats — absorb</text>
      <text className={s.hallLabel} x="44" y="300">West gallery</text>
      <text className={s.hallLabel} x="44" y="318">organ position</text>
    </svg>
  );
}

export interface Stop { id: string; name: string; pitch: string; longest: string; feet: number; kind: string; pipes: number; division: 'Manual' | 'Pedal' }

/** The sample specification: 7 stops, 8 ranks, 398 pipes. Speaking pitch versus physical length is real organ practice. */
export const STOPS: readonly Stop[] = [
  { id: 'diapason', name: 'Open Diapason', pitch: '8′', longest: '8 ft', feet: 8, kind: 'Open metal', pipes: 56, division: 'Manual' },
  { id: 'stopped', name: 'Stopped Flute', pitch: '8′', longest: '4 ft', feet: 4, kind: 'Stopped wood', pipes: 56, division: 'Manual' },
  { id: 'principal', name: 'Principal', pitch: '4′', longest: '4 ft', feet: 4, kind: 'Open metal', pipes: 56, division: 'Manual' },
  { id: 'chimney', name: 'Chimney Flute', pitch: '4′', longest: 'about 2½ ft', feet: 2.5, kind: 'Half-stopped metal', pipes: 56, division: 'Manual' },
  { id: 'fifteenth', name: 'Fifteenth', pitch: '2′', longest: '2 ft', feet: 2, kind: 'Open metal', pipes: 56, division: 'Manual' },
  { id: 'sesquialtera', name: 'Sesquialtera', pitch: 'II', longest: '2⅔ ft', feet: 2.67, kind: 'Two open metal ranks', pipes: 88, division: 'Manual' },
  { id: 'bourdon', name: 'Bourdon', pitch: '16′', longest: '8 ft', feet: 8, kind: 'Stopped wood, pedal', pipes: 30, division: 'Pedal' },
];

/** Each drawn stop raises a representative rank: 12 pipes, halving in length every octave, to a common scale with a person. */
export function RankDiagram({ drawn }: { drawn: ReadonlySet<string> }) {
  const H = 300;
  const colW = 1000 / STOPS.length;
  return (
    <svg className={s.ranks} viewBox="-120 -20 1140 380" aria-hidden="true" focusable="false">
      <path className={s.rankBase} d="M-110 320H1010" />
      <g className={s.person} transform="translate(-70 0)">
        <circle cx="0" cy={320 - (6 / 8) * H + 10} r="10" />
        <path d={`M0 ${320 - (6 / 8) * H + 22}V${320 - 60}M-16 ${320 - (6 / 8) * H + 60}H16M0 ${320 - 60}L-12 320M0 ${320 - 60}L12 320`} />
        <text x="0" y="345" textAnchor="middle">6 ft</text>
      </g>
      {STOPS.map((st, c) => {
        const on = drawn.has(st.id);
        const x0 = c * colW + 18;
        return (
          <g key={st.id} className={s.rank} data-on={on || undefined}>
            <g className={s.rankPipes} style={{ transformOrigin: `0 320px` }}>
              {Array.from({ length: 12 }, (_, i) => {
                const h = (st.feet / 8) * H * Math.pow(0.5, i / 6);
                const w = Math.max(3, 10 * Math.pow(0.8, i / 3) * (st.kind.includes('wood') ? 1.3 : 1));
                return <rect key={i} x={x0 + i * (colW - 30) / 12} y={320 - h} width={w} height={h} rx="1.5" />;
              })}
            </g>
            <text className={s.rankLabel} x={x0} y="345">{st.pitch}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** The arch motif as an outline, for the closing beat. */
export function ArchOutline() {
  return (
    <svg className={s.archOutline} viewBox="0 0 200 320" aria-hidden="true" focusable="false">
      <path d="M8 316V104A92 92 0 0 1 192 104V316Z" />
      <path d="M26 316V108A74 74 0 0 1 174 108V316" />
      {[52, 76, 100, 124, 148].map((x, i) => <rect key={x} x={x - 7} y={316 - [150, 190, 228, 190, 150][i]} width="14" height={[150, 190, 228, 190, 150][i] - 26} rx="3" />)}
      <path d="M8 290H192" />
    </svg>
  );
}
