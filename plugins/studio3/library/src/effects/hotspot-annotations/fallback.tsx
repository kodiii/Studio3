'use client';
/** No-WebGL fallback: a front elevation of the radio in SVG with the same numbered annotations. */
import { COLORS, SPOTS } from './data';

/** Front-view anchor of each hotspot in the 400 × 300 drawing (the back-panel door is noted beside the radio). */
const AT: Record<string, [number, number]> = { dial: [262, 205], grille: [138, 170], handle: [200, 46], battery: [352, 236] };

export function RadioDrawing({ active }: { active: string | null }) {
  return (
    <svg viewBox="0 0 400 300" role="img" aria-label="Front view drawing of the field radio: a cream enamel case with a perforated speaker panel on the left, a tuning window and a brass dial on the right, a leather strap on top and an antenna at the back right." style={{ width: 'min(100%, 520px)', height: 'auto', maxHeight: 'calc(100% - 56px)' }}>
      <defs>
        <pattern id="s3-radio-holes" width="9" height="8" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="2.2" fill="#0d0c0b" /><circle cx="7" cy="6.5" r="2.2" fill="#0d0c0b" />
        </pattern>
      </defs>
      <ellipse cx="200" cy="262" rx="160" ry="10" fill="#11110f" opacity="0.14" />
      <line x1="318" y1="78" x2="372" y2="8" stroke={COLORS.steel} strokeWidth="3" strokeLinecap="round" />
      <path d="M110 78c8-46 172-46 180 0" fill="none" stroke={COLORS.leather} strokeWidth="9" strokeLinecap="round" />
      <rect x="40" y="74" width="320" height="184" rx="20" fill={COLORS.enamel} stroke="#11110f" strokeOpacity="0.3" />
      <rect x="66" y="100" width="146" height="140" rx="3" fill={COLORS.panel} />
      <rect x="66" y="100" width="146" height="140" rx="3" fill="url(#s3-radio-holes)" />
      <rect x="236" y="104" width="100" height="44" rx="3" fill="#1b1a17" />
      <g stroke="#e9dfca" strokeWidth="1.4">{Array.from({ length: 17 }, (_, i) => <line key={i} x1={244 + i * 5.2} x2={244 + i * 5.2} y1={120} y2={i % 4 === 0 ? 134 : 128} />)}</g>
      <line x1="276" y1="110" x2="276" y2="142" stroke={COLORS.needle} strokeWidth="2.4" />
      <circle cx="286" cy="205" r="30" fill={COLORS.brass} stroke="#11110f" strokeOpacity="0.3" />
      <circle cx="286" cy="205" r="11" fill={COLORS.panel} />
      {SPOTS.map((s, i) => {
        const [x, y] = AT[s.id];
        const on = active === s.id;
        return (
          <g key={s.id} aria-hidden="true">
            <circle cx={x} cy={y} r="11" fill={on ? '#11110f' : '#fbf9f4'} stroke="#11110f" strokeWidth="1.5" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="ui-monospace, monospace" fill={on ? '#fbf9f4' : '#11110f'}>{i + 1}</text>
          </g>
        );
      })}
      <text x="352" y="219" textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="ui-monospace, monospace" fill="#4a4842" aria-hidden="true">BACK</text>
    </svg>
  );
}
