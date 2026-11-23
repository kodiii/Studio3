'use client';
/**
 * Café leaderboard — the bar-race pattern, rebuilt with CSS transforms for this page's own (sample) data: rows
 * slide to their new rank and bars grow on ONE shared scale. The drawing is aria-hidden; an ordered list in rank
 * order carries the same numbers for assistive tech. Play steps through the four weeks once (under 5 s) and can be
 * paused; reduced motion swaps each week in without sliding or growing.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { CAFES, WEEKLY } from './data';
import styles from './styles.module.css';

const ROW = 48;
const STEP_MS = 1150;
const MAX = Math.max(...Object.values(WEEKLY).flat());

export function Leaderboard() {
  const uid = useId();
  const [week, setWeek] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [say, setSay] = useState('');
  const weekRef = useRef(week);
  weekRef.current = week;
  const touched = useRef(false); // announce only after the person has used the controls

  const ranked = [...CAFES].sort((a, b) => WEEKLY[b][week] - WEEKLY[a][week]);
  const rank = new Map(ranked.map((c, i) => [c, i]));
  const describe = (w: number) => {
    const top = [...CAFES].sort((a, b) => WEEKLY[b][w] - WEEKLY[a][w])[0];
    return `Week ${w + 1}: ${top} has logged the most so far, ${WEEKLY[top][w]} items.`;
  };

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      const next = Math.min(3, weekRef.current + 1);
      setWeek(next);
      if (next >= 3) setPlaying(false);
    }, STEP_MS);
    return () => clearInterval(t);
  }, [playing]);
  useEffect(() => { if (!playing && touched.current) setSay(describe(week)); }, [playing, week]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = () => {
    touched.current = true;
    if (playing) { setPlaying(false); return; }
    if (week >= 3) setWeek(0);
    setPlaying(true);
  };

  return (
    <div className={styles.board}>
      <div className={styles.boardControls}>
        <button type="button" className={styles.playBtn} aria-pressed={playing} onClick={play}>
          {playing
            ? <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 3v10M11 3v10" /></svg>
            : <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 3l8 5-8 5z" className={styles.solid} /></svg>}
          {playing ? 'Pause' : week >= 3 ? 'Replay March' : 'Play March'}
        </button>
        <fieldset className={styles.weeks}>
          <legend className="s3-sr-only">Show week</legend>
          {[0, 1, 2, 3].map((w) => (
            <label key={w} className={styles.week}>
              <input type="radio" name={`${uid}-week`} checked={week === w} onChange={() => { touched.current = true; setPlaying(false); setWeek(w); }} />
              <span>Week {w + 1}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className={styles.race} style={{ height: ROW * CAFES.length }} aria-hidden="true">
        {CAFES.map((c) => {
          const value = WEEKLY[c][week];
          const r = rank.get(c) ?? 0;
          return (
            <div key={c} className={styles.raceRow} data-lead={r === 0 || undefined} style={{ transform: `translateY(${r * ROW}px)` }}>
              <span className={styles.raceRank}>{r + 1}</span>
              <span className={styles.raceName}>{c}</span>
              <span className={styles.raceTrack}><span className={styles.raceBar} style={{ transform: `scaleX(${value / MAX})` }} /></span>
              <span className={styles.raceValue}>{value}</span>
            </div>
          );
        })}
      </div>
      <ol className="s3-sr-only" aria-label={`Cafés ranked by items logged, week ${week + 1} of March 2026 (sample data)`}>
        {ranked.map((c) => <li key={c}>{c}: {WEEKLY[c][week]} items</li>)}
      </ol>
      <p className="s3-sr-only" aria-live="polite">{say}</p>
    </div>
  );
}
