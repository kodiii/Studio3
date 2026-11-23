'use client';
/**
 * No-WebGL fallback: the same maquette data drawn as an SVG axonometric from the three-quarter "home" view.
 * Faces are projected with an orthographic camera and painted back-to-front; shading follows the fixed key light.
 */
import { useMemo } from 'react';
import { CORE, COLORS, COLUMNS, FIGURES, FIN, GLASS, PLINTH, PODIUM, ROOF, SLAB, STEPS, TREE_TRUNK, TREES, type Box } from './model';

const AZ = 0.62, EL = 0.52;
const right = [Math.cos(AZ), 0, -Math.sin(AZ)];
const up = [-Math.sin(AZ) * Math.sin(EL), Math.cos(EL), -Math.cos(AZ) * Math.sin(EL)];
const toward = [Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL)];
const S = 60;
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const proj = (p: number[]) => [dot(p, right) * S, -dot(p, up) * S] as const;
const pts = (ps: number[][]) => ps.map((p) => proj(p).map((v) => v.toFixed(1)).join(',')).join(' ');

/** The three faces of a box visible from the front-right-top camera, with a shade factor each. */
function faces(b: Box) {
  const [x0, x1] = b.x, [y0, y1] = b.y, [z0, z1] = b.z;
  return [
    { shade: 1, points: pts([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]) },
    { shade: 0.9, points: pts([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]) },
    { shade: 0.74, points: pts([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]]) },
  ];
}
const shadeHex = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
};
const depth = (b: Box) => dot([(b.x[0] + b.x[1]) / 2, (b.y[0] + b.y[1]) / 2, (b.z[0] + b.z[1]) / 2], toward);

export function MaquetteDrawing({ accent }: { accent: string }) {
  const { solids, view } = useMemo(() => {
    const colH = ROOF.y[0] - PODIUM.y[1];
    const list: { box: Box; color: string; opacity?: number }[] = [
      { box: PLINTH, color: COLORS.board }, { box: SLAB, color: COLORS.paper }, { box: PODIUM, color: COLORS.paper },
      ...STEPS.map((box) => ({ box, color: COLORS.paper })),
      { box: CORE, color: COLORS.basswood }, { box: FIN, color: COLORS.basswood },
      ...COLUMNS.map(([x, z]) => ({ box: { x: [x - 0.03, x + 0.03], y: [PODIUM.y[1], PODIUM.y[1] + colH], z: [z - 0.03, z + 0.03] } as Box, color: COLORS.steel })),
      { box: GLASS, color: '#cfdfe2', opacity: 0.45 },
      { box: ROOF, color: COLORS.paper },
    ];
    const corners = [PLINTH.x, PLINTH.y, PLINTH.z].reduce<number[][]>((acc, r, axis) => acc.flatMap((p) => r.map((v) => { const q = [...p]; q[axis] = v; return q; })), [[0, 0, 0]]);
    const xy = corners.map(proj);
    const xs = xy.map((p) => p[0]), ys = [...xy.map((p) => p[1]), proj([0, ROOF.y[1] + 0.2, 0])[1]];
    const pad = 14;
    return {
      solids: list.sort((a, b) => depth(a.box) - depth(b.box)),
      view: `${Math.min(...xs) - pad} ${Math.min(...ys) - pad} ${Math.max(...xs) - Math.min(...xs) + pad * 2} ${Math.max(...ys) - Math.min(...ys) + pad * 2 + 18}`,
    };
  }, []);

  return (
    <svg viewBox={view} role="img" aria-label="Drawing of the pavilion maquette from the front right: a cantilevered white roof on four slender steel columns and a basswood core, on a raised podium with steps, three foam trees and two scale figures, set on a grey board plinth." style={{ width: 'min(100%, 560px)', height: 'auto', maxHeight: 'calc(100% - 56px)' }}>
      <ellipse cx={proj([0.2, PLINTH.y[0], 0])[0]} cy={proj([0.2, PLINTH.y[0], 0])[1] + 10} rx={240} ry={26} fill="#11110f" opacity="0.1" />
      {solids.map(({ box, color, opacity }, i) => (
        <g key={i} opacity={opacity}>
          {faces(box).map((f, j) => (
            <polygon key={j} points={f.points} fill={shadeHex(color, f.shade)} stroke="#11110f" strokeOpacity="0.28" strokeWidth="0.6" strokeLinejoin="round" />
          ))}
        </g>
      ))}
      {TREES.map((t, i) => {
        const [bx, by] = proj([t.x, SLAB.y[1], t.z]);
        const [cx, cy] = proj([t.x, SLAB.y[1] + TREE_TRUNK + t.r * 0.55, t.z]);
        return (
          <g key={`t${i}`}>
            <line x1={bx} y1={by} x2={cx} y2={cy} stroke={COLORS.steel} strokeWidth="1.4" />
            <circle cx={cx} cy={cy} r={t.r * S} fill={COLORS.paper} stroke="#11110f" strokeOpacity="0.3" strokeWidth="0.6" />
          </g>
        );
      })}
      {FIGURES.map((f, i) => {
        const [x0, y0] = proj([f.x, f.y, f.z]);
        const [, y1] = proj([f.x, f.y + 0.36, f.z]);
        return <line key={`f${i}`} x1={x0} y1={y0} x2={x0} y2={y1} stroke={accent} strokeWidth="5" strokeLinecap="round" />;
      })}
    </svg>
  );
}
