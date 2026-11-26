'use client';
/**
 * Two-colour "risograph" prints drawn as SVG. Each print is printed from two plates, and they are rendered as two
 * stacked SVGs: the paper with the blue plate, and the coral plate on top with mix-blend-mode: multiply, so overlaps
 * mix into plum the way real riso inks do. Keeping the coral plate a separate element lets the feed's registration
 * field (registration.ts) slide it 1–4 px on the compositor when the page moves, and snap it back into register when
 * the sheet is hovered, pressed or focused. `offset` is different: it is the proof's own printed misregistration
 * (content, in millimetres), drawn inside the plate.
 * The artwork is decorative: callers wrap it in an element with role="img" and a written description.
 */
import { useRef, type ReactNode } from 'react';
import type { Media } from './data';
import { usePlate } from './registration';
import styles from './styles.module.css';

const PAPER = '#f2ede2';
const BLUE = '#3c5fb8';
const CORAL = '#f26b5b';
const MONO = 'var(--mk-font-mono, ui-monospace, monospace)';
const ink = { mixBlendMode: 'multiply' as const };

function Reg({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={color} strokeWidth={1.4} fill="none">
      <circle r={7} />
      <path d="M-12 0H12M0-12V12" />
    </g>
  );
}

function Marks({ color, dx = 0, dy = 0 }: { color: string; dx?: number; dy?: number }) {
  return (
    <g transform={`translate(${dx} ${dy})`}>
      <Reg x={24} y={24} color={color} /><Reg x={376} y={24} color={color} />
      <Reg x={24} y={476} color={color} /><Reg x={376} y={476} color={color} />
    </g>
  );
}

const svgProps = { viewBox: '0 0 400 500', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': true, focusable: false } as const;

/** One sheet: the paper + blue plate, and (when the print has one) the coral plate as its own layer. */
function Sheet({ blue, coral }: { blue: ReactNode; coral?: ReactNode }) {
  const plate = useRef<SVGSVGElement>(null);
  usePlate(plate);
  return (
    <div className={styles.print}>
      <svg {...svgProps} className={styles.plate}>
        <rect width="400" height="500" fill={PAPER} />
        {blue}
      </svg>
      {coral ? <svg {...svgProps} ref={plate} className={`${styles.plate} ${styles.coralPlate}`}>{coral}</svg> : null}
    </div>
  );
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function wave(y: number, phase: number, amp: number, x0 = 86, x1 = 360, step = 6): string {
  let d = '';
  for (let x = x0; x <= x1; x += step) {
    const v = y - Math.sin((x - x0) / 22 + phase) * amp * (0.75 + 0.25 * Math.sin((x - x0) / 71 + phase * 2));
    d += `${x === x0 ? 'M' : 'L'}${x.toFixed(1)} ${v.toFixed(1)}`;
  }
  return d;
}

/** Blue plate only: the tide table before its second colour (no coral plate yet, so nothing to drift). */
function TidePrint() {
  return (
    <Sheet blue={
      <>
        <g style={ink}>
          <rect x="40" y="46" width="320" height="34" fill={BLUE} />
          <text x="52" y="68" fill={PAPER} fontFamily={MONO} fontSize="13" letterSpacing="2.4">HIGH WATER · 2027</text>
          {MONTHS.map((m, i) => {
            const y = 116 + i * 29;
            return (
              <g key={m}>
                <text x="40" y={y + 4} fill={BLUE} fontFamily={MONO} fontSize="10" letterSpacing="1">{m}</text>
                <path d={wave(y, i * 0.62, 7)} fill="none" stroke={BLUE} strokeWidth={1.6} strokeLinecap="round" />
                {[0, 1, 2, 3].map((k) => <circle key={k} cx={104 + k * 69 + ((i * 13) % 20)} cy={y - 9} r={1.8} fill={BLUE} />)}
              </g>
            );
          })}
          <path d="M40 462H360" stroke={BLUE} strokeWidth={1} />
          <text x="40" y="452" fill={BLUE} fontFamily={MONO} fontSize="8" letterSpacing="1.4">WRENMOUTH · TIMES IN GMT · TIDEWATER PRINT CLUB</text>
        </g>
        <Marks color={BLUE} />
      </>
    } />
  );
}

const CONTOURS = [
  { rx: 150, ry: 96, r: -12 }, { rx: 122, ry: 76, r: -8 }, { rx: 96, ry: 58, r: -4 },
  { rx: 70, ry: 42, r: 2 }, { rx: 46, ry: 26, r: 8 }, { rx: 22, ry: 12, r: 14 },
];

/** Harbour chart; the coral plate is printed `offset` millimetres (≈ 4 px each) out of register. */
export function ChartPrint({ offset = 0 }: { offset?: number }) {
  const dx = offset * 4, dy = offset * 3;
  return (
    <Sheet
      blue={
        <>
          <g style={ink}>
            {CONTOURS.map((k, i) => (
              <ellipse key={i} cx={252} cy={206} rx={k.rx} ry={k.ry} transform={`rotate(${k.r} 252 206)`} fill="none" stroke={BLUE} strokeWidth={i === 0 ? 2 : 1.2} />
            ))}
            {[[96, 150, '12'], [330, 120, '18'], [300, 290, '9'], [170, 190, '21'], [228, 120, '15']].map(([x, y, t]) => (
              <text key={`${x}-${y}`} x={x} y={y} fill={BLUE} fontFamily={MONO} fontSize="11">{t}</text>
            ))}
            <g transform="translate(78 92)" stroke={BLUE} strokeWidth={1.3} fill="none">
              <circle r={22} /><path d="M0-30V30M-30 0H30" /><path d="M0-22 5 0 0 22-5 0Z" fill={BLUE} />
            </g>
            <text x="40" y="452" fill={BLUE} fontFamily={MONO} fontSize="9" letterSpacing="1.6">HARBOUR CHART · SOUNDINGS IN METRES</text>
          </g>
          <Marks color={BLUE} />
        </>
      }
      coral={
        <g transform={`translate(${dx} ${dy})`}>
          <path d="M0 330C46 318 74 352 118 344s70-46 112-30 40 66 86 70 84-20 84-20V500H0Z" fill={CORAL} />
          <path d="M112 300C150 250 214 232 248 214" fill="none" stroke={CORAL} strokeWidth={2.2} strokeDasharray="7 6" strokeLinecap="round" />
          {[[112, 300], [182, 246], [248, 214]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={6} fill={CORAL} />)}
          <Marks color={CORAL} />
        </g>
      }
    />
  );
}

/** Halftone moon: one path of dots whose radius follows the shading (coarse screen, so it reads as print). */
function moonDots(): string {
  const cx = 200, cy = 200, R = 132, step = 11;
  let d = '';
  for (let y = cy - R; y <= cy + R; y += step) {
    for (let x = cx - R; x <= cx + R; x += step) {
      const ox = x + (((y - cy) / step) % 2 ? step / 2 : 0);
      const nx = (ox - cx) / R, ny = (y - cy) / R;
      const rr = nx * nx + ny * ny;
      if (rr > 1) continue;
      const lit = Math.max(0, Math.min(1, 0.62 + nx * 0.75 - ny * 0.15));
      const crater = 0.12 * Math.sin(ox * 0.09) * Math.cos(y * 0.07);
      const shade = Math.max(0.04, Math.min(1, 1 - lit + crater + rr * 0.18));
      const r = 0.6 + shade * 4.4;
      d += `M${(ox - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0`;
    }
  }
  return d;
}
let moonPath: string | null = null;

function MoonPrint() {
  moonPath ??= moonDots();
  return (
    <Sheet
      blue={<><g style={ink}><path d={moonPath} fill={BLUE} /></g><Marks color={BLUE} /></>}
      coral={
        <>
          {[0, 1, 2].map((i) => <path key={i} d={wave(392 + i * 22, i * 1.4, 4, 40, 360, 8)} fill="none" stroke={CORAL} strokeWidth={3} strokeLinecap="round" />)}
          <Marks color={CORAL} />
        </>
      }
    />
  );
}

function SwatchPrint() {
  return (
    <Sheet
      blue={
        <>
          <circle cx="242" cy="262" r="112" fill={BLUE} style={ink} />
          <g style={ink} fill={BLUE} fontFamily={MONO} fontSize="10" letterSpacing="1.4">
            <path d="M206 236 306 120H360" fill="none" stroke={BLUE} strokeWidth={1} />
            <text x="292" y="112">PLUM</text>
            <text x="40" y="430">BLUE</text><text x="130" y="430">CORAL</text><text x="232" y="430">BLUE / CORAL</text>
          </g>
          <rect x="40" y="440" width="70" height="20" fill={BLUE} style={ink} />
          <rect x="232" y="440" width="70" height="20" fill={BLUE} style={ink} />
          <Marks color={BLUE} />
        </>
      }
      coral={
        <>
          <circle cx="160" cy="214" r="112" fill={CORAL} />
          <rect x="130" y="440" width="70" height="20" fill={CORAL} />
          <rect x="232" y="440" width="70" height="20" fill={CORAL} />
          <Marks color={CORAL} />
        </>
      }
    />
  );
}

export function PrintArt({ media, offset }: { media: Exclude<Media, null>; offset?: number }) {
  switch (media) {
    case 'tide': return <TidePrint />;
    case 'proofs': return <ChartPrint offset={offset ?? 0} />;
    case 'moon': return <MoonPrint />;
    case 'swatch': return <SwatchPrint />;
  }
}

/** Decorative registration mark (for UI ornaments). */
export function RegMark({ className }: { className?: string }) {
  return (
    <svg viewBox="-14 -14 28 28" className={className} aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth={1.4} fill="none"><circle r={7} /><path d="M-12 0H12M0-12V12" /></g>
    </svg>
  );
}
