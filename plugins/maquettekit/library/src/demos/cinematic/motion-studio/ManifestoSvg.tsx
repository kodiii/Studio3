'use client';
/**
 * The manifesto sheet as SVG: the same items the lens texture is drawn from, for the no-WebGL fallback (under the
 * recipe's CSS glass) and as the poster that paints first while the WebGL chunk loads.
 */
import { useId, useMemo, useRef, type ReactNode } from 'react';
import { useElementSize } from '../../../motion';
import { composeManifesto, ringGlyphs, type Item, type Theme } from './manifesto';
import { STUDIO } from './content';

const dash = (d?: readonly number[]) => (d ? d.join(' ') : undefined);

function renderItem(it: Item, i: number, uid: string): ReactNode {
  switch (it.k) {
    case 'rect': return <rect key={i} x={it.x} y={it.y} width={it.w} height={it.h} rx={it.r} fill={it.fill ?? 'none'} stroke={it.stroke} strokeWidth={it.width} opacity={it.alpha} strokeDasharray={dash(it.dash)} />;
    case 'glow': return (
      <g key={i}>
        <defs>
          <radialGradient id={`${uid}g${i}`} cx={it.cx} cy={it.cy} r={it.rx} gradientUnits="userSpaceOnUse" gradientTransform={`translate(0 ${it.cy}) scale(1 ${it.ry / it.rx}) translate(0 ${-it.cy})`}>
            <stop offset="0" stopColor={it.from} />
            <stop offset="1" stopColor={it.to} />
          </radialGradient>
        </defs>
        <rect x={it.cx - it.rx} y={it.cy - it.ry} width={it.rx * 2} height={it.ry * 2} fill={`url(#${uid}g${i})`} />
      </g>
    );
    case 'path': return <path key={i} d={it.d} fill={it.fill ?? 'none'} stroke={it.stroke} strokeWidth={it.width} opacity={it.alpha} strokeDasharray={dash(it.dash)} strokeLinecap={it.cap} strokeLinejoin="round" />;
    case 'circle': return <circle key={i} cx={it.cx} cy={it.cy} r={it.r} fill={it.fill ?? 'none'} stroke={it.stroke} strokeWidth={it.width} opacity={it.alpha} />;
    case 'ellipse': return <ellipse key={i} cx={it.cx} cy={it.cy} rx={it.rx} ry={it.ry} transform={it.rot ? `rotate(${it.rot} ${it.cx} ${it.cy})` : undefined} fill={it.fill ?? 'none'} stroke={it.stroke} strokeWidth={it.width} opacity={it.alpha} />;
    case 'ring': return (
      <g key={i} fill={it.fill} opacity={it.alpha} fontFamily={it.family} fontSize={it.size} fontWeight={it.weight} textAnchor="middle" dominantBaseline="central">
        {ringGlyphs(it).map((c, j) => <text key={j} x={c.x} y={c.y} transform={`rotate(${c.deg.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)})`}>{c.ch}</text>)}
      </g>
    );
    case 'text': return (
      <text
        key={i} x={it.x} y={it.y} fill={it.fill} opacity={it.alpha} fontFamily={it.family} fontSize={it.size} fontWeight={it.weight}
        fontStyle={it.italic ? 'italic' : undefined} letterSpacing={it.tracking * it.size}
        textAnchor={it.align === 'left' ? 'start' : it.align === 'right' ? 'end' : 'middle'}
      >{it.text}</text>
    );
  }
}

/** The sheet, cover-fitted to its box. `version` re-lays it out after the fonts load. */
export function ManifestoSvg({ theme, version, className }: { theme: Theme | null; version: number; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(box);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const comp = useMemo(
    () => (theme && width > 0 && height > 0 ? composeManifesto(width / height, theme, STUDIO.manifesto) : null),
    // version: fonts loaded, measure again
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, width, height, version],
  );
  return (
    <div ref={box} className={className} aria-hidden="true">
      {comp ? (
        <svg viewBox={`0 0 ${comp.width} ${comp.height}`} preserveAspectRatio="xMidYMid slice" focusable="false" width="100%" height="100%" style={{ display: 'block' }}>
          {comp.items.map((it, i) => renderItem(it, i, uid))}
        </svg>
      ) : null}
    </div>
  );
}
