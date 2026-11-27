'use client';
/**
 * Lead & Lag — the one-page site of a fictional two-person motion studio. The page is the portfolio: one lamp lights
 * every surface (the WebGL glass and the DOM agree on it), the hero object is a glass loupe you can throw across the
 * manifesto, and the four new recipes do real jobs: cursor-follower reads the page, liquid-glass-lens is the hero,
 * lottie-micro-interactions are the controls (night palette, menu, save, play) and rive-state-machine is the mascot
 * and the rating.
 */
import { flushSync } from 'react-dom';
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createSequence, distance, duration as D, spring, springToLinear, stagger, useInView, useScrollProgress, useStudioMotion } from '../../../motion';
import { resolveParams, type EffectMeta, type ParamValues } from '../../../types';
import { CursorFollower } from '../../../effects/cursor-follower';
import { ICONS, LottieIcon } from '../../../effects/lottie-micro-interactions';
import type { LensHandle } from '../../../effects/liquid-glass-lens';
import KineticMarquee from '../../../effects/kinetic-marquee';
import { meta as marqueeMeta } from '../../../effects/kinetic-marquee/meta';
import SplitLineReveal from '../../../effects/split-line-reveal';
import { meta as splitMeta } from '../../../effects/split-line-reveal/meta';
import { CLIENTS, NAV, PROCESS, STUDIO, CASES, type CaseId } from './content';
import { manifestoFonts, readTheme, type Theme } from './manifesto';
import { ManifestoSvg } from './ManifestoSvg';
import { usePageLight } from './light';
import { Work } from './Work';
import { Archive } from './Archive';
import { Reel } from './Reel';
import { Mascot } from './Mascot';
import { Rating } from './Rating';
import { ProcessArt } from './art';
import s from './styles.module.css';

/** The glass carries three.js: its chunk loads after the page has painted, behind an SVG poster of the same sheet. */
const HeroGlass = lazy(() => import('./HeroGlass'));

const recipe = <T,>(m: EffectMeta, overrides: ParamValues = {}): T => resolveParams(m.params, overrides) as unknown as T;
const THEME_ICON = ICONS.theme.build(2);
const MENU_ICON = ICONS.menu.build(2);
const POP = springToLinear(spring.pop);
const PRESS = springToLinear(spring.press);

/** The gallery theme (html[data-theme]) sets the starting palette; the sun/moon toggle overrides it locally. */
const galleryIsDark = (): boolean => {
  if (typeof document === 'undefined') return false;
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
};
function useGalleryDark(): boolean {
  const [dark, setDark] = useState(galleryIsDark);
  useEffect(() => {
    const de = document.documentElement;
    const read = () => setDark(galleryIsDark());
    read();
    const mo = new MutationObserver(read);
    mo.observe(de, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

/** Section titles: plain text until in view, then the split-line-reveal recipe sets them. */
function Title({ text, id }: { text: string; id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { amount: 0.6 });
  const { reduced } = useStudioMotion();
  return (
    <div ref={ref} className={s.title} id={id}>
      {near && !reduced ? <SplitLineReveal params={recipe(splitMeta, { text, stagger: 56, duration: 820, rise: 112, skew: true })} /> : <h2>{text}</h2>}
    </div>
  );
}

/**
 * Blocks rise into place once, as each one is about to enter the viewport; blocks entering together are staggered.
 * WAAPI with fill backwards, so CSS owns every resting state (and a full-page capture shows them all).
 */
function useReveal(ref: RefObject<HTMLElement | null>, reduced: boolean, scaleStagger: number) {
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || typeof IntersectionObserver === 'undefined') return;
    const live: Animation[] = [];
    const io = new IntersectionObserver((entries) => {
      let n = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        live.push(e.target.animate(
          [{ opacity: 0, transform: `translateY(${distance.base * 1.4}px)` }, { opacity: 1, transform: 'none' }],
          { duration: D.slow * 1.25, delay: n++ * stagger.loose * scaleStagger, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' },
        ));
      }
    }, { rootMargin: '0px 0px 4% 0px' });
    el.querySelectorAll('[data-reveal]').forEach((t) => io.observe(t));
    return () => { io.disconnect(); for (const a of live) a.cancel(); };
  }, [ref, reduced, scaleStagger]);
}

/** Scroll speed makes the "Lag" in the wordmark lag: its two onion-skin ghosts trail it, then catch up. */
function useWordmarkLag(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let y = window.scrollY, t = performance.now(), lag = 0, target = 0, raf = 0, last = 0;
    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      target *= Math.exp(-dt * 5);
      lag += (target - lag) * (1 - Math.exp(-dt * (target > lag ? 14 : 5)));
      el.style.setProperty('--lag', lag.toFixed(3));
      if (lag > 0.004 || target > 0.004) raf = requestAnimationFrame(tick);
      else { el.style.setProperty('--lag', '0'); last = 0; }
    };
    const onScroll = () => {
      const now = performance.now();
      const v = Math.abs(window.scrollY - y) / Math.max(8, now - t) * 1000;
      y = window.scrollY;
      t = now;
      target = Math.max(target, Math.min(1, v / 2600));
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); el.style.removeProperty('--lag'); };
  }, [ref, enabled]);
}

const renderLabel = (label: string): ReactNode => {
  const arrow = (d: string) => <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false"><path d={d} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (label === 'Drag') return <>{arrow('M15 6l-6 6 6 6')}{label}{arrow('M9 6l6 6-6 6')}</>;
  if (label === 'View') return <>{label}{arrow('M7 17 17 7M9 7h8v8')}</>;
  return label;
};

export default function MotionStudio() {
  const { reduced, scale } = useStudioMotion();
  const root = useRef<HTMLDivElement>(null);
  const brand = useRef<HTMLAnchorElement>(null);
  const lens = useRef<LensHandle>(null);
  const process = useRef<HTMLDivElement>(null);
  const workRef = useRef<HTMLElement>(null);
  const contactRef = useRef<HTMLElement>(null);
  const themeButton = useRef<HTMLButtonElement>(null);
  const galleryDark = useGalleryDark();
  const [night, setNight] = useState(false);
  const [menu, setMenu] = useState(false);
  const [saved, setSaved] = useState<ReadonlySet<CaseId>>(() => new Set());
  const [status, setStatus] = useState('');
  const [reelPlaying, setReelPlaying] = useState(false);
  const [sheet, setSheet] = useState<{ theme: Theme | null; version: number }>({ theme: null, version: 0 });

  useEffect(() => { setNight(galleryDark); }, [galleryDark]);

  // The palette is local tokens on the root; the texture under the glass is drawn from whatever they resolve to, and
  // the lens re-reads its glass look (env, shadow, caustics) from them whenever this version (its drawKey) bumps.
  useLayoutEffect(() => {
    const el = root.current;
    if (el) setSheet((x) => ({ theme: readTheme(el), version: x.version + 1 }));
  }, [night]);
  useEffect(() => {
    const el = root.current;
    if (!el || !document.fonts?.load) return;
    let alive = true;
    Promise.all(manifestoFonts(readTheme(el).fonts).map((f) => document.fonts.load(f).catch(() => []))).then(() => {
      if (alive && root.current) setSheet({ theme: readTheme(root.current), version: Date.now() });
    });
    return () => { alive = false; };
  }, []);

  usePageLight(root, !reduced);
  useWordmarkLag(brand, !reduced);
  useReveal(workRef, reduced, scale.stagger);
  useReveal(contactRef, reduced, scale.stagger);

  // Entrance: under a second, never blocking input, and finished at once by the first key, click or scroll.
  useEffect(() => {
    const el = root.current;
    if (!el || reduced) return;
    const seq = createSequence({ durationScale: scale.duration, staggerScale: scale.stagger });
    seq.add(el.querySelector('[data-lamp]'), [{ opacity: 1 }, { opacity: 0 }], { at: 0, duration: D.slow, easing: 'linear', fill: 'backwards' });
    seq.add(el.querySelectorAll('[data-enter]'), [{ opacity: 0, transform: `translateY(${distance.base}px)` }, { opacity: 1, transform: 'none' }], { at: 90, duration: D.slow, stagger: stagger.base, easing: 'emphasized', fill: 'backwards' });
    void seq.play();
    const skip = () => seq.finish();
    const opts = { capture: true, once: true, passive: true } as const;
    window.addEventListener('pointerdown', skip, opts);
    window.addEventListener('keydown', skip, opts);
    window.addEventListener('wheel', skip, opts);
    return () => {
      seq.cancel();
      window.removeEventListener('pointerdown', skip, opts);
      window.removeEventListener('keydown', skip, opts);
      window.removeEventListener('wheel', skip, opts);
    };
  }, [reduced, scale.duration, scale.stagger]);

  // Process: the playhead follows the page's own scroll through the four keys (no pinning, no hijack).
  const onProcess = useCallback((p: number) => {
    const el = process.current;
    if (!el) return;
    const u = Math.min(1, Math.max(0, (p - 0.12) / 0.36));
    el.style.setProperty('--p', u.toFixed(4));
    el.querySelectorAll<HTMLElement>('[data-key]').forEach((k, i) => { k.toggleAttribute('data-on', u >= i / 3 - 0.001); });
  }, []);
  useScrollProgress(process, onProcess, { enabled: !reduced });

  // Lights off, lights on: the new palette spreads as a circle from the switch (View Transitions; instant without
  // them or under reduced motion). The old page is a still snapshot, the new one is live underneath the circle.
  const switchPalette = (next: boolean) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    const btn = themeButton.current?.getBoundingClientRect();
    if (reduced || !doc.startViewTransition || !btn) { setNight(next); return; }
    const x = btn.left + btn.width / 2, y = btn.top + btn.height / 2;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const vt = doc.startViewTransition(() => { flushSync(() => setNight(next)); });
    vt.ready.then(() => {
      const de = document.documentElement;
      const timing = { duration: D.slow * scale.duration, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' };
      // The UA cross-fade adds the two snapshots (plus-lighter); a wipe wants them opaque and unblended.
      const flat = { opacity: [1, 1], mixBlendMode: ['normal', 'normal'] };
      de.animate({ ...flat, clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { ...timing, pseudoElement: '::view-transition-new(root)' });
      de.animate(flat, { ...timing, pseudoElement: '::view-transition-old(root)' });
    }).catch(() => {});
  };

  const save = useCallback((id: CaseId, on: boolean) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
    const name = CASES.find((c) => c.id === id)?.client ?? id;
    setStatus(on ? `${name} saved to your shortlist.` : `${name} removed from your shortlist.`);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(STUDIO.email);
      setStatus(`Copied ${STUDIO.email}. It is a fictional address.`);
    } catch {
      setStatus(`Copying is blocked here. The fictional address is ${STUDIO.email}.`);
    }
  };

  const vars = {
    '--ll-pop': POP.easing, '--ll-pop-ms': `${POP.duration}ms`,
    '--ll-press': PRESS.easing, '--ll-press-ms': `${PRESS.duration}ms`,
  } as CSSProperties;
  const shortlist = CASES.filter((c) => saved.has(c.id));
  const marquee = useMemo(() => recipe<Parameters<typeof KineticMarquee>[0]['params']>(marqueeMeta, { text: CLIENTS, speed: 64, reactivity: 1.5, skew: 11, label: 'Clients · all fictional' }), []);

  return (
    <div ref={root} className={s.root} data-palette={night ? 'night' : 'day'} data-reduced={reduced || undefined} style={vars}>
      <header className={s.header}>
        <a ref={brand} className={s.brand} href="#ll-top" data-enter="">
          <span>Lead</span>
          <span className={s.brandAmp}>&amp;</span>
          <span className={s.brandLag}>Lag</span>
          <span className={s.srOnly}>, home</span>
        </a>
        <span className={s.tag} data-enter="">Fictional studio</span>
        <nav className={s.nav} aria-label="Lead & Lag">
          <ul className={s.navList}>
            {NAV.map((n) => <li key={n.id} data-enter=""><a className={s.navLink} href={`#${n.id}`}>{n.label}</a></li>)}
          </ul>
        </nav>
        <span className={s.headerEnd} data-enter="">
          <LottieIcon ref={themeButton} data-cursor="magnet" animationData={THEME_ICON} segments={ICONS.theme.segments} grid={24} size={24} label="Night palette" pressed={night} onToggle={switchPalette} className={s.iconButton} />
          <span className={s.menuWrap}>
            <LottieIcon animationData={MENU_ICON} segments={ICONS.menu.segments} grid={24} size={24} label="Menu" kind="disclosure" controls="ll-menu" pressed={menu} onToggle={setMenu} className={s.iconButton} />
          </span>
        </span>
        <div id="ll-menu" className={s.menu} hidden={!menu} onKeyDown={(e) => { if (e.key === 'Escape') setMenu(false); }}>
          <ul>{NAV.map((n) => <li key={n.id}><a href={`#${n.id}`} onClick={() => setMenu(false)}>{n.label}</a></li>)}</ul>
        </div>
      </header>

      <main>
        {/* ── Hero: the manifesto on the light table, under the glass ─────────────────────────────────────────── */}
        <section id="ll-top" className={s.hero} aria-labelledby="ll-hero-h">
          <h1 id="ll-hero-h" className={s.srOnly}>{STUDIO.name}: {STUDIO.manifesto.join(' ')}</h1>
          <div className={s.table} data-cursor="none">
            <ManifestoSvg theme={sheet.theme} version={sheet.version} className={s.sheet} />
            <Suspense fallback={null}>
              <HeroGlass theme={sheet.theme} version={sheet.version} describedBy="ll-lens-hint" lensRef={lens} className={s.lensFrame} />
            </Suspense>
            <span className={s.lamp} data-lamp="" aria-hidden="true" />
          </div>
          <div className={s.heroRow}>
            <p className={s.intro} data-cursor="text" data-enter="">
              <strong>{STUDIO.name}</strong> is Noor and Teo, a two-person motion studio we made up for this page. Noor leads:
              direction, design, the first key. Teo lags: timing, follow-through, the frame after the frame. Everything here can
              be picked up.
            </p>
            <div className={s.ctas} data-enter="">
              <a className={s.btnPrimary} href="#ll-contact" data-cursor="magnet" data-lit="">Start a project<span aria-hidden="true">→</span></a>
              <a className={s.btnGhost} href="#ll-work" data-cursor="magnet">See the work</a>
            </div>
            <div className={s.lensHint} data-enter="">
              <p id="ll-lens-hint">
                {reduced ? 'Drag the glass to move it.' : 'Pick up the glass and throw it.'} <span className={s.keys}>Arrows move it · Shift for bigger steps · Home centres it.</span>
              </p>
              <button type="button" className={s.textButton} onClick={() => lens.current?.recentre()}>Centre the glass</button>
            </div>
          </div>
        </section>

        {/* ── Selected work ───────────────────────────────────────────────────────────────────────────────────── */}
        <section ref={workRef} id="ll-work" className={s.section} aria-labelledby="ll-work-h">
          <header className={s.sectionHead}>
            <p className={s.index}>01 — Selected work <span aria-hidden="true">·</span> sample projects</p>
            <Title id="ll-work-h" text="Four things we set in motion." />
          </header>
          <Work saved={saved} onSave={save} />
        </section>

        {/* ── Archive: a strip of film ────────────────────────────────────────────────────────────────────────── */}
        <section id="ll-archive" className={s.archive} aria-labelledby="ll-archive-h" data-cursor-area="">
          <header className={s.sectionHead}>
            <p className={s.index}>02 — Archive <span aria-hidden="true">·</span> 2017–2024</p>
            <h2 id="ll-archive-h" className={s.archiveTitle}>Ten years on one strip.</h2>
            <p id="ll-archive-hint" className={s.archiveHint}>Drag it or throw it. Focus it and use the arrow keys, or swipe.</p>
          </header>
          <Archive headingId="ll-archive-h" hintId="ll-archive-hint" />
        </section>

        {/* ── Process ─────────────────────────────────────────────────────────────────────────────────────────── */}
        <section id="ll-process" className={s.section} aria-labelledby="ll-process-h">
          <header className={s.sectionHead}>
            <p className={s.index}>03 — Process</p>
            <Title id="ll-process-h" text="One leads. One lags." />
          </header>
          <div ref={process} className={s.processWrap}>
          <span className={s.processTrack} aria-hidden="true"><span className={s.processFill} /><span className={s.processBall} /></span>
          <ol className={s.process}>
            {PROCESS.map((p, i) => (
              <li key={p.n} className={s.step} data-key="" data-on={reduced || i === 0 ? '' : undefined}>
                <span className={s.stepKey} aria-hidden="true" />
                <p className={s.stepN}>{p.n} <span aria-hidden="true">·</span> {p.who}</p>
                <h3 className={s.stepTitle}>{p.title}</h3>
                <ProcessArt step={i as 0 | 1 | 2 | 3} />
                <p className={s.stepBody} data-cursor="text">{p.body}</p>
              </li>
            ))}
          </ol>
          </div>
        </section>

        {/* ── The screening room: reel and mascot ─────────────────────────────────────────────────────────────── */}
        <section id="ll-reel" className={s.room} aria-labelledby="ll-reel-h" data-cursor-area="">
          <header className={s.sectionHead}>
            <p className={s.index}>04 — Reel <span aria-hidden="true">·</span> a sample cut</p>
            <h2 id="ll-reel-h" className={s.roomTitle}>Lights down. Birb dances.</h2>
          </header>
          <div className={s.roomGrid}>
            <Reel onPlaying={setReelPlaying} />
            <div className={s.mascotSlot}><Mascot reelPlaying={reelPlaying} /></div>
          </div>
        </section>

        {/* ── Clients ─────────────────────────────────────────────────────────────────────────────────────────── */}
        <section className={s.clients} aria-label="Clients (fictional)">
          <KineticMarquee params={marquee} />
        </section>

        {/* ── Feedback ────────────────────────────────────────────────────────────────────────────────────────── */}
        <section id="ll-feel" className={s.feel} aria-labelledby="ll-feel-h">
          <header className={s.feelHead}>
            <p className={s.index}>05 — Feedback</p>
            <h2 id="ll-feel-h" className={s.feelTitle}>We tune everything by feel.</h2>
            <p className={s.body} data-cursor="text">Weight, timing, how a thing lands. You have just used all of it. Tell us how it felt: the stars are a Rive state machine, and the answer never leaves this tab.</p>
          </header>
          <div className={s.ratingSlot}><Rating /></div>
        </section>

        {/* ── Contact ─────────────────────────────────────────────────────────────────────────────────────────── */}
        <section ref={contactRef} id="ll-contact" className={s.contact} aria-labelledby="ll-contact-h">
          <p className={s.index} data-reveal="">06 — Contact</p>
          <h2 id="ll-contact-h" className={s.contactTitle} data-reveal="">Got something<br />that should move?</h2>
          <div className={s.contactRow} data-reveal="">
            <a className={s.btnPrimary} data-lit="" data-cursor="magnet" href={`mailto:${STUDIO.email}?subject=${encodeURIComponent('A project that should move')}`}>Start a project<span aria-hidden="true">→</span></a>
            <button type="button" className={s.roundIcon} data-cursor="magnet" aria-label="Copy the studio email address" onClick={() => { void copy(); }}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.75" /><path d="m4.5 7.5 7.5 6 7.5-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span className={s.email}>{STUDIO.email}</span>
          </div>
          <div className={s.shortlist} data-reveal="">
            <p className={s.shortlistHead}>Your shortlist</p>
            {shortlist.length
              ? <ul>{shortlist.map((c) => <li key={c.id}>{c.client} <span>· {c.kind}</span></li>)}</ul>
              : <p className={s.shortlistEmpty}>Nothing saved yet. Use the heart on a case study to add it here.</p>}
          </div>
          <p className={s.status} role="status">{status}</p>
          <footer className={s.footer}>
            <p>{STUDIO.name}, Noor, Teo, their clients and their work are fictional. Sample page built from Maquettekit recipes.</p>
            <p>Birb and the rating stars: birb.riv and rating_animation.riv, Rive’s example files (MIT).</p>
          </footer>
        </section>
      </main>

      <CursorFollower scope={root} renderLabel={renderLabel} />
    </div>
  );
}
