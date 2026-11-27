/**
 * The gesture guide as designed hints instead of a table: each gesture is a small pictogram of the phone with the
 * hand's move drawn on it, its name, and its twins — the button and the keys, set as keycaps. Pictograms are
 * decorative; every hint is real text in a list.
 */
import type { ReactNode } from 'react';
import styles from './styles.module.css';

const Phone = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 56 72" className={styles.hintArt} aria-hidden="true" focusable="false">
    <rect x="12" y="4" width="32" height="60" rx="6" className={styles.hintPhone} />
    <path d="M17 10h22" className={styles.hintSeg} />
    {children}
  </svg>
);

const HINTS = [
  {
    id: 'tap', title: 'Tap the sides', twin: <>Previous / Next card buttons, or <span className={styles.keyset}><kbd>←</kbd> <kbd>→</kbd></span></>,
    art: (
      <Phone>
        <rect x="13.5" y="14" width="9" height="48" className={styles.hintZoneBack} />
        <rect x="22.5" y="14" width="20" height="48" className={styles.hintZone} />
        <circle cx="34" cy="38" r="5" className={styles.hintTouch} /><circle cx="34" cy="38" r="9" className={styles.hintRing} />
      </Phone>
    ),
  },
  {
    id: 'hold', title: 'Press and hold', twin: <>The Pause button, or <kbd>Space</kbd></>,
    art: (
      <Phone>
        <circle cx="28" cy="38" r="5" className={styles.hintTouch} /><circle cx="28" cy="38" r="10" className={styles.hintRing} /><circle cx="28" cy="38" r="14.5" className={styles.hintRing} />
        <path d="M24 19v6M29 19v6" className={styles.hintStroke} />
      </Phone>
    ),
  },
  {
    id: 'swipe', title: 'Swipe sideways', twin: <>Account buttons, or <span className={styles.keyset}><kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd></span></>,
    art: (
      <Phone>
        <path d="M40 38H18M23 33l-5 5 5 5" className={styles.hintStroke} />
        <circle cx="40" cy="38" r="5" className={styles.hintTouch} />
      </Phone>
    ),
  },
  {
    id: 'down', title: 'Swipe down', twin: <>The Close button, or <kbd>Esc</kbd></>,
    art: (
      <Phone>
        <path d="M28 22v26M23 43l5 5 5-5" className={styles.hintStroke} />
        <circle cx="28" cy="22" r="5" className={styles.hintTouch} />
      </Phone>
    ),
  },
] as const;

export function Hints() {
  return (
    <ul className={styles.hints}>
      {HINTS.map((h) => (
        <li key={h.id} className={styles.hint}>
          {h.art}
          <div>
            <h4 className={styles.hintTitle}>{h.title}</h4>
            <p className={styles.hintTwin}>{h.twin}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
