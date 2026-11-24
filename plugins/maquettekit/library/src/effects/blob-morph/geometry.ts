/**
 * Blob geometry: seeded keyframe shapes with equal point counts + a closed Catmull-Rom → cubic Bézier path.
 * Every shape samples a smooth radial function at the SAME angles, so two shapes interpolate point-for-point
 * (no resampling, no kinks) and the morph is just N numbers on a spring.
 */

/** mulberry32: tiny seeded PRNG — the same seed draws the same forms on every machine. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BlobShape {
  /** One radius per anchor, normalised so the largest is 1. */
  radii: number[];
  /** Rotation offset in radians (interpolated with the radii). */
  rotation: number;
}

/**
 * `count` forms of `points` anchors. Each form is r(θ) = 1 + Σ a_k·cos(kθ + φ_k) over low harmonics
 * (k = 2…kMax, amplitude falling with k), which reads as a pebble or a soft cell rather than a spiky star.
 */
export function makeShapes(count: number, points: number, wobble: number, seed: number): BlobShape[] {
  const rnd = mulberry32(Math.round(seed) * 9973 + points * 131 + 17);
  const kMax = Math.max(2, Math.min(5, Math.floor(points / 2)));
  const shapes: BlobShape[] = [];
  for (let s = 0; s < count; s++) {
    const harmonics: { k: number; a: number; phi: number }[] = [];
    for (let k = 2; k <= kMax; k++) harmonics.push({ k, a: (wobble * (0.4 + rnd() * 0.6)) / Math.pow(k - 1, 0.85), phi: rnd() * Math.PI * 2 });
    const radii: number[] = [];
    for (let i = 0; i < points; i++) {
      const th = (i / points) * Math.PI * 2;
      let r = 1;
      for (const h of harmonics) r += h.a * Math.cos(h.k * th + h.phi);
      radii.push(r);
    }
    const max = Math.max(...radii);
    shapes.push({ radii: radii.map((r) => Math.max(0.52, r / max)), rotation: (rnd() - 0.5) * 0.6 });
  }
  return shapes;
}

/** Closed, uniform Catmull-Rom spline through the anchors, emitted as cubic Bézier segments. */
export function blobPath(radii: ArrayLike<number>, rotation: number, cx: number, cy: number, radius: number): string {
  const n = radii.length;
  const xs = new Array<number>(n);
  const ys = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2 + rotation - Math.PI / 2;
    xs[i] = cx + Math.cos(th) * radii[i] * radius;
    ys[i] = cy + Math.sin(th) * radii[i] * radius;
  }
  const f = (v: number) => v.toFixed(2);
  let d = `M${f(xs[0])} ${f(ys[0])}`;
  for (let i = 0; i < n; i++) {
    const p = (i - 1 + n) % n, q = (i + 1) % n, r = (i + 2) % n;
    const c1x = xs[i] + (xs[q] - xs[p]) / 6, c1y = ys[i] + (ys[q] - ys[p]) / 6;
    const c2x = xs[q] - (xs[r] - xs[i]) / 6, c2y = ys[q] - (ys[r] - ys[i]) / 6;
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(xs[q])} ${f(ys[q])}`;
  }
  return `${d}Z`;
}
