'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from 'react';
import { spring as SPRING, stepSpring, useRafLoop, useStudioMotion, type SpringToken } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { strength: number; radius: number; depth: number; spring: string; field: boolean };

/* Magnetism only makes sense for a precise pointer that can hover. */
const FINE_QUERY = '(hover: hover) and (pointer: fine)';
function subscribeFine(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(FINE_QUERY);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}
const fineSnapshot = (): boolean => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(FINE_QUERY).matches;
const serverSnapshot = (): boolean => false;

interface Axis { x: number; v: number }
interface Magnet { bx: Axis; by: Axis; lx: Axis; ly: Axis; engaged: boolean }
const restingMagnet = (): Magnet => ({ bx: { x: 0, v: 0 }, by: { x: 0, v: 0 }, lx: { x: 0, v: 0 }, ly: { x: 0, v: 0 }, engaged: false });

const settledAt = (a: Axis, target: number): boolean => Math.abs(a.x - target) < 0.02 && Math.abs(a.v) < 0.02;
const smoothstep = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
const isToken = (v: string): v is SpringToken => v in SPRING;

/** Following the pointer uses a calm, critically-ish damped token; letting go uses the chosen release token. */
const TRACK = SPRING.settle;

const MAGNETS = [
  { id: 'start', kind: 'pill', label: 'Start a project' },
  { id: 'copy', kind: 'round', label: 'Copy the studio email address' },
] as const;
const EMAIL = 'hello@studio.example';

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="m4.5 7.5 7.5 6 7.5-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MagneticButton({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const fine = useSyncExternalStore(subscribeFine, fineSnapshot, serverSnapshot);
  const enabled = fine && !reduced;

  const rootRef = useRef<HTMLDivElement>(null);
  const anchors = useRef<(HTMLSpanElement | null)[]>([]);
  const bodies = useRef<(HTMLButtonElement | null)[]>([]);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const magnets = useRef<Magnet[]>(MAGNETS.map(restingMagnet));
  const pointer = useRef({ x: 0, y: 0, inside: false, dirty: false });
  const running = useRef(false);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState('');

  /** Start the loop on demand; it switches itself off again once every spring is at rest. */
  const wake = useCallback(() => {
    pointer.current.dirty = true;
    if (!running.current) { running.current = true; setActive(true); }
  }, []);

  // Coarse pointer or reduced motion: drop every offset and keep the loop off.
  useEffect(() => {
    if (enabled) return;
    magnets.current = MAGNETS.map(restingMagnet);
    for (const el of [...bodies.current, ...labels.current]) if (el) el.style.transform = '';
    for (const a of anchors.current) a?.removeAttribute('data-engaged');
    pointer.current.inside = false;
    running.current = false;
    setActive(false);
  }, [enabled]);

  // Scrolling under a resting pointer changes the geometry without a pointermove.
  useEffect(() => {
    if (!enabled) return;
    const onScroll = () => { if (pointer.current.inside) wake(); };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
  }, [enabled, wake]);

  useRafLoop(rootRef, (dt) => {
    const p = pointer.current;
    const release = SPRING[isToken(params.spring) ? params.spring : 'release'];
    // Read pass: anchors never move, so measuring them is stable and never forces a layout after a write.
    const rects = anchors.current.map((a) => a?.getBoundingClientRect() ?? null);
    let settled = true;
    let home = true;
    rects.forEach((r, i) => {
      const m = magnets.current[i];
      if (!m) return;
      let tx = 0;
      let ty = 0;
      let engaged = false;
      if (r && p.inside) {
        const dx = p.x - (r.left + r.width / 2);
        const dy = p.y - (r.top + r.height / 2);
        // Distance from the pointer to the button's stadium outline (0 while over it).
        const cap = r.height / 2;
        const edge = Math.max(0, Math.hypot(Math.max(0, Math.abs(dx) - (r.width / 2 - cap)), dy) - cap);
        if (edge < params.radius) {
          engaged = true;
          // Pull fades to exactly zero at the field edge, so entering and leaving never jumps.
          const w = 1 - smoothstep(edge / params.radius);
          const limit = r.height * 0.55;
          tx = limit * Math.tanh((dx * params.strength * w) / limit);
          ty = limit * Math.tanh((dy * params.strength * w) / limit);
        }
      }
      const cfg = engaged ? TRACK : release;
      // The label floats further than the body, softly capped so it never crowds the button edge.
      const lcap = Math.max(1, (r?.height ?? 56) * 0.12);
      const ltx = lcap * Math.tanh((tx * params.depth) / lcap);
      const lty = lcap * Math.tanh((ty * params.depth) / lcap);
      stepSpring(m.bx, tx, cfg, dt);
      stepSpring(m.by, ty, cfg, dt);
      stepSpring(m.lx, ltx, cfg, dt);
      stepSpring(m.ly, lty, cfg, dt);
      if (!(settledAt(m.bx, tx) && settledAt(m.by, ty) && settledAt(m.lx, ltx) && settledAt(m.ly, lty))) settled = false;
      if (tx !== 0 || ty !== 0) home = false;
      // Write pass (all reads happened above).
      const b = bodies.current[i];
      const l = labels.current[i];
      if (b) b.style.transform = `translate3d(${m.bx.x.toFixed(2)}px, ${m.by.x.toFixed(2)}px, 0)`;
      if (l) l.style.transform = `translate3d(${m.lx.x.toFixed(2)}px, ${m.ly.x.toFixed(2)}px, 0)`;
      if (engaged !== m.engaged) { m.engaged = engaged; anchors.current[i]?.toggleAttribute('data-engaged', engaged); }
    });
    if (settled && !p.dirty) {
      if (home) {
        magnets.current = MAGNETS.map(restingMagnet);
        for (const el of [...bodies.current, ...labels.current]) if (el) el.style.transform = '';
      }
      running.current = false;
      setActive(false);
    }
    p.dirty = false;
  }, active && enabled);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled || e.pointerType === 'touch') return;
    const p = pointer.current;
    p.x = e.clientX;
    p.y = e.clientY;
    p.inside = true;
    wake();
  };
  const onPointerLeave = () => {
    if (!pointer.current.inside) return;
    pointer.current.inside = false;
    wake();
  };

  const onPress = async (id: (typeof MAGNETS)[number]['id']) => {
    if (id === 'start') { setStatus('“Start a project” pressed. This is a demo, so nothing was sent.'); return; }
    try {
      await navigator.clipboard.writeText(EMAIL);
      setStatus(`Copied ${EMAIL} (a fictional address).`);
    } catch {
      setStatus(`Copying is blocked here. The fictional address is ${EMAIL}.`);
    }
  };

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-magnet={enabled ? 'on' : 'off'}
      data-reduced={reduced || undefined}
      data-field={params.field || undefined}
      style={{ '--field': `${params.radius}px` } as CSSProperties}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div className={styles.inner}>
        <p className={styles.kicker}>
          <span>Contact · fictional studio</span>
          <span>{enabled ? `Field ${params.radius} px · pull ${params.strength.toFixed(2)}` : 'Magnet off'}</span>
        </p>
        <h3 className={styles.title}>Got a brief that needs to move?</h3>
        <div className={styles.actions}>
          {MAGNETS.map((m, i) => {
            const button = (
              <span ref={(el) => { anchors.current[i] = el; }} className={styles.anchor} data-kind={m.kind}>
                <span className={styles.field} aria-hidden="true" />
                <button
                  ref={(el) => { bodies.current[i] = el; }}
                  type="button"
                  className={styles.button}
                  data-kind={m.kind}
                  aria-label={m.kind === 'round' ? m.label : undefined}
                  onClick={() => { void onPress(m.id); }}
                >
                  <span className={styles.face}>
                    <span ref={(el) => { labels.current[i] = el; }} className={styles.label}>
                      {m.kind === 'pill' ? (
                        <>
                          <span>{m.label}</span>
                          <span className={styles.icon}><ArrowIcon /></span>
                        </>
                      ) : <MailIcon />}
                    </span>
                  </span>
                </button>
              </span>
            );
            return m.kind === 'round' ? (
              <span key={m.id} className={styles.contact}>
                {button}
                <span className={styles.email}>{EMAIL}</span>
              </span>
            ) : <span key={m.id} className={styles.contact}>{button}</span>;
          })}
        </div>
        <p className={styles.hint}>
          {enabled
            ? 'Drift the pointer near a button: it leans in and springs home when you leave the field. Keyboard focus shows the same engaged state without moving.'
            : 'Magnetism is off for touch screens and reduced motion. The buttons stay put and still answer hover, focus and press.'}
        </p>
        <p className={styles.status} role="status">{status}</p>
      </div>
    </div>
  );
}
