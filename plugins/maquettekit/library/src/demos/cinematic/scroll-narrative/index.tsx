'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import {
  createSequence, duration, spring, springToLinear, stagger, useInView, useIsomorphicLayoutEffect, useRafLoop, useStudioMotion,
  type SpringConfig,
} from '../../../motion';
import { resolveParams, type EffectMeta, type ParamValues } from '../../../types';
import SplitLineReveal from '../../../effects/split-line-reveal';
import { meta as splitMeta } from '../../../effects/split-line-reveal/meta';
import { FIGURE_DESCRIPTION, SECTION, STEPS, createPainter, plan, section, valley, type PlanGeometry } from './valley';
import { ValleySvg } from './ValleySvg';
import s from './styles.module.css';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Every recipe param from its meta (defaults), then this demo's overrides. */
const recipe = <T,>(m: EffectMeta, overrides: ParamValues = {}): T => resolveParams(m.params, overrides) as unknown as T;

const NARROW = 1024; // px of demo width below which the figure sits above the text
const clampY = (y: number): number => Math.min(SECTION.max, Math.max(SECTION.min, y));
const pctOf = (y: number): number => Math.round(((y - SECTION.min) / (SECTION.max - SECTION.min)) * 100);

/** Decorative contour hill for the title card: inked from the summit outward on arrival, tilted by the pointer. */
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
      {rings.map((d, k) => <path key={k} d={d} className={s.contour} pathLength={1} data-ring={k} style={{ '--k': (13 - k) * 0.7 } as CSSProperties} />)}
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

export interface PlateApi { setStage: (t: number) => void }
type Mode = 'rest' | 'drag' | 'glide' | 'seek';

/**
 * One survey plate. The plan is painted imperatively (scrubbed stages never re-render React); the section line A–A′ is
 * the part the reader handles: drag it (or press anywhere on the plan) and it follows with a little weight, a flick
 * keeps its velocity and glides to a stop, and the inset redraws the valley's cross-section along it. The grip is a
 * slider for the keyboard (arrows, Page Up/Down, Home/End). On touch the plan keeps scrolling the page; the grip drags.
 */
function Plate({ t0, api, speed, labelId, flowing }: { t0: number; api?: MutableRefObject<PlateApi | null>; speed?: MutableRefObject<number>; labelId?: string; flowing: boolean }) {
  const { reduced } = useStudioMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const initial = useMemo(() => valley(t0), [t0]);
  const m = useRef({
    plan: initial as PlanGeometry, y: initial.y, v: 0, mode: 'rest' as Mode, target: initial.y, cfg: spring.settle as SpringConfig,
    id: -1, grab: 0, x0: 0, y0: 0, moved: false, samples: [] as { t: number; y: number }[],
    box: { scale: 1, ox: 0, oy: 0 }, shown: '', flow: 0, paint: null as ReturnType<typeof createPainter> | null,
  });

  const placeHandle = () => {
    const st = m.current;
    const { scale, ox, oy } = st.box;
    const h = handle.current;
    if (h) h.style.transform = `translate(${(ox + 584 * scale - 22).toFixed(1)}px, ${(oy + st.y * scale - 22).toFixed(1)}px)`;
  };
  const drawSection = () => {
    const st = m.current;
    const c = section(st.plan, st.y);
    st.paint?.section(c);
    placeHandle();
    const pct = String(pctOf(c.y));
    const times = c.crossings === 1 ? 'once' : c.crossings === 2 ? 'twice' : `${c.crossings} times`;
    const text = `${pct}% down the plan; it crosses the river ${times}${c.lakes ? ' and the oxbow lake' : ''}`;
    if (text !== st.shown && handle.current) {
      st.shown = text;
      handle.current.setAttribute('aria-valuenow', pct);
      handle.current.setAttribute('aria-valuetext', `Section line ${text}`);
    }
  };

  useIsomorphicLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const st = m.current;
    st.paint = createPainter(el);
    if (api) api.current = { setStage: (t) => { st.plan = plan(t); st.paint?.plan(st.plan); drawSection(); } };
    drawSection();
    return () => { st.paint = null; if (api) api.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // The plate's paper sits in a box that letterboxes the 3 : 4 drawing: measure it for the grip and the paper shadow.
  useEffect(() => {
    const w = wrap.current;
    if (!w || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const W = w.clientWidth;
      const H = w.clientHeight;
      const scale = Math.min(W / 600, H / 800);
      const box = { scale, ox: (W - 600 * scale) / 2, oy: (H - 800 * scale) / 2 };
      m.current.box = box;
      const p = paper.current;
      if (p) Object.assign(p.style, { left: `${box.ox}px`, top: `${box.oy}px`, width: `${600 * scale}px`, height: `${800 * scale}px` });
      placeHandle();
    });
    ro.observe(w);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRafLoop(wrap, (dt) => {
    const st = m.current;
    if (dt <= 0) return;
    // The river's current: dashes travel downstream only while the reader scrolls, faster when they scroll faster.
    if (flowing && speed) {
      const v = speed.current;
      speed.current *= Math.exp(-dt * 3);
      if (v > 4) {
        st.flow -= Math.min(220, v * 0.05) * dt;
        const f = svg.current?.querySelector<SVGPathElement>('[data-k="flow"]');
        if (f) f.style.strokeDashoffset = st.flow.toFixed(1);
      }
    }
    if (st.mode === 'rest') return;
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const step = (target: number, cfg: SpringConfig) => {
      for (let i = 0; i < n; i++) {
        st.v += ((-cfg.stiffness * (st.y - target) - cfg.damping * st.v) / cfg.mass) * (dt / n);
        st.y += st.v * (dt / n);
      }
    };
    if (st.mode === 'drag') step(st.target, spring.press);
    else if (st.mode === 'seek') {
      step(st.target, st.cfg);
      if (Math.abs(st.y - st.target) < 0.05 && Math.abs(st.v) < 0.5) { st.y = st.target; st.v = 0; st.mode = 'rest'; }
    } else if (st.mode === 'glide') {
      st.v *= Math.exp(-dt * 3.2);
      st.y += st.v * dt;
      // Soft stops at either end of the plan.
      if (st.y < SECTION.min || st.y > SECTION.max) { st.mode = 'seek'; st.target = clampY(st.y); st.cfg = spring.release; }
      else if (Math.abs(st.v) < 2) { st.v = 0; st.mode = 'rest'; }
    }
    drawSection();
  }, !reduced);

  const yAt = (clientY: number): number => {
    const r = wrap.current?.getBoundingClientRect();
    const { scale, oy } = m.current.box;
    return r ? (clientY - r.top - oy) / Math.max(0.01, scale) : m.current.y;
  };
  const setDirect = (y: number) => { const st = m.current; st.y = clampY(y); st.v = 0; st.mode = 'rest'; drawSection(); };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const st = m.current;
    const onGrip = (e.target as Element).closest('[data-grip]') !== null;
    st.id = e.pointerId;
    st.x0 = e.clientX;
    st.y0 = e.clientY;
    st.moved = false;
    const at = yAt(e.clientY);
    // Touch keeps the page scrolling: on touch only the grip drags; a tap on the plan places the line.
    if (e.pointerType === 'touch' && !onGrip) return;
    st.grab = onGrip || Math.abs(at - st.y) < 30 ? st.y - at : 0;
    st.samples = [{ t: performance.now(), y: at + st.grab }];
    if (reduced) setDirect(at + st.grab);
    else { st.mode = 'drag'; st.target = clampY(at + st.grab); }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* gone */ }
    if (e.pointerType === 'mouse') e.preventDefault();
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = m.current;
    if (e.pointerId !== st.id) return;
    if (Math.hypot(e.clientX - st.x0, e.clientY - st.y0) > 6) st.moved = true;
    if (st.mode !== 'drag' && !(reduced && e.currentTarget.hasPointerCapture(e.pointerId))) return;
    const raw = yAt(e.clientY) + st.grab;
    const y = raw < SECTION.min ? SECTION.min - (SECTION.min - raw) * 0.3 : raw > SECTION.max ? SECTION.max + (raw - SECTION.max) * 0.3 : raw;
    if (reduced) { setDirect(y); return; }
    st.target = y;
    const now = performance.now();
    st.samples.push({ t: now, y });
    while (st.samples.length > 2 && now - st.samples[0].t > 100) st.samples.shift();
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = m.current;
    if (e.pointerId !== st.id) return;
    st.id = -1;
    if (e.type === 'pointerup' && e.pointerType === 'touch' && st.mode !== 'drag' && !st.moved) {
      // A tap on the plan: the line glides there.
      const y = clampY(yAt(e.clientY));
      if (reduced) setDirect(y); else { st.mode = 'seek'; st.target = y; st.cfg = spring.settle; }
      return;
    }
    if (reduced || st.mode !== 'drag') return;
    // A click without a drag: the line glides all the way to where the plan was pressed.
    if (!st.moved) { st.mode = 'seek'; st.cfg = spring.settle; return; }
    const a = st.samples[0];
    const b = st.samples[st.samples.length - 1];
    const flick = a && b && b.t - a.t > 8 ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0;
    st.v = Math.max(-2600, Math.min(2600, (st.v + flick) / 2));
    st.mode = 'glide';
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const st = m.current;
    const span = SECTION.max - SECTION.min;
    const from = st.mode === 'seek' ? st.target : st.y;
    const keys: Record<string, number> = { ArrowDown: 0.02, ArrowRight: 0.02, ArrowUp: -0.02, ArrowLeft: -0.02, PageDown: 0.1, PageUp: -0.1 };
    let to: number | null = null;
    if (e.key in keys) to = from + keys[e.key] * span;
    else if (e.key === 'Home') to = SECTION.min;
    else if (e.key === 'End') to = SECTION.max;
    if (to === null) return;
    e.preventDefault();
    if (reduced) { setDirect(to); return; }
    st.mode = 'seek';
    st.target = clampY(to);
    st.cfg = spring.settle;
  };

  return (
    <div
      ref={wrap}
      className={s.planWrap}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div ref={paper} className={s.paperShadow} aria-hidden="true" />
      <ValleySvg ref={svg} g={initial} labelId={labelId} />
      <div
        ref={handle}
        className={s.secHandle}
        data-grip=""
        role="slider"
        tabIndex={0}
        aria-label="Section line A–A′"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pctOf(initial.y)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

export default function ScrollNarrative() {
  const { reduced, scale } = useStudioMotion();
  const root = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const plate = useRef<PlateApi | null>(null);
  const speed = useRef(0);
  const [active, setActive] = useState(0);
  const press = useMemo(() => springToLinear(spring.press), []);

  // Entrance: the surveyor inks the hill from its summit outward, then the river draws itself under "Bend".
  // The headline and standfirst are there from the first paint; only the drawing around them moves.
  useIsomorphicLayoutEffect(() => {
    const h = titleRef.current;
    if (!h || reduced) return;
    const rings = h.querySelectorAll('[data-ring]');
    const seq = createSequence({ durationScale: scale.duration, staggerScale: scale.stagger })
      .add(rings, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: duration.slow, easing: 'emphasized', stagger: stagger.base })
      .add(h.querySelector('[data-river]'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { at: 260, duration: duration.cinematic, easing: 'inOut' });
    void seq.play();
    return () => seq.cancel();
  }, [reduced, scale]);

  // Relief: the pointer tilts the drawings like a relief model under a lamp — higher contours shift further.
  useEffect(() => {
    const el = root.current;
    if (!el || reduced) return;
    const st = { tx: 0, ty: 0, x: 0, y: 0, raf: 0, last: 0 };
    const tick = (now: number) => {
      st.raf = 0;
      const dt = Math.min(0.05, st.last ? (now - st.last) / 1000 : 0.016);
      st.last = now;
      const k = 1 - Math.exp(-dt * 4);
      st.x += (st.tx - st.x) * k;
      st.y += (st.ty - st.y) * k;
      el.style.setProperty('--rx', st.x.toFixed(3));
      el.style.setProperty('--ry', st.y.toFixed(3));
      if (Math.abs(st.tx - st.x) + Math.abs(st.ty - st.y) > 0.002) st.raf = requestAnimationFrame(tick);
      else st.last = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      st.tx = -((e.clientX / Math.max(1, window.innerWidth)) * 2 - 1);
      st.ty = -((e.clientY / Math.max(1, window.innerHeight)) * 2 - 1);
      if (!st.raf) st.raf = requestAnimationFrame(tick);
    };
    el.addEventListener('pointermove', onMove, { passive: true });
    return () => { el.removeEventListener('pointermove', onMove); cancelAnimationFrame(st.raf); el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); };
  }, [reduced]);

  useGSAP(() => {
    const steps = stepsRef.current;
    const rail = railRef.current;
    const el = root.current;
    if (reduced || !steps || !rail || !el) return;
    const narrow = () => el.clientWidth < NARROW;
    const n = STEPS.length;
    const state = { t: 0 };
    let drawn = -1;
    const draw = () => {
      if (Math.abs(state.t - drawn) < 0.0004) return;
      drawn = state.t;
      plate.current?.setStage(state.t);
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
          speed.current = Math.max(speed.current, Math.abs(self.getVelocity()));
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
  const rootStyle = { '--rv-press': press.easing, '--rv-press-dur': `${press.duration}ms` } as CSSProperties;

  return (
    <div ref={root} className={s.root} data-mode={reduced ? 'static' : 'scrub'} style={rootStyle}>
      <header ref={titleRef} className={s.title}>
        <div className={s.titleText}>
          <p className={s.kicker}>Fieldbook No. 7 <span aria-hidden="true">·</span> a river in five stages <span aria-hidden="true">·</span> sample content</p>
          <h2 className={s.headline}>
            The Long <em className={s.bend}>Bend<svg className={s.bendRiver} viewBox="0 0 300 22" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path data-river="" pathLength={1} d="M4 12C40 2 62 20 98 12S156 3 190 11S250 20 296 7" />
            </svg></em>
          </h2>
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
            <Plate t0={0} api={plate} speed={speed} labelId="rv-fig-desc" flowing />
            <figcaption className={s.figcap}>{STEPS[active].caption} <span className={s.figHint}>Drag the line A–A′ to cut a section.</span></figcaption>
            <p id="rv-fig-desc" className="mk-sr-only">{FIGURE_DESCRIPTION}</p>
          </figure>
        ) : null}

        <div ref={stepsRef} className={s.steps}>
          {STEPS.map((st, i) => (
            <section key={st.id} className={s.step} data-step={i} aria-labelledby={`rv-step-${st.id}`}>
              {reduced ? (
                <figure className={s.stepFigure}>
                  <Plate t0={i} flowing={false} />
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
