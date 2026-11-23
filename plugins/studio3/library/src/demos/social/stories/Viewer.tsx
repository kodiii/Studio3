'use client';
/**
 * Full-screen stories viewer, contained in the demo (a sticky panel under the gallery bar, never position: fixed).
 *
 * Clock: the current progress segment's WAAPI fill IS the timer (the story-progress-segments recipe's technique) —
 * pausing the animation pauses the story, its finish advances it. It pauses for the Pause button, a held press,
 * reply focus and a hidden tab; under reduced motion there is no clock at all and nothing advances by itself.
 *
 * Every gesture has a twin: tap left/right = Previous/Next card buttons and ←/→; swipe sideways = account buttons
 * and Shift+←/→; swipe down = Close and Esc; hold = Pause and Space.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { duration as D, spring, springToLinear, useStudioMotion } from '../../../motion';
import { CardArt, FlagMark } from './art';
import { CREATORS, SEGMENT_MS } from './data';
import styles from './styles.module.css';

const TAP_MS = 250;
const SETTLE = springToLinear(spring.settle);
type How = 'auto' | 'manual';

export function Viewer({ start, onClose, onSeen }: { start: number; onClose: () => void; onSeen: (creatorId: string, card: number) => void }) {
  const { reduced } = useStudioMotion();
  const auto = !reduced;
  const [ci, setCi] = useState(start);
  const [si, setSi] = useState(0);
  const [epoch, setEpoch] = useState(0); // restarts the current card's clock
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [typing, setTyping] = useState(false);
  const [hiddenTab, setHiddenTab] = useState(false);
  const [ended, setEnded] = useState(false);
  const [reply, setReply] = useState('');
  const [sent, setSent] = useState('');
  const [say, setSay] = useState('');
  const creator = CREATORS[ci];
  const seg = creator.segments[si];
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const clock = useRef<Animation | null>(null);
  const media = useRef<HTMLDivElement>(null);
  const pauseBtn = useRef<HTMLButtonElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const endHead = useRef<HTMLHeadingElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; t: number; w: number; h: number; mode: 'none' | 'x' | 'y' } | null>(null);
  const enter = useRef<{ dir: 1 | -1 } | null>(null);
  const manual = useRef(false);
  const anims = useRef(new Set<Animation>());
  const running = auto && !ended && !paused && !holding && !typing && !hiddenTab;

  const track = (a: Animation) => { anims.current.add(a); const done = () => anims.current.delete(a); a.finished.then(done, done); return a; };
  useEffect(() => { const set = anims.current; return () => { set.forEach((a) => a.cancel()); set.clear(); }; }, []);

  // ── navigation ──
  const toCreator = useCallback((next: number, dir: 1 | -1, how: How, card = 0) => {
    if (next >= CREATORS.length) { setEnded(true); return; }
    if (next < 0) { setSi(0); setEpoch((e) => e + 1); return; }
    manual.current = how === 'manual';
    enter.current = { dir };
    setEnded(false); setCi(next); setSi(card); setEpoch((e) => e + 1);
  }, []);
  const nextCard = useCallback((how: How) => {
    manual.current = how === 'manual';
    if (si + 1 < creator.segments.length) setSi(si + 1);
    else toCreator(ci + 1, 1, how);
  }, [si, ci, creator.segments.length, toCreator]);
  const prevCard = useCallback(() => {
    manual.current = true;
    if (si > 0) setSi(si - 1);
    else if (ci > 0) toCreator(ci - 1, -1, 'manual', CREATORS[ci - 1].segments.length - 1);
    else setEpoch((e) => e + 1);
  }, [si, ci, toCreator]);
  const nextRef = useRef(nextCard);
  nextRef.current = nextCard;

  // ── the clock ──
  useLayoutEffect(() => {
    clock.current = null;
    const el = fills.current[si];
    if (!auto || ended || !el || typeof el.animate !== 'function') return;
    const a = el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: SEGMENT_MS, easing: 'linear', fill: 'forwards' });
    clock.current = a;
    a.onfinish = () => { if (clock.current === a) nextRef.current('auto'); };
    return () => { a.onfinish = null; a.cancel(); };
  }, [ci, si, epoch, auto, ended]);
  useEffect(() => {
    const a = clock.current;
    if (!a) return;
    if (running) { if (a.playState === 'paused') a.play(); }
    else if (a.playState === 'running') a.pause();
  }, [running, ci, si, epoch]);

  useEffect(() => {
    const on = () => setHiddenTab(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  // Pause is first in the focus order; with no clock (reduced motion) there is nothing to pause, so Next card leads.
  useEffect(() => { (pauseBtn.current ?? nextBtn.current)?.focus({ preventScroll: true }); }, []);
  useEffect(() => { if (ended) endHead.current?.focus(); }, [ended]);

  // Seen state, announcements (manual moves only), and the entrance of a new account's card.
  useEffect(() => {
    if (ended) return;
    onSeen(creator.id, si);
    if (manual.current) setSay(`Card ${si + 1} of ${creator.segments.length} from ${creator.name}, ${creator.ago} ago.`);
    manual.current = false;
  }, [ci, si, ended]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = media.current;
    const e = enter.current;
    enter.current = null;
    if (!el) return;
    el.style.transform = '';
    if (!e || typeof el.animate !== 'function') return;
    track(reduced
      ? el.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: D.fast, easing: 'linear' })
      : el.animate([{ transform: `translateX(${e.dir * 28}%)`, opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: D.moderate, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }));
  }, [ci]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── gestures ──
  const springBack = () => {
    const el = media.current;
    if (!el) return;
    const from = el.style.transform;
    el.style.transform = '';
    if (!from || reduced || typeof el.animate !== 'function') return;
    track(el.animate([{ transform: from }, { transform: 'none' }], { duration: SETTLE.duration, easing: SETTLE.easing }));
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || ended || (e.target as Element).closest('button, input, a')) return;
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), w: r.width, h: r.height, mode: 'none' };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setHolding(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = media.current;
    if (!d || d.id !== e.pointerId || !el) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (d.mode === 'none') {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) d.mode = 'x';
      else if (dy > 12 && dy > Math.abs(dx)) d.mode = 'y';
    }
    // The card follows the finger 1:1 (direct manipulation is kept under reduced motion), with resistance at the ends.
    if (d.mode === 'x') {
      const edge = (dx > 0 && ci === 0) || (dx < 0 && ci === CREATORS.length - 1);
      el.style.transform = `translateX(${edge ? dx * 0.3 : dx}px)`;
    } else if (d.mode === 'y') {
      el.style.transform = `translateY(${Math.max(0, dy)}px) scale(${1 - Math.min(0.12, (dy / d.h) * 0.25)})`;
    }
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setHolding(false);
    const dt = Math.max(1, performance.now() - d.t);
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (d.mode === 'x') {
      const go = Math.abs(dx) > d.w * 0.3 || Math.abs(dx / dt) > 0.5;
      if (go && dx < 0 && ci < CREATORS.length - 1) toCreator(ci + 1, 1, 'manual');
      else if (go && dx > 0 && ci > 0) toCreator(ci - 1, -1, 'manual');
      else springBack();
      return;
    }
    if (d.mode === 'y') { if (dy > d.h * 0.22 || dy / dt > 0.5) onClose(); else springBack(); return; }
    if (dt < TAP_MS) {
      const r = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - r.left;
      const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
      const back = rtl ? x > r.width * 0.7 : x < r.width * 0.3;
      if (back) prevCard(); else nextCard('manual');
    }
  };
  const onPointerCancel = () => { drag.current = null; setHolding(false); springBack(); };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (t.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); if (e.shiftKey) toCreator(ci + 1, 1, 'manual'); else if (!ended) nextCard('manual'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (ended) { setEnded(false); return; } if (e.shiftKey) toCreator(ci - 1, -1, 'manual'); else prevCard(); }
    else if (e.key === ' ' && !t.closest('button, a')) { e.preventDefault(); setPaused((p) => !p); }
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = reply.trim();
    if (!text) return;
    setReply('');
    setSent(`Sent privately to ${creator.name}. Demo: nothing leaves this page.`);
  };

  const prevName = ci > 0 ? CREATORS[ci - 1].name : null;
  const nextName = ci < CREATORS.length - 1 ? CREATORS[ci + 1].name : null;
  const state = ended ? 'End of stories' : !auto ? 'Moves only when you tap' : paused ? 'Paused' : holding ? 'Held' : typing ? 'Paused while you reply' : 'Playing';

  return (
    <div className={styles.viewerLayer}>
      <div className={styles.viewerPanel} role="dialog" aria-modal="true" aria-label={`Stories from Port Ellery — ${creator.name}`} onKeyDown={onKey}>
        <button type="button" className={`${styles.sideBtn} ${styles.sidePrev}`} onClick={() => toCreator(ci - 1, -1, 'manual')} disabled={!prevName}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" /></svg>
          <span className="s3-sr-only">Previous account{prevName ? `: ${prevName}` : ''}</span>
        </button>
        <div className={styles.phone}>
          <div className={styles.top}>
            <div className={styles.segments} aria-hidden="true">
              {creator.segments.map((s, i) => (
                <span key={s.id} className={styles.seg} data-state={ended || i < si ? 'done' : i === si ? (auto ? 'current' : 'done') : 'next'}>
                  <span ref={(el) => { fills.current[i] = el; }} className={styles.segFill} />
                </span>
              ))}
            </div>
            <div className={styles.head}>
              <FlagMark flag={creator.flag} className={styles.headFlag} />
              <p className={styles.headName}><span>{creator.name}</span><span className={styles.headTime}><time dateTime={creator.iso}>{creator.ago}</time> · {state}</span></p>
              {auto ? (
                <button ref={pauseBtn} type="button" className={styles.headBtn} aria-pressed={paused} onClick={() => setPaused((p) => !p)} disabled={ended}>
                  {paused
                    ? <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.500v13l10-6.500z" className={styles.solid} /></svg>
                    : <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6v12M15 6v12" /></svg>}
                  <span className="s3-sr-only">Pause stories</span>
                </button>
              ) : null}
              <button type="button" className={styles.headBtn} onClick={onClose}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>
                <span className="s3-sr-only">Close stories</span>
              </button>
            </div>
          </div>

          <div className={styles.stage} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
            <div ref={media} className={styles.card} data-field={seg.field}>
              {ended ? (
                <div className={styles.endCard}>
                  <h2 ref={endHead} tabIndex={-1} className={styles.endTitle}>You’re all caught up</h2>
                  <p>That’s every story Port Ellery posted in the last 24 hours. Nothing plays after this.</p>
                  <div className={styles.endActions}>
                    <button type="button" className={styles.lightBtn} onClick={() => { setEnded(false); toCreator(0, 1, 'manual'); }}>Watch again</button>
                    <button type="button" className={styles.lightBtn} onClick={onClose}>Close</button>
                  </div>
                </div>
              ) : (
                <section key={seg.id} className={styles.cardBody} role="group" aria-roledescription="story card"
                  aria-label={`Card ${si + 1} of ${creator.segments.length} from ${creator.name}, ${creator.ago} ago`}>
                  {seg.art ? <div className={styles.cardArt} role="img" aria-label={seg.artAlt}><CardArt art={seg.art} /></div> : null}
                  <p className={styles.cardKicker}>{seg.kicker}</p>
                  <p className={styles.cardBig}>{seg.big}</p>
                  <p className={styles.cardText}>{seg.body}</p>
                </section>
              )}
            </div>
            {ended ? null : (
              <>
                <button type="button" className={`${styles.cardBtn} ${styles.cardPrev}`} onClick={prevCard}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" /></svg><span className="s3-sr-only">Previous card</span>
                </button>
                <button ref={nextBtn} type="button" className={`${styles.cardBtn} ${styles.cardNext}`} onClick={() => nextCard('manual')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" /></svg><span className="s3-sr-only">Next card</span>
                </button>
              </>
            )}
          </div>

          <div className={styles.bottom}>
            {ended ? null : (
              <form className={styles.reply} onSubmit={send}>
                <label htmlFor="pe-reply" className="s3-sr-only">Reply privately to {creator.name}</label>
                <input id="pe-reply" className={styles.replyInput} value={reply} placeholder={`Reply to ${creator.name}…`} autoComplete="off"
                  onChange={(e) => setReply(e.target.value)} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} />
                <button type="submit" className={styles.sendBtn} disabled={!reply.trim()}>Send</button>
              </form>
            )}
            <p className={styles.sent} aria-live="polite">{sent}</p>
            <div className={styles.accounts}>
              <button type="button" className={styles.accountBtn} onClick={() => toCreator(ci - 1, -1, 'manual')} disabled={!prevName}>
                <span aria-hidden="true">‹</span> {prevName ?? 'First account'}
              </button>
              <button type="button" className={styles.accountBtn} onClick={() => toCreator(ci + 1, 1, 'manual')}>
                {nextName ?? 'Finish'} <span aria-hidden="true">›</span>
              </button>
            </div>
          </div>
        </div>
        <button type="button" className={`${styles.sideBtn} ${styles.sideNext}`} onClick={() => toCreator(ci + 1, 1, 'manual')}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" /></svg>
          <span className="s3-sr-only">{nextName ? `Next account: ${nextName}` : 'Finish stories'}</span>
        </button>
        <p className="s3-sr-only" aria-live="polite">{say}</p>
      </div>
    </div>
  );
}
