/**
 * Colourways for the 2D poster without extra renders: the single studio render is tinted in the browser.
 *
 * 1. Classify once: anodised hardware is the only saturated orange (hue 12–48°); the shell is the low-saturation
 *    grey that is NOT the grille plate (convex hull of its bright perforated pixels), NOT the driver cone (a disc
 *    inside the trim ring), NOT the strap (the opaque run above the shell in each column, plus a band along its
 *    right-hand stitching) and NOT the rubber feet.
 * 2. Recolour on demand in linear light: target colour × (pixel luminance ÷ median luminance of its class), with a
 *    soft roll-off above the base so highlights stay highlights. Results are cached as object URLs.
 *
 * The geometry constants are tuned to /models/pulse-speaker.webp (1024 × 1024, generated deterministically).
 */

export interface Tint { shell: string; accent: string }
export interface Recolourer { render(t: Tint): Promise<string | null>; dispose(): void }

const SIZE = 1024;
const DRIVER = { x: 328.8, y: 584.7, r: 92 };
const FEET = [{ x: 275, y: 703, rx: 34, ry: 17 }, { x: 698, y: 822, rx: 38, ry: 19 }];
const STITCH = [[739, 360], [771, 387], [796, 413], [820, 445], [839, 480], [851, 515], [858, 545]] as const;

const LIN = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const toSrgb = (l: number): number => {
  const c = l <= 0 ? 0 : l >= 1 ? 1 : l;
  return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
};
const hexLin = (hex: string): [number, number, number] => [1, 3, 5].map((i) => LIN[parseInt(hex.slice(i, i + 2), 16)]) as [number, number, number];

function hull(points: [number, number][]): [number, number][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], up: [number, number][] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

function median(values: Float32Array, n: number): number {
  const v = Array.from(values.subarray(0, n)).sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)] || 0.15;
}

export async function createRecolourer(src: string): Promise<Recolourer | null> {
  if (typeof document === 'undefined') return null;
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  try { await img.decode(); } catch { return null; }

  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  let base: ImageData;
  try { base = ctx.getImageData(0, 0, SIZE, SIZE); } catch { return null; }
  const d = base.data;
  const W = SIZE, H = SIZE;
  const hsv = (i: number) => {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min;
    let h = 0;
    if (c) h = max === r ? ((g - b) / c + 6) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
    return { h: h * 60, s: max ? c / max : 0, v: max / 255 };
  };

  // Exclusion mask drawn with canvas paths: grille hull, driver disc, feet, the strap's stitched side.
  const ext: [number, number][] = [];
  for (let y = 400; y < 840; y++) {
    let lo = -1, hi = -1, n = 0;
    for (let x = 170; x < 760; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] < 200) continue;
      const { s, v } = hsv(i);
      if (s < 0.06 && v > 0.6) { if (lo < 0) lo = x; hi = x; n++; }
    }
    if (n > 6) ext.push([lo, y], [hi, y]);
  }
  const mask = document.createElement('canvas');
  mask.width = W; mask.height = H;
  const m = mask.getContext('2d', { willReadFrequently: true });
  if (!m || ext.length < 6) return null;
  const g = hull(ext);
  const cx = g.reduce((a, q) => a + q[0], 0) / g.length, cy = g.reduce((a, q) => a + q[1], 0) / g.length;
  m.fillStyle = '#000';
  m.beginPath();
  g.forEach(([x, y], k) => { const l = Math.hypot(x - cx, y - cy) || 1; const px = x + ((x - cx) / l) * 2.5, py = y + ((y - cy) / l) * 2.5; if (k) m.lineTo(px, py); else m.moveTo(px, py); });
  m.closePath(); m.fill();
  m.beginPath(); m.arc(DRIVER.x, DRIVER.y, DRIVER.r, 0, Math.PI * 2); m.fill();
  for (const f of FEET) { m.beginPath(); m.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, Math.PI * 2); m.fill(); }
  m.strokeStyle = '#000'; m.lineWidth = 34; m.lineCap = 'round'; m.lineJoin = 'round';
  m.beginPath(); STITCH.forEach(([x, y], k) => (k ? m.lineTo(x, y) : m.moveTo(x, y))); m.stroke();
  const ex = m.getImageData(0, 0, W, H).data;
  const strap = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (ex[i * 4 + 3] > 0) strap[i] = 2; // 2 = excluded from the shell only
  // The strap's top arc: in each column, the first opaque run above the shell (separated from it by a gap).
  for (let x = 215; x < 800; x++) {
    let start = -1, runs = 0;
    for (let y = 150; y <= 520; y++) {
      const o = y < 520 && d[(y * W + x) * 4 + 3] > 8;
      if (o && start < 0) start = y;
      if (!o && start >= 0) {
        if (runs === 0) {
          // only a strap if another opaque run (the shell) follows below
          let more = false;
          for (let k = y + 1; k < 520; k++) if (d[(k * W + x) * 4 + 3] > 8) { more = true; break; }
          if (more) for (let k = start; k < y; k++) strap[k * W + x] = 1;
        }
        runs++; start = -1;
      }
    }
  }
  // Stitch band pixels are strap (excluded from accent too); grille/driver/feet only exclude the shell.
  const band = document.createElement('canvas');
  band.width = W; band.height = H;
  const bctx = band.getContext('2d', { willReadFrequently: true });
  if (bctx) {
    bctx.strokeStyle = '#000'; bctx.lineWidth = 34; bctx.lineCap = 'round'; bctx.lineJoin = 'round';
    bctx.beginPath(); STITCH.forEach(([x, y], k) => (k ? bctx.lineTo(x, y) : bctx.moveTo(x, y))); bctx.stroke();
    const bd = bctx.getImageData(0, 0, W, H).data;
    for (let i = 0; i < W * H; i++) if (bd[i * 4 + 3] > 0) strap[i] = 1;
  }

  const labels = new Uint8Array(W * H); // 0 keep · 1 shell · 2 hardware
  const lum = new Float32Array(W * H);
  const shellL = new Float32Array(W * H), accL = new Float32Array(W * H);
  let ns = 0, na = 0;
  for (let p = 0, i = 0; p < W * H; p++, i += 4) {
    if (d[i + 3] < 4 || strap[p] === 1) continue;
    const { h, s, v } = hsv(i);
    const L = 0.2126 * LIN[d[i]] + 0.7152 * LIN[d[i + 1]] + 0.0722 * LIN[d[i + 2]];
    lum[p] = L;
    if (h >= 12 && h <= 48 && s > 0.3 && v > 0.18) { labels[p] = 2; if ((p & 3) === 0) accL[na++] = L; continue; }
    if (h >= 150 && h <= 205 && s > 0.12) continue; // status light
    if (strap[p] === 2) continue;
    if (s < 0.22) { labels[p] = 1; if ((p & 3) === 0) shellL[ns++] = L; }
  }
  const refShell = median(shellL, ns), refAccent = median(accL, na);

  const urls = new Map<string, string>();
  let disposed = false;
  const render = async (t: Tint): Promise<string | null> => {
    const key = `${t.shell}|${t.accent}`;
    const hit = urls.get(key);
    if (hit) return hit;
    const S = hexLin(t.shell), A = hexLin(t.accent);
    const out = new ImageData(new Uint8ClampedArray(d), W, H);
    const o = out.data;
    for (let p = 0, i = 0; p < W * H; p++, i += 4) {
      const lab = labels[p];
      if (!lab) continue;
      const T = lab === 1 ? S : A;
      const f = lum[p] / (lab === 1 ? refShell : refAccent);
      for (let c = 0; c < 3; c++) {
        let v = T[c] * f;
        if (v > T[c]) v = T[c] + (v - T[c]) * 0.55;
        o[i + c] = toSrgb(v);
      }
    }
    ctx.putImageData(out, 0, 0);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.9));
    if (!blob || disposed) return null;
    const url = URL.createObjectURL(blob);
    urls.set(key, url);
    return url;
  };
  return {
    render,
    dispose() { disposed = true; for (const u of urls.values()) URL.revokeObjectURL(u); urls.clear(); },
  };
}
