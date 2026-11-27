'use client';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { spring, springToLinear, useStudioMotion } from '../../../motion';
import { CLOSES } from './data';
import { MultiPoll } from './MultiPoll';
import { Quiz } from './Quiz';
import { Ranking } from './Ranking';
import { SinglePoll } from './SinglePoll';
import { Tuner } from './Tuner';
import styles from './styles.module.css';

const PRESS = springToLinear(spring.press);
const SETTLE = springToLinear(spring.settle);
function Card({ id, slug, title, note, children, wide }: { id: string; slug: string; title: string; note: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={styles.cue} data-wide={wide || undefined} aria-labelledby={id}>
      <p className={styles.slug}>{slug}</p>
      <h3 id={id} className={styles.cueTitle}>{title}</h3>
      <p className={styles.small}>{note}</p>
      {children}
    </section>
  );
}

export default function InteractivePoll() {
  const uid = useId();
  const { reduced } = useStudioMotion();
  const vars = { '--qf-press': PRESS.easing, '--qf-press-dur': `${PRESS.duration}ms`, '--qf-settle': SETTLE.easing, '--qf-settle-dur': `${SETTLE.duration}ms` } as CSSProperties;
  return (
    <div className={styles.root} style={vars} data-reduced={reduced || undefined}>
      <header className={styles.masthead}>
        <div className={styles.mastRow}>
          <p className={styles.onAir}>On air</p>
          <p className={styles.sample}><span className="mk-label">Sample content</span> Quay FM, its shows and every count are fictional.</p>
        </div>
        <h2 className={styles.station}>Quay FM <span className={styles.freq}>98.2</span></h2>
        <p className={styles.tagline}>Community radio for the harbour. This week’s listener polls — results appear after you vote, and everything closes {CLOSES.text}.</p>
        <Tuner />
      </header>

      <div className={styles.grid}>
        <Card id={`${uid}-p1`} slug="Poll 01 · single choice · Sunday book hour" title="Help pick Sunday’s reading spot" note="For the book hour on Sunday afternoon: the presenter reads from the listeners’ favourite spot.">
          <SinglePoll />
        </Card>

        <Card id={`${uid}-p2`} slug="Poll 02 · multiple choice · morning listening" title="When are you with us?" note="Shaping next season’s schedule. Tick every slot you listen to.">
          <MultiPoll />
        </Card>

        <Card id={`${uid}-p3`} slug="Quiz · three questions · no timer" title="Were you listening this week?" note="Each answer comes with the explanation from the show.">
          <Quiz />
        </Card>

        <Card id={`${uid}-p4`} slug="Poll 03 · ranking · tomorrow 07:00" title="Order tomorrow’s Early Edit" note="Drag the handles — or focus one, press Space, use ↑ ↓, Space to drop — then send your order. The producer reads the listeners’ order on air." wide>
          <Ranking />
        </Card>
      </div>

      <footer className={styles.footer}>
        <p>Quay FM 98.2, The Early Edit and every vote, ballot and listener count on this page are sample content. Live votes are simulated in your browser and labelled where they appear. Nothing you choose is sent anywhere.</p>
      </footer>
    </div>
  );
}
