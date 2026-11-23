'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useInView, useStudioMotion } from '../../../motion';
import { resolveParams, type EffectMeta, type ParamValues } from '../../../types';
import SplitLineReveal from '../../../effects/split-line-reveal';
import { meta as splitMeta } from '../../../effects/split-line-reveal/meta';
import { FIGURE_DESCRIPTION, STEPS, createPainter, valley } from './valley';
import { ValleySvg } from './ValleySvg';
import s from './styles.module.css';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Every recipe param from its meta (defaults), then this demo's overrides. */
const recipe = <T,>(m: EffectMeta, overrides: ParamValues = {}): T => resolveParams(m.params, overrides) as unknown as T;

const NARROW = 1024; // px of demo width below which the figure sits above the text

/** Decorative contour hill for the title card (static). */
function TitleContours() {
  const rings = useMemo(() => Array.from({ length: 13 }, (_, k) => {
    const r = 40 + k * 34;
    const pts = Array.from({ length: 73 }, (_, i) => {
      const a = (i / 72) * Math.PI * 2;
      const w = 1 + 0.08 * Math.sin(a * 3 + k * 0.7) + 0.05 * Math.sin(a * 5 - k);
      return `${(420 + Math.cos(a) * r * w * 1.25).toFixed(1)} ${(300 + Math.sin(a) * r * w * 0.8).toFixed(1)}`;
    });
    return `M${pts.join('L')}Z`;
  }), []);
  return (
    <svg className={s.titleArt} viewBox="0 0 840 600" aria-hidden="true" focusable="false">
      {rings.map((d, k) => <path key={k} d={d} className={s.contour} />)}
    </svg>
  );
}

/** The closing statement: the split-line recipe mounts as it comes into view, so its entrance is seen. */
function ClosingTitle() {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { amount: 0.5 });
  const { reduced } = useStudioMotion();
  const text = 'A river is a slow argument with its valley.';
  return (
    <div ref={ref} className={s.closingTitle}>
      {near || reduced ? <SplitLineReveal params={recipe(splitMeta, { text, stagger: 56, duration: 820, rise: 110, skew: false })} /> : <h2 className={s.placeholder}>{text}</h2>}
    </div>
  );
}

export default function ScrollNarrative() {
  const { reduced } = useStudioMotion();
  const root = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const [active, setActive] = useState(0);
  const initial = useMemo(() => valley(0), []);
  const statics = useMemo(() => (reduced ? STEPS.map((_, i) => valley(i)) : null), [reduced]);

  useGSAP(() => {
    const steps = stepsRef.current;
    const svg = svgRef.current;
    const rail = railRef.current;
    const el = root.current;
    if (reduced || !steps || !svg || !rail || !el) return;
    const paint = createPainter(svg);
    const narrow = () => el.clientWidth < NARROW;
    const n = STEPS.length;
    const state = { t: 0 };
    let drawn = -1;
    const draw = () => {
      if (Math.abs(state.t - drawn) < 0.0004) return;
      drawn = state.t;
      paint(valley(state.t));
    };
    // One unit of timeline per step. Each hand-over sits across a step boundary, so every stage rests
    // while its text crosses the reading line (centre of the viewport, or below the figure when narrow).
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: draw,
      scrollTrigger: {
        trigger: steps,
        start: () => (narrow() ? 'top 76%' : 'top center'),
        end: () => (narrow() ? 'bottom 76%' : 'bottom center'),
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          rail.style.setProperty('--p', self.progress.toFixed(4));
          const i = Math.min(n - 1, Math.floor(self.progress * n));
          setActive((prev) => (prev === i ? prev : i));
        },
      },
    });
    tl.to({}, { duration: 0.75 });
    for (let i = 1; i < n; i++) tl.to(state, { t: i, duration: 0.5 }).to({}, { duration: i < n - 1 ? 0.5 : 0.75 });
    trigger.current = tl.scrollTrigger ?? null;

    // The demo frame can change width without a window resize (preview widths), and web fonts move layout.
    let width = el.clientWidth;
    let timer = 0;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 140);
    });
    ro.observe(el);
    let alive = true;
    void document.fonts?.ready.then(() => { if (alive) ScrollTrigger.refresh(); });
    return () => { alive = false; ro.disconnect(); window.clearTimeout(timer); trigger.current = null; rail.style.removeProperty('--p'); };
  }, { scope: root, dependencies: [reduced], revertOnUpdate: true });

  // Reduced motion: chapters are stacked, so the rail follows whichever step crosses the middle of the screen.
  useEffect(() => {
    const steps = stepsRef.current;
    if (!reduced || !steps || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
    }, { rootMargin: '-40% 0px -55% 0px' });
    steps.querySelectorAll('[data-step]').forEach((x) => io.observe(x));
    return () => io.disconnect();
  }, [reduced]);

  const goTo = (i: number): void => {
    const heading = root.current?.querySelector<HTMLElement>(`#rv-step-${STEPS[i].id}`);
    const st = trigger.current;
    if (!reduced && st) window.scrollTo({ top: st.start + (st.end - st.start) * ((i + 0.5) / STEPS.length), behavior: 'smooth' });
    else heading?.scrollIntoView({ block: 'start' });
    heading?.focus({ preventScroll: true });
  };

  const railStyle = (reduced ? { '--p': (active + 1) / STEPS.length } : undefined) as CSSProperties | undefined;

  return (
    <div ref={root} className={s.root} data-mode={reduced ? 'static' : 'scrub'}>
      <header className={s.title}>
        <div className={s.titleText}>
          <p className={s.kicker}>Fieldbook No. 7 <span aria-hidden="true">·</span> a river in five stages <span aria-hidden="true">·</span> sample content</p>
          <h2 className={s.headline}>The Long <em>Bend</em></h2>
          <p className={s.standfirst}>How a small river spends thousands of years carving, widening and finally furnishing the valley it lives in.</p>
          <p className={s.byline}>Text and survey drawings for a fictional river, the Vell. The processes are real and simplified; the place is not.</p>
          <a className={s.skip} href="#rv-closing">Skip the five stages</a>
        </div>
        <TitleContours />
      </header>

      <div className={s.story}>
        <nav ref={railRef} className={s.rail} aria-label="Stages of the river" style={railStyle}>
          <p className={s.railHead} aria-hidden="true">Stages</p>
          <ol className={s.railList}>
            {STEPS.map((st, i) => (
              <li key={st.id} style={{ '--i': i } as CSSProperties}>
                <button type="button" className={s.railBtn} aria-current={active === i ? 'step' : undefined} onClick={() => goTo(i)}>
                  <span className={s.seg} aria-hidden="true" />
                  <span className={s.railNum}>{st.numeral}</span>
                  <span className={s.railName}>{st.short}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {!reduced ? (
          <figure className={s.figure}>
            <div className={s.figHead} aria-hidden="true">
              <span>Fig. {active + 1}</span>
              <span>Stage {STEPS[active].numeral} / V</span>
            </div>
            <ValleySvg ref={svgRef} g={initial} labelId="rv-fig-desc" />
            <figcaption className={s.figcap}>{STEPS[active].caption}</figcaption>
            <p id="rv-fig-desc" className="s3-sr-only">{FIGURE_DESCRIPTION}</p>
          </figure>
        ) : null}

        <div ref={stepsRef} className={s.steps}>
          {STEPS.map((st, i) => (
            <section key={st.id} className={s.step} data-step={i} aria-labelledby={`rv-step-${st.id}`}>
              {statics ? (
                <figure className={s.stepFigure}>
                  <ValleySvg g={statics[i]} />
                  <figcaption className={s.figcap}>{st.caption}</figcaption>
                </figure>
              ) : null}
              <div className={s.stepText}>
                <p className={s.stepNum} aria-hidden="true">{st.numeral}</p>
                <h3 id={`rv-step-${st.id}`} className={s.stepTitle} tabIndex={-1}>{st.title}</h3>
                <p className={s.stepBody}>{st.body}</p>
                <p className={s.look}><span className={s.lookKey}>Look for</span> {st.look}</p>
              </div>
            </section>
          ))}
        </div>
      </div>

      <section id="rv-closing" className={s.closing} aria-labelledby="rv-closing-h" tabIndex={-1}>
        <p id="rv-closing-h" className={s.kicker}>After the fifth stage</p>
        <ClosingTitle />
        <div className={s.closingGrid}>
          <div>
            <h3 className={s.closingH}>What the valley keeps</h3>
            <p className={s.closingP}>Every stage leaves something behind. The steep upper valley keeps its V; the middle keeps the scars of loops that were cut off; the lower valley keeps its terraces, each one a floor the river made and then abandoned. Read together, they are the river&rsquo;s own account of where it has been.</p>
          </div>
          <div>
            <h3 className={s.closingH}>On a walk, look for</h3>
            <ol className={s.lookList}>
              <li>A steep cut bank facing a sandy inside bend.</li>
              <li>A crescent of still water near, but not on, the river.</li>
              <li>A low step at the edge of flat fields: a terrace.</li>
            </ol>
          </div>
        </div>
        <p className={s.colophon}>
          Method: meander shapes are drawn with a sine-generated curve, a standard approximation of real river bends; valley contours and the cross-section are diagrams, not surveys. The Vell, its valley and its five stages are fictional sample content.
        </p>
      </section>
    </div>
  );
}
