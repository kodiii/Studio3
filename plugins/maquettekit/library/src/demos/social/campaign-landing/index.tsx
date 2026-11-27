'use client';
import { useId, useRef, useState, type CSSProperties } from 'react';
import SplitLineReveal from '../../../effects/split-line-reveal';
import { meta as splitMeta } from '../../../effects/split-line-reveal/meta';
import { spring, springToLinear, useStudioMotion } from '../../../motion';
import type { EffectMeta, ParamValues } from '../../../types';
import { Gallery } from './Gallery';
import { HeroBackdrop } from './HeroBackdrop';
import { NeedlePatch } from './NeedlePatch';
import { Leaderboard } from './Leaderboard';
import { PledgeForm, type Pledge } from './PledgeForm';
import { ShareCard } from './ShareCard';
import styles from './styles.module.css';

const defaults = (m: EffectMeta): ParamValues => Object.fromEntries(m.params.map((p) => [p.key, p.default]));
const PRESS = springToLinear(spring.press);
const SETTLE = springToLinear(spring.settle);
const GLIDE = springToLinear(spring.glide);
export default function CampaignLanding() {
  const uid = useId();
  const { reduced } = useStudioMotion();
  const hero = useRef<HTMLElement>(null);
  const [pledge, setPledge] = useState<Pledge | null>(null);
  const a = (s: string) => `${uid}-${s}`;
  const vars = {
    '--mm-press': PRESS.easing, '--mm-press-dur': `${PRESS.duration}ms`,
    '--mm-settle': SETTLE.easing, '--mm-settle-dur': `${SETTLE.duration}ms`,
    '--mm-glide': GLIDE.easing, '--mm-glide-dur': `${GLIDE.duration}ms`,
  } as CSSProperties;
  return (
    <div className={styles.root} style={vars} data-reduced={reduced || undefined}>
      <section ref={hero} className={styles.hero} aria-labelledby={a('hero')}>
        <HeroBackdrop hero={hero} />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>The Mending Commons · fourth year · sample campaign</p>
            <div id={a('hero')} className={styles.headline}>
              <SplitLineReveal params={{ ...defaults(splitMeta), text: 'Mend one thing this March.', stagger: 70, duration: 900, rise: 110, skew: true }} />
            </div>
            <p className={styles.lede}>
              A month-long, city-wide repair challenge. Bring something broken to one of six volunteer repair cafés, or fix it
              at home, and post the before and after if you want to.
            </p>
            <dl className={styles.when}>
              <div><dt>When</dt><dd>1–31 March 2027</dd></div>
              <div><dt>Cost</dt><dd>Free</dd></div>
              <div><dt>Prizes</dt><dd>None, on purpose</dd></div>
            </dl>
            <div className={styles.heroCtas}>
              <a href={`#${a('pledge')}`} className={styles.primary}>Pledge a mend</a>
              <a href={`#${a('gallery')}`} className={styles.ghostOnDenim}>See last year’s mends</a>
            </div>
          </div>
          <NeedlePatch />
        </div>
      </section>

      <div className={styles.page}>
        <section className={styles.section} aria-labelledby={a('how')}>
          <h2 id={a('how')} className={styles.h2}>How to join</h2>
          <ol className={styles.steps}>
            <li><span className={styles.stepNo}>1</span><h3>Pick one thing</h3><p>Something you would otherwise replace: a jumper, a lamp, a chair with a wobble.</p></li>
            <li><span className={styles.stepNo}>2</span><h3>Mend it in March</h3><p>At home, or at a repair café on a Saturday, 10:00–14:00, where volunteers lend tools and know-how.</p></li>
            <li><span className={styles.stepNo}>3</span><h3>Show it, if you like</h3><p>Post a before-and-after to the gallery. Entirely optional — the mend is the point.</p></li>
          </ol>
        </section>

        <section id={a('gallery')} className={styles.section} aria-labelledby={a('gallery-h')}>
          <div className={styles.sectionHead}>
            <h2 id={a('gallery-h')} className={styles.h2}>Mends from March 2026</h2>
            <p className={styles.small}>Sample entries. Everyone here chose to be in the gallery.</p>
          </div>
          <Gallery />
        </section>

        <section id={a('pledge')} className={`${styles.section} ${styles.pledge}`} aria-labelledby={a('pledge-h')}>
          <div className={styles.sectionHead}>
            <h2 id={a('pledge-h')} className={styles.h2}>Pledge a mend</h2>
            <p className={styles.small}>Pledges are open now; mending starts on 1 March 2027 and entries close on 31 March at 23:59 GMT.</p>
          </div>
          <div className={styles.pledgeGrid}>
            <PledgeForm onPledged={setPledge} onEdit={() => setPledge(null)} />
            <div>
              <h3 className={styles.h3}>Make a share card</h3>
              <p className={styles.small}>Sharing is optional and nothing here is locked behind it.</p>
              <ShareCard item={pledge?.item ?? 'grey wool jumper'} />
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby={a('board-h')}>
          <div className={styles.sectionHead}>
            <h2 id={a('board-h')} className={styles.h2}>Café leaderboard, March 2026</h2>
            <p className={styles.small}>Items brought in to each café, week by week. Sample data. No prizes, and nobody is told they are behind.</p>
          </div>
          <Leaderboard />
        </section>

        <footer className={styles.footer}>
          <p>Mend March runs 1–31 March 2027. The Mending Commons, its cafés and every entry on this page are fictional sample content.</p>
          <p>No streaks, no countdowns, no prizes: come back in March because you have something to fix.</p>
        </footer>
      </div>
    </div>
  );
}
