'use client';
import { useId, type ReactNode } from 'react';
import PollResultBars from '../../../effects/poll-result-bars';
import { meta as pollMeta } from '../../../effects/poll-result-bars/meta';
import type { EffectMeta, ParamValues } from '../../../types';
import { CLOSES } from './data';
import { MultiPoll } from './MultiPoll';
import { Quiz } from './Quiz';
import { Ranking } from './Ranking';
import styles from './styles.module.css';

const defaults = (m: EffectMeta): ParamValues => Object.fromEntries(m.params.map((p) => [p.key, p.default]));
const MHZ = [88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108];
const x = (f: number) => 8 + ((f - 87.5) / (108 - 87.5)) * 384;

/** The FM band with the station's needle at 98.2 MHz. */
function Dial() {
  return (
    <svg viewBox="0 0 400 64" className={styles.dial} aria-hidden="true" focusable="false">
      <path d="M8 40H392" className={styles.dialLine} />
      {Array.from({ length: 103 }, (_, i) => 87.6 + i * 0.2).map((f) => (
        <path key={f.toFixed(1)} d={`M${x(f).toFixed(1)} 40v${Math.abs(f - Math.round(f)) < 0.05 ? -10 : -5}`} className={styles.dialTick} />
      ))}
      {MHZ.map((f) => <text key={f} x={x(f)} y="58" textAnchor="middle" className={styles.dialNum}>{f}</text>)}
      <path d={`M${x(98.2)} 4V48`} className={styles.needle} />
      <circle cx={x(98.2)} cy="4" r="3.5" className={styles.needleCap} />
    </svg>
  );
}

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
  return (
    <div className={styles.root}>
      <header className={styles.masthead}>
        <div className={styles.mastRow}>
          <p className={styles.onAir}>On air</p>
          <p className={styles.sample}><span className="s3-label">Sample content</span> Quay FM, its shows and every count are fictional.</p>
        </div>
        <h2 className={styles.station}>Quay FM <span className={styles.freq}>98.2</span></h2>
        <p className={styles.tagline}>Community radio for the harbour. This week’s listener polls — results appear after you vote, and everything closes {CLOSES.text}.</p>
        <Dial />
      </header>

      <div className={styles.grid}>
        <Card id={`${uid}-p1`} slug="Poll 01 · single choice · Sunday book hour" title="Help pick Sunday’s reading spot" note="One answer. You can change it while the poll is open.">
          <div className={styles.composed}>
            <PollResultBars params={{ ...defaults(pollMeta), duration: 1000, stagger: 90, easing: 'emphasized', highlight: 'choice', countUp: true }} />
          </div>
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
