/**
 * Baked ground shadows for the maquette. The key light is fixed to the model (the CAMERA orbits, not the sun), so a
 * shadow texture drawn once with canvas2d stays correct from every viewpoint — real-looking architecture shadows with
 * no shadow-map pass at any quality level.
 */
import { CanvasTexture, SRGBColorSpace } from 'three';
import { COLUMNS, CORE, FIGURE_HEIGHT, FIGURES, FIN, KEY_DIR, PODIUM, ROOF, SLAB, TREE_TRUNK, TREES, type Box } from './model';

const PPU = 160; // texels per model metre
const X0 = SLAB.x[0], Z0 = SLAB.z[0];
export const SHADOW_SIZE = { w: Math.round((SLAB.x[1] - SLAB.x[0]) * PPU), h: Math.round((SLAB.z[1] - SLAB.z[0]) * PPU) };

/** Ground-plane offset (dx, dz) per metre of height for the fixed key light. */
const len = Math.hypot(...KEY_DIR);
const L = KEY_DIR.map((v) => v / len) as [number, number, number];
const OFF = { x: -L[0] / L[1], z: -L[2] / L[1] };

const px = (x: number) => (x - X0) * PPU;
const pz = (z: number) => (z - Z0) * PPU;

type Ctx = CanvasRenderingContext2D;

/** Fill a soft shape: drawn 10 000 px off-canvas, only its blurred shadow lands on the texture (works everywhere). */
function soft(ctx: Ctx, blur: number, alpha: number, draw: (c: Ctx) => void): void {
  ctx.save();
  ctx.translate(-10000, 0);
  ctx.shadowOffsetX = 10000;
  ctx.shadowBlur = blur;
  ctx.shadowColor = `rgba(34, 26, 16, ${alpha})`;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  draw(ctx);
  ctx.fill();
  ctx.restore();
}

/** Footprint of a box swept along the light from its base height `g` to its top: the box's cast shadow. */
function sweep(c: Ctx, b: Box, g: number, steps = 6): void {
  const h = b.y[1] - g;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * h;
    c.rect(px(b.x[0] + OFF.x * t), pz(b.z[0] + OFF.z * t), (b.x[1] - b.x[0]) * PPU, (b.z[1] - b.z[0]) * PPU);
  }
}

export function bakeShadowTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = SHADOW_SIZE.w;
  canvas.height = SHADOW_SIZE.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const floor = PODIUM.y[1];

  // Cast shadows (soft penumbra grows with height, so the roof is the softest).
  soft(ctx, 26, 0.5, (c) => {
    const h = ROOF.y[0] - floor;
    c.rect(px(ROOF.x[0] + OFF.x * h), pz(ROOF.z[0] + OFF.z * h), (ROOF.x[1] - ROOF.x[0]) * PPU, (ROOF.z[1] - ROOF.z[0]) * PPU);
  });
  soft(ctx, 14, 0.55, (c) => sweep(c, CORE, floor));
  soft(ctx, 10, 0.45, (c) => sweep(c, FIN, floor));
  soft(ctx, 6, 0.5, (c) => {
    for (const [x, z] of COLUMNS) {
      const h = ROOF.y[0] - floor;
      c.moveTo(px(x - 0.03), pz(z));
      c.lineTo(px(x + 0.03), pz(z));
      c.lineTo(px(x + 0.03 + OFF.x * h), pz(z + OFF.z * h));
      c.lineTo(px(x - 0.03 + OFF.x * h), pz(z + OFF.z * h));
      c.closePath();
    }
  });
  soft(ctx, 16, 0.4, (c) => {
    for (const t of TREES) {
      const h = TREE_TRUNK + t.r * 0.6;
      c.ellipse(px(t.x + OFF.x * h), pz(t.z + OFF.z * h), t.r * PPU * 1.1, t.r * PPU * 0.95, 0, 0, Math.PI * 2);
    }
  });
  soft(ctx, 4, 0.45, (c) => {
    for (const f of FIGURES) {
      c.moveTo(px(f.x - 0.04), pz(f.z));
      c.lineTo(px(f.x + 0.04), pz(f.z));
      c.lineTo(px(f.x + 0.04 + OFF.x * FIGURE_HEIGHT), pz(f.z + OFF.z * FIGURE_HEIGHT));
      c.lineTo(px(f.x - 0.04 + OFF.x * FIGURE_HEIGHT), pz(f.z + OFF.z * FIGURE_HEIGHT));
      c.closePath();
    }
  });
  // Contact occlusion: a tight dark seam where walls meet the floor, and under the podium lip.
  soft(ctx, 5, 0.35, (c) => { c.rect(px(CORE.x[0]), pz(CORE.z[0]), (CORE.x[1] - CORE.x[0]) * PPU, (CORE.z[1] - CORE.z[0]) * PPU); });
  soft(ctx, 7, 0.28, (c) => { c.rect(px(PODIUM.x[0]), pz(PODIUM.z[0]), (PODIUM.x[1] - PODIUM.x[0]) * PPU, (PODIUM.z[1] - PODIUM.z[0]) * PPU); });

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** UVs for a ground plane covering `b` (x/z extent), expressed in the slab-wide shadow texture. */
export function groundUv(b: Box): { u: [number, number]; v: [number, number] } {
  const W = SLAB.x[1] - SLAB.x[0], H = SLAB.z[1] - SLAB.z[0];
  // CanvasTexture is flipped: canvas row 0 (back of the model, z min) is v = 1.
  return { u: [(b.x[0] - X0) / W, (b.x[1] - X0) / W], v: [1 - (b.z[1] - Z0) / H, 1 - (b.z[0] - Z0) / H] };
}

/** Soft radial contact shadow for the plinth on the stage floor. */
export function blobTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(20,16,10,0.85)');
  grad.addColorStop(0.5, 'rgba(20,16,10,0.4)');
  grad.addColorStop(1, 'rgba(20,16,10,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
