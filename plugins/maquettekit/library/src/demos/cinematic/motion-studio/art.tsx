/**
 * Artwork for the fictional case studies and archive frames, drawn with SVG and live HTML type (so a hovered card can
 * play its still: the tide moves, the beam sweeps, the weight axis swells, the rolls hop). Each case has its own
 * small palette, as a client's brand would; it is decorative and aria-hidden everywhere it is used.
 */
import type { CSSProperties } from 'react';
import type { ArchiveArt as ArchiveArtId, CaseId } from './content';
import s from './styles.module.css';

const WAVE = (y: number, amp: number, period: number, width: number) => {
  // A smooth wave from x = -width to x = width (two copies), so a translateX of `width` loops seamlessly.
  let d = `M${-width} ${y}`;
  for (let x = -width; x < width; x += period) d += ` q${period / 4} ${-amp} ${period / 2} 0 t${period / 2} 0`;
  return d;
};

function Tidewater() {
  const letters = 'TIDEWATER'.split('');
  return (
    <div className={s.artTide}>
      <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <linearGradient id="ll-tw-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a2731" />
            <stop offset="0.62" stopColor="#11505b" />
            <stop offset="1" stopColor="#0c3a45" />
          </linearGradient>
          <radialGradient id="ll-tw-moon" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff6dc" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="640" height="400" fill="url(#ll-tw-sky)" />
        <circle cx="514" cy="92" r="70" fill="url(#ll-tw-moon)" />
        <circle cx="514" cy="92" r="27" fill="#f2ead6" />
        <g className={s.tideLines} fill="none" stroke="#7fd6c8" strokeLinecap="round">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <path key={i} d={WAVE(250 + i * 21, 5 + i * 1.6, 96 + i * 10, 640)} strokeWidth={1.2 + i * 0.25} opacity={0.32 + i * 0.09} style={{ '--i': i } as CSSProperties} />
          ))}
        </g>
        <g fill="#7fd6c8" opacity="0.85">
          {[34, 52, 70, 61, 44, 28, 38, 57, 76, 66, 48].map((h, i) => <rect key={i} x={40 + i * 13} y={372 - h * 0.6} width="7" height={h * 0.6} rx="1.5" />)}
        </g>
        <text x="40" y="390" fill="#bfe9e1" fontSize="9" letterSpacing="1.2" style={{ fontFamily: 'var(--mk-font-mono)' }}>TIDE TABLE · SAMPLE</text>
      </svg>
      <span className={s.tideMark}>
        {letters.map((l, i) => <span key={i} style={{ '--i': i, '--y': `${(Math.sin(i * 0.78) * 0.09).toFixed(3)}em` } as CSSProperties}>{l}</span>)}
      </span>
    </div>
  );
}

function Ferry() {
  return (
    <div className={s.artFerry}>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <linearGradient id="ll-nf-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#070b1c" />
            <stop offset="0.7" stopColor="#1b2350" />
            <stop offset="1" stopColor="#2a2c5c" />
          </linearGradient>
          <linearGradient id="ll-nf-beam" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor="#ffe2a0" stopOpacity="0.75" />
            <stop offset="1" stopColor="#ffe2a0" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="400" height="300" fill="url(#ll-nf-sky)" />
        <g fill="#e8e3ff">
          {[[34, 30, 1.1], [92, 58, 0.8], [150, 22, 1.2], [214, 46, 0.7], [262, 18, 1], [48, 96, 0.7], [182, 84, 0.9], [120, 120, 0.6]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} opacity={0.75} />)}
        </g>
        <rect y="206" width="400" height="94" fill="#0a0f26" />
        <g stroke="#ffd884" strokeLinecap="round" opacity="0.5">
          {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${300 + (i % 2) * 8} ${220 + i * 13}h${26 - i * 4}`} strokeWidth="1.4" />)}
        </g>
        <g className={s.ferryBoat}>
          <path d="M52 206h118l-12 14H64z" fill="#05081a" />
          <rect x="80" y="192" width="64" height="14" rx="2" fill="#05081a" />
          <rect x="98" y="182" width="24" height="10" fill="#05081a" />
          <g fill="#ffcf6b">{[86, 96, 106, 116, 126, 136].map((x) => <rect key={x} x={x} y="196" width="5" height="4" rx="0.8" />)}</g>
        </g>
        <g className={s.ferryBeam}>
          <path d="M318 112 L40 70 L40 150 Z" fill="url(#ll-nf-beam)" />
        </g>
        <path d="M310 206 L314 120 h8 L326 206Z" fill="#dcd7ea" />
        <path d="M311.4 176h13.2v8h-13.6zM312.6 146h10.8v8h-11.1z" fill="#b8213a" />
        <rect x="312" y="106" width="12" height="14" rx="2" fill="#ffe29a" />
        <path d="M310 106l8-8 8 8z" fill="#dcd7ea" />
      </svg>
      <span className={s.ferryTitle}>The Night Ferry</span>
    </div>
  );
}

function Halden() {
  // Guides sit on the glyph's own metrics (line-height 1: baseline 0.83 em down, cap height 0.66 em, x-height 0.52 em).
  return (
    <div className={s.artType}>
      <span className={s.typeGlyph}>
        Rg
        <i className={s.typeLine} style={{ '--at': '0.17em' } as CSSProperties}><span>cap height</span></i>
        <i className={s.typeLine} style={{ '--at': '0.305em' } as CSSProperties}><span>x-height</span></i>
        <i className={s.typeLine} style={{ '--at': '0.83em' } as CSSProperties} data-solid=""><span>baseline</span></i>
      </span>
      <span className={s.typeAxis}><span>wght</span><span className={s.typeTrack}><span className={s.typeKnob} /></span><span>250–800</span></span>
    </div>
  );
}

function Crumb() {
  return (
    <div className={s.artCrumb}>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <linearGradient id="ll-cr-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6c66c" />
            <stop offset="1" stopColor="#ec8f3a" />
          </linearGradient>
        </defs>
        <rect width="400" height="300" fill="url(#ll-cr-bg)" />
        <path d="M0 250h400v50H0z" fill="#c9692a" opacity="0.45" />
        <g transform="translate(150 34)">
          <rect width="100" height="196" rx="18" fill="#fff8ee" />
          <rect x="6" y="6" width="88" height="184" rx="13" fill="#fdebd2" />
          <ellipse cx="50" cy="84" rx="30" ry="21" fill="#d98a3d" />
          <path d="M34 76q16-8 32 0M36 88q14-6 28 0" stroke="#8a4517" strokeWidth="3" fill="none" strokeLinecap="round" />
          <text x="50" y="138" textAnchor="middle" fontWeight="800" fontSize="19" fill="#5a2d0c" letterSpacing="-0.5" style={{ fontFamily: 'var(--mk-font-display)' }}>Crumb</text>
          <g fill="#5a2d0c">{[0, 1, 2, 3].map((i) => <circle key={i} cx={38 + i * 8} cy="170" r="2.4" opacity={i === 1 ? 1 : 0.3} />)}</g>
        </g>
      </svg>
      <span className={s.crumbRolls}>
        {[0, 1, 2].map((i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}
      </span>
    </div>
  );
}

export function CaseArt({ id }: { id: CaseId }) {
  if (id === 'tidewater') return <Tidewater />;
  if (id === 'ferry') return <Ferry />;
  if (id === 'halden') return <Halden />;
  return <Crumb />;
}

/** Archive frames: one ink drawing per project on a backlit frame. */
export function ArchiveArt({ art }: { art: ArchiveArtId }) {
  const ink = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const dot = { fill: 'var(--ll-frame-accent)' };
  let body;
  switch (art) {
    case 'vane': body = <><path {...ink} d="M60 76V30M38 40h44l-8-7M38 40l8 6" /><path {...ink} d="M44 76h32" /><circle {...dot} cx="60" cy="30" r="4.5" /></>; break;
    case 'boats': body = <><path {...ink} d="M22 58h40l-8 12H30zM42 58V30l14 22H42" /><path {...ink} d="M68 64h30l-6 9H74zM83 64V44l10 16H83" /><path {...ink} d="M14 78q8-4 16 0t16 0 16 0 16 0 16 0 16 0" /><circle {...dot} cx="94" cy="26" r="4" /></>; break;
    case 'metro': body = <><path {...ink} d="M14 70h26l14-30h24l14 30h14" /><circle cx="40" cy="70" r="5.5" fill="currentColor" /><circle {...dot} cx="54" cy="40" r="6" /><circle cx="78" cy="40" r="5.5" fill="currentColor" /><circle cx="92" cy="70" r="5.5" fill="currentColor" /></>; break;
    case 'seeds': body = <>{[[30, 50, -20], [52, 36, 15], [74, 54, -5], [92, 38, 30]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx="7" ry="12" transform={`rotate(${r} ${x} ${y})`} {...(i === 2 ? dot : { fill: 'currentColor' })} />)}<path {...ink} d="M18 76h86" /></>; break;
    case 'beacon': body = <><path {...ink} d="M54 78l4-40h8l4 40M50 38h24M56 30h12v8H56z" /><path d="M68 34L106 22v24z" fill="var(--ll-frame-accent)" opacity="0.8" /><path {...ink} d="M16 78h92" /></>; break;
    case 'strings': body = <><path {...ink} d="M40 18c-10 14 10 22 0 36s10 22 0 30M80 18c10 14-10 22 0 36s-10 22 0 30" /><path {...ink} d="M50 50h20" /><circle {...dot} cx="60" cy="34" r="4" /></>; break;
    case 'clock': body = <><circle {...ink} cx="60" cy="48" r="28" /><path {...ink} d="M60 48V30M60 48l13 8" /><circle {...dot} cx="60" cy="48" r="4" /></>; break;
    case 'kiln': body = <><path {...ink} d="M40 30h40l-4 8c10 6 12 26 2 38H42c-10-12-8-32 2-38z" /><path d="M48 54q12 8 24 0" stroke="var(--ll-frame-accent)" strokeWidth="3" fill="none" strokeLinecap="round" /></>; break;
    case 'choir': body = <>{[30, 60, 90].map((x, i) => <g key={x}><circle {...ink} cx={x} cy="40" r="11" /><ellipse cx={x} cy="44" rx="4" ry={i === 1 ? 5.5 : 3} {...(i === 1 ? dot : { fill: 'currentColor' })} /><path {...ink} d={`M${x - 14} 76q14-16 28 0`} /></g>)}</>; break;
    case 'radio': body = <><rect {...ink} x="26" y="40" width="68" height="38" rx="6" /><path {...ink} d="M40 40l30-20" /><circle {...ink} cx="46" cy="59" r="9" /><path {...ink} d="M66 52h18M66 60h18M66 68h12" /><circle {...dot} cx="70" cy="20" r="4" /></>; break;
  }
  return <svg viewBox="0 0 120 96" focusable="false" aria-hidden="true">{body}</svg>;
}

/** One bounce, four stages of the process: the brief, Noor's keys, Teo's inbetweens, the shipped curve. */
const KEYS = [{ x: 22, y: 18 }, { x: 104, y: 70 }, { x: 170, y: 36 }, { x: 226, y: 70 }] as const;
const FLOOR = 79;
const R = 8.5;
/** Points along the two arcs of the bounce at equal time steps (gravity: spacing opens up as the ball falls). */
function arcPoints(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }, apex: number, n: number) => {
    // Parabola through a and b whose top is `apex` px above the higher end.
    const top = Math.min(a.y, b.y) - apex;
    const ta = Math.sqrt(a.y - top), tb = Math.sqrt(b.y - top);
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const s = -ta + (ta + tb) * u; // time-like parameter, 0 at the top
      pts.push({ x: a.x + (b.x - a.x) * u, y: top + s * s });
    }
  };
  seg(KEYS[0], KEYS[1], 0, 6);
  seg(KEYS[1], KEYS[2], 6, 6);
  seg(KEYS[2], KEYS[3], 0, 5);
  return pts;
}
const ARC = (() => {
  const all = [KEYS[0], ...arcPoints().slice(0, 5), KEYS[1], ...arcPoints().slice(5, 10), KEYS[2], ...arcPoints().slice(10), KEYS[3]];
  return all.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
})();

export function ProcessArt({ step }: { step: 0 | 1 | 2 | 3 }) {
  const key = (k: { x: number; y: number }, i: number) => (k.y >= 70
    ? <ellipse key={i} className={s.paKey} cx={k.x} cy={FLOOR - R * 0.7} rx={R * 1.3} ry={R * 0.7} pathLength={1} />
    : <circle key={i} className={s.paKey} cx={k.x} cy={k.y} r={R} pathLength={1} />);
  return (
    <svg className={s.processArt} viewBox="0 0 248 92" aria-hidden="true" focusable="false" data-step={step}>
      <path className={s.paFloor} d={`M6 ${FLOOR}H242`} />
      {step === 0 ? (
        <>
          <circle className={s.paKey} cx={KEYS[0].x} cy={FLOOR - R} r={R} pathLength={1} />
          <path className={s.paHint} d={`M${KEYS[0].x + 14} ${FLOOR - 16}Q120 -6 214 ${FLOOR - 16}`} />
          <path className={s.paHead} d={`M206 ${FLOOR - 25}l9 9 3-12`} pathLength={1} />
          {[0, 1, 2, 3, 4].map((i) => <path key={i} className={s.paTick} d={`M${60 + i * 34} ${FLOOR + 4}v6`} />)}
        </>
      ) : null}
      {step >= 1 ? KEYS.slice(0, 3).map(key) : null}
      {step === 1 ? KEYS.slice(0, 3).map((k, i) => (
        <g key={i} className={s.paNum}><circle cx={k.x + 15} cy={(k.y >= 70 ? FLOOR - R : k.y) - 13} r="6.5" /><text x={k.x + 15} y={(k.y >= 70 ? FLOOR - R : k.y) - 10.4}>{i + 1}</text></g>
      )) : null}
      {step === 2 ? arcPoints().slice(0, 10).map((p, i) => <circle key={i} className={s.paGhost} cx={p.x} cy={p.y} r={R} style={{ '--i': i } as CSSProperties} />) : null}
      {step === 2 ? arcPoints().slice(0, 10).map((p, i) => <path key={`t${i}`} className={s.paTick} d={`M${p.x.toFixed(1)} ${FLOOR + 4}v5`} />) : null}
      {step === 3 ? (
        <>
          <path className={s.paCurve} d={ARC} pathLength={1} />
          <circle className={s.paBall} cx={KEYS[3].x} cy={FLOOR - R} r={R} />
          <g className={s.paChip}><rect x="118" y="2" width="76" height="17" rx="8.5" /><text x="156" y="13.6">spring.pop</text></g>
        </>
      ) : null}
    </svg>
  );
}
