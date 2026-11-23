'use client';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { spring, springToLinear, useStudioMotion } from '../../../motion';
import { ClubMark, MeteorSky } from './art';
import { TokenViewer } from './TokenViewer';
import styles from './styles.module.css';

const POP = springToLinear(spring.pop);
const ICS = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Saltmarsh Sky Club//Sample event//EN', 'BEGIN:VEVENT',
  'UID:session-12-2026@saltmarsh-sky.invalid', 'DTSTAMP:20261123T100000Z', 'DTSTART:20261212T193000Z', 'DTEND:20261212T220000Z',
  'SUMMARY:Saltmarsh Sky Club — Session 12 (sample event)', 'LOCATION:Holm Marsh sea wall car park',
  'DESCRIPTION:Weather permitting. Go or no-go is posted in the club feed by 16:00 on the day.', 'END:VEVENT', 'END:VCALENDAR',
].join('\r\n');

type Icon = 'star' | 'spark' | 'hand' | 'eye';
const ICONS: Record<Icon, string> = {
  star: 'M12 3.500l2.500 5.300 5.800.7-4.300 4 1.100 5.700L12 16.400l-5.100 2.800L8 13.500 3.700 9.500l5.800-.7z',
  spark: 'M12 3c.6 4.600 2.400 6.400 7 7-4.600.6-6.400 2.400-7 7-.6-4.600-2.400-6.400-7-7 4.600-.6 6.400-2.400 7-7z',
  hand: 'M8 12V6.500a1.500 1.500 0 0 1 3 0V11m0-1V5a1.500 1.500 0 0 1 3 0v6m0-4.500a1.500 1.500 0 0 1 3 0V14a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.800-2.400L4 14.500a1.500 1.500 0 0 1 2.400-1.800L8 14.500',
  eye: 'M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
};

function Reactions({ items }: { items: readonly { id: string; label: string; icon: Icon; base: number }[] }) {
  const { reduced } = useStudioMotion();
  const [on, setOn] = useState<Record<string, boolean>>({});
  const anims = useRef(new Set<Animation>());
  const press = (id: string, btn: HTMLButtonElement) => {
    const next = !on[id];
    setOn((s) => ({ ...s, [id]: next }));
    const icon = btn.querySelector('svg');
    if (reduced || !next || !icon || typeof icon.animate !== 'function') return;
    const a = icon.animate([{ transform: 'scale(0.55) rotate(-12deg)' }, { transform: 'none' }], { duration: POP.duration, easing: POP.easing });
    anims.current.add(a);
    const done = () => anims.current.delete(a);
    a.finished.then(done, done);
  };
  return (
    <div className={styles.reactions} role="group" aria-label="Reactions (sample counts)">
      {items.map((r) => (
        <button key={r.id} type="button" className={styles.reaction} aria-pressed={!!on[r.id]} onClick={(e) => press(r.id, e.currentTarget)}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={ICONS[r.icon]} /></svg>
          {r.label} <span className={styles.reactionCount}>{r.base + (on[r.id] ? 1 : 0)}</span>
        </button>
      ))}
    </div>
  );
}

function Byline({ id, when, iso, tag }: { id: string; when: string; iso: string; tag?: string }) {
  return (
    <div className={styles.postHead}>
      <ClubMark className={styles.avatar} />
      <p id={id} className={styles.byline}>
        <span className={styles.author}>Saltmarsh Sky Club</span>
        <span className={styles.meta}>@saltmarshsky · <time dateTime={iso} title={new Date(iso).toUTCString()}>{when}<span className="s3-sr-only"> ago</span></time></span>
      </p>
      {tag ? <span className={styles.tag}>{tag}</span> : null}
    </div>
  );
}

export default function SocialPost3D() {
  const uid = useId();
  const [rsvp, setRsvp] = useState<'going' | 'maybe' | 'no' | ''>('');
  const ids = { token: `${uid}-token`, event: `${uid}-event`, log: `${uid}-log` };

  const onFeedKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'PageDown' && e.key !== 'PageUp') return;
    const list = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(':scope > article'));
    const at = list.findIndex((a) => a.contains(document.activeElement));
    const next = list[Math.max(0, Math.min(list.length - 1, at + (e.key === 'PageDown' ? 1 : -1)))];
    if (next) { e.preventDefault(); next.focus(); }
  };

  return (
    <div className={styles.root}>
      <div className={styles.page}>
        <header className={styles.club}>
          <ClubMark className={styles.clubMark} />
          <div>
            <p className={styles.sample}><span className="s3-label">Sample content</span> A fictional club; posts, people and counts are invented.</p>
            <h2 className={styles.clubName}>Saltmarsh Sky Club</h2>
            <p className={styles.clubLine}>Amateur astronomers on the Holm Marsh sea wall, once a month, red torches only.</p>
          </div>
        </header>

        <div className={styles.layout}>
          <div className={styles.feedCol}>
            <p className={styles.feedNote}><span className="s3-label">Club feed</span> Newest first. One post has a 3D model; the rest are flat.</p>
            <div role="feed" aria-busy="false" aria-label="Saltmarsh Sky Club posts" className={styles.feed} onKeyDown={onFeedKey}>
              <article className={styles.post} aria-labelledby={ids.token} aria-describedby={`${ids.token}-text`} aria-posinset={1} aria-setsize={3} tabIndex={-1}>
                <Byline id={ids.token} when="2 h" iso="2026-11-23T08:00:00Z" tag="3D post" />
                <TokenViewer />
                <div className={styles.postBody}>
                  <h3 className={styles.postTitle}>The One Orbit tokens are back from the die-maker</h3>
                  <p id={`${ids.token}-text`} className={styles.postText}>
                    One stud for every monthly session, and a ringed planet in the middle because Pell insisted. Members who log twelve sessions
                    get one at a December meeting; sessions roll over, so there is no rush and no other way to earn one.
                  </p>
                  <dl className={styles.facts}>
                    <div><dt>Diameter</dt><dd>63 mm</dd></div>
                    <div><dt>Thickness</dt><dd>13.7 mm</dd></div>
                    <div><dt>Studs</dt><dd>12, one per session</dd></div>
                    <div><dt>Finish</dt><dd>Brass (sample)</dd></div>
                  </dl>
                  <Reactions items={[{ id: 'shiny', label: 'Shiny', icon: 'spark', base: 41 }, { id: 'want', label: 'Want one', icon: 'hand', base: 27 }]} />
                </div>
              </article>

              <article className={styles.post} aria-labelledby={ids.event} aria-describedby={`${ids.event}-text`} aria-posinset={2} aria-setsize={3} tabIndex={-1}>
                <Byline id={ids.event} when="5 h" iso="2026-11-23T05:00:00Z" tag="Event" />
                <div className={styles.postBody}>
                  <div className={styles.event}>
                    <p className={styles.eventDate} aria-hidden="true"><span>Sat</span><strong>12</strong><span>Dec</span></p>
                    <div>
                      <h3 className={styles.postTitle}>Session 12, the last of the year</h3>
                      <p id={`${ids.event}-text`} className={styles.postText}>
                        Saturday 12 December 2026, 19:30–22:00 GMT, Holm Marsh sea wall car park. Weather permitting: we post go or no-go here by 16:00 on the day.
                      </p>
                    </div>
                  </div>
                  <fieldset className={styles.rsvp}>
                    <legend>Are you coming?</legend>
                    {([['going', 'Going'], ['maybe', 'Maybe'], ['no', 'Not this time']] as const).map(([v, l]) => (
                      <label key={v} className={styles.rsvpOption}>
                        <input type="radio" name={`${uid}-rsvp`} value={v} checked={rsvp === v} onChange={() => setRsvp(v)} />
                        <span>{l}</span>
                      </label>
                    ))}
                  </fieldset>
                  <p className={styles.small} aria-live="polite">
                    {rsvp ? `Saved: ${rsvp === 'going' ? 'going' : rsvp === 'maybe' ? 'maybe' : 'not this time'}. You can change it until the session starts. ` : ''}
                    Your answer is visible to club members only. Sample counts: 14 going, 6 maybe.
                  </p>
                  <a className={styles.icsLink} href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ICS)}`} download="saltmarsh-session-12.ics">Add to calendar (.ics)</a>
                </div>
              </article>

              <article className={styles.post} aria-labelledby={ids.log} aria-describedby={`${ids.log}-text`} aria-posinset={3} aria-setsize={3} tabIndex={-1}>
                <Byline id={ids.log} when="9 d" iso="2026-11-14T23:30:00Z" tag="Log" />
                <div role="img" aria-label="Night sky over a sea wall: five meteor trails, a scatter of stars, and four people on the wall wearing red head-torches." className={styles.media}>
                  <MeteorSky />
                </div>
                <div className={styles.postBody}>
                  <h3 className={styles.postTitle}>Session 11: twenty-three meteors before the fog</h3>
                  <p id={`${ids.log}-text`} className={styles.postText}>
                    Clear from nine until the fog came in off the marsh at eleven. Twenty-three meteors between the four of us, two bright enough to make Pell shout.
                  </p>
                  <Reactions items={[{ id: 'clear', label: 'Clear skies', icon: 'star', base: 18 }, { id: 'saw', label: 'Saw one too', icon: 'eye', base: 9 }]} />
                </div>
              </article>
            </div>

            <section className={styles.caughtUp} aria-labelledby={`${uid}-end`}>
              <h3 id={`${uid}-end`}>You’re up to date</h3>
              <p>That’s everything the club posted this month. The next post will be the go or no-go for Session 12.</p>
            </section>
          </div>

          <aside className={styles.rail} aria-labelledby={`${uid}-how`}>
            <h3 id={`${uid}-how`} className="s3-label">How the 3D post behaves</h3>
            <ol>
              <li><strong>Poster first.</strong> The feed shows a photo; the model downloads only when you press Interact in 3D.</li>
              <li><strong>One canvas.</strong> Only one post in a feed may hold a live 3D view; the others stay flat.</li>
              <li><strong>Released.</strong> Close 3D, or scroll the post a screen away, and the scene and model are freed.</li>
              <li><strong>No gesture required.</strong> Turn, zoom, reset and spin all have buttons; the view also takes arrow keys.</li>
            </ol>
          </aside>
        </div>
      </div>
    </div>
  );
}

