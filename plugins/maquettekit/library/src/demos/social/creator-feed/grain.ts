/**
 * Paper grain, adapted from the grain-gradient-mesh recipe: a 128 px tile of seeded, roughly Gaussian luminance noise
 * rendered ONCE with canvas2d and kept as a PNG data URL. Laid over the prints with `multiply` at low opacity it gives
 * the paper tooth and the slightly broken ink coverage of a real riso print, without any per-frame work.
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

/** The cached data URL (generated on first call); empty when canvas2d is unavailable. */
export function grainTile(size = 128): string {
  if (cached !== null) return cached;
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) { cached = ''; return cached; }
  const img = ctx.createImageData(size, size);
  const rnd = mulberry32(0x71de);
  for (let i = 0; i < img.data.length; i += 4) {
    // Light-biased noise: mostly near-white with darker flecks, so `multiply` only ever darkens a little.
    const g = (rnd() + rnd() + rnd()) / 3;
    const v = 255 - Math.max(0, (0.5 - g) * 2) * 150 - rnd() * 18;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v < 0 ? 0 : v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  cached = canvas.toDataURL('image/png');
  return cached;
}
