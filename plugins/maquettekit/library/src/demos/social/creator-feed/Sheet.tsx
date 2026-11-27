'use client';
/**
 * A modal sheet contained in the demo (no top layer, no position: fixed): a layer covers the demo and the panel
 * is `position: sticky`, so it sits at the bottom of the viewport on phones and as a right-hand drawer below the
 * gallery bar on wide containers. The caller makes the page behind it `inert`; the sheet moves focus in, keeps Tab
 * inside it, closes on Esc or the scrim, and gives focus back to the control that opened it.
 *
 * Drag to dismiss: the head (with its grabber) follows the pointer along the sheet's own axis — down for the bottom
 * sheet, right for the drawer — with rubber-band resistance the other way, and the scrim fades with the distance.
 * Release past 30 % of the sheet or faster than 0.5 px/ms closes it at the speed of the throw; anything less springs
 * back on the `settle` spring. The Close button, Esc and the scrim do the same without a gesture.
 */
import { useCallback, useEffect, useId, useRef, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { duration as D, easing, spring, springToLinear, useStudioMotion } from '../../../motion';
import styles from './styles.module.css';

const SETTLE = springToLinear(spring.settle);
const FOCUSABLE = 'button:not([disabled]), a[href], textarea:not([disabled]), input:not([disabled]), [tabindex="0"]';
const ease = (b: readonly number[]) => `cubic-bezier(${b.join(', ')})`;

interface Drag { id: number; x: number; y: number; axis: 'x' | 'y'; size: number; offset: number; samples: { d: number; t: number }[] }

export function Sheet({ title, kicker, onClose, children, footer, returnTo }: {
  /** The control that opened the sheet (captured before the page became inert); focus returns to it on close. */
  returnTo: RefObject<HTMLElement | null>;
  title: string;
  kicker?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { reduced } = useStudioMotion();
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const anim = useRef<Animation | null>(null);
  const drag = useRef<Drag | null>(null);
  const titleId = useId();

  useEffect(() => {
    const el = panel.current;
    closing.current = false;
    el?.focus({ preventScroll: true });
    if (el && typeof el.animate === 'function') {
      const axis = getComputedStyle(el).getPropertyValue('--sheet-axis').trim() === 'x' ? 'X' : 'Y';
      anim.current = reduced
        ? el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: D.fast, easing: 'linear' })
        : el.animate([{ transform: `translate${axis}(48px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: SETTLE.duration, easing: SETTLE.easing });
    }
    return () => {
      anim.current?.cancel();
      anim.current = null;
      const opener = returnTo.current;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [reduced, returnTo]);

  /** Close from wherever the panel is now (mid-drag included); a throw keeps its speed. */
  const close = useCallback((velocity = 0) => {
    const el = panel.current;
    if (closing.current) return;
    closing.current = true;
    if (!el || typeof el.animate !== 'function') { onClose(); return; }
    const axis = getComputedStyle(el).getPropertyValue('--sheet-axis').trim() === 'x' ? 'x' : 'y';
    const size = axis === 'y' ? el.offsetHeight : el.offsetWidth;
    const from = el.style.transform || 'none';
    const at = drag.current?.offset ?? 0;
    el.style.transform = '';
    anim.current?.cancel();
    const fade = scrim.current;
    if (reduced) {
      anim.current = el.animate([{ transform: from, opacity: 1 }, { transform: from, opacity: 0 }], { duration: D.fast, easing: 'linear', fill: 'forwards' });
    } else {
      // Keep the throw's speed: the remaining distance at the release velocity, clamped to the token range.
      const rest = Math.max(0, size - at);
      const ms = velocity > 0.2 ? Math.max(D.fast, Math.min(D.moderate, rest / velocity)) : D.base;
      anim.current = el.animate([{ transform: from }, { transform: `translate${axis.toUpperCase()}(${size + 24}px)` }], { duration: ms, easing: velocity > 0.2 ? ease(easing.standard) : ease(easing.exit), fill: 'forwards' });
      if (fade) fade.animate([{ opacity: fade.style.opacity || '1' }, { opacity: 0 }], { duration: ms, easing: 'linear', fill: 'forwards' });
    }
    anim.current.finished.then(onClose, () => {});
  }, [onClose, reduced]);

  // Esc also works if focus has left the sheet (e.g. a control inside it was removed).
  useEffect(() => {
    const onDocKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) close(); };
    document.addEventListener('keydown', onDocKey);
    return () => document.removeEventListener('keydown', onDocKey);
  }, [close]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab' || !panel.current) return;
    // Keep Tab inside the sheet: wrap from the last control to the first and back.
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1], at = document.activeElement;
    if (e.shiftKey && (at === first || at === panel.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
  };

  // ── drag to dismiss ──
  const onHeadDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = panel.current;
    if (!el || closing.current || e.button !== 0 || (e.target as Element).closest('button, a, input, textarea')) return;
    const axis = getComputedStyle(el).getPropertyValue('--sheet-axis').trim() === 'x' ? 'x' : 'y';
    anim.current?.cancel();
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis, size: axis === 'y' ? el.offsetHeight : el.offsetWidth, offset: 0, samples: [{ d: 0, t: e.timeStamp }] };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    el.dataset.dragging = '';
  };
  const onHeadMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = panel.current;
    if (!d || d.id !== e.pointerId || !el) return;
    const raw = d.axis === 'y' ? e.clientY - d.y : e.clientX - d.x;
    // Free travel towards dismissal; the other way resists more the further it goes.
    const offset = raw >= 0 ? raw : -Math.sqrt(-raw) * 3;
    d.offset = offset;
    d.samples.push({ d: raw, t: e.timeStamp });
    if (d.samples.length > 6) d.samples.shift();
    el.style.transform = d.axis === 'y' ? `translateY(${offset}px)` : `translateX(${offset}px)`;
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, Math.min(1, 1 - Math.max(0, offset) / d.size)));
  };
  const onHeadUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = panel.current;
    if (!d || d.id !== e.pointerId || !el) return;
    delete el.dataset.dragging;
    const a = d.samples[0], b = d.samples[d.samples.length - 1];
    const v = b.t > a.t ? (b.d - a.d) / (b.t - a.t) : 0; // px/ms, + = towards dismissal
    if (d.offset > d.size * 0.3 || (v > 0.5 && d.offset > 8)) { close(v); drag.current = null; return; }
    drag.current = null;
    const from = el.style.transform || 'none';
    el.style.transform = '';
    if (scrim.current) {
      const s = scrim.current;
      const o = s.style.opacity || '1';
      s.style.opacity = '';
      if (!reduced) s.animate([{ opacity: o }, { opacity: 1 }], { duration: SETTLE.duration, easing: SETTLE.easing });
    }
    if (!reduced && from !== 'none') anim.current = el.animate([{ transform: from }, { transform: 'none' }], { duration: SETTLE.duration, easing: SETTLE.easing });
  };

  return (
    <div className={styles.sheetLayer} onKeyDown={onKey}>
      <div ref={scrim} className={styles.sheetScrim} onClick={() => close()} aria-hidden="true" />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={styles.sheetPanel}>
        <div className={styles.sheetHead} onPointerDown={onHeadDown} onPointerMove={onHeadMove} onPointerUp={onHeadUp} onPointerCancel={onHeadUp}>
          <span className={styles.grabber} aria-hidden="true" />
          <div>
            {kicker ? <p className={`mk-label ${styles.muted}`}>{kicker}</p> : null}
            <h2 id={titleId} className={styles.sheetTitle}>{title}</h2>
          </div>
          <button type="button" className={styles.iconBtn} onClick={() => close()}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>
            <span className="mk-sr-only">Close</span>
          </button>
        </div>
        <div className={styles.sheetBody}>{children}</div>
        {footer ? <div className={styles.sheetFoot}>{footer}</div> : null}
      </div>
    </div>
  );
}
