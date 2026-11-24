'use client';
import type { ThreeEvent } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useStudioMotion } from '../../../motion';
import {
  AnimationPlayer, CameraRig, HotspotAnchors, HotspotLayer, HotspotList, LightingRig, Model, ModelBoundary, OrbitInspect, PartController,
  SceneFallback, StudioCanvas, defaultQualityProfiles, describeModelError, detectCapabilities, formatBytes, formatCount, resolveModelUrl,
  resolveModelVariant, useHotspotStore, useModelManifest, useModelProgress,
  type AnimationPlayerHandle, type AnimationState, type CameraPose, type CameraRigHandle, type LoadedModel, type OrbitInspectHandle,
  type PartControllerCore, type PartInfo, type QualityLevel,
} from '../../../three';
import {
  BASE_PRICE, COLOURWAYS, EXPLODED_PULLBACK, FALLBACK_IMAGE, HARDWARE_FINISHES, HOTSPOTS, MANIFEST_URL, PRESETS, PRESET_ORDER, SCALE,
  SHELL_FINISHES, STRAPS, STRAP_PARTS, formatDelta, formatPrice, mixHex, widen, type Option, type Overrides, type PresetId,
} from './config';
import { OptionCards, Segmented, Step } from './controls';
import styles from './styles.module.css';

const ZOOM_STEP = 1.18;
const ORBIT_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_']);
const pick = (list: Option[], id: string): Option => list.find((o) => o.id === id) ?? list[0];

/** Every camera pose the rig can be asked for: the four presets plus a pulled-back twin of each for the exploded view. */
const RIG_POSES: Record<string, CameraPose> = Object.fromEntries(
  PRESET_ORDER.flatMap((id) => [[id, PRESETS[id]], [`${id}:open`, widen(PRESETS[id], EXPLODED_PULLBACK)]]),
);

export default function ProductConfigurator() {
  const uid = useId();
  const { reduced } = useStudioMotion();
  const [colourId, setColourId] = useState(COLOURWAYS[0].id);
  const [shellId, setShellId] = useState(SHELL_FINISHES[0].id);
  const [hardwareId, setHardwareId] = useState(HARDWARE_FINISHES[0].id);
  const [strapId, setStrapId] = useState(STRAPS[0].id);
  const [preset, setPreset] = useState<PresetId | null>('hero');
  const [explode, setExplode] = useState(0);
  const [annotation, setAnnotation] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [parts, setParts] = useState<PartInfo[]>([]);
  const [loaded, setLoaded] = useState<LoadedModel | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [level, setLevel] = useState<QualityLevel | null>(null);
  const [still, setStill] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [anim, setAnim] = useState<AnimationState>({ clip: null, time: 0, duration: 0, playing: false });
  const orbit = useRef<OrbitInspectHandle>(null);
  const rig = useRef<CameraRigHandle>(null);
  const player = useRef<AnimationPlayerHandle>(null);
  const core = useRef<PartControllerCore | null>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  const store = useHotspotStore();

  useEffect(() => { setWebgl(detectCapabilities().webgl); }, []);

  const colour = pick(COLOURWAYS, colourId);
  const shell = pick(SHELL_FINISHES, shellId);
  const hardware = pick(HARDWARE_FINISHES, hardwareId);
  const strap = pick(STRAPS, strapId);
  const total = BASE_PRICE + colour.price + shell.price + hardware.price + strap.price;

  const { manifest, error: manifestError } = useModelManifest(MANIFEST_URL);
  const variant = manifest && level ? resolveModelVariant(manifest, defaultQualityProfiles[level].modelVariant) : null;
  const url = variant ? resolveModelUrl(variant.file, MANIFEST_URL) : null;
  const progress = useModelProgress(url);

  const overrides = useMemo(() => {
    const merged: Record<string, object> = {};
    const add = (o: Overrides) => { for (const [k, v] of Object.entries(o)) merged[k] = { ...merged[k], ...v }; };
    add(colour.overrides); add(shell.overrides); add(hardware.overrides);
    if (strap.id === 'dyed') add({ 'material:StrapFabric': { color: mixHex(colour.swatch?.[1] ?? '#ffffff', '#ffffff', 0.38) } });
    return merged as Overrides;
  }, [colour, shell, hardware, strap]);
  const hidden = useMemo<string[]>(() => (strap.id === 'none' ? [...STRAP_PARTS] : []), [strap.id]);
  const hotspots = useMemo(() => HOTSPOTS.filter((h) => strap.id !== 'none' || h.id !== 'strap'), [strap.id]);
  useEffect(() => { if (strap.id === 'none') { setAnnotation((a) => (a === 'strap' ? null : a)); setSelected((s) => (s && (STRAP_PARTS as readonly string[]).includes(s) ? null : s)); } }, [strap.id]);

  const live = webgl === true && !still && !error;
  const exploded = explode > 0.04;
  const rigPreset = preset ? (exploded ? `${preset}:open` : preset) : undefined;
  const selectedPart = parts.find((p) => p.name === selected) ?? null;
  const visibleParts = parts.filter((p) => !hidden.includes(p.name));

  const onLoaded = useCallback((m: LoadedModel) => { setLoaded(m); setError(null); }, []);
  const onPartsReady = useCallback((list: PartInfo[], c: PartControllerCore) => { core.current = c; setParts(list); }, []);
  useEffect(() => { setLoaded(null); setParts([]); core.current = null; }, [url, attempt]);

  // Pointer → part (hover highlight, click selection). Clicks that ended a drag are orbiting, not picking.
  const onPartMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    const p = core.current?.partOf(e.object);
    setHover((h) => (h === (p?.name ?? null) ? h : p?.name ?? null));
  }, []);
  const onPartClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return;
    e.stopPropagation();
    const p = core.current?.partOf(e.object);
    setSelected((s) => (p && s !== p.name ? p.name : null));
  }, []);

  // The user taking the camera (drag, wheel, keys, zoom buttons) leaves the named preset.
  const leavePreset = useCallback(() => setPreset(null), []);
  const onStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => { press.current = { x: e.clientX, y: e.clientY }; };
  const onStagePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current; press.current = null;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4 && (e.target as Element).tagName === 'CANVAS') leavePreset();
  };
  const onStageKey = (e: ReactKeyboardEvent<HTMLDivElement>) => { if ((e.target as Element).tagName === 'CANVAS' && ORBIT_KEYS.has(e.key)) leavePreset(); if (e.key === 'Escape') { setSelected(null); setAnnotation(null); } };

  const reset = () => {
    setColourId(COLOURWAYS[0].id); setShellId(SHELL_FINISHES[0].id); setHardwareId(HARDWARE_FINISHES[0].id); setStrapId(STRAPS[0].id);
    setExplode(0); setAnnotation(null); setSelected(null);
    if (preset === 'hero') rig.current?.goTo('hero'); else setPreset('hero');
    player.current?.pause(); player.current?.seek(0);
  };

  const summary = [
    { label: 'Colourway', value: colour.name, price: colour.price },
    { label: 'Shell', value: shell.name, price: shell.price },
    { label: 'Hardware', value: hardware.name, price: hardware.price },
    { label: 'Strap', value: strap.name, price: strap.price },
  ];
  const description = `The Pulse portable speaker in ${colour.name}: ${shell.name.toLowerCase()} shell, ${hardware.name.toLowerCase()} hardware, ${strap.id === 'none' ? 'no strap' : `${strap.name.toLowerCase()} strap`}${exploded ? `, exploded ${Math.round(explode * 100)} percent` : ''}.`;
  const facts = summary.map((s) => ({ label: s.label, value: s.value })).concat([{ label: 'Total', value: formatPrice(total) }]);
  const loading = live && !!url && !loaded;

  return (
    <div className="bg-bg pb-20 text-ink" data-configurator="">
      {/* ── Masthead ───────────────────────────────────────────── */}
      <header className="mx-auto max-w-[1280px] px-4 pt-6 @3xl:px-8 @3xl:pt-10">
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
          <p className="m-0 font-display text-[1.35rem] font-bold tracking-[-0.05em]">kiln<span className="text-accent">.</span>audio</p>
          <p className="mk-label m-0 text-muted">Fictional brand · sample prices</p>
        </div>
        <div className="grid gap-4 pt-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] @4xl:items-end @4xl:pt-8">
          <div>
            <p className="mk-label m-0 text-muted">Portable speaker · P1</p>
            <h2 className="m-0 mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span className="mk-display text-[clamp(3.4rem,13cqi,8rem)]">Pulse</span>
              <span className="font-serif text-[clamp(1.6rem,4.6cqi,2.8rem)] font-normal italic leading-none tracking-[-0.01em] text-muted">one dial, any room</span>
            </h2>
          </div>
          <p className="m-0 max-w-[42ch] text-[15px] leading-relaxed text-muted">
            A compact speaker with a single knurled dial. Choose its colours and finishes, take it apart, turn the dial — the summary keeps up, with or without the 3D view.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1280px] gap-8 px-4 pt-6 @3xl:px-8 @5xl:grid-cols-[minmax(0,1fr)_24rem] @5xl:gap-12">
        {/* ── Stage ─────────────────────────────────────────────── */}
        <section aria-label="Product view" className="min-w-0 @5xl:sticky @5xl:top-[60px] @5xl:self-start">
          <div
            className={styles.stage} data-stage-state={live ? 'live' : 'still'}
            onPointerDown={onStagePointerDown} onPointerUp={onStagePointerUp} onKeyDown={onStageKey}
            onWheel={(e) => { if (document.activeElement === e.target && (e.target as Element).tagName === 'CANVAS') leavePreset(); }}
          >
            <StudioCanvas
              label={`Pulse speaker, ${colour.name}`}
              description={description}
              disabled={still}
              onQualityChange={setLevel}
              onSceneError={setError}
              onPointerMissed={() => setSelected(null)}
              camera={{ fov: 30, near: 0.1, far: 80, position: PRESETS.hero.position }}
              style={{ position: 'absolute', inset: 0 }}
              fallback={
                <SceneFallback
                  title="Pulse speaker" image={FALLBACK_IMAGE} imageAlt="Studio render of the Pulse speaker in Graphite & Ember"
                  description={colour.id === 'graphite' ? 'Shown in the colourway you picked.' : `The still render shows Graphite & Ember; your pick, ${colour.name}, is listed below and in the summary.`}
                  facts={facts}
                />
              }
            >
              <LightingRig preset="studio-soft" shadowRadius={1.5} />
              <OrbitInspect ref={orbit} target={[0, 0.75, 0]} minDistance={2.4} maxDistance={11} />
              <CameraRig ref={rig} presets={RIG_POSES} preset={rigPreset} smoothTime={0.55} onInterrupt={leavePreset} />
              {url ? (
                <ModelBoundary resetKey={`${url}#${attempt}`} onError={setError}>
                  <Suspense fallback={null}>
                    <Model key={attempt} src={url} scale={SCALE} castShadow onLoaded={onLoaded} onError={setError} onPointerMove={onPartMove} onPointerOut={() => setHover(null)} onClick={onPartClick} />
                    <PartController root={loaded?.scene ?? null} overrides={overrides} hidden={hidden} explode={explode} highlight={hover} selected={selected} onReady={onPartsReady} />
                    <AnimationPlayer ref={player} root={loaded?.scene ?? null} clips={loaded?.animations ?? []} clip="KnobTurn" loop={false} onState={setAnim} />
                    <HotspotAnchors store={store} hotspots={hotspots} root={loaded?.scene ?? null} />
                  </Suspense>
                </ModelBoundary>
              ) : null}
            </StudioCanvas>

            {live && loaded ? <HotspotLayer store={store} hotspots={hotspots} active={annotation} onSelect={setAnnotation} /> : null}

            <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
              {live && variant ? <span className={styles.chip} data-variant={variant.profile}>{variant.profile} build · {formatBytes(variant.bytes)}</span> : null}
              {live && (hover || selectedPart) ? <span className={styles.chip}>{(parts.find((p) => p.name === hover) ?? selectedPart)?.label}</span> : null}
            </div>

            {loading ? (
              <div className="absolute right-3 top-3 w-40 rounded-[4px] border border-line bg-surface p-2" data-loading="">
                <p className="mk-label m-0 flex justify-between text-muted" aria-live="polite">
                  <span>{progress.status === 'decoding' ? 'Decoding' : 'Loading'}</span>
                  <span>{progress.fraction != null ? `${Math.round(progress.fraction * 100)}%` : formatBytes(progress.loaded)}</span>
                </p>
                <progress className={`${styles.progress} mt-1.5`} aria-label="Loading the 3D model" max={1} {...(progress.fraction != null && progress.status !== 'decoding' ? { value: progress.fraction } : {})} />
              </div>
            ) : null}

            {error && !still ? (
              <div className="absolute inset-0 bg-surface-2">
                <SceneFallback title="Pulse speaker" image={FALLBACK_IMAGE} imageAlt="Studio render of the Pulse speaker in Graphite & Ember" facts={facts} reason={describeModelError(error)}>
                  <button type="button" className={`${styles.iconButton} justify-self-start`} onClick={() => { setError(null); setAttempt((a) => a + 1); }}>Try again</button>
                </SceneFallback>
              </div>
            ) : null}
          </div>

          <div role="toolbar" aria-label="Camera" className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Segmented
              name={`${uid}view`} legend="Camera view" value={preset} disabled={!live}
              options={PRESET_ORDER.map((id) => ({ id, label: PRESETS[id].label }))}
              onChange={(id) => { if (id === preset) rig.current?.goTo(rigPreset ?? id); setPreset(id as PresetId); }}
            />
            <div className="flex gap-1">
              <button type="button" className={styles.iconButton} aria-label="Zoom in" disabled={!live} onClick={() => { orbit.current?.zoom(ZOOM_STEP); leavePreset(); }}>+</button>
              <button type="button" className={styles.iconButton} aria-label="Zoom out" disabled={!live} onClick={() => { orbit.current?.zoom(1 / ZOOM_STEP); leavePreset(); }}>−</button>
            </div>
          </div>
          <p className="mt-2 text-[13px] leading-snug text-muted">
            {webgl === false
              ? 'This browser cannot show the 3D view, so a still render is shown. Every option below still applies to the summary.'
              : still
                ? 'Showing the still render. Options still apply to the summary.'
                : <>Drag to turn it, click a part to name it. With the view focused, arrow keys rotate and <kbd className="font-mono">+</kbd> / <kbd className="font-mono">−</kbd> zoom. {preset ? `View: ${PRESETS[preset].label}.` : 'Custom view.'}</>}
          </p>
          {manifestError ? <p role="alert" className="mt-2 text-[13px] text-danger">The model list could not be loaded: {manifestError.message}</p> : null}
        </section>

        {/* ── Configuration ─────────────────────────────────────── */}
        <form aria-label="Configure Pulse" className="min-w-0" onSubmit={(e) => e.preventDefault()}>
          <Step n="01" title="Colourway" value={colour.name}>
            <OptionCards name={`${uid}colour`} legend="Colourway" value={colourId} onChange={setColourId}
              options={COLOURWAYS.map((o) => ({ id: o.id, name: o.name, note: o.note, swatch: o.swatch, meta: formatDelta(o.price) }))} />
          </Step>

          <Step n="02" title="Finish">
            <p className="mk-label mb-2 mt-0 text-muted" id={`${uid}shell-h`}>Shell</p>
            <OptionCards name={`${uid}shell`} legend="Shell finish" value={shellId} onChange={setShellId}
              options={SHELL_FINISHES.map((o) => ({ id: o.id, name: o.name, note: o.note, meta: formatDelta(o.price) }))} />
            <p className="mk-label mb-2 mt-4 text-muted">Hardware — dial, trim ring, badge, pins</p>
            <OptionCards name={`${uid}hw`} legend="Hardware finish" value={hardwareId} onChange={setHardwareId} columns={1}
              options={HARDWARE_FINISHES.map((o) => ({ id: o.id, name: o.name, note: o.note, meta: formatDelta(o.price) }))} />
          </Step>

          <Step n="03" title="Strap" value={strap.name}>
            <OptionCards name={`${uid}strap`} legend="Strap" value={strapId} onChange={setStrapId} columns={1}
              options={STRAPS.map((o) => ({ id: o.id, name: o.name, note: o.note, meta: formatDelta(o.price) }))} />
          </Step>

          <Step n="04" title="Look closer">
            <div className="grid gap-4">
              <label className="grid gap-1.5 text-[13.5px]">
                <span className="flex justify-between"><span>Exploded view</span><span className="font-mono text-[12px] text-muted">{explode === 0 ? 'assembled' : `${Math.round(explode * 100)}%`}</span></span>
                <input type="range" className={styles.range} min={0} max={100} step={1} value={Math.round(explode * 100)} disabled={!live}
                  onChange={(e) => setExplode(Number(e.target.value) / 100)} aria-valuetext={explode === 0 ? 'Assembled' : `${Math.round(explode * 100)} percent apart`} />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={styles.iconButton} disabled={!live || !loaded} onClick={() => (anim.playing ? player.current?.pause() : player.current?.play())}>
                  {anim.playing ? 'Pause' : 'Turn the dial'}
                </button>
                <span className="text-[13px] text-muted" aria-live="polite">
                  {anim.duration ? `KnobTurn clip · ${anim.time.toFixed(1)} / ${anim.duration.toFixed(1)} s` : 'KnobTurn clip, 2.0 s'}
                  {reduced ? ' · plays only when you ask' : ''}
                </span>
              </div>
              <div>
                <p className="mk-label mb-1 mt-0 text-muted">Annotations</p>
                <HotspotList hotspots={hotspots} active={annotation} onSelect={setAnnotation} label="Annotations" />
              </div>
              <details className="border-t border-line pt-2">
                <summary className="flex min-h-9 items-center justify-between text-[13.5px]">
                  <span>All parts {visibleParts.length ? `(${visibleParts.length})` : ''}</span>
                  <span className="text-[12.5px] text-muted">{selectedPart ? `Selected: ${selectedPart.label}` : 'None selected'}</span>
                </summary>
                {visibleParts.length ? (
                  <ul className="m-0 mt-1 list-none p-0">
                    {visibleParts.map((p) => (
                      <li key={p.name}>
                        <button type="button" className={styles.partButton} aria-pressed={selected === p.name} onClick={() => setSelected((s) => (s === p.name ? null : p.name))}>
                          <span>{p.label}</span><span className="font-mono text-[11px] text-muted">{p.materials.join(', ')}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-[13px] text-muted">{live ? 'Parts are listed once the model has loaded.' : 'Part selection needs the 3D view.'}</p>}
              </details>
              <p className="m-0 min-h-[1.4em] text-[13px] text-muted" aria-live="polite">{selectedPart ? `${selectedPart.label}${selectedPart.description ? ` — ${selectedPart.description}` : ''}` : ''}</p>
            </div>
          </Step>

          {/* ── Summary ─────────────────────────────────────────── */}
          <section aria-labelledby={`${uid}sum`} className="rounded-[10px] border border-line-strong bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 id={`${uid}sum`} className="mk-label m-0 text-muted">Your Pulse</h3>
              <span className="mk-label text-muted">Sample price</span>
            </div>
            <dl className="m-0 mt-3 border-t border-line">
              {summary.map((s) => (
                <div key={s.label} className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[13.5px]">
                  <dt className="text-muted">{s.label}</dt>
                  <dd className="m-0 text-right">{s.value} <span className="ml-1 font-mono text-[11.5px] text-muted">{formatDelta(s.price)}</span></dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex items-end justify-between gap-3">
              <p className="m-0" aria-live="polite" aria-atomic="true"><span className="mk-sr-only">Total </span><span className={styles.total} data-total={total}>{formatPrice(total)}</span></p>
              <button type="button" className={styles.iconButton} onClick={reset}>Reset</button>
            </div>
            <p className="mb-0 mt-3 text-[12.5px] leading-snug text-muted">Base {formatPrice(BASE_PRICE)}. Pulse and kiln.audio are fictional; nothing here is for sale.</p>
            <label className="mt-3 flex min-h-9 items-center gap-2 border-t border-line pt-3 text-[13px]">
              <input type="checkbox" checked={still} onChange={(e) => setStill(e.target.checked)} disabled={webgl === false} />
              Show the still render instead of 3D
            </label>
            {variant && live ? (
              <p className="mb-0 mt-1 text-[12.5px] leading-snug text-muted">
                3D build: <code className="font-mono text-[11.5px]">{variant.file}</code> — {formatBytes(variant.bytes)}, {formatCount(variant.triangles)} triangles (asset manifest), chosen for the {level} quality profile.
              </p>
            ) : null}
          </section>
        </form>
      </div>
    </div>
  );
}
