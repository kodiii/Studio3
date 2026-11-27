'use client';
/**
 * The hero's signature: sew the patch on yourself.
 *
 * The needle rides the tailor's-chalk line around the saffron patch. Drag it (pointer projected onto the seam, only
 * within a window around where the needle is, so it can't jump across the patch) and the running stitch appears
 * behind it — the svg-path-draw technique, a mask whose dash offset is the progress, driven by the pointer instead of
 * a clock. Drag back to unpick. The needle turns corners on a spring, and the working thread is a short verlet rope:
 * inextensible, with the friction of thread on denim, so it trails, whips round corners and comes to rest where it
 * lies. Finishing the last stitch ties it off: the tail is pulled through to a knot and the patch settles onto the
 * cloth.
 *
 * Twins: the needle is a slider (←/→ one stitch, Page Up/Down a side, Home/End); "Finish for me" plays the one-shot
 * stitch from wherever you are; "Unpick" starts again. On first view the needle sews the first side by itself and
 * hands over. Reduced motion: no intro, the patch starts sewn, every change is a jump and the thread lies still.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { animate } from 'motion/react';
import { duration as D, easing, spring, springToLinear, useIsomorphicLayoutEffect, useRafLoop, useStudioMotion } from '../../../motion';
import styles from './styles.module.css';

const PATCH = 'M118 74 296 62 304 226 126 238Z';
const SEAM_PTS: readonly [number, number][] = [[134, 88], [282, 78], [288, 212], [140, 222], [134, 88]];
const SEAM = `M${SEAM_PTS.slice(0, 4).map(([x, y]) => `${x} ${y}`).join(' ')}Z`;
const STITCHES = 24;
const NEEDLE = 88; // user units, eye to tip
const ROPE = 15; // segments
const SEG = 10; // segment length (≈ 150 units of thread)
const KNOT = 0.9; // segment length once tied off
const POP = springToLinear(spring.pop);

/* ── seam geometry ─────────────────────────────────────────────────────── */
const SEGS = SEAM_PTS.slice(1).map(([x, y], i) => {
  const [x0, y0] = SEAM_PTS[i];
  const len = Math.hypot(x - x0, y - y0);
  return { x0, y0, dx: (x - x0) / len, dy: (y - y0) / len, len };
});
const TOTAL = SEGS.reduce((t, s) => t + s.len, 0);
function at(p: number): { x: number; y: number; tx: number; ty: number } {
  let s = Math.max(0, Math.min(1, p)) * TOTAL;
  for (const g of SEGS) {
    if (s <= g.len || g === SEGS[SEGS.length - 1]) return { x: g.x0 + g.dx * Math.min(s, g.len), y: g.y0 + g.dy * Math.min(s, g.len), tx: g.dx, ty: g.dy };
    s -= g.len;
  }
  return { x: SEAM_PTS[0][0], y: SEAM_PTS[0][1], tx: 1, ty: 0 };
}
/** Tangent averaged over ±14 units of seam, so corners ease the needle round instead of snapping it. */
function heading(p: number): number {
  const d = 14 / TOTAL;
  const a = at(p - d), b = at(p), c = at(p + d);
  return Math.atan2(a.ty + b.ty + c.ty, a.tx + b.tx + c.tx);
}
const SAMPLES = Array.from({ length: 721 }, (_, i) => { const p = i / 720; const q = at(p); return { p, x: q.x, y: q.y }; });
function project(x: number, y: number, lo: number, hi: number): number {
  let best = lo, bd = Infinity;
  for (const s of SAMPLES) {
    if (s.p < lo || s.p > hi) continue;
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d < bd) { bd = d; best = s.p; }
  }
  return best;
}

/* ── the thread ────────────────────────────────────────────────────────── */
interface Pt { x: number; y: number; px: number; py: number }
/** A thread lying behind the needle in a loose curve (used at start, after unpicking, and under reduced motion). */
function layRope(ex: number, ey: number, ang: number, seg: number): Pt[] {
  const pts: Pt[] = [];
  let a = ang + Math.PI; // trail behind the eye
  let x = ex, y = ey;
  for (let i = 0; i <= ROPE; i++) {
    pts.push({ x, y, px: x, py: y });
    a -= 0.09; // a gentle curl, falling away from the patch
    x += Math.cos(a) * seg; y += Math.sin(a) * seg;
  }
  return pts;
}
function ropePath(pts: Pt[], dx = 0, dy = 0): string {
  let d = `M${(pts[0].x + dx).toFixed(1)} ${(pts[0].y + dy).toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
    d += `Q${(pts[i].x + dx).toFixed(1)} ${(pts[i].y + dy).toFixed(1)} ${(mx + dx).toFixed(1)} ${(my + dy).toFixed(1)}`;
  }
  const l = pts[pts.length - 1];
  return `${d}L${(l.x + dx).toFixed(1)} ${(l.y + dy).toFixed(1)}`;
}

export function NeedlePatch() {
  const { reduced } = useStudioMotion();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const needle = useRef<SVGGElement>(null);
  const needleShadow = useRef<SVGGElement>(null);
  const mask = useRef<SVGPathElement>(null);
  const thread = useRef<SVGPathElement>(null);
  const threadShadow = useRef<SVGPathElement>(null);
  const knot = useRef<SVGCircleElement>(null);
  const patch = useRef<SVGGElement>(null);
  const glint = useRef<SVGPathElement>(null);

  const p = useRef(reduced ? 1 : 0);
  const ang = useRef(heading(p.current));
  const angV = useRef(0);
  const seg = useRef(reduced ? KNOT : SEG);
  const rope = useRef<Pt[]>(layRope(at(p.current).x, at(p.current).y, ang.current, seg.current));
  const drag = useRef<{ id: number; offset: number } | null>(null);
  const tween = useRef<{ stop: () => void } | null>(null);
  const goal = useRef<number | null>(null); // where queued key presses are heading
  const anims = useRef(new Set<Animation>());
  const acc = useRef(0);
  const awake = useRef(false);
  const [running, setRunning] = useState(false);
  const [stitch, setStitch] = useState(Math.round(p.current * STITCHES));
  const [say, setSay] = useState('');
  const [handed, setHanded] = useState(reduced);
  const done = stitch >= STITCHES;
  const doneRef = useRef(done);

  const wake = useCallback(() => { if (!awake.current) { awake.current = true; setRunning(true); } }, []);
  const play = (el: Element | null, k: Keyframe[], o: KeyframeAnimationOptions) => {
    if (!el || typeof el.animate !== 'function') return;
    const a = el.animate(k, o);
    anims.current.add(a);
    const off = () => anims.current.delete(a);
    a.finished.then(off, off);
  };

  /** Write the current state into the drawing (no React render). */
  const draw = useCallback(() => {
    const q = at(p.current);
    const deg = (ang.current * 180) / Math.PI;
    needle.current?.setAttribute('transform', `translate(${q.x.toFixed(2)} ${q.y.toFixed(2)}) rotate(${deg.toFixed(2)})`);
    needleShadow.current?.setAttribute('transform', `translate(${(q.x + 2.5).toFixed(2)} ${(q.y + 3.5).toFixed(2)}) rotate(${deg.toFixed(2)})`);
    if (mask.current) mask.current.style.strokeDashoffset = String(1 - p.current);
    const pts = rope.current;
    thread.current?.setAttribute('d', ropePath(pts));
    threadShadow.current?.setAttribute('d', ropePath(pts, 1.4, 2));
    if (knot.current) knot.current.style.opacity = seg.current < SEG * 0.4 ? '1' : '0';
  }, []);

  /** Progress changed: update the readout, and tie off or untie when crossing the last stitch. */
  const setProgress = useCallback((v: number) => {
    p.current = Math.max(0, Math.min(1, v));
    const n = Math.round(p.current * STITCHES);
    setStitch((s) => (s === n ? s : n));
    const nowDone = p.current >= 0.999;
    if (nowDone !== doneRef.current) {
      doneRef.current = nowDone;
      if (nowDone) {
        setSay('Patch sewn on.');
        if (!reduced) {
          play(patch.current, [{ transform: 'scale(1)' }, { transform: 'scale(0.986)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: POP.duration, easing: POP.easing });
          play(glint.current, [{ strokeDashoffset: 0.12, opacity: 1 }, { strokeDashoffset: -0.88, opacity: 0 }], { duration: D.cinematic, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
        }
      } else {
        // Untied: the thread comes back out at full length, trailing behind the needle.
        seg.current = SEG;
        const q = at(p.current);
        rope.current = layRope(q.x, q.y, ang.current, SEG);
      }
    }
    if (reduced) {
      ang.current = heading(p.current);
      seg.current = nowDone ? KNOT : SEG;
      const q = at(p.current);
      rope.current = layRope(q.x, q.y, ang.current, seg.current);
      draw();
    } else wake();
  }, [draw, reduced, wake]);

  // The loop: needle heading spring, rope physics at a fixed 120 Hz, tie-off; sleeps when everything has settled.
  useRafLoop(wrap, (dt) => {
    const q = at(p.current);
    // Heading: a press spring towards the seam's (smoothed) tangent, by the shortest way round.
    let diff = heading(p.current) - ang.current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const k = spring.press;
    angV.current += ((k.stiffness * diff - k.damping * angV.current) / k.mass) * dt;
    ang.current += angV.current * dt;
    // Tie-off pulls the tail through to a knot; untying lets it out again.
    const want = doneRef.current ? KNOT : SEG;
    seg.current += (want - seg.current) * Math.min(1, dt * 9);
    // Rope: verlet with heavy friction (thread on cloth) and inextensible segments; the first point rides the eye.
    acc.current += dt;
    let moved = 0;
    const pts = rope.current;
    while (acc.current >= 1 / 120) {
      acc.current -= 1 / 120;
      for (let i = 1; i < pts.length; i++) {
        const r = pts[i];
        const vx = (r.x - r.px) * 0.8, vy = (r.y - r.py) * 0.8;
        r.px = r.x; r.py = r.y; r.x += vx; r.y += vy;
        moved = Math.max(moved, Math.abs(vx) + Math.abs(vy));
      }
      pts[0].x = q.x; pts[0].y = q.y; pts[0].px = q.x; pts[0].py = q.y;
      for (let it = 0; it < 6; it++) {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.0001;
          const f = (d - seg.current) / d;
          if (i === 0) { b.x -= dx * f; b.y -= dy * f; }
          else { a.x += dx * f * 0.5; a.y += dy * f * 0.5; b.x -= dx * f * 0.5; b.y -= dy * f * 0.5; }
        }
      }
    }
    draw();
    const settling = Math.abs(diff) > 0.002 || Math.abs(angV.current) > 0.01 || Math.abs(seg.current - want) > 0.02 || moved > 0.02;
    if (!drag.current && !tween.current && !settling) { awake.current = false; setRunning(false); }
  }, running && !reduced);

  // First paint (before the browser paints, so the needle never shows at the origin), and a reduced-motion switch.
  useIsomorphicLayoutEffect(() => {
    if (reduced) { tween.current?.stop(); tween.current = null; setHanded(true); setProgress(p.current); }
    draw();
  }, [reduced, draw, setProgress]);
  useEffect(() => () => { tween.current?.stop(); anims.current.forEach((a) => a.cancel()); }, []);

  const sewTo = useCallback((target: number, ms: number, delay = 0) => {
    tween.current?.stop();
    if (reduced) { setProgress(target); goal.current = null; return; }
    const a = animate(p.current, target, { duration: ms / 1000, delay: delay / 1000, ease: [...easing.inOut], onUpdate: (v) => setProgress(v) });
    tween.current = a;
    wake();
    void a.then(() => { if (tween.current === a) { tween.current = null; goal.current = null; setHanded(true); wake(); } });
  }, [reduced, setProgress, wake]);

  // On first view the needle sews the top edge itself, then hands over.
  useEffect(() => {
    if (reduced) return;
    sewTo(SEGS[0].len / TOTAL, D.epic, D.cinematic);
    return () => { tween.current?.stop(); tween.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toSvg = (x: number, y: number) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const v = new DOMPoint(x, y).matrixTransform(m.inverse());
    return { x: v.x, y: v.y };
  };
  const onDown = (e: PointerEvent<SVGRectElement>) => {
    if (e.button !== 0) return;
    tween.current?.stop();
    tween.current = null;
    goal.current = null;
    setHanded(true);
    const v = toSvg(e.clientX, e.clientY);
    const grab = project(v.x, v.y, Math.max(0, p.current - 0.04), Math.min(1, p.current + NEEDLE / TOTAL + 0.06));
    drag.current = { id: e.pointerId, offset: grab - p.current };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    wrap.current?.setAttribute('data-sewing', '');
    wake();
  };
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const v = toSvg(e.clientX, e.clientY);
    const c = p.current + d.offset;
    const projected = project(v.x, v.y, Math.max(0, c - 0.1), Math.min(1, c + 0.1));
    setProgress(projected - d.offset);
    // The grab point slides down the shaft to the eye as you sew, so the last stitch is reachable.
    d.offset *= 0.9;
  };
  const onUp = (e: PointerEvent<SVGRectElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    wrap.current?.removeAttribute('data-sewing');
    // Let go and the needle settles into the nearest stitch.
    const target = Math.round(p.current * STITCHES) / STITCHES;
    if (Math.abs(target - p.current) > 0.0005) sewTo(target, D.fast);
    wake();
  };
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    const n = Math.round((goal.current ?? p.current) * STITCHES);
    const to = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? n + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? n - 1
      : e.key === 'PageUp' ? n + STITCHES / 4 : e.key === 'PageDown' ? n - STITCHES / 4 : e.key === 'Home' ? 0 : e.key === 'End' ? STITCHES : null;
    if (to === null) return;
    e.preventDefault();
    setHanded(true);
    const target = Math.max(0, Math.min(STITCHES, to)) / STITCHES;
    goal.current = target;
    sewTo(target, Math.max(D.fast, Math.abs(target - p.current) * D.epic));
  };

  const finish = () => { setHanded(true); sewTo(1, Math.max(D.slow, (1 - p.current) * D.epic * 1.6)); };
  const unpick = () => {
    if (p.current <= 0) return;
    setHanded(true);
    setSay('Unpicked. The needle is back at the first stitch.');
    sewTo(0, Math.max(D.moderate, p.current * D.slow * 1.4));
  };

  const valueText = done ? 'Patch sewn on, all 24 stitches' : `${stitch} of ${STITCHES} stitches sewn`;
  return (
    <div ref={wrap} className={styles.heroArtWrap}>
      <svg ref={svg} viewBox="0 0 400 320" className={styles.heroArt} role="group" aria-label="Sew the patch on" aria-describedby={`${uid}-hint`}>
        <defs>
          <pattern id={`${uid}-weave`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-4)">
            <path d="M0 2.5h5M2.5 0v5" stroke="#7a4a0a" strokeOpacity="0.09" strokeWidth="1" />
          </pattern>
          <linearGradient id={`${uid}-saffron`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6c66b" />
            <stop offset="1" stopColor="#e09f3a" />
          </linearGradient>
          <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f4f6fb" />
            <stop offset="0.45" stopColor="#c3cad9" />
            <stop offset="1" stopColor="#7f889d" />
          </linearGradient>
          <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" /></filter>
          <filter id={`${uid}-softer`} x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="1.4" /></filter>
          <mask id={`${uid}-sew`} maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="320">
            <path ref={mask} d={SEAM} fill="none" stroke="#fff" strokeWidth="18" pathLength={1} strokeDasharray="1 1" style={{ strokeDashoffset: 1 - p.current }} />
          </mask>
        </defs>
        <g aria-hidden="true">
          {/* The patch lies on the denim: a soft shadow down and to the right of the one top-left light. */}
          <path d={PATCH} transform="translate(5 7)" fill="#0b1122" opacity="0.5" filter={`url(#${uid}-soft)`} />
          <g ref={patch} className={styles.patch}>
            <path d={PATCH} fill={`url(#${uid}-saffron)`} />
            <path d={PATCH} fill={`url(#${uid}-weave)`} />
            <path d={PATCH} fill="none" stroke="#fff8e6" strokeOpacity="0.45" strokeWidth="1.5" transform="translate(-0.5 -0.5)" />
            <path d={PATCH} fill="none" stroke="#1e2a4a" strokeOpacity="0.25" strokeWidth="2" />
            {/* Tailor's chalk: where the stitches go. */}
            <path d={SEAM} fill="none" stroke="#fffaf0" strokeOpacity="0.75" strokeWidth="1.4" strokeDasharray="1.5 4.5" strokeLinecap="round" />
            {/* The running stitch, revealed by the mask as the needle moves. */}
            <path d={SEAM} fill="none" stroke="#0e1426" strokeOpacity="0.35" strokeWidth="5" pathLength={STITCHES} strokeDasharray="0.56 0.44" strokeDashoffset="-0.22" strokeLinecap="round" transform="translate(0.8 1.2)" mask={`url(#${uid}-sew)`} />
            <path d={SEAM} fill="none" stroke="#1e2a4a" strokeWidth="5" pathLength={STITCHES} strokeDasharray="0.56 0.44" strokeDashoffset="-0.22" strokeLinecap="round" mask={`url(#${uid}-sew)`} />
            <path ref={glint} d={SEAM} fill="none" stroke="#fffaf0" strokeWidth="2.4" pathLength={1} strokeDasharray="0.12 0.88" strokeLinecap="round" opacity="0" />
          </g>
          <path ref={threadShadow} fill="none" stroke="#070b16" strokeOpacity="0.4" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path ref={thread} fill="none" stroke="#f6efe0" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <g ref={needleShadow} opacity="0.45" filter={`url(#${uid}-softer)`}>
            <path d={`M0 -2.6L${NEEDLE - 16} -1.9L${NEEDLE} 0L${NEEDLE - 16} 1.9L0 2.6A2.6 2.6 0 0 1 0 -2.6Z`} fill="#070b16" />
          </g>
          <circle ref={knot} r="2.6" fill="#f3efe6" stroke="#1e2a4a" strokeWidth="1" opacity="0" cx={SEAM_PTS[0][0]} cy={SEAM_PTS[0][1]} />
        </g>
        <g
          ref={needle}
          className={styles.needle}
          role="slider"
          tabIndex={0}
          aria-label="Needle"
          aria-valuemin={0}
          aria-valuemax={STITCHES}
          aria-valuenow={stitch}
          aria-valuetext={valueText}
          aria-describedby={`${uid}-hint`}
          onKeyDown={onKey}
        >
          <path d={`M0 -2.6L${NEEDLE - 16} -1.9L${NEEDLE} 0L${NEEDLE - 16} 1.9L0 2.6A2.6 2.6 0 0 1 0 -2.6Z`} fill={`url(#${uid}-steel)`} stroke="#59627a" strokeWidth="0.5" />
          <path d={`M3 -1.6L${NEEDLE - 20} -1.2`} stroke="#fff" strokeOpacity="0.85" strokeWidth="0.8" strokeLinecap="round" />
          <ellipse cx="7" cy="0" rx="3.8" ry="0.95" fill="#1e2a4a" />
          <rect className={styles.needleHit} x="-14" y="-24" width={NEEDLE + 28} height="48" rx="24" fill="transparent"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        </g>
      </svg>
      <div className={styles.sewBar}>
        <p id={`${uid}-hint`} className={styles.sewHint}>
          <span className={styles.sewCount} aria-hidden="true">{String(stitch).padStart(2, '0')}/{STITCHES}</span>
          {done ? 'Sewn on. That is the whole idea.' : handed ? 'Your turn: drag the needle along the chalk line.' : 'Threading the needle…'}
        </p>
        <div className={styles.sewActions}>
          {done ? null : <button type="button" className={styles.denimKey} onClick={finish}>Finish for me</button>}
          <button type="button" className={styles.denimKey} onClick={unpick} aria-disabled={stitch === 0 || undefined}>Unpick</button>
        </div>
      </div>
      <p className="mk-sr-only" role="status">{say}</p>
    </div>
  );
}
