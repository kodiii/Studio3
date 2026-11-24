'use client';
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { cssEase, useStudioMotion, type EasingToken } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { mode: string; duration: number; easing: string; icon: string; defaultOpen: number; look: string };

/** Sample content for an invented print studio. */
const ITEMS: readonly { id: string; q: string; a: ReactNode }[] = [
  { id: 'book', q: 'How do bookings work?', a: <p>Book a two- or four-hour bench online or at the desk. Every bench comes with a drying rack, a set of rollers and a check-in from a technician at the start of your slot.</p> },
  { id: 'paper', q: 'Can I bring my own paper?', a: <><p>Yes. Most papers up to 300 gsm run through the proofing press without trouble.</p><p>Bring two spare sheets for a test print; heavily textured stock may need a softer packing, which the technician can set up for you.</p></> },
  { id: 'cancel', q: 'What if I need to cancel?', a: <p>Cancel up to 24 hours ahead for a full credit. After that you can hand the slot to someone else by telling the desk their name.</p> },
  { id: 'access', q: 'Is the studio step-free?', a: <><p>The ground floor, the main press and the accessible toilet are step-free. The darkroom is up six steps:</p><ul><li>ask at the desk and a technician will bring exposures down to you,</li><li>or book the ground-floor light table instead,</li><li>large-print and screen-reader friendly safety notes are on the website.</li></ul></> },
  { id: 'classes', q: 'Do you run classes for beginners?', a: <p>Twice a month: a Saturday morning introduction to relief printing and a Thursday evening session on screen printing. Materials are included and no experience is needed.</p> },
];
const EASINGS: readonly EasingToken[] = ['emphasized', 'standard', 'inOut', 'enter'];

export default function AccordionHeightAuto({ params }: EffectProps<Params>) {
  const { reduced, scale } = useStudioMotion();
  const uid = useId();
  const single = params.mode !== 'multiple';
  const initial = () => (params.defaultOpen >= 1 && params.defaultOpen <= ITEMS.length ? [ITEMS[params.defaultOpen - 1].id] : []);
  const [open, setOpen] = useState<string[]>(initial);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // Param changes restart from the configured state.
  useEffect(() => { setOpen(initial()); }, [params.defaultOpen, single]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setOpen((cur) => {
    if (cur.includes(id)) return cur.filter((x) => x !== id);
    return single ? [id] : [...cur, id];
  });
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = ITEMS.length - 1;
    const to = e.key === 'ArrowDown' ? (i === last ? 0 : i + 1) : e.key === 'ArrowUp' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (to === null) return;
    e.preventDefault();
    buttons.current[to]?.focus();
  };

  const ease = EASINGS.includes(params.easing as EasingToken) ? (params.easing as EasingToken) : 'emphasized';
  return (
    <div
      className={styles.root}
      data-look={params.look === 'cards' ? 'cards' : 'hairline'}
      data-icon={params.icon === 'plus' ? 'plus' : 'chevron'}
      data-reduced={reduced || undefined}
      style={{ '--acc-dur': `${Math.round(params.duration * scale.duration)}ms`, '--acc-ease': cssEase(ease) } as CSSProperties}
    >
      <header className={styles.head}>
        <p className={styles.eyebrow}>Halden Print Room · help</p>
        <h3 className={styles.title}>Visiting the print room</h3>
        <p className={styles.note}>Sample content · {single ? 'one answer open at a time' : 'open as many as you like'}</p>
      </header>
      <div className={styles.group}>
        {ITEMS.map((item, i) => {
          const isOpen = open.includes(item.id);
          return (
            <div key={item.id} className={styles.item} data-open={isOpen || undefined}>
              <h4 className={styles.heading}>
                <button
                  ref={(el) => { buttons.current[i] = el; }}
                  id={`${uid}b${i}`}
                  type="button"
                  className={styles.trigger}
                  aria-expanded={isOpen}
                  aria-controls={`${uid}p${i}`}
                  onClick={() => toggle(item.id)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                >
                  <span className={styles.index} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <span className={styles.question}>{item.q}</span>
                  <span className={styles.icon} aria-hidden="true"><i /><i /></span>
                </button>
              </h4>
              <div id={`${uid}p${i}`} role="region" aria-labelledby={`${uid}b${i}`} className={styles.panel}>
                <div className={styles.inner}>
                  <div className={styles.content}>{item.a}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
