'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { spring as SPRING, springToLinear, useStudioMotion } from '../../../motion';
import { StudioCanvas, useCanvasDiagnostics, formatCount } from '../../../three';
import { Atlas, useLabelStore, type AtlasHandle, type ViewMode } from './Atlas';
import { CLUSTERS, EDGES_LIST, KINDS, NODES, PALETTE, formatRpm, relax, type AtlasNode, type ClusterId, type NodeKind } from './data';
import styles from './styles.module.css';

type SortKey = 'id' | 'cluster' | 'kind' | 'rpm' | 'p95' | 'errors' | 'degree';
const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'id', label: 'Service' }, { key: 'cluster', label: 'Cluster' }, { key: 'kind', label: 'Type' },
  { key: 'rpm', label: 'Calls / min', numeric: true }, { key: 'p95', label: 'p95 ms', numeric: true },
  { key: 'errors', label: 'Errors %', numeric: true }, { key: 'degree', label: 'Links', numeric: true },
];
const clusterName = (id: ClusterId) => CLUSTERS.find((c) => c.id === id)?.name ?? id;
const degree = (n: AtlasNode) => n.in.length + n.out.length;
const sortValue = (n: AtlasNode, k: SortKey): string | number => (k === 'degree' ? degree(n) : k === 'cluster' ? clusterName(n.cluster) : n[k]);

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

/** Tiny shape key, matching the instanced geometry of each node type. */
function KindGlyph({ kind, color = 'currentColor' }: { kind: NodeKind; color?: string }) {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" className="flex-none">
      {kind === 'service' ? <circle cx="7" cy="7" r="5.5" fill={color} />
        : kind === 'store' ? <path d="M2 3.5a5 2 0 0 1 10 0v7a5 2 0 0 1-10 0z" fill={color} />
        : kind === 'queue' ? <path d="M7 1l6 6-6 6-6-6z" fill={color} />
        : <rect x="2" y="2" width="10" height="10" fill={color} />}
    </svg>
  );
}

/** No-WebGL view: the planar layout drawn as SVG, reflecting the same selection and filters. */
function FlatMap({ theme, visible, selected, matches }: { theme: 'light' | 'dark'; visible: ReadonlySet<ClusterId>; selected: number | null; matches: ReadonlySet<number> | null }) {
  const layout = useMemo(() => relax(true), []);
  const pal = PALETTE[theme];
  const xs = NODES.map((n) => layout[n.index * 3]), ys = NODES.map((n) => -layout[n.index * 3 + 1]);
  const pad = 1.2, minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad, w = Math.max(...xs) - minX + pad, h = Math.max(...ys) - minY + pad;
  const focus = selected != null ? new Set([selected, ...NODES[selected].out, ...NODES[selected].in]) : null;
  const lit = (i: number) => (focus ? focus.has(i) : matches ? matches.has(i) : true);
  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="h-full w-full" role="img" aria-label="Flat map of the sample services; the table below lists the same services and links.">
      {EDGES_LIST.filter((e) => visible.has(NODES[e.source].cluster) && visible.has(NODES[e.target].cluster)).map((e) => (
        <line key={e.index} x1={xs[e.source]} y1={ys[e.source]} x2={xs[e.target]} y2={ys[e.target]} stroke="currentColor" strokeWidth={0.03}
          opacity={selected != null && (e.source === selected || e.target === selected) ? 0.9 : 0.22} />
      ))}
      {NODES.filter((n) => visible.has(n.cluster)).map((n) => {
        const r = 0.22 + Math.min(0.22, Math.log10(n.rpm) / 25);
        const fill = lit(n.index) ? pal[n.cluster] : 'transparent';
        const stroke = pal[n.cluster];
        const x = xs[n.index], y = ys[n.index];
        return (
          <g key={n.id}>
            {n.kind === 'service' ? <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={0.05} />
              : n.kind === 'queue' ? <path d={`M${x} ${y - r * 1.3}l${r * 1.3} ${r * 1.3}l${-r * 1.3} ${r * 1.3}l${-r * 1.3} ${-r * 1.3}z`} fill={fill} stroke={stroke} strokeWidth={0.05} />
              : <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={n.kind === 'store' ? r * 0.5 : 0} fill={fill} stroke={stroke} strokeWidth={0.05} />}
            {n.index === selected ? <text x={x} y={y - r - 0.18} textAnchor="middle" fontSize={0.42} fill="currentColor" fontFamily="var(--mk-font-mono, monospace)">{n.id}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

export default function SpatialData() {
  const uid = useId();
  const theme = useTheme();
  const labels = useLabelStore();
  // One stable ref callback per label: inline callbacks would detach and re-attach on every render.
  const labelRef = useMemo(() => {
    const cache = new Map<string, (el: HTMLElement | null) => void>();
    return (key: string) => {
      let f = cache.get(key);
      if (!f) { f = (el: HTMLElement | null) => labels.register(key, el); cache.set(key, f); }
      return f;
    };
  }, [labels]);
  const atlas = useRef<AtlasHandle>(null);
  const tableBox = useRef<HTMLDivElement>(null);
  const fromScene = useRef(false);
  const [mode, setMode] = useState<ViewMode>('3d');
  const [visible, setVisible] = useState<ReadonlySet<ClusterId>>(() => new Set(CLUSTERS.map((c) => c.id)));
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'rpm', dir: -1 });
  const diag = useCanvasDiagnostics(1000);
  const { reduced } = useStudioMotion();
  // Buttons release on a real spring (motion tokens) sampled into a CSS linear() curve.
  const release = useMemo(() => springToLinear(SPRING.press), []);
  const rootStyle = { '--release-ease': release.easing, '--release-dur': `${release.duration}ms` } as CSSProperties;

  const q = query.trim().toLowerCase();
  const matches = useMemo<ReadonlySet<number> | null>(() => (q ? new Set(NODES.filter((n) => n.id.includes(q) || n.role.toLowerCase().includes(q) || n.team.toLowerCase().includes(q)).map((n) => n.index)) : null), [q]);
  const rows = useMemo(() => {
    const list = NODES.filter((n) => visible.has(n.cluster) && (!matches || matches.has(n.index)));
    return list.sort((a, b) => {
      const va = sortValue(a, sort.key), vb = sortValue(b, sort.key);
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return c * sort.dir || a.id.localeCompare(b.id);
    });
  }, [visible, matches, sort]);

  // A filtered-out selection is cleared; the scene and the table never disagree about what is selected.
  useEffect(() => { if (selected != null && !visible.has(NODES[selected].cluster)) setSelected(null); }, [visible, selected]);

  const selectFromScene = useCallback((i: number | null) => { fromScene.current = true; setSelected(i); }, []);
  useEffect(() => {
    if (!fromScene.current || selected == null) return;
    fromScene.current = false;
    const box = tableBox.current, row = box?.querySelector<HTMLElement>(`[data-row="${selected}"]`);
    if (box && row && (row.offsetTop < box.scrollTop + 40 || row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight)) box.scrollTop = row.offsetTop - 48;
  }, [selected]);

  const node = selected != null ? NODES[selected] : null;
  const hoverNode = hovered != null ? NODES[hovered] : null;
  const labelNodes = useMemo(() => {
    const set = new Set<number>();
    if (node) [node.index, ...node.out, ...node.in].forEach((i) => set.add(i));
    if (hovered != null) set.add(hovered);
    return [...set].filter((i) => visible.has(NODES[i].cluster));
  }, [node, hovered, visible]);

  const toggleCluster = (id: ClusterId) => setVisible((v) => {
    const next = new Set(v);
    if (next.has(id)) { if (next.size > 1) next.delete(id); } else next.add(id);
    return next;
  });
  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'id' || key === 'cluster' || key === 'kind' ? 1 : -1 }));
  const describe = (n: AtlasNode) => `${n.id}, ${KINDS[n.kind].label.toLowerCase()} in ${clusterName(n.cluster)}: ${n.out.length} dependencies, ${n.in.length} callers`;
  const shownCount = NODES.filter((n) => visible.has(n.cluster)).length;
  const busiest = useMemo(() => NODES.filter((n) => visible.has(n.cluster)).sort((a, b) => b.rpm - a.rpm).slice(0, 3), [visible]);

  return (
    <div className={`${styles.root} bg-bg pb-20 text-ink`} data-atlas="" style={rootStyle} data-reduced={reduced || undefined}>
      <header className="mx-auto max-w-[1360px] px-4 pt-6 @3xl:px-8 @3xl:pt-10">
        <p className="mk-label m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
          <span>Meridian platform</span><span aria-hidden="true">/</span><span>Service atlas</span>
          <span className="rounded-full border border-line-strong px-2 py-0.5 text-ink">Sample data</span>
        </p>
        <div className="mt-4 grid gap-4 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] @4xl:items-end">
          <h2 className="mk-display m-0 text-[clamp(2.2rem,7.5cqi,4.6rem)]">Forty-three services, <span className="font-serif font-normal italic tracking-[-0.02em]">five neighbourhoods.</span></h2>
          <p className="m-0 max-w-[46ch] text-[15px] leading-relaxed text-muted">
            Who calls whom on a fictional commerce platform. Pick a service to light up its neighbours; the table below holds the same rows and stays in step with the map.
          </p>
        </div>
      </header>

      <div className="mx-auto mt-6 grid max-w-[1360px] gap-6 px-4 @3xl:px-8 @5xl:grid-cols-[minmax(0,1fr)_21rem] @5xl:gap-8">
        <section aria-label="Service map" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <fieldset className="m-0 flex border-0 p-0">
              <legend className="mk-sr-only">Layout</legend>
              {(['3d', '2d'] as const).map((m) => (
                <label key={m} className={styles.seg}>
                  <input type="radio" className="mk-sr-only" name={`${uid}mode`} checked={mode === m} onChange={() => setMode(m)} />
                  <span>{m === '3d' ? '3D layout' : '2D layout'}</span>
                </label>
              ))}
            </fieldset>
            <label className="flex min-w-0 flex-1 basis-48 items-center">
              <span className="mk-sr-only">Search services</span>
              <input
                type="search" value={query} placeholder="Search services, teams…" className={styles.search}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && rows[0]) { e.preventDefault(); setSelected(rows[0].index); } }}
              />
            </label>
            <button type="button" className={styles.btn} onClick={() => { setSelected(null); atlas.current?.resetView(); }}>Reset view</button>
          </div>

          <div className={styles.stage} data-mode={mode}>
            <StudioCanvas
              label="Service dependency map (sample data)"
              description={`${shownCount} services shown as shapes grouped by cluster, with curved links for calls. ${node ? `Selected: ${describe(node)}.` : 'Nothing selected.'} The table below lists the same data.`}
              flat
              camera={{ fov: 40, near: 0.1, far: 200, position: [9.5, 7.5, 15.5] }}
              style={{ position: 'absolute', inset: 0 }}
              onPointerMissed={() => setSelected(null)}
              fallback={<div className="absolute inset-0 p-3 text-ink"><FlatMap theme={theme} visible={visible} selected={selected} matches={matches} /></div>}
            >
              <Atlas ref={atlas} mode={mode} theme={theme} visible={visible} selected={selected} hovered={hovered} matches={matches} labels={labels} onHover={setHovered} onSelect={selectFromScene} />
            </StudioCanvas>
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              {CLUSTERS.filter((c) => visible.has(c.id)).map((c) => (
                <span key={c.id} ref={labelRef(`c:${c.id}`)} className={styles.clusterLabel} style={{ color: PALETTE[theme][c.id] }}>{c.name}</span>
              ))}
              {labelNodes.map((i) => (
                <span key={i} ref={labelRef(`n:${i}`)} className={`${styles.nodeLabel} ${i === selected ? styles.nodeLabelOn : ''}`}>{NODES[i].id}</span>
              ))}
            </div>
            <p className="mk-label pointer-events-none absolute bottom-2 left-3 m-0 text-muted">Sample data · {mode === '3d' ? '3D force layout' : 'planar layout'}</p>
          </div>
          <p className="mt-2 text-[13px] leading-snug text-muted">
            Drag to orbit, Shift-drag or right-drag to pan, scroll after clicking the map to zoom. With the map focused: arrow keys rotate, Shift+arrows pan, + / − zoom. Every service is also a row in the table.
          </p>
        </section>

        <aside className="grid min-w-0 content-start gap-6" aria-label="Details and filters">
          <section aria-labelledby={`${uid}detail`} className={`${styles.detail} rounded-[10px] border border-line-strong bg-surface p-4`} data-detail="">
            <h3 id={`${uid}detail`} className="mk-label m-0 text-muted">{node ? 'Selected service' : hoverNode ? 'Pointing at' : 'Selected service'}</h3>
            {node || hoverNode ? (() => {
              const n = (node ?? hoverNode)!;
              return (
                <div aria-live="polite" className={styles.detailBody}>
                  <p className="m-0 mt-2 flex items-center gap-2 font-display text-[1.45rem] font-bold tracking-[-0.03em]"><KindGlyph kind={n.kind} color={PALETTE[theme][n.cluster]} />{n.id}</p>
                  <p className="m-0 mt-1 text-[13.5px] leading-snug text-muted">{n.role}</p>
                  <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 border-t border-line text-[13px]">
                    {[['Cluster', clusterName(n.cluster)], ['Type', KINDS[n.kind].label], ['Team', n.team], ['Tier', String(n.tier)], ['Calls / min', formatRpm(n.rpm)], ['p95', `${n.p95} ms`], ['Errors', `${n.errors.toFixed(2)} %`], ['Links', `${n.out.length} out · ${n.in.length} in`]].map(([k, v]) => (
                      <div key={k} className="border-b border-line py-1.5"><dt className="text-muted">{k}</dt><dd className="m-0 font-mono text-[12.5px] tabular-nums">{v}</dd></div>
                    ))}
                  </dl>
                  {node ? (
                    <div className={`${styles.detailLists} mt-3 grid content-start gap-3`}>
                      {([['Depends on', node.out], ['Called by', node.in]] as const).map(([title, list]) => (
                        <div key={title}>
                          <p className="mk-label m-0 mb-1.5 text-muted">{title} ({list.length})</p>
                          {list.length ? (
                            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                              {list.map((i) => (
                                <li key={i}><button type="button" className={styles.pill} onClick={() => setSelected(i)} disabled={!visible.has(NODES[i].cluster)}>{NODES[i].id}</button></li>
                              ))}
                            </ul>
                          ) : <p className="m-0 text-[13px] text-muted">Nothing.</p>}
                        </div>
                      ))}
                      <button type="button" className={`${styles.btn} justify-self-start`} onClick={() => setSelected(null)}>Clear selection</button>
                    </div>
                  ) : null}
                </div>
              );
            })() : (
              <div className="mt-2 grid gap-3">
                <p className="m-0 text-[13.5px] leading-snug text-muted">Nothing selected. Click a shape, or choose a service in the table.</p>
                <dl className="m-0 grid grid-cols-3 gap-2 border-t border-line pt-3">
                  {([['Services', NODES.length], ['Links', EDGES_LIST.length], ['Clusters', CLUSTERS.length]] as const).map(([k, v]) => (
                    <div key={k}><dt className="mk-label text-muted">{k}</dt><dd className="m-0 mt-1 font-display text-[1.6rem] font-bold leading-none tabular-nums">{v}</dd></div>
                  ))}
                </dl>
                <div>
                  <p className="mk-label m-0 mb-1.5 text-muted">Busiest, by calls / min (sample)</p>
                  <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                    {busiest.map((n) => <li key={n.id}><button type="button" className={styles.pill} onClick={() => setSelected(n.index)}>{n.id}</button></li>)}
                  </ul>
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby={`${uid}filters`}>
            <h3 id={`${uid}filters`} className="mk-label m-0 mb-2 text-muted">Clusters</h3>
            <ul className="m-0 grid list-none gap-1 p-0">
              {CLUSTERS.map((c) => {
                const count = NODES.filter((n) => n.cluster === c.id).length;
                return (
                  <li key={c.id}>
                    <label className={styles.filter}>
                      <input type="checkbox" checked={visible.has(c.id)} onChange={() => toggleCluster(c.id)} disabled={visible.has(c.id) && visible.size === 1} />
                      <span aria-hidden="true" className={styles.dot} style={{ background: PALETTE[theme][c.id] }} />
                      <span className="flex-1">{c.name}<span className="ml-1.5 text-[12.5px] text-muted">{c.team} team</span></span>
                      <span className="font-mono text-[12px] text-muted">{count}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="mk-label m-0 mb-2 mt-4 text-muted">Shapes</p>
            <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1.5 p-0 text-[13px]">
              {(Object.keys(KINDS) as NodeKind[]).map((k) => <li key={k} className="flex items-center gap-2"><KindGlyph kind={k} />{KINDS[k].plural}</li>)}
            </ul>
            <p className="m-0 mt-3 text-[12.5px] leading-snug text-muted">Size follows calls per minute. A link fades from the caller to the service it depends on; selecting a service sends two pulses along its links in that direction. Link thickness and pulse speed carry no data.</p>
          </section>

          <section aria-labelledby={`${uid}why`} className="border-t border-line-strong pt-3">
            <h3 id={`${uid}why`} className="m-0 font-display text-[1.05rem] font-semibold">When is 2D the more accurate view?</h3>
            <p className="m-0 mt-2 text-[13.5px] leading-relaxed text-muted">
              Whenever you compare. Perspective shrinks distant shapes and shortens lines that point at you, and nodes can hide behind each other — so sizes, distances and counts read wrong from most angles. The 2D layout puts every node on one plane, facing you: nothing overlaps and equal sizes look equal. Use 3D to see the neighbourhoods as places; use 2D (or the table) to measure.
            </p>
          </section>
        </aside>
      </div>

      <section aria-labelledby={`${uid}table`} className="mx-auto mt-10 max-w-[1360px] px-4 @3xl:px-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 border-t border-line-strong pt-3">
          <h3 id={`${uid}table`} className="m-0 font-display text-[1.2rem] font-semibold">All services</h3>
          <p className="m-0 text-[13px] text-muted" aria-live="polite">{rows.length} of {NODES.length} shown{q ? ` matching “${query.trim()}”` : ''} · sample data</p>
        </div>
        <div ref={tableBox} className={styles.tableBox} tabIndex={0} role="region" aria-labelledby={`${uid}table`}>
          <table className={styles.table}>
            <caption className="mk-sr-only">Sample services with cluster, type, simulated traffic, latency, errors and number of links. Sortable by column.</caption>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={c.numeric ? styles.num : undefined}>
                    <button type="button" className={styles.sortBtn} onClick={() => sortBy(c.key)}>
                      {c.label}<span aria-hidden="true" className={styles.sortMark}>{sort.key === c.key ? (sort.dir === 1 ? '↑' : '↓') : '↕'}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id} data-row={n.index} data-selected={n.index === selected || undefined} data-hovered={n.index === hovered || undefined}
                  onMouseEnter={() => setHovered(n.index)} onMouseLeave={() => setHovered((h) => (h === n.index ? null : h))}>
                  <th scope="row">
                    <button type="button" className={styles.rowBtn} aria-pressed={n.index === selected}
                      onClick={() => setSelected((s) => (s === n.index ? null : n.index))}
                      onFocus={() => setHovered(n.index)} onBlur={() => setHovered((h) => (h === n.index ? null : h))}>
                      <KindGlyph kind={n.kind} color={PALETTE[theme][n.cluster]} />{n.id}
                    </button>
                  </th>
                  <td>{clusterName(n.cluster)}</td>
                  <td>{KINDS[n.kind].label}</td>
                  <td className={styles.num}>{formatRpm(n.rpm)}</td>
                  <td className={styles.num}>{n.p95}</td>
                  <td className={styles.num}>{n.errors.toFixed(2)}</td>
                  <td className={styles.num}>{degree(n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-3 text-[12.5px] text-muted">
          Renderer, last frame: {diag ? `${formatCount(diag.renderer.calls)} draw calls (one per node shape, one for all links, one for the contact shadows, one for the selection ring when shown), ${formatCount(diag.renderer.triangles)} triangles, ${formatCount(diag.frames)} frames drawn on demand` : 'not running (static map or table only)'}.
        </p>
      </section>
    </div>
  );
}
