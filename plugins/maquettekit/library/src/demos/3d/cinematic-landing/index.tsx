'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import SplitLineReveal from '../../../effects/split-line-reveal';
import { meta as splitMeta } from '../../../effects/split-line-reveal/meta';
import { spring as SPRING, springToLinear, useElementSize, useScrollProgress, useStudioMotion } from '../../../motion';
import { StudioCanvas, defaultQualityProfiles, describeModelError, detectCapabilities, resolveModelUrl, resolveModelVariant, useModelManifest, type QualityLevel } from '../../../three';
import type { EffectMeta, ParamValues } from '../../../types';
import { Director, type DialApi, type PointerLight } from './Director';
import { MagneticPill } from './MagneticPill';
import { VOLUME } from './stage';
import styles from './styles.module.css';

const MANIFEST_URL = '/models/pulse-speaker.manifest.json';
const POSTER = '/models/pulse-speaker.webp';
const defaults = (m: EffectMeta): ParamValues => Object.fromEntries(m.params.map((p) => [p.key, p.default]));
const BEATS = [
  { id: 'night', label: 'Night' },
  { id: 'sound', label: 'Sound' },
  { id: 'dial', label: 'Dial' },
] as const;
/** Below this width the copy stacks under the speaker (a card at the bottom of each chapter). */
const STACK_BELOW = 768;

export default function CinematicLanding() {
  const { reduced } = useStudioMotion();
  const root = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLElement>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const beatEls = useRef<(HTMLElement | null)[]>([]);
  const progress = useRef(0);
  const invalidateRef = useRef<(() => void) | null>(null);
  const pointer = useRef<PointerLight>({ x: 0, y: 0, inside: false });
  const dialRef = useRef<DialApi | null>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [skip, setSkip] = useState(0);
  const [introDone, setIntroDone] = useState(false);
  const [ambience, setAmbience] = useState(true);
  const [beat, setBeat] = useState(0);
  const [level, setLevel] = useState<QualityLevel | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [volume, setVolume] = useState<number>(VOLUME.start);
  const [announced, setAnnounced] = useState('');
  const { width } = useElementSize(root);
  const stacked = width > 0 && width < STACK_BELOW;

  useEffect(() => { setWebgl(detectCapabilities().webgl); }, []);
  const { manifest } = useModelManifest(MANIFEST_URL);
  const variant = manifest && level ? resolveModelVariant(manifest, defaultQualityProfiles[level].modelVariant) : null;
  const url = variant ? resolveModelUrl(variant.file, MANIFEST_URL) : null;

  useScrollProgress(scene, (p) => {
    progress.current = p;
    invalidateRef.current?.();
    const b = Math.min(BEATS.length - 1, Math.round(p * (BEATS.length - 1)));
    setBeat((prev) => (prev === b ? prev : b));
  }, { mode: 'contain' });

  // Screen readers hear the volume once the dial comes to rest, not every notch.
  useEffect(() => {
    const t = window.setTimeout(() => setAnnounced(`Volume ${volume} of ${VOLUME.max}`), 450);
    return () => window.clearTimeout(t);
  }, [volume]);

  const onIntroDone = useCallback(() => setIntroDone(true), []);
  const onLoaded = useCallback(() => setLoaded(true), []);
  const onVolume = useCallback((v: number) => setVolume(v), []);
  // The scene's key light, handed to CSS: the angle the copy is lit from, and where the speaker stands.
  const onLight = useCallback((angle: number, subjectX: number) => {
    const el = root.current;
    if (!el) return;
    el.style.setProperty('--light-angle', `${angle.toFixed(1)}deg`);
    el.style.setProperty('--subject-x', `${(subjectX * 100).toFixed(1)}%`);
  }, []);
  const live = webgl === true && !error;
  const introRunning = live && !reduced && !introDone;
  const goTo = (i: number) => beatEls.current[i]?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  const stepVolume = (d: number) => {
    if (dialRef.current && live) dialRef.current.step(d);
    else setVolume((v) => Math.min(VOLUME.max, Math.max(0, v + d)));
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch' || reduced) return;
    const r = sticky.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    pointer.current = {
      x: Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)),
      y: Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1)),
      inside: e.clientY >= r.top && e.clientY <= r.bottom,
    };
    invalidateRef.current?.();
  };
  const onPointerLeave = () => { pointer.current = { ...pointer.current, inside: false }; invalidateRef.current?.(); };

  // Every pressable control releases on the same spring (CSS linear() sampled from the `press` token).
  const release = useMemo(() => springToLinear(SPRING.press), []);
  const rootStyle = { '--release-ease': release.easing, '--release-dur': `${release.duration}ms` } as CSSProperties;

  return (
    <div ref={root} data-stage="ink" data-beat={beat} data-layout={stacked ? 'stacked' : 'split'} data-reduced={reduced || undefined} className={`${styles.root} text-ink`} style={rootStyle}>
      <section ref={scene} className={styles.scene} aria-label="Pulse Night Edition" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
        <div ref={sticky} className={styles.sticky}>
          <StudioCanvas
            label="The Pulse speaker, night edition, on a stone plinth"
            description="A compact charcoal speaker with an orange dial and trim ring stands on a dark stone plinth under one warm key light and a cool rim light; a cyan ring around the dial glows softly. Scrolling moves the camera from a three-quarter view to the grille and then up over the dial, where the room goes dark and the ring lights the dial. The key light leans towards the pointer; dragging turns the speaker."
            frameloop={!reduced && ambience ? 'always' : 'demand'}
            onQualityChange={setLevel}
            onSceneError={setError}
            camera={{ fov: 22, near: 0.1, far: 60, position: [-9, 1.2, 8] }}
            style={{ position: 'absolute', inset: 0 }}
            fallback={<img src={POSTER} alt="Studio render of the Pulse speaker in graphite and ember" className={styles.poster} />}
          >
            {url ? (
              <Director
                progress={progress} invalidateRef={invalidateRef} pointer={pointer} dialRef={dialRef} stacked={stacked}
                skip={skip} playIntro={!reduced} ambience={ambience} reduced={reduced}
                onIntroDone={onIntroDone} onLoaded={onLoaded} onError={setError} onVolume={onVolume} onLight={onLight} variantUrl={url}
              />
            ) : null}
          </StudioCanvas>
          {error ? (
            <div className="absolute inset-0">
              <img src={POSTER} alt="Studio render of the Pulse speaker in graphite and ember" className={styles.poster} />
              <p role="alert" className="absolute bottom-4 right-4 m-0 max-w-[24rem] rounded-[6px] border border-line bg-surface p-3 text-[13px]">{describeModelError(error)} Showing the still render.</p>
            </div>
          ) : null}
          {live && !loaded ? <p className={`mk-label ${styles.loading}`} role="status">Loading the speaker…</p> : null}
        </div>

        <div className={styles.beats}>
          <div className={styles.chrome}>
            <div className={styles.chromeRow}>
              <p className="mk-label m-0 text-ink">kiln<span className="text-signal">.</span>audio <span className="text-muted">/ night edition</span></p>
              <div className="flex items-center gap-2">
                {introRunning ? (
                  <MagneticPill onClick={() => setSkip((n) => n + 1)}>Skip intro</MagneticPill>
                ) : live && !reduced ? (
                  <MagneticPill onClick={() => setAmbience((a) => !a)}>{ambience ? 'Pause light' : 'Play light'}</MagneticPill>
                ) : null}
              </div>
            </div>
            <nav aria-label="Sections" className={styles.nav}>
              {BEATS.map((b, i) => (
                <button key={b.id} type="button" className={styles.navItem} aria-current={beat === i ? 'step' : undefined} onClick={() => goTo(i)}>
                  <span className="font-mono text-[11px]">{String(i + 1).padStart(2, '0')}</span> {b.label}
                </button>
              ))}
            </nav>
          </div>

          <article ref={(el) => { beatEls.current[0] = el; }} className={styles.beat}>
            <div className={styles.copy}>
              <p className="mk-label m-0 text-muted">Pulse · Night Edition · fictional</p>
              <div className={styles.headline}>
                <SplitLineReveal params={{ ...defaults(splitMeta), text: 'Built for the hour after midnight.', stagger: 64, duration: 980, rise: 105, skew: true }} />
              </div>
              <p className={styles.body}>
                Graphite and ember, with a status ring that breathes while it plays. One dial, no screen, nothing to set up at one in the morning.
              </p>
              <p className={`mk-label ${styles.hint}`}><span aria-hidden="true" className={styles.rule} />Scroll to look closer · drag to turn it</p>
            </div>
          </article>

          <article ref={(el) => { beatEls.current[1] = el; }} className={`${styles.beat} ${styles.beatRight}`}>
            <div className={styles.copy}>
              <p className={styles.eyebrow}>01 — The sound</p>
              <h3 className={styles.title}>Small room, <span className="font-serif font-normal italic">full voice.</span></h3>
              <p className={styles.body}>
                A single 52 mm driver behind a perforated grille, tuned for voices and late playlists. It plays quietly without thinning out.
              </p>
            </div>
          </article>

          <article ref={(el) => { beatEls.current[2] = el; }} className={styles.beat}>
            <div className={styles.copy}>
              <p className={styles.eyebrow}>02 — The dial</p>
              <h3 className={styles.title}>Turn it. <span className="font-serif font-normal italic">That’s all.</span></h3>
              <p className={styles.body}>
                Turn for volume, press to pause. The ring beneath the dial glows while it is paired — the only light it makes in a dark room.
              </p>
              <div className={styles.dialRow} role="group" aria-label="Volume dial">
                <button type="button" className={styles.key} aria-label="Turn the dial down" onClick={() => stepVolume(-1)} disabled={volume <= 0}>
                  <span className={styles.keyFace} aria-hidden="true">−</span>
                </button>
                <p className={styles.readout} aria-hidden="true">
                  <span className={styles.readoutValue}>{String(volume).padStart(2, '0')}</span>
                  <span className={styles.meter}><span style={{ transform: `scaleX(${volume / VOLUME.max})` }} /></span>
                </p>
                <button type="button" className={styles.key} aria-label="Turn the dial up" onClick={() => stepVolume(1)} disabled={volume >= VOLUME.max}>
                  <span className={styles.keyFace} aria-hidden="true">+</span>
                </button>
                <p className="mk-sr-only" role="status">{announced}</p>
              </div>
              <p className={`mk-label ${styles.hint}`}>{live ? 'Drag the dial, or ← → with the stage focused · ' : ''}no sound — Pulse is fictional</p>
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-4 pb-24 pt-16 @3xl:px-8" aria-labelledby="night-specs">
        <div className="grid gap-8 border-t border-line-strong pt-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <h3 id="night-specs" className="m-0 font-serif text-[clamp(2rem,6cqi,3.4rem)] font-normal italic leading-none">The small print.</h3>
          <div>
            <dl className="m-0 grid grid-cols-1 gap-x-8 @xl:grid-cols-2">
              {[['Size', '223 × 144 × 85 mm'], ['Driver', 'One 52 mm full-range'], ['Controls', 'One knurled dial, 30 detents'], ['Light', 'Status ring, paired only'], ['Finish', 'Graphite shell, ember hardware'], ['Price', 'Not for sale — Pulse is fictional']].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-[14px]">
                  <dt className="text-muted">{k}</dt><dd className="m-0 text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="m-0 mt-5 text-[13.5px] leading-relaxed text-muted">
              Want it in another colour? <a href="/demos/3d/product-configurator" className={styles.link}>Open the configurator</a>. Without WebGL this page shows the same copy over a still render; with reduced motion the camera skips the opening move, cuts between chapters and the light holds still.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
