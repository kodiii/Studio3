'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { gsapEase, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

type Params = { cards: number; scrub: number; snap: boolean; distance: number };

/* Sample content: a fictional set of weather plates, drawn on a 160×160 grid. */
const PLATES: readonly { title: string; note: string; art: ReactNode }[] = [
  { title: 'Clear', note: 'Still air, long shadows', art: <><circle className={styles.hot} cx="80" cy="74" r="30" /><path d="M20 126h120" /></> },
  { title: 'Haze', note: 'Edges go first', art: <><circle cx="80" cy="66" r="30" /><path d="M24 82h112M36 96h88M24 110h112M48 124h64" /></> },
  { title: 'Drizzle', note: 'Too fine to hear', art: <><path d="M40 62a22 22 0 0 1 42-8a17 17 0 0 1 30 8z" /><path d="M48 80l-6 14M68 80l-6 14M88 80l-6 14M108 80l-6 14M58 104l-6 14M78 104l-6 14M98 104l-6 14" /><circle className={styles.hot} cx="118" cy="118" r="5" /></> },
  { title: 'Gale', note: 'Everything leans east', art: <><path d="M20 58h74a13 13 0 1 0-13-13M20 82h100a13 13 0 1 1-13 13M20 106h54a11 11 0 1 1-11 11" /><circle className={styles.hot} cx="128" cy="52" r="5" /></> },
  { title: 'Frost', note: 'A morning that rings', art: <><path d="M80 30v100M36.7 55l86.6 50M36.7 105l86.6-50" /><path d="M80 46l-9-9M80 46l9-9M80 114l-9 9M80 114l9 9" /><circle className={styles.hot} cx="80" cy="80" r="7" /></> },
  { title: 'Thunder', note: 'Count the seconds', art: <><path d="M34 70a24 24 0 0 1 46-9a19 19 0 0 1 36 9z" /><path className={styles.hot} d="M84 76l-22 30h16l-8 26l26-34H80z" /></> },
  { title: 'Dusk', note: 'Colour without a source', art: <><path d="M20 104h120M36 118h88M52 132h56" /><path className={styles.hot} d="M50 104a30 30 0 0 1 60 0z" /><path d="M80 58v-14M46 70l-10-10M114 70l10-10" /></> },
  { title: 'Tide', note: 'The slowest weather', art: <><circle cx="108" cy="50" r="14" /><path d="M20 88q15-12 30 0t30 0t30 0t30 0M20 106q15-12 30 0t30 0t30 0t30 0M20 124q15-12 30 0t30 0t30 0t30 0" /><circle className={styles.hot} cx="42" cy="56" r="5" /></> },
];

const pad = (n: number): string => String(n).padStart(2, '0');

export default function HorizontalScrollGallery({ params }: EffectProps<Params>) {
  const root = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLUListElement>(null);
  const live = useRef<{ st: ScrollTrigger; points: number[] } | null>(null);
  const { reduced } = useStudioMotion();
  const [index, setIndex] = useState(0);
  const [pinned, setPinned] = useState<ReadonlySet<number>>(new Set());
  const [layoutKey, setLayoutKey] = useState(0);

  const count = Math.min(PLATES.length, Math.max(4, Math.round(params.cards)));
  const plates = PLATES.slice(0, count);

  // Rebuild the timeline when the container width changes (the preview stage resizes without a window resize).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== w) { w = el.clientWidth; setLayoutKey((k) => k + 1); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useGSAP(
    () => {
      const scroller = scrollerRef.current;
      const track = trackRef.current;
      const pin = pinRef.current;
      const rail = railRef.current;
      if (!scroller || !track || !pin || !rail || reduced) return;
      const maxX = Math.max(0, rail.scrollWidth - pin.clientWidth);
      if (maxX === 0) return;
      const inset = parseFloat(getComputedStyle(rail).paddingInlineStart) || 0;
      // Progress at which each card sits at the leading edge (clamped at the end of the track).
      const points = Array.from(rail.children, (li) => Math.min(1, Math.max(0, ((li as HTMLElement).offsetLeft - inset) / maxX)));

      // Vertical distance to scroll = horizontal distance to travel × the "scroll length" param.
      gsap.set(track, { height: scroller.clientHeight + maxX * params.distance });

      const tl = gsap.timeline({
        defaults: { ease: 'none', duration: 1 },
        scrollTrigger: {
          trigger: track,
          scroller,
          start: 'top top',
          end: 'bottom bottom',
          scrub: params.scrub > 0 ? params.scrub : true,
          snap: params.snap ? { snapTo: points, duration: { min: 0.15, max: 0.45 }, delay: 0.1, ease: gsapEase.inOut, inertia: false } : undefined,
          onUpdate: (self) => {
            let best = 0;
            points.forEach((p, i) => { if (Math.abs(p - self.progress) < Math.abs(points[best] - self.progress) - 1e-4) best = i; });
            setIndex((prev) => (prev === best ? prev : best));
          },
        },
      });
      tl.to(rail, { x: -maxX }, 0).fromTo('[data-progress]', { scaleX: 0 }, { scaleX: 1 }, 0);
      if (tl.scrollTrigger) live.current = { st: tl.scrollTrigger, points };
      return () => { live.current = null; };
    },
    { scope: root, dependencies: [reduced, count, params.scrub, params.snap, params.distance, layoutKey], revertOnUpdate: true },
  );

  // Reduced motion: the counter follows the native horizontal scroll position.
  useEffect(() => {
    const rail = railRef.current;
    if (!reduced || !rail) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const first = rail.children[0] as HTMLElement | undefined;
      const step = first ? first.offsetWidth + (parseFloat(getComputedStyle(rail).columnGap) || 0) : 1;
      setIndex(Math.min(count - 1, Math.round(rail.scrollLeft / step)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    rail.addEventListener('scroll', onScroll, { passive: true });
    return () => { rail.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [reduced, count]);

  // Keyboard path: when focus lands on a card, scroll the container to where that card is in view.
  const reveal = (i: number, card: HTMLElement): void => {
    const scroller = scrollerRef.current;
    const pin = pinRef.current;
    const l = live.current;
    if (!scroller || !pin || !l) return; // reduced: native overflow handles focus scrolling
    scroller.scrollLeft = 0;
    const c = card.getBoundingClientRect();
    const p = pin.getBoundingClientRect();
    const visible = c.left >= p.left - 1 && c.right <= p.right + 1 && Math.abs(p.top - scroller.getBoundingClientRect().top) < 2;
    if (visible) return;
    scroller.scrollTo({ top: l.st.start + (l.st.end - l.st.start) * l.points[i], behavior: 'smooth' });
  };

  const toggle = (i: number): void => setPinned((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  return (
    <div ref={root} className={styles.root} data-mode={reduced ? 'native' : 'pinned'}>
      <div ref={scrollerRef} className={styles.scroller} tabIndex={0} role="region" aria-label="Small weather, a gallery of plates — scroll down to move through it">
        <header className={styles.intro}>
          <p className={styles.label}>Atlas · sample content</p>
          <h2 className={styles.heading}>Small weather</h2>
          <p className={styles.hint}>{reduced ? 'Swipe or tab through the plates' : <><span aria-hidden="true">↓</span> Scroll down — the plates travel sideways</>}</p>
        </header>

        <div ref={trackRef} className={styles.track}>
          <div ref={pinRef} className={styles.pin}>
            <div className={styles.bar}>
              <p className={styles.label}>{count} plates{pinned.size > 0 ? ` · ${pinned.size} pinned` : ''}</p>
              <p className={styles.counter}><span className={styles.now}>{pad(index + 1)}</span> / {pad(count)}</p>
            </div>
            <ul ref={railRef} className={styles.rail}>
              {plates.map((p, i) => (
                <li key={p.title} className={styles.item}>
                  <button type="button" className={styles.card} aria-pressed={pinned.has(i)} onClick={() => toggle(i)} onFocus={(e) => reveal(i, e.currentTarget)}>
                    <span className={styles.plate} aria-hidden="true">
                      <svg viewBox="0 0 160 160" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" focusable="false">{p.art}</svg>
                    </span>
                    <span className={styles.meta}>
                      <span className={styles.no}>No. {pad(i + 1)}</span>
                      <span className={styles.pinMark}>{pinned.has(i) ? 'Pinned' : 'Pin'}</span>
                    </span>
                    <span className={styles.title}>{p.title}</span>
                    <span className={styles.note}>{p.note}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className={styles.progress} aria-hidden="true"><span data-progress /></div>
          </div>
        </div>

        <footer className={styles.outro}>
          <p className={styles.label}>End of atlas</p>
          <p className={styles.outroText}>The track releases and vertical scrolling resumes.</p>
        </footer>
      </div>
    </div>
  );
}
