'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import SplitLineReveal from '../../../effects/split-line-reveal';
import { meta as splitMeta } from '../../../effects/split-line-reveal/meta';
import { useScrollProgress, useStudioMotion } from '../../../motion';
import { StudioCanvas, defaultQualityProfiles, describeModelError, detectCapabilities, resolveModelUrl, resolveModelVariant, useModelManifest, type QualityLevel } from '../../../three';
import type { EffectMeta, ParamValues } from '../../../types';
import { Director } from './Director';
import styles from './styles.module.css';

const MANIFEST_URL = '/models/pulse-speaker.manifest.json';
const POSTER = '/models/pulse-speaker.webp';
const defaults = (m: EffectMeta): ParamValues => Object.fromEntries(m.params.map((p) => [p.key, p.default]));
const BEATS = [
  { id: 'night', label: 'Night' },
  { id: 'sound', label: 'Sound' },
  { id: 'dial', label: 'Dial' },
] as const;

export default function CinematicLanding() {
  const { reduced } = useStudioMotion();
  const scene = useRef<HTMLElement>(null);
  const beatEls = useRef<(HTMLElement | null)[]>([]);
  const progress = useRef(0);
  const invalidateRef = useRef<(() => void) | null>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [skip, setSkip] = useState(0);
  const [introDone, setIntroDone] = useState(false);
  const [ambience, setAmbience] = useState(true);
  const [beat, setBeat] = useState(0);
  const [level, setLevel] = useState<QualityLevel | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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

  const onIntroDone = useCallback(() => setIntroDone(true), []);
  const onLoaded = useCallback(() => setLoaded(true), []);
  const live = webgl === true && !error;
  const introRunning = live && !reduced && !introDone;
  const goTo = (i: number) => beatEls.current[i]?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });

  return (
    <div data-stage="ink" className={`${styles.root} text-ink`}>
      <section ref={scene} className={styles.scene} aria-label="Pulse Night Edition">
        <div className={styles.sticky}>
          <StudioCanvas
            label="The Pulse speaker, night edition, on a dark plinth"
            description="A compact charcoal speaker with an orange dial and trim ring stands on a black plinth under a single hard key light and a cool rim light; a cyan ring around the dial glows softly. Scrolling moves the camera from a three-quarter view to the grille and then down onto the dial."
            frameloop={!reduced && ambience ? 'always' : 'demand'}
            onQualityChange={setLevel}
            onSceneError={setError}
            camera={{ fov: 26, near: 0.1, far: 60, position: [-4.6, 0.3, 3.6] }}
            style={{ position: 'absolute', inset: 0 }}
            fallback={<img src={POSTER} alt="Studio render of the Pulse speaker in graphite and ember" className={styles.poster} />}
          >
            {url ? (
              <Director
                progress={progress} invalidateRef={invalidateRef} skip={skip} playIntro={!reduced} ambience={ambience} reduced={reduced}
                onIntroDone={onIntroDone} onLoaded={onLoaded} onError={setError} variantUrl={url}
              />
            ) : null}
          </StudioCanvas>
          {error ? (
            <div className="absolute inset-0">
              <img src={POSTER} alt="Studio render of the Pulse speaker in graphite and ember" className={styles.poster} />
              <p role="alert" className="absolute bottom-4 right-4 m-0 max-w-[24rem] rounded-[6px] border border-line bg-surface p-3 text-[13px]">{describeModelError(error)} Showing the still render.</p>
            </div>
          ) : null}
          {live && !loaded ? <p className="mk-label absolute bottom-4 right-4 m-0 text-muted" role="status">Loading the speaker…</p> : null}
        </div>

        <div className={styles.beats}>
          <div className={styles.chrome}>
            <div className={styles.chromeRow}>
              <p className="mk-label m-0 text-ink">kiln<span className="text-signal">.</span>audio <span className="text-muted">/ night edition</span></p>
              <div className="flex items-center gap-2">
                {introRunning ? (
                  <button type="button" className={styles.pill} onClick={() => setSkip((n) => n + 1)}>Skip intro</button>
                ) : live && !reduced ? (
                  <button type="button" className={styles.pill} onClick={() => setAmbience((a) => !a)}>{ambience ? 'Pause light' : 'Play light'}</button>
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
              <p className="m-0 max-w-[36ch] text-[16px] leading-relaxed text-muted">
                Graphite and ember, with a status ring that breathes while it plays. One dial, no screen, nothing to set up at one in the morning.
              </p>
              <p className="mk-label m-0 mt-2 flex items-center gap-3 text-muted"><span aria-hidden="true" className={styles.rule} />Scroll to look closer</p>
            </div>
          </article>

          <article ref={(el) => { beatEls.current[1] = el; }} className={`${styles.beat} ${styles.beatRight}`}>
            <div className={styles.copy}>
              <p className="m-0 font-mono text-[12px] tracking-[0.08em] text-signal">01 — The sound</p>
              <h3 className={styles.title}>Small room, <span className="font-serif font-normal italic">full voice.</span></h3>
              <p className="m-0 max-w-[36ch] text-[16px] leading-relaxed text-muted">
                A single 52 mm driver behind a perforated grille, tuned for voices and late playlists. It plays quietly without thinning out.
              </p>
            </div>
          </article>

          <article ref={(el) => { beatEls.current[2] = el; }} className={styles.beat}>
            <div className={styles.copy}>
              <p className="m-0 font-mono text-[12px] tracking-[0.08em] text-signal">02 — The dial</p>
              <h3 className={styles.title}>Turn it. <span className="font-serif font-normal italic">That’s all.</span></h3>
              <p className="m-0 max-w-[36ch] text-[16px] leading-relaxed text-muted">
                Turn for volume, press to pause. The ring beneath the dial glows while it is paired — the only light it makes in a dark room.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-4 pb-24 pt-16 @3xl:px-8" aria-labelledby="night-specs">
        <div className="grid gap-8 border-t border-line-strong pt-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <h3 id="night-specs" className="m-0 font-serif text-[clamp(2rem,6cqi,3.4rem)] font-normal italic leading-none">The small print.</h3>
          <div>
            <dl className="m-0 grid grid-cols-1 gap-x-8 @xl:grid-cols-2">
              {[['Size', '223 × 144 × 85 mm'], ['Driver', 'One 52 mm full-range'], ['Controls', 'One knurled dial'], ['Light', 'Status ring, paired only'], ['Finish', 'Graphite shell, ember hardware'], ['Price', 'Not for sale — Pulse is fictional']].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-[14px]">
                  <dt className="text-muted">{k}</dt><dd className="m-0 text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="m-0 mt-5 text-[13.5px] leading-relaxed text-muted">
              Want it in another colour? <a href="/demos/3d/product-configurator" className="text-ink underline underline-offset-4">Open the configurator</a>. Without WebGL this page shows the same copy over a still render; with reduced motion the camera skips the opening move and the lights hold still.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
