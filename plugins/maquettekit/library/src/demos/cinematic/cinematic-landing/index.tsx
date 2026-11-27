'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { gsapEase, spring, springToLinear, useInView, useStudioMotion } from '../../../motion';
import { resolveParams, type EffectMeta, type ParamValues } from '../../../types';
import SplitLineReveal from '../../../effects/split-line-reveal';
import { meta as splitMeta } from '../../../effects/split-line-reveal/meta';
import { ArchOutline, FacadeScene, HallSection, RankDiagram, STOPS, type Stop } from './art';
import s from './styles.module.css';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Every recipe param from its meta (defaults), then this demo's overrides. */
const recipe = <T,>(m: EffectMeta, overrides: ParamValues = {}): T => resolveParams(m.params, overrides) as unknown as T;

const NAV = [
  { id: 'lw-room', label: 'Room' },
  { id: 'lw-opus', label: 'Opus 31' },
  { id: 'lw-stops', label: 'Stops' },
  { id: 'lw-recital', label: 'Recital' },
] as const;

function RoomTitle() {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { amount: 0.6 });
  const { reduced } = useStudioMotion();
  const text = 'Most halls are built for the eye, not the ear.';
  return (
    <div ref={ref} className={s.roomTitle}>
      {near || reduced ? <SplitLineReveal params={recipe(splitMeta, { text, stagger: 60, duration: 880, rise: 112, skew: true })} /> : <h2 className={s.placeholder}>{text}</h2>}
    </div>
  );
}

/** Drawknob travel (px): in at 0, out at OUT; the detents sit at PULL (drawing) and PUSH (retiring). */
const OUT = 14;
const PULL = 9;
const PUSH = 5;
/** Resistance: the knob lags the hand more and more up to the detent (asymptote just past it), then clicks over. */
const drawn = (raw: number): number => (raw >= 0 ? 11 * (1 - Math.exp(-raw / 30)) : -2.5 * (1 - Math.exp(raw / 8)));
const retired = (raw: number): number => (raw <= 0 ? OUT - 11 * (1 - Math.exp(raw / 30)) : OUT + 5 * (1 - Math.exp(-raw / 18)));

/**
 * One stop as a drawknob you can pull. Drag the row sideways: the knob comes out against growing resistance, clicks
 * over its detent (the stop is drawn the moment it crosses), and on release a spring.press token settles it with the
 * hand's velocity. A tap, Enter or Space toggle it as before; the button stays the single, named control.
 */
function StopKnob({ st, on, onSet, reduced }: { st: Stop; on: boolean; onSet: (id: string, on: boolean) => void; reduced: boolean }) {
  const btn = useRef<HTMLButtonElement>(null);
  const face = useRef<HTMLSpanElement>(null);
  const g = useRef({ id: -1, x0: 0, on, x: on ? OUT : 0, v: 0, moved: false, raf: 0, samples: [] as { t: number; x: number }[] });
  useEffect(() => { g.current.on = on; }, [on]);
  useEffect(() => () => cancelAnimationFrame(g.current.raf), []);

  const write = (x: number | null) => {
    const el = btn.current;
    if (!el) return;
    if (x === null) { el.style.removeProperty('--pull'); el.removeAttribute('data-dragging'); }
    else { el.style.setProperty('--pull', x.toFixed(2)); el.setAttribute('data-dragging', ''); }
  };
  const click = () => {
    if (reduced) return;
    face.current?.animate([{ scale: '1' }, { scale: '1.07' }, { scale: '1' }], { duration: 180, easing: 'ease-out' });
  };
  const settle = () => {
    const k = g.current;
    cancelAnimationFrame(k.raf);
    const target = k.on ? OUT : 0;
    if (reduced) { write(null); return; }
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      for (let i = 0; i < n; i++) {
        k.v += ((-spring.press.stiffness * (k.x - target) - spring.press.damping * k.v) / spring.press.mass) * (dt / n);
        k.x += k.v * (dt / n);
      }
      if (Math.abs(k.x - target) < 0.02 && Math.abs(k.v) < 0.5) { k.x = target; k.v = 0; write(null); return; }
      write(k.x);
      k.raf = requestAnimationFrame(step);
    };
    k.raf = requestAnimationFrame(step);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const k = g.current;
    cancelAnimationFrame(k.raf);
    k.id = e.pointerId;
    k.x0 = e.clientX;
    k.moved = false;
    k.samples = [];
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const k = g.current;
    if (e.pointerId !== k.id) return;
    const raw = e.clientX - k.x0;
    if (!k.moved) {
      if (Math.abs(raw) < 5) return;
      k.moved = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* gone */ }
    }
    let x = k.on ? retired(raw) : drawn(raw);
    // The detent: crossing it changes the stop at once, then the drag carries on from the new rest position.
    if (!k.on && x >= PULL) { k.on = true; onSet(st.id, true); click(); k.x0 = e.clientX; x = OUT; }
    else if (k.on && x <= PUSH) { k.on = false; onSet(st.id, false); click(); k.x0 = e.clientX; x = 0; }
    k.x = x;
    const now = performance.now();
    k.samples.push({ t: now, x });
    while (k.samples.length > 2 && now - k.samples[0].t > 100) k.samples.shift();
    write(x);
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const k = g.current;
    if (e.pointerId !== k.id) return;
    k.id = -1;
    if (!k.moved) return;
    const a = k.samples[0];
    const b = k.samples[k.samples.length - 1];
    k.v = a && b && b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
    settle();
    // The click that follows this pointerup (if any) is swallowed; after that, taps and keys toggle again.
    window.setTimeout(() => { k.moved = false; }, 0);
  };

  return (
    <button
      ref={btn}
      type="button"
      className={s.stopBtn}
      aria-pressed={on}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClick={(e) => {
        // A drag already set the stop at its detent; only a tap (or Enter / Space) toggles here.
        if (g.current.moved && e.detail !== 0) { g.current.moved = false; e.preventDefault(); return; }
        g.current.x = on ? 0 : OUT;
        onSet(st.id, !on);
      }}
    >
      <span className={s.knob} aria-hidden="true"><span ref={face} className={s.knobFace}>{st.pitch}</span></span>
      <span className={s.stopText}>
        <span className={s.stopName}>{st.name} <span className={s.stopPitch}>{st.pitch}</span></span>
        <span className={s.stopMeta}>{st.kind} · longest pipe {st.longest}</span>
      </span>
      <span className={s.stopCount}>{st.pipes} pipes</span>
    </button>
  );
}

export default function CinematicLanding() {
  const { reduced } = useStudioMotion();
  const root = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [drawnSet, setDrawn] = useState<ReadonlySet<string>>(() => new Set(['diapason', 'stopped']));
  const springs = useMemo(() => ({ press: springToLinear(spring.press), pop: springToLinear(spring.pop) }), []);

  // Light through the arch and wind in the pipes. The pointer is where the light comes from: the glow, the shafts and
  // each pipe's highlight lean toward it and the façade layers part in depth. Scroll speed is wind: the glow swells
  // and the shafts brighten, then breathe out. One rAF loop that sleeps once everything has settled.
  useEffect(() => {
    const el = root.current;
    if (!el || reduced) return;
    const fine = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;
    const st = { tx: -0.35, ty: -0.3, x: -0.35, y: -0.3, wind: 0, windT: 0, last: 0, sy: window.scrollY, st: performance.now(), raf: 0, written: '' };
    const sheens = Array.from(el.querySelectorAll<SVGLinearGradientElement>('[data-sheen]'));
    const scenes = Array.from(el.querySelectorAll<HTMLElement>('[data-facade]'));
    const tick = (now: number) => {
      st.raf = 0;
      const dt = Math.min(0.05, st.last ? (now - st.last) / 1000 : 0.016);
      st.last = now;
      const k = 1 - Math.exp(-dt * 4.5);
      st.x += (st.tx - st.x) * k;
      st.y += (st.ty - st.y) * k;
      st.wind += (st.windT - st.wind) * (1 - Math.exp(-dt * (st.windT > st.wind ? 9 : 1.5)));
      st.windT *= Math.exp(-dt * 3.5);
      const key = `${st.x.toFixed(3)} ${st.y.toFixed(3)} ${st.wind.toFixed(3)}`;
      if (key !== st.written) {
        st.written = key;
        for (const sc of scenes) {
          sc.style.setProperty('--lw-px', st.x.toFixed(3));
          sc.style.setProperty('--lw-py', st.y.toFixed(3));
          sc.style.setProperty('--lw-wind', st.wind.toFixed(3));
        }
        for (const gr of sheens) gr.setAttribute('gradientTransform', `translate(${(st.x * 0.13 * Number(gr.dataset.sheen ?? 1)).toFixed(4)} 0)`);
      }
      const busy = Math.abs(st.tx - st.x) + Math.abs(st.ty - st.y) > 0.001 || st.wind > 0.002 || st.windT > 0.002;
      if (busy) st.raf = requestAnimationFrame(tick);
      else st.last = 0;
    };
    const wake = () => { if (!st.raf) st.raf = requestAnimationFrame(tick); };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      st.tx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      st.ty = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      wake();
    };
    const onScroll = () => {
      const now = performance.now();
      const y = window.scrollY;
      const v = (Math.abs(y - st.sy) / Math.max(8, now - st.st)) * 1000;
      st.sy = y;
      st.st = now;
      st.windT = Math.max(st.windT, Math.min(1, Math.max(0, (v - 500) / 3000)));
      wake();
    };
    if (fine) el.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    wake();
    return () => {
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(st.raf);
      for (const sc of scenes) { sc.style.removeProperty('--lw-px'); sc.style.removeProperty('--lw-py'); sc.style.removeProperty('--lw-wind'); }
      for (const gr of sheens) gr.removeAttribute('gradientTransform');
    };
  }, [reduced]);

  useGSAP(() => {
    const el = root.current;
    if (!el || reduced) return;
    const q = gsap.utils.selector(el);
    const win = q('[data-hero-window]')[0];

    // Beat 1 — the headline is painted with the page; only the window fills with light around it.
    gsap.timeline({ defaults: { ease: gsapEase.emphasized } })
      .from(win, { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.3 })
      .from(q('[data-hero-window] [data-layer]'), { yPercent: 7, duration: 1.6, stagger: 0.08 }, 0.1)
      .from(q('[data-hero-rule]'), { scaleX: 0, transformOrigin: '0% 50%', duration: 1.1 }, 0.25);
    // …and as the hook scrolls away its lines leave through their masks (reversible: scrubbed).
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: q('[data-beat="hook"]')[0], start: 'top+=12% top+=44', end: 'bottom top+=44', scrub: 0.4 } })
      .to(q('[data-hero-line]'), { yPercent: -108, stagger: 0.12 }, 0)
      .to(win, { yPercent: -12 }, 0);

    // Beat 2 — sound rays draw once as the hall section comes into view.
    gsap.fromTo(q('[data-ray]'), { strokeDashoffset: 1 }, {
      strokeDashoffset: 0, duration: 1.4, stagger: 0.16, ease: 'power2.inOut',
      scrollTrigger: { trigger: q('[data-hall]')[0], start: 'top 72%', once: true },
    });

    // Beat 3 — the turn: the arch window grows until we are inside the case, then the façade parts.
    const cut = q('[data-turn-scene]')[0];
    const layer = (k: string) => q(`[data-turn-scene] [data-layer="${k}"]`);
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: q('[data-beat="turn"]')[0], start: 'top top+=44', end: 'bottom bottom', scrub: 0.6, invalidateOnRefresh: true } })
      .to({}, { duration: 0.5 })
      .to(q('[data-cap-a] [data-line]'), { yPercent: -112, duration: 0.35, stagger: 0.05, ease: 'power2.in' }, 0.5)
      .fromTo(cut, { '--arch': 64 }, { '--arch': 1500, duration: 1.2, ease: 'power2.in' }, 0.55)
      .fromTo([...layer('frontL'), ...layer('frontR'), ...layer('impost')], { scale: 1 }, { scale: 1.16, duration: 1.2, ease: 'power1.in' }, 0.55)
      .fromTo(layer('mid'), { scale: 1 }, { scale: 1.06, duration: 1.2 }, 0.55)
      .to(layer('frontL'), { xPercent: -36, duration: 1, ease: 'power2.inOut' }, 1.75)
      .to(layer('frontR'), { xPercent: 36, duration: 1, ease: 'power2.inOut' }, 1.75)
      .to(layer('impost'), { yPercent: 8, duration: 1, ease: 'power2.inOut' }, 1.75)
      .to(layer('mid'), { scale: 1.12, duration: 1 }, 1.75)
      .fromTo(q('[data-cap-b]'), { opacity: 0 }, { opacity: 1, duration: 0.15 }, 2.3)
      .fromTo(q('[data-cap-b] [data-line]'), { yPercent: 112 }, { yPercent: 0, duration: 0.4, stagger: 0.06, ease: 'power3.out' }, 2.35)
      .to({}, { duration: 0.9 });

    // Dynamic navigation: hides while reading downwards, returns on any upward scroll (and on focus, in CSS).
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        const hide = self.direction === 1 && self.scroll() > 320;
        setHidden((h) => (h === hide ? h : hide));
      },
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
    return () => { alive = false; ro.disconnect(); window.clearTimeout(timer); setHidden(false); };
  }, { scope: root, dependencies: [reduced], revertOnUpdate: true });

  // aria-current follows the section that holds the middle of the screen.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setCurrent(e.target.id);
    }, { rootMargin: '-45% 0px -50% 0px' });
    NAV.forEach((n) => { const t = el.querySelector(`#${n.id}`); if (t) io.observe(t); });
    const top = el.querySelector('#lw-hook');
    if (top) io.observe(top);
    return () => io.disconnect();
  }, [reduced]);

  const setStop = (id: string, on: boolean) => setDrawn((prev) => {
    if (prev.has(id) === on) return prev;
    const next = new Set(prev);
    if (on) next.add(id); else next.delete(id);
    return next;
  });
  const drawnStops = STOPS.filter((st) => drawnSet.has(st.id));
  const rootStyle = {
    '--lw-press': springs.press.easing, '--lw-press-dur': `${springs.press.duration}ms`,
    '--lw-pop': springs.pop.easing, '--lw-pop-dur': `${springs.pop.duration}ms`,
  } as CSSProperties;
  const speaking = drawnStops.reduce((n, st) => n + st.pipes, 0);

  return (
    <div ref={root} className={s.root} data-mode={reduced ? 'static' : 'scroll'} style={rootStyle}>
      <header className={s.nav} data-hidden={hidden || undefined}>
        <a className={s.brand} href="#lw-hook">Larkwell <span>Organ Works</span></a>
        <nav aria-label="Opus 31">
          <ul className={s.navList}>
            {NAV.map((n) => (
              <li key={n.id}><a className={s.navLink} href={`#${n.id}`} aria-current={current === n.id ? 'location' : undefined}>{n.label}</a></li>
            ))}
          </ul>
        </nav>
      </header>

      {/* Beat 1 — Hook */}
      <section id="lw-hook" className={s.hero} data-beat="hook" aria-labelledby="lw-hook-h">
        <div className={s.heroText}>
          <p className={s.kicker}>Larkwell Organ Works <span aria-hidden="true">·</span> Opus 31 <span aria-hidden="true">·</span> sample site</p>
          <h2 id="lw-hook-h" className={s.heroTitle}>
            <span className={s.heroLine}><span data-hero-line="">A building</span></span>
            <span className={s.heroLine}><span data-hero-line="">that breathes<span className={s.stop}>.</span></span></span>
          </h2>
          <span className={s.heroRule} data-hero-rule="" aria-hidden="true" />
          <p className={s.heroIntro}>Opus 31 is a chamber organ built for one room: St Aldhelm&rsquo;s Hall. Seven stops, one oak case, and every pipe voiced in the hall it will live in.</p>
        </div>
        <figure className={s.heroFigure}>
          <div className={s.heroWindow} data-hero-window="">
            <FacadeScene />
          </div>
          <figcaption className={s.caption}>Façade of Opus 31 through the west window (drawing)</figcaption>
        </figure>
      </section>

      {/* Beat 2 — Tension */}
      <section id="lw-room" className={s.room} aria-labelledby="lw-room-k">
        <div className={s.roomText}>
          <p id="lw-room-k" className={s.kicker}>01 — The room</p>
          <RoomTitle />
          <p className={s.body}>Glass, plasterboard and soft seats swallow sound. An organ voiced in a workshop and wheeled into such a room arrives already wrong.</p>
          <p className={s.body}>So Opus 31 was planned from the room outwards. The hall has a hard vault, a timber floor and a west gallery; the pipes were voiced there, at night, one at a time.</p>
        </div>
        <figure className={s.hallFigure} data-hall="">
          <HallSection />
          <figcaption className={s.caption}>Section through the hall: sound from the gallery reaches the seats by way of the vault.</figcaption>
        </figure>
        <a className={s.skip} href="#lw-stops">Skip the opening of the case</a>
      </section>

      {/* Beat 3 — Turn (pinned with CSS sticky, scrubbed) */}
      <section id="lw-opus" className={s.turn} data-beat="turn" aria-labelledby="lw-opus-h">
        <div className={s.turnFrame}>
          <div className={s.turnScene} data-turn-scene="">
            <FacadeScene />
          </div>
          <div className={s.capA} data-cap-a="">
            <p className={s.capLine}><span data-line="" className={s.kicker}>02 — Behind the façade</span></p>
            <h2 id="lw-opus-h" className={`${s.capLine} ${s.capTitle}`}><span data-line="">Opus 31.</span></h2>
            <p className={s.capLine}><span data-line="" className={s.capText}>{reduced ? 'Inside the case: the façade, its pipes and the ranks behind them.' : 'Keep scrolling: the window opens into the case.'}</span></p>
          </div>
          <div className={s.capB} data-cap-b="">
            <h3 className={`${s.capLine} ${s.capBTitle}`}><span data-line="">398 pipes. One wind.</span></h3>
            <p className={s.capLine}><span data-line="" className={s.capBText}>Eight ranks stand on a single oak wind chest. One bellows feeds them all, through sliders you can see from the gallery stairs.</span></p>
          </div>
        </div>
      </section>

      {/* Beat 4 — Proof */}
      <section id="lw-stops" className={s.stops} aria-labelledby="lw-stops-h" tabIndex={-1}>
        <header className={s.stopsHead}>
          <p className={s.kicker}>03 — Specification <span aria-hidden="true">·</span> sample content</p>
          <h2 id="lw-stops-h" className={s.stopsTitle}>Seven stops. Pull one.</h2>
          <p className={s.body}>An organ&rsquo;s stops choose which ranks of pipes speak. Pull a knob out (drag it, or press the stop) to raise its rank in the drawing, to scale with a person: a stopped pipe sounds an octave lower than its length suggests.</p>
        </header>
        <ul className={s.stopList}>
          {STOPS.map((st) => (
            <li key={st.id}><StopKnob st={st} on={drawnSet.has(st.id)} onSet={setStop} reduced={reduced} /></li>
          ))}
        </ul>
        <figure className={s.rankFigure}>
          <RankDiagram drawn={drawnSet} />
          <figcaption className={s.summary} aria-live="polite">
            {drawnStops.length
              ? <>Drawn: {drawnStops.map((st) => `${st.name} ${st.pitch}`).join(', ')}. {speaking} pipes speaking.</>
              : <>No stops drawn. The organ is silent.</>}
          </figcaption>
        </figure>
      </section>

      {/* Beat 5 — Resolution: still, one action */}
      <section id="lw-recital" className={s.recital} aria-labelledby="lw-recital-h">
        <div className={s.recitalText}>
          <p className={s.kicker}>04 — First recital</p>
          <h2 id="lw-recital-h" className={s.date}>Saturday<br />13 March 2027</h2>
          <dl className={s.facts}>
            <div><dt>Where</dt><dd>St Aldhelm&rsquo;s Hall, Orrisford</dd></div>
            <div><dt>When</dt><dd>19:30, doors at 19:00</dd></div>
            <div><dt>Seats</dt><dd>Free, by request</dd></div>
          </dl>
          <a className={s.cta} href="mailto:recital@larkwell.example?subject=Opus%2031%20first%20recital">Ask for a seat</a>
          <p className={s.fine}>Sample page: Larkwell Organ Works, Opus 31, St Aldhelm&rsquo;s Hall and the recital are fictional.</p>
        </div>
        <ArchOutline />
      </section>
    </div>
  );
}
