'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import StoryProgressSegments from '../../../effects/story-progress-segments';
import { meta as storyMeta } from '../../../effects/story-progress-segments/meta';
import type { EffectMeta, ParamValues } from '../../../types';
import { FlagBanner, FlagMark } from './art';
import { CREATORS } from './data';
import { Viewer } from './Viewer';
import styles from './styles.module.css';

const defaults = (m: EffectMeta): ParamValues => Object.fromEntries(m.params.map((p) => [p.key, p.default]));

export default function Stories() {
  const uid = useId();
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const opener = useRef<HTMLElement | null>(null);

  const show = (i: number, el: HTMLElement) => { opener.current = el; setOpen(i); };
  const close = useCallback(() => setOpen(null), []);
  const onSeen = useCallback((id: string, card: number) => setSeen((s) => (s[id] !== undefined && s[id] >= card ? s : { ...s, [id]: card })), []);

  // While the viewer is open: the page behind is inert (below) and does not scroll; focus returns to the ring.
  useEffect(() => {
    if (open === null) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
      const el = opener.current;
      if (el?.isConnected) requestAnimationFrame(() => el.focus({ preventScroll: true }));
    };
  }, [open]);

  return (
    <div className={styles.root}>
      <div className={styles.page} inert={open !== null}>
        <header className={styles.masthead}>
          <FlagBanner className={styles.banner} />
          <h2 className={styles.town}>Port Ellery</h2>
          <p className={styles.tagline}>Stories from the harbour, the quay and the people who keep them running.</p>
          <p className={styles.sample}><span className="s3-label">Sample content</span> A fictional town; every account and notice is invented.</p>
        </header>

        <section aria-labelledby={`${uid}-tray`} className={styles.traySection}>
          <div className={styles.trayHead}>
            <h3 id={`${uid}-tray`} className={styles.h3}>Today’s stories</h3>
            <p className={styles.small}>Up for 24 hours, then kept in each account’s archive.</p>
          </div>
          <ul className={styles.tray}>
            {CREATORS.map((c, i) => {
              const watched = seen[c.id] ?? -1;
              const unseen = Math.max(0, c.segments.length - 1 - watched);
              const done = watched >= c.segments.length - 1;
              return (
                <li key={c.id}>
                  <button type="button" className={styles.ring} data-seen={done || undefined} onClick={(e) => show(i, e.currentTarget)}>
                    <span className={styles.ringArt}><FlagMark flag={c.flag} className={styles.ringFlag} /></span>
                    <span className={styles.ringName}>{c.name}</span>
                    <span className={styles.ringState}>{done ? 'Seen' : `${watched < 0 ? c.segments.length : unseen} new`}</span>
                    <span className="s3-sr-only">, {c.ago} ago</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby={`${uid}-how`} className={styles.how}>
          <h3 id={`${uid}-how`} className={styles.h3}>Every gesture has a button</h3>
          <dl className={styles.legend}>
            <div><dt>Tap the right or left of a card</dt><dd>Next / Previous card buttons, or → and ←</dd></div>
            <div><dt>Press and hold</dt><dd>Pause button, or Space</dd></div>
            <div><dt>Swipe sideways</dt><dd>Account buttons under the reply box, or Shift + → / ←</dd></div>
            <div><dt>Swipe down</dt><dd>Close button, or Esc</dd></div>
          </dl>
          <p className={styles.small}>Cards move on by themselves every six seconds and stop while you hold, reply or switch tabs. With reduced motion they never move on their own.</p>
        </section>

        <section aria-labelledby={`${uid}-embed`} className={styles.embedSection}>
          <div className={styles.embedCopy}>
            <h3 id={`${uid}-embed`} className={styles.h3}>From the harbour newsletter</h3>
            <p className={styles.small}>A story can live outside the tray, too. Tidewater Notes’ low-tide walk is embedded here with its own pause and step controls.</p>
          </div>
          <div className={styles.embed}>
            {/* Its clock stops while the full-screen viewer covers the page. */}
            <StoryProgressSegments params={{ ...defaults(storyMeta), duration: 5000, slides: 5, transition: 'slide', autoAdvance: open === null }} />
          </div>
        </section>

        <footer className={styles.footer}>
          <p>Port Ellery, its harbour office, bakery, lifeboat station, ferry desk and gallery are fictional. Replies in this demo are not sent anywhere.</p>
        </footer>
      </div>

      {open !== null ? <Viewer start={open} onClose={close} onSeen={onSeen} /> : null}
    </div>
  );
}
