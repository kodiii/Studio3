'use client';
import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import SplitLineReveal from '../../../effects/split-line-reveal';
import { meta as splitMeta } from '../../../effects/split-line-reveal/meta';
import { spring as SPRING, springToLinear, useStudioMotion } from '../../../motion';
import type { ParamSpec, ParamValues } from '../../../types';
import { RESEND_DIFF } from './content';
import { HeroWindow } from './HeroWindow';
import { Inbox } from './Inbox';
import { Cta, Faq, HowItWorks, Indicator, Pricing, Section, useIndicator, useReveal } from './parts';
import styles from './styles.module.css';

const defaults = (specs: readonly ParamSpec[]): ParamValues => Object.fromEntries(specs.map((s) => [s.key, s.default]));
/* Springs sampled once into CSS linear() curves for presses, releases and settling indicators. */
const PRESS = springToLinear(SPRING.press);
const SETTLE = springToLinear(SPRING.settle);
const SPRINGS = { '--press': PRESS.easing, '--press-dur': `${PRESS.duration}ms`, '--settle': SETTLE.easing, '--settle-dur': `${SETTLE.duration}ms` } as CSSProperties;

const LINKS = [
  { id: 'tarn-how', label: 'How it works' },
  { id: 'tarn-pricing', label: 'Pricing' },
  { id: 'tarn-faq', label: 'FAQ' },
] as const;

const CAPABILITIES = [
  { t: 'Search any field', d: 'Find the delivery behind a support ticket by customer, amount or status.', code: 'data.customer:cus_Lm20 status:500' },
  { t: 'Redact before storage', d: 'Mask card numbers and email addresses before a byte is written.', code: 'mask data.card.* data.email' },
  { t: 'Forward to several targets', d: 'Fan one inbox out to staging and a teammate’s laptop at the same time.', code: 'forward → staging, laptop:sam' },
  { t: 'Alerts that wait for a pattern', d: 'An email or chat message after three 5xx answers in a row, not on the first blip.', code: 'alert when 3 × status ≥ 500' },
];

export default function SaasLanding() {
  const uid = useId();
  const { reduced } = useStudioMotion();
  const [current, setCurrent] = useState(-1);
  const [menu, setMenu] = useState(false);
  const navList = useRef<HTMLDivElement>(null);
  const ind = useIndicator(navList, current);
  const headings = useRef<Record<string, HTMLHeadingElement | null>>({});
  const menuBtn = useRef<HTMLButtonElement>(null);
  const revealRoot = useReveal(!reduced);

  // Scroll spy: the section crossing the middle band of the viewport is "current".
  useEffect(() => {
    const els = LINKS.map((l) => document.getElementById(l.id)).filter((e): e is HTMLElement => !!e);
    if (typeof IntersectionObserver === 'undefined' || !els.length) return;
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target, e.isIntersecting);
      let idx = -1;
      els.forEach((el, i) => { if (seen.get(el)) idx = i; });
      setCurrent(idx);
    }, { rootMargin: '-35% 0px -55% 0px' });
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); menuBtn.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menu]);

  /** In-page navigation: scroll (smooth unless reduced), keep the URL linkable, move focus to the section heading. */
  const go = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    setMenu(false);
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    window.history.pushState(null, '', `#${id}`);
    headings.current[id]?.focus({ preventScroll: true });
  };
  const headingRef = (id: string) => (el: HTMLHeadingElement | null) => { headings.current[id] = el; };

  return (
    <div className={styles.root} data-reduced={reduced || undefined} ref={revealRoot} style={SPRINGS}>
      <header className={styles.nav}>
        <a className={styles.brand} href="#tarn-top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 15c3-2 6-2 9 0s6 2 9 0" /><path d="M3 10c3-2 6-2 9 0s6 2 9 0" /><path d="M5 5h14" /></svg>
          Tarn
        </a>
        <nav aria-label="Sections" className={styles.navLinks}>
          <div ref={navList} className={styles.navTrack}>
          <Indicator state={ind} className={styles.navInd} />
          <ul className={styles.navList}>
            {LINKS.map((l, i) => (
              <li key={l.id}>
                <a data-ind href={`#${l.id}`} className={styles.navLink} aria-current={current === i ? 'true' : undefined} onClick={(e) => go(e, l.id)}>{l.label}</a>
              </li>
            ))}
          </ul>
          </div>
        </nav>
        <div className={styles.navEnd}>
          <button ref={menuBtn} type="button" className={styles.menuBtn} aria-expanded={menu} aria-controls={`${uid}menu`} onClick={() => setMenu((m) => !m)}>
            {menu ? 'Close' : 'Menu'}
          </button>
          <a className={styles.navCta} href="#tarn-start" onClick={(e) => go(e, 'tarn-start')}>Create a free inbox</a>
        </div>
        <div id={`${uid}menu`} className={styles.menu} hidden={!menu}>
          <ul>{LINKS.map((l) => <li key={l.id}><a href={`#${l.id}`} onClick={(e) => go(e, l.id)}>{l.label}</a></li>)}</ul>
        </div>
      </header>

      <section className={styles.hero} aria-label="Tarn, a webhook inbox">
        <div className={styles.heroCopy}>
          <p className={styles.category}><span className={styles.lake} aria-hidden="true" />Webhook inbox for backend teams</p>
          <div className={styles.headline}>
            <SplitLineReveal params={{ ...defaults(splitMeta.params), text: 'Replay yesterday’s webhooks against today’s code.', stagger: 36, duration: 640, rise: 105, skew: false }} />
          </div>
          <p className={styles.lede}>Tarn keeps every webhook your payments provider, shop or CRM sends, byte for byte. Search it, compare it, and replay it to localhost, staging or production, so a fix is tested on the exact delivery that broke.</p>
          <div className={styles.heroActions}>
            <Cta magnetic reduced={reduced} />
            <a className={styles.textLink} href="#tarn-how" onClick={(e) => go(e, 'tarn-how')}>See how replay works</a>
          </div>
        </div>
        <HeroWindow reduced={reduced}>
          <Inbox reduced={reduced} />
        </HeroWindow>
      </section>

      <Section id="tarn-how" label="How it works" title="Capture, inspect, replay." headingRef={headingRef('tarn-how')}
        intro="Three steps, each shown with the real interface. Try them: nothing here leaves the page.">
        <HowItWorks reduced={reduced} />
      </Section>

      <section className={styles.differ} aria-labelledby={`${uid}differ`}>
        <div className={styles.differCopy} data-reveal="in">
          <p className={styles.kicker}>Why replay, not re-send</p>
          <h2 id={`${uid}differ`} className={styles.h2}>A re-send is a new delivery. A replay is the same one.</h2>
          <p className={styles.intro}>Most providers can re-send an event, but it arrives with a new id, a new timestamp and sometimes a newer API version. If the bug depended on any of those, the re-send passes while the original still fails. Tarn sends back the stored bytes, so a fix that works on the replay works on the delivery that broke.</p>
        </div>
        <div className={styles.compareWrap} data-reveal="in">
          <table className={styles.compare}>
            <caption className={styles.srOnly}>What changes between the original delivery, a provider re-send and a Tarn replay (sample values)</caption>
            <thead>
              <tr><th scope="col">Field</th><th scope="col">Original</th><th scope="col">Provider re-send</th><th scope="col">Tarn replay</th></tr>
            </thead>
            <tbody>
              {RESEND_DIFF.map((r) => {
                const changed = r.original !== r.resent;
                return (
                  <tr key={r.key}>
                    <th scope="row">{r.key}</th>
                    <td>{r.original}</td>
                    <td data-changed={changed || undefined}>{r.resent}{changed ? <span className={styles.changed}>changed</span> : null}</td>
                    <td>{r.original}<span className={styles.same}>same</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.caps} aria-labelledby={`${uid}caps`}>
        <h2 id={`${uid}caps`} className={styles.capsTitle}>And the things you will need on the second day</h2>
        <ul className={styles.capList}>
          {CAPABILITIES.map((c, i) => (
            <li key={c.t} data-reveal="in" style={{ '--i': i } as CSSProperties}>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
              <code className={styles.capCode}>{c.code}</code>
            </li>
          ))}
        </ul>
      </section>

      <Section id="tarn-pricing" label="Pricing" title="Pay for deliveries, not seats." headingRef={headingRef('tarn-pricing')}
        intro="Every plan stores and replays the same way; they differ in volume, retention and where you can replay to. Prices include everything listed.">
        <Pricing reduced={reduced} />
      </Section>

      <Section id="tarn-faq" label="Before you point production at it" title="Questions teams ask first" headingRef={headingRef('tarn-faq')}>
        <Faq />
      </Section>

      <section id="tarn-start" className={styles.final} aria-labelledby="tarn-start-h">
        <h2 id="tarn-start-h" ref={headingRef('tarn-start')} tabIndex={-1} className={styles.finalTitle}>Create an inbox, point one provider at it, and replay the next failure.</h2>
        <Cta note="Takes about two minutes. Free up to 10,000 deliveries a month, no card." />
      </section>

      <footer className={styles.footer}>
        <p className={styles.footBrand}>Tarn</p>
        <nav aria-label="Footer">
          <ul className={styles.footLinks}>{LINKS.map((l) => <li key={l.id}><a href={`#${l.id}`} onClick={(e) => go(e, l.id)}>{l.label}</a></li>)}</ul>
        </nav>
        <p className={styles.footNote}>Tarn is a fictional product made for the Maquettekit library. Every URL uses the reserved .example domain; payloads, plans and prices are sample data.</p>
      </footer>
    </div>
  );
}
