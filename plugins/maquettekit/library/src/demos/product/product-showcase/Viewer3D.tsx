'use client';
/**
 * The optional 3D view, loaded as its own chunk only after "Explore in 3D" is pressed.
 * The page owns every piece of state (colourway, camera preset, open annotation); this is a pure view of it.
 */
import { Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import {
  CameraRig, HotspotAnchors, HotspotLayer, LightingRig, Model, ModelBoundary, OrbitInspect, PartController, SceneFallback, StudioCanvas,
  defaultQualityProfiles, describeModelError, formatBytes, resolveModelUrl, resolveModelVariant, useHotspotStore, useModelManifest, useModelProgress,
  type CameraRigHandle, type LoadedModel, type OrbitInspectHandle, type QualityLevel,
} from '../../../three';
import { DETAILS, MANIFEST_URL, POSTER, PRESETS, SCALE, type Colourway, type PresetId } from './data';
import styles from './styles.module.css';

export interface ViewerHandle { zoom(factor: number): void; reset(): void }
export interface ViewerStatus { phase: 'loading' | 'ready' | 'error'; text: string }

interface Props {
  colourway: Colourway;
  preset: PresetId | null;
  active: string | null;
  onSelect: (id: string | null) => void;
  onLeavePreset: () => void;
  onStatus: (s: ViewerStatus) => void;
  handle?: Ref<ViewerHandle>;
}

export default function Viewer3D({ colourway, preset, active, onSelect, onLeavePreset, onStatus, handle }: Props) {
  const orbit = useRef<OrbitInspectHandle>(null);
  const rig = useRef<CameraRigHandle>(null);
  const store = useHotspotStore();
  const [level, setLevel] = useState<QualityLevel | null>(null);
  const [loaded, setLoaded] = useState<LoadedModel | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  const { manifest, error: manifestError } = useModelManifest(MANIFEST_URL);
  const variant = manifest && level ? resolveModelVariant(manifest, defaultQualityProfiles[level].modelVariant) : null;
  const url = variant ? resolveModelUrl(variant.file, MANIFEST_URL) : null;
  const progress = useModelProgress(url);
  const failure = error ?? manifestError;

  useImperativeHandle(handle, () => ({
    zoom: (f) => { orbit.current?.zoom(f); onLeavePreset(); },
    reset: () => { orbit.current?.reset(); rig.current?.goTo('hero'); },
  }), [onLeavePreset]);

  useEffect(() => {
    if (failure) onStatus({ phase: 'error', text: describeModelError(failure) });
    else if (loaded) onStatus({ phase: 'ready', text: `3D view ready${variant ? ` (${variant.profile} build, ${formatBytes(variant.bytes)})` : ''}. Drag or use the arrow keys on the view to turn it.` });
    else onStatus({ phase: 'loading', text: variant ? `Loading the ${variant.profile} build: ${progress.fraction != null ? `${Math.round(progress.fraction * 100)}%` : formatBytes(progress.loaded)} of ${formatBytes(variant.bytes)}` : 'Preparing the 3D view…' });
  }, [failure, loaded, variant, progress.fraction, progress.loaded, onStatus]);

  const onLoaded = useCallback((m: LoadedModel) => { setLoaded(m); setError(null); }, []);
  useEffect(() => { setLoaded(null); }, [url, attempt]);
  const hotspots = useMemo(() => DETAILS.map(({ id, node, position, label, description }) => ({ id, node, position, label, description })), []);

  if (failure) {
    return (
      <div className={styles.viewerError}>
        <SceneFallback title="Pulse speaker" image={POSTER} imageAlt="Studio render of the Pulse speaker in Graphite & Ember" reason={describeModelError(failure)}>
          <button type="button" className={styles.secondary} onClick={() => { setError(null); setAttempt((a) => a + 1); }}>Try the 3D view again</button>
        </SceneFallback>
      </div>
    );
  }

  return (
    <div className={styles.viewer} data-ready={loaded ? 'true' : undefined}>
      <StudioCanvas
        label={`Pulse speaker in ${colourway.name}, interactive 3D view`}
        description="Drag to turn the speaker, or focus the view and use the arrow keys to rotate and plus or minus to zoom. Numbered markers name the driver, the dial and the strap."
        lazy={false}
        isolate
        onQualityChange={setLevel}
        onSceneError={setError}
        camera={{ fov: 30, near: 0.1, far: 80, position: PRESETS.hero.position }}
        style={{ position: 'absolute', inset: 0 }}
        fallback={<SceneFallback title="Pulse speaker" image={POSTER} imageAlt="Studio render of the Pulse speaker in Graphite & Ember" description="The photo and every detail on this page stay available without 3D." />}
      >
        <LightingRig preset="studio-soft" shadowRadius={1.5} />
        <OrbitInspect ref={orbit} target={[0, 0.75, 0]} minDistance={2.4} maxDistance={10} maxPolarAngle={Math.PI * 0.58} onStart={onLeavePreset} />
        <CameraRig ref={rig} presets={PRESETS} preset={preset ?? undefined} smoothTime={0.55} onInterrupt={onLeavePreset} />
        {url ? (
          <ModelBoundary resetKey={`${url}#${attempt}`} onError={setError}>
            <Suspense fallback={null}>
              <Model key={attempt} src={url} scale={SCALE} castShadow onLoaded={onLoaded} onError={setError} />
              <PartController root={loaded?.scene ?? null} overrides={colourway.overrides} />
              <HotspotAnchors store={store} hotspots={hotspots} root={loaded?.scene ?? null} />
            </Suspense>
          </ModelBoundary>
        ) : null}
      </StudioCanvas>
      {loaded ? <HotspotLayer store={store} hotspots={hotspots} active={active} onSelect={onSelect} /> : null}
    </div>
  );
}
