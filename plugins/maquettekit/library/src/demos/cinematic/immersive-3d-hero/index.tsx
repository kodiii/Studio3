'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { spring, springToLinear, useInView, useStudioMotion } from '../../../motion';
import { StudioCanvas } from '../../../three';
import { resolveParams, type EffectMeta, type ParamValues } from '../../../types';
import SplitLineReveal from '../../../effects/split-line-reveal';
import { meta as splitMeta } from '../../../effects/split-line-reveal/meta';
import { Poster } from './Poster';
import { LOOK_MAX, Scene, type Bridge, type Input } from './Scene';
import { VIEWPOINTS, type StopId } from './terrain';
import s from './styles.module.css';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Every recipe param from its meta (defaults), then this demo's overrides. */
const recipe = <T,>(m: EffectMeta, overrides: ParamValues = {}): T => resolveParams(m.params, overrides) as unknown as T;

const CHAPTERS = [
  { id: 'lake', label: 'Lake', time: '21:30', title: 'Lake Kelda at dusk', body: 'We meet at the boathouse while the ridge is still a silhouette. Twenty minutes to let your eyes adjust; head torches stay on red from here on.', meta: 'Start · the lake shore' },
  { id: 'ridge', label: 'Ridge', time: '22:10', title: 'The ridge path', body: 'Two hours on a marked path that never leaves the crest. The contour lines below you are the only map you need, and the guide carries the paper one anyway.', meta: 'About 6 km there and back' },
  { id: 'sky', label: 'Sky', time: '23:40', title: 'Under the northern sky', body: 'On some clear winter nights the sky over the ridge moves. We can’t promise it, and we never charge extra for it. The stars are reliable.', meta: 'Turning point · the summit cairn' },
] as const satisfies readonly { id: StopId; label: string; time: string; title: string; body: string; meta: string }[];

const WALKS = [
  ['Fri 4 Dec 2026', '20:30', '3 h 30', '12'],
  ['Sat 19 Dec 2026', '20:00', '4 h', '12'],
  ['Fri 15 Jan 2027', '20:30', '3 h 30', '10'],
  ['Sat 13 Feb 2027', '21:00', '4 h', '12'],
] as const;

/** Rest zones: the camera holds at each chapter's stop while its caption crosses the middle of the screen. */
const HOLD = 0.05;
function toU(p: number, c: readonly number[]): number {
  if (c.length < 4) return p;
  for (let k = 0; k < 3; k++) {
    const a = c[k] + HOLD;
    const b = c[k + 1] - HOLD;
    if (p <= a) return k / 3;
    if (p < b) { const f = (p - a) / (b - a); return (k + f * f * (3 - 2 * f)) / 3; }
  }
  return 1;
}

/** Drag sensitivity: a drag across 40 % of the stage turns the view by the full ±20°. */
const DRAG_SPAN = 0.4;
/** Past the limit the view still follows the hand, at a third of the rate (rubber band). */
const band = (yaw: number): number => (Math.abs(yaw) <= LOOK_MAX ? yaw : Math.sign(yaw) * (LOOK_MAX + (Math.abs(yaw) - LOOK_MAX) * 0.33));
/** Look buttons: the press kicks the view (rad/s) so even a tap glances; holding keeps it turned. */
const KICK = 1.9;

function WalksTitle() {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { amount: 0.6 });
  const { reduced } = useStudioMotion();
  const text = 'Four walks this winter.';
  return (
    <div ref={ref} className={s.walksTitle}>
      {near || reduced ? <SplitLineReveal params={recipe(splitMeta, { text, stagger: 60, duration: 820, rise: 112, skew: false })} /> : <h2 className={s.placeholder}>{text}</h2>}
    </div>
  );
}

export default function Immersive3DHero() {
  const { reduced } = useStudioMotion();
  const root = useRef<HTMLDivElement>(null);
  const journey = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const bridge = useRef<Bridge>({ u: 0, kick: 0, invalidate: null, light: null, sway: null }).current;
  const input = useRef<Input>({ px: 0, py: 0, over: false, drag: 0, dragging: false, release: 0, hold: 0, impulse: 0, yaw: 0 }).current;
  const live = useRef<{ st: ScrollTrigger; centers: () => readonly number[] } | null>(null);
  const [playing, setPlaying] = useState(true);
  const [off3d, setOff3d] = useState(false);
  const [lit3d, setLit3d] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [active, setActive] = useState(0);
  const [stop, setStop] = useState<StopId>('lake');
  const animate = playing && !reduced;
  const release = useMemo(() => springToLinear(spring.press), []);

  // Scene → DOM: the sky light tints the panels' top edges; the camera sway moves the layered title in depth.
  useEffect(() => {
    const j = journey.current;
    const h = hero.current;
    bridge.light = (lit) => j?.style.setProperty('--kr-lit', lit.toFixed(2));
    bridge.sway = (x, y) => { h?.style.setProperty('--kr-sx', x.toFixed(3)); h?.style.setProperty('--kr-sy', y.toFixed(3)); };
    return () => { bridge.light = null; bridge.sway = null; };
  }, [bridge]);

  useGSAP(() => {
    const el = root.current;
    const j = journey.current;
    if (reduced || !el || !j) return;
    const slides = gsap.utils.toArray<HTMLElement>('[data-slide]', j);
    let centers: number[] = [];
    const measure = (self: ScrollTrigger) => {
      const span = Math.max(1, self.end - self.start);
      const mid = 44 + (window.innerHeight - 44) / 2;
      centers = slides.map((x) => {
        const r = x.getBoundingClientRect();
        return gsap.utils.clamp(0, 1, (r.top + window.scrollY + r.height / 2 - mid - self.start) / span);
      });
    };
    const update = (self: ScrollTrigger) => {
      bridge.u = toU(self.progress, centers);
      // Scroll speed → a brief aurora flare: 700 px/s starts it, 4,200 px/s is the full flare.
      const v = Math.abs(self.getVelocity());
      bridge.kick = Math.max(bridge.kick, gsap.utils.clamp(0, 1, (v - 700) / 3500));
      bridge.invalidate?.();
      let best = 0;
      centers.forEach((c, i) => { if (Math.abs(c - self.progress) < Math.abs(centers[best] - self.progress)) best = i; });
      setActive((prev) => (prev === best ? prev : best));
    };
    const st = ScrollTrigger.create({ trigger: j, start: 'top top+=44', end: 'bottom bottom', onRefresh: (self) => { measure(self); update(self); bridge.kick = 0; }, onUpdate: update });
    measure(st);
    update(st);
    bridge.kick = 0;
    live.current = { st, centers: () => centers };

    // Layered type: the three title layers drift apart at different depths as the hero leaves.
    gsap.to(gsap.utils.toArray<HTMLElement>('[data-depth]', j), {
      yPercent: (i: number) => [-90, -48, -20][i] ?? 0,
      ease: 'none',
      scrollTrigger: { trigger: slides[0], start: 'top top+=44', end: 'bottom top+=44', scrub: true },
    });

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
    return () => { alive = false; ro.disconnect(); window.clearTimeout(timer); live.current = null; };
  }, { scope: root, dependencies: [reduced], revertOnUpdate: true });

  // Hands on the scene. The canvas never takes pointer events: these listeners sit on the journey, are passive for
  // scrolling (touch-action: pan-y keeps vertical swipes native; the wheel is never touched) and only claim a
  // pointer once a drag is clearly horizontal.
  useEffect(() => {
    const el = journey.current;
    const box = stage.current;
    if (!el || !box) return;
    const g = { id: -1, pending: false, x0: 0, y0: 0, base: 0, samples: [] as { t: number; yaw: number }[] };
    const place = (e: PointerEvent) => {
      const r = box.getBoundingClientRect();
      input.px = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
      input.py = -(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1);
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== g.id) return;
      if (input.dragging) {
        const now = performance.now();
        const old = g.samples.find((p) => now - p.t <= 90) ?? g.samples[0];
        const last = g.samples[g.samples.length - 1];
        const dt = last && old ? (last.t - old.t) / 1000 : 0;
        input.release = dt > 0.008 ? gsap.utils.clamp(-5, 5, (last.yaw - old.yaw) / dt) : 0;
        input.dragging = false;
        setDragging(false);
      }
      if (e.pointerType === 'touch') input.over = false;
      g.id = -1;
      g.pending = false;
      bridge.invalidate?.();
    };
    const onDown = (e: PointerEvent) => {
      if (reduced || e.button !== 0 || g.id !== -1) return;
      const t = e.target as Element | null;
      // Controls, links and the caption panels stay ordinary; for a mouse the title text stays selectable too.
      if (!t || t.closest('button, a, input, [data-caption]') || (e.pointerType === 'mouse' && t.closest('[data-depth]'))) return;
      g.id = e.pointerId;
      g.pending = true;
      g.x0 = e.clientX;
      g.y0 = e.clientY;
      g.base = input.yaw;
      g.samples = [];
      if (e.pointerType === 'mouse') e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && e.pointerId !== g.id) return;
      place(e);
      input.over = true;
      if (e.pointerId === g.id) {
        const dx = e.clientX - g.x0;
        const dy = e.clientY - g.y0;
        if (g.pending && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          g.pending = false;
          input.dragging = true;
          setDragging(true);
          try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
        }
        if (input.dragging) {
          const w = Math.max(1, box.clientWidth) * DRAG_SPAN;
          input.drag = band(g.base + (dx / w) * LOOK_MAX);
          const now = performance.now();
          g.samples.push({ t: now, yaw: input.drag });
          while (g.samples.length > 2 && now - g.samples[0].t > 120) g.samples.shift();
        }
      }
      bridge.invalidate?.();
    };
    const onLeave = (e: PointerEvent) => { if (e.pointerId !== g.id) { input.over = false; bridge.invalidate?.(); } };
    // Touch pointers are implicitly captured by the element under the finger; moving the capture to the journey makes
    // that child lose it (the event bubbles here). Only the journey losing its own capture ends a drag.
    const onLost = (e: PointerEvent) => { if (e.target === el) end(e); };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', onLost);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      el.removeEventListener('lostpointercapture', onLost);
      el.removeEventListener('pointerleave', onLeave);
      input.dragging = false;
      input.over = false;
      input.hold = 0;
    };
  }, [bridge, input, reduced]);

  // The keyboard and button twin of the drag: press to glance, hold to keep looking; the view springs back on release.
  const lookProps = (dir: 1 | -1) => {
    const press = () => { input.hold = dir; input.impulse += dir * KICK; bridge.invalidate?.(); };
    const lift = () => { if (input.hold === dir) { input.hold = 0; bridge.invalidate?.(); } };
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => { if (e.button === 0) press(); },
      onPointerUp: lift,
      onPointerLeave: lift,
      onPointerCancel: lift,
      onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) press(); },
      onKeyUp: (e: KeyboardEvent<HTMLButtonElement>) => { if (e.key === ' ' || e.key === 'Enter') lift(); },
      onBlur: lift,
    };
  };

  const goTo = (i: number): void => {
    if (reduced) { setStop(CHAPTERS[i].id); setActive(i + 1); return; }
    const l = live.current;
    const c = l?.centers()[i + 1];
    if (!l || c === undefined) return;
    window.scrollTo({ top: l.st.start + c * (l.st.end - l.st.start), behavior: 'smooth' });
  };
  const current = reduced ? CHAPTERS.findIndex((c) => c.id === stop) + 1 : active;
  const rootStyle = { '--kr-release': release.easing, '--kr-release-dur': `${release.duration}ms` } as CSSProperties;

  return (
    <div ref={root} className={s.root} data-mode={reduced ? 'static' : 'scroll'} style={rootStyle}>
      <div ref={journey} className={s.journey} data-dragging={dragging || undefined}>
        <div ref={stage} className={s.stage}>
          <Poster />
          <StudioCanvas
            className={s.canvas}
            label="Kelda Ridge at night, drawn as contour lines"
            description="A 3D landscape drawn as contour lines: a lake in the foreground at dusk, a long ridge with the walking route marked in red, stars coming out, and curtains of aurora light over the northern sky. Scrolling moves the camera from the lake, along the ridge and up to the sky; the viewpoint buttons do the same. Moving the pointer aims a warm head-torch at the ground; dragging sideways or the Look buttons turn the view."
            frameloop={animate ? 'always' : 'demand'}
            disabled={off3d}
            flat
            camera={{ fov: 42, near: 0.1, far: 500, position: [...VIEWPOINTS[0].position] }}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            onCreated={() => setLit3d(true)}
            data-live={lit3d || undefined}
            fallback={
              <div className={s.fallback}>
                <Poster />
                <p className={s.fallbackNote}>A still drawing of the ridge at dusk. Every chapter below reads the same without the live scene.</p>
              </div>
            }
          >
            <Scene bridge={bridge} input={input} reduced={reduced} animate={animate} stop={stop} />
          </StudioCanvas>
          <div className={s.scrim} aria-hidden="true" />
        </div>

        <div className={s.slides}>
          <header ref={hero} className={s.heroSlide} data-slide="">
            <p className={s.kicker}>Kelda Ridge Night Walks <span aria-hidden="true">·</span> winter season <span aria-hidden="true">·</span> sample site</p>
            <h2 className={s.title}><span className={s.t1} data-depth="">Kelda</span> <span className={s.t2} data-depth="">Ridge</span></h2>
            <p className={s.lede} data-depth="">Up here the dark has detail. Guided night walks above the treeline, from dusk until the sky does what it does.</p>
            {!reduced ? <p className={s.hint} aria-hidden="true"><span>Scroll to walk the ridge ↓</span><span className={s.hintDrag}>Drag to look around ↔</span></p> : null}
          </header>
          {CHAPTERS.map((c, i) => (
            <article key={c.id} className={s.slide} data-slide="" data-side={i % 2 ? 'end' : 'start'} aria-labelledby={`kr-${c.id}`}>
              <div className={s.cap} data-caption="">
                <p className={s.capIdx}><span>{String(i + 1).padStart(2, '0')} / 03</span><span>{c.time}</span></p>
                <h3 id={`kr-${c.id}`} className={s.capTitle}>{c.title}</h3>
                <p className={s.capBody}>{c.body}</p>
                <p className={s.capMeta}>{c.meta}</p>
              </div>
            </article>
          ))}
        </div>

        <div className={s.hud}>
          <nav className={s.views} aria-label="Viewpoints">
            {CHAPTERS.map((c, i) => (
              <button key={c.id} type="button" className={s.view} aria-current={current === i + 1 ? 'step' : undefined} onClick={() => goTo(i)}>
                <span className={s.viewNum} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{c.label}
              </button>
            ))}
          </nav>
          <div className={s.ctl}>
            {!reduced ? (
              <div className={s.look} role="group" aria-label="Look around">
                <button type="button" className={s.lookBtn} aria-label="Look left" {...lookProps(1)}>
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M10 3L5 8l5 5" /></svg>
                </button>
                <span className={s.lookLabel} aria-hidden="true">Look</span>
                <button type="button" className={s.lookBtn} aria-label="Look right" {...lookProps(-1)}>
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M6 3l5 5-5 5" /></svg>
                </button>
              </div>
            ) : null}
            <div className={s.toggles}>
              {!reduced ? <button type="button" className={`${s.toggle} ${s.pauseSky}`} aria-pressed={!playing} onClick={() => setPlaying((p) => !p)}>Pause sky</button> : null}
              <button type="button" className={s.toggle} aria-pressed={off3d} onClick={() => setOff3d((o) => !o)}>Turn off 3D</button>
            </div>
          </div>
        </div>
      </div>

      <section className={s.walks} aria-labelledby="kr-walks-cap">
        <p className={s.kicker}>Winter season</p>
        <WalksTitle />
        <div className={s.tableWrap}>
          <table className={s.table}>
            <caption id="kr-walks-cap" className={s.tableCap}>Sample schedule — fictional dates and places, not bookable</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Meet</th><th scope="col">Length</th><th scope="col">Places</th></tr></thead>
            <tbody>{WALKS.map((w) => <tr key={w[0]}>{w.map((cell, i) => (i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>))}</tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className={s.bring} aria-labelledby="kr-bring">
        <h2 id="kr-bring" className={s.h2}>What to bring</h2>
        <ol className={s.bringList}>
          <li>Warm layers and a hat, even when the valley feels mild.</li>
          <li>Boots with ankle support: the path is stony near the top.</li>
          <li>A head torch with a red setting. We can lend one.</li>
          <li>Something hot to drink at the summit cairn.</li>
        </ol>
      </section>

      <section className={s.ask} aria-labelledby="kr-ask">
        <h2 id="kr-ask" className={s.askTitle}>Ask about a place on the ridge.</h2>
        <a className={s.cta} href="mailto:walks@keldaridge.example?subject=Night%20walk">Write to the guides</a>
        <p className={s.fine}>Kelda Ridge Night Walks is fictional; the schedule and places are sample data. The landscape is procedural, drawn from a seeded height field.</p>
      </section>
    </div>
  );
}
