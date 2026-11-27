'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { spring as SPRING, springToLinear, useStudioMotion } from '../../../motion';
import { StudioCanvas, defaultQualityProfiles, detectCapabilities, formatCount, useCanvasDiagnostics, useFrameTiming, type QualityLevel } from '../../../three';
import { Field, type FieldHandle } from './Field';
import { FORMS, buildForms } from './shapes';
import styles from './styles.module.css';

type QualityChoice = QualityLevel | 'auto';

/** No-WebGL still: the sphere form drawn as SVG dots (orthographic, depth as size + tone). */
function SphereStill() {
  const dots = useMemo(() => {
    const f = buildForms(700);
    const out: { x: number; y: number; r: number; o: number }[] = [];
    for (let i = 0; i < 700; i++) {
      const x = f.sphere[i * 3], y = f.sphere[i * 3 + 1], z = f.sphere[i * 3 + 2];
      out.push({ x: x * 100, y: -y * 100, r: 1.1 + (z + 1.7) * 0.55, o: 0.25 + ((z + 1.7) / 3.4) * 0.75 });
    }
    return out.sort((a, b) => a.r - b.r);
  }, []);
  return (
    <svg viewBox="-190 -190 380 380" className={`h-[min(70%,22rem)] w-auto ${styles.still}`} aria-hidden="true">
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={i % 7 === 0 ? '#ff6a33' : '#f3e7d3'} opacity={d.o} />)}
    </svg>
  );
}

function Readout({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5">
      <dt className="text-[12.5px] text-muted">{label}{note ? <span className="ml-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em]">{note}</span> : null}</dt>
      <dd className="m-0 font-mono text-[12.5px] tabular-nums">{value}</dd>
    </div>
  );
}

/* Keycaps lit from above — the field is the light source, the controls sit under it (press-depth-button, adapted). */
type KeyTone = 'glass' | 'signal' | 'paper';
function Key({ tone = 'glass', size = 'm', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: KeyTone; size?: 's' | 'm' }) {
  return (
    <button type="button" className={`${styles.key} ${className ?? ''}`} data-tone={tone} data-size={size} {...rest}>
      <span className={styles.keyShadow} aria-hidden="true" />
      <span className={styles.keySide} aria-hidden="true" />
      <span className={styles.keyFace}>{children}</span>
    </button>
  );
}
function KeyRadio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className={styles.key} data-tone="glass" data-size="m" data-latch="">
      <input type="radio" className="mk-sr-only" name={name} checked={checked} onChange={onChange} />
      <span className={styles.keyShadow} aria-hidden="true" />
      <span className={styles.keySide} aria-hidden="true" />
      <span className={styles.keyFace}>{children}</span>
    </label>
  );
}

export default function ParticleExperience() {
  const uid = useId();
  const { reduced } = useStudioMotion();
  const [form, setForm] = useState(0);
  const [autoCycle, setAutoCycle] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [intensity, setIntensity] = useState(0.55);
  const [flow, setFlow] = useState(0.5);
  const [count, setCount] = useState(24000);
  const [quality, setQuality] = useState<QualityChoice>('auto');
  const [level, setLevel] = useState<QualityLevel | null>(null);
  const [effective, setEffective] = useState<number | null>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const field = useRef<FieldHandle>(null);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => { setWebgl(detectCapabilities().webgl); }, []);
  const animate = playing && !reduced;
  const diag = useCanvasDiagnostics(500);
  const timing = useFrameTiming(animate && webgl === true);
  const onAdvance = useCallback((next: number) => setForm(next), []);
  const density = level ? defaultQualityProfiles[level].density : null;
  const live = webgl === true && level !== null;
  const release = useMemo(() => springToLinear(SPRING.pop), []);

  // A soft ember light follows the pointer across the stage: CSS variables written directly, no React re-render.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--px', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
      el.style.setProperty('--py', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      el.dataset.pointer = 'in';
    };
    const leave = () => { delete el.dataset.pointer; };
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, []);

  const rootStyle = { '--release-ease': release.easing, '--release-dur': `${release.duration}ms` } as CSSProperties;
  const stageStyle = { '--glow': (0.35 + intensity * 0.65).toFixed(2) } as CSSProperties;
  const status = animate ? 'Live' : reduced ? 'Still · reduced motion' : 'Paused';

  return (
    <div data-stage="ink" className={`${styles.root} bg-bg pb-20 text-ink`} style={rootStyle} data-reduced={reduced || undefined}>
      <section aria-label="Particle field" className={styles.hero}>
        <div ref={stage} className={styles.stage} style={stageStyle} data-live={animate || undefined}>
          <div className={styles.nebula} aria-hidden="true" />
          <div className={styles.pointerLight} aria-hidden="true" />
          <StudioCanvas
            key={quality}
            label={`Particle field forming a ${FORMS[form].name.toLowerCase()}`}
            description={`About ${effective ? formatCount(effective) : 'several thousand'} glowing points arranged as a ${FORMS[form].name.toLowerCase()} on a black field; most are warm white, about one in seven is orange. ${animate ? 'They drift slowly, turn towards the pointer and re-form into the next shape every few seconds.' : 'The field is still.'}`}
            quality={quality}
            onQualityChange={setLevel}
            frameloop={animate ? 'always' : 'demand'}
            flat
            camera={{ fov: 36, near: 0.1, far: 50, position: [0, 0.15, 6.6] }}
            style={{ position: 'absolute', inset: 0 }}
            fallback={
              <div className="grid h-full w-full place-items-center gap-2 p-4 text-center">
                <SphereStill />
                <p className="m-0 max-w-[36ch] text-[13.5px] text-ink">A still drawing of the sphere form. The live field needs WebGL.</p>
              </div>
            }
          >
            <Field ref={field} count={count} form={form} autoCycle={autoCycle && !reduced} animate={animate} intensity={intensity} flow={flow} onAdvance={onAdvance} onCount={setEffective} />
          </StudioCanvas>
          <div className={styles.vignette} aria-hidden="true" />

          <div className={styles.heroTop}>
            <div>
              <p className="mk-label m-0 text-muted">Field study № 3 · Obscura Lab (fictional)</p>
              <h2 className={styles.title}>Drift<span className="text-signal">.</span></h2>
            </div>
            <div className={styles.statusCluster}>
              <p className={styles.chip} aria-hidden="true"><span className={styles.dot} data-on={animate || undefined} />{status}</p>
              <Key size="s" onClick={() => setPlaying((p) => !p)} disabled={reduced}>{playing && !reduced ? 'Pause' : 'Play'}</Key>
            </div>
          </div>

          <p className={styles.formTag} aria-hidden="true"><span className="mk-label">{String(form + 1).padStart(2, '0')} / 03</span><span className={styles.formName}>{FORMS[form].name}</span></p>

          <div className={styles.dock}>
            <fieldset className={styles.dockForms}>
              <legend className="mk-sr-only">Form</legend>
              {FORMS.map((f, i) => (
                <KeyRadio key={f.id} name={`${uid}form`} checked={form === i} onChange={() => setForm(i)}>{f.name}</KeyRadio>
              ))}
            </fieldset>
            <span className={styles.dockRule} aria-hidden="true" />
            <Key tone="signal" onClick={() => field.current?.pulse()} disabled={!animate || !live}>Pulse</Key>
          </div>
        </div>
        <p className="mx-auto mt-3 max-w-[1360px] px-4 text-[13px] leading-snug text-muted @3xl:px-8">
          {reduced
            ? 'Reduced motion is on, so the field is a still frame. Every control still redraws it.'
            : 'Move a pointer or drag a finger sideways across the field to push it; the field turns to follow you. Pulse sends a ring through it from the keyboard.'}
        </p>
      </section>

      <div className="mx-auto mt-10 grid max-w-[1360px] gap-8 px-4 @3xl:px-8 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] @4xl:gap-10">
        <div className="min-w-0">
          <p className="m-0 max-w-[48ch] font-serif text-[clamp(1.4rem,3.2cqi,2rem)] leading-[1.2]">
            Thousands of points, each remembering its place on three forms. The GPU moves all of them every frame; your pointer, a finger, or the Pulse button pushes them around.
          </p>
          <section className="mt-10 grid gap-6 @2xl:grid-cols-3" aria-label="How it works">
            {[
              ['One draw call', 'Every point is a vertex of a single THREE.Points object. Positions are never written from JavaScript: the vertex shader blends each particle between its three stored forms and adds the flow, the pointer push and the pulse ring.'],
              ['Glow and depth in the shader', 'Each point is a white-hot core in a soft halo, and additive blending turns overlaps into bloom. Points behind the focus plane dim and cool; points away from it spread into wider, fainter discs — depth of field without a postprocessing pass.'],
              ['Still when asked', 'With reduced motion, or when paused, the loop switches to render-on-demand: one frame per change. Forms cut instead of morphing, the field stops turning to the pointer, and the flow slider picks the frozen phase.'],
            ].map(([t, b]) => (
              <div key={t} className="border-t border-line-strong pt-3">
                <h3 className="m-0 font-display text-[1.05rem] font-semibold">{t}</h3>
                <p className="m-0 mt-2 text-[13.5px] leading-relaxed text-muted">{b}</p>
              </div>
            ))}
          </section>
        </div>

        <form className={styles.panel} aria-label="Field controls" onSubmit={(e) => e.preventDefault()}>
          <section aria-labelledby={`${uid}formh`}>
            <h3 id={`${uid}formh`} className="mk-label m-0 mb-1.5 text-muted">Form · {FORMS[form].name}</h3>
            {/* All three notes share one grid cell, so the panel never changes height when the form cycles. */}
            <p className={styles.notes}>
              {FORMS.map((f, i) => <span key={f.id} data-shown={form === i || undefined} aria-hidden={form !== i || undefined}>{f.note}</span>)}
            </p>
            <label className="mt-2 flex min-h-9 items-center gap-2 text-[13px]">
              <input type="checkbox" className={styles.check} checked={autoCycle && !reduced} disabled={reduced} onChange={(e) => setAutoCycle(e.target.checked)} />
              Cycle forms every few seconds{reduced ? ' (off with reduced motion)' : ''}
            </label>
          </section>

          <div className="grid gap-3 border-t border-line pt-4">
            <label className="grid gap-1 text-[13px]">
              <span className="flex justify-between"><span>Intensity</span><span className="font-mono text-[12px] text-muted">{Math.round(intensity * 100)}%</span></span>
              <input type="range" className={styles.range} min={0} max={100} value={Math.round(intensity * 100)} onChange={(e) => setIntensity(Number(e.target.value) / 100)} />
            </label>
            <label className="grid gap-1 text-[13px]">
              <span className="flex justify-between"><span>Flow speed</span><span className="font-mono text-[12px] text-muted">{flow.toFixed(2)}×</span></span>
              <input type="range" className={styles.range} min={0} max={200} value={Math.round(flow * 100)} onChange={(e) => setFlow(Number(e.target.value) / 100)} aria-valuetext={`${flow.toFixed(2)} times`} />
            </label>
            <label className="grid gap-1 text-[13px]">
              <span className="flex justify-between"><span>Particles</span><span className="font-mono text-[12px] text-muted">{formatCount(count)} requested</span></span>
              <input type="range" className={styles.range} min={4000} max={60000} step={2000} value={count} onChange={(e) => setCount(Number(e.target.value))} aria-valuetext={`${count} requested`} />
              <span className={`${styles.reserve} text-[12.5px] leading-snug text-muted`} aria-live="polite">
                {effective && density != null ? `Rendering ${formatCount(effective)} — ${formatCount(count)} × ${density} density for the ${level} profile.` : 'Scaled by the quality profile once 3D starts.'}
              </span>
            </label>
            <label className="grid gap-1 text-[13px]">
              <span>Quality</span>
              <select className={styles.select} value={quality} onChange={(e) => setQuality(e.target.value as QualityChoice)}>
                <option value="auto">Auto{quality === 'auto' && level ? ` (${level})` : ''}</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <span className="text-[12.5px] leading-snug text-muted">Changing it rebuilds the canvas with that profile’s pixel ratio, antialiasing and density.</span>
            </label>
          </div>

          <section aria-labelledby={`${uid}diag`} className="border-t border-line pt-4">
            <h3 id={`${uid}diag`} className="mk-label m-0 mb-1 text-muted">Readout · renderer.info, last frame</h3>
            <dl className="m-0" data-particle-diagnostics="">
              <Readout label="Draw calls" value={live ? formatCount(diag?.renderer.calls) : '—'} />
              <Readout label="Points drawn" value={live ? formatCount(diag?.renderer.points) : '—'} />
              <Readout label="Shader programs" value={live ? formatCount(diag?.renderer.programs) : '—'} />
              <Readout label="Geometries in memory" value={live ? formatCount(diag?.renderer.geometries) : '—'} />
              <Readout label="Pixel ratio" value={live && diag ? diag.dpr.toFixed(2) : '—'} />
              <Readout label="Frames drawn" value={live ? formatCount(diag?.frames) : '—'} />
              <Readout label="Frame interval" note="measured on this device" value={animate && timing.medianMs != null ? `${timing.medianMs.toFixed(1)} ms median · ${timing.p95Ms?.toFixed(1)} p95` : '—'} />
            </dl>
            <p className="m-0 mt-2 text-[12px] leading-snug text-muted">The interval is the browser’s own frame cadence on this machine, sampled over 60 frames while the field runs. It is not a benchmark and says nothing about other hardware.</p>
          </section>
        </form>
      </div>
    </div>
  );
}
