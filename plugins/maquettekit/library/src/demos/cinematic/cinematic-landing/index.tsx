'use client';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { gsapEase, useInView, useStudioMotion } from '../../../motion';
import { resolveParams, type EffectMeta, type ParamValues } from '../../../types';
import SplitLineReveal from '../../../effects/split-line-reveal';
import { meta as splitMeta } from '../../../effects/split-line-reveal/meta';
import { ArchOutline, FacadeScene, HallSection, RankDiagram, STOPS } from './art';
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

export default function CinematicLanding() {
  const { reduced } = useStudioMotion();
  const root = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<ReadonlySet<string>>(() => new Set(['diapason', 'stopped']));

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

  const toggle = (id: string) => setDrawn((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const drawnStops = STOPS.filter((st) => drawn.has(st.id));
  const speaking = drawnStops.reduce((n, st) => n + st.pipes, 0);

  return (
    <div ref={root} className={s.root} data-mode={reduced ? 'static' : 'scroll'}>
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
          <p className={s.body}>An organ&rsquo;s stops choose which ranks of pipes speak. Pull a stop to raise its rank in the drawing, to scale with a person: a stopped pipe sounds an octave lower than its length suggests.</p>
        </header>
        <ul className={s.stopList}>
          {STOPS.map((st) => (
            <li key={st.id}>
              <button type="button" className={s.stopBtn} aria-pressed={drawn.has(st.id)} onClick={() => toggle(st.id)}>
                <span className={s.knob} aria-hidden="true">{st.pitch}</span>
                <span className={s.stopText}>
                  <span className={s.stopName}>{st.name} <span className={s.stopPitch}>{st.pitch}</span></span>
                  <span className={s.stopMeta}>{st.kind} · longest pipe {st.longest}</span>
                </span>
                <span className={s.stopCount}>{st.pipes} pipes</span>
              </button>
            </li>
          ))}
        </ul>
        <figure className={s.rankFigure}>
          <RankDiagram drawn={drawn} />
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
