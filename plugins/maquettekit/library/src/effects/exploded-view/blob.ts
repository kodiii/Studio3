import { CanvasTexture, SRGBColorSpace } from 'three';

/** Soft radial floor shadow, drawn once. */
export function blobTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(16,13,10,0.8)');
  grad.addColorStop(0.5, 'rgba(16,13,10,0.3)');
  grad.addColorStop(1, 'rgba(16,13,10,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
