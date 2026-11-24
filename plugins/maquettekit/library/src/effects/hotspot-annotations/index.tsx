'use client';
import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { useStudioMotion } from '../../motion';
import { StudioCanvas, type CameraRigHandle } from '../../three';
import type { EffectProps } from '../../types';
import { SPOTS } from './data';
import { RadioDrawing } from './fallback';
import { Scene } from './scene';
import styles from './styles.module.css';

type Params = { glide: number; labels: boolean; numbering: 'Numbers' | 'Letters'; selectOnFocus: boolean };

function Ready({ onChange }: { onChange: (ready: boolean) => void }) {
  useEffect(() => { onChange(true); return () => onChange(false); }, [onChange]);
  return null;
}

export default function HotspotAnnotations({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const rig = useRef<CameraRigHandle | null>(null);
  const markers = useRef(new Map<string, HTMLElement>());
  const [active, setActive] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const mark = (i: number) => (params.numbering === 'Letters' ? String.fromCharCode(65 + i) : String(i + 1));

  const select = useCallback((id: string | null) => {
    setActive(id);
    rig.current?.goTo(id ?? 'home');
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); select(null); }
  };
  // Keyboard focus on a list item frames it (selection follows focus); a mouse press is handled by the click.
  const onItemFocus = (id: string) => (e: FocusEvent<HTMLButtonElement>) => {
    if (params.selectOnFocus && id !== active && e.currentTarget.matches(':focus-visible')) select(id);
  };
  const current = SPOTS.find((s) => s.id === active) ?? null;

  return (
    <div className={styles.root} onKeyDown={onKeyDown}>
      <div className={styles.viewport}>
        <StudioCanvas
          label="Field radio with four annotations, sample product"
          description="A cream enamel portable radio: a perforated speaker panel and a tuning window on the front, a brass tuning dial, a flat leather carry strap on brass posts, a telescopic antenna and a battery door on the back panel. Numbered markers point at four features; the list beside the view describes them."
          camera={{ fov: 32, near: 0.1, far: 80, position: [3.5, 2.5, 6.3] }}
          fallback={<RadioDrawing active={active} />}
        >
          <Ready onChange={setReady} />
          <Scene ref={rig} markers={markers} glide={params.glide} />
        </StudioCanvas>
        {ready ? (
          <div className={styles.layer}>
            {SPOTS.map((s, i) => (
              <div key={s.id} ref={(el) => { if (el) markers.current.set(s.id, el); else markers.current.delete(s.id); }} className={styles.anchor} data-active={active === s.id || undefined}>
                {/* Pointer shortcut only: the list is the keyboard / screen-reader path, so markers stay out of the tab order. */}
                <button type="button" tabIndex={-1} aria-hidden="true" className={styles.marker} onClick={() => select(active === s.id ? null : s.id)}>{mark(i)}</button>
                {params.labels || active === s.id ? <span className={styles.pill} aria-hidden="true">{s.label}</span> : null}
              </div>
            ))}
          </div>
        ) : null}
        <p className={styles.tag} aria-hidden="true">Field radio · sample product</p>
      </div>

      <div className={styles.panel}>
        <p className={styles.kicker} id={`${uid}-h`}>Annotations</p>
        <ol className={styles.list} aria-labelledby={`${uid}-h`}>
          {SPOTS.map((s, i) => {
            const on = active === s.id;
            return (
              <li key={s.id} className={styles.item} data-active={on || undefined}>
                <button
                  type="button"
                  className={styles.itemButton}
                  aria-expanded={on}
                  aria-controls={`${uid}-${s.id}`}
                  onClick={() => select(on ? null : s.id)}
                  onFocus={onItemFocus(s.id)}
                >
                  <span className={styles.num} aria-hidden="true">{mark(i)}</span>
                  <span className={styles.itemLabel}>{s.label}</span>
                  {s.side === 'back' ? <span className={styles.side}>Back</span> : null}
                </button>
                <div id={`${uid}-${s.id}`} className={styles.desc} hidden={!on}>
                  <p>{s.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <button type="button" className={styles.reset} onClick={() => select(null)} disabled={!active && !ready}>Reset view</button>
        <p className={styles.hint}>
          {ready
            ? `Choose an annotation${params.selectOnFocus ? ' (or tab to it)' : ''} to ${reduced ? 'cut' : 'glide'} the camera to it; drag or use the arrow keys on the view to orbit. Esc returns to the full view.`
            : 'Interactive 3D is unavailable, so a front drawing with the same numbered points is shown.'}
        </p>
        <p className={styles.srOnly} aria-live="polite">{current ? `${current.label} framed.` : ''}</p>
      </div>
    </div>
  );
}
