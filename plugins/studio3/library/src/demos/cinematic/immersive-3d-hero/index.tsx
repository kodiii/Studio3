'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useInView, useStudioMotion } from '../../../motion';
import { StudioCanvas } from '../../../three';
import { resolveParams, type EffectMeta, type ParamValues } from '../../../types';
import SplitLineReveal from '../../../effects/split-line-reveal';
import { meta as splitMeta } from '../../../effects/split-line-reveal/meta';
import { Poster } from './Poster';
import { Scene, type Bridge, type Palette } from './Scene';
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

/** Scene colours come from the theme tokens (via the demo's --kr-* variables), re-read when the theme changes. */
function usePalette(ref: RefObject<HTMLElement | null>): Palette | null {
  const [palette, setPalette] = useState<Palette | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const cs = getComputedStyle(el);
      const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
      setPalette({
        base: v('--kr-base', '#f3f0e8'), line: v('--s3-ink-muted', '#5c5a52'), index: v('--s3-ink', '#11110f'), water: v('--kr-water', '#e9e5da'),
        skyTop: v('--kr-sky-top', '#e9e5da'), horizon: v('--kr-horizon', '#f3f0e8'), aurA: v('--kr-aur-a', '#0a6e4d'), aurB: v('--kr-aur-b', '#bf2f09'),
        route: v('--s3-signal', '#bf2f09'), stars: v('--s3-ink', '#11110f'), aurora: Number.parseFloat(v('--kr-aurora', '1')) || 1,
      });
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [ref]);
  return palette;
}

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
  const bridge = useRef<Bridge>({ u: 0, invalidate: null }).current;
  const live = useRef<{ st: ScrollTrigger; centers: () => readonly number[] } | null>(null);
  const [playing, setPlaying] = useState(true);
  const [off3d, setOff3d] = useState(false);
  const [active, setActive] = useState(0);
  const [stop, setStop] = useState<StopId>('lake');
  const palette = usePalette(root);
  const animate = playing && !reduced;

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
      bridge.invalidate?.();
      let best = 0;
      centers.forEach((c, i) => { if (Math.abs(c - self.progress) < Math.abs(centers[best] - self.progress)) best = i; });
      setActive((prev) => (prev === best ? prev : best));
    };
    const st = ScrollTrigger.create({ trigger: j, start: 'top top+=44', end: 'bottom bottom', onRefresh: (self) => { measure(self); update(self); }, onUpdate: update });
    measure(st);
    update(st);
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

  const goTo = (i: number): void => {
    if (reduced) { setStop(CHAPTERS[i].id); setActive(i + 1); return; }
    const l = live.current;
    const c = l?.centers()[i + 1];
    if (!l || c === undefined) return;
    window.scrollTo({ top: l.st.start + c * (l.st.end - l.st.start), behavior: 'smooth' });
  };
  const current = reduced ? CHAPTERS.findIndex((c) => c.id === stop) + 1 : active;

  return (
    <div ref={root} className={s.root} data-mode={reduced ? 'static' : 'scroll'}>
      <div ref={journey} className={s.journey}>
        <div className={s.stage}>
          <Poster />
          <StudioCanvas
            label="Kelda Ridge at night, drawn as contour lines"
            description="A 3D landscape drawn as contour lines: a lake in the foreground, a long ridge with the walking route marked in red, stars, and bands of aurora light low in the northern sky. Scrolling moves the camera from the lake, along the ridge and up to the sky; the viewpoint buttons do the same."
            frameloop={animate ? 'always' : 'demand'}
            disabled={off3d}
            flat
            camera={{ fov: 42, near: 0.1, far: 500, position: [...VIEWPOINTS[0].position] }}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            fallback={
              <div className={s.fallback}>
                <Poster />
                <p className={s.fallbackNote}>A still drawing of the ridge. Every chapter below reads the same without the live scene.</p>
              </div>
            }
          >
            {palette ? <Scene palette={palette} bridge={bridge} reduced={reduced} animate={animate} stop={stop} /> : null}
          </StudioCanvas>
          <div className={s.scrim} aria-hidden="true" />
        </div>

        <div className={s.slides}>
          <header className={s.heroSlide} data-slide="">
            <p className={s.kicker}>Kelda Ridge Night Walks <span aria-hidden="true">·</span> winter season <span aria-hidden="true">·</span> sample site</p>
            <h2 className={s.title}><span className={s.t1} data-depth="">Kelda</span> <span className={s.t2} data-depth="">Ridge</span></h2>
            <p className={s.lede} data-depth="">Up here the dark has detail. Guided night walks above the treeline, from dusk until the sky does what it does.</p>
            {!reduced ? <p className={s.hint} aria-hidden="true">Scroll to walk the ridge ↓</p> : null}
          </header>
          {CHAPTERS.map((c, i) => (
            <article key={c.id} className={s.slide} data-slide="" data-side={i % 2 ? 'end' : 'start'} aria-labelledby={`kr-${c.id}`}>
              <div className={s.cap}>
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
            {!reduced ? <button type="button" className={s.toggle} aria-pressed={!playing} onClick={() => setPlaying((p) => !p)}>Pause sky</button> : null}
            <button type="button" className={s.toggle} aria-pressed={off3d} onClick={() => setOff3d((o) => !o)}>Turn off 3D</button>
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
