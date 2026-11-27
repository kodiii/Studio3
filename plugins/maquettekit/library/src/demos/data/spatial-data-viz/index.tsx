'use client';
import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react';
import { spring as SPRING, springToLinear, useStudioMotion } from '../../../motion';
import { StudioCanvas, formatCount, useCanvasDiagnostics } from '../../../three';
import { BarField, PRESETS, type Preset } from './BarField';
import { Heatmap } from './Heatmap';
import { COLS, DAYS, EXAGGERATION, MAX_CM, N, ROWS, SEED, cellName, cm, cmSigned, colName, dayLabel, palette, simulate, statsFor } from './data';
import s from './styles.module.css';

const DATA = simulate();
const VIEWS: readonly { id: Preset; label: string }[] = [{ id: 'overview', label: 'Overview' }, { id: 'windward', label: 'From the west' }, { id: 'plan', label: 'Near plan' }];
/** The press spring as a CSS linear() curve: controls spring back on release without a JS loop. */
const PRESS = springToLinear(SPRING.press);
const ROOT_STYLE = { '--sd-press': PRESS.easing, '--sd-press-dur': `${PRESS.duration}ms` } as CSSProperties;

function useTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setTheme(el.dataset.theme === 'dark' ? 'dark' : 'light');
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

export default function SpatialDataViz() {
  const uid = useId();
  const { reduced } = useStudioMotion();
  const theme = useTheme();
  const pal = useMemo(() => palette(theme), [theme]);
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [day, setDay] = useState(20);
  const [playing, setPlaying] = useState(false);
  const [preset, setPreset] = useState<Preset>('overview');
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [announce, setAnnounce] = useState('');
  const diag = useCanvasDiagnostics(1000);
  const values = DATA[day];
  const st = useMemo(() => statsFor(DATA, day), [day]);

  // Playback only on request; one step per 0.9 s; announced when it ends, not on every step.
  useEffect(() => {
    if (!playing) return;
    if (day >= DAYS - 1) { setPlaying(false); setAnnounce(`Playback finished on ${dayLabel(DAYS - 1)}.`); return; }
    const id = window.setTimeout(() => setDay((d) => Math.min(DAYS - 1, d + 1)), 900);
    return () => window.clearTimeout(id);
  }, [playing, day]);
  const go = (d: number) => {
    const next = Math.min(DAYS - 1, Math.max(0, d));
    setPlaying(false);
    setDay(next);
    const x = statsFor(DATA, next);
    setAnnounce(`${dayLabel(next)}: mean depth ${cm.format(x.mean)} centimetres, deepest ${cm.format(x.max)} at ${cellName(x.maxCell)}.`);
  };

  const cell = selected ?? hovered;
  const cellValue = cell !== null ? values[cell] : NaN;
  const prevValue = cell !== null && day > 0 ? DATA[day - 1][cell] : NaN;
  const rank = cell !== null && Number.isFinite(cellValue) ? Array.from(values).filter((v) => Number.isFinite(v) && v > cellValue).length + 1 : null;
  const maxCol = st.maxCell % COLS;
  const summary = `${dayLabel(day)}: ${st.reporting} of ${N} sensors reporting. Mean depth ${cm.format(st.mean)} cm${st.deltaMean === null ? '' : ` (${cmSigned.format(st.deltaMean)} cm on the day before)`}; deepest ${cm.format(st.max)} cm at ${cellName(st.maxCell)}${maxCol >= 7 && maxCol <= 13 ? ', in the drift band east of the ridge (columns H–N)' : ''}; shallowest ${cm.format(st.min)} cm at ${cellName(st.minCell)}${st.minCell % COLS < 7 ? ' on the wind-scoured western slope' : ''}.`;
  const legendStops = [0, 0.25, 0.5, 0.75, 1].map((t) => `${pal.color(t * MAX_CM)} ${t * 100}%`).join(', ');
  const mapLabel = `Snow depth by sensor on ${dayLabel(day)}. Columns A to X run west to east, rows 1 to 16 north to south. Arrow keys move between cells; Enter pins one.`;
  const heatmap = <Heatmap values={values} pal={pal} active={hovered} selected={selected} onActive={setHovered} onSelect={setSelected} label={mapLabel} />;

  return (
    <div className={s.root} data-reduced={reduced || undefined} style={ROOT_STYLE}>
      <div className={s.wrap}>
        <header className={s.head}>
          <p className={s.kicker}>Saddleback Plateau · fictional survey <span className={s.sim}>Simulated data</span></p>
          <h2 className={s.title}>Where the snow went</h2>
          <p className={s.lede}>
            384 depth sensors on a 24 × 16 grid at 25 m spacing, read once a day for 30 days. Height shows the drifts as a landform; the flat map
            and the table carry the same numbers for exact comparison.
          </p>
        </header>

        <section className={s.controls} aria-label="View and day">
          <fieldset className={s.seg}>
            <legend className={s.legendLabel}>View</legend>
            {(['3d', '2d'] as const).map((m) => (
              <label key={m}>
                <input type="radio" name={`${uid}-mode`} checked={mode === m} onChange={() => setMode(m)} />
                <span>{m === '3d' ? '3D bars' : '2D map'}</span>
              </label>
            ))}
          </fieldset>
          <div className={s.dayCtl}>
            <label htmlFor={`${uid}-day`} className={s.legendLabel}>Day</label>
            <div className={s.dayRow}>
              <button type="button" className={s.iconBtn} onClick={() => go(day - 1)} disabled={day === 0} aria-label="Previous day">‹</button>
              <button type="button" className={s.play} aria-pressed={playing} onClick={() => { if (playing) setPlaying(false); else { if (day >= DAYS - 1) setDay(0); setAnnounce(''); setPlaying(true); } }}>
                {playing ? 'Pause' : 'Play 30 days'}
              </button>
              <button type="button" className={s.iconBtn} onClick={() => go(day + 1)} disabled={day === DAYS - 1} aria-label="Next day">›</button>
              <input id={`${uid}-day`} type="range" min={0} max={DAYS - 1} step={1} value={day} className={s.range}
                aria-valuetext={`${dayLabel(day)}, day ${day + 1} of ${DAYS}`} onChange={(e) => go(Number(e.target.value))} />
              <output htmlFor={`${uid}-day`} className={s.dayOut}>{dayLabel(day)}</output>
            </div>
          </div>
          {mode === '3d' ? (
            <fieldset className={s.seg}>
              <legend className={s.legendLabel}>Camera</legend>
              {VIEWS.map((v) => (
                <label key={v.id}>
                  <input type="radio" name={`${uid}-cam`} checked={preset === v.id} onChange={() => setPreset(v.id)} />
                  <span>{v.label}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
        </section>

        <div className={s.main}>
          <section className={s.viewCol} aria-labelledby={`${uid}-view`}>
            <h3 id={`${uid}-view`} className={s.srOnly}>{mode === '3d' ? 'Snow depth, 3D bars' : 'Snow depth, 2D map'}</h3>
            <div className={s.stage} data-mode={mode}>
              {mode === '3d' ? (
                <StudioCanvas
                  label="Snow depth as 3D bars (simulated data)"
                  description={`${summary} Bar heights are exaggerated ${EXAGGERATION} times. The 2D map and the table hold the same values.`}
                  flat
                  camera={{ fov: 36, near: 0.1, far: 200, position: PRESETS.overview.position }}
                  style={{ position: 'absolute', inset: 0 }}
                  onPointerMissed={() => setSelected(null)}
                  fallback={<div className={s.fallbackBox}><p className={s.fallbackLead}>3D is not available here, so this is the flat map; it holds the same values.</p>{heatmap}</div>}
                >
                  <BarField values={values} pal={pal} hovered={hovered} selected={selected} onHover={setHovered} onSelect={setSelected} preset={preset} />
                </StudioCanvas>
              ) : heatmap}
              {mode === '3d' ? <p className={s.compass} aria-hidden="true"><span>W</span> wind from the west <span>→</span> E · north at the back</p> : null}
            </div>
            <p className={s.hint}>
              {mode === '3d'
                ? 'Drag to orbit, or focus the scene and use the arrow keys (+ / − zoom, 0 resets). Point at a bar to read it; click to pin it. Every value is also in the 2D map and the table.'
                : 'Arrow keys move between cells, Home / End jump along a row, Enter pins a cell. Values print in each cell where there is room.'}
            </p>
          </section>

          <aside className={s.side} aria-label="Reading, legend and method">
            <section className={s.card} aria-labelledby={`${uid}-read`}>
              <h3 id={`${uid}-read`} className={s.legendLabel}>{selected !== null ? 'Pinned sensor' : 'Sensor'}</h3>
              <div>
                {cell !== null ? (
                  <>
                    <p className={s.cellName}>{cellName(cell)} <span>column {colName(cell % COLS)} · row {Math.floor(cell / COLS) + 1}</span></p>
                    <p className={s.cellValue}>{Number.isFinite(cellValue) ? <>{cm.format(cellValue)}<span> cm</span></> : <span className={s.noReading}>No reading this day</span>}</p>
                    <dl className={s.facts}>
                      <div><dt>Day before</dt><dd>{Number.isFinite(prevValue) && Number.isFinite(cellValue) ? `${cmSigned.format(cellValue - prevValue)} cm` : '—'}</dd></div>
                      <div><dt>Rank</dt><dd>{rank !== null ? `${rank} of ${st.reporting}` : '—'}</dd></div>
                    </dl>
                    {selected !== null ? <button type="button" className={s.linkBtn} onClick={() => setSelected(null)}>Unpin</button> : null}
                  </>
                ) : <p className={s.hint}>Point at a bar or cell, or focus the map, to read a sensor.</p>}
              </div>
            </section>

            <section className={s.card} aria-labelledby={`${uid}-legend`}>
              <h3 id={`${uid}-legend`} className={s.legendLabel}>Depth, centimetres</h3>
              <div className={s.ramp} style={{ background: `linear-gradient(to right, ${legendStops})` }} aria-hidden="true" />
              <div className={s.rampTicks} aria-hidden="true">{[0, 100, 200, 300].map((t) => <span key={t} style={{ left: `${(t / MAX_CM) * 100}%` }}>{t}</span>)}</div>
              <p className={s.legendNote}><span className={s.hatch} aria-hidden="true" />No reading (sensor offline)</p>
              <p className={s.legendNote}>One hue: deeper snow is darker on light pages and lighter on dark ones. {mode === '3d' ? `Bar heights are exaggerated ×${EXAGGERATION}.` : ''}</p>
            </section>

            <section className={s.why} aria-labelledby={`${uid}-why`}>
              <h3 id={`${uid}-why`} className={s.whyTitle}>When is the flat map more accurate?</h3>
              <p>Whenever you compare. Perspective shrinks far bars, tall bars hide short ones behind them, and heights are exaggerated — so exact values and small differences read better in 2D, where every cell is the same size, nothing is hidden and the value is printed.</p>
              <p>Use 3D to see the shape: the scoured western slope, the drift band in the lee of the ridge, the hollow that fills first.</p>
            </section>
          </aside>
        </div>

        <section className={s.below} aria-labelledby={`${uid}-sum`}>
          <h3 id={`${uid}-sum`} className={s.legendLabel}>What this day shows</h3>
          <p className={s.summary}>{summary}</p>
          <div className={s.inlineRow}>
            <button type="button" className={s.btn} aria-expanded={showTable} aria-controls={`${uid}-tbl`} onClick={() => setShowTable((v) => !v)}>{showTable ? 'Hide table' : 'View as table'}</button>
            <span className={s.hint}>24 columns × 16 rows, centimetres, {dayLabel(day)}</span>
          </div>
          <div id={`${uid}-tbl`} hidden={!showTable} className={s.tableBox} role="region" aria-label="Snow depth table" tabIndex={showTable ? 0 : -1}>
            {showTable ? (
              <table className={s.table}>
                <caption className={s.caption}>Snow depth in centimetres by sensor, {dayLabel(day)}. “—” means no reading. Simulated data.</caption>
                <thead><tr><th scope="col">Row</th>{Array.from({ length: COLS }, (_, c) => <th key={c} scope="col">{colName(c)}</th>)}</tr></thead>
                <tbody>
                  {Array.from({ length: ROWS }, (_, r) => (
                    <tr key={r}><th scope="row">{r + 1}</th>{Array.from({ length: COLS }, (_, c) => { const v = values[r * COLS + c]; return <td key={c}>{Number.isFinite(v) ? cm.format(v) : '—'}</td>; })}</tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
          <p className={s.diag}>
            Renderer, last frame: {diag && mode === '3d' ? `${formatCount(diag.renderer.calls)} draw calls (one for all ${N} bars), ${formatCount(diag.renderer.triangles)} triangles, ${formatCount(diag.frames)} frames drawn on demand` : 'not running (2D map or table only)'}.
          </p>
        </section>

        <footer className={s.foot}>
          <p><strong>Data note.</strong> Simulated, seed {SEED}: storm totals with settling, a fixed wind-redistribution field (scoured west, drift band east of a ridge, a hollow and a gully), melt from day 25 that is faster on sunny southern rows, and noise; three sensors go offline for a while. Saddleback Plateau and every reading are invented. Dates in UTC.</p>
        </footer>
      </div>
      <p className={s.srOnly} role="status" aria-live="polite">{announce}</p>
    </div>
  );
}
