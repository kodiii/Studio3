'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useStudioMotion } from '../../../motion';
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
    <svg viewBox="-190 -190 380 380" className="h-[min(70%,22rem)] w-auto" aria-hidden="true">
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
  useEffect(() => { setWebgl(detectCapabilities().webgl); }, []);
  const animate = playing && !reduced;
  const diag = useCanvasDiagnostics(500);
  const timing = useFrameTiming(animate && webgl === true);
  const onAdvance = useCallback((next: number) => setForm(next), []);
  const density = level ? defaultQualityProfiles[level].density : null;
  const live = webgl === true && level !== null;

  return (
    <div data-stage="ink" className={`${styles.root} bg-bg pb-20 text-ink`}>
      <header className="mx-auto grid max-w-[1360px] gap-4 px-4 pt-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] @3xl:items-end @3xl:px-8 @3xl:pt-10">
        <div>
          <p className="mk-label m-0 text-muted">Field study № 3 · Obscura Lab (fictional)</p>
          <h2 className="m-0 mt-3 font-serif text-[clamp(3.2rem,13cqi,8.5rem)] font-normal italic leading-[0.85] tracking-[-0.03em]">Drift<span className="text-signal">.</span></h2>
        </div>
        <p className="m-0 max-w-[44ch] text-[15px] leading-relaxed text-muted">
          Thousands of points, each remembering its place on three forms. The GPU moves all of them every frame; your pointer, a finger, or the Pulse button pushes them around.
        </p>
      </header>

      <div className="mx-auto mt-6 grid max-w-[1360px] gap-6 px-4 @3xl:px-8 @5xl:grid-cols-[minmax(0,1fr)_22rem] @5xl:gap-8">
        <section aria-label="Particle field" className="min-w-0">
          <div className={styles.stage}>
            <StudioCanvas
              key={quality}
              label={`Particle field forming a ${FORMS[form].name.toLowerCase()}`}
              description={`About ${effective ? formatCount(effective) : 'several thousand'} glowing points arranged as a ${FORMS[form].name.toLowerCase()} on a black field; most are warm white, about one in seven is orange. ${animate ? 'They drift slowly and re-form into the next shape every few seconds.' : 'The field is still.'}`}
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
            <div className="pointer-events-none absolute inset-x-4 top-3 flex items-baseline justify-between gap-3">
              <p className="mk-label m-0 text-muted" aria-hidden="true">{String(form + 1).padStart(2, '0')} / 03</p>
              <p className="mk-label m-0 text-muted" aria-hidden="true">{animate ? 'Live' : reduced ? 'Still · reduced motion' : 'Paused'}</p>
            </div>
            <p className={styles.formName} aria-hidden="true">{FORMS[form].name}</p>
          </div>
          <p className="mt-2 text-[13px] leading-snug text-muted">
            {reduced
              ? 'Reduced motion is on, so the field is a still frame. Every control below still redraws it.'
              : 'Move a pointer or drag a finger across the field to push it; Pulse sends a ring through it from the keyboard.'}
          </p>
        </section>

        <form className={styles.panel} aria-label="Field controls" onSubmit={(e) => e.preventDefault()}>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mk-label mb-2 text-muted">Form</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {FORMS.map((f, i) => (
                <label key={f.id} className={styles.choice}>
                  <input type="radio" className="mk-sr-only" name={`${uid}form`} checked={form === i} onChange={() => setForm(i)} />
                  <span>{f.name}</span>
                </label>
              ))}
            </div>
            <p className="m-0 mt-2 text-[12.5px] leading-snug text-muted">{FORMS[form].note}</p>
            <label className="mt-2 flex min-h-9 items-center gap-2 text-[13px]">
              <input type="checkbox" className={styles.check} checked={autoCycle && !reduced} disabled={reduced} onChange={(e) => setAutoCycle(e.target.checked)} />
              Cycle forms every few seconds{reduced ? ' (off with reduced motion)' : ''}
            </label>
          </fieldset>

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
              <span className="text-[12.5px] leading-snug text-muted" aria-live="polite">
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

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <button type="button" className={styles.btn} onClick={() => setPlaying((p) => !p)} disabled={reduced}>{playing && !reduced ? 'Pause' : 'Play'}</button>
            <button type="button" className={styles.btn} onClick={() => field.current?.pulse()} disabled={!animate || !live}>Pulse</button>
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

      <section className="mx-auto mt-12 grid max-w-[1360px] gap-6 px-4 @3xl:grid-cols-3 @3xl:px-8" aria-label="How it works">
        {[
          ['One draw call', 'Every point is a vertex of a single THREE.Points object. Positions are never written from JavaScript: the vertex shader blends each particle between its three stored forms and adds the flow, the pointer push and the pulse ring.'],
          ['Quality scales the count', 'The requested count is multiplied by the quality profile’s density (1, 0.6 or 0.3), and the pixel ratio is capped per profile. Point size grows a little as the count drops, so the forms stay legible.'],
          ['Still when asked', 'With reduced motion, or when paused, the loop switches to render-on-demand: one frame per change. Forms cut instead of morphing, and the flow slider picks the frozen phase of the field.'],
        ].map(([t, b]) => (
          <div key={t} className="border-t border-line-strong pt-3">
            <h3 className="m-0 font-display text-[1.05rem] font-semibold">{t}</h3>
            <p className="m-0 mt-2 text-[13.5px] leading-relaxed text-muted">{b}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
