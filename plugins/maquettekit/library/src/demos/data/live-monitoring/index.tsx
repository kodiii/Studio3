'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cssEase, duration as D, profileScale, useStudioMotion } from '../../../motion';
import { FleetChart, N, type ChartData } from './FleetChart';
import { AGENTS, SEED, advance, createStore, statusOf, type FleetEvent, type Severity, type Status, type Store } from './sim';
import s from './styles.module.css';

const WINDOWS = [{ sec: 60, label: '1 min', name: 'one minute' }, { sec: 300, label: '5 min', name: 'five minutes' }, { sec: 900, label: '15 min', name: 'fifteen minutes' }] as const;
type WindowSec = (typeof WINDOWS)[number]['sec'];
const STATUS_LABEL: Record<Status, string> = { healthy: 'Healthy', degraded: 'Degraded', failing: 'Failing', paused: 'Paused' };
const SEV_LABEL: Record<Severity, string> = { critical: 'Critical', major: 'Major', resolved: 'Cleared' };
const ANNOUNCE_EVERY = 15_000;
const hms = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' });
const int = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat('en-GB', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct2 = new Intl.NumberFormat('en-GB', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signedPct = new Intl.NumberFormat('en-GB', { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 0 });
const at = (tick: number) => hms.format(tick * 1000);
const iso = (tick: number) => new Date(tick * 1000).toISOString();

/** Resample positions [from, to] of a buffer to N points: bucket mean/max when longer, linear when shorter. */
function resample(src: number[], from: number, to: number, how: 'mean' | 'max'): Float64Array {
  const out = new Float64Array(N);
  const len = to - from + 1;
  for (let k = 0; k < N; k++) {
    if (len >= N) {
      const s0 = from + Math.floor((k * len) / N), s1 = from + Math.floor(((k + 1) * len) / N) - 1;
      let acc = how === 'max' ? 0 : 0, c = 0;
      for (let j = s0; j <= Math.max(s0, s1); j++) { const v = src[j]; if (!Number.isFinite(v)) continue; acc = how === 'max' ? Math.max(acc, v) : acc + v; c++; }
      out[k] = c ? (how === 'max' ? acc : acc / c) : 0;
    } else {
      const u = from + (k / (N - 1)) * (len - 1), j = Math.min(to - 1, Math.floor(u)), f = u - j;
      const v0 = src[j], v1 = src[Math.min(to, j + 1)];
      out[k] = Number.isFinite(v0) && Number.isFinite(v1) ? v0 + (v1 - v0) * f : 0;
    }
  }
  return out;
}

function Glyph({ kind }: { kind: Status | Severity }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className={s.glyph} data-kind={kind}>
      {kind === 'failing' || kind === 'critical' ? <path d="M4 .8h4L11.2 4v4L8 11.2H4L.8 8V4z" />
        : kind === 'degraded' || kind === 'major' ? <path d="M6 .9 11.4 10.9H.6z" />
        : kind === 'paused' ? <path d="M2.5 1.5h2.4v9H2.5zM7.1 1.5h2.4v9H7.1z" />
        : kind === 'resolved' ? <path d="M1.8 6.4 4.8 9.2 10.4 2.9" className={s.glyphStroke} />
        : <rect x="1.5" y="1.5" width="9" height="9" rx="1" />}
    </svg>
  );
}

function Spark({ values, flags }: { values: Float64Array; flags: Uint8Array }) {
  let max = 0;
  for (const v of values) max = Math.max(max, v);
  const h = 36, w = 160, n = values.length;
  const px = (k: number) => (k / (n - 1)) * w, py = (v: number) => h - 2 - (v / (max * 1.1 || 1)) * (h - 4);
  let d = '';
  values.forEach((v, k) => { d += `${k ? 'L' : 'M'}${px(k).toFixed(1)} ${py(v).toFixed(1)}`; });
  const runs: [number, number][] = [];
  flags.forEach((f, k) => { if (!f) return; const last = runs[runs.length - 1]; if (last && last[1] === k - 1) last[1] = k; else runs.push([k, k]); });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={s.spark} aria-hidden="true">
      {runs.map(([a, b]) => { const x0 = Math.min(w - 5, Math.max(0, px(a) - 1)); return <rect key={a} x={x0} y={0} width={Math.min(w - x0, Math.max(5, px(b) - px(a) + 2))} height={h} className={s.sparkFlag} />; })}
      <line x1={0} x2={w} y1={h - 1} y2={h - 1} className={s.sparkBase} />
      <path d={d} className={s.sparkLine} />
    </svg>
  );
}

export default function LiveMonitoring() {
  const uid = useId();
  const { reduced } = useStudioMotion();
  const store = useRef<Store | null>(null);
  const [view, setView] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [win, setWin] = useState<WindowSec>(300);
  const [sel, setSel] = useState<number | null>(null);
  const [hold, setHold] = useState<number | null>(null);
  const holdSrc = useRef({ pointer: false, focus: false });
  const [showTable, setShowTable] = useState(false);
  const [announce, setAnnounce] = useState('');
  const ann = useRef({ lastAt: 0, lastTick: 0 });
  const ping = useRef<HTMLSpanElement>(null);

  // The stream starts after mount (its clock is the wall clock), so the server render is the designed loading state.
  useEffect(() => {
    const st = createStore(Math.floor(Date.now() / 1000));
    store.current = st;
    ann.current.lastTick = st.n;
    setView(st.n);
    const id = window.setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      advance(st, now);
      if (!pausedRef.current) setView(st.n);
    }, 1000);
    return () => { window.clearInterval(id); store.current = null; };
  }, []);

  const st = store.current;
  const ready = st !== null && view !== null && view >= st.n0;
  const end = ready ? view - st.n0 : 0;
  const start = Math.max(0, end - win + 1);

  // One brief ring per received tick; nothing pulses while paused or under reduced motion.
  useEffect(() => {
    const el = ping.current;
    if (!el || reduced || paused || typeof el.animate !== 'function') return;
    // One ring per received sample, from tokens (Essential: slow × 0.7 ≈ 390 ms), over well before the next tick.
    const a = el.animate([{ transform: 'scale(1)', opacity: 0.5 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: D.slow * profileScale.essential.duration, easing: cssEase('standard') });
    return () => a.cancel();
  }, [view, reduced, paused]);

  // Polite announcements: new anomalies only, summarised, at most once every 15 s.
  useEffect(() => {
    if (!st || view === null || paused) return;
    const now = Date.now();
    if (now - ann.current.lastAt < ANNOUNCE_EVERY) return;
    const fresh = st.events.filter((e) => e.tick > ann.current.lastTick && e.tick <= view && e.severity !== 'resolved');
    ann.current.lastTick = view;
    if (!fresh.length) return;
    ann.current.lastAt = now;
    setAnnounce(fresh.length === 1
      ? `New anomaly on ${AGENTS[fresh[0].agent].id}: ${fresh[0].text}.`
      : `${fresh.length} new anomalies: ${fresh.slice(0, 3).map((e) => `${AGENTS[e.agent].id} ${e.kind}`).join(', ')}${fresh.length > 3 ? ' and more' : ''}.`);
  }, [view, st, paused]);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    if (!next && st) { setView(st.n); ann.current.lastTick = st.n; }
    setAnnounce(next ? `Stream paused at ${view !== null ? at(view) : ''} UTC. Data keeps arriving in the background.` : 'Stream resumed; showing the latest data.');
  };

  const agentNow = AGENTS.map((spec, i) => {
    if (!ready) return { spec, i, status: 'healthy' as Status, rpm: NaN, p95: NaN, err: NaN, flags: 0 };
    const flags = st.flag[i][end];
    return { spec, i, status: statusOf(st, i, flags), rpm: st.rpm[i][end], p95: st.p95[i][end], err: st.err[i][end], flags };
  });
  const active = agentNow.filter((a) => !a.spec.paused);
  const fleet = useMemo(() => {
    if (!ready) return null;
    let sum = 0, failed = 0;
    for (const a of active) { sum += a.rpm; failed += a.rpm * a.err; }
    let wSum = 0;
    for (let j = start; j <= end; j++) for (const a of active) wSum += st.rpm[a.i][j];
    const avg = wSum / (end - start + 1);
    return { sum, failed, success: sum ? 1 - failed / sum : 1, avg };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, win, ready]);

  const openCount = agentNow.reduce((c, a) => c + ((a.flags & 1) ? 1 : 0) + ((a.flags & 2) ? 1 : 0) + ((a.flags & 4) ? 1 : 0), 0);
  const healthy = active.filter((a) => a.status === 'healthy').length;
  const worst = active.reduce<(typeof active)[number] | null>((w, a) => (!w || a.p95 / a.spec.p95 > w.p95 / w.spec.p95 ? a : w), null);

  const selAgent = sel !== null ? AGENTS[sel] : null;
  const chart = useMemo<ChartData | null>(() => {
    if (!ready) return null;
    const t0 = st.n0 + start, t1 = view;
    if (sel === null) {
      const tot: number[] = [], fail: number[] = [];
      for (let j = 0; j <= end; j++) {
        let a = 0, f = 0;
        for (const ag of active) { const r = st.rpm[ag.i][j]; a += r; f += r * st.err[ag.i][j]; }
        tot.push(a); fail.push(f);
      }
      const markers = st.events.filter((e) => e.tick >= t0 && e.tick <= t1 && e.severity !== 'resolved').map((e) => ({ tick: e.tick, severity: e.severity as 'critical' | 'major' }));
      return { mode: 'fleet', a: resample(tot, start, end, 'mean'), b: resample(fail, start, end, 'mean'), c: null, flags: null, t0, t1, markers };
    }
    const f = st.flag[sel];
    const fl = new Uint8Array(N);
    const len = end - start + 1;
    for (let k = 0; k < N; k++) {
      const s0 = start + Math.floor((k * len) / N), s1 = Math.max(s0, start + Math.floor(((k + 1) * len) / N) - 1);
      for (let j = s0; j <= Math.min(end, s1); j++) if (f[j] & 1) { fl[k] = 1; break; }
    }
    return { mode: 'agent', a: resample(st.p95[sel], start, end, 'max'), b: resample(st.lo[sel], start, end, 'mean'), c: resample(st.hi[sel], start, end, 'mean'), flags: fl, t0, t1, markers: [] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, win, sel, ready]);

  const winInfo = WINDOWS.find((w) => w.sec === win)!;
  const chartSummary = !ready || !chart ? 'Connecting to the simulated stream.'
    : chart.mode === 'fleet'
      ? (() => {
        let lo = Infinity, hi = 0;
        for (const v of chart.a) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
        const opened = chart.markers.length;
        return `Fleet runs per minute over the last ${winInfo.name}: ${int.format(fleet!.sum)} now, between ${int.format(lo)} and ${int.format(hi)}; ${pct2.format(fleet!.failed / Math.max(1, fleet!.sum))} of runs failing now. ${opened === 0 ? 'No anomalies opened' : `${opened} ${opened === 1 ? 'anomaly' : 'anomalies'} opened`} in this window.`;
      })()
      : selAgent?.paused ? `${selAgent.id} is paused by an operator; there is no data to show.`
      : (() => {
        const p = st.p95[sel!].slice(start, end + 1);
        const flaggedS = st.flag[sel!].slice(start, end + 1).filter((x) => x & 1).length;
        return `${selAgent!.id} p95 latency over the last ${winInfo.name}: ${int.format(p[p.length - 1])} ms now, peak ${int.format(Math.max(...p))} ms. Above its expected band (2-minute baseline ± 3σ) for ${flaggedS} s of this window.`;
      })();

  const logN = hold ?? view ?? 0;
  const visibleEvents: FleetEvent[] = ready ? st.events.filter((e) => e.tick <= logN).slice(-60).reverse() : [];
  const pending = ready && hold !== null && view !== null ? st.events.filter((e) => e.tick > hold && e.tick <= view).length : 0;
  const setHolding = (src: 'pointer' | 'focus', on: boolean) => {
    holdSrc.current[src] = on;
    const any = holdSrc.current.pointer || holdSrc.current.focus;
    setHold((h) => (any ? (h ?? view) : null));
  };

  const age = ready ? Math.max(0, Math.floor(Date.now() / 1000) - view) : 0;
  const state = !ready ? 'connecting' : paused ? 'paused' : age > 3 ? 'stale' : 'live';
  const kpiDelta = fleet ? fleet.sum / Math.max(1, fleet.avg) - 1 : 0;

  return (
    <div className={s.root} data-state={state} data-reduced={reduced || undefined}>
      <header className={s.bar}>
        <div className={`${s.wrap} ${s.barInner}`}>
          <div className={s.brand}>
            <p className={s.house}>Larkline Freight · fictional</p>
            <h2 className={s.name}>Switchyard <span className={s.nameSub}>agent fleet</span></h2>
          </div>
          <div className={s.liveBox} aria-live="off">
            <span className={s.lamp} data-state={state} aria-hidden="true"><span ref={ping} className={s.ping} /></span>
            <span className={s.stateWord}>{state === 'connecting' ? 'Connecting' : state === 'paused' ? 'Paused' : state === 'stale' ? 'Stale' : 'Live'}</span>
            <span className={s.stateMeta}>
              {ready ? <>{state === 'paused' ? 'showing' : 'updated'} <time dateTime={iso(view)}>{at(view)} UTC</time>{paused && st.n > view ? ` · ${st.n - view} s behind` : ''}</> : 'simulated stream'}
            </span>
            <span className={s.simBadge}>Simulated</span>
          </div>
          <fieldset className={s.windows}>
            <legend className={s.windowLegend}>Window</legend>
            {WINDOWS.map((w) => (
              <label key={w.sec} className={s.seg}>
                <input type="radio" name={`${uid}-win`} checked={win === w.sec} onChange={() => setWin(w.sec)} />
                <span>{w.label}</span>
              </label>
            ))}
          </fieldset>
          <button type="button" className={s.pause} aria-pressed={paused} onClick={togglePause} disabled={!ready}>
            <svg viewBox="0 0 12 12" aria-hidden="true">{paused ? <path d="M3 1.5v9l7.5-4.5z" /> : <path d="M2.5 1.5h2.4v9H2.5zM7.1 1.5h2.4v9H7.1z" />}</svg>
            {paused ? 'Resume stream' : 'Pause stream'}
          </button>
        </div>
      </header>

      <div className={s.wrap}>
        <p className={s.intro}>
          Eleven running agents for a fictional freight company, one sample per second. Anomaly rules run on the stream as it arrives; the log keeps still while you read it.
          Everything here is generated in your browser from seed {SEED} — no real systems, models or customers.
        </p>

        <section aria-labelledby={`${uid}-kpi`}>
          <h3 id={`${uid}-kpi`} className={s.srOnly}>Fleet now</h3>
          <dl className={s.kpis}>
            <div className={s.kpi}><dt>Runs per minute</dt><dd className={s.kpiValue}>{fleet ? int.format(fleet.sum) : '—'}</dd><dd className={s.kpiNote}>{fleet ? <><span className={s.dir}>{kpiDelta >= 0 ? '▲' : '▼'}</span> {signedPct.format(kpiDelta)} vs {winInfo.label} average</> : 'waiting for data'}</dd></div>
            <div className={s.kpi}><dt>Success rate</dt><dd className={s.kpiValue}>{fleet ? pct2.format(fleet.success) : '—'}</dd><dd className={s.kpiNote}>{fleet ? `${int.format(fleet.failed)} failing runs / min` : 'waiting for data'}</dd></div>
            <div className={s.kpi}><dt>Agents healthy</dt><dd className={s.kpiValue}>{ready ? <>{healthy}<span className={s.of}> / {active.length}</span></> : '—'}</dd><dd className={s.kpiNote}>{AGENTS.length - active.length} paused by an operator</dd></div>
            <div className={s.kpi} data-alert={openCount > 0 || undefined}><dt>Open anomalies</dt><dd className={s.kpiValue}>{ready ? openCount : '—'}</dd><dd className={s.kpiNote}>{ready ? (openCount ? agentNow.filter((a) => a.flags).map((a) => a.spec.id).join(', ') : 'None right now') : 'waiting for data'}</dd></div>
            <div className={s.kpi}><dt>Furthest above normal</dt><dd className={s.kpiValue}>{worst ? <>{int.format(worst.p95)}<span className={s.of}> ms</span></> : '—'}</dd><dd className={s.kpiNote}>{worst ? `${worst.spec.id} p95, ${signedPct.format(worst.p95 / worst.spec.p95 - 1)} vs its norm` : 'waiting for data'}</dd></div>
          </dl>
        </section>

        <div className={s.main}>
          <div className={s.primary}>
            <section className={s.panel} aria-labelledby={`${uid}-chart`}>
              <div className={s.panelHead}>
                <div>
                  <h3 id={`${uid}-chart`} className={s.panelTitle}>{selAgent ? <>{selAgent.id} <span className={s.titleMuted}>p95 latency, ms</span></> : <>Fleet throughput <span className={s.titleMuted}>runs per minute</span></>}</h3>
                  <p className={s.sub}>Last {winInfo.label} · 1-second samples · UTC · <span className={s.simTag}>Simulated</span></p>
                </div>
                {selAgent ? <button type="button" className={s.btn} onClick={() => setSel(null)}>Back to fleet</button> : null}
              </div>
              <ul className={s.legend} aria-label="Legend">
                {sel === null ? (<>
                  <li><span className={s.keyOk} aria-hidden="true" />All runs</li>
                  <li><span className={s.keyFail} aria-hidden="true" />Failed runs (lower band)</li>
                  <li><Glyph kind="major" />Anomaly opened</li>
                  <li><Glyph kind="critical" />Error-rate anomaly</li>
                </>) : (<>
                  <li><span className={s.keyLine} aria-hidden="true" />p95 latency</li>
                  <li><span className={s.keyBand} aria-hidden="true" />Expected: 2-min baseline ± 3σ</li>
                  <li><span className={s.keyFlag} aria-hidden="true" />Anomaly: above 3σ for 3 s or more</li>
                </>)}
              </ul>
              {chart && !(selAgent?.paused) ? (
                <FleetChart data={chart} modeKey={sel === null ? 'fleet' : `agent-${sel}`} windowKey={win} label={chartSummary} />
              ) : (
                <div className={s.plotEmpty}><p>{ready ? 'Paused by an operator at the start of this session — no samples to plot.' : 'Connecting to the simulated stream…'}</p></div>
              )}
              <p className={s.summary}>{chartSummary}</p>
            </section>

            <section className={s.panel} aria-labelledby={`${uid}-grid`}>
              <div className={s.panelHead}>
                <div>
                  <h3 id={`${uid}-grid`} className={s.panelTitle}>Agents</h3>
                  <p className={s.sub}>Now · sparklines show p95 latency over the last {winInfo.label}, each on its own scale from zero; shaded spans are anomalies. Choose an agent to chart it.</p>
                </div>
                <button type="button" className={s.btn} aria-expanded={showTable} aria-controls={`${uid}-table`} onClick={() => setShowTable((v) => !v)}>{showTable ? 'Hide table' : 'View as table'}</button>
              </div>
              <ul className={s.agents}>
                {agentNow.map((a) => {
                  const kinds = [a.flags & 1 ? 'latency' : null, a.flags & 2 ? 'errors' : null, a.flags & 4 ? 'throughput' : null].filter(Boolean);
                  return (
                    <li key={a.spec.id}>
                      <button type="button" className={s.tile} data-status={a.status} aria-pressed={sel === a.i} onClick={() => setSel((x) => (x === a.i ? null : a.i))}>
                        <span className={s.tileHead}>
                          <span className={s.status} data-status={a.status}><Glyph kind={a.status} />{STATUS_LABEL[a.status]}</span>
                          <span className={s.tier}>Tier {a.spec.tier}</span>
                        </span>
                        <span className={s.agentId}>{a.spec.id}</span>
                        <span className={s.role}>{a.spec.role}</span>
                        {a.spec.paused ? (
                          <span className={s.tileEmpty}>No samples while paused</span>
                        ) : (<>
                          <span className={s.tileValue}>{ready ? int.format(a.p95) : '—'}<span className={s.unit}> ms p95</span></span>
                          {ready ? <Spark values={resample(st.p95[a.i], start, end, 'max').filter((_, k) => k % 4 === 0)} flags={Uint8Array.from({ length: N / 4 }, (_, k) => {
                            const len = end - start + 1, s0 = start + Math.floor((k * 4 * len) / N), s1 = start + Math.floor(((k * 4 + 4) * len) / N) - 1;
                            for (let j = s0; j <= Math.min(end, Math.max(s0, s1)); j++) if (st.flag[a.i][j] & 1) return 1;
                            return 0;
                          })} /> : <span className={s.sparkEmpty} />}
                          <span className={s.tileMeta}>{ready ? `${int.format(a.rpm)} runs/min · ${pct1.format(a.err)} errors` : 'waiting for data'}</span>
                          {kinds.length ? <span className={s.anomaly}>Anomaly · {kinds.join(', ')}</span> : null}
                        </>)}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div id={`${uid}-table`} hidden={!showTable} className={s.tableBox} role="region" aria-label="Agents, table" tabIndex={showTable ? 0 : -1}>
                {showTable ? (
                  <table className={s.table}>
                    <caption className={s.caption}>Agent values at {ready ? `${at(view)} UTC` : '—'}{paused ? ' (paused)' : ''}. Simulated data.</caption>
                    <thead><tr><th scope="col">Agent</th><th scope="col">Status</th><th scope="col" className={s.num}>Runs / min</th><th scope="col" className={s.num}>p95 (ms)</th><th scope="col" className={s.num}>Errors</th><th scope="col">Open anomalies</th></tr></thead>
                    <tbody>
                      {agentNow.map((a) => (
                        <tr key={a.spec.id}>
                          <th scope="row">{a.spec.id}</th>
                          <td>{STATUS_LABEL[a.status]}</td>
                          <td className={s.num}>{a.spec.paused || !ready ? '—' : int.format(a.rpm)}</td>
                          <td className={s.num}>{a.spec.paused || !ready ? '—' : int.format(a.p95)}</td>
                          <td className={s.num}>{a.spec.paused || !ready ? '—' : pct1.format(a.err)}</td>
                          <td>{[a.flags & 1 ? 'latency' : null, a.flags & 2 ? 'errors' : null, a.flags & 4 ? 'throughput' : null].filter(Boolean).join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            </section>
          </div>

          <section className={`${s.panel} ${s.logPanel}`} aria-labelledby={`${uid}-log`}>
            <div className={s.panelHead}>
              <div>
                <h3 id={`${uid}-log`} className={s.panelTitle}>Event log</h3>
                <p className={s.sub}>Newest first · UTC · rules: latency above 3σ for 3 s; errors at 2% for 3 s; throughput under 50% for 5 s</p>
              </div>
            </div>
            <p className={s.holdNote} data-on={hold !== null || undefined}>
              {hold !== null ? <>Held while you read{pending ? ` · ${pending} new` : ''} </> : 'Updates live; hover or focus the log to hold it.'}
              {hold !== null && pending ? <button type="button" className={s.linkBtn} onClick={() => setHold(view)}>Show {pending} new</button> : null}
            </p>
            <div
              className={s.log} role="region" aria-labelledby={`${uid}-log`} tabIndex={0}
              onPointerEnter={() => setHolding('pointer', true)} onPointerLeave={() => setHolding('pointer', false)}
              onFocus={() => setHolding('focus', true)}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHolding('focus', false); }}
            >
              {visibleEvents.length ? (
                <ol className={s.events}>
                  {visibleEvents.map((e) => (
                    <li key={e.id} className={s.event} data-sev={e.severity}>
                      <time dateTime={iso(e.tick)} className={s.evTime}>{at(e.tick)}</time>
                      <span className={s.evSev} data-sev={e.severity}><Glyph kind={e.severity} />{SEV_LABEL[e.severity]}</span>
                      <span className={s.evAgent}>{AGENTS[e.agent].id}</span>
                      <span className={s.evText}>{e.text}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className={s.empty}>{ready ? 'No events in the last 15 minutes.' : 'Connecting to the simulated stream…'}</p>}
            </div>
          </section>
        </div>

        <footer className={s.foot}>
          <p><strong>Data note.</strong> Simulated stream, seed {SEED}: each one-second sample is a pure function of agent and time — seeded smooth noise, jitter, and incidents placed by hashing four-minute blocks. Anomaly rules run on it exactly as they would on a live feed. Agent names are invented; no models, customers or systems are real. Pausing freezes the view while data keeps arriving; resuming jumps to the latest second.</p>
        </footer>
      </div>
      <p className={s.srOnly} role="status" aria-live="polite">{announce}</p>
    </div>
  );
}
