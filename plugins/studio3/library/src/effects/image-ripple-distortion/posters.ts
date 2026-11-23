/**
 * Three generated posters for a fictional exhibition series, drawn with canvas2d in the CURRENT theme colours
 * (read from the --s3-* tokens on the element), so the textures follow light and dark themes.
 */
export interface Poster { title: string; subtitle: string }
export const POSTERS: readonly Poster[] = [
  { title: 'Tidewater', subtitle: 'Studies in slow motion · No. 01' },
  { title: 'Meridian', subtitle: 'Studies in slow motion · No. 02' },
  { title: 'Field Notes', subtitle: 'Studies in slow motion · No. 03' },
];

export interface Theme { paper: string; ink: string; signal: string; muted: string; display: string; serif: string; mono: string }

export function readTheme(el: Element): Theme {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    paper: v('--s3-surface', '#fbf9f4'), ink: v('--s3-ink', '#11110f'), signal: v('--s3-signal', '#bf2f09'), muted: v('--s3-ink-muted', '#5c5a52'),
    display: v('--s3-font-display', 'system-ui, sans-serif'), serif: v('--s3-font-serif', 'Georgia, serif'), mono: v('--s3-font-mono', 'ui-monospace, monospace'),
  };
}

/** Fonts the posters use; resolve before (re)drawing so the canvas never caches a fallback face. */
export const posterFonts = (t: Theme) => [`700 100px ${t.display}`, `italic 400 100px ${t.serif}`, `500 20px ${t.mono}`];

function setFont(g: CanvasRenderingContext2D, font: string, fallback: string) {
  g.font = fallback;
  g.font = font; // ignored by the canvas if the family list does not parse — the fallback stays
}

export function drawPoster(g: CanvasRenderingContext2D, i: number, w: number, h: number, t: Theme): void {
  const u = w / 600; // design unit: the posters are composed on a 600 × 800 grid
  const label = (text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') => {
    setFont(g, `500 ${14 * u}px ${t.mono}`, `500 ${14 * u}px monospace`);
    g.fillStyle = color; g.textAlign = align; g.fillText(text.toUpperCase(), x, y);
  };
  g.save();
  if (i === 0) {
    g.fillStyle = t.paper; g.fillRect(0, 0, w, h);
    g.fillStyle = t.signal; g.beginPath(); g.arc(410 * u, 250 * u, 150 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = t.ink;
    for (let k = 0; k < 11; k++) { const y = (430 + k * 26) * u; g.fillRect(0, y, w, Math.max(1, (14 - k * 1.1) * u)); }
    setFont(g, `700 ${100 * u}px ${t.display}`, `700 ${100 * u}px sans-serif`);
    g.fillStyle = t.ink; g.textAlign = 'left'; g.fillText('Tidewater', 34 * u, 760 * u, 532 * u);
    label(POSTERS[0].subtitle, 36 * u, 56 * u, t.ink);
    label('Sample poster', 564 * u, 56 * u, t.ink, 'right');
  } else if (i === 1) {
    g.fillStyle = t.ink; g.fillRect(0, 0, w, h);
    g.strokeStyle = t.paper; g.globalAlpha = 0.22; g.lineWidth = Math.max(1, u);
    for (let x = 60; x < 600; x += 60) { g.beginPath(); g.moveTo(x * u, 0); g.lineTo(x * u, h); g.stroke(); }
    for (let y = 80; y < 800; y += 80) { g.beginPath(); g.moveTo(0, y * u); g.lineTo(w, y * u); g.stroke(); }
    g.globalAlpha = 1;
    g.fillStyle = t.signal; g.fillRect(300 * u, 0, 60 * u, h);
    g.fillStyle = t.paper; g.beginPath(); g.arc(330 * u, 330 * u, 92 * u, 0, Math.PI * 2); g.fill();
    setFont(g, `italic 400 ${150 * u}px ${t.serif}`, `italic 400 ${150 * u}px serif`);
    g.fillStyle = t.paper; g.textAlign = 'center'; g.fillText('Meridian', 300 * u, 640 * u, 540 * u);
    label(POSTERS[1].subtitle, 300 * u, 720 * u, t.paper, 'center');
    label('Sample poster', 300 * u, 56 * u, t.paper, 'center');
  } else {
    g.fillStyle = t.signal; g.fillRect(0, 0, w, h);
    for (let k = 7; k >= 1; k--) {
      g.fillStyle = k % 2 ? t.ink : t.paper;
      g.beginPath(); g.moveTo(0, h); g.arc(0, h, k * 78 * u, -Math.PI / 2, 0); g.closePath(); g.fill();
    }
    setFont(g, `700 ${104 * u}px ${t.display}`, `700 ${104 * u}px sans-serif`);
    g.fillStyle = t.paper; g.textAlign = 'right'; g.fillText('Field', 566 * u, 150 * u, 400 * u); g.fillText('Notes', 566 * u, 250 * u, 400 * u);
    label(POSTERS[2].subtitle, 566 * u, 300 * u, t.paper, 'right');
    label('Sample poster', 36 * u, 56 * u, t.paper);
  }
  g.restore();
}

/** Draw poster `i` into a fresh canvas element (used for textures and for the no-WebGL fallback images). */
export function posterCanvas(i: number, w: number, t: Theme): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(w); c.height = Math.round((w * 4) / 3);
  const g = c.getContext('2d');
  if (g) drawPoster(g, i, c.width, c.height, t);
  return c;
}
