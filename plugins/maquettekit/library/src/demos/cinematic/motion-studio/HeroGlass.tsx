'use client';
/**
 * The hero object, loaded lazily (it carries three.js): the liquid-glass-lens recipe's named component as a loupe on
 * the studio's light table. The page under the glass is the manifesto, drawn through `draw` in the demo's own
 * palette tokens; without WebGL the same sheet is SVG under the recipe's CSS glass, dragged and keyed the same way.
 */
import { useCallback, useMemo, type Ref } from 'react';
import { LiquidGlassLens, type LensHandle } from '../../../effects/liquid-glass-lens';
import { composeManifesto, drawManifesto, type Theme } from './manifesto';
import { ManifestoSvg } from './ManifestoSvg';
import { STUDIO } from './content';
import s from './styles.module.css';

export interface HeroGlassProps {
  theme: Theme | null;
  /** Bumps whenever the theme is re-read (palette switch, fonts loaded): redraws the texture. */
  version: number;
  describedBy: string;
  lensRef: Ref<LensHandle>;
  className?: string;
}

export default function HeroGlass({ theme, version, describedBy, lensRef, className }: HeroGlassProps) {
  const draw = useCallback((g: CanvasRenderingContext2D, w: number, h: number) => {
    if (theme) drawManifesto(g, w, h, composeManifesto(w / h, theme, STUDIO.manifesto));
  }, [theme]);
  const fallback = useMemo(() => <ManifestoSvg theme={theme} version={version} className={s.sheet} />, [theme, version]);
  return (
    <LiquidGlassLens
      ref={lensRef}
      shape="circle"
      refraction={1.1}
      dispersion={0.55}
      frost={0}
      followLight
      draw={draw}
      drawKey={version}
      fallback={fallback}
      label="Glass loupe over the Lead & Lag manifesto"
      description="A light table holds the studio's manifesto, Nothing stops dead, set as a staircase. A ball bounces down the three words in faint onion-skin frames and lands as the full stop. Around it: an easing graph, a spring curve, a spacing chart and a 24-frame timeline. A thick round glass loupe rests on the sheet; around its rim the page bends, splits into colour and catches the light."
      describedBy={describedBy}
      className={className}
    />
  );
}
