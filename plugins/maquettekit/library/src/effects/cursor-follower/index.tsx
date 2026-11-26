'use client';
import { useCallback, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { spring as SPRING, useRafLoop, useStudioMotion, type SpringToken } from '../../motion';
import type { EffectProps } from '../../types';
import { ARCHIVE, PROJECTS } from './art';
import { CursorFollower, useFinePointer, type CursorState } from './cursor-follower';
import { atRest, axis, clamp, rubberBand, stepAxis } from './physics';
import styles from './styles.module.css';

export { CursorFollower, useFinePointer } from './cursor-follower';
export type { CursorFollowerProps, CursorState } from './cursor-follower';

type Params = { follow: string; size: number; stretch: number; pull: number; blend: boolean; dot: boolean };

const isToken = (v: string): v is SpringToken => v in SPRING;
const EMAIL = 'hello@vale-ochre.example';

function Arrow({ dir }: { dir: 'ne' | 'left' | 'right' }) {
  const d = dir === 'ne' ? 'M7 17 17 7M9 7h8v8' : dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6';
  return (
    <svg viewBox="0 0 24 24" width={dir === 'ne' ? 14 : 12} height={dir === 'ne' ? 14 : 12} aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="m4.5 7.5 7.5 6 7.5-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Label content inside the follower's disc: a demonstration of `renderLabel`. */
const renderLabel = (label: string): ReactNode => (label === 'Drag'
  ? <><Arrow dir="left" />{label}<Arrow dir="right" /></>
  : <>{label}<Arrow dir="ne" /></>);

const LEGEND: readonly { k: Exclude<CursorState, 'hidden'>; name: string }[] = [
  { k: 'default', name: 'Ring' },
  { k: 'magnet', name: 'Magnet' },
  { k: 'text', name: 'Caret' },
  { k: 'label', name: 'Label' },
];

export default function CursorFollowerShowcase({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const fine = useFinePointer();
  const on = fine && !reduced;
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const legend = useRef<HTMLUListElement>(null);
  const [status, setStatus] = useState('');
  const follow: SpringToken = isToken(params.follow) ? params.follow : 'release';
  // The legend mirrors the follower's state through a data attribute: no React render per state change.
  const onState = useCallback((s: CursorState) => { if (legend.current) legend.current.dataset.state = s; }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setStatus(`Copied ${EMAIL} (a fictional address).`);
    } catch {
      setStatus(`Copying is blocked here. The fictional address is ${EMAIL}.`);
    }
  };

  return (
    <div ref={root} className={styles.root} data-follower={on ? 'on' : 'off'} data-reduced={reduced || undefined}>
      <div className={styles.page}>
        <header className={styles.bar}>
          <p className={styles.mark}>
            <span className={styles.logo} aria-hidden="true" />
            <span className={styles.name}>Vale &amp; Ochre</span>
            <span className={styles.sub}>Fictional studio · sample work</span>
          </p>
          {on ? (
            <ul ref={legend} className={styles.legend} aria-hidden="true" data-state="hidden">
              {LEGEND.map((l) => <li key={l.k} data-k={l.k}><i className={styles.glyph} data-g={l.k} />{l.name}</li>)}
            </ul>
          ) : (
            <p className={styles.off}>Follower off · {reduced ? 'reduced motion' : 'touch screen'}</p>
          )}
        </header>

        <section className={styles.intro} aria-labelledby={`${uid}h`}>
          <div className={styles.introMain}>
            <p className={styles.kicker}>Selected work, 2017–2025</p>
            <h3 id={`${uid}h`} className={styles.headline}>Quiet systems for <em>loud</em> ideas.</h3>
            <button type="button" className={styles.primary} data-cursor="magnet" onClick={() => setStatus('“Start a project” pressed. This is a demo, so nothing was sent.')}>
              Start a project
              <span className={styles.primaryIcon}><Arrow dir="ne" /></span>
            </button>
          </div>
          <div className={styles.introSide}>
            <p className={styles.lede} data-cursor="text">
              We are a two-person studio, invented for this demo, drawing identities, interfaces and typefaces for
              museums, makers and one very patient ferry company. The work looks calm and behaves with intent: every
              movement has a reason, and the reason is written down.
            </p>
            <span className={styles.contact}>
              <button type="button" className={styles.round} data-cursor="magnet" aria-label="Copy the studio email address" onClick={() => { void copy(); }}>
                <MailIcon />
              </button>
              <span className={styles.email}>{EMAIL}</span>
            </span>
          </div>
        </section>

        <section aria-labelledby={`${uid}w`}>
          <div className={styles.sectionHead}>
            <h4 id={`${uid}w`} className={styles.h4}>Case studies</h4>
            <p className={styles.count}>{String(PROJECTS.length).padStart(2, '0')} projects · sample</p>
          </div>
          <ul className={styles.work}>
            {PROJECTS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={styles.card}
                  data-cursor-label="View"
                  onClick={() => setStatus(`${p.title} is sample work, so there is no case study to open.`)}
                >
                  <span className={styles.art}>{p.art}</span>
                  <span className={styles.caption}>
                    <span className={styles.title}>{p.title}</span>
                    <span className={styles.meta}>{p.kind} · {p.year}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <ArchiveStrip reduced={reduced} headingId={`${uid}a`} hintId={`${uid}ah`} />

        <footer className={styles.foot}>
          <p className={styles.hint}>
            {on
              ? 'Move over the cards, the archive, the buttons and the paragraph. Press Tab and the follower steps aside for the focus ring; move the mouse to bring it back.'
              : reduced
                ? 'Reduced motion is on, so the decorative follower is off. Everything still works with the normal cursor and the keyboard.'
                : 'The follower is for a mouse or trackpad, so it stays off on touch screens. Tap the cards and swipe the archive.'}
          </p>
          <p className={styles.status} role="status">{status}</p>
        </footer>
      </div>

      <CursorFollower
        scope={root}
        follow={follow}
        size={params.size}
        stretch={params.stretch}
        magnetPull={params.pull}
        blend={params.blend}
        dot={params.dot}
        renderLabel={renderLabel}
        onStateChange={onState}
      />
    </div>
  );
}

/* ── Archive strip: native horizontal scroll, plus mouse drag that keeps its velocity ───────────────────── */

/** Release velocity is projected this far ahead (s) to pick the tile the strip glides to. */
const PROJECTION = 0.26;

interface Drag { id: number; x0: number; s0: number; max: number; width: number; samples: { t: number; x: number }[] }

function ArchiveStrip({ reduced, headingId, hintId }: { reduced: boolean; headingId: string; hintId: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  // Coasting after a throw: a cubic ease-out whose starting speed is exactly the release speed and which ends on a
  // tile, so the hand-off is seamless and the landing is soft but finite. With nothing to carry (a slow release,
  // or letting go past an edge) a release-token spring settles it instead.
  const coast = useRef({ mode: 'spring' as 'glide' | 'spring', pos: axis(), from: 0, target: 0, span: 0, t: 0, max: 0, width: 0, virtual: 0 });
  const [coasting, setCoasting] = useState(false);
  const [dragging, setDragging] = useState(false);

  /** Scroll natively inside the range; past an edge, stretch the strip with rubber-band resistance. */
  const apply = (virtual: number, max: number, width: number) => {
    const el = strip.current;
    if (!el) return;
    const inside = clamp(virtual, 0, max);
    el.scrollLeft = inside;
    const over = reduced ? 0 : virtual - inside;
    el.style.transform = over ? `translate3d(${(-rubberBand(over, width * 0.5)).toFixed(2)}px, 0, 0)` : '';
    coast.current.virtual = virtual;
  };

  const stop = () => {
    if (!coasting) return;
    setCoasting(false);
    const c = coast.current;
    apply(clamp(c.virtual, 0, c.max), c.max, c.width);
  };

  useRafLoop(strip, (dt) => {
    const c = coast.current;
    let x: number;
    let done: boolean;
    if (c.mode === 'glide') {
      c.t = Math.min(c.span, c.t + dt);
      const u = 1 - c.t / c.span;
      x = c.target + (c.from - c.target) * u * u * u;
      done = c.t >= c.span;
    } else {
      stepAxis(c.pos, c.target, SPRING.release, dt);
      x = c.pos.x;
      done = atRest(c.pos, c.target, 0.3);
    }
    apply(done ? c.target : x, c.max, c.width);
    if (done) setCoasting(false);
  }, coasting && !reduced);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = strip.current;
    if (!el || e.pointerType !== 'mouse' || e.button !== 0) return; // touch and pen scroll natively
    // Grab a gliding strip exactly where it is.
    const start = coasting ? coast.current.virtual : el.scrollLeft;
    if (coasting) setCoasting(false);
    coast.current.virtual = start;
    // Measure once per gesture (reads first); the move handler only writes.
    drag.current = { id: e.pointerId, x0: e.clientX, s0: start, max: Math.max(0, el.scrollWidth - el.clientWidth), width: el.clientWidth, samples: [{ t: e.timeStamp, x: e.clientX }] };
    el.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    apply(d.s0 - (e.clientX - d.x0), d.max, d.width);
    d.samples.push({ t: e.timeStamp, x: e.clientX });
    while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > 100) d.samples.shift();
  };

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = strip.current;
    if (!d || !el || e.pointerId !== d.id) return;
    drag.current = null;
    setDragging(false);
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    const virtual = coast.current.virtual;
    if (reduced) { apply(clamp(virtual, 0, d.max), d.max, d.width); return; }
    // Velocity over the last ~80 ms in scroll space; a pause before letting go means no throw.
    const recent = d.samples.filter((s) => e.timeStamp - s.t <= 80);
    const a = recent[0], b = recent[recent.length - 1];
    const v = a && b && b.t - a.t > 8 && e.timeStamp - b.t < 50 ? -((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
    // Tiles to land on (read before any write in this handler).
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-tile]'));
    const first = items[0]?.offsetLeft ?? 0;
    const points = [...items.map((i) => i.offsetLeft - first).filter((p) => p < d.max - 1), d.max];
    const projected = clamp(virtual + v * PROJECTION, 0, d.max);
    const target = points.reduce((best, p) => (Math.abs(p - projected) < Math.abs(best - projected) ? p : best), points[0] ?? 0);
    const c = coast.current;
    c.max = d.max;
    c.width = d.width;
    c.target = target;
    c.from = virtual;
    c.t = 0;
    c.pos.x = virtual;
    c.pos.v = v;
    // Glide when the throw heads for the chosen tile: duration 3·distance/speed starts the ease-out at the release speed.
    const span = (3 * (target - virtual)) / v;
    const inRange = virtual >= 0 && virtual <= d.max;
    c.mode = inRange && Number.isFinite(span) && span > 0.12 && span < 1.4 ? 'glide' : 'spring';
    c.span = span;
    if (Math.abs(target - virtual) > 0.5 || Math.abs(v) > 1) setCoasting(true);
    else apply(target, d.max, d.width);
  };

  // The person takes over: wheel, trackpad or keys stop a glide where it is.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key.startsWith('Page')) stop(); };

  return (
    <section className={styles.archive} aria-labelledby={headingId}>
      <div className={styles.sectionHead}>
        <h4 id={headingId} className={styles.h4}>Archive</h4>
        <p id={hintId} className={styles.count}>2017–2024 · drag, or focus it and use ← →</p>
      </div>
      <div className={styles.frame}>
        <div
          ref={strip}
          className={styles.strip}
          tabIndex={0}
          role="region"
          aria-labelledby={headingId}
          aria-describedby={hintId}
          data-cursor-label="Drag"
          data-dragging={dragging || undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onWheel={stop}
          onKeyDown={onKeyDown}
        >
          <ol className={styles.track}>
            {ARCHIVE.map((p) => (
              <li key={p.title} className={styles.tile} data-tile="">
                <span className={styles.tileArt}>{p.art}</span>
                <span className={styles.tileCap}>
                  <span className={styles.tileTitle}>{p.title}</span>
                  <span className={styles.year}>{p.year}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <span className={styles.fade} aria-hidden="true" />
      </div>
      <div className={styles.progress} aria-hidden="true"><span /></div>
    </section>
  );
}
