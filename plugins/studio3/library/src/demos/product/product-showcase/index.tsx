'use client';
import { Suspense, lazy, useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { useStudioMotion } from '../../../motion';
import { detectCapabilities } from '../../../three/capabilities';
import { BASE_PRICE, COLOURWAYS, DETAILS, POSTER, PRESETS, PRESET_ORDER, SPECS, colourOf, formatPrice, type ColourId, type PresetId } from './data';
import { createRecolourer, type Recolourer } from './recolour';
import type { ViewerHandle, ViewerStatus } from './Viewer3D';
import styles from './styles.module.css';

/** The 3D view (three.js, R3F, the three-kit) is a separate chunk requested only on "Explore in 3D". */
const Viewer3D = lazy(() => import('./Viewer3D'));

const CHAPTERS = [
  { id: 'dial', n: '01', title: 'One dial, no menus.', body: 'Turn it for volume, press it to pause. There is no app to install and no second button to find in the dark. The ring underneath glows while a phone is paired and goes dark when it isn’t.', focus: { x: 67.5, y: 41 }, zoom: 2.9, shape: 'circle' },
  { id: 'driver', n: '02', title: 'Tuned for voices, not stadiums.', body: 'A single 52 mm full-range driver in a rubber surround, behind a perforated metal grille. It is voiced for speech and acoustic music at the volume of a conversation. It doesn’t pretend to fill a hall.', focus: { x: 32, y: 57.5 }, zoom: 2.2, shape: 'square' },
  { id: 'strap', n: '03', title: 'A strap that comes off.', body: 'The woven strap hangs on two anodised pins. Lift it off by hand and Pulse sits flat on a shelf, on four rubber feet, with nothing dangling.', focus: { x: 84, y: 54 }, zoom: 2.5, shape: 'pill' },
] as const;

function useReveal(enabled: boolean) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!enabled || typeof IntersectionObserver === 'undefined') { for (const i of items) i.dataset.reveal = 'in'; return; }
    for (const i of items) if (i.dataset.reveal !== 'in') i.dataset.reveal = 'wait';
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { (e.target as HTMLElement).dataset.reveal = 'in'; io.unobserve(e.target); }
    }, { threshold: 0.35 });
    for (const i of items) io.observe(i);
    return () => io.disconnect();
  }, [enabled]);
  return root;
}

export default function ProductShowcase() {
  const uid = useId();
  const { reduced } = useStudioMotion();
  const [colourId, setColourId] = useState<ColourId>('graphite');
  const [urls, setUrls] = useState<Partial<Record<ColourId, string>>>({ graphite: POSTER });
  const [layers, setLayers] = useState<{ key: number; src: string }[]>([{ key: 0, src: POSTER }]);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'photo' | '3d'>('photo');
  const [viewer, setViewer] = useState<ViewerStatus | null>(null);
  const [preset, setPreset] = useState<PresetId | null>('hero');
  const [active, setActive] = useState<string | null>(null);
  const [bagged, setBagged] = useState(false);
  const [announce, setAnnounce] = useState('');
  const recolourer = useRef<Recolourer | null>(null);
  const viewerHandle = useRef<ViewerHandle>(null);
  const layerKey = useRef(1);
  const revealRoot = useReveal(!reduced);

  const colour = colourOf(colourId);
  const price = BASE_PRICE + colour.price;
  const live3d = mode === '3d' && viewer?.phase === 'ready';

  useEffect(() => { setWebgl(detectCapabilities().webgl2); }, []);

  // Prepare the tinted posters after first paint, so switching colourway in photo mode is instant.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const r = await createRecolourer(POSTER);
      if (cancelled) { r?.dispose(); return; }
      recolourer.current = r;
      if (!r) return;
      for (const c of COLOURWAYS) {
        if (c.id === 'graphite') continue;
        const u = await r.render({ shell: c.shell, accent: c.accent });
        if (cancelled) return;
        if (u) setUrls((m) => ({ ...m, [c.id]: u }));
      }
    };
    const idle = typeof window.requestIdleCallback === 'function';
    const id = idle ? window.requestIdleCallback(() => void run(), { timeout: 1500 }) : window.setTimeout(() => void run(), 300);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(id); else window.clearTimeout(id);
      recolourer.current?.dispose();
      recolourer.current = null;
    };
  }, []);

  // The visible poster follows the colourway; a new layer cross-fades over the previous one.
  const current = urls[colourId];
  useEffect(() => {
    if (!current) return;
    setLayers((ls) => (ls[ls.length - 1]?.src === current ? ls : [...ls.slice(-1), { key: layerKey.current++, src: current }]));
    if (reduced) return;
    const t = window.setTimeout(() => setLayers((ls) => ls.slice(-1)), 320);
    return () => window.clearTimeout(t);
  }, [current, reduced]);
  useEffect(() => { if (reduced) setLayers((ls) => ls.slice(-1)); }, [reduced, current]);

  const pick = (id: ColourId) => {
    setColourId(id);
    setBagged(false);
    const c = colourOf(id);
    setAnnounce(`${c.name}. ${formatPrice(BASE_PRICE + c.price)}.${mode === 'photo' && !urls[id] ? ' Tinting the photo…' : ''}`);
  };

  const open3d = () => { setMode('3d'); setPreset(DETAILS.find((d) => d.id === active)?.preset ?? 'hero'); setViewer({ phase: 'loading', text: 'Preparing the 3D view…' }); };
  const close3d = () => { setMode('photo'); setViewer(null); setActive(null); };
  const onStatus = useCallback((s: ViewerStatus) => setViewer(s), []);
  const leavePreset = useCallback(() => setPreset(null), []);
  const selectDetail = useCallback((id: string | null) => {
    setActive(id);
    const d = DETAILS.find((x) => x.id === id);
    if (d && mode === '3d') setPreset(d.preset);
  }, [mode]);

  const shownAlt = `Pulse speaker in ${colour.name}, three-quarter view${colour.id === 'graphite' ? '' : ' (the studio render, tinted in the browser)'}`;
  const activeDetail = DETAILS.find((d) => d.id === active) ?? null;
  const stageStyle = { '--stage-light': colour.stage.light, '--stage-dark': colour.stage.dark } as CSSProperties;

  return (
    <div className={styles.root} data-reduced={reduced || undefined} ref={revealRoot}>
      <section className={styles.hero} aria-labelledby={`${uid}title`}>
        <div className={styles.heroHead}>
          <p className={styles.maker}><span>Pulse</span><span className={styles.tag}>Fictional product · sample pricing</span></p>
          <h2 id={`${uid}title`} className={styles.title}>A small speaker for the room you’re in.</h2>
        </div>
        <div className={styles.stageCol}>
          <figure className={styles.stage} style={stageStyle} data-mode={mode} data-studio3-fallback={webgl === false ? '' : undefined}>
            <div className={styles.posterBox} data-hidden={live3d || undefined}>
              {layers.map((l, i) => (
                <img key={l.key} src={l.src} alt={i === layers.length - 1 ? shownAlt : ''} aria-hidden={i === layers.length - 1 ? undefined : true}
                  className={styles.poster} data-enter={!reduced && layers.length > 1 && i === layers.length - 1 ? '' : undefined} width={1024} height={1024} decoding="async" />
              ))}
              {mode === 'photo' ? DETAILS.map((d, i) => (
                <button key={d.id} type="button" className={styles.marker} style={{ left: `${d.at.x}%`, top: `${d.at.y}%` }}
                  aria-label={`Detail ${i + 1}: ${d.label}`} aria-expanded={active === d.id} aria-controls={`${uid}detail`}
                  onClick={() => setActive(active === d.id ? null : d.id)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setActive(null); }}>
                  {i + 1}
                </button>
              )) : null}
            </div>
            {mode === '3d' ? (
              <Suspense fallback={null}>
                <Viewer3D handle={viewerHandle} colourway={colour} preset={preset} active={active} onSelect={selectDetail} onLeavePreset={leavePreset} onStatus={onStatus} />
              </Suspense>
            ) : null}
            {mode === 'photo' ? (
              <div id={`${uid}detail`} className={styles.detailCard} aria-live="polite" data-open={activeDetail ? 'true' : undefined}>
                {activeDetail ? (
                  <>
                    <p className={styles.detailTitle}><span aria-hidden="true">{DETAILS.indexOf(activeDetail) + 1}</span>{activeDetail.label}</p>
                    <p className={styles.detailBody}>{activeDetail.description}</p>
                  </>
                ) : null}
              </div>
            ) : null}
            <figcaption className={styles.srOnly}>{mode === '3d' ? 'Interactive 3D view of Pulse.' : 'Photo of Pulse with numbered details.'}</figcaption>
          </figure>

          <div className={styles.stageBar}>
            {mode === 'photo' ? (
              <>
                {webgl === false ? (
                  <p className={styles.stageNote}>This browser can’t show the 3D view (it needs WebGL 2). The photo, the numbered details and everything below work without it.</p>
                ) : (
                  <>
                    <button type="button" className={styles.secondary} onClick={open3d} disabled={webgl === null}>
                      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 2.5 16.5 6v8L10 17.5 3.5 14V6Z" /><path d="M3.5 6 10 9.5 16.5 6M10 9.5v8" /></svg>
                      Explore in 3D
                    </button>
                    <p className={styles.stageNote}>Photo view. Numbers mark the details; 3D loads a 1–2 MB model only if you ask.</p>
                  </>
                )}
              </>
            ) : (
              <div className={styles.toolbar} role="toolbar" aria-label="3D view controls">
                <div className={styles.presets} role="group" aria-label="Camera view">
                  {PRESET_ORDER.map((id) => (
                    <button key={id} type="button" className={styles.presetBtn} aria-pressed={preset === id} disabled={!live3d} onClick={() => setPreset(id)}>{PRESETS[id].label}</button>
                  ))}
                </div>
                <div className={styles.tools}>
                  <button type="button" className={styles.iconBtn} aria-label="Zoom in" disabled={!live3d} onClick={() => viewerHandle.current?.zoom(1.18)}>+</button>
                  <button type="button" className={styles.iconBtn} aria-label="Zoom out" disabled={!live3d} onClick={() => viewerHandle.current?.zoom(1 / 1.18)}>−</button>
                  <button type="button" className={styles.textBtn} disabled={!live3d} onClick={() => { viewerHandle.current?.reset(); setPreset('hero'); }}>Reset view</button>
                  <button type="button" className={styles.secondary} onClick={close3d}>Back to photo</button>
                </div>
                <div className={styles.detailRow} role="group" aria-label="Details">
                  {DETAILS.map((d, i) => (
                    <button key={d.id} type="button" className={styles.detailBtn} aria-pressed={active === d.id} disabled={!live3d}
                      onClick={() => selectDetail(active === d.id ? null : d.id)}>
                      <span aria-hidden="true">{i + 1}</span>{d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className={styles.viewerStatus} role="status">{viewer?.text ?? ''}</p>
          </div>
        </div>
        <div className={styles.heroRest}>
          <p className={styles.lede}>Pulse is a portable Bluetooth speaker with one full-range driver, one dial and a strap that lifts off. It plays voices and quiet music well, and doesn’t pretend to do more.</p>

          <fieldset className={styles.colours}>
            <legend className={styles.colourLegend}>Colourway <span>{colour.name}</span></legend>
            <div className={styles.swatches}>
              {COLOURWAYS.map((c) => (
                <label key={c.id} className={styles.swatch}>
                  <input type="radio" name={`${uid}colour`} value={c.id} checked={colourId === c.id} onChange={() => pick(c.id)} className={styles.swatchInput} />
                  <span className={styles.swatchDot} aria-hidden="true" style={{ '--a': c.shell, '--b': c.accent } as CSSProperties} />
                  <span className={styles.swatchName}>{c.name}</span>
                  <span className={styles.srOnly}>, {c.note}{c.price ? `, adds ${formatPrice(c.price)}` : ''}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.buy}>
            <p className={styles.price}><span className={styles.priceValue}>{formatPrice(price)}</span><span className={styles.priceNote}>{colour.price ? `includes ${formatPrice(colour.price)} for ${colour.name}` : 'All colourways ship with the strap'}</span></p>
            <button type="button" className={styles.primary} onClick={() => setBagged(true)}>Add to bag</button>
          </div>
          <p className={styles.bagNote} aria-live="polite">{bagged ? `Demo only: there is no bag. Pulse in ${colour.name} is a fictional product.` : ''}</p>
        </div>

      </section>

      <section className={styles.chapters} aria-label="What Pulse does">
        {CHAPTERS.map((c, i) => (
          <article key={c.id} className={styles.chapter} data-side={i % 2 ? 'right' : 'left'} data-reveal="in">
            <div className={styles.crop} data-shape={c.shape} style={{ '--fx': `${c.focus.x}%`, '--fy': `${c.focus.y}%`, '--zoom': c.zoom, '--stage-light': colour.stage.light, '--stage-dark': colour.stage.dark } as CSSProperties}>
              <img src={current ?? POSTER} alt={`Close-up of the ${DETAILS.find((d) => d.id === c.id)?.label.toLowerCase() ?? c.id} on Pulse in ${colour.name}`} width={1024} height={1024} loading="lazy" decoding="async" />
            </div>
            <div className={styles.chapterText}>
              <p className={styles.chapterNum} aria-hidden="true">{c.n}</p>
              <h3 className={styles.chapterTitle}>{c.title}</h3>
              <p className={styles.chapterBody}>{c.body}</p>
            </div>
          </article>
        ))}
      </section>

      <section className={styles.specs} aria-labelledby={`${uid}specs`}>
        <div className={styles.specsHead}>
          <h2 id={`${uid}specs`} className={styles.sectionTitle}>Specification</h2>
          <p className={styles.specsNote}>Sample specification for a fictional product. The size is measured from the 3D model; everything else is illustrative.</p>
        </div>
        <table className={styles.table}>
          <caption className={styles.srOnly}>Pulse specification (sample)</caption>
          <tbody>
            {SPECS.map((s) => (
              <tr key={s.label}>
                <th scope="row">{s.label}</th>
                <td>{s.value}{s.source === 'model' ? <span className={styles.source}> · from the model</span> : null}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">Colourways</th>
              <td>{COLOURWAYS.map((c) => c.name).join(', ')}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.why3d} aria-labelledby={`${uid}why`}>
        <h2 id={`${uid}why`} className={styles.sectionTitle}>Why the 3D view waits for you</h2>
        <p>The photo at the top is a 66 KB image, so the page is complete the moment it appears. The 3D model is a 1.0 to 2.0 MB download (the build is chosen for your device) plus the renderer, which is worth it when you want to turn Pulse over and look at the dial up close, and wasteful when you only came for the price. So it loads when you press <em>Explore in 3D</em>, and never at all if your browser can’t run it.</p>
      </section>

      <section className={styles.closing} aria-labelledby={`${uid}closing`} style={stageStyle}>
        <h2 id={`${uid}closing`} className={styles.closingTitle}>Pulse in {colour.name}. {formatPrice(price)}.</h2>
        <button type="button" className={styles.primary} onClick={() => { setBagged(true); }}>Add to bag</button>
        <p className={styles.closingNote}>Sample pricing in US dollars. This demo has no checkout and Pulse doesn’t exist; the 3D model, render and specification are generated for the Studio³ library.</p>
      </section>

      <p className={styles.srOnly} role="status">{announce}</p>
    </div>
  );
}
