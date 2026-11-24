'use client';
/**
 * No-WebGL fallback: a flat exploded diagram of the same assembly. The slider still drives it (same staggered
 * progress function), and part rows still highlight their part — only the third dimension is missing.
 */
import { COLORS, PARTS, partProgress, type PartId } from './parts';

/** Screen offset (px at full separation, spread 1) for each part in the 480 × 320 drawing. */
const OFFSET: Record<PartId, [number, number]> = {
  glass: [128, 34], barrel: [86, 22], mount: [44, 11], top: [0, -64], grip: [-78, 8], battery: [0, 74], body: [0, 0],
};

export function ExplodedDrawing({ amount, spread, stagger, highlight, accent }: { amount: number; spread: number; stagger: number; highlight: PartId | null; accent: string }) {
  const at = (id: PartId) => {
    const p = PARTS.find((x) => x.id === id)!;
    const t = partProgress(p.order, amount, stagger) * spread;
    return `translate(${(OFFSET[id][0] * t).toFixed(1)} ${(OFFSET[id][1] * t).toFixed(1)})`;
  };
  const hot = (id: PartId) => (highlight === id ? { stroke: accent, strokeWidth: 3 } : { stroke: '#11110f', strokeOpacity: 0.35, strokeWidth: 1 });
  return (
    <svg viewBox="0 0 480 320" role="img" aria-label="Exploded diagram of the compact camera: lens elements move forward, the top plate lifts, the grip slides off to the side and the battery drops out of the body." style={{ width: 'min(100%, 560px)', height: 'auto', maxHeight: 'calc(100% - 56px)' }}>
      <ellipse cx="250" cy="300" rx="170" ry="9" fill="#11110f" opacity="0.12" />
      <g transform={at('battery')}><rect x="168" y="178" width="84" height="26" rx="4" fill={COLORS.battery} {...hot('battery')} /></g>
      <g transform={at('body')}><rect x="140" y="122" width="200" height="110" rx="12" fill={COLORS.leatherette} {...hot('body')} /></g>
      <g transform={at('grip')}><rect x="150" y="130" width="34" height="94" rx="7" fill={COLORS.grip} {...hot('grip')} /></g>
      <g transform={at('top')}>
        <rect x="142" y="108" width="196" height="16" rx="5" fill={COLORS.alu} {...hot('top')} />
        <rect x="270" y="98" width="38" height="12" rx="3" fill={COLORS.alu} {...hot('top')} />
        <rect x="314" y="100" width="12" height="8" rx="2" fill={accent} />
      </g>
      <g transform={at('mount')}><circle cx="262" cy="176" r="46" fill={COLORS.steel} {...hot('mount')} /><circle cx="262" cy="176" r="36" fill="#2b2a27" /></g>
      <g transform={at('barrel')}><circle cx="262" cy="176" r="41" fill={COLORS.anodised} {...hot('barrel')} /><circle cx="262" cy="176" r="38" fill="none" stroke={accent} strokeWidth="3" /></g>
      <g transform={at('glass')}>
        <circle cx="262" cy="176" r="31" fill={COLORS.glass} {...hot('glass')} />
        <path d="M246 164a20 20 0 0 1 18-8" fill="none" stroke="#e9eef0" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
