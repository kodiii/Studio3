/**
 * Target forms for the particle field. Deterministic (seeded): the same count always yields the same points.
 * Every particle owns one point on each form, so a morph is a per-particle interpolation done in the vertex shader.
 */
export const FORMS = [
  { id: 'sphere', name: 'Sphere', note: 'A Fibonacci lattice on a sphere: evenly spaced, no poles.' },
  { id: 'torus', name: 'Torus', note: 'Uniform samples on a tilted ring.' },
  { id: 'glyph', name: 'Glyph', note: 'An abstract mark: a ring crossed by a stroke, a tick and a dot.' },
] as const;
export type FormId = (typeof FORMS)[number]['id'];
export const formIndex = (id: FormId): number => FORMS.findIndex((f) => f.id === id);

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());

type Stroke = { kind: 'line'; a: [number, number]; b: [number, number]; w: number } | { kind: 'arc'; c: [number, number]; r: number; from: number; to: number; w: number } | { kind: 'dot'; c: [number, number]; r: number };
const GLYPH: Stroke[] = [
  { kind: 'arc', c: [-0.1, 0.05], r: 1.2, from: 0.35, to: Math.PI * 2 - 0.15, w: 0.09 },
  { kind: 'line', a: [-1.65, -1.35], b: [1.55, 1.45], w: 0.1 },
  { kind: 'line', a: [-1.45, 1.05], b: [-0.85, 1.05], w: 0.07 },
  { kind: 'dot', c: [1.02, -0.98], r: 0.26 },
];
const strokeLength = (s: Stroke): number => (s.kind === 'line' ? Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) : s.kind === 'arc' ? s.r * (s.to - s.from) : Math.PI * s.r * 1.6);

export interface FormBuffers { sphere: Float32Array; torus: Float32Array; glyph: Float32Array; seed: Float32Array }

export function buildForms(count: number): FormBuffers {
  const r = rng(0x5eed + count);
  const sphere = new Float32Array(count * 3), torus = new Float32Array(count * 3), glyph = new Float32Array(count * 3), seed = new Float32Array(count * 4);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const tilt = 1.02, ct = Math.cos(tilt), st = Math.sin(tilt);
  const lengths = GLYPH.map(strokeLength), total = lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < count; i++) {
    // sphere: Fibonacci lattice, thin shell
    const y = 1 - (i / Math.max(1, count - 1)) * 2, rad = Math.sqrt(1 - y * y), th = golden * i;
    const R = 1.62 + gauss(r) * 0.035;
    sphere.set([Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R], i * 3);
    // torus: area-uniform (rejection on the minor angle), tilted towards the viewer
    const Rm = 1.32, rm = 0.5;
    let v = 0;
    for (let k = 0; k < 8; k++) { v = r() * Math.PI * 2; if (r() < (Rm + rm * Math.cos(v)) / (Rm + rm)) break; }
    const u = r() * Math.PI * 2, rr = rm + gauss(r) * 0.02;
    const tx = (Rm + rr * Math.cos(v)) * Math.cos(u), tz = (Rm + rr * Math.cos(v)) * Math.sin(u), ty = rr * Math.sin(v);
    torus.set([tx, ty * ct - tz * st, ty * st + tz * ct], i * 3);
    // glyph: strokes sampled by length, with thickness and a little depth
    let pick = r() * total, s = GLYPH[0];
    for (let k = 0; k < GLYPH.length; k++) { if (pick <= lengths[k]) { s = GLYPH[k]; break; } pick -= lengths[k]; }
    let gx = 0, gy = 0;
    if (s.kind === 'line') { const t = r(); gx = s.a[0] + (s.b[0] - s.a[0]) * t + gauss(r) * s.w * 0.5; gy = s.a[1] + (s.b[1] - s.a[1]) * t + gauss(r) * s.w * 0.5; }
    else if (s.kind === 'arc') { const a = s.from + (s.to - s.from) * r(), rr2 = s.r + gauss(r) * s.w * 0.5; gx = s.c[0] + Math.cos(a) * rr2; gy = s.c[1] + Math.sin(a) * rr2; }
    else { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * s.r; gx = s.c[0] + Math.cos(a) * d; gy = s.c[1] + Math.sin(a) * d; }
    glyph.set([gx, gy, gauss(r) * 0.08], i * 3);
    // x: morph stagger, y: size, z: colour pick, w: flow phase
    seed.set([r(), r(), r(), r()], i * 4);
  }
  return { sphere, torus, glyph, seed };
}
