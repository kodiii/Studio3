'use client';
import { useEffect, useId, useRef, useState } from 'react';
import SplitLineReveal from '../../../effects/split-line-reveal';
import { meta as splitMeta } from '../../../effects/split-line-reveal/meta';
import { duration as D, useStudioMotion } from '../../../motion';
import type { EffectMeta, ParamValues } from '../../../types';
import { Gallery } from './Gallery';
import { Leaderboard } from './Leaderboard';
import { PledgeForm, type Pledge } from './PledgeForm';
import { ShareCard } from './ShareCard';
import styles from './styles.module.css';

const defaults = (m: EffectMeta): ParamValues => Object.fromEntries(m.params.map((p) => [p.key, p.default]));
const PATCH = 'M118 74 296 62 304 226 126 238Z';
const SEAM = 'M134 88 282 78 288 212 140 222Z';

/** The hero's patch is stitched on once: a solid mask stroke reveals the dashed running stitch. */
function HeroPatch() {
  const { reduced } = useStudioMotion();
  const mask = useRef<SVGPathElement>(null);
  const thread = useRef<SVGPathElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  useEffect(() => {
    const m = mask.current, t = thread.current;
    if (!m || !t || reduced || typeof m.animate !== 'function') return;
    const a = m.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: D.cinematic * 2, delay: D.moderate, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'backwards' });
    const b = t.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: D.slow, delay: D.moderate + D.cinematic * 2 - 120, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' });
    return () => { a.cancel(); b.cancel(); };
  }, [reduced]);
  return (
    <svg viewBox="0 0 400 320" className={styles.heroArt} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`${uid}-twill`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
          <path d="M0 5h10" stroke="#f3efe6" strokeOpacity="0.07" strokeWidth="3" />
        </pattern>
        <mask id={`${uid}-sew`} maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="320">
          <path ref={mask} d={SEAM} fill="none" stroke="#fff" strokeWidth="16" pathLength={1} strokeDasharray="1" strokeDashoffset="0" />
        </mask>
      </defs>
      <rect width="400" height="320" fill={`url(#${uid}-twill)`} />
      <path d="M60 280c40-90 70-120 120-150" fill="none" stroke="#f3efe6" strokeOpacity="0.16" strokeWidth="2" strokeDasharray="6 8" />
      <path d={PATCH} fill="#f0b44c" />
      <path d={PATCH} fill="none" stroke="#1e2a4a" strokeOpacity="0.25" strokeWidth="2" />
      <path d={SEAM} fill="none" stroke="#1e2a4a" strokeWidth="5" strokeDasharray="14 10" strokeLinecap="round" mask={`url(#${uid}-sew)`} />
      <path ref={thread} d="M140 222c-30 34-70 40-96 22" fill="none" stroke="#f3efe6" strokeWidth="2.5" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="0" />
      <g transform="rotate(-38 40 236)">
        <rect x="-8" y="232" width="96" height="6" rx="3" fill="#c9cfe0" />
        <ellipse cx="2" cy="235" rx="5" ry="1.6" fill="#1e2a4a" />
      </g>
    </svg>
  );
}

export default function CampaignLanding() {
  const uid = useId();
  const [pledge, setPledge] = useState<Pledge | null>(null);
  const a = (s: string) => `${uid}-${s}`;
  return (
    <div className={styles.root}>
      <section className={styles.hero} aria-labelledby={a('hero')}>
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
          <HeroPatch />
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
