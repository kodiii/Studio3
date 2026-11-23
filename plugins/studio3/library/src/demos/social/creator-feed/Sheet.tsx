'use client';
/**
 * A modal sheet contained in the demo (no top layer, no position: fixed): a layer covers the demo and the panel
 * is `position: sticky`, so it sits at the bottom of the viewport on phones and as a right-hand drawer below the
 * gallery bar on wide containers. The caller makes the page behind it `inert`; the sheet moves focus in, keeps Tab
 * inside it, closes on Esc or the scrim, and gives focus back to the control that opened it.
 */
import { useCallback, useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { duration as D, spring, springToLinear, useStudioMotion } from '../../../motion';
import styles from './styles.module.css';

const SETTLE = springToLinear(spring.settle);
const FOCUSABLE = 'button:not([disabled]), a[href], textarea:not([disabled]), input:not([disabled]), [tabindex="0"]';

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
  const closing = useRef(false);
  const anim = useRef<Animation | null>(null);
  const titleId = useId();

  useEffect(() => {
    const el = panel.current;
    closing.current = false;
    el?.focus({ preventScroll: true });
    if (el && typeof el.animate === 'function') {
      anim.current = reduced
        ? el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: D.fast, easing: 'linear' })
        : el.animate([{ transform: 'translateY(48px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: SETTLE.duration, easing: SETTLE.easing });
    }
    return () => {
      anim.current?.cancel();
      anim.current = null;
      const opener = returnTo.current;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [reduced, returnTo]);

  const close = useCallback(() => {
    const el = panel.current;
    if (closing.current) return;
    closing.current = true;
    if (!el || typeof el.animate !== 'function') { onClose(); return; }
    anim.current?.cancel();
    const a = el.animate(reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: 'none', opacity: 1 }, { transform: 'translateY(32px)', opacity: 0 }], { duration: D.fast, easing: 'cubic-bezier(0.3, 0, 0.8, 0.15)', fill: 'forwards' });
    anim.current = a;
    a.finished.then(onClose, () => {});
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

  return (
    <div className={styles.sheetLayer} onKeyDown={onKey}>
      <div className={styles.sheetScrim} onClick={close} aria-hidden="true" />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={styles.sheetPanel}>
        <div className={styles.sheetHead}>
          <div>
            {kicker ? <p className={`s3-label ${styles.muted}`}>{kicker}</p> : null}
            <h2 id={titleId} className={styles.sheetTitle}>{title}</h2>
          </div>
          <button type="button" className={styles.iconBtn} onClick={close}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>
            <span className="s3-sr-only">Close</span>
          </button>
        </div>
        <div className={styles.sheetBody}>{children}</div>
        {footer ? <div className={styles.sheetFoot}>{footer}</div> : null}
      </div>
    </div>
  );
}
