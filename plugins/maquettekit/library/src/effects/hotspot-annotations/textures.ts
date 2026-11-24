/** Procedural canvas textures for the radio (drawn once; disposed by the scene on unmount). */
import { CanvasTexture, SRGBColorSpace } from 'three';
import { COLORS } from './data';

function make(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (!g) return null;
  draw(g);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Perforated steel: staggered holes with a faint rim. */
export const grilleTexture = () => make(512, 512, (g) => {
  g.fillStyle = COLORS.panel;
  g.fillRect(0, 0, 512, 512);
  const step = 21;
  for (let row = 0, y = 12; y < 512; row++, y += step * 0.87) {
    for (let x = 12 + (row % 2) * (step / 2); x < 512; x += step) {
      g.beginPath(); g.arc(x, y, 6.2, 0, Math.PI * 2); g.fillStyle = '#0d0c0b'; g.fill();
      g.beginPath(); g.arc(x - 0.8, y - 0.8, 6.2, Math.PI * 1.05, Math.PI * 1.6); g.strokeStyle = '#4a463f'; g.lineWidth = 1.2; g.stroke();
    }
  }
});

/** Tuning window: cream scale on smoked glass, mono numerals (system monospace: no font loading needed). */
export const windowTexture = () => make(1024, 460, (g) => {
  g.fillStyle = '#1b1a17';
  g.fillRect(0, 0, 1024, 460);
  g.strokeStyle = '#e9dfca';
  g.fillStyle = '#e9dfca';
  for (let i = 0; i <= 40; i++) {
    const x = 70 + i * 22.1;
    const major = i % 5 === 0;
    g.lineWidth = major ? 4 : 2;
    g.beginPath(); g.moveTo(x, 150); g.lineTo(x, major ? 250 : 205); g.stroke();
  }
  g.font = '600 62px ui-monospace, Menlo, Consolas, monospace';
  g.textAlign = 'center';
  ['88', '92', '96', '100', '104', '108'].forEach((n, i) => g.fillText(n, 70 + i * 8 * 22.1 * (5 / 8) * 1.6, 340));
  g.font = '600 40px ui-monospace, Menlo, Consolas, monospace';
  g.fillText('FM · MHz', 512, 110);
});

/** Soft contact shadow under the radio. */
export const blobTexture = () => make(128, 128, (g) => {
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(18,14,10,0.9)');
  grad.addColorStop(0.55, 'rgba(18,14,10,0.35)');
  grad.addColorStop(1, 'rgba(18,14,10,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
});
