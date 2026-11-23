'use client';
import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { AnimatePresence, motion, useIsPresent, type Transition } from 'motion/react';
import { easing, spring, useStudioMotion, type SpringToken } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { spring: string; panel: string; scrim: number; contentDelay: number; columns: number };

type ArtId = 'light' | 'paper' | 'machines' | 'listen' | 'salt' | 'index';
interface Listing {
  id: ArtId;
  kind: string;
  day: string;
  title: string;
  summary: string;
  detail: string;
  when: string;
  where: string;
  length: string;
}

/** Sample listings for an invented venue. */
const LISTINGS: readonly Listing[] = [
  { id: 'light', kind: 'Talk', day: 'Thu 6 Mar', title: 'Measuring Light', when: 'Thursday 6 March, 19:00', where: 'Room 2', length: '75 minutes',
    summary: 'An astronomer and a lighting designer compare how much light a room actually needs, and how you would know.',
    detail: 'Bring a phone with a light-meter app if you have one: readings are taken around the building during the break.' },
  { id: 'paper', kind: 'Workshop', day: 'Sat 8 Mar', title: 'The Weight of Paper', when: 'Saturday 8 March, 10:30', where: 'Print room', length: '2 hours 30',
    summary: 'Fold, score and sew a sixteen-page pamphlet from a single sheet, with no glue and no guillotine.',
    detail: 'Paper, thread and bone folders are provided. The workshop is seated and step-free.' },
  { id: 'machines', kind: 'Screening', day: 'Wed 12 Mar', title: 'Slow Machines', when: 'Wednesday 12 March, 20:00', where: 'Cinema', length: '64 minutes',
    summary: 'Three short films about mechanisms that take a year or more to complete a single turn.',
    detail: 'Followed by a short conversation with one of the filmmakers. Subtitled; the room has a hearing loop.' },
  { id: 'listen', kind: 'Talk', day: 'Fri 14 Mar', title: 'Rooms That Listen', when: 'Friday 14 March, 19:30', where: 'Main hall', length: '60 minutes',
    summary: 'An acoustician on why some rooms make conversation easy and others make it impossible.',
    detail: 'The talk moves between three spaces in the building; seating is available in each of them.' },
  { id: 'salt', kind: 'Demonstration', day: 'Sun 16 Mar', title: 'Salt & Resin', when: 'Sunday 16 March, 14:00', where: 'Studio 1', length: '90 minutes, drop in',
    summary: 'A week of salt crystals growing, shown as a time-lapse, then a set of them cast into clear resin.',
    detail: 'Drop in at any point: the demonstration repeats every half hour. Suitable for children with an adult.' },
  { id: 'index', kind: 'Exhibition', day: '3–30 Mar', title: 'An Index of Small Things', when: 'Daily, 3–30 March, 10:00–17:00', where: 'Long gallery', length: 'Self-paced',
    summary: 'A month-long show of objects no longer than a thumb, each one catalogued by hand.',
    detail: 'Magnifiers are available at the desk. The gallery is step-free, with seating along the long wall.' },
];

/** Poster colours are part of the printed artwork, so they are fixed in both themes. */
const POSTER: Record<ArtId, CSSProperties> = {
  light: { '--bg': '#d9a441', '--fg': '#1d1c18', '--ac': '#f7f1e4' } as CSSProperties,
  paper: { '--bg': '#e6ddca', '--fg': '#1d1c18', '--ac': '#c43d17' } as CSSProperties,
  machines: { '--bg': '#1d1c18', '--fg': '#efe9dc', '--ac': '#ff6a3d' } as CSSProperties,
  listen: { '--bg': '#4b5940', '--fg': '#ece6d6', '--ac': '#e3b24f' } as CSSProperties,
  salt: { '--bg': '#2b373d', '--fg': '#e6e0d2', '--ac': '#e3b24f' } as CSSProperties,
  index: { '--bg': '#c43d17', '--fg': '#f7efe2', '--ac': '#1d1c18' } as CSSProperties,
};

/** Round computed SVG coordinates so server and browser trig agree (no hydration drift). */
const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * A square emblem centred on the poster's colour field. Being square, it scales uniformly while the
 * field around it morphs freely between the card and panel shapes, so the artwork never distorts.
 */
function Poster({ art, layoutId, transition }: { art: ArtId; layoutId?: string; transition: Transition }) {
  const body = (() => {
    switch (art) {
      case 'light':
        return (
          <>
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--fg)" strokeWidth="0.5" strokeDasharray="1.2 2.4" />
            <circle cx="50" cy="50" r="30" fill="var(--ac)" />
            <g fill="var(--bg)">
              {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x="18" y={r2(52 + i * 5.4 + i * i * 0.3)} width="64" height={r2(1.1 + i * 0.6)} />)}
            </g>
            <rect x="8" y="50" width="84" height="0.8" fill="var(--fg)" />
          </>
        );
      case 'paper':
        return (
          <>
            <rect x="29" y="22" width="40" height="54" fill="#f8f4ea" stroke="var(--fg)" strokeWidth="0.6" transform="rotate(-11 49 49)" />
            <rect x="31" y="23" width="40" height="54" fill="#fbf8f1" stroke="var(--fg)" strokeWidth="0.6" transform="rotate(3 51 50)" />
            <g transform="rotate(13 53 51)">
              <path d="M33 24h40v42L61 78H33z" fill="#fffdf8" stroke="var(--fg)" strokeWidth="0.6" />
              <path d="M73 66L61 78V66z" fill="var(--ac)" />
              <path d="M53 24v54" stroke="var(--fg)" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
            </g>
          </>
        );
      case 'machines':
        return (
          <>
            {[33, 24, 15].map((r) => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="var(--fg)" strokeWidth={r === 33 ? 0.9 : 0.5} />)}
            {Array.from({ length: 24 }, (_, i) => {
              const a = (i / 24) * Math.PI * 2;
              const r0 = i % 6 === 0 ? 35.5 : 36.8;
              return <line key={i} x1={r2(50 + Math.cos(a) * r0)} y1={r2(50 + Math.sin(a) * r0)} x2={r2(50 + Math.cos(a) * 39.5)} y2={r2(50 + Math.sin(a) * 39.5)} stroke="var(--fg)" strokeWidth="0.6" />;
            })}
            <line x1="50" y1="50" x2={r2(50 + Math.cos(-0.9) * 30)} y2={r2(50 + Math.sin(-0.9) * 30)} stroke="var(--ac)" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="50" cy="50" r="2.3" fill="var(--ac)" />
          </>
        );
      case 'listen':
        return (
          <>
            <circle cx="24" cy="50" r="3" fill="var(--fg)" />
            {[10, 19, 28, 37, 46, 55].map((r, i) => {
              const a = 0.86;
              return <path key={r} d={`M${r2(24 + Math.cos(-a) * r)} ${r2(50 + Math.sin(-a) * r)}A${r} ${r} 0 0 1 ${r2(24 + Math.cos(a) * r)} ${r2(50 + Math.sin(a) * r)}`} fill="none" stroke={i === 5 ? 'var(--ac)' : 'var(--fg)'} strokeWidth={r2(2.2 - i * 0.3)} strokeLinecap="round" />;
            })}
          </>
        );
      case 'salt':
        return (
          <g strokeWidth="0.7">
            {Array.from({ length: 36 }, (_, i) => {
              const c = i % 6, r = Math.floor(i / 6);
              const x = 20 + c * 12, y = 20 + r * 12;
              const lit = [3, 8, 16, 21, 26, 31].includes(i);
              const s = r2(3 + ((i * 7) % 5) * 0.42);
              return <rect key={i} x={r2(x - s)} y={r2(y - s)} width={r2(s * 2)} height={r2(s * 2)} transform={`rotate(45 ${x} ${y})`} fill={lit ? 'var(--ac)' : 'none'} stroke={lit ? 'var(--ac)' : 'var(--fg)'} />;
            })}
          </g>
        );
      case 'index':
        return (
          <>
            {Array.from({ length: 49 }, (_, i) => {
              const c = i % 7, r = Math.floor(i / 7);
              return <circle key={i} cx={20 + c * 10} cy={20 + r * 10} r={i === 25 ? 2.4 : 1.25} fill="var(--fg)" />;
            })}
            <circle cx="60" cy="50" r="6.5" fill="none" stroke="var(--ac)" strokeWidth="1.4" />
            <path d="M64.8 54.8l9 9" stroke="var(--ac)" strokeWidth="1.6" strokeLinecap="round" />
          </>
        );
    }
  })();
  return (
    // Layout projection only works on HTML elements, so the shared id sits on a square wrapper.
    <motion.div layoutId={layoutId} transition={transition} className={styles.poster} aria-hidden="true">
      <svg viewBox="0 0 100 100" focusable="false">
        <g className={styles.emblem}>{body}</g>
      </svg>
    </motion.div>
  );
}

const isSpring = (v: string): v is SpringToken => v in spring;

/** Shared-element ids; all undefined under reduced motion so nothing travels. */
interface LayoutIds { card?: string; media?: string; art?: string; kicker?: string; title?: string }

export default function ExpandingCardDetail({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const [openId, setOpenId] = useState<ArtId | null>(null);
  const [saved, setSaved] = useState<ReadonlySet<ArtId>>(new Set());
  const cardButtons = useRef(new Map<ArtId, HTMLButtonElement>());
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<ArtId | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const token: SpringToken = isSpring(params.spring) ? params.spring : 'glide';
  const t: Transition = reduced ? { duration: 0.16, ease: 'linear' } : { type: 'spring', ...spring[token] };
  const ids = (id: ArtId): LayoutIds => (reduced ? {} : {
    card: `${uid}card-${id}`, media: `${uid}media-${id}`, art: `${uid}art-${id}`, kicker: `${uid}kicker-${id}`, title: `${uid}title-${id}`,
  });
  const listing = LISTINGS.find((l) => l.id === openId) ?? null;

  // Focus moves into the panel when it opens and back to the card that opened it when it closes,
  // unless the user has already put focus somewhere else (e.g. clicked another control on the page).
  useEffect(() => {
    if (openId) {
      returnTo.current = openId;
      closeButton.current?.focus({ preventScroll: true });
    } else if (returnTo.current) {
      const active = document.activeElement;
      const lost = !active || active === document.body || !!root.current?.contains(active);
      if (lost) cardButtons.current.get(returnTo.current)?.focus({ preventScroll: true });
      returnTo.current = null;
    }
  }, [openId]);

  // Light dismiss: a press anywhere outside the panel closes it (the scrim included).
  useEffect(() => {
    if (!openId) return;
    const onDown = (e: PointerEvent) => {
      const panel = root.current?.querySelector('[role="dialog"]:not([inert])');
      if (panel && e.target instanceof Node && !panel.contains(e.target)) setOpenId(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [openId]);

  const toggleSaved = (id: ArtId) => setSaved((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div
      ref={root}
      className={styles.root}
      data-reduced={reduced || undefined}
      style={{ '--cols': Math.round(params.columns), '--scrim': params.scrim / 100 } as CSSProperties}
    >
      <div className={styles.body} inert={openId !== null}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>Small Hours · March</p>
          <h3 className={styles.heading}>This month’s programme</h3>
          <p className={styles.note}>Sample listings, invented venue</p>
        </header>
        <ul className={styles.grid}>
          {LISTINGS.map((l) => {
            const id = ids(l.id);
            return (
              <li key={l.id} className={styles.cell}>
                <motion.article layoutId={id.card} className={styles.card} style={{ borderRadius: 16 }} transition={t}>
                  <motion.div layoutId={id.media} className={styles.media} style={{ borderRadius: 10, ...POSTER[l.id] }} transition={t}>
                    <Poster art={l.id} layoutId={id.art} transition={t} />
                  </motion.div>
                  <div className={styles.cardText}>
                    <motion.p layoutId={id.kicker} layout="position" className={styles.kicker} transition={t}>
                      {l.kind} · {l.day}
                    </motion.p>
                    <motion.h4 layoutId={id.title} layout="position" className={styles.cardTitle} transition={t}>
                      <button
                        ref={(el) => { if (el) cardButtons.current.set(l.id, el); else cardButtons.current.delete(l.id); }}
                        type="button"
                        className={styles.open}
                        aria-haspopup="dialog"
                        onClick={() => setOpenId(l.id)}
                      >
                        {l.title}
                      </button>
                    </motion.h4>
                    {saved.has(l.id) ? (
                      <p className={styles.savedTag}>
                        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        Saved
                      </p>
                    ) : null}
                  </div>
                </motion.article>
              </li>
            );
          })}
        </ul>
      </div>

      <AnimatePresence>
        {listing ? (
          <motion.div
            key="scrim"
            className={styles.scrim}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0.16, ease: 'linear' } : { duration: 0.32, ease: easing.standard }}
          />
        ) : null}
        {listing ? (
          <Panel
            key={listing.id}
            listing={listing}
            uid={uid}
            ids={ids(listing.id)}
            mode={params.panel === 'centered' ? 'centered' : 'fill'}
            reduced={reduced}
            transition={t}
            contentDelay={params.contentDelay / 1000}
            saved={saved.has(listing.id)}
            onToggleSaved={() => toggleSaved(listing.id)}
            onClose={() => setOpenId(null)}
            closeRef={closeButton}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

interface PanelProps {
  listing: Listing;
  uid: string;
  ids: LayoutIds;
  mode: 'fill' | 'centered';
  reduced: boolean;
  transition: Transition;
  contentDelay: number;
  saved: boolean;
  onToggleSaved: () => void;
  onClose: () => void;
  closeRef: RefObject<HTMLButtonElement | null>;
}

function Panel({ listing: l, uid, ids, mode, reduced, transition: t, contentDelay, saved, onToggleSaved, onClose, closeRef }: PanelProps) {
  // While the panel plays its exit it must not take focus or be read out.
  const present = useIsPresent();
  const fade = reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : {};
  return (
    <motion.div
      role="dialog"
      aria-labelledby={`${uid}ptitle`}
      aria-describedby={`${uid}psummary`}
      tabIndex={-1}
      inert={!present}
      className={styles.panel}
      data-mode={mode}
      layoutId={ids.card}
      style={{ borderRadius: 20 }}
      transition={t}
      {...fade}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close details">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>
      <motion.div className={styles.panelScroll} layoutScroll>
        <motion.div layoutId={ids.media} className={styles.media} style={{ borderRadius: 12, ...POSTER[l.id] }} transition={t}>
          <Poster art={l.id} layoutId={ids.art} transition={t} />
        </motion.div>
        <div className={styles.panelBody}>
          <motion.p layoutId={ids.kicker} layout="position" className={styles.kicker} transition={t}>
            {l.kind} · {l.day}
          </motion.p>
          <motion.h3 id={`${uid}ptitle`} layoutId={ids.title} layout="position" className={styles.panelTitle} transition={t}>
            {l.title}
          </motion.h3>
          <motion.div
            className={styles.details}
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, y: 0, transition: reduced ? { duration: 0.16 } : { delay: contentDelay, duration: 0.36, ease: easing.emphasized } }}
            exit={{ opacity: 0, transition: { duration: reduced ? 0.16 : 0.12 } }}
          >
            <p id={`${uid}psummary`} className={styles.summary}>{l.summary}</p>
            <p className={styles.detail}>{l.detail}</p>
            <dl className={styles.facts}>
              <div><dt>When</dt><dd>{l.when}</dd></div>
              <div><dt>Where</dt><dd>{l.where}</dd></div>
              <div><dt>Length</dt><dd>{l.length}</dd></div>
            </dl>
            <button type="button" className={styles.save} aria-pressed={saved} onClick={onToggleSaved}>
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 2.5h8v11l-4-3-4 3z" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
              Save to my list
            </button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
