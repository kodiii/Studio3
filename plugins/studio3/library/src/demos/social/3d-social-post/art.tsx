/**
 * Drawn media for the 2D posts (SVG, seeded so every visit renders the same sky). Decorative: the caller wraps each
 * drawing in role="img" with a written description.
 */
const NIGHT = '#0d1424';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const STARS = (() => {
  const r = rng(11);
  return Array.from({ length: 90 }, () => ({ x: r() * 400, y: r() * 330, s: r() < 0.12 ? 1.6 : 0.6 + r() * 0.7, o: 0.45 + r() * 0.55 }));
})();
const METEORS = [
  { x: 92, y: 60, len: 70, a: 28 }, { x: 250, y: 42, len: 96, a: 34 }, { x: 318, y: 132, len: 54, a: 30 },
  { x: 160, y: 170, len: 44, a: 26 }, { x: 40, y: 200, len: 38, a: 32 },
];

/** Session 11: meteors over the sea wall, four red head-torches on the wall. */
export function MeteorSky() {
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" style={{ display: 'block', width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="sk-trail" x1="0" x2="1">
          <stop offset="0" stopColor="#f3f0e8" stopOpacity="0" />
          <stop offset="1" stopColor="#f3f0e8" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="sk-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070b15" />
          <stop offset="0.75" stopColor={NIGHT} />
          <stop offset="1" stopColor="#1b2438" />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill="url(#sk-sky)" />
      {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#f3f0e8" opacity={s.o} />)}
      {METEORS.map((m, i) => (
        <g key={i} transform={`translate(${m.x} ${m.y}) rotate(${m.a})`}>
          <rect x={-m.len} y={-0.9} width={m.len} height={1.8} rx={0.9} fill="url(#sk-trail)" />
        </g>
      ))}
      {/* sea, wall and four observers */}
      <rect y="372" width="400" height="128" fill="#0a101c" />
      {[392, 414, 440, 470].map((y, i) => <path key={y} d={`M${20 + i * 30} ${y}h${120 - i * 12}M${230 - i * 8} ${y + 6}h${90 + i * 10}`} stroke="#3a4a6b" strokeWidth="1.2" strokeLinecap="round" />)}
      <path d="M0 352 L400 340 L400 376 L0 384Z" fill="#05080f" />
      {[86, 150, 232, 300].map((x, i) => (
        <g key={x} transform={`translate(${x} ${348 - i * 2.4})`}>
          <path d="M-5 0v-14a5 5 0 0 1 10 0v14z" fill="#05080f" />
          <circle cy="-22" r="4.5" fill="#05080f" />
          <circle cx="2.5" cy="-23" r="1.6" fill="#ff5a4a" />
        </g>
      ))}
    </svg>
  );
}

/** The club's mark: a finder-scope reticle. */
export function ClubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="19" fill={NIGHT} />
      <circle cx="20" cy="20" r="10" fill="none" stroke="#f3f0e8" strokeWidth="1.4" />
      <path d="M20 4v8M20 28v8M4 20h8M28 20h8" stroke="#f3f0e8" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="20" cy="20" r="2" fill="#ff8f80" />
    </svg>
  );
}
