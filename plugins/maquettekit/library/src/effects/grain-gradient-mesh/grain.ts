/**
 * Film-grain tile: a small square of seeded, roughly Gaussian luminance noise rendered ONCE with canvas2d and kept
 * as a PNG data URL. Tiled with CSS and blended with `overlay`, mid-grey (128) leaves colours untouched while the
 * deviations add grain — and dither away the banding that large 8-bit gradients otherwise show.
 */
let cached: string | null = null;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns the cached data URL (generated on first call). Empty string when canvas2d is unavailable. */
export function grainTile(size = 128): string {
  if (cached !== null) return cached;
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) { cached = ''; return cached; }
  const img = ctx.createImageData(size, size);
  const rnd = mulberry32(0x5eed);
  for (let i = 0; i < img.data.length; i += 4) {
    // Sum of three uniforms ≈ Gaussian, σ ≈ 35 levels around mid-grey.
    const v = 128 + (rnd() + rnd() + rnd() - 1.5) * 70;
    const c = v < 0 ? 0 : v > 255 ? 255 : v;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  cached = canvas.toDataURL('image/png');
  return cached;
}
