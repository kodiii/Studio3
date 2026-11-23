'use client';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, useTransform, type MotionValue, type Transition, type Variants } from 'motion/react';

interface CardValues { x: MotionValue<number>; rise: MotionValue<number> }
import { spring, useStudioMotion, type SpringToken } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { depth: number; threshold: number; velocity: number; rotation: number; spring: string };

interface Palette { id: string; name: string; note: string; colors: readonly string[]; weights: readonly number[] }

/** Sample data: invented colour palettes. Swatch colours are the content, so they stay fixed in both themes. */
const DECK: readonly Palette[] = [
  { id: 'harbour', name: 'Harbour, 6 a.m.', note: 'Cold water, warm rope', colors: ['#1f3a44', '#3f6b73', '#9cb8b3', '#e6dfcf', '#d98c4a'], weights: [3, 2, 2, 1.4, 1] },
  { id: 'kiln', name: 'Kiln ash', note: 'Greys with a pulse of heat', colors: ['#2b2a27', '#6b665c', '#a8a191', '#d9d2c3', '#c4532c'], weights: [2, 2.4, 2, 1.6, 0.8] },
  { id: 'tomato', name: 'Late tomato', note: 'End-of-summer reds', colors: ['#6e1f12', '#b3391b', '#e0663a', '#f2b48c', '#f6e7d3'], weights: [1.4, 3, 2, 1.4, 1.2] },
  { id: 'moss', name: 'Moss and slate', note: 'Damp stone, new growth', colors: ['#2f3a2c', '#556347', '#8a9468', '#c9c7a4', '#3c4448'], weights: [2.2, 2.6, 1.6, 1.2, 1] },
  { id: 'saffron', name: 'Saffron market', note: 'Spice-stall yellows', colors: ['#5a2d0c', '#a8551b', '#e39b2d', '#f3cf6b', '#fbf1d6'], weights: [1, 1.6, 3, 2, 1.2] },
  { id: 'fog', name: 'Fog line', note: 'Nearly monochrome', colors: ['#3e4446', '#6f7779', '#a3aaa9', '#d3d6d1', '#eeeee8'], weights: [1.2, 1.6, 2.4, 2.4, 1.6] },
  { id: 'rosehip', name: 'Rosehip', note: 'Dusty berries and cream', colors: ['#4a1c24', '#8f3341', '#c96a6f', '#e9b3a8', '#f7e6dc'], weights: [2, 2.6, 1.8, 1.4, 1] },
  { id: 'copper', name: 'Copper and cream', note: 'Old pans, new linen', colors: ['#3b2418', '#8a4b2a', '#c07a46', '#e8c9a1', '#faf3e6'], weights: [1.4, 2.2, 2.4, 1.6, 1.2] },
];

type Dir = 1 | -1;
interface Decision { id: string; dir: Dir }

const isSpring = (v: string): v is SpringToken => v in spring;
const scaleAt = (d: number) => 1 - d * 0.055;
const liftAt = (d: number) => d * 15;

export default function SwipeCardStack({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Decision[]>([]);
  const [lastDir, setLastDir] = useState<Dir>(1);
  const [restored, setRestored] = useState<Decision | null>(null);
  const [message, setMessage] = useState('');
  const values = useRef(new Map<string, CardValues>());
  const link = useRef<(() => void) | null>(null);
  const root = useRef<HTMLDivElement>(null);
  // Motion keeps a component's first external ref, so the live top card is found by attribute instead.
  const liveTop = () => root.current?.querySelector<HTMLElement>('article[data-top]:not([inert])') ?? null;
  const startOver = useRef<HTMLButtonElement>(null);
  const focusNext = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);

  const token: SpringToken = isSpring(params.spring) ? params.spring : 'release';
  const springT: Transition = reduced ? { duration: 0 } : { type: 'spring', ...spring[token] };
  const depth = Math.round(params.depth);
  const saved = history.filter((h) => h.dir === 1).map((h) => DECK.find((p) => p.id === h.id)!);
  const left = DECK.length - index;

  const register = useCallback((id: string, v: CardValues) => {
    values.current.set(id, v);
    return () => { if (values.current.get(id) === v) values.current.delete(id); };
  }, []);
  const unlink = () => { link.current?.(); link.current = null; };

  // The card beneath rises with the top card's drag: its own rise value follows the top card's x.
  useEffect(() => {
    const top = DECK[index] && values.current.get(DECK[index].id);
    const next = DECK[index + 1] && values.current.get(DECK[index + 1].id);
    if (!top || !next) return;
    const off = top.x.on('change', (v) => next.rise.set(Math.min(1, Math.abs(v) / params.threshold)));
    link.current = off;
    return () => { off(); if (link.current === off) link.current = null; };
  }, [index, params.threshold, depth]);

  // When a focused card leaves, focus follows to the next card (or the Start over button).
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    (index < DECK.length ? liveTop() : startOver.current)?.focus({ preventScroll: true });
  }, [index]);

  const decide = (dir: Dir) => {
    const item = DECK[index];
    if (!item) return;
    const top = liveTop();
    focusNext.current = !!top && document.activeElement === top;
    // Hand-off: stop the next card following this one, then let it settle into the top slot.
    unlink();
    const next = DECK[index + 1] && values.current.get(DECK[index + 1].id);
    if (next) animate(next.rise, 0, springT);
    setLastDir(dir);
    setRestored(null);
    setIndex(index + 1);
    setHistory((h) => [...h, { id: item.id, dir }]);
    const rest = DECK.length - index - 1;
    setMessage(`${dir === 1 ? 'Saved' : 'Skipped'} ${item.name}. ${rest ? `${rest} left.` : 'That was the last palette.'}`);
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    const item = DECK.find((p) => p.id === last.id)!;
    const top = liveTop();
    focusNext.current = !!top && document.activeElement === top;
    unlink();
    for (const v of values.current.values()) v.rise.set(0);
    setHistory((h) => h.slice(0, -1));
    setRestored(last);
    setIndex(index - 1);
    setMessage(`Undid ${last.dir === 1 ? 'save' : 'skip'}: ${item.name} is back on top.`);
  };
  const reset = () => {
    setHistory([]);
    setRestored(null);
    setIndex(0);
    setMessage(`Deck reset: ${DECK.length} palettes to sort.`);
    focusNext.current = true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') decide(1);
    else if (e.key === 'ArrowLeft') decide(-1);
    else if (e.key === 'Backspace' || e.key === 'z' || e.key === 'Z') undo();
    else return;
    e.preventDefault();
  };

  const visible = DECK.slice(index, index + depth + 1);

  return (
    <div ref={root} className={styles.root} data-reduced={reduced || undefined} onKeyDown={onKeyDown}>
      <section className={styles.deckArea} aria-labelledby={`${uid}title`}>
        <header className={styles.head}>
          <h3 id={`${uid}title`} className={styles.title}>Palette shortlist</h3>
          <p className={styles.count} aria-hidden="true">
            {Math.min(index + 1, DECK.length)} / {DECK.length}
          </p>
        </header>
        <p id={`${uid}help`} className={styles.help}>
          Drag a card right to save or left to skip, or use the buttons. Keys: ← skip · → save · Z undo.
        </p>

        <div className={styles.stack} style={{ '--depth': depth } as CSSProperties}>
          <AnimatePresence custom={lastDir}>
            {visible.map((p, i) => (
              <Card
                key={p.id}
                palette={p}
                position={DECK.indexOf(p) + 1}
                depthIndex={i}
                isTop={i === 0}
                register={register}
                params={params}
                reduced={reduced}
                transition={springT}
                enterFrom={restored?.id === p.id ? restored.dir : 0}
                firstRender={!mounted.current}
                helpId={`${uid}help`}
                onDecide={decide}
              />
            )).reverse()}
          </AnimatePresence>
          {index >= DECK.length ? (
            <div className={styles.done}>
              <p className={styles.doneTitle}>That’s every palette.</p>
              <p className={styles.doneText}>{saved.length ? `${saved.length} saved to your shortlist.` : 'Nothing saved this time.'}</p>
              <button ref={startOver} type="button" className={styles.textButton} onClick={reset}>Start over</button>
            </div>
          ) : null}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.action} data-kind="skip" onClick={() => decide(-1)} disabled={index >= DECK.length}>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Skip
          </button>
          <button type="button" className={styles.undo} onClick={undo} disabled={!history.length}>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M7.5 5.5L4 9l3.5 3.5M4.5 9H12a4 4 0 010 8H9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Undo
          </button>
          <button type="button" className={styles.action} data-kind="save" onClick={() => decide(1)} disabled={index >= DECK.length}>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M10 16.5s-6-3.6-6-8.1A3.4 3.4 0 0110 6.6a3.4 3.4 0 016 1.8c0 4.5-6 8.1-6 8.1z" fill="currentColor" /></svg>
            Save
          </button>
        </div>
        <p className={styles.srOnly} role="status">{message}</p>
      </section>

      <aside className={styles.tray} aria-labelledby={`${uid}saved`}>
        <h4 id={`${uid}saved`} className={styles.trayTitle}>Saved <span className={styles.trayCount}>{saved.length}</span></h4>
        {saved.length ? (
          <ul className={styles.savedList}>
            {saved.map((p) => (
              <li key={p.id} className={styles.savedItem}>
                <span className={styles.strip} aria-hidden="true">{p.colors.map((c) => <i key={c} style={{ background: c }} />)}</span>
                {p.name}
              </li>
            ))}
          </ul>
        ) : <p className={styles.empty}>Nothing yet. Saved palettes collect here.</p>}
        <p className={styles.sample}>Sample palettes · {left} left to sort</p>
      </aside>
    </div>
  );
}

interface CardProps {
  palette: Palette;
  position: number;
  depthIndex: number;
  isTop: boolean;
  register: (id: string, v: CardValues) => () => void;
  params: Params;
  reduced: boolean;
  transition: Transition;
  /** 1 / -1 when this card is coming back from an undo (enters from that side), else 0. */
  enterFrom: number;
  firstRender: boolean;
  helpId: string;
  onDecide: (dir: Dir) => void;
}

function Card({ palette: p, position, depthIndex, isTop, register, params, reduced, transition, enterFrom, firstRender, helpId, onDecide }: CardProps) {
  const present = useIsPresent();
  const x = useMotionValue(0);
  const rise = useMotionValue(0);
  useEffect(() => register(p.id, { x, rise }), [register, p.id, x, rise]);
  const tilt = reduced ? 0 : params.rotation;
  const rotate = useTransform(x, [-params.threshold * 1.6, 0, params.threshold * 1.6], [-tilt, 0, tilt]);
  const saveStamp = useTransform(x, [12, params.threshold], [0, 1]);
  const skipStamp = useTransform(x, [-params.threshold, -12], [1, 0]);
  // Fully risen (1), the card beneath sits exactly where the top card is: scale and offset cancel its depth.
  const riseScale = useTransform(rise, [0, 1], [1, 1 / scaleAt(1)]);
  const riseY = useTransform(rise, [0, 1], [0, -liftAt(1) / scaleAt(1)]);
  const distance = 560;

  const variants: Variants = {
    fly: (dir: Dir) => (reduced
      ? { opacity: 0, transition: { duration: 0.16, ease: 'linear' } }
      : { x: dir * distance, opacity: 0, transition: { x: transition, opacity: { duration: 0.22, delay: 0.12 } } }),
    fade: { opacity: 0, transition: { duration: 0.16 } },
  };

  return (
    <motion.div
      className={styles.slot}
      style={{ x, rotate, zIndex: 10 - depthIndex }}
      custom={enterFrom}
      initial={enterFrom ? (reduced ? { opacity: 0 } : { x: enterFrom * distance, opacity: 0 }) : false}
      animate={{ x: 0, opacity: 1, transition: reduced ? { duration: 0.16 } : transition }}
      variants={variants}
      exit={isTop ? 'fly' : 'fade'}
      drag={isTop && present ? 'x' : false}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        const off = x.get();
        const v = info.velocity.x;
        const flick = Math.abs(v) > params.velocity && (Math.sign(v) === Math.sign(off) || Math.abs(off) < 8);
        if (Math.abs(off) > params.threshold || flick) onDecide((Math.sign(off) || Math.sign(v) || 1) as Dir);
        else animate(x, 0, reduced ? { duration: 0 } : { type: 'spring', ...spring.settle });
      }}
    >
      <motion.div
        className={styles.depth}
        initial={firstRender || enterFrom ? false : { scale: scaleAt(depthIndex + 1), y: liftAt(depthIndex + 1), opacity: 0 }}
        animate={{ scale: scaleAt(depthIndex), y: liftAt(depthIndex), opacity: 1 }}
        transition={transition}
      >
        <motion.article
          className={styles.card}
          data-top={isTop || undefined}
          style={reduced ? undefined : { scale: riseScale, y: riseY }}
          tabIndex={isTop ? 0 : -1}
          inert={!isTop || !present}
          aria-hidden={isTop ? undefined : true}
          aria-label={`${p.name}, palette ${position} of ${DECK.length}`}
          aria-describedby={helpId}
        >
          <span className={styles.swatches} aria-hidden="true">
            {p.colors.map((c, i) => <i key={c} style={{ background: c, flexGrow: p.weights[i] }} />)}
          </span>
          <span className={styles.cardBody}>
            <span className={styles.cardMeta}>
              <span>{String(position).padStart(2, '0')} / {String(DECK.length).padStart(2, '0')}</span>
              <span>Sample</span>
            </span>
            <span className={styles.cardName}>{p.name}</span>
            <span className={styles.cardNote}>{p.note}</span>
            <span className={styles.hexes}>{p.colors.map((c) => <span key={c}>{c.slice(1).toUpperCase()}</span>)}</span>
          </span>
          {isTop ? (
            <>
              <motion.span className={styles.stamp} data-kind="save" style={{ opacity: saveStamp }} aria-hidden="true">Save</motion.span>
              <motion.span className={styles.stamp} data-kind="skip" style={{ opacity: skipStamp }} aria-hidden="true">Skip</motion.span>
            </>
          ) : null}
        </motion.article>
      </motion.div>
    </motion.div>
  );
}
