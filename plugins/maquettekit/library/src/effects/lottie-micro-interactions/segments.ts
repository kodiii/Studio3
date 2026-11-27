/**
 * Segment map of an interactive Lottie icon.
 *
 *   off rest ──on──▶ on rest ──off──▶ off rest (same pose as on[0])
 *   frame on[0]       on[1] = off[0]   off[1]
 *
 * `hover.on` / `hover.off` are the first frames of the transition that hover and keyboard focus preview and hold
 * (the wind-up); a click continues from that exact frame, so preview and commit never fight. Without `off`, the `on`
 * transition plays backwards to switch off, and the off-state preview plays the last `hover.off` frames of it backwards.
 */
export interface LottieSegments {
  on: readonly [number, number];
  off?: readonly [number, number];
  hover?: { readonly on?: number; readonly off?: number };
}
