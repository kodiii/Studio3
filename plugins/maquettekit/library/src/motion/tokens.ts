/**
 * Motion Lab — shared motion tokens.
 * One vocabulary for CSS, WAAPI, Motion and GSAP so choreography stays coherent
 * across specialties. Durations are milliseconds; convert with `sec()` for GSAP/Motion.
 */
export type Bezier = readonly [number, number, number, number];

export const duration = {
  instant: 90,   // press feedback, toggles
  fast: 160,     // hover, small state changes
  base: 240,     // most UI transitions
  moderate: 360, // panels, cards, shared elements
  slow: 560,     // page-level, large surfaces
  cinematic: 900, // hero reveals; never for repeated UI
  epic: 1400,    // scripted sequences only
} as const;
export type DurationToken = keyof typeof duration;

/** Cubic-bezier easings. `standard` for moves, `enter` to arrive, `exit` to leave. */
export const easing = {
  linear: [0, 0, 1, 1],
  standard: [0.2, 0, 0, 1],
  enter: [0.05, 0.7, 0.1, 1],
  exit: [0.3, 0, 0.8, 0.15],
  emphasized: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
  anticipate: [0.36, 0, 0.66, -0.56],
  overshoot: [0.34, 1.56, 0.64, 1],
} as const satisfies Record<string, Bezier>;
export type EasingToken = keyof typeof easing;

export const cssEase = (token: EasingToken | Bezier): string => {
  const b = typeof token === 'string' ? easing[token] : token;
  return `cubic-bezier(${b.join(', ')})`;
};

/** GSAP CustomEase-free approximations of the tokens, for projects without CustomEase. */
export const gsapEase: Record<EasingToken, string> = {
  linear: 'none', standard: 'power2.out', enter: 'power3.out', exit: 'power2.in',
  emphasized: 'expo.out', inOut: 'power2.inOut', anticipate: 'back.in(1.7)', overshoot: 'back.out(1.7)',
};

/** Spring presets (Motion-compatible `stiffness/damping/mass`). Named by role, not by feel. */
export const spring = {
  /** Buttons, toggles, chips: arrives fast, no visible bounce. */
  press: { stiffness: 520, damping: 34, mass: 0.8 },
  /** Cards, popovers, sheets settling. */
  settle: { stiffness: 260, damping: 28, mass: 1 },
  /** Dragged objects released by the user: carries velocity. */
  release: { stiffness: 180, damping: 20, mass: 1 },
  /** Playful social feedback (reactions, likes). Use sparingly. */
  pop: { stiffness: 420, damping: 14, mass: 0.9 },
  /** Large surfaces, shared-element transitions. */
  glide: { stiffness: 120, damping: 22, mass: 1.2 },
} as const;
export type SpringToken = keyof typeof spring;
export interface SpringConfig { stiffness: number; damping: number; mass: number }

export const stagger = { tight: 24, base: 48, loose: 90, dramatic: 140 } as const;
export const distance = { nudge: 4, short: 12, base: 24, long: 56, travel: 120 } as const;

/** Experience profiles scale motion; they never override reduced-motion. */
export type ExperienceProfile = 'essential' | 'expressive' | 'immersive';
export const profileScale: Record<ExperienceProfile, { duration: number; distance: number; stagger: number; maxConcurrent: number }> = {
  essential: { duration: 0.7, distance: 0.5, stagger: 0.5, maxConcurrent: 1 },
  expressive: { duration: 1, distance: 1, stagger: 1, maxConcurrent: 3 },
  immersive: { duration: 1.25, distance: 1.4, stagger: 1.2, maxConcurrent: 6 },
};

export const sec = (ms: number): number => ms / 1000;

/**
 * Sample a critically/under-damped spring into `points` linear() stops so a
 * spring can drive CSS/WAAPI (`easing: linear(...)`) without a JS loop.
 * Returns the easing string and the settle duration in ms.
 */
export function springToLinear(cfg: SpringConfig, points = 32): { easing: string; duration: number } {
  const { stiffness: k, damping: c, mass: m } = cfg;
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  const pos = (t: number): number => {
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  };
  // settle time: envelope below 0.1%
  const settle = Math.min(4, Math.max(0.1, -Math.log(0.001) / (Math.min(zeta, 1) * w0)));
  const stops: string[] = [];
  for (let i = 0; i <= points; i++) stops.push(pos((i / points) * settle).toFixed(4).replace(/\.?0+$/, '') || '0');
  stops[stops.length - 1] = '1';
  return { easing: `linear(${stops.join(', ')})`, duration: Math.round(settle * 1000) };
}

/** CSS custom properties for the token set (inject once at :root). */
export function motionTokensCss(): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(duration)) lines.push(`  --mk-duration-${k}: ${v}ms;`);
  for (const k of Object.keys(easing) as EasingToken[]) lines.push(`  --mk-ease-${k}: ${cssEase(k)};`);
  for (const [k, v] of Object.entries(stagger)) lines.push(`  --mk-stagger-${k}: ${v}ms;`);
  for (const [k, v] of Object.entries(distance)) lines.push(`  --mk-distance-${k}: ${v}px;`);
  return `:root {\n${lines.join('\n')}\n}`;
}
