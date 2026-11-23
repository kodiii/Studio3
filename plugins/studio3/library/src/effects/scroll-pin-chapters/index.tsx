'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { gsapEase, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

type Params = { chapters: number; transition: string; scrub: number; snap: boolean };

interface Chapter { title: string; body: string; art: ReactNode }

/* Sample content: a fictional pottery process. Line art is drawn on a 200×200 grid. */
const CHAPTERS: readonly Chapter[] = [
  {
    title: 'Wedge',
    body: 'Clay is cut, folded and pressed until it is one even body. Trapped air is the enemy of everything that follows.',
    art: (
      <>
        <path d="M24 156h152" />
        <ellipse cx="100" cy="118" rx="66" ry="38" />
        <path d="M100 118a6 4 0 0 1 12 0a12 8 0 0 1-24 0a18 12 0 0 1 36 0a24 16 0 0 1-48 0a30 20 0 0 1 60 0" />
        <circle className={styles.mark} cx="150" cy="58" r="7" />
      </>
    ),
  },
  {
    title: 'Throw',
    body: 'On the wheel the lump is centred, opened and pulled upward. Three slow pulls decide the wall and the silhouette.',
    art: (
      <>
        <ellipse cx="100" cy="152" rx="72" ry="14" />
        <ellipse cx="100" cy="152" rx="88" ry="20" strokeDasharray="2 7" />
        <path d="M70 150c-3-34 4-62 12-88h36c8 26 15 54 12 88" />
        <ellipse cx="100" cy="62" rx="18" ry="5" />
        <circle className={styles.mark} cx="100" cy="34" r="7" />
      </>
    ),
  },
  {
    title: 'Trim',
    body: 'Leather-hard, the cup is turned over and a foot is cut. What comes away in ribbons is weight the hand will not miss.',
    art: (
      <>
        <path d="M24 156h152" />
        <path d="M62 156c-4-30 2-58 10-84h56c8 26 14 54 10 84z" />
        <path d="M84 72v-10h32v10" />
        <path d="M150 96c8-2 14 4 11 10s-12 4-10-2M158 122c8-2 14 4 11 10s-12 4-10-2" />
        <path d="M138 70l34-30" />
        <circle className={styles.mark} cx="176" cy="36" r="7" />
      </>
    ),
  },
  {
    title: 'Glaze',
    body: 'A four-second dip. The raw glaze is chalky and dull, and gives no hint of the colour it is carrying into the kiln.',
    art: (
      <>
        <path d="M24 156h152" />
        <path className={styles.fill} d="M61 112h78c2 16 1 30-1 44H62c-2-14-3-28-1-44z" />
        <path d="M62 156c-4-30 2-58 10-84h56c8 26 14 54 10 84z" />
        <ellipse cx="100" cy="72" rx="28" ry="6" />
        <path d="M82 112v10M100 112v16M120 112v8" className={styles.drip} />
      </>
    ),
  },
  {
    title: 'Fire',
    body: 'Twelve hours up, a day and a half down. The door stays shut until the shelves can be touched with a bare hand.',
    art: (
      <>
        <path d="M24 156h152" />
        <path d="M46 156V96a54 54 0 0 1 108 0v60" />
        <path d="M82 156c-2-14 0-26 4-38h28c4 12 6 24 4 38z" />
        <path d="M70 60c6-8-6-12 0-22M100 52c6-8-6-12 0-22M130 60c6-8-6-12 0-22" />
        <circle className={styles.mark} cx="100" cy="100" r="7" />
      </>
    ),
  },
];

const pad = (n: number): string => String(n).padStart(2, '0');

export default function ScrollPinChapters({ params }: EffectProps<Params>) {
  const root = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const { reduced } = useStudioMotion();
  const [active, setActive] = useState(0);

  const count = Math.min(CHAPTERS.length, Math.max(3, Math.round(params.chapters)));
  const chapters = CHAPTERS.slice(0, count);
  const wipe = params.transition === 'wipe';

  useGSAP(
    () => {
      const scroller = scrollerRef.current;
      const track = trackRef.current;
      if (!scroller || !track || reduced) return;
      const els = gsap.utils.toArray<HTMLElement>('[data-chapter]', track);
      const n = els.length;
      const lines = (el: HTMLElement) => el.querySelectorAll<HTMLElement>('[data-line]');
      const art = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-art]');
      const frame = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-frame]');

      // Hidden start states for every chapter after the first.
      els.slice(1).forEach((el) => {
        if (wipe) gsap.set(el, { clipPath: 'inset(100% 0% 0% 0%)' });
        else {
          gsap.set(lines(el), { yPercent: 115 });
          gsap.set(art(el), { scale: 1.08, rotate: 4 });
          gsap.set(frame(el), { opacity: 0 });
        }
      });

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: track,
          scroller,
          start: 'top top',
          end: 'bottom bottom',
          scrub: params.scrub > 0 ? params.scrub : true,
          snap: params.snap ? { snapTo: 1 / (n - 1), duration: { min: 0.15, max: 0.45 }, delay: 0.1, ease: gsapEase.inOut, inertia: false } : undefined,
          onUpdate: (self) => {
            const i = Math.round(self.progress * (n - 1));
            setActive((prev) => (prev === i ? prev : i));
          },
        },
      });

      // One unit of timeline per chapter; each hand-over sits in the middle 60% so chapters rest at the snap points.
      for (let i = 0; i < n - 1; i++) {
        const from = els[i];
        const to = els[i + 1];
        const t = i + 0.2;
        if (wipe) {
          tl.to(to, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: gsapEase.inOut }, t);
          tl.to(from.querySelector('[data-inner]'), { yPercent: -8, opacity: 0.35, duration: 0.6, ease: gsapEase.inOut }, t);
        } else {
          tl.to(lines(from), { yPercent: -115, duration: 0.26, stagger: 0.03, ease: gsapEase.exit }, t);
          tl.to(art(from), { opacity: 0, scale: 0.92, rotate: -4, duration: 0.3, ease: gsapEase.exit }, t);
          tl.to(lines(to), { yPercent: 0, duration: 0.3, stagger: 0.03, ease: gsapEase.enter }, t + 0.26);
          // The incoming frame fades in over the outgoing one, so the frame reads as one persistent object.
          tl.to(frame(to), { opacity: 1, duration: 0.14 }, t + 0.2);
          tl.to(art(to), { scale: 1, rotate: 0, duration: 0.36, ease: gsapEase.enter }, t + 0.24);
        }
      }
      tl.to({}, { duration: 0.2 }); // pad so the last chapter rests exactly at progress 1

      const st = tl.scrollTrigger ?? null;
      trigger.current = st; (window as any).__ST = ScrollTrigger;
      // The preview stage can change size without a window resize.
      let w = scroller.clientWidth;
      const ro = new ResizeObserver(() => {
        if (scroller.clientWidth !== w) { w = scroller.clientWidth; st?.refresh(); }
      });
      ro.observe(scroller);
      return () => { ro.disconnect(); trigger.current = null; };
    },
    { scope: root, dependencies: [reduced, count, wipe, params.scrub, params.snap], revertOnUpdate: true },
  );

  // Reduced motion: sections are stacked, so the active dot follows whichever section crosses the upper third.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!reduced || !scroller || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.chapter));
      },
      { root: scroller, rootMargin: '-35% 0px -64% 0px' },
    );
    scroller.querySelectorAll('[data-chapter]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [reduced, count]);

  const goTo = (i: number): void => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const st = trigger.current;
    if (!reduced && st) {
      scroller.scrollTo({ top: st.start + ((st.end - st.start) * i) / (count - 1), behavior: 'smooth' });
      return;
    }
    const el = scroller.querySelector<HTMLElement>(`[data-chapter="${i}"]`);
    if (el) scroller.scrollTo({ top: el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop });
  };

  return (
    <div ref={root} className={styles.root} data-mode={reduced ? 'stacked' : 'pinned'} data-transition={wipe ? 'wipe' : 'rise'}>
      <div ref={scrollerRef} className={styles.scroller} tabIndex={0} role="region" aria-label="How a cup is made — scroll to step through the chapters">
        <header className={styles.intro}>
          <p className={styles.label}>Process notes · sample content</p>
          <h2 className={styles.heading}>How a cup gets made</h2>
          <p className={styles.hint}><span aria-hidden="true">↓</span> Scroll to step through</p>
        </header>

        <div ref={trackRef} className={styles.track} style={{ '--n': count } as React.CSSProperties}>
          <div className={styles.panel}>
            {chapters.map((c, i) => (
              <section key={c.title} className={styles.chapter} data-chapter={i} aria-labelledby={`spc-title-${i}`}>
                <div className={styles.inner} data-inner>
                  <div className={styles.copy}>
                    <p className={styles.mask}><span data-line className={styles.count}>Chapter {pad(i + 1)} <span aria-hidden="true">/</span><span className={styles.srOnly}> of </span> {pad(count)}</span></p>
                    <p className={styles.mask} aria-hidden="true"><span data-line className={styles.numeral}>{pad(i + 1)}</span></p>
                    <h3 id={`spc-title-${i}`} className={`${styles.mask} ${styles.title}`}><span data-line>{c.title}</span></h3>
                    <p className={styles.mask}><span data-line className={styles.body}>{c.body}</span></p>
                  </div>
                  <figure className={styles.figure} data-frame aria-hidden="true">
                    <svg data-art className={styles.art} viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                      {c.art}
                    </svg>
                    <figcaption className={styles.fig}>Fig. {i + 1}</figcaption>
                  </figure>
                </div>
              </section>
            ))}
          </div>
        </div>

        <footer className={styles.outro}>
          <p className={styles.label}>End of sequence</p>
          <p className={styles.outroText}>The panel releases here and the page scrolls on.</p>
        </footer>
      </div>

      <nav className={styles.dots} aria-label="Chapters">
        {chapters.map((c, i) => (
          <button key={c.title} type="button" className={styles.dot} aria-current={active === i ? 'step' : undefined} aria-label={`Go to chapter ${i + 1}: ${c.title}`} onClick={() => goTo(i)}>
            <span aria-hidden="true" />
          </button>
        ))}
      </nav>
    </div>
  );
}
