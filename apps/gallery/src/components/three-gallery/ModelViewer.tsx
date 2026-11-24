'use client';
import {
  AnimationPlayer, CameraProbe, CameraRig, LightingRig, Model, ModelBoundary, OrbitInspect, PartController, SceneFallback, StudioCanvas,
  computeModelStats, defaultQualityProfiles, describeModelError, formatBytes, formatCount, lightingPresets, resolveModelUrl, resolveModelVariant,
  useCanvasDiagnostics, useModelManifest, useModelProgress,
  type AnimationPlayerHandle, type AnimationState, type CameraRigHandle, type LightingPresetName, type LoadedModel, type ModelStats,
  type OrbitInspectHandle, type QualityLevel,
} from '@maquettekit/library/three';
import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { VIEWER_MODELS } from './models';
import { ChipGroup, Section, Stat, ToolButton } from './ui';

type QualityChoice = QualityLevel | 'auto';
const SPEEDS = [0.25, 0.5, 1, 2] as const;
const STEP = Math.PI / 12;

export function ModelViewer() {
  const uid = useId();
  const [modelId, setModelId] = useState(VIEWER_MODELS[0].id);
  const cfg = VIEWER_MODELS.find((m) => m.id === modelId) ?? VIEWER_MODELS[0];
  const [quality, setQuality] = useState<QualityChoice>('auto');
  const [level, setLevel] = useState<QualityLevel | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [lighting, setLighting] = useState<LightingPresetName>('studio-soft');
  const [camera, setCamera] = useState('hero');
  const [colour, setColour] = useState(cfg.colourways[0].id);
  const [finish, setFinish] = useState(cfg.finishes[0].id);
  const [loaded, setLoaded] = useState<LoadedModel | null>(null);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [clip, setClip] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [anim, setAnim] = useState<AnimationState>({ clip: null, time: 0, duration: 0, playing: false });
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [webgl, setWebgl] = useState<'pending' | 'ok' | 'off'>('pending');

  const stage = useRef<HTMLDivElement>(null);
  const orbit = useRef<OrbitInspectHandle>(null);
  const rig = useRef<CameraRigHandle>(null);
  const player = useRef<AnimationPlayerHandle>(null);

  const { manifest, error: manifestError } = useModelManifest(cfg.manifestUrl);
  const ready = manifest?.id === cfg.id;
  const wanted = level ? defaultQualityProfiles[level].modelVariant : null;
  const variant = ready && wanted ? resolveModelVariant(manifest, wanted) : null;
  const url = variant ? resolveModelUrl(variant.file, cfg.manifestUrl) : null;
  const stillImage = ready ? manifest.fallbackImage ?? manifest.thumbnail : undefined;
  const poster = stillImage ? resolveModelUrl(stillImage, cfg.manifestUrl) : undefined;
  const progress = useModelProgress(url);
  const diag = useCanvasDiagnostics(500);

  // Reset per-model state when the model changes.
  useEffect(() => {
    setColour(cfg.colourways[0].id); setFinish(cfg.finishes[0].id); setCamera('hero');
    setLoaded(null); setStats(null); setError(null); setClip(null);
  }, [cfg]);
  useEffect(() => { setLoaded(null); setStats(null); setError(null); }, [url]);

  useEffect(() => {
    setCanFullscreen(typeof document !== 'undefined' && !!document.fullscreenEnabled);
    const on = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  // StudioCanvas marks the host with data-status once capabilities are known.
  useEffect(() => {
    const el = stage.current?.querySelector('[data-maquettekit-canvas]');
    if (!el) return;
    const read = () => { const s = el.getAttribute('data-status'); setWebgl(s === 'unsupported' ? 'off' : s === 'pending' ? 'pending' : 'ok'); };
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ['data-status'] });
    return () => mo.disconnect();
  }, []);

  const overrides = useMemo(() => ({
    ...cfg.colourways.find((c) => c.id === colour)?.overrides,
    ...Object.fromEntries(Object.entries(cfg.finishes.find((f) => f.id === finish)?.overrides ?? {}).map(([k, v]) => [k, { ...(cfg.colourways.find((c) => c.id === colour)?.overrides as Record<string, object> | undefined)?.[k], ...v }])),
  }), [cfg, colour, finish]);

  const onLoaded = useCallback((m: LoadedModel) => {
    setLoaded(m);
    setStats(computeModelStats(m.scene, m.animations));
    setClip((c) => (c && m.animations.some((a) => a.name === c) ? c : m.animations[0]?.name ?? null));
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen?.().catch(() => setCanFullscreen(false));
  }, []);

  const live = enabled && webgl !== 'off' && !error;
  const clips = loaded?.animations ?? [];
  const colourName = cfg.colourways.find((c) => c.id === colour)?.name ?? '';
  const finishName = cfg.finishes.find((f) => f.id === finish)?.name ?? '';
  const facts = [...cfg.facts, { label: 'Colourway', value: colourName }, { label: 'Finish', value: finishName }];
  const loading = live && !!url && !loaded && !error;
  const description = `${cfg.blurb} Currently shown in ${colourName}, ${finishName.toLowerCase()} finish, under ${lightingPresets[lighting].label.toLowerCase()} lighting.`;

  return (
    <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* ── Stage ─────────────────────────────────────────────── */}
      <div className="min-w-0">
        <div
          ref={stage}
          data-viewer-stage=""
          className="mk-viewer-stage relative aspect-[4/5] max-h-[78dvh] w-full overflow-hidden rounded-[10px] border border-line sm:aspect-[4/3] [&:fullscreen]:max-h-none [&:fullscreen]:rounded-none"
        >
          <StudioCanvas
            key={cfg.id}
            label={`Interactive 3D view of the ${cfg.name}`}
            description={description}
            quality={quality}
            disabled={!enabled}
            onQualityChange={setLevel}
            onSceneError={setError}
            camera={{ fov: 30, near: 0.1, far: 80, position: cfg.presets.hero.position }}
            style={{ position: 'absolute', inset: 0 }}
            fallback={<SceneFallback title={cfg.name} image={poster} imageAlt={`Static render of the ${cfg.name}`} description={cfg.blurb} facts={facts} />}
          >
            <CameraProbe />
            <LightingRig preset={lighting} shadowRadius={cfg.shadowRadius} />
            <OrbitInspect ref={orbit} target={cfg.target} minDistance={cfg.distance[0]} maxDistance={cfg.distance[1]} />
            <CameraRig ref={rig} presets={cfg.presets} preset={camera in cfg.presets ? camera : 'hero'} />
            {url ? (
              <ModelBoundary resetKey={url} onError={setError}>
                <Suspense fallback={null}>
                  <Model src={url} scale={cfg.scale} castShadow onLoaded={onLoaded} onError={setError} />
                  <PartController root={loaded?.scene ?? null} overrides={overrides} />
                  <AnimationPlayer ref={player} root={loaded?.scene ?? null} clips={clips} clip={clip} speed={speed} loop={loop} onState={setAnim} />
                </Suspense>
              </ModelBoundary>
            ) : null}
          </StudioCanvas>

          {error && enabled ? (
            <div className="absolute inset-0 bg-surface-2">
              <SceneFallback title={cfg.name} image={poster} imageAlt={`Static render of the ${cfg.name}`} facts={facts} reason={describeModelError(error)}>
                <button type="button" className="mt-1 justify-self-start rounded-[4px] border border-line-strong px-3 py-1.5 text-[13px]" onClick={() => { setError(null); setEnabled(false); requestAnimationFrame(() => setEnabled(true)); }}>Try again</button>
              </SceneFallback>
            </div>
          ) : null}

          <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1">
            <span className="mk-label rounded-[3px] bg-surface/85 px-2 py-1 backdrop-blur-sm">{cfg.name}</span>
            {variant && live ? <span className="mk-label rounded-[3px] bg-surface/85 px-2 py-1 text-muted backdrop-blur-sm" data-variant={variant.profile}>{variant.profile} · {formatBytes(variant.bytes)}</span> : null}
          </div>

          {loading ? (
            <div className="absolute inset-x-3 top-3 ml-auto w-44 rounded-[4px] border border-line bg-surface/90 p-2 backdrop-blur-sm" data-loading="">
              <p className="mk-label m-0 flex justify-between text-muted" aria-live="polite">
                <span>{progress.status === 'decoding' ? 'Decoding' : 'Loading'}</span>
                <span>{progress.fraction != null ? `${Math.round(progress.fraction * 100)}%` : formatBytes(progress.loaded)}</span>
              </p>
              <progress className="mk-progress mt-1.5 block h-1 w-full" aria-label={`Loading ${cfg.name}`} max={1} {...(progress.fraction != null && progress.status !== 'decoding' ? { value: progress.fraction } : {})} />
            </div>
          ) : null}

          {live ? (
            <div role="toolbar" aria-label="Camera controls" className="absolute inset-x-0 bottom-3 mx-auto flex w-max max-w-[calc(100%-1.5rem)] flex-wrap justify-center gap-1 rounded-[6px] border border-line bg-surface/85 p-1 backdrop-blur-sm">
              <ToolButton label="Rotate left" onClick={() => orbit.current?.rotate(STEP)}>←</ToolButton>
              <ToolButton label="Rotate right" onClick={() => orbit.current?.rotate(-STEP)}>→</ToolButton>
              <ToolButton label="Tilt up" onClick={() => orbit.current?.rotate(0, STEP / 2)}>↑</ToolButton>
              <ToolButton label="Tilt down" onClick={() => orbit.current?.rotate(0, -STEP / 2)}>↓</ToolButton>
              <ToolButton label="Zoom in" onClick={() => orbit.current?.zoom(1.2)}>+</ToolButton>
              <ToolButton label="Zoom out" onClick={() => orbit.current?.zoom(1 / 1.2)}>−</ToolButton>
              <ToolButton label="Reset view" onClick={() => { setCamera('hero'); rig.current?.goTo('hero'); }}>Reset</ToolButton>
              {canFullscreen ? <ToolButton label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFullscreen} data-fullscreen-toggle="">{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</ToolButton> : null}
            </div>
          ) : null}
        </div>
        <p className="mt-2 text-[13px] leading-snug text-muted">
          Drag to orbit, pinch or scroll (after clicking the view) to zoom. With the view focused: arrow keys rotate, <kbd className="font-mono">+</kbd>/<kbd className="font-mono">−</kbd> zoom, <kbd className="font-mono">0</kbd> resets.
          {canFullscreen ? ' Fullscreen from the toolbar; Esc leaves it.' : ' Fullscreen is not available in this browser.'}
        </p>
        {manifestError ? <p role="alert" className="mt-2 text-[13px] text-danger">Model manifest could not be loaded: {manifestError.message}</p> : null}

        {/* ── Statistics ─────────────────────────────────────── */}
        <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2" data-viewer-stats="">
          <div>
            <h3 className="mk-label mb-2 text-muted">Model · read from the loaded file</h3>
            <dl className="m-0 border-t border-line">
              <Stat label="Triangles" id="triangles" value={formatCount(stats?.triangles)} />
              <Stat label="Vertices" value={formatCount(stats?.vertices)} />
              <Stat label="Meshes" value={formatCount(stats?.meshes)} />
              <Stat label="Materials" value={formatCount(stats?.materials)} />
              <Stat label="Textures" value={stats ? (stats.textures ? `${stats.textures} · up to ${stats.largestTexture.width}px` : '0') : '—'} />
              <Stat label="Texture memory" note="estimate" value={stats ? formatBytes(stats.estimatedTextureBytes) : '—'} />
              <Stat label="Animation clips" value={stats ? `${stats.animations}${stats.animations ? ` · ${stats.animationSeconds.toFixed(1)} s` : ''}` : '—'} />
              <Stat label="File size" id="bytes" note="transferred" value={loaded ? formatBytes(loaded.bytes) : '—'} />
            </dl>
          </div>
          <div>
            <h3 className="mk-label mb-2 text-muted">Renderer · live from renderer.info</h3>
            <dl className="m-0 border-t border-line">
              <Stat label="Draw calls" id="draw-calls" note="last frame" value={live ? formatCount(diag?.renderer.calls) : '—'} />
              <Stat label="Triangles" id="frame-triangles" note="last frame" value={live ? formatCount(diag?.renderer.triangles) : '—'} />
              <Stat label="Geometries in memory" value={live ? formatCount(diag?.renderer.geometries) : '—'} />
              <Stat label="Textures in memory" value={live ? formatCount(diag?.renderer.textures) : '—'} />
              <Stat label="Shader programs" value={live ? formatCount(diag?.renderer.programs) : '—'} />
              <Stat label="Pixel ratio" value={live && diag ? diag.dpr.toFixed(2) : '—'} />
              <Stat label="Frames rendered" id="frames" note="on demand" value={live ? formatCount(diag?.frames) : '—'} />
              <Stat label="Quality profile" value={live ? level ?? '—' : '3D off'} />
            </dl>
          </div>
        </div>
      </div>

      {/* ── Controls ──────────────────────────────────────────── */}
      <form className="mt-8 min-w-0 lg:mt-0" aria-label="Viewer controls" onSubmit={(e) => e.preventDefault()}>
        <Section label="Model">
          <ChipGroup name={`${uid}model`} legend="Model" value={modelId} onChange={setModelId} options={VIEWER_MODELS.map((m) => ({ value: m.id, label: m.name }))} columns={2} />
          <p className="mt-2 text-[13px] leading-snug text-muted">{cfg.blurb}</p>
        </Section>
        <Section label="Camera">
          <ChipGroup name={`${uid}cam`} legend="Camera preset" value={camera} onChange={(v) => { setCamera(v); rig.current?.goTo(v); }} options={Object.entries(cfg.presets).map(([k, p]) => ({ value: k, label: p.label, disabled: !live }))} />
        </Section>
        <Section label="Colour" hint={colourName}>
          <ChipGroup name={`${uid}col`} legend="Colourway" value={colour} onChange={setColour} options={cfg.colourways.map((c) => ({ value: c.id, label: c.name, swatch: c.swatch }))} columns={2} />
        </Section>
        <Section label="Material finish">
          <ChipGroup name={`${uid}fin`} legend="Material finish" value={finish} onChange={setFinish} options={cfg.finishes.map((f) => ({ value: f.id, label: f.name }))} />
          <p className="mt-2 text-[13px] leading-snug text-muted">{cfg.finishes.find((f) => f.id === finish)?.note}</p>
        </Section>
        <Section label="Lighting">
          <ChipGroup name={`${uid}light`} legend="Lighting preset" value={lighting} onChange={setLighting} options={(Object.keys(lightingPresets) as LightingPresetName[]).map((k) => ({ value: k, label: lightingPresets[k].label }))} columns={2} />
          <p className="mt-2 text-[13px] leading-snug text-muted">{lightingPresets[lighting].description} Generated in the browser — no HDRI download.</p>
        </Section>
        <Section label="Animation" hint={clips.length ? `${anim.time.toFixed(2)} / ${anim.duration.toFixed(2)} s` : undefined}>
          {clips.length ? (
            <div className="grid gap-3">
              <ChipGroup name={`${uid}clip`} legend="Animation clip" value={clip ?? ''} onChange={setClip} options={clips.map((c) => ({ value: c.name, label: c.name }))} />
              <div className="flex items-center gap-2">
                <button type="button" className="h-9 min-w-20 rounded-[4px] bg-ink px-3 text-[13px] font-medium text-bg disabled:opacity-40" disabled={!live} aria-pressed={anim.playing} onClick={() => player.current?.toggle()}>{anim.playing ? 'Pause' : 'Play'}</button>
                <label className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
                  <span className="mk-sr-only">Scrub animation time</span>
                  <input type="range" className="s3-range w-full" min={0} max={anim.duration || 1} step={0.01} value={Math.min(anim.time, anim.duration || 1)} disabled={!live} onChange={(e) => player.current?.seek(Number(e.target.value))} aria-valuetext={`${anim.time.toFixed(2)} of ${anim.duration.toFixed(2)} seconds`} />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ChipGroup name={`${uid}speed`} legend="Playback speed" value={String(speed)} onChange={(v) => setSpeed(Number(v))} options={SPEEDS.map((s) => ({ value: String(s), label: `${s}×` }))} />
                <label className="flex min-h-9 items-center gap-2 text-[13px]"><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop</label>
              </div>
            </div>
          ) : <p className="m-0 text-[13px] text-muted">{loaded ? 'This model has no animation clips.' : 'Clips are listed once the model has loaded.'}</p>}
        </Section>
        <Section label="Quality" hint={variant ? `${variant.profile} build` : undefined}>
          <ChipGroup name={`${uid}q`} legend="Quality" value={quality} onChange={setQuality} options={(['auto', 'low', 'medium', 'high'] as const).map((q) => ({ value: q, label: q === 'auto' ? `Auto${level && quality === 'auto' ? ` (${level})` : ''}` : q[0].toUpperCase() + q.slice(1) }))} />
          <p className="mt-2 text-[13px] leading-snug text-muted">
            {variant ? <>Loads <code className="font-mono text-[12px]">{variant.file}</code> — {formatBytes(variant.bytes)}, {formatCount(variant.triangles)} triangles per the asset manifest{ready && manifest.variants.length === 1 ? ' (this asset ships a single build)' : ''}.</> : 'Reading the asset manifest…'}
          </p>
        </Section>
        <Section label="Rendering">
          <label className="flex min-h-9 items-center gap-2 text-[13px]">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Interactive 3D
          </label>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            {webgl === 'off' ? 'WebGL is not available here, so the static preview is shown. Every option above still applies to the description and facts.' : 'Turn off to see the static fallback that ships for devices without WebGL.'}
          </p>
        </Section>
      </form>
    </div>
  );
}
