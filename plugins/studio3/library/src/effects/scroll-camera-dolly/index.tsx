'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { CatmullRomCurve3, Object3D, Vector3, type InstancedMesh } from 'three';
import { useScrollProgress, useStudioMotion } from '../../motion';
import { StudioCanvas, useQuality } from '../../three';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { length: number; lookAhead: number; fog: number; gateways: number; sway: number };

const FOG = '#171714';
const SPACING = 4;
const CAPTIONS = [
  { range: [0, 0.3], title: 'Approach', body: 'The camera starts outside the first gateway, low and centred.' },
  { range: [0.36, 0.66], title: 'Passage', body: 'It weaves between the columns while looking a few metres ahead of itself.' },
  { range: [0.72, 1], title: 'Arrival', body: 'The path straightens and the target settles on the sun.' },
] as const;
const STEPS = [0.06, 0.5, 0.97] as const;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

interface Api { invalidate: () => void }

function Scene({ params, progress, api, cut }: { params: Params; progress: RefObject<number>; api: RefObject<Api | null>; cut: boolean }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const { density } = useQuality();
  const columns = useRef<InstancedMesh>(null);
  const lintels = useRef<InstancedMesh>(null);
  const eased = useRef(-1);
  const count = Math.max(5, Math.round(params.gateways * (0.6 + 0.4 * density)));
  const depth = count * SPACING;

  const { curve, sun } = useMemo(() => {
    const s = params.sway;
    return {
      sun: new Vector3(0, 3.4, -depth - 16),
      curve: new CatmullRomCurve3([
        new Vector3(0, 1.5, 9), new Vector3(0, 1.45, 2), new Vector3(s, 1.7, -depth * 0.25), new Vector3(-s, 2.3, -depth * 0.5),
        new Vector3(s * 0.6, 1.6, -depth * 0.75), new Vector3(0, 1.9, -depth + 1),
      ], false, 'catmullrom', 0.5),
    };
  }, [params.sway, depth]);

  useLayoutEffect(() => {
    const o = new Object3D();
    for (let i = 0; i < count; i++) {
      const z = -i * SPACING;
      const h = 4.6 + ((i * 7) % 5) * 0.45; // deterministic variation, no Math.random
      for (const side of [0, 1]) {
        o.position.set(side ? 2.6 : -2.6, h / 2, z); o.scale.set(0.9, h, 0.9); o.updateMatrix();
        columns.current?.setMatrixAt(i * 2 + side, o.matrix);
      }
      o.position.set(0, h + 0.3, z); o.scale.set(6.9, 0.6, 1.1); o.updateMatrix();
      lintels.current?.setMatrixAt(i, o.matrix);
    }
    if (columns.current) columns.current.instanceMatrix.needsUpdate = true;
    if (lintels.current) lintels.current.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [count, invalidate]);

  useEffect(() => { api.current = { invalidate }; invalidate(); return () => { api.current = null; }; }, [api, invalidate, curve, params.lookAhead, params.fog, cut]);

  const target = useMemo(() => new Vector3(), []);
  useFrame((_, delta) => {
    const goal = progress.current ?? 0;
    const dt = Math.min(delta, 1 / 30);
    eased.current = cut || eased.current < 0 ? goal : eased.current + (goal - eased.current) * (1 - Math.exp(-dt * 7));
    const settled = Math.abs(goal - eased.current) < 0.0004;
    if (settled) eased.current = goal;
    const u = eased.current;
    curve.getPointAt(u, camera.position);
    // Look a little further along the path; over the last stretch blend the target onto the sun.
    curve.getPointAt(Math.min(1, u + params.lookAhead), target);
    if (u + params.lookAhead > 1) target.addScaledVector(curve.getTangentAt(1), (u + params.lookAhead - 1) * curve.getLength());
    target.lerp(sun, smooth(0.62, 1, u));
    camera.lookAt(target);
    if (!settled) invalidate();
  });

  const far = 78 - params.fog * 50;
  return (
    <>
      <color attach="background" args={[FOG]} />
      <fog attach="fog" args={[FOG, 3, far]} />
      <hemisphereLight args={['#6b665c', '#12120f', 1.1]} />
      <directionalLight position={[2, 5, -depth - 14]} intensity={3.2} color="#ff9a6a" />
      <directionalLight position={[-3, 6, 8]} intensity={0.5} color="#f3f0e8" />
      <instancedMesh ref={columns} args={[undefined, undefined, count * 2]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#47453d" roughness={0.92} />
      </instancedMesh>
      <instancedMesh ref={lintels} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3a3832" roughness={0.92} />
      </instancedMesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -depth / 2]}>
        <planeGeometry args={[90, depth + 90]} />
        <meshStandardMaterial color="#2b2a25" roughness={1} />
      </mesh>
      <mesh position={sun}>
        <circleGeometry args={[4.6, 48]} />
        <meshBasicMaterial color="#ff5a2b" fog={false} toneMapped={false} />
      </mesh>
    </>
  );
}

function Still() {
  return (
    <div className={styles.still}>
      <svg viewBox="0 0 400 220" role="img" aria-label="Drawing of a colonnade of gateways receding towards a low orange sun" preserveAspectRatio="xMidYMid slice">
        <rect width="400" height="220" fill={FOG} />
        <circle cx="200" cy="112" r="34" fill="#ff5a2b" />
        <rect y="150" width="400" height="70" fill="#22221e" />
        {[0, 1, 2, 3].map((i) => {
          const k = 1 - i * 0.22, w = 300 * k, h = 190 * k, x = 200 - w / 2, y = 168 - h * 0.8, t = 22 * k;
          return <path key={i} d={`M${x} ${y + h}V${y}h${w}v${h}h${-t}V${y + t}h${-(w - 2 * t)}v${h - t}z`} fill="#47453d" opacity={1 - i * 0.2} />;
        })}
      </svg>
      <ol>{CAPTIONS.map((c) => <li key={c.title}><strong>{c.title}.</strong> {c.body}</li>)}</ol>
    </div>
  );
}

export default function ScrollCameraDolly({ params }: EffectProps<Params>) {
  const { reduced } = useStudioMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const captions = useRef<(HTMLElement | null)[]>([]);
  const progress = useRef(0);
  const api = useRef<Api | null>(null);
  const [step, setStep] = useState(0);

  const apply = (p: number) => {
    progress.current = p;
    bar.current?.style.setProperty('transform', `scaleX(${p})`);
    CAPTIONS.forEach((c, i) => {
      const el = captions.current[i];
      if (!el) return;
      const [a, b] = c.range;
      const o = Math.min(smooth(a - 0.05, a + 0.03, p), 1 - smooth(b - 0.03, b + 0.05, p));
      el.style.opacity = String(a === 0 ? 1 - smooth(b - 0.03, b + 0.05, p) : b === 1 ? smooth(a - 0.05, a + 0.03, p) : o);
    });
    api.current?.invalidate();
  };
  useScrollProgress(track, apply, { container: scroller, mode: 'contain', enabled: !reduced });
  useEffect(() => { if (reduced) apply(STEPS[step]); }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.root} data-reduced={reduced || undefined} style={{ '--len': reduced ? 1 : params.length } as CSSProperties}>
      <div ref={scroller} className={styles.scroller} tabIndex={0} role="region" aria-label="Camera move through a colonnade. Scroll this area to travel.">
        <div ref={track} className={styles.track}>
          <div className={styles.sticky}>
            <StudioCanvas
              label="Colonnade of stone gateways in fog, leading to a low orange sun"
              description="The camera travels along a curved path between two rows of columns joined by lintels, starting outside the first gateway and ending facing the sun."
              flat
              camera={{ fov: 52, near: 0.1, far: 140, position: [0, 1.5, 9] }}
              style={{ position: 'absolute', inset: 0 }}
              fallback={<Still />}
            >
              <Scene params={params} progress={progress} api={api} cut={reduced} />
            </StudioCanvas>
            <div className={styles.captions}>
              {CAPTIONS.map((c, i) => (
                <p key={c.title} ref={(el) => { captions.current[i] = el; }} className={styles.caption} style={{ opacity: i === 0 ? 1 : 0 }}>
                  <span className={styles.index}>{String(i + 1).padStart(2, '0')} / 03</span>
                  <strong>{c.title}</strong>
                  <span>{c.body}</span>
                </p>
              ))}
            </div>
            {reduced ? (
              <div className={styles.steps} role="group" aria-label="Viewpoints">
                {CAPTIONS.map((c, i) => (
                  <button key={c.title} type="button" aria-pressed={step === i} onClick={() => setStep(i)}>{i + 1}<span className={styles.srOnly}>: {c.title}</span></button>
                ))}
              </div>
            ) : (
              <p className={styles.hint} aria-hidden="true">Scroll <span className={styles.rail}><span ref={bar} /></span></p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
