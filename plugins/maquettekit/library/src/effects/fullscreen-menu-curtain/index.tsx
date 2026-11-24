'use client';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { links: string; origin: string; tone: string; duration: number; stagger: number };

export default function FullscreenMenuCurtain({ params }: EffectProps<Params>) {
  const { reduced, scale } = useStudioMotion();
  const navId = useId();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);

  const links = useMemo(() => {
    const l = params.links.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6);
    return l.length ? l : ['Home'];
  }, [params.links]);
  const origin = params.origin === 'top' || params.origin === 'side' ? params.origin : 'button';
  const tone = params.tone === 'signal' || params.tone === 'paper' ? params.tone : 'ink';

  // Focus follows state: into the menu on open, back to the button on close.
  useEffect(() => {
    if (open) nav.current?.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true });
    else if (wasOpen.current && root.current?.contains(document.activeElement)) button.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); button.current?.focus({ preventScroll: true }); return; }
    if (e.key !== 'Tab') return;
    // Focus loop: close button ↔ links (the page behind is inert).
    const items = Array.from(nav.current?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
    const first = button.current;
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  };

  const vars = {
    '--fm-duration': `${Math.round(params.duration * scale.duration)}ms`,
    '--fm-stagger': `${Math.round(params.stagger * scale.stagger)}ms`,
  } as CSSProperties;

  return (
    <div ref={root} className={styles.root} style={vars} data-open={open || undefined} data-origin={origin} data-tone={tone} data-reduced={reduced || undefined} onKeyDown={onKeyDown}>
      <header className={styles.bar}>
        <span className={styles.brand}>Halden <span className={styles.brandMark} aria-hidden="true" /> Vey <span className={styles.brandNote}>sample site</span></span>
        <button ref={button} type="button" className={styles.toggle} aria-expanded={open} aria-controls={navId} onClick={() => setOpen((o) => !o)}>
          <span className={styles.toggleLabel}>
            <span data-show={!open || undefined} aria-hidden={open}>Menu</span>
            <span data-show={open || undefined} aria-hidden={!open}>Close</span>
          </span>
          <span className={styles.icon} aria-hidden="true"><span /><span /></span>
        </button>
      </header>

      <div className={styles.page} inert={open}>
        <p className={styles.kicker}>{links[current] ?? links[0]} — issue 12</p>
        <p className={styles.headline}>Quiet interfaces for loud ideas.</p>
        <p className={styles.body}>A fictional studio page that sits behind the menu. Open the menu to see it covered, then pick a link.</p>
      </div>

      <nav ref={nav} id={navId} className={styles.curtain} aria-label="Main (sample)" inert={!open}>
        <ol className={styles.list}>
          {links.map((label, i) => (
            <li key={`${label}-${i}`} className={styles.row} style={{ '--i': i } as CSSProperties}>
              <a
                href={`#${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                className={styles.link}
                aria-current={i === current ? 'page' : undefined}
                onClick={(e) => { e.preventDefault(); setCurrent(i); setOpen(false); }}
              >
                <span className={styles.num} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.mask}><span className={styles.word}>{label}</span></span>
                {i === current ? <span className={styles.here}>You are here</span> : null}
              </a>
            </li>
          ))}
        </ol>
        <p className={styles.foot}><span>hello@haldenvey.example</span><span>Esc to close</span></p>
      </nav>
    </div>
  );
}
