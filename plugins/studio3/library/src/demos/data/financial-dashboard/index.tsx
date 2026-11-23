'use client';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { PerformanceChart, type ChartSeries, type Transition } from './PerformanceChart';
import { RangeBrush } from './RangeBrush';
import { Ticker } from './Ticker';
import {
  BAND, PRESETS, SEED, SLEEVES, UNITS, contributions, fmt, presetWindow, simulateFund, sleeveName, windowStats,
  type Position, type PresetId, type Severity, type SleeveId,
} from './data';
import s from './styles.module.css';

const DATA = simulateFund();
const LAST = DATA.dates.length - 1;
const MIN_SPAN = 5;
const AXIS_MAX = 0.6;
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

type SortKey = 'name' | 'sleeve' | 'units' | 'price' | 'value' | 'weight' | 'day' | 'pnl';
const COLS: readonly { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'name', label: 'Instrument' }, { key: 'sleeve', label: 'Sleeve' },
  { key: 'units', label: 'Units', num: true }, { key: 'price', label: 'Price (£)', num: true },
  { key: 'value', label: 'Value (£ k)', num: true }, { key: 'weight', label: 'Weight', num: true },
  { key: 'day', label: 'Day', num: true }, { key: 'pnl', label: 'Unrealised (£ k)', num: true },
];
const sortVal = (p: Position, k: SortKey): number | string =>
  k === 'name' ? p.name : k === 'sleeve' ? SLEEVES.findIndex((x) => x.id === p.sleeve) : k === 'units' ? p.units : k === 'price' ? p.price
    : k === 'value' ? p.value : k === 'weight' ? p.weight : k === 'day' ? p.dayPct : p.pnl;
const SEV_LABEL: Record<Severity, string> = { critical: 'Critical', major: 'Major', minor: 'Minor', resolved: 'Resolved' };

function Delta({ v, children }: { v: number; children: ReactNode }) {
  const dir = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
  return (
    <span className={s.delta} data-dir={dir}>
      <span aria-hidden="true" className={s.arrow}>{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■'}</span>{children}
    </span>
  );
}

function SevIcon({ sev }: { sev: Severity }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={s.sevIcon} data-sev={sev}>
      {sev === 'critical' ? <path d="M5.2 1.5h5.6l3.7 3.7v5.6l-3.7 3.7H5.2l-3.7-3.7V5.2z" />
        : sev === 'major' ? <path d="M8 1.6 15.2 14.4H.8z" />
        : sev === 'minor' ? <circle cx="8" cy="8" r="5.8" />
        : <path d="M2.8 8.6 6.4 12 13.4 4.4" />}
    </svg>
  );
}

export default function FinancialDashboard() {
  const uid = useId();
  const [win, setWin] = useState<[number, number]>(() => presetWindow(DATA.dates, '1Y'));
  const [preset, setPreset] = useState<PresetId | 'custom'>('1Y');
  const [transition, setTransition] = useState<Transition>('cut');
  const [gains, setGains] = useState<'green' | 'red'>('green');
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<SleeveId | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'weight', dir: -1 });
  const [focusRow, setFocusRow] = useState(0);
  const [acked, setAcked] = useState<Record<string, number>>({});
  const [showTable, setShowTable] = useState(false);
  const [announce, setAnnounce] = useState('');
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [a, b] = win;

  const st = useMemo(() => windowStats(DATA, a, b), [a, b]);
  const attribution = useMemo(() => contributions(DATA, a, b), [a, b]);
  const position = DATA.positions.find((p) => p.code === selected) ?? null;
  const series = useMemo<ChartSeries[]>(() => [
    { key: 'fund', label: 'Fund', values: DATA.nav, role: 'fund' },
    { key: 'comp', label: '60/40 composite', values: DATA.composite, role: 'comp' },
    ...(position ? [{ key: position.code, label: position.name, values: position.history, role: 'pos' as const }] : []),
  ], [position]);

  const rangeText = `${fmt.date.format(DATA.dates[a])} – ${fmt.date.format(DATA.dates[b])}`;
  const summary = `From the close on ${fmt.date.format(DATA.dates[a])} to ${fmt.date.format(DATA.dates[b])} (${st.days} trading days) the fund returned ${fmt.pctSigned2.format(st.fundRet)} against ${fmt.pctSigned2.format(st.compRet)} for the 60/40 composite, ${fmt.pp(st.excessPp)}. Annualised volatility ${fmt.pct1.format(st.vol)} (composite ${fmt.pct1.format(st.compVol)}); largest drawdown ${fmt.pct1.format(st.mdd)}${st.mdd < 0 ? `, trough on ${fmt.date.format(DATA.dates[st.troughIdx])}` : ''}.`;

  const commit = () => setAnnounce(`Range ${rangeText}. ${summary}`);
  const pendingCommit = useRef(false);
  useEffect(() => { if (pendingCommit.current) { pendingCommit.current = false; commit(); } });

  const choosePreset = (id: PresetId) => {
    setTransition('morph');
    setPreset(id);
    setWin(presetWindow(DATA.dates, id));
    pendingCommit.current = true;
  };
  const brush = (w: [number, number], via: 'drag' | 'key') => {
    setTransition(via);
    setWin(w);
    const match = PRESETS.find((p) => { const pw = presetWindow(DATA.dates, p.id); return pw[0] === w[0] && pw[1] === w[1]; });
    setPreset(match ? match.id : 'custom');
  };

  // KPIs: each a value, its comparison and its period.
  const nav = DATA.nav[b];
  const day = nav / DATA.nav[b - 1] - 1;
  const roll = transition !== 'drag';
  const kpis: { id: string; label: string; value: number; text: string; note: ReactNode }[] = [
    { id: 'nav', label: 'NAV per unit', value: nav, text: fmt.gbp.format(nav), note: <><Delta v={day}>{fmt.pctSigned2.format(day)}</Delta> on {fmt.dateShort.format(DATA.dates[b])}</> },
    { id: 'ret', label: 'Fund return', value: st.fundRet * 100, text: fmt.pctSigned2.format(st.fundRet), note: <>Composite {fmt.pctSigned2.format(st.compRet)}</> },
    { id: 'exc', label: 'Versus composite', value: st.excessPp, text: fmt.pp(st.excessPp), note: <Delta v={st.excessPp}>{st.excessPp >= 0 ? 'ahead of' : 'behind'} the 60/40</Delta> },
    { id: 'vol', label: 'Volatility', value: st.vol * 100, text: fmt.pct1.format(st.vol), note: <>Annualised · composite {fmt.pct1.format(st.compVol)}</> },
    { id: 'mdd', label: 'Max drawdown', value: st.mdd * 100, text: fmt.pct1.format(st.mdd), note: <>{st.mdd < 0 ? `Trough ${fmt.dateShort.format(DATA.dates[st.troughIdx])}` : 'No drawdown in range'}</> },
    { id: 'aum', label: 'Fund size', value: (UNITS * nav) / 1e6, text: fmt.gbpCompact.format(UNITS * nav), note: <>{fmt.int.format(UNITS)} units</> },
  ];

  // Chart table: daily, weekly or month-end closes depending on the range length.
  const tableRows = useMemo(() => {
    const span = b - a;
    const pick: number[] = [a];
    const d = DATA.dates;
    if (span <= 66) for (let i = a + 1; i <= b; i++) pick.push(i);
    else if (span <= 270) { for (let i = a + 1; i < b; i++) if (new Date(d[i]).getUTCDay() === 5) pick.push(i); pick.push(b); }
    else { for (let i = a + 1; i < b; i++) if (new Date(d[i + 1]).getUTCMonth() !== new Date(d[i]).getUTCMonth()) pick.push(i); pick.push(b); }
    return { pick, res: span <= 66 ? 'daily closes' : span <= 270 ? 'Friday closes' : 'month-end closes' };
  }, [a, b]);

  const rows = useMemo(() => {
    const list = DATA.positions.filter((p) => !filter || p.sleeve === filter);
    return [...list].sort((p, q) => {
      const va = sortVal(p, sort.key), vb = sortVal(q, sort.key);
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return c * sort.dir || p.name.localeCompare(q.name);
    });
  }, [filter, sort]);
  useEffect(() => { setFocusRow((f) => Math.min(f, Math.max(0, rows.length - 1))); }, [rows.length]);
  const sortBy = (key: SortKey) => setSort((x) => (x.key === key ? { key, dir: x.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' || key === 'sleeve' ? 1 : -1 }));
  const rowKey = (i: number) => (ev: KeyboardEvent<HTMLButtonElement>) => {
    const next = ev.key === 'ArrowDown' ? i + 1 : ev.key === 'ArrowUp' ? i - 1 : ev.key === 'Home' ? 0 : ev.key === 'End' ? rows.length - 1 : null;
    if (ev.key === 'Escape' && selected) { ev.preventDefault(); setSelected(null); return; }
    if (next === null) return;
    ev.preventDefault();
    const k = Math.min(rows.length - 1, Math.max(0, next));
    setFocusRow(k);
    rowRefs.current[k]?.focus();
  };
  const totals = rows.reduce((t, p) => ({ value: t.value + p.value, weight: t.weight + p.weight, pnl: t.pnl + p.pnl }), { value: 0, weight: 0, pnl: 0 });

  const active = DATA.alerts.filter((x) => x.severity !== 'resolved');
  const resolved = DATA.alerts.filter((x) => x.severity === 'resolved');
  const lastReb = DATA.rebalances[DATA.rebalances.length - 1];
  const attrMax = Math.max(1, ...attribution.rows.map((r) => Math.abs(r.pp)), Math.abs(attribution.fees), Math.abs(attribution.other));

  return (
    <div className={s.root} data-gains={gains}>
      <header className={s.bar}>
        <div className={`${s.wrap} ${s.barInner}`}>
          <div className={s.brand}>
            <p className={s.house}>Fernhollow Partners<span aria-hidden="true"> · </span><span className={s.srOnly}>, </span>fictional fund</p>
            <h2 className={s.fund}>Multi-Asset Fund <span className={s.fundClass}>A Acc · GBP</span></h2>
          </div>
          <dl className={s.status}>
            <div><dt>Data</dt><dd><span className={s.simBadge}>Simulated</span></dd></div>
            <div><dt>Session</dt><dd>Closed · end of day</dd></div>
            <div><dt>As of</dt><dd><time dateTime={`${fmt.iso(DATA.dates[LAST])}T16:30Z`}>{fmt.dateLong.format(DATA.dates[LAST])} · 16:30 UTC</time></dd></div>
          </dl>
          <fieldset className={s.gains}>
            <legend className={s.gainsLegend}>Gains in</legend>
            {(['green', 'red'] as const).map((g) => (
              <label key={g} className={s.seg}>
                <input type="radio" name={`${uid}-gains`} checked={gains === g} onChange={() => setGains(g)} />
                <span><span aria-hidden="true" className={s.segSwatch} data-g={g} />{g === 'green' ? 'Green' : 'Red'}</span>
              </label>
            ))}
          </fieldset>
        </div>
      </header>

      <div className={s.wrap}>
        <p className={s.intro}>End-of-day oversight for a fictional balanced fund: what moved, where the allocation drifted, what needs a decision. Every figure is generated in your browser from a fixed seed — no market data, no advice.</p>

        <section className={s.attention} aria-labelledby={`${uid}-att`}>
          <h3 id={`${uid}-att`} className={s.label}>Needs attention <span className={s.count}>{active.length - Object.keys(acked).length > 0 ? `${active.length - Object.keys(acked).length} open` : 'all acknowledged'}</span></h3>
          {active.length ? (
            <ul className={s.alerts}>
              {active.map((al) => (
                <li key={al.id} className={s.alert} data-sev={al.severity} data-acked={acked[al.id] ? '' : undefined}>
                  <SevIcon sev={al.severity} />
                  <div className={s.alertBody}>
                    <p className={s.alertTitle}><span className={s.sevText} data-sev={al.severity}>{SEV_LABEL[al.severity]}</span>{al.title}</p>
                    <p className={s.alertRule}>{al.rule} <time dateTime={fmt.iso(al.at)}>Raised {fmt.date.format(al.at)}.</time></p>
                  </div>
                  {acked[al.id]
                    ? <p className={s.ackDone}>Acknowledged {timeFmt.format(acked[al.id])} UTC</p>
                    : <button type="button" className={s.btn} onClick={() => setAcked((x) => ({ ...x, [al.id]: Date.now() }))}>Acknowledge<span className={s.srOnly}>: {al.title}</span></button>}
                </li>
              ))}
            </ul>
          ) : <p className={s.empty}>No open alerts at the latest close.</p>}
          {resolved.map((al) => (
            <p key={al.id} className={s.resolved}><SevIcon sev="resolved" /><span className={s.sevText} data-sev="resolved">Resolved</span>{al.title}. {al.rule}</p>
          ))}
        </section>

        <section aria-labelledby={`${uid}-kpi`} className={s.kpiSection}>
          <h3 id={`${uid}-kpi`} className={s.srOnly}>Key figures for {rangeText}</h3>
          <dl className={s.kpis}>
            {kpis.map((k) => (
              <div key={k.id} className={s.kpi}>
                <dt className={s.label}>{k.label}</dt>
                <dd className={s.kpiValue}><span className={s.srOnly}>{k.text}</span><Ticker value={k.value} text={k.text} animate={roll} /></dd>
                <dd className={s.kpiNote}>{k.note}</dd>
              </div>
            ))}
          </dl>
          <p className={s.kpiPeriod}><span className={s.label}>Period</span> {rangeText} · {preset === 'custom' ? 'custom range' : PRESETS.find((p) => p.id === preset)?.name} · simulated</p>
        </section>

        <div className={s.main}>
          <section className={s.perf} aria-labelledby={`${uid}-perf`}>
            <div className={s.panelHead}>
              <div>
                <h3 id={`${uid}-perf`} className={s.panelTitle}>Growth of £100</h3>
                <p className={s.sub}>Fund vs 60/40 composite · rebased to 100 at the {fmt.date.format(DATA.dates[a])} close · daily · <span className={s.simTag}>Simulated</span></p>
              </div>
              <fieldset className={s.ranges}>
                <legend className={s.srOnly}>Range</legend>
                {PRESETS.map((p) => (
                  <label key={p.id} className={s.seg}>
                    <input type="radio" name={`${uid}-range`} checked={preset === p.id} onChange={() => choosePreset(p.id)} />
                    <span>{p.label}<span className={s.srOnly}> ({p.name})</span></span>
                  </label>
                ))}
                <span className={s.custom} data-on={preset === 'custom' || undefined} aria-hidden={preset !== 'custom'}>Custom</span>
              </fieldset>
            </div>

            <ul className={s.legend} aria-label="Legend">
              {series.map((sr) => <li key={sr.key} data-role={sr.role}><span aria-hidden="true" className={s.legendLine} data-role={sr.role} />{sr.label}</li>)}
              {position ? <li><button type="button" className={s.linkBtn} onClick={() => setSelected(null)}>Remove {position.name}</button></li> : null}
            </ul>

            <figure className={s.figure} aria-describedby={`${uid}-sum`}>
              <PerformanceChart dates={DATA.dates} series={series} win={win} transition={transition} />
              <figcaption className={s.overviewHead}>
                <span className={s.label} id={`${uid}-ov`}>Three-year history · drag the window or its edges; arrow keys step a day, Shift a week</span>
              </figcaption>
              <RangeBrush dates={DATA.dates} values={DATA.nav} win={win} minSpan={MIN_SPAN} describedBy={`${uid}-ov`} onChange={brush} onCommit={commit} />
            </figure>
            <p id={`${uid}-sum`} className={s.summary}>{summary}</p>
            <div className={s.tableToggle}>
              <button type="button" className={s.btn} aria-expanded={showTable} aria-controls={`${uid}-ct`} onClick={() => setShowTable((v) => !v)}>{showTable ? 'Hide table' : 'View as table'}</button>
              <span className={s.hint}>{tableRows.pick.length} rows · {tableRows.res}</span>
            </div>
            <div id={`${uid}-ct`} hidden={!showTable} className={s.tableBox} role="region" aria-label="Growth of £100, table" tabIndex={showTable ? 0 : -1}>
              {showTable ? (
                <table className={s.table}>
                  <caption className={s.caption}>Growth of £100 from the {fmt.date.format(DATA.dates[a])} close, {tableRows.res}. Simulated data.</caption>
                  <thead><tr><th scope="col">Date</th><th scope="col" className={s.num}>Fund</th><th scope="col" className={s.num}>Composite</th><th scope="col" className={s.num}>Difference</th><th scope="col" className={s.num}>NAV (£)</th></tr></thead>
                  <tbody>
                    {tableRows.pick.map((i) => {
                      const f = (DATA.nav[i] / DATA.nav[a]) * 100, c = (DATA.composite[i] / DATA.composite[a]) * 100;
                      return <tr key={i}><th scope="row"><time dateTime={fmt.iso(DATA.dates[i])}>{fmt.date.format(DATA.dates[i])}</time></th><td className={s.num}>{fmt.index.format(f)}</td><td className={s.num}>{fmt.index.format(c)}</td><td className={s.num}>{fmt.pp(f - c)}</td><td className={s.num}>{fmt.price.format(DATA.nav[i])}</td></tr>;
                    })}
                  </tbody>
                </table>
              ) : null}
            </div>
          </section>

          <aside className={s.side} aria-label="Allocation and attribution">
            <section aria-labelledby={`${uid}-alloc`} className={s.panel}>
              <h3 id={`${uid}-alloc`} className={s.panelTitle}>Allocation vs target</h3>
              <p className={s.sub}>Share of fund value at the {fmt.dateShort.format(DATA.dates[b])} close · band ±{fmt.index.format(BAND * 100)} pp · last rebalance {fmt.dateShort.format(DATA.dates[Math.max(...DATA.rebalances.filter((r) => r <= b))])}</p>
              <ul className={s.alloc}>
                {SLEEVES.map((sl) => {
                  const w = DATA.weights[sl.id][b];
                  const d = w - sl.target;
                  const out = Math.abs(d) > BAND;
                  return (
                    <li key={sl.id}>
                      <button type="button" className={s.allocRow} aria-pressed={filter === sl.id} onClick={() => setFilter((f) => (f === sl.id ? null : sl.id))}>
                        <span className={s.allocName}>{sl.name}</span>
                        <span className={s.allocVal}>{fmt.pct1.format(w)}</span>
                        <span className={s.track} aria-hidden="true">
                          <span className={s.allocBar} style={{ transform: `scaleX(${(w / AXIS_MAX).toFixed(4)})` }} />
                          <span className={s.target} style={{ left: `${((sl.target / AXIS_MAX) * 100).toFixed(2)}%` }} />
                        </span>
                        <span className={s.drift} data-out={out || undefined}>
                          {out ? <SevIcon sev="major" /> : null}{fmt.pp(d * 100)} vs {fmt.pct1.format(sl.target)}{out ? ' · outside band' : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className={s.allocAxis} aria-hidden="true"><span>0%</span><span>20%</span><span>40%</span><span>60%</span></div>
              <p className={s.hint}>Bar: actual weight, axis from zero. Tick: target. Select a sleeve to filter the positions.</p>
            </section>

            <section aria-labelledby={`${uid}-attr`} className={s.panel}>
              <h3 id={`${uid}-attr`} className={s.panelTitle}>What drove the return</h3>
              <p className={s.sub}>Contribution to the {fmt.pctSigned2.format(st.fundRet)} fund return, percentage points · {preset === 'custom' ? 'custom range' : PRESETS.find((p) => p.id === preset)?.name}</p>
              <table className={s.attr}>
                <caption className={s.srOnly}>Return attribution by sleeve for {rangeText}, in percentage points. Rows sum to the fund return. Simulated data.</caption>
                <tbody>
                  {[...attribution.rows.map((r) => ({ key: r.id, name: r.name, pp: r.pp })), { key: 'fees', name: 'Fees (0.60% a year)', pp: attribution.fees }, { key: 'other', name: 'Compounding & timing', pp: attribution.other }].map((r) => (
                    <tr key={r.key}>
                      <th scope="row">{r.name}</th>
                      <td className={s.attrBarCell} aria-hidden="true">
                        <span className={s.attrTrack}><span className={s.attrBar} data-dir={r.pp >= 0 ? 'up' : 'down'} style={{ width: `${((Math.abs(r.pp) / attrMax) * 50).toFixed(2)}%`, [r.pp >= 0 ? 'left' : 'right']: '50%' }} /></span>
                      </td>
                      <td className={s.num}>{fmt.pp(r.pp)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><th scope="row">Fund return</th><td aria-hidden="true" /><td className={s.num}>{fmt.pp(attribution.total)}</td></tr></tfoot>
              </table>
              <p className={s.hint}>Each sleeve: sum of its start-of-day weight × daily return. Bars share one scale centred on zero.</p>
            </section>
          </aside>
        </div>

        <section aria-labelledby={`${uid}-pos`} className={s.positions}>
          <div className={s.panelHead}>
            <div>
              <h3 id={`${uid}-pos`} className={s.panelTitle}>Positions</h3>
              <p className={s.sub}>{rows.length} of {DATA.positions.length} instruments{filter ? ` · ${sleeveName(filter)} only` : ''} · at the {fmt.dateShort.format(DATA.dates[LAST])} close · bond units are £100 nominal · <span className={s.simTag}>Simulated</span></p>
            </div>
            {filter ? <button type="button" className={s.btn} onClick={() => setFilter(null)}>Show all sleeves</button> : null}
          </div>
          <p className={s.hint}>Choose an instrument to plot it against the fund. Up and down arrows move between rows; Escape clears the comparison.</p>
          <div className={s.tableBox} role="region" aria-labelledby={`${uid}-pos`} tabIndex={0}>
            <table className={`${s.table} ${s.posTable}`}>
              <caption className={s.srOnly}>Positions at the latest close, simulated data. Column headers sort the table.</caption>
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th key={c.key} scope="col" className={c.num ? s.num : undefined} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className={s.sortBtn} onClick={() => sortBy(c.key)}>{c.label}<span aria-hidden="true" className={s.sortMark}>{sort.key === c.key ? (sort.dir === 1 ? '↑' : '↓') : '↕'}</span></button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((p, i) => (
                  <tr key={p.code} data-selected={p.code === selected || undefined}>
                    <th scope="row">
                      <button
                        type="button" ref={(el) => { rowRefs.current[i] = el; }} className={s.rowBtn}
                        tabIndex={i === focusRow ? 0 : -1} aria-pressed={p.code === selected}
                        onFocus={() => setFocusRow(i)} onKeyDown={rowKey(i)}
                        onClick={() => setSelected((x) => (x === p.code ? null : p.code))}
                      >
                        <span className={s.posName}>{p.name}</span><span className={s.posCode}>{p.code}</span>
                      </button>
                    </th>
                    <td>{sleeveName(p.sleeve)}</td>
                    <td className={s.num}>{fmt.int.format(p.units)}</td>
                    <td className={s.num}>{fmt.price.format(p.price)}</td>
                    <td className={s.num}>{fmt.gbpK.format(p.value / 1000)}</td>
                    <td className={s.num}>{fmt.pct1.format(p.weight)}</td>
                    <td className={s.num}><Delta v={p.dayPct}>{fmt.pctSigned2.format(p.dayPct)}</Delta></td>
                    <td className={s.num}><Delta v={p.pnl}>{fmt.gbpKSigned.format(p.pnl / 1000)}</Delta></td>
                  </tr>
                )) : <tr><td colSpan={COLS.length} className={s.empty}>No positions in this sleeve.</td></tr>}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total · {rows.length}</th><td /><td /><td />
                  <td className={s.num}>{fmt.gbpK.format(totals.value / 1000)}</td>
                  <td className={s.num}>{fmt.pct1.format(totals.weight)}</td>
                  <td />
                  <td className={s.num}>{fmt.gbpKSigned.format(totals.pnl / 1000)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <footer className={s.foot}>
          <p><strong>Data note.</strong> Simulated, seed {SEED}: five sleeves driven by one shared market factor plus noise, a 0.60% annual fee, quarterly rebalancing to target, and a 60/40 composite of the same equity and bond sleeves. Instrument names are invented and are not tickers. Weekdays only, no holidays; times in UTC. Last rebalance {fmt.date.format(DATA.dates[lastReb])}. Nothing here is investment advice.</p>
        </footer>
      </div>

      <p className={s.srOnly} role="status" aria-live="polite">{announce}</p>
    </div>
  );
}
