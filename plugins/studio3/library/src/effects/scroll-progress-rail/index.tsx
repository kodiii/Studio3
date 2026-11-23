'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useIsomorphicLayoutEffect, useScrollProgress, useStudioMotion } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { sections: number; rail: string; labels: boolean; forceFallback: boolean };
type Driver = 'css' | 'js';

/** Fraction of the container height where the "reading line" sits. Mirrored by view-timeline-inset in the CSS. */
const LINE = 0.3;

/* Sample content: a fictional essay. */
const SECTIONS: readonly { name: string; paras: readonly string[] }[] = [
  { name: 'The premise', paras: [
    'For one winter the branch library on Tannery Row stayed open until midnight, four nights a week. Nobody had asked for it. The idea came from a caretaker who noticed how many people waited outside for the doors to open at nine.',
    'The trial had no budget line of its own. It ran on rearranged shifts, one borrowed heater and a rule that the kettle stayed on.',
  ] },
  { name: 'Who came after nine', paras: [
    'Not the daytime crowd shifted later, as expected. The late hours drew people who had never held a card: night-shift cleaners between jobs, students from shared flats, a man who repaired clocks and wanted a large table.',
    'Most stayed longer than daytime visitors and borrowed less. What they were using was the room.',
  ] },
  { name: 'What it cost', paras: [
    'Heating and lighting a reading room for three extra hours is a small number. Staffing it safely is not. Two people have to be in the building, and one of them has to be willing to lock up alone.',
    'The honest figure included taxis home, which no spreadsheet had a column for.',
  ] },
  { name: 'What changed', paras: [
    'The noise rules went first. A room that is half empty at eleven at night polices itself, and the staff stopped shushing within a fortnight.',
    'The second change was the shelving. Reference books nobody touched by day were pulled toward the big tables, where the night readers actually sat.',
  ] },
  { name: 'What stayed', paras: [
    'When the trial ended, two late nights were kept. The heater went back. The kettle rule, never written down, survived intact.',
    'A handwritten sign by the returns desk still reads: after nine, sit anywhere.',
  ] },
  { name: 'Open questions', paras: [
    'Whether the late readers would come in summer is not known. Nor is whether a quieter building changes who feels welcome in it by day.',
    'Both would take another winter to answer, and somebody willing to lock up.',
  ] },
];

const NEXT = ['The ferry timetable as a public document', 'Seven benches, measured', 'Why the market moved indoors'];

const pad = (n: number): string => String(n).padStart(2, '0');

export default function ScrollProgressRail({ params }: EffectProps<Params>) {
  const scroller = useRef<HTMLDivElement>(null);
  const layout = useRef<HTMLDivElement>(null);
  const pct = useRef<HTMLSpanElement>(null);
  const { reduced } = useStudioMotion();
  const [driver, setDriver] = useState<Driver>('css');
  const [supported, setSupported] = useState(true);
  const [current, setCurrent] = useState(-1);

  const count = Math.min(SECTIONS.length, Math.max(3, Math.round(params.sections)));
  const sections = SECTIONS.slice(0, count);

  // Feature detection: both the scroll-driven timeline and timeline-scope are needed for the CSS driver.
  useIsomorphicLayoutEffect(() => {
    const ok = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()') && CSS.supports('timeline-scope: --a');
    setSupported(ok);
    setDriver(ok && !params.forceFallback ? 'css' : 'js');
  }, [params.forceFallback]);

  // Fallback driver: one rAF-batched callback → read every rect, then write every property.
  useScrollProgress(
    layout,
    (p) => {
      const sc = scroller.current;
      const root = layout.current;
      if (!sc || !root) return;
      const line = sc.getBoundingClientRect().top + sc.clientHeight * LINE;
      const marks = root.querySelectorAll<HTMLElement>('[data-mark]');
      const fills = Array.from(root.querySelectorAll<HTMLElement>('[data-sec]'), (el) => {
        const r = el.getBoundingClientRect();
        return Math.min(1, Math.max(0, (line - r.top) / r.height));
      });
      fills.forEach((f, i) => marks[i]?.style.setProperty('--seg', f.toFixed(4)));
      pct.current?.style.setProperty('--spr-pct', String(Math.round(p * 100)));
    },
    { container: scroller, mode: 'contain', enabled: driver === 'js' },
  );
  // Leaving the fallback: drop the inline properties so the CSS timelines own them again.
  useEffect(() => {
    if (driver !== 'js') return;
    const root = layout.current;
    const readout = pct.current;
    return () => {
      root?.querySelectorAll<HTMLElement>('[data-mark]').forEach((m) => m.style.removeProperty('--seg'));
      readout?.style.removeProperty('--spr-pct');
    };
  }, [driver, count]);

  // ARIA state cannot come from CSS: observe which section crosses the reading line.
  useEffect(() => {
    const sc = scroller.current;
    if (!sc || typeof IntersectionObserver === 'undefined') return;
    const on = new Set<number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.sec);
          if (e.isIntersecting) on.add(i); else on.delete(i);
        }
        setCurrent(on.size ? Math.max(...on) : -1);
      },
      { root: sc, rootMargin: `-${LINE * 100}% 0px -${(1 - LINE) * 100 - 1}% 0px` },
    );
    sc.querySelectorAll('[data-sec]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [count]);

  const goTo = (i: number): void => {
    const sc = scroller.current;
    const el = sc?.querySelector<HTMLElement>(`[data-sec="${i}"]`);
    if (!sc || !el) return;
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    // Land the heading just above the reading line so the section is unambiguously current.
    sc.scrollTo({ top: Math.max(0, top - sc.clientHeight * (LINE - 0.12)), behavior: reduced ? 'auto' : 'smooth' });
    el.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
  };

  const driverLabel = driver === 'css' ? 'CSS scroll-timeline' : supported ? 'JS fallback (forced)' : 'JS fallback (no animation-timeline)';

  return (
    <div className={styles.root} data-driver={driver} data-rail={params.rail === 'top' ? 'top' : 'side'} data-labels={params.labels ? 'on' : 'off'}>
      <div ref={scroller} className={styles.scroller} tabIndex={0} role="region" aria-label="Sample article with a reading-progress rail — scroll to read">
        <div ref={layout} className={styles.layout} style={{ '--count': count } as CSSProperties}>
          <nav className={styles.rail} aria-label="Sections">
            <p className={styles.railHead}>
              <span>Reading</span>
              <span ref={pct} className={styles.pct} aria-hidden="true" />
            </p>
            <ol className={styles.marks}>
              {sections.map((s, i) => (
                <li key={s.name} className={styles.mark} data-mark={i}>
                  <button type="button" className={styles.markBtn} aria-current={current === i ? 'location' : undefined} aria-label={`Section ${i + 1}: ${s.name}`} onClick={() => goTo(i)}>
                    <span className={styles.seg} aria-hidden="true" />
                    <span className={styles.idx} aria-hidden="true">{pad(i + 1)}</span>
                    <span className={styles.name} aria-hidden="true">{s.name}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className={styles.driver}><span className={styles.driverKey}>Driver</span> {driverLabel}</p>
          </nav>

          <article className={styles.article}>
            <header className={styles.lead}>
              <p className={styles.label}>Essay · sample content</p>
              <h2 className={styles.heading}>The library that kept its lights on</h2>
              <p className={styles.standfirst}>A winter of late opening on Tannery Row, and what a reading room is for after dark.</p>
            </header>
            {sections.map((s, i) => (
              <section key={s.name} className={styles.section} data-sec={i} aria-labelledby={`spr-h-${i}`}>
                <h3 id={`spr-h-${i}`} className={styles.h3} tabIndex={-1}><span className={styles.h3Idx} aria-hidden="true">{pad(i + 1)}</span>{s.name}</h3>
                {s.paras.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
              </section>
            ))}
            <footer className={styles.colophon}>
              <p className={styles.label}>Next in this issue</p>
              <ul className={styles.next}>
                {NEXT.map((n, i) => <li key={n}><span aria-hidden="true">{pad(i + 1)}</span>{n}</li>)}
              </ul>
              <p className={styles.fine}>All people, places and events in this sample are fictional.</p>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}
