'use client';
import { useCallback, useEffect, useId, useState } from 'react';
import { useStudioMotion } from '../../motion';
import { StudioCanvas } from '../../three';
import type { EffectProps } from '../../types';
import { ExplodedDrawing } from './fallback';
import { PARTS, type PartId } from './parts';
import { Scene } from './scene';
import styles from './styles.module.css';

type Params = { amount: number; spread: number; stagger: number; accent: string };

function Ready({ onChange }: { onChange: (ready: boolean) => void }) {
  useEffect(() => { onChange(true); return () => onChange(false); }, [onChange]);
  return null;
}

export default function ExplodedView({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const [amount, setAmount] = useState(params.amount);
  const [smooth, setSmooth] = useState(0.12);
  const [scenePart, setScenePart] = useState<PartId | null>(null); // pointer over a part in 3D
  const [rowPart, setRowPart] = useState<PartId | null>(null); // row hovered or focused
  const [pinned, setPinned] = useState<PartId | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setAmount(params.amount), [params.amount]);
  const highlight = scenePart ?? rowPart ?? pinned;
  const name = PARTS.find((p) => p.id === highlight)?.name ?? null;

  const glideTo = useCallback((v: number) => { setSmooth(0.45); setAmount(v); }, []);
  const pick = useCallback((id: PartId) => setPinned((p) => (p === id ? null : id)), []);

  return (
    <div className={styles.root} style={{ ['--xv-accent' as string]: params.accent }}>
      <div className={styles.viewport}>
        <StudioCanvas
          label="Compact camera, exploded view"
          description="A procedural compact camera in seven parts: body shell, top plate with shutter dial, leather front grip, lens mount, lens barrel with an accent ring, front glass element and battery. The separation slider moves the parts apart along their own directions, one after another."
          camera={{ fov: 30, near: 0.1, far: 80, position: [-4, 3, 4.5] }}
          fallback={<ExplodedDrawing amount={amount} spread={params.spread} stagger={params.stagger} highlight={highlight} accent={params.accent} />}
        >
          <Ready onChange={setReady} />
          <Scene amount={amount} smooth={smooth} spread={params.spread} stagger={params.stagger} accent={params.accent} highlight={highlight} cut={reduced} onHover={setScenePart} onPick={pick} />
        </StudioCanvas>
        <p className={styles.tag} aria-hidden="true">{name ?? 'Compact camera · sample assembly'}</p>
      </div>

      <div className={styles.panel}>
        <div className={styles.sliderRow}>
          <label htmlFor={`${uid}-amt`} className={styles.kicker}>Separation</label>
          <output htmlFor={`${uid}-amt`} className={styles.value}>{Math.round(amount * 100)}%</output>
        </div>
        <input
          id={`${uid}-amt`}
          type="range" min={0} max={1} step={0.01} value={amount}
          className={styles.slider}
          onChange={(e) => { setSmooth(0.12); setAmount(Number(e.target.value)); }}
        />
        <div className={styles.buttons}>
          <button type="button" onClick={() => glideTo(0)} disabled={amount === 0}>Assemble</button>
          <button type="button" onClick={() => glideTo(1)} disabled={amount === 1}>Explode</button>
        </div>
        <p className={styles.kicker} id={`${uid}-parts`}>Parts</p>
        <ol className={styles.list} aria-labelledby={`${uid}-parts`}>
          {PARTS.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className={styles.row}
                data-hot={highlight === p.id || undefined}
                aria-pressed={pinned === p.id}
                onPointerEnter={() => setRowPart(p.id)}
                onPointerLeave={() => setRowPart(null)}
                onFocus={() => setRowPart(p.id)}
                onBlur={() => setRowPart(null)}
                onClick={() => pick(p.id)}
              >
                <span className={styles.num} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{p.name}</span>
                  <span className={styles.rowMat}>{p.material}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className={styles.hint}>
          {ready
            ? 'Hover or focus a part to light it up; point at the model to find a part in the list. Click to pin the highlight.'
            : 'Interactive 3D is unavailable, so a flat diagram follows the slider instead.'}
        </p>
      </div>
    </div>
  );
}
