'use client';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { duration as D, easing, useStudioMotion } from '../../../motion';
import {
  BARS, BASE_PRICE, DEFAULT_BUILD, EXTRAS, FENDER_MAX_TYRE, FRAMES, MODEL, PAINTS, SIZES, TYRES,
  barOf, codeOf, countBuilds, fendersFit, fitOf, formatDelta, formatPrice, frameOf, fromHash, interpolateFit, mm,
  paintOf, priceOf, sameBuild, sizeOf, solve, toHash, tyreOf,
  type Build, type ExtraId, type Fit, type TyreId,
} from './bike';
import { BarIcon, BikeDrawing, describeBuild } from './Drawing';
import { Ticker } from './Ticker';
import styles from './styles.module.css';

/** cubic-bezier evaluator so the geometry tween uses the same `emphasized` token as the CSS. */
function bezier([x1, y1, x2, y2]: readonly [number, number, number, number]) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x; const d = dx(t); if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break; t -= e / d; }
    t = Math.min(1, Math.max(0, t));
    return ((ay * t + by) * t + cy) * t;
  };
}
const EMPHASIZED = bezier(easing.emphasized);

/** Tween the geometry numbers (size and tyre width) so the frame visibly grows or shrinks. Interruptible. */
function useTweenedFit(target: Fit, reduced: boolean): Fit {
  const [fit, setFit] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (reduced) { current.current = target; setFit(target); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / D.moderate);
      const v = interpolateFit(from, target, EMPHASIZED(t));
      current.current = v;
      setFit(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return fit;
}

interface Opt { id: string; name: string; note: string; price: number }

function Choices<T extends Opt>({ n, legend, hint, name, options, value, onPick, kind, children, render }: {
  n: string; legend: string; hint?: ReactNode; name: string; options: readonly T[]; value: string; kind: string;
  onPick: (o: T) => void; render: (o: T) => ReactNode; children?: ReactNode;
}) {
  const uid = useId();
  return (
    <fieldset className={styles.group} aria-describedby={hint ? `${uid}h` : undefined}>
      <legend className={styles.legend}><span className={styles.num} aria-hidden="true">{n}</span>{legend}</legend>
      {hint ? <p id={`${uid}h`} className={styles.hint}>{hint}</p> : null}
      <div className={styles.choices} data-kind={kind}>
        {options.map((o) => (
          <label key={o.id} className={styles.choice}>
            <input className={styles.input} type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onPick(o)} />
            {render(o)}
            <span className={styles.delta}>{formatDelta(o.price)}</span>
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}

export default function ProductConfigurator() {
  const uid = useId();
  const { reduced } = useStudioMotion();
  const [build, setBuild] = useState<Build>(DEFAULT_BUILD);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState<{ text: string; undo: Build } | null>(null);
  const [requested, setRequested] = useState(false);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'manual'>('idle');
  const linkField = useRef<HTMLInputElement>(null);
  const ticketHeading = useRef<HTMLHeadingElement>(null);

  // Shareable state: the build lives in the URL hash (replaceState, so Back still leaves the page).
  useEffect(() => {
    const read = () => { const b = fromHash(window.location.hash); if (b) setBuild((cur) => (sameBuild(cur, b) ? cur : b)); };
    read();
    setReady(true);
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const h = toHash(build);
    if (window.location.hash !== h) window.history.replaceState(window.history.state, '', h);
  }, [build, ready]);

  const target = useMemo(() => fitOf(build), [build.size, build.tyre]); // eslint-disable-line react-hooks/exhaustive-deps
  const fit = useTweenedFit(target, reduced);
  const combos = useMemo(countBuilds, []);

  const size = sizeOf(build), frame = frameOf(build), paint = paintOf(build), bar = barOf(build), tyre = tyreOf(build);
  const total = priceOf(build);
  const code = codeOf(build);
  const geo = solve(target);

  const commit = (next: Build, said: string) => {
    setBuild(next);
    setRequested(false);
    setCopied('idle');
    setStatus(`${said} Total ${formatPrice(priceOf(next))}.`);
  };

  const pickTyre = (id: TyreId) => {
    const t = TYRES.find((x) => x.id === id) ?? TYRES[0];
    if (!fendersFit(id) && build.extras.includes('fenders')) {
      setNotice({ text: `Fenders removed: the blades clear tyres up to ${FENDER_MAX_TYRE} mm.`, undo: build });
      commit({ ...build, tyre: id, extras: build.extras.filter((e) => e !== 'fenders') }, `Tyres: ${t.name}. Fenders removed, they clear tyres up to ${FENDER_MAX_TYRE} mm.`);
    } else {
      setNotice(null);
      commit({ ...build, tyre: id }, `Tyres: ${t.name}.`);
    }
  };

  const toggleExtra = (id: ExtraId, on: boolean) => {
    if (id === 'fenders' && on && !fendersFit(build.tyre)) return;
    const e = EXTRAS.find((x) => x.id === id) ?? EXTRAS[0];
    setNotice(null);
    const extras = EXTRAS.map((x) => x.id).filter((x) => (x === id ? on : build.extras.includes(x)));
    commit({ ...build, extras }, `${e.name} ${on ? 'added' : 'removed'}.`);
  };

  const undo = () => {
    if (!notice) return;
    const prev = notice.undo;
    setNotice(null);
    commit(prev, `Restored ${tyreOf(prev).name} tyres with fenders.`);
  };

  const reset = () => { setNotice(null); commit(DEFAULT_BUILD, 'Reset to the standard build.'); };

  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied('copied');
    } catch {
      setCopied('manual');
      requestAnimationFrame(() => { linkField.current?.focus(); linkField.current?.select(); });
    }
  };

  const fendersBlocked = !fendersFit(build.tyre);
  const lines: { k: string; label: string; value: string; price: number | null }[] = [
    { k: 'base', label: 'Frameset & build', value: `${MODEL}, size ${size.name}`, price: BASE_PRICE },
    { k: 'frame', label: 'Frame', value: frame.name, price: frame.price },
    { k: 'paint', label: 'Paint', value: frame.id === 'titanium' ? `${paint.name}, fork only` : paint.name, price: paint.price },
    { k: 'bar', label: 'Handlebar', value: bar.name, price: bar.price },
    { k: 'tyre', label: 'Tyres', value: tyre.name, price: tyre.price },
    ...EXTRAS.filter((e) => build.extras.includes(e.id)).map((e) => ({ k: e.id, label: 'Extra', value: e.name, price: e.price })),
  ];

  return (
    <div className={styles.root} data-reduced={reduced || undefined}>
      <div className={styles.layout}>
        <header className={styles.intro}>
          <p className={styles.brand}><span className={styles.wordmark}>Hollin Cycles</span><span className={styles.tag}>Sample pricing</span></p>
          <h2 className={styles.model}>{MODEL}</h2>
          <p className={styles.lede}>A steel all-road tourer, built to order. Pick a size and parts; the drawing is recalculated from the frame geometry as you choose.</p>
        </header>

        <section className={styles.plate} aria-labelledby={`${uid}plate`}>
          <div className={styles.plateHead}>
            <h3 id={`${uid}plate`} className={styles.plateTitle}>Side elevation, drive side</h3>
            <span className={styles.code} aria-label={`Build code ${code}`}>{code}</span>
          </div>
          <div className={styles.drawingWrap}>
            <BikeDrawing build={build} fit={fit} uid={uid} />
          </div>
          <p className={styles.caption}>{describeBuild(build)}</p>
          <div className={styles.strip}>
            <p className={styles.total}>
              <span className={styles.totalLabel}>Total</span>
              <Ticker value={total} format={formatPrice} reduced={reduced} className={styles.totalValue} />
            </p>
            <button type="button" className={styles.primary} onClick={() => { setRequested(true); ticketHeading.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); }}>
              Request this build
            </button>
          </div>
        </section>

        <form className={styles.options} aria-label="Build options" onSubmit={(e) => e.preventDefault()}>
          <Choices n="01" legend="Frame size" name={`${uid}size`} kind="size" options={SIZES} value={build.size}
            hint="Sizes are the seat tube length in centimetres. Rider heights are a starting point; reach and stack below are what to compare."
            onPick={(o) => commit({ ...build, size: o.id }, `Size ${o.name}.`)}
            render={(o) => (<><span className={styles.sizeNum}>{o.name}</span><span className={styles.note}>{o.rider}</span></>)}>
            <dl className={styles.geo} aria-label={`Geometry for size ${size.name}, in millimetres and degrees`}>
              <div><dt>Stack</dt><dd>{mm(size.stack)}</dd></div>
              <div><dt>Reach</dt><dd>{mm(size.reach)}</dd></div>
              <div><dt>Wheelbase</dt><dd>{mm(geo.wheelbase)}</dd></div>
              <div><dt>Head angle</dt><dd>{size.hta}°</dd></div>
              <div><dt>Seat angle</dt><dd>{size.sta}°</dd></div>
            </dl>
          </Choices>

          <Choices n="02" legend="Frame" name={`${uid}frame`} kind="frame" options={FRAMES} value={build.frame}
            onPick={(o) => commit({ ...build, frame: o.id }, `Frame: ${o.name}.`)}
            render={(o) => (<><span className={styles.name}>{o.name}</span><span className={styles.note}>{o.note}</span></>)} />

          <Choices n="03" legend="Paint" name={`${uid}paint`} kind="paint" options={PAINTS} value={build.paint}
            hint={frame.id === 'titanium' ? 'Titanium frames stay raw, so your colour goes on the steel fork.' : undefined}
            onPick={(o) => commit({ ...build, paint: o.id }, `Paint: ${o.name}${frame.id === 'titanium' ? ', on the fork' : ''}.`)}
            render={(o) => (
              <span className={styles.paintRow}>
                <span className={styles.swatch} style={{ background: o.colour }} aria-hidden="true" />
                <span className={styles.paintText}><span className={styles.name}>{o.name}</span><span className={styles.note}>{o.note}</span></span>
              </span>
            )} />

          <Choices n="04" legend="Handlebar" name={`${uid}bar`} kind="bar" options={BARS} value={build.bar}
            onPick={(o) => commit({ ...build, bar: o.id }, `Handlebar: ${o.name}.`)}
            render={(o) => (<><BarIcon id={o.id} /><span className={styles.name}>{o.name}</span><span className={styles.note}>{o.note}</span></>)} />

          <Choices n="05" legend="Tyres" name={`${uid}tyre`} kind="tyre" options={TYRES} value={build.tyre}
            onPick={(o) => pickTyre(o.id)}
            render={(o) => (<><span className={styles.name}>{o.name}</span><span className={styles.note}>{o.note}</span></>)}>
            {notice ? (
              <p className={styles.notice}>
                <span>{notice.text}</span>
                <button type="button" className={styles.textBtn} onClick={undo}>Undo</button>
              </p>
            ) : null}
          </Choices>

          <fieldset className={styles.group}>
            <legend className={styles.legend}><span className={styles.num} aria-hidden="true">06</span>Fitted extras</legend>
            <div className={styles.extras}>
              {EXTRAS.map((e) => {
                const blocked = e.id === 'fenders' && fendersBlocked;
                const on = build.extras.includes(e.id);
                return (
                  <div key={e.id} className={styles.extraItem}>
                    <label className={styles.extra} data-blocked={blocked || undefined}>
                      <input className={styles.input} type="checkbox" checked={on} aria-disabled={blocked || undefined}
                        aria-describedby={blocked ? `${uid}fend` : undefined}
                        onChange={(ev) => toggleExtra(e.id, ev.currentTarget.checked)} />
                      <span className={styles.box} aria-hidden="true">
                        <svg viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-6.5" /></svg>
                      </span>
                      <span className={styles.extraText}><span className={styles.name}>{e.name}</span><span className={styles.note}>{e.note}</span></span>
                      <span className={styles.delta}>{formatDelta(e.price)}</span>
                    </label>
                    {blocked ? (
                      <p id={`${uid}fend`} className={styles.blockedNote}>
                        <span>Fenders clear tyres up to {FENDER_MAX_TYRE} mm, so they can’t go on 45 mm gravel tyres.</span>
                        <button type="button" className={styles.textBtn} onClick={() => commit({ ...build, tyre: 'road38', extras: EXTRAS.map((x) => x.id).filter((x) => x === 'fenders' || build.extras.includes(x)) }, 'Tyres: 38 mm all-road. Full-length fenders added.')}>
                          Switch to 38 mm tyres and add fenders
                        </button>
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </fieldset>

          <section className={styles.ticket} aria-labelledby={`${uid}ticket`}>
            <div className={styles.ticketHead}>
              <h3 id={`${uid}ticket`} ref={ticketHeading} tabIndex={-1} className={styles.ticketTitle}>Your build</h3>
              <span className={styles.code}>{code}</span>
            </div>
            <dl className={styles.lines}>
              {lines.map((l) => (
                <div key={l.k} className={styles.line}>
                  <dt>{l.label}</dt>
                  <dd>{l.value}</dd>
                  <dd className={styles.linePrice}>{l.k === 'base' ? formatPrice(l.price ?? 0) : formatDelta(l.price ?? 0)}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.ticketTotal}><span>Total</span><span className={styles.ticketSum}>{formatPrice(total)}</span></p>
            <p className={styles.terms}>Sample pricing in US dollars before sales tax. Built to order; sample lead time 6–8 weeks.</p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => setRequested(true)}>Request this build</button>
              <button type="button" className={styles.secondary} onClick={copyLink}>Copy link to this build</button>
              <button type="button" className={styles.textBtn} onClick={reset}>Reset to the standard build</button>
            </div>
            <div className={styles.feedback} aria-live="polite">
              {requested ? <p className={styles.sent}>Demo only: nothing was sent. A real shop would open its build-slot form here with {code} attached.</p> : null}
              {copied === 'copied' ? <p className={styles.sent}>Link copied. Anyone who opens it sees this exact build.</p> : null}
            </div>
            {copied === 'manual' ? (
              <p className={styles.manual}>
                <label htmlFor={`${uid}link`}>Copying isn’t available here. Select the link and copy it:</label>
                <input id={`${uid}link`} ref={linkField} className={styles.linkField} readOnly value={typeof window === 'undefined' ? '' : window.location.href} />
              </p>
            ) : null}
          </section>
        </form>
      </div>

      <section className={styles.why} aria-labelledby={`${uid}why`}>
        <div className={styles.whyHead}>
          <p className={styles.kicker}>Why this configurator is a drawing</p>
          <h2 id={`${uid}why`} className={styles.whyTitle}>Bikes are chosen side-on, so we drew one.</h2>
        </div>
        <ol className={styles.reasons}>
          <li>
            <span className={styles.reasonNum} aria-hidden="true">01</span>
            <h3>Every choice shows from one side</h3>
            <p>Fit, tyre clearance, bar shape and where a rack sits are all side-elevation questions. Geometry charts, frame builders’ sketches and catalogue photos have always been drawn this way; turning the bike over answers nothing new.</p>
          </li>
          <li>
            <span className={styles.reasonNum} aria-hidden="true">02</span>
            <h3>{combos.toLocaleString('en-US')} builds, one drawing</h3>
            <p>Four sizes, two frames, four paints, three bars, three tyres and three extras make {combos.toLocaleString('en-US')} valid builds once the fender rule is applied. Too many to photograph, but each is just numbers, so the page draws it from the geometry table.</p>
          </li>
          <li>
            <span className={styles.reasonNum} aria-hidden="true">03</span>
            <h3>Nothing to download or wait for</h3>
            <p>It is SVG generated in the page: no model file, no WebGL context, no loading state. It stays sharp at any size, prints cleanly, and works on any device that can show this text.</p>
          </li>
        </ol>
        <aside className={styles.compare} aria-label="When 3D is worth it">
          <p>When an object has to be turned over (ports underneath, a strap behind, parts that come apart), real-time 3D earns its download and GPU cost. The 3D Studio’s speaker configurator is that case.</p>
          <a className={styles.compareLink} href="/demos/3d/product-configurator">View in 3D: the Pulse speaker configurator<span aria-hidden="true"> →</span></a>
        </aside>
      </section>

      <footer className={styles.colophon}>
        <p>Hollin Cycles and the {MODEL} are fictional. Geometry, prices and lead times are sample data for this demo.</p>
      </footer>

      <p className={styles.srOnly} role="status">{status}</p>
    </div>
  );
}
