'use client';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { animate, motion, useDragControls, useMotionValue, useTransform } from 'motion/react';
import { spring, useElementSize, useStudioMotion, type SpringToken } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { snaps: string; spring: string; elastic: number; flick: number; peek: number; dim: number };
type Snap = 'peek' | 'half' | 'full';

interface Departure { id: string; line: string; kind: 'harbour' | 'hill' | 'ferry'; to: string; mins: number; note: string }

/** Sample data for an invented harbour town. */
const DEPARTURES: readonly Departure[] = [
  { id: 'd1', line: 'H1', kind: 'harbour', to: 'Quayside', mins: 3, note: 'Platform A · step-free' },
  { id: 'd2', line: 'L4', kind: 'hill', to: 'Observatory', mins: 7, note: 'Platform B' },
  { id: 'd3', line: 'F', kind: 'ferry', to: 'North pier', mins: 12, note: 'Walk 4 min to the terminal' },
  { id: 'd4', line: 'H1', kind: 'harbour', to: 'Quayside', mins: 18, note: 'Platform A · step-free' },
  { id: 'd5', line: 'L4', kind: 'hill', to: 'Observatory', mins: 24, note: 'Platform B' },
  { id: 'd6', line: 'H2', kind: 'harbour', to: 'Lighthouse road', mins: 31, note: 'Platform A' },
];
const TOP_GAP = 28;
const LABEL: Record<Snap, string> = { peek: 'collapsed', half: 'half open', full: 'fully open' };
const isSpring = (v: string): v is SpringToken => v in spring;

export default function PullToRevealSheet({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const { height: frameH } = useElementSize(root);
  const { height: headerContent } = useElementSize(header);
  const [snap, setSnap] = useState<Snap>('peek');
  const [bodySnap, setBodySnap] = useState<Snap>('peek');
  const [status, setStatus] = useState('');
  const [reminders, setReminders] = useState<ReadonlySet<string>>(new Set());
  const y = useMotionValue(0);
  const controls = useDragControls();
  const anim = useRef<{ stop: () => void } | null>(null);
  const dragged = useRef(false);

  const order: Snap[] = params.snaps === 'peek-full' ? ['full', 'peek'] : ['full', 'half', 'peek'];
  const sheetH = Math.max(0, frameH - TOP_GAP);
  const offsets = useMemo<Record<Snap, number>>(() => ({
    full: 0,
    half: Math.max(0, sheetH - frameH * 0.52),
    // Never peek less than the header itself (it wraps in narrow frames): 18 px is its vertical padding.
    peek: Math.max(0, sheetH - Math.max(params.peek, headerContent + 22)),
  }), [sheetH, frameH, params.peek, headerContent]);
  const live = useRef({ offsets, snap });
  live.current = { offsets, snap };
  const token: SpringToken = isSpring(params.spring) ? params.spring : 'settle';
  const ready = frameH > 0;

  // Scrim follows the sheet: clear at peek, `dim` at full.
  const scrim = useTransform(y, (v) => {
    const { peek } = live.current.offsets;
    return peek > 0 ? Math.min(1, Math.max(0, 1 - v / peek)) * (params.dim / 100) : 0;
  });

  // Resize (or a changed peek height / snap set): jump to the current snap's new offset.
  useEffect(() => {
    if (!ready) return;
    const s = order.includes(snap) ? snap : 'peek';
    anim.current?.stop();
    y.set(offsets[s]);
    if (s !== snap) { setSnap(s); setBodySnap(s); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, offsets, params.snaps]);
  useEffect(() => () => anim.current?.stop(), []);

  const go = (to: Snap, velocity = 0, announce = true) => {
    const target = live.current.offsets[to];
    const expanding = target < y.get();
    setSnap(to);
    if (expanding) setBodySnap(to);
    if (announce) setStatus(`Departures sheet ${LABEL[to]}.`);
    anim.current?.stop();
    const a = animate(y, target, reduced ? { duration: 0 } : { type: 'spring', ...spring[token], velocity });
    anim.current = a;
    a.then(() => { if (anim.current === a) setBodySnap(to); });
  };
  const step = (dir: -1 | 1) => {
    const i = order.indexOf(live.current.snap);
    const next = order[Math.max(0, Math.min(order.length - 1, i + dir))];
    if (next !== live.current.snap) go(next);
  };
  const collapse = () => {
    if (live.current.snap === 'peek') return;
    if (root.current?.querySelector(`[data-body]`)?.contains(document.activeElement)) toggle.current?.focus({ preventScroll: true });
    go('peek');
  };

  const onDragEnd = (v: number) => {
    const cur = y.get();
    const list = order.map((k) => ({ k, at: live.current.offsets[k] })).sort((a, b) => a.at - b.at);
    let target = list[0];
    if (Math.abs(v) > params.flick) {
      // A flick goes to the next snap in its direction, however short the drag.
      target = v < 0 ? (list.filter((s) => s.at < cur - 2).at(-1) ?? list[0]) : (list.find((s) => s.at > cur + 2) ?? list[list.length - 1]);
    } else {
      const projected = cur + v * 0.18;
      for (const s of list) if (Math.abs(s.at - projected) < Math.abs(target.at - projected)) target = s;
    }
    go(target.k, v);
  };

  const onHeaderKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowUp') step(-1);
    else if (e.key === 'ArrowDown') step(1);
    else if (e.key === 'Home') go('full');
    else if (e.key === 'End') go('peek');
    else return;
    e.preventDefault();
  };
  const onHeaderDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('[data-step]')) return;
    controls.start(e);
  };

  const bodyVisible = Math.max(0, sheetH - offsets[bodySnap] - (header.current?.offsetHeight ?? 76));
  const atTop = snap === order[0];
  const atBottom = snap === 'peek';
  const next = DEPARTURES[0];

  return (
    <div
      ref={root}
      className={styles.root}
      data-reduced={reduced || undefined}
      style={{ '--peek': `${params.peek}px` } as CSSProperties}
      onKeyDown={(e) => { if (e.key === 'Escape' && live.current.snap !== 'peek') { e.preventDefault(); collapse(); } }}
    >
      <MapArt />
      <p className={styles.mapTag}>Harbour line · sample map</p>
      <motion.div className={styles.scrim} style={{ opacity: scrim }} data-open={snap !== 'peek' || undefined} onClick={() => go('peek')} aria-hidden="true" />

      <motion.section
        className={styles.sheet}
        aria-labelledby={`${uid}title`}
        style={{ y, visibility: ready ? 'visible' : 'hidden' }}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: offsets.peek }}
        dragElastic={params.elastic}
        dragMomentum={false}
        onDragStart={() => { dragged.current = true; anim.current?.stop(); }}
        onDragEnd={(_, info) => onDragEnd(info.velocity.y)}
      >
        <div ref={header} className={styles.header} onPointerDown={onHeaderDown}>
          <span className={styles.grabber} aria-hidden="true" />
          <button
            ref={toggle}
            type="button"
            className={styles.toggle}
            aria-expanded={snap !== 'peek'}
            aria-controls={`${uid}body`}
            aria-describedby={`${uid}keys`}
            onKeyDown={onHeaderKey}
            onClick={() => {
              if (dragged.current) { dragged.current = false; return; }
              go(snap === 'peek' ? order[order.length - 2] : 'peek');
            }}
          >
            <span className={styles.titleRow}>
              <span className={styles.stopNo} aria-hidden="true">14</span>
              <span className={styles.titles}>
                <span id={`${uid}title`} className={styles.title}>Stop 14 · Canal Street</span>
                <span className={styles.subtitle}>Next: {next.line} to {next.to} in {next.mins} min</span>
              </span>
            </span>
          </button>
          <span className={styles.steps}>
            <button type="button" data-step className={styles.step} aria-label="Expand sheet" aria-disabled={atTop || undefined} onClick={() => step(-1)}>
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" data-step className={styles.step} aria-label="Collapse sheet" aria-disabled={atBottom || undefined} onClick={() => step(1)}>
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </span>
        </div>

        <div
          id={`${uid}body`}
          data-body
          className={styles.body}
          inert={snap === 'peek'}
          style={{ maxHeight: bodySnap === 'peek' ? undefined : bodyVisible }}
        >
          <h4 className={styles.sectionTitle}>Departures <span className={styles.sample}>sample times</span></h4>
          <ul className={styles.list}>
            {DEPARTURES.map((d) => {
              const on = reminders.has(d.id);
              return (
                <li key={d.id} className={styles.dep}>
                  <span className={styles.badge} data-kind={d.kind}>{d.line}</span>
                  <span className={styles.depText}>
                    <span className={styles.depTo}>{d.to}</span>
                    <span className={styles.depNote}>{d.note}</span>
                  </span>
                  <span className={styles.mins}><b>{d.mins}</b> min</span>
                  <button
                    type="button"
                    className={styles.remind}
                    aria-pressed={on}
                    aria-label={`Remind me: ${d.line} to ${d.to} in ${d.mins} minutes`}
                    onClick={() => setReminders((r) => { const n = new Set(r); if (on) n.delete(d.id); else n.add(d.id); return n; })}
                  >
                    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 2.5a3.5 3.5 0 0 0-3.5 3.5v2.6L3.2 11h9.6l-1.3-2.4V6A3.5 3.5 0 0 0 8 2.5zM6.6 12.8a1.5 1.5 0 0 0 2.8 0" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                  </button>
                </li>
              );
            })}
          </ul>
          <h4 className={styles.sectionTitle}>At this stop</h4>
          <dl className={styles.facts}>
            <div><dt>Access</dt><dd>Step-free from Canal Street, tactile paving at both platforms</dd></div>
            <div><dt>Shelter</dt><dd>Covered seating for eight, lit after dark</dd></div>
            <div><dt>Nearby</dt><dd>Ferry terminal, 4 min walk along the quay</dd></div>
          </dl>
        </div>
      </motion.section>

      <p id={`${uid}keys`} className={styles.srOnly}>Up and Down arrows open or close the sheet one step; Escape closes it.</p>
      <p className={styles.srOnly} role="status">{status}</p>
    </div>
  );
}

/** Decorative map of an invented harbour: land, blocks, water, the route and its stops. */
function MapArt() {
  return (
    <svg className={styles.map} viewBox="0 0 400 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect className={styles.land} width="400" height="720" />
      <path className={styles.water} d="M0 470c60-20 110-8 160 22s120 46 170 28 70-40 70-40v240H0z" />
      <path className={styles.water} d="M300 0c-14 60 8 104 46 140s54 70 54 70V0z" />
      {[
        [24, 40, 92, 70], [132, 40, 120, 70], [270, 160, 104, 64], [24, 132, 70, 96], [112, 132, 140, 44], [112, 196, 64, 92],
        [194, 196, 58, 92], [270, 246, 104, 84], [24, 250, 70, 104], [112, 310, 140, 60], [270, 352, 104, 64], [24, 376, 120, 56], [164, 392, 88, 44],
      ].map(([x, yy, w, h]) => <rect key={`${x}-${yy}`} className={styles.block} x={x} y={yy} width={w} height={h} rx="6" />)}
      <path className={styles.road} d="M0 120h400M103 0v460M258 0v470" />
      <path className={styles.route} d="M60 0v120h198v126c0 40 30 50 60 54s50 30 50 60v190" />
      {[[60, 60], [258, 120], [258, 210], [318, 300], [368, 420]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} className={styles.stop} cx={cx} cy={cy} r="6" />)}
      <circle className={styles.here} cx="258" cy="210" r="11" />
      <circle className={styles.hereDot} cx="258" cy="210" r="4.5" />
      <text className={styles.label} x="116" y="113">CANAL STREET</text>
      <text className={styles.label} x="40" y="560">HARBOUR</text>
    </svg>
  );
}
