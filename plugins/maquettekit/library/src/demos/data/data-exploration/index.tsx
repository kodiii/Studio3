'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { scaleLinear } from 'd3';
import { spring as SPRING, springToLinear, useStudioMotion } from '../../../motion';
import { Breakdown, type Row } from './Breakdown';
import { RangeBrush } from './RangeBrush';
import { SCATTER_M, Scatter, type Mark } from './Scatter';
import {
  ALT, DEFAULT_STATE, PROCESSES, SCORE, SEED, VARIETIES, buildDataset, decodeState, encodeState, fmt, mean, pearson, summarise,
  type CompareDim, type Lot, type SortKey, type ViewState,
} from './data';
import s from './styles.module.css';

const DATA = buildDataset();
const LOT_IDS = new Set(DATA.lots.map((l) => l.id));
const REGIONS = [...DATA.nodes.values()].filter((n) => n.level === 'region');
const nodeName = (id: string) => DATA.nodes.get(id)?.name ?? id;
const PROC_LABEL = Object.fromEntries(PROCESSES.map((p) => [p.id, p.label])) as Record<string, string>;
const VAR_LABEL = Object.fromEntries(VARIETIES.map((v) => [v.id, v.label])) as Record<string, string>;
const DIM_OPTIONS: Record<CompareDim, readonly { id: string; label: string }[]> = {
  process: PROCESSES, variety: VARIETIES, region: REGIONS.map((r) => ({ id: r.id, label: r.name })),
};
const dimValue = (l: Lot, d: CompareDim) => (d === 'process' ? l.process : d === 'variety' ? l.variety : l.region);
const optLabel = (d: CompareDim, id: string) => DIM_OPTIONS[d].find((o) => o.id === id)?.label ?? id;
const BIN = 0.5;
const NBINS = Math.round((SCORE[1] - SCORE[0]) / BIN);
const binOf = (v: number) => Math.min(NBINS - 1, Math.max(0, Math.floor((v - SCORE[0]) / BIN)));
const describe = (l: Lot) => `${nodeName(l.farm)}, ${nodeName(l.region)}; ${fmt.int.format(l.altitude)} m; ${fmt.score(l.score)} points; ${PROC_LABEL[l.process]} ${VAR_LABEL[l.variety]}`;
const COLS: readonly { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'id', label: 'Lot' }, { key: 'farm', label: 'Farm' }, { key: 'altitude', label: 'Altitude (m)', num: true },
  { key: 'score', label: 'Score (pts)', num: true }, { key: 'yield', label: 'Yield (kg/ha)', num: true },
  { key: 'process', label: 'Process' }, { key: 'variety', label: 'Variety' },
];
const H_MARGIN = { left: 40, right: 10 };
/** Rows of the lots table shown per step; the table grows in the page instead of scrolling inside it. */
const PAGE = 25;
/** Token springs as CSS linear() curves: hover, press and release in the stylesheet run on real springs, no JS loop. */
const SPRINGS: CSSProperties = (() => {
  const out: Record<string, string> = {};
  for (const k of ['press', 'settle', 'release'] as const) {
    const sp = springToLinear(SPRING[k]);
    out[`--de-${k}`] = sp.easing;
    out[`--de-${k}-dur`] = `${sp.duration}ms`;
  }
  return out as CSSProperties;
})();

export default function DataExploration() {
  const uid = useId();
  const { reduced } = useStudioMotion();
  const [st, setSt] = useState<ViewState>(DEFAULT_STATE);
  // One entrance, once: marks sweep in by altitude and bars rise by bin, all inside 300 ms; never again after that.
  const [entering, setEntering] = useState(true);
  useEffect(() => { const id = window.setTimeout(() => setEntering(false), 600); return () => window.clearTimeout(id); }, []);
  const [limit, setLimit] = useState(PAGE);
  const tableRef = useRef<HTMLTableElement>(null);
  const revealFrom = useRef<number | null>(null);
  const crumbFocus = useRef(false);
  const hereRef = useRef<HTMLSpanElement>(null);
  const [showBins, setShowBins] = useState(false);
  const [announce, setAnnounce] = useState('');
  const hydrated = useRef(false);
  const update = useCallback((patch: Partial<ViewState>) => setSt((x) => ({ ...x, ...patch })), []);

  // URL-hash state: read on mount and on hashchange; written back with replaceState (no history spam).
  useEffect(() => {
    const read = () => setSt(decodeState(window.location.hash, DATA.nodes, LOT_IDS));
    read();
    hydrated.current = true;
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    const id = window.setTimeout(() => {
      const h = encodeState(st);
      if (window.location.hash.replace(/^#/, '') !== h) window.history.replaceState(window.history.state, '', h ? `#${h}` : window.location.pathname + window.location.search);
    }, 150);
    return () => window.clearTimeout(id);
  }, [st]);

  const level = st.path.length;
  const inPath = useCallback((l: Lot) => st.path.every((id, i) => (i === 0 ? l.region : i === 1 ? l.coop : l.farm) === id), [st.path]);
  const universe = useMemo(() => DATA.lots.filter((l) => st.proc.includes(l.process) && st.vari.includes(l.variety) && inPath(l)), [st.proc, st.vari, inPath]);
  const inSel = useCallback((l: Lot) => (!st.alt || (l.altitude >= st.alt[0] && l.altitude <= st.alt[1])) && (!st.score || (l.score >= st.score[0] && l.score <= st.score[1])), [st.alt, st.score]);
  const selected = useMemo(() => universe.filter(inSel), [universe, inSel]);
  const markOf = useCallback((l: Lot): Mark | null => {
    if (!st.cmp) return l.process;
    const v = dimValue(l, st.cmp.dim);
    return v === st.cmp.a ? 'a' : v === st.cmp.b ? 'b' : null;
  }, [st.cmp]);
  const groupA = useMemo(() => (st.cmp ? selected.filter((l) => markOf(l) === 'a') : []), [selected, markOf, st.cmp]);
  const groupB = useMemo(() => (st.cmp ? selected.filter((l) => markOf(l) === 'b') : []), [selected, markOf, st.cmp]);
  const sum = useMemo(() => summarise(selected), [selected]);
  const trend = useMemo(() => {
    if (selected.length < 5) return null;
    const xs = selected.map((l) => l.altitude), ys = selected.map((l) => l.score);
    const mx = mean(xs), my = mean(ys);
    let sxy = 0, sxx = 0;
    for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    if (!sxx) return null;
    const slope = sxy / sxx;
    return { slope, intercept: my - slope * mx, r: pearson(xs, ys), x0: Math.min(...xs), x1: Math.max(...xs) };
  }, [selected]);

  // Facet counts ignore their own facet, so an unchecked option still shows what it would add.
  const procCount = (p: string) => DATA.lots.filter((l) => l.process === p && st.vari.includes(l.variety) && inPath(l)).length;
  const varCount = (v: string) => DATA.lots.filter((l) => l.variety === v && st.proc.includes(l.process) && inPath(l)).length;
  const toggle = (key: 'proc' | 'vari', id: string) => setSt((x) => {
    const cur = x[key] as string[];
    const next = cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id];
    return next.length ? { ...x, [key]: next } : x;
  });

  // Drill-down rows: the children of the current node, or the lots of a farm at the leaf.
  const leaf = level === 3;
  const rows: Row[] = useMemo(() => {
    if (leaf) {
      return selected.map((l) => ({
        id: l.id, name: `${l.id} · ${PROC_LABEL[l.process]}`, n: 1, mean: l.score, p10: l.score, p90: l.score,
        a: markOf(l) === 'a' ? l.score : NaN, b: markOf(l) === 'b' ? l.score : NaN, drill: false, pinned: st.pin === l.id,
      }));
    }
    const parent = level ? st.path[level - 1] : null;
    const field = level === 0 ? 'region' : level === 1 ? 'coop' : 'farm';
    return [...DATA.nodes.values()].filter((n) => n.parent === parent && n.level === field).map((n) => {
      const ls = selected.filter((l) => l[field] === n.id);
      const sm = summarise(ls);
      const ga = ls.filter((l) => markOf(l) === 'a'), gb = ls.filter((l) => markOf(l) === 'b');
      return { id: n.id, name: n.name, n: sm.n, mean: sm.mean, p10: sm.p10, p90: sm.p90, a: ga.length >= 2 ? mean(ga.map((l) => l.score)) : NaN, b: gb.length >= 2 ? mean(gb.map((l) => l.score)) : NaN, drill: true };
    });
  }, [selected, level, leaf, st.path, st.pin, markOf]);
  const childNoun = level === 0 ? 'region' : level === 1 ? 'cooperative' : level === 2 ? 'farm' : 'lot';

  const bins = useMemo(() => {
    const b = Array.from({ length: NBINS }, (_, i) => ({ lo: SCORE[0] + i * BIN, all: 0, sel: 0, a: 0, b: 0 }));
    for (const l of universe) b[binOf(l.score)].all++;
    for (const l of selected) b[binOf(l.score)].sel++;
    for (const l of groupA) b[binOf(l.score)].a++;
    for (const l of groupB) b[binOf(l.score)].b++;
    return b;
  }, [universe, selected, groupA, groupB]);
  const altBins = useMemo(() => {
    const b = Array.from({ length: 14 }, (_, i) => ({ lo: ALT[0] + i * 100, n: 0 }));
    for (const l of universe) b[Math.min(13, Math.floor((l.altitude - ALT[0]) / 100))].n++;
    return b;
  }, [universe]);

  const sorted = useMemo(() => {
    const k = st.sort.key;
    const val = (l: Lot): string | number => (k === 'farm' ? nodeName(l.farm) : l[k]);
    return [...selected].sort((p, q) => {
      const a = val(p), b = val(q);
      return (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))) * st.sort.dir || p.id.localeCompare(q.id);
    });
  }, [selected, st.sort]);
  const sortBy = (key: SortKey) => update({ sort: st.sort.key === key ? { key, dir: st.sort.dir === 1 ? -1 : 1 } : { key, dir: key === 'score' || key === 'altitude' || key === 'yield' ? -1 : 1 } });

  const pinned = st.pin ? DATA.lots.find((l) => l.id === st.pin) ?? null : null;
  const filtersText = [
    st.proc.length < PROCESSES.length ? st.proc.map((p) => PROC_LABEL[p]).join(' + ') : null,
    st.vari.length < VARIETIES.length ? st.vari.map((v) => VAR_LABEL[v]).join(' + ') : null,
    st.alt ? `${fmt.int.format(st.alt[0])}–${fmt.int.format(st.alt[1])} m` : null,
    st.score ? `${fmt.score(st.score[0])}–${fmt.score(st.score[1])} pts` : null,
  ].filter(Boolean).join(' · ');
  const where = level ? st.path.map(nodeName).join(' › ') : 'all four regions';
  const headline = `${selected.length} of ${universe.length} lots in ${where}${filtersText ? ` (${filtersText})` : ''}.`;
  const sA = summarise(groupA), sB = summarise(groupB);
  const summary = selected.length === 0
    ? `${headline} Nothing matches — widen a range or tick another option.`
    : st.cmp
      ? `${headline} ${optLabel(st.cmp.dim, st.cmp.a)}: ${sA.n} lots, mean ${fmt.mean(sA.mean)}. ${optLabel(st.cmp.dim, st.cmp.b)}: ${sB.n} lots, mean ${fmt.mean(sB.mean)}.${sA.n && sB.n ? ` Difference ${fmt.signed1.format(sA.mean - sB.mean)} points.` : ''}`
      : `${headline} Mean cup score ${fmt.mean(sum.mean)} (10th–90th percentile ${fmt.mean(sum.p10)}–${fmt.mean(sum.p90)}); ${fmt.pct.format(sum.share86)} score 86 or more.${trend && Number.isFinite(trend.r) ? ` Altitude and score are ${Math.abs(trend.r) >= 0.5 ? 'strongly' : Math.abs(trend.r) >= 0.3 ? 'moderately' : 'weakly'} associated here (r = ${fmt.r.format(trend.r)}) — an association in sample data, not a cause.` : ''}`;

  useEffect(() => {
    if (!hydrated.current) return;
    const id = window.setTimeout(() => setAnnounce(headline), 900);
    return () => window.clearTimeout(id);
  }, [headline]);

  // "Show more" moves focus to the first newly shown row; a breadcrumb jump moves it to the new current level.
  useEffect(() => {
    const i = revealFrom.current;
    revealFrom.current = null;
    if (i === null) return;
    tableRef.current?.querySelectorAll('tbody tr')[i]?.querySelector('button')?.focus();
  }, [limit]);
  useEffect(() => {
    if (!crumbFocus.current) return;
    crumbFocus.current = false;
    hereRef.current?.focus();
  }, [st.path]);
  const pinIndex = st.pin ? sorted.findIndex((l) => l.id === st.pin) : -1;
  const shownLots = sorted.slice(0, limit);

  const setCompare = (dim: CompareDim | 'off') => update({ cmp: dim === 'off' ? null : { dim, a: DIM_OPTIONS[dim][0].id, b: DIM_OPTIONS[dim][1].id } });
  const maxBin = Math.max(st.cmp ? 0.05 : 1, ...bins.map((b) => (st.cmp ? Math.max(b.a / Math.max(1, groupA.length), b.b / Math.max(1, groupB.length)) : b.all)));

  return (
    <div className={s.root} data-compare={st.cmp ? '' : undefined} data-reduced={reduced || undefined} style={SPRINGS}>
      <div className={s.wrap}>
        <header className={s.head}>
          <p className={s.kicker}>Four Valleys Cupping Table · fictional quality programme <span className={s.sample}>Sample data</span></p>
          <h2 className={s.title}>Which lots cup best, <em>and what do they share?</em></h2>
          <p className={s.lede}>{DATA.lots.length} sample lots from four invented growing regions, scored on a 100-point cupping form. Filter, brush and drill down — every view, the table and the address bar stay in step, so a view can be shared by copying the link.</p>
        </header>

        <section className={s.toolbar} aria-label="Filters and comparison">
          <fieldset className={s.facet}>
            <legend>Process</legend>
            {PROCESSES.map((p) => (
              <label key={p.id} className={s.chip}>
                <input type="checkbox" checked={st.proc.includes(p.id)} onChange={() => toggle('proc', p.id)} disabled={st.proc.length === 1 && st.proc.includes(p.id)} />
                <span><span className={s.swatch} data-mark={p.id} aria-hidden="true" />{p.label}<span className={s.chipN}>{procCount(p.id)}</span></span>
              </label>
            ))}
          </fieldset>
          <fieldset className={s.facet}>
            <legend>Variety</legend>
            {VARIETIES.map((v) => (
              <label key={v.id} className={s.chip}>
                <input type="checkbox" checked={st.vari.includes(v.id)} onChange={() => toggle('vari', v.id)} disabled={st.vari.length === 1 && st.vari.includes(v.id)} />
                <span>{v.label}<span className={s.chipN}>{varCount(v.id)}</span></span>
              </label>
            ))}
          </fieldset>
          <div className={s.compare}>
            <label className={s.selectLabel}>
              <span>Compare</span>
              <select value={st.cmp?.dim ?? 'off'} onChange={(e) => setCompare(e.target.value as CompareDim | 'off')}>
                <option value="off">Off</option><option value="process">Process</option><option value="variety">Variety</option><option value="region">Region</option>
              </select>
            </label>
            {st.cmp ? (
              <>
                {(['a', 'b'] as const).map((g) => (
                  <label key={g} className={s.selectLabel}>
                    <span><span className={s.groupKey} data-g={g} aria-hidden="true" />{g === 'a' ? 'A' : 'B'}</span>
                    <select value={st.cmp![g]} onChange={(e) => update({ cmp: { ...st.cmp!, [g]: e.target.value } })}>
                      {DIM_OPTIONS[st.cmp!.dim].map((o) => <option key={o.id} value={o.id} disabled={o.id === st.cmp![g === 'a' ? 'b' : 'a']}>{o.label}</option>)}
                    </select>
                  </label>
                ))}
              </>
            ) : null}
          </div>
          <button type="button" className={s.btn} onClick={() => setSt(DEFAULT_STATE)}>Reset view</button>
        </section>

        <nav aria-label="Drill-down" className={s.crumbs}>
          <ol>
            {[{ id: 'root', name: 'All regions' }, ...st.path.map((id) => ({ id, name: nodeName(id) }))].map((c, i, arr) => (
              <li key={c.id}>
                {i < arr.length - 1
                  ? <button type="button" className={s.crumbBtn} onClick={() => { crumbFocus.current = true; update({ path: st.path.slice(0, i) }); }}>{c.name}</button>
                  : <span aria-current="location" className={s.crumbHere} tabIndex={-1} ref={hereRef}>{c.name}</span>}
              </li>
            ))}
          </ol>
        </nav>

        <div className={s.views}>
          <section className={s.panel} aria-labelledby={`${uid}-sc`}>
            <h3 id={`${uid}-sc`} className={s.panelTitle}>Altitude against cup score</h3>
            <p className={s.sub}>Each mark is a lot. Drag across the plot to brush both ranges; click a mark to pin it. Score axis starts at 80. <span className={s.sample}>Sample data</span></p>
            <ul className={s.legend} aria-label="Legend">
              {st.cmp ? (<>
                <li><span className={s.lgA} aria-hidden="true" />A: {optLabel(st.cmp.dim, st.cmp.a)} ({groupA.length})</li>
                <li><span className={s.lgB} aria-hidden="true" />B: {optLabel(st.cmp.dim, st.cmp.b)} ({groupB.length})</li>
                <li><span className={s.lgCtx} aria-hidden="true" />Other lots</li>
              </>) : (<>
                {PROCESSES.map((p) => <li key={p.id}><svg viewBox="-6 -6 12 12" className={s.lgShape} data-mark={p.id} aria-hidden="true">{p.id === 'washed' ? <circle r={4} /> : p.id === 'natural' ? <rect x={-3.5} y={-3.5} width={7} height={7} /> : <path d="M0 -4.6L4.2 3L-4.2 3Z" />}</svg>{p.label}</li>)}
                <li><span className={s.lgCtx} aria-hidden="true" />Outside the brush</li>
                <li><span className={s.lgTrend} aria-hidden="true" />Least-squares line</li>
              </>)}
            </ul>
            <Scatter lots={universe} inSel={inSel} markOf={markOf} alt={st.alt} score={st.score} pinned={st.pin} entering={entering}
              onBrush={(alt, score) => update({ alt, score })} onPin={(pin) => update({ pin })} describe={describe} trend={st.cmp ? null : trend} />
            <p className={s.axisTitle}><span>Altitude, metres</span><span>Cup score, points (vertical)</span></p>
            <p className={s.stripLabel} id={`${uid}-alt`}>Altitude range — drag, or use the handles with arrow keys (Shift for 100 m)</p>
            <RangeBrush domain={ALT} step={10} big={100} value={st.alt} onChange={(alt) => update({ alt })} label="altitude" describedBy={`${uid}-alt`}
              format={(v) => `${fmt.int.format(v)} m`} margin={{ left: SCATTER_M.left, right: SCATTER_M.right }} height={44}>
              {(x, _w, h) => {
                const m = Math.max(1, ...altBins.map((b) => b.n));
                return <svg width="100%" height={h} className={s.stripSvg} aria-hidden="true"><g className={s.bars} data-enter={entering || undefined}>{altBins.map((b, i) => <rect key={b.lo} x={x(b.lo) + 1} width={Math.max(0, x(b.lo + 100) - x(b.lo) - 2)} y={h - 4 - (b.n / m) * (h - 10)} height={(b.n / m) * (h - 10)} className={s.altBar} style={{ ['--i' as string]: Math.round((i * 10) / 13) }} />)}</g></svg>;
              }}
            </RangeBrush>
          </section>

          <div className={s.sideViews}>
            <section className={s.panel} aria-labelledby={`${uid}-hist`}>
              <h3 id={`${uid}-hist`} className={s.panelTitle}>Score distribution</h3>
              <p className={s.sub}>{st.cmp ? 'Share of each group’s lots per 0.5-point bin, so groups of different size compare fairly.' : 'Lots per 0.5-point bin; the outline is everything in view, the fill is what the brushes select.'} Drag across to brush a score range.</p>
              <RangeBrush domain={SCORE} step={0.25} big={1} value={st.score} onChange={(score) => update({ score })} label="score"
                format={(v) => `${fmt.score(v)} points`} margin={H_MARGIN} height={196} inset={22}>
                {(x, w, h) => {
                  const top = 10, bottom = h - 24;
                  const yMax = scaleLinear().domain([0, maxBin]).nice(3).domain()[1];
                  const yv = (v: number) => bottom - (v / yMax) * (bottom - top);
                  const ticks = scaleLinear().domain([0, yMax]).ticks(3);
                  let step = '';
                  if (st.cmp) bins.forEach((b, i) => { const v = b.b / Math.max(1, groupB.length); step += `${i ? 'L' : 'M'}${x(b.lo).toFixed(1)} ${yv(v).toFixed(1)}H${x(b.lo + BIN).toFixed(1)}`; });
                  return (
                    <svg width={w} height={h} className={s.histSvg} aria-hidden="true">
                      {ticks.map((t) => (
                        <g key={t} transform={`translate(0 ${yv(t)})`}>
                          <line x1={H_MARGIN.left} x2={w - H_MARGIN.right} className={t === 0 ? s.base : s.grid} />
                          <text x={H_MARGIN.left - 6} y={4} textAnchor="end" className={s.tick}>{st.cmp ? fmt.pct.format(t) : t}</text>
                        </g>
                      ))}
                      {[80, 82, 84, 86, 88, 90].map((t) => <text key={t} x={x(t)} y={h - 6} textAnchor={t === 80 ? 'start' : t === 90 ? 'end' : 'middle'} className={s.tick}>{t}</text>)}
                      {st.cmp ? (
                        <>
                          {bins.map((b) => <rect key={b.lo} x={x(b.lo) + 1.5} width={Math.max(0, x(b.lo + BIN) - x(b.lo) - 3)} y={yv(b.a / Math.max(1, groupA.length))} height={bottom - yv(b.a / Math.max(1, groupA.length))} className={s.barA} />)}
                          <path d={step} className={s.stepB} />
                        </>
                      ) : <g className={s.bars} data-enter={entering || undefined}>{bins.map((b, i) => (
                        <g key={b.lo} style={{ ['--i' as string]: Math.round((i * 10) / (NBINS - 1)) }}>
                          <rect x={x(b.lo) + 1} width={Math.max(0, x(b.lo + BIN) - x(b.lo) - 2)} y={yv(b.all)} height={bottom - yv(b.all)} className={s.barAll} />
                          <rect x={x(b.lo) + 1} width={Math.max(0, x(b.lo + BIN) - x(b.lo) - 2)} y={yv(b.sel)} height={bottom - yv(b.sel)} className={s.barSel} />
                        </g>
                      ))}</g>}
                    </svg>
                  );
                }}
              </RangeBrush>
              <div className={s.inlineRow}>
                <button type="button" className={s.linkBtn} aria-expanded={showBins} aria-controls={`${uid}-bins`} onClick={() => setShowBins((v) => !v)}>{showBins ? 'Hide bin table' : 'View bins as table'}</button>
                <span className={s.hint}>Score brush: {st.score ? `${fmt.score(st.score[0])}–${fmt.score(st.score[1])}` : 'off'}</span>
              </div>
              <div id={`${uid}-bins`} hidden={!showBins} className={s.tableBox} role="region" aria-label="Score bins, table" tabIndex={showBins ? 0 : -1}>
                {showBins ? (
                  <table className={s.table}>
                    <caption className={s.caption}>Lots per 0.5-point score bin. Sample data.</caption>
                    <thead><tr><th scope="col">Score bin</th><th scope="col" className={s.num}>In view</th><th scope="col" className={s.num}>Selected</th>{st.cmp ? <><th scope="col" className={s.num}>A</th><th scope="col" className={s.num}>B</th></> : null}</tr></thead>
                    <tbody>{bins.map((b) => <tr key={b.lo}><th scope="row">{fmt.score(b.lo)}–{fmt.score(b.lo + BIN)}</th><td className={s.num}>{b.all}</td><td className={s.num}>{b.sel}</td>{st.cmp ? <><td className={s.num}>{b.a}</td><td className={s.num}>{b.b}</td></> : null}</tr>)}</tbody>
                  </table>
                ) : null}
              </div>
            </section>

            <section className={s.panel} aria-labelledby={`${uid}-bd`}>
              <h3 id={`${uid}-bd`} className={s.panelTitle}>{leaf ? `Lots at ${nodeName(st.path[2])}` : `By ${childNoun}`}</h3>
              <p className={s.sub}>{st.cmp ? 'A vs B mean score per group (filled dot A, hollow square B), sorted by the difference.' : leaf ? 'Each selected lot’s score; choose one to pin it.' : 'Mean score (dot) and 10th–90th percentile (line) of the selected lots, best first. Choose a row to drill down.'}</p>
              <Breakdown rows={rows} levelKey={st.path.join('/')} compare={!!st.cmp} noun="lot" onSelect={(r) => (r.drill ? update({ path: [...st.path, r.id] }) : update({ pin: st.pin === r.id ? null : r.id }))} />
              {rows.length === 0 ? <p className={s.empty}>No lots here match the filters.</p> : null}
            </section>
          </div>
        </div>

        <div className={s.readout}>
          <section className={s.summaryBlock} aria-labelledby={`${uid}-sum`}>
            <h3 id={`${uid}-sum`} className={s.label}>What the selection shows</h3>
            <p className={s.summary}>{summary}</p>
            {st.cmp ? (
              <table className={s.cmpTable}>
                <caption className={s.srOnly}>Comparison of group A and group B, sample data</caption>
                <thead><tr><th scope="col">Measure</th><th scope="col" className={s.num}>A · {optLabel(st.cmp.dim, st.cmp.a)}</th><th scope="col" className={s.num}>B · {optLabel(st.cmp.dim, st.cmp.b)}</th><th scope="col" className={s.num}>A − B</th></tr></thead>
                <tbody>
                  {([['Lots', sA.n, sB.n, 'n'], ['Mean score', sA.mean, sB.mean, 's'], ['Median score', sA.median, sB.median, 's'], ['90th percentile', sA.p90, sB.p90, 's'], ['Share at 86+', sA.share86, sB.share86, 'p']] as const).map(([k, a, b, t]) => (
                    <tr key={k}>
                      <th scope="row">{k}</th>
                      <td className={s.num}>{t === 'n' ? a : t === 'p' ? (Number.isFinite(a) ? fmt.pct.format(a) : '—') : fmt.mean(a)}</td>
                      <td className={s.num}>{t === 'n' ? b : t === 'p' ? (Number.isFinite(b) ? fmt.pct.format(b) : '—') : fmt.mean(b)}</td>
                      <td className={s.num}>{!Number.isFinite(a) || !Number.isFinite(b) ? '—' : t === 'n' ? fmt.signed1.format(a - b).replace(/\.0$/, '') : t === 'p' ? `${fmt.signed1.format((a - b) * 100)} pp` : fmt.signed1.format(a - b)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
          <section className={s.pinBlock} aria-labelledby={`${uid}-pin`}>
            <h3 id={`${uid}-pin`} className={s.label}>Pinned lot</h3>
            {pinned ? (
              <>
                <p className={s.pinId}>{pinned.id}</p>
                <dl className={s.pinFacts}>
                  {[['Farm', nodeName(pinned.farm)], ['Cooperative', nodeName(pinned.coop)], ['Region', nodeName(pinned.region)], ['Altitude', `${fmt.int.format(pinned.altitude)} m`], ['Cup score', `${fmt.score(pinned.score)} pts`], ['Process', PROC_LABEL[pinned.process]], ['Variety', VAR_LABEL[pinned.variety]], ['Yield', `${fmt.int.format(pinned.yield)} kg/ha`], ['Harvest', String(pinned.harvest)]].map(([k, v]) => (
                    <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
                <div className={s.inlineRow}>
                  <button type="button" className={s.btn} onClick={() => update({ path: [pinned.region, pinned.coop, pinned.farm] })}>Drill to its farm</button>
                  <button type="button" className={s.linkBtn} onClick={() => update({ pin: null })}>Unpin</button>
                </div>
              </>
            ) : <p className={s.hint}>Nothing pinned. Click a mark, press Enter on the focused plot, or choose a row in the table.</p>}
          </section>
        </div>

        <section className={s.lots} aria-labelledby={`${uid}-tbl`}>
          <div className={s.lotsHead}>
            <h3 id={`${uid}-tbl`} className={s.panelTitle}>Selected lots</h3>
            <p className={s.sub}>{selected.length} lots · same selection as the charts · sortable · <span className={s.sample}>Sample data</span></p>
          </div>
          <div className={`${s.tableBox} ${s.lotBox}`} role="region" aria-labelledby={`${uid}-tbl`} tabIndex={0}>
            <table ref={tableRef} className={`${s.table} ${s.lotTable}`}>
              <caption className={s.srOnly}>Selected sample lots; the pin button in each row pins that lot in every view.</caption>
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th key={c.key} scope="col" className={c.num ? s.num : undefined} aria-sort={st.sort.key === c.key ? (st.sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className={s.sortBtn} onClick={() => sortBy(c.key)}>{c.label}<span aria-hidden="true">{st.sort.key === c.key ? (st.sort.dir === 1 ? ' ↑' : ' ↓') : ' ↕'}</span></button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownLots.length ? shownLots.map((l) => (
                  <tr key={l.id} data-pinned={l.id === st.pin || undefined}>
                    <th scope="row"><button type="button" className={s.pinBtn} aria-pressed={l.id === st.pin} onClick={() => update({ pin: st.pin === l.id ? null : l.id })}>{l.id}</button></th>
                    <td>{nodeName(l.farm)} <span className={s.muted}>· {nodeName(l.region)}</span></td>
                    <td className={s.num}>{fmt.int.format(l.altitude)}</td>
                    <td className={s.num}>{fmt.score(l.score)}</td>
                    <td className={s.num}>{fmt.int.format(l.yield)}</td>
                    <td><span className={s.swatch} data-mark={l.process} aria-hidden="true" />{PROC_LABEL[l.process]}</td>
                    <td>{VAR_LABEL[l.variety]}</td>
                  </tr>
                )) : <tr><td colSpan={COLS.length} className={s.empty}>No lots match. Reset the view or widen a brush.</td></tr>}
              </tbody>
            </table>
          </div>
          {sorted.length ? (
            <div className={s.moreRow}>
              <p className={s.hint}>Showing {Math.min(limit, sorted.length)} of {sorted.length} lots</p>
              {sorted.length > limit ? (
                <>
                  <button type="button" className={s.btn} onClick={() => { revealFrom.current = limit; setLimit(limit + PAGE); }}>Show {Math.min(PAGE, sorted.length - limit)} more</button>
                  <button type="button" className={s.linkBtn} onClick={() => { revealFrom.current = limit; setLimit(sorted.length); }}>Show all {sorted.length}</button>
                </>
              ) : sorted.length > PAGE ? <button type="button" className={s.linkBtn} onClick={() => setLimit(PAGE)}>Show the first {PAGE} only</button> : null}
              {pinIndex >= limit ? (
                <span className={s.hint}>Pinned lot {st.pin} is row {pinIndex + 1} in this order. <button type="button" className={s.linkBtn} onClick={() => { revealFrom.current = pinIndex; setLimit(Math.ceil((pinIndex + 1) / PAGE) * PAGE); }}>Show it</button></span>
              ) : null}
            </div>
          ) : null}
        </section>

        <footer className={s.foot}>
          <p><strong>Data note.</strong> Sample data, seed {SEED}: {DATA.lots.length} lots in four invented regions, generated with an altitude trend (+0.29 points per 100 m), process and variety effects, a per-farm effect and noise, rounded to quarter points. Regions, cooperatives, farms and scores are fictional. Correlations here describe the generator, not coffee.</p>
        </footer>
      </div>
      <p className={s.srOnly} role="status" aria-live="polite">{announce}</p>
    </div>
  );
}
