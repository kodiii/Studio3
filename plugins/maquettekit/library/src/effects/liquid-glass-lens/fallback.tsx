'use client';
/**
 * No-WebGL path. `PageSvg` draws the same composition as the WebGL texture, as SVG in the DOM; `GlassFallback` runs
 * the lens physics on a rAF loop (instead of the R3F frame loop) and tells the host to dress the lens handle as a
 * CSS glass panel (backdrop-filter, layered rims, a sheen that follows the light).
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useElementSize, useRafLoop } from '../../motion';
import { canvasMeasure, compose, type Theme } from './composition';
import type { LensEngine } from './engine';
import styles from './styles.module.css';

export function PageSvg({ theme }: { theme: Theme | null }) {
  const box = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(box);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const comp = useMemo(() => (theme && width > 0 && height > 0 ? compose(width / height, theme, canvasMeasure()) : null), [theme, width, height]);
  return (
    <div ref={box} className={styles.page} aria-hidden="true">
      {comp ? (
        <svg viewBox={`0 0 ${comp.width} ${comp.height}`} preserveAspectRatio="xMidYMid slice" focusable="false">
          {comp.items.map((it, i) => {
            switch (it.k) {
              case 'rect': return <rect key={i} x={it.x} y={it.y} width={it.w} height={it.h} fill={it.fill} />;
              case 'grid': {
                const lines: ReactNode[] = [];
                for (let j = 0, x = 0; x <= it.w; x += it.step, j++) lines.push(<line key={`v${j}`} x1={x} y1={0} x2={x} y2={it.h} stroke={j % it.every ? it.minor : it.major} />);
                for (let j = 0, y = 0; y <= it.h; y += it.step, j++) lines.push(<line key={`h${j}`} x1={0} y1={y} x2={it.w} y2={y} stroke={j % it.every ? it.minor : it.major} />);
                return <g key={i} strokeWidth={1} vectorEffect="non-scaling-stroke">{lines}</g>;
              }
              case 'line': return <line key={i} x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} stroke={it.stroke} strokeWidth={it.width} />;
              case 'reg': return (
                <g key={i} fill="none" stroke={it.stroke} strokeWidth={0.9}>
                  <circle cx={it.cx} cy={it.cy} r={it.r} />
                  <path d={`M${it.cx - it.r * 1.8} ${it.cy}H${it.cx + it.r * 1.8}M${it.cx} ${it.cy - it.r * 1.8}V${it.cy + it.r * 1.8}`} />
                </g>
              );
              case 'sun': return (
                <g key={i}>
                  <clipPath id={`${uid}sun${i}`}><circle cx={it.cx} cy={it.cy} r={it.r} /></clipPath>
                  <circle cx={it.cx} cy={it.cy} r={it.r} fill={it.fill} />
                  <g clipPath={`url(#${uid}sun${i})`} fill={it.barFill}>
                    {it.bars.map(([y, h], j) => <rect key={j} x={it.cx - it.r} y={y} width={it.r * 2} height={h} />)}
                  </g>
                </g>
              );
              case 'dots': {
                const cols = Math.floor(it.w / it.step), rows = Math.max(1, Math.floor(it.h / it.step));
                const dots: ReactNode[] = [];
                for (let a = 0; a <= cols; a++) for (let b = 0; b < rows; b++) {
                  dots.push(<circle key={`${a}-${b}`} cx={it.x + a * it.step} cy={it.y + (b + 0.5) * (it.h / rows)} r={it.r0 + (it.r1 - it.r0) * (a / Math.max(1, cols))} />);
                }
                return <g key={i} fill={it.fill}>{dots}</g>;
              }
              case 'text': return (
                <text
                  key={i} x={it.x} y={it.y} fill={it.fill} fontFamily={it.family} fontSize={it.size} fontWeight={it.weight}
                  fontStyle={it.italic ? 'italic' : undefined} letterSpacing={it.tracking * it.size}
                  textAnchor={it.align === 'left' ? 'start' : it.align === 'right' ? 'end' : 'middle'}
                >{it.text}</text>
              );
            }
          })}
        </svg>
      ) : null}
    </div>
  );
}

export interface GlassFallbackProps {
  engine: LensEngine;
  wake: RefObject<(() => void) | null>;
  onFrame: RefObject<(() => void) | null>;
  /** Mounted (true) / unmounted (false): the host switches the lens handle to its CSS glass dress. */
  onActive: (active: boolean) => void;
  children: ReactNode;
}

export function GlassFallback({ engine, wake, onFrame, onActive, children }: GlassFallbackProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    const start = () => setRunning(true);
    wake.current = start;
    onActive(true);
    return () => { if (wake.current === start) wake.current = null; onActive(false); };
  }, [wake, onActive]);
  useRafLoop(ref, (dt) => {
    const busy = engine.step(dt);
    onFrame.current?.();
    if (!busy) setRunning(false);
  }, running);
  return <div ref={ref} className={styles.page}>{children}</div>;
}
