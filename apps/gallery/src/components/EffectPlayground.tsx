'use client';
import type { EffectMeta, ParamSpec, ParamValues } from '@maquettekit/library/types';
import { useMemo, useState } from 'react';
import { TECH_LABEL } from '@/lib/site';
import { CodeViewer } from './CodeViewer';
import { EffectStage } from './EffectStage';
import { useSettings } from './Providers';

const DEVICES = [
  { id: 'fluid', label: 'Fluid', width: null },
  { id: 'tablet', label: 'Tablet 768', width: 768 },
  { id: 'mobile', label: 'Mobile 390', width: 390 },
] as const;

function ParamControl({ spec, value, onChange }: { spec: ParamSpec; value: ParamValues[string]; onChange: (v: ParamValues[string]) => void }) {
  const id = `param-${spec.key}`;
  const label = <label htmlFor={id} className="mk-label text-muted">{spec.label}</label>;
  if (spec.type === 'number') {
    return (
      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between">{label}<output htmlFor={id} className="font-mono text-xs tabular-nums">{String(value)}{spec.unit ?? ''}</output></div>
        <input id={id} type="range" min={spec.min} max={spec.max} step={spec.step ?? 1} value={Number(value)} onChange={(e) => onChange(Number(e.target.value))} className="h-6 w-full accent-[var(--mk-signal)]" />
      </div>
    );
  }
  if (spec.type === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-3">
        {label}
        <input id={id} type="checkbox" role="switch" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[var(--mk-signal)]" />
      </div>
    );
  }
  if (spec.type === 'select') {
    return (
      <div className="grid gap-1.5">
        {label}
        <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-[var(--mk-radius-s)] border border-line bg-surface px-2 font-mono text-xs">
          {spec.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (spec.type === 'color') {
    return (
      <div className="flex items-center justify-between gap-3">
        {label}
        <span className="flex items-center gap-2 font-mono text-xs">{String(value)}<input id={id} type="color" value={String(value)} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 rounded border border-line bg-transparent p-0.5" /></span>
      </div>
    );
  }
  return (
    <div className="grid gap-1.5">
      {label}
      <input id={id} type="text" value={String(value)} maxLength={spec.maxLength ?? 120} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-[var(--mk-radius-s)] border border-line bg-surface px-2 text-sm" />
    </div>
  );
}

function Notes({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <section>
      <h3 className="mk-label border-b border-line pb-2 text-muted">{title}</h3>
      <ul className="mt-3 grid gap-2.5 text-sm leading-relaxed">
        {items.map((t) => <li key={t} className="grid grid-cols-[auto_1fr] gap-2.5"><span aria-hidden="true" className="mt-[0.6em] h-px w-3 bg-signal" />{t}</li>)}
      </ul>
    </section>
  );
}

export function EffectPlayground({ meta }: { meta: EffectMeta }) {
  const { reduced, setReduced } = useSettings();
  const [overrides, setOverrides] = useState<ParamValues>({});
  const [replay, setReplay] = useState(0);
  const [device, setDevice] = useState<(typeof DEVICES)[number]['id']>('fluid');
  const [copied, setCopied] = useState(false);
  const width = DEVICES.find((d) => d.id === device)?.width ?? null;
  const values = useMemo(() => Object.fromEntries(meta.params.map((p) => [p.key, overrides[p.key] ?? p.default])) as ParamValues, [meta.params, overrides]);
  const install = meta.dependencies.length ? `npm install ${meta.dependencies.map((d) => d.name).join(' ')}` : null;

  return (
    <div className="grid gap-10">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label="Live preview" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border border-b-0 border-line bg-surface px-3 py-2">
            <div role="radiogroup" aria-label="Preview width" className="flex gap-1">
              {DEVICES.map((d) => (
                <label key={d.id} className="mk-label cursor-pointer rounded-full border border-transparent px-2.5 py-1.5 text-muted has-checked:border-line-strong has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-focus">
                  <input type="radio" name="device" className="mk-sr-only" checked={device === d.id} onChange={() => setDevice(d.id)} />{d.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" aria-pressed={reduced} onClick={() => setReduced(!reduced)} className="mk-label rounded-full border border-line px-2.5 py-1.5 aria-pressed:bg-ink aria-pressed:text-bg">Reduced motion</button>
              <button type="button" onClick={() => setReplay((r) => r + 1)} data-replay="" className="mk-label rounded-full border border-line px-2.5 py-1.5 hover:border-line-strong">Replay</button>
            </div>
          </div>
          <div className="border border-line bg-surface-2 p-0" data-preview-frame={device}>
            <div className="mx-auto transition-[max-width] duration-300 ease-emphasized" style={{ maxWidth: width ?? '100%' }}>
              <EffectStage id={meta.id} overrides={overrides} replayKey={replay} />
            </div>
          </div>
          <p className="mk-label mt-2 text-muted">{width ? `Container ${width}px — recipes respond with container queries` : 'Fluid container'}{reduced ? ' · reduced motion on' : ''}</p>
        </section>

        <aside aria-label="Parameters" className="border border-line bg-surface p-4">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h2 className="mk-label text-muted">Parameters</h2>
            <button type="button" onClick={() => setOverrides({})} disabled={!Object.keys(overrides).length} className="mk-label underline decoration-line underline-offset-4 disabled:opacity-40">Reset</button>
          </div>
          {meta.params.length ? (
            <div className="mt-4 grid gap-5">
              {meta.params.map((p) => <ParamControl key={p.key} spec={p} value={values[p.key]} onChange={(v) => setOverrides((o) => ({ ...o, [p.key]: v }))} />)}
            </div>
          ) : <p className="mt-4 text-sm text-muted">This recipe has no parameters.</p>}
        </aside>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-labelledby="source-h" className="min-w-0">
          <h2 id="source-h" className="mk-label mb-3 break-all text-muted">Source — plugins/maquettekit/library/src/effects/{meta.id}</h2>
          <CodeViewer kind="effects" id={meta.id} />
        </section>
        <div className="grid content-start gap-8">
          <section>
            <h3 className="mk-label border-b border-line pb-2 text-muted">Dependencies</h3>
            {install ? (
              <div className="mt-3">
                <ul className="grid gap-1 font-mono text-xs">{meta.dependencies.map((d) => <li key={d.name} className="flex justify-between gap-2"><span>{d.name}</span><span className="text-muted">{d.version}</span></li>)}</ul>
                <div className="mt-3 flex items-center gap-2 rounded-[var(--mk-radius-s)] border border-line bg-surface-2 p-2">
                  <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs">{install}</code>
                  <button type="button" className="mk-label shrink-0 underline underline-offset-4" onClick={async () => { try { await navigator.clipboard.writeText(install); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ } }}>
                    <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            ) : <p className="mt-3 text-sm">None beyond React — CSS and platform APIs only.</p>}
            <p className="mt-3 text-xs text-muted">Also copy <code className="font-mono">library/src/motion</code>{meta.technology.some((t) => ['r3f', 'three', 'glsl'].includes(t)) ? <> and <code className="font-mono">library/src/three</code></> : null} (shared tokens and hooks).</p>
          </section>
          <section>
            <h3 className="mk-label border-b border-line pb-2 text-muted">Reduced motion</h3>
            <p className="mt-3 text-sm leading-relaxed">{meta.reducedMotion}</p>
          </section>
          <Notes title="Accessibility" items={meta.accessibility} />
          <Notes title="Performance" items={meta.performance} />
          <section>
            <h3 className="mk-label border-b border-line pb-2 text-muted">Suitable for</h3>
            <ul className="mt-3 flex flex-wrap gap-1.5">{meta.applications.map((a) => <li key={a} className="rounded-full border border-line px-2.5 py-1 text-xs">{a}</li>)}</ul>
            <p className="mk-label mt-4 text-muted">{meta.technology.map((t) => TECH_LABEL[t] ?? t).join(' · ')}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
