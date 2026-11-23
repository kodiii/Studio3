'use client';
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { Reorder, useDragControls, type Transition } from 'motion/react';
import { spring, useStudioMotion, type SpringToken } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { lift: number; spring: string; dragFrom: string; times: boolean; density: string };

interface Segment { id: string; title: string; detail: string; minutes: number }

/** Sample data: the running order of an invented morning radio show. */
const SEGMENTS: readonly Segment[] = [
  { id: 'open', title: 'Cold open', detail: 'Sound of the harbour at dawn', minutes: 2 },
  { id: 'news', title: 'Headlines', detail: 'Three stories, read straight', minutes: 6 },
  { id: 'roads', title: 'Weather and roads', detail: 'Tides, ferries, closures', minutes: 4 },
  { id: 'pilot', title: 'Interview: a harbour pilot', detail: 'Live from the quay', minutes: 12 },
  { id: 'letters', title: 'Listener letters', detail: 'Read by the producer', minutes: 8 },
  { id: 'music', title: 'Music break', detail: 'One long track', minutes: 5 },
  { id: 'close', title: 'Sign-off', detail: 'What is on tomorrow', minutes: 3 },
];
const START = 7 * 60; // 07:00
const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const isSpring = (v: string): v is SpringToken => v in spring;

export default function DragReorderList({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const [items, setItems] = useState<Segment[]>(() => [...SEGMENTS]);
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const origin = useRef<Segment[] | null>(null);
  // Synchronous copy of `grabbed` for blur/press handlers that can fire before React re-renders.
  const held = useRef<string | null>(null);
  // Latest order for handlers that run between renders (drag end fires a frame after release).
  const latest = useRef(items);
  latest.current = items;

  const token: SpringToken = isSpring(params.spring) ? params.spring : 'settle';
  const transition: Transition = reduced ? { duration: 0 } : { type: 'spring', ...spring[token] };
  const lift = reduced ? 1 : params.lift;
  const startOf = (list: readonly Segment[], i: number) => START + list.slice(0, i).reduce((t, s) => t + s.minutes, 0);
  const total = SEGMENTS.reduce((t, s) => t + s.minutes, 0);
  const where = (list: readonly Segment[], id: string) => {
    const i = list.findIndex((s) => s.id === id);
    return `position ${i + 1} of ${list.length}${params.times ? `, starting ${clock(startOf(list, i))}` : ''}`;
  };

  const pickUp = (s: Segment) => {
    origin.current = latest.current;
    held.current = s.id;
    setGrabbed(s.id);
    setMessage(`Picked up ${s.title}, ${where(latest.current, s.id)}. Up and Down arrows move it, Space drops it, Escape cancels.`);
  };
  const drop = (s: Segment) => {
    if (held.current !== s.id) return;
    origin.current = null;
    held.current = null;
    setGrabbed(null);
    setMessage(`${s.title} dropped at ${where(latest.current, s.id)}.`);
  };
  const cancel = (s: Segment) => {
    const back = origin.current ?? latest.current;
    origin.current = null;
    held.current = null;
    setGrabbed(null);
    setItems(back);
    setMessage(`Move cancelled. ${s.title} is back at ${where(back, s.id)}.`);
  };
  const moveTo = (s: Segment, to: number) => {
    const list = latest.current;
    const from = list.findIndex((x) => x.id === s.id);
    const target = Math.max(0, Math.min(list.length - 1, to));
    if (target === from) {
      setMessage(`${s.title} is already at the ${from === 0 ? 'top' : 'bottom'}.`);
      return;
    }
    const next = [...list];
    next.splice(target, 0, ...next.splice(from, 1));
    latest.current = next;
    setItems(next);
    setMessage(`${s.title} moved to ${where(next, s.id)}.`);
  };

  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>, s: Segment) => {
    const isHeld = held.current === s.id;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      if (isHeld) drop(s);
      else {
        const other = latest.current.find((x) => x.id === held.current);
        if (other) drop(other);
        pickUp(s);
      }
      return;
    }
    if (!isHeld) return;
    const i = latest.current.findIndex((x) => x.id === s.id);
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? latest.current.length - 1 : null;
    if (to !== null) { e.preventDefault(); moveTo(s, to); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(s); }
  };

  return (
    <div
      className={styles.root}
      data-density={params.density === 'compact' ? 'compact' : 'comfortable'}
      data-reduced={reduced || undefined}
      style={{ '--lift': lift } as CSSProperties}
    >
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>The Early Edit · running order</p>
          <h3 className={styles.title} id={`${uid}title`}>Tomorrow, from {clock(START)}</h3>
        </div>
        <p className={styles.sum}>{items.length} segments · {total} min · off air {clock(START + total)}</p>
      </header>

      <Reorder.Group as="ol" axis="y" values={items} onReorder={setItems} className={styles.list} aria-labelledby={`${uid}title`}>
        {items.map((s, i) => (
          <Row
            key={s.id}
            segment={s}
            index={i}
            count={items.length}
            start={startOf(items, i)}
            params={params}
            transition={transition}
            lift={lift}
            grabbed={grabbed === s.id}
            dragging={dragging === s.id}
            helpId={`${uid}help`}
            onKey={(e) => onHandleKey(e, s)}
            onBlurHandle={() => drop(s)}
            onPress={() => {
              const other = latest.current.find((x) => x.id === held.current);
              if (other) drop(other);
            }}
            onToggle={() => (held.current === s.id ? drop(s) : pickUp(s))}
            onDragStart={() => { setDragging(s.id); setMessage(`Dragging ${s.title}.`); }}
            onDragEnd={() => { setDragging(null); setMessage(`${s.title} dropped at ${where(latest.current, s.id)}.`); }}
          />
        ))}
      </Reorder.Group>

      <p className={styles.hint} aria-hidden="true">
        Drag a <span className={styles.gripInline}><Grip /></span> handle, or focus it and press <kbd>Space</kbd>, then <kbd>↑</kbd> <kbd>↓</kbd>, <kbd>Space</kbd> to drop, <kbd>Esc</kbd> to cancel.
      </p>
      <p className={styles.note}>Sample running order</p>
      <p id={`${uid}help`} className={styles.srOnly}>
        Press Space to pick up. While picked up, use the Up and Down arrows to move, Home and End to jump, Space to drop and Escape to cancel.
      </p>
      <p className={styles.srOnly} aria-live="assertive" aria-atomic="true">{message}</p>
    </div>
  );
}

interface RowProps {
  segment: Segment;
  index: number;
  count: number;
  start: number;
  params: Params;
  transition: Transition;
  lift: number;
  grabbed: boolean;
  dragging: boolean;
  helpId: string;
  onKey: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onBlurHandle: () => void;
  onPress: () => void;
  onToggle: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function Row({ segment: s, index, count, start, params, transition, lift, grabbed, dragging, helpId, onKey, onBlurHandle, onPress, onToggle, onDragStart, onDragEnd }: RowProps) {
  const controls = useDragControls();
  const fromRow = params.dragFrom === 'row';
  return (
    <Reorder.Item
      as="li"
      value={s}
      // The handle button is the keyboard control, so the row itself is not a tab stop.
      tabIndex={undefined}
      dragListener={fromRow}
      dragControls={controls}
      className={styles.row}
      data-lifted={grabbed || dragging || undefined}
      data-from-row={fromRow || undefined}
      transition={transition}
      animate={{ scale: grabbed ? lift : 1 }}
      whileDrag={{ scale: lift }}
      onPointerDownCapture={onPress}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <span className={styles.shadow} aria-hidden="true" />
      <button
        type="button"
        className={styles.handle}
        aria-label={`Move ${s.title}, position ${index + 1} of ${count}`}
        aria-describedby={helpId}
        aria-pressed={grabbed}
        onPointerDown={(e: PointerEvent<HTMLButtonElement>) => { if (!fromRow) controls.start(e); }}
        onKeyDown={onKey}
        // Screen readers may activate without key events: a click with no pointer (detail 0) toggles too.
        onClick={(e) => { if (e.detail === 0) onToggle(); }}
        onBlur={onBlurHandle}
      >
        <Grip />
      </button>
      {params.times ? <span className={styles.time}>{clock(start)}</span> : null}
      <span className={styles.text}>
        <span className={styles.segTitle}>{s.title}</span>
        <span className={styles.detail}>{s.detail}</span>
      </span>
      <span className={styles.minutes}>{s.minutes} min</span>
    </Reorder.Item>
  );
}

function Grip() {
  return (
    <svg viewBox="0 0 12 18" width="12" height="18" aria-hidden="true" focusable="false">
      {[3, 9, 15].flatMap((y) => [3, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />))}
    </svg>
  );
}
