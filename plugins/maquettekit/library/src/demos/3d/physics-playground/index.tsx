'use client';
import { Suspense, lazy, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useStudioMotion } from '../../../motion';
import { CameraRig, ModelBoundary, StudioCanvas, detectCapabilities, formatCount, useCanvasDiagnostics, useQuality, type CameraPose, type CameraRigHandle } from '../../../three';
import type { WorldHandle, WorldStatus } from './World';
import { COLOURS, MAX_BODIES, SHAPES, SHAPE_ORDER, initialBodies, spawnPoint, type BodySpec, type ShapeId } from './bodies';
import styles from './styles.module.css';

// The physics chunk (Rapier + its WebAssembly) is only fetched once the canvas actually starts.
const World = lazy(() => import('./World'));

type GravityDir = 'down' | 'left' | 'right' | 'zero';
const GRAVITY: Record<GravityDir, { label: string; v: [number, number, number] }> = {
  down: { label: 'Down', v: [0, -1, 0] },
  left: { label: 'Tilt left', v: [-0.5, -0.866, 0] },
  right: { label: 'Tilt right', v: [0.5, -0.866, 0] },
  zero: { label: 'Zero-g', v: [0, 0, 0] },
};
const VIEWS: Record<string, CameraPose & { label: string }> = {
  table: { label: 'Table', position: [6.3, 5.5, 7.9], target: [0, 0.2, 0] },
  side: { label: 'Side', position: [0, 1.6, 10.2], target: [0, 0.6, 0] },
  top: { label: 'Top', position: [0.01, 12.4, 0.8], target: [0, 0, 0] },
};
const INITIAL_MAX_ID = Math.max(...initialBodies().map((b) => b.id));
const describe = (b: BodySpec) => `${SHAPES[b.shape].name} ${b.id}`;

function Lights() {
  const { shadows, shadowMapSize } = useQuality();
  return (
    <>
      <hemisphereLight args={['#fff8ee', '#7d6f5c', 1.05]} />
      <directionalLight
        position={[4, 8.5, 5]} intensity={2.3} color="#fff4e6" castShadow={shadows}
        shadow-mapSize={[shadowMapSize, shadowMapSize]} shadow-bias={-0.0005} shadow-normalBias={0.02}
        shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-camera-near={1} shadow-camera-far={25}
      />
      <directionalLight position={[-5, 3, -4]} intensity={0.55} color="#dfe6ff" />
    </>
  );
}

/** No-WebGL still: the starting arrangement drawn flat. */
function TableStill() {
  return (
    <svg viewBox="0 0 400 220" className="h-auto w-[min(92%,26rem)]" aria-hidden="true">
      <path d="M40 150 L200 196 L360 150 L200 112 Z" fill="#cdb48a" />
      <path d="M40 150 L200 196 L200 206 L40 160 Z M200 196 L360 150 L360 160 L200 206 Z" fill="#8d7350" />
      <g><rect x="92" y="122" width="44" height="18" fill="#b5452f" /><rect x="102" y="104" width="24" height="18" fill="#d39b2a" /><rect x="92" y="86" width="44" height="18" fill="#3d5b8c" /><rect x="102" y="64" width="22" height="22" fill="#6d8d5c" /></g>
      <g><rect x="190" y="96" width="14" height="40" fill="#e3d5b8" stroke="#8d7350" strokeWidth="1" /><rect x="244" y="96" width="14" height="40" fill="#e3d5b8" stroke="#8d7350" strokeWidth="1" /><rect x="182" y="88" width="84" height="8" fill="#b5452f" /></g>
      <circle cx="160" cy="160" r="11" fill="#3d5b8c" /><circle cx="300" cy="140" r="11" fill="#6d8d5c" /><rect x="268" y="150" width="20" height="20" fill="#d39b2a" />
    </svg>
  );
}

export default function PhysicsPlayground() {
  const uid = useId();
  const { reduced } = useStudioMotion();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [bodies, setBodies] = useState<BodySpec[]>(initialBodies);
  const [selected, setSelected] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [gravityDir, setGravityDir] = useState<GravityDir>('down');
  const [strength, setStrength] = useState(1);
  const [shape, setShape] = useState<ShapeId>('block');
  const [status, setStatus] = useState<WorldStatus | null>(null);
  const [engine, setEngine] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [view, setView] = useState('table');
  const [message, setMessage] = useState('');
  const nextId = useRef(INITIAL_MAX_ID);
  const world = useRef<WorldHandle>(null);
  const rig = useRef<CameraRigHandle>(null);
  const diag = useCanvasDiagnostics(500);

  useEffect(() => { setWebgl(detectCapabilities().webgl); }, []);
  // Reduced motion: the simulation never starts by itself — the "Run simulation" button starts it.
  useEffect(() => { if (reduced) setPaused(true); }, [reduced]);

  const gravity = useMemo(() => GRAVITY[gravityDir].v.map((c) => c * 9.81 * strength) as [number, number, number], [gravityDir, strength]);
  const onReady = useCallback(() => setEngine('ready'), []);
  const onStatus = useCallback((s: WorldStatus) => setStatus(s), []);
  const onRemove = useCallback((ids: number[]) => {
    setBodies((list) => {
      const gone = list.filter((b) => ids.includes(b.id));
      if (gone.length) setMessage(`${gone.map(describe).join(', ')} fell off the table and ${gone.length > 1 ? 'were' : 'was'} removed.`);
      return gone.length ? list.filter((b) => !ids.includes(b.id)) : list;
    });
    setSelected((s) => (s != null && ids.includes(s) ? null : s));
  }, []);

  const add = () => {
    const id = ++nextId.current;
    const spec: BodySpec = { id, shape, colour: COLOURS[id % COLOURS.length].id, position: spawnPoint(id), yaw: (id * 0.7) % Math.PI };
    setBodies((list) => {
      const next = [...list, spec];
      if (next.length <= MAX_BODIES) { setMessage(`Added ${describe(spec)}.`); return next; }
      const dropped = next.slice(0, next.length - MAX_BODIES);
      setMessage(`Added ${describe(spec)}. ${MAX_BODIES} is the limit, so the oldest, ${dropped.map(describe).join(', ')}, was recycled.`);
      setSelected((s) => (s != null && dropped.some((d) => d.id === s) ? null : s));
      return next.slice(-MAX_BODIES);
    });
  };
  const reset = () => { nextId.current = INITIAL_MAX_ID; setBodies(initialBodies()); setSelected(null); setGeneration((g) => g + 1); setEngine('loading'); setMessage('Table reset.'); };

  const live = webgl === true;
  const ready = live && engine === 'ready';
  const sel = bodies.find((b) => b.id === selected) ?? null;
  const selState = sel ? status?.states[sel.id] : undefined;
  const loopState = !status ? '—' : paused ? 'idle — simulation paused' : status.awake > 0 ? `running — ${status.awake} of ${status.total} bodies awake` : `idle — all ${status.total} bodies asleep, no frames being drawn`;

  return (
    <div className={`${styles.root} bg-bg pb-20 text-ink`}>
      <header className="mx-auto grid max-w-[1360px] gap-4 px-4 pt-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] @3xl:items-end @3xl:px-8 @3xl:pt-10">
        <div>
          <p className="mk-label m-0 text-muted">Blockwerk · play table (fictional)</p>
          <h2 className="mk-display m-0 mt-3 text-[clamp(2.6rem,8.4cqi,5.6rem)]">Stack it. <span className="font-serif font-normal italic tracking-[-0.02em]">Knock it down.</span></h2>
        </div>
        <p className="m-0 max-w-[44ch] text-[15px] leading-relaxed text-muted">
          Wooden blocks on a table, simulated with Rapier. Drag one to lift it, flick to throw, build a bridge, tilt the world. Everything you can do with a pointer you can also do from the body list.
        </p>
      </header>

      <div className="mx-auto mt-6 grid max-w-[1360px] gap-6 px-4 @3xl:px-8 @5xl:grid-cols-[minmax(0,1fr)_23rem] @5xl:gap-8">
        <section aria-label="Play table" className="min-w-0">
          <div className={styles.stage}>
            <StudioCanvas
              label="Play table with wooden blocks"
              description={`A wooden table holding ${bodies.length} toy blocks: ${SHAPE_ORDER.map((s) => `${bodies.filter((b) => b.shape === s).length} ${SHAPES[s].plural.toLowerCase()}`).join(', ')}. ${sel ? `Selected: ${describe(sel)}.` : ''}`}
              camera={{ fov: 34, near: 0.1, far: 80, position: VIEWS.table.position }}
              style={{ position: 'absolute', inset: 0 }}
              onPointerMissed={() => setSelected(null)}
              fallback={
                <div className="grid h-full w-full place-items-center content-center gap-3 p-4 text-center">
                  <TableStill />
                  <p className="m-0 max-w-[40ch] text-[13.5px] text-ink">The play table needs WebGL, which this browser cannot provide. This drawing shows the starting arrangement.</p>
                </div>
              }
            >
              <Lights />
              <CameraRig ref={rig} presets={VIEWS} preset={view} referenceAspect={1.35} />
              <ModelBoundary resetKey={attempt} onError={() => setEngine('error')}>
                <Suspense fallback={null}>
                  <World
                    key={generation} ref={world} bodies={bodies} paused={paused} gravity={gravity} selected={selected}
                    onSelect={setSelected} onRemove={onRemove} onStatus={onStatus} onReady={onReady}
                  />
                </Suspense>
              </ModelBoundary>
            </StudioCanvas>

            {live && engine === 'loading' ? (
              <div className="absolute left-3 top-3 w-60 rounded-[6px] border border-line bg-surface p-2.5" role="status">
                <p className="m-0 text-[13px]">Loading the physics engine…</p>
                <p className="m-0 mt-0.5 text-[12px] text-muted">Rapier (WebAssembly), fetched on demand</p>
                <progress className={`${styles.progress} mt-2`} aria-label="Loading the physics engine" />
              </div>
            ) : null}
            {live && engine === 'error' ? (
              <div className="absolute inset-x-3 top-3 rounded-[6px] border border-line-strong bg-surface p-3" role="alert">
                <p className="m-0 text-[13.5px] font-medium">The physics engine could not be loaded.</p>
                <p className="m-0 mt-1 text-[12.5px] text-muted">The table is still drawn, but nothing can move. Check the connection and try again.</p>
                <button type="button" className={`${styles.btn} mt-2`} onClick={() => { setEngine('loading'); setAttempt((a) => a + 1); }}>Try again</button>
              </div>
            ) : null}
            {ready && paused ? (
              <div className="absolute inset-0 grid place-items-center">
                <button type="button" className={styles.run} onClick={() => setPaused(false)}>
                  Run simulation
                  <span className="block text-[12px] font-normal">{reduced ? 'Paused because reduced motion is on' : 'Paused'}</span>
                </button>
              </div>
            ) : null}
            {ready ? <p className="mk-label pointer-events-none absolute bottom-2.5 left-3 m-0 text-muted">{bodies.length} / {MAX_BODIES} bodies · {status && status.awake === 0 ? 'all asleep' : `${status?.awake ?? 0} awake`}</p> : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <fieldset className="m-0 flex border-0 p-0" disabled={!live}>
              <legend className="mk-sr-only">Camera view</legend>
              {Object.entries(VIEWS).map(([k, v]) => (
                <label key={k} className={styles.seg}>
                  <input type="radio" className="mk-sr-only" name={`${uid}view`} checked={view === k} onChange={() => setView(k)} />
                  <span>{v.label}</span>
                </label>
              ))}
            </fieldset>
            <p className="m-0 text-[12.5px] text-muted" aria-live="polite">{message}</p>
          </div>
          <p className="mt-2 text-[13px] leading-snug text-muted">Drag a block to pick it up; let go while moving to throw it. Click empty space to deselect. Keyboard: choose a body in the list, then nudge, lift and drop it.</p>
        </section>

        <form className={styles.panel} aria-label="Play table controls" onSubmit={(e) => e.preventDefault()}>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mk-label mb-2 text-muted">Toy box</legend>
            <div className="grid grid-cols-3 gap-1.5 @md:grid-cols-5 @5xl:grid-cols-3">
              {SHAPE_ORDER.map((s) => (
                <label key={s} className={styles.choice}>
                  <input type="radio" className="mk-sr-only" name={`${uid}shape`} checked={shape === s} onChange={() => setShape(s)} />
                  <span>{SHAPES[s].name}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" className={`${styles.btnStrong} whitespace-nowrap`} onClick={add} disabled={!ready}>Add {SHAPES[shape].name.toLowerCase()}</button>
              <span className="text-[12.5px] text-muted">{SHAPES[shape].note} At {MAX_BODIES}, the oldest is recycled.</span>
            </div>
          </fieldset>

          <fieldset className="m-0 border-0 border-t border-line p-0 pt-4" disabled={!ready}>
            <legend className="mk-label float-left mb-2 w-full text-muted">Gravity</legend>
            <div className="clear-both grid grid-cols-2 gap-1.5">
              {(Object.keys(GRAVITY) as GravityDir[]).map((g) => (
                <label key={g} className={styles.choice}>
                  <input type="radio" className="mk-sr-only" name={`${uid}g`} checked={gravityDir === g} onChange={() => setGravityDir(g)} />
                  <span>{GRAVITY[g].label}</span>
                </label>
              ))}
            </div>
            <label className="mt-3 grid gap-1 text-[13px]">
              <span className="flex justify-between"><span>Strength</span><span className="font-mono text-[12px] text-muted">{(9.81 * strength).toFixed(1)} m/s²</span></span>
              <input type="range" className={styles.range} min={25} max={200} step={5} value={Math.round(strength * 100)} onChange={(e) => setStrength(Number(e.target.value) / 100)} aria-valuetext={`${(9.81 * strength).toFixed(1)} metres per second squared`} />
            </label>
          </fieldset>

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <button type="button" className={styles.btnStrong} onClick={() => setPaused((p) => !p)} disabled={!ready}>{paused ? 'Run simulation' : 'Pause'}</button>
            <button type="button" className={styles.btn} onClick={reset} disabled={!live}>Reset table</button>
          </div>

          <fieldset className="m-0 border-0 border-t border-line p-0 pt-4" disabled={!ready}>
            <legend className="mk-label float-left mb-2 w-full text-muted">Bodies ({bodies.length})</legend>
            <div className={`${styles.list} clear-both`}>
              {bodies.map((b) => (
                <label key={b.id} className={styles.item}>
                  <input type="radio" className="mk-sr-only" name={`${uid}body`} checked={selected === b.id} onChange={() => setSelected(b.id)} />
                  <span aria-hidden="true" className={styles.chip} style={{ background: COLOURS.find((c) => c.id === b.colour)?.hex }} />
                  <span className="flex-1">{describe(b)} <span className="text-muted">· {b.colour}</span></span>
                  <span className="font-mono text-[11.5px] text-muted">{status?.states[b.id] ?? '—'}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1.5" role="group" aria-label={sel ? `Move ${describe(sel)}` : 'Move the selected body'}>
              {([['left', '←', 'Nudge left'], ['away', '↑', 'Nudge away'], ['toward', '↓', 'Nudge toward'], ['right', '→', 'Nudge right']] as const).map(([d, glyph, label]) => (
                <button key={d} type="button" className={styles.btn} aria-label={label} title={label} disabled={!sel || paused} onClick={() => sel && world.current?.nudge(sel.id, d)}>
                  <span aria-hidden="true">{glyph}</span>
                </button>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <button type="button" className={styles.btn} disabled={!sel || paused} onClick={() => { if (!sel) return; if (selState === 'held') world.current?.drop(sel.id); else world.current?.lift(sel.id); }}>
                {selState === 'held' ? 'Drop' : 'Lift'}
              </button>
              <button type="button" className={styles.btn} disabled={!sel} onClick={() => { if (!sel) return; setBodies((l) => l.filter((b) => b.id !== sel.id)); setMessage(`Removed ${describe(sel)}.`); setSelected(null); }}>Remove</button>
            </div>
            <p className="m-0 mt-2 text-[12.5px] leading-snug text-muted">{sel ? `${describe(sel)} is ${selState ?? 'loading'}.${paused ? ' Run the simulation to move it.' : ''}` : 'Choose a body to move it from the keyboard.'}</p>
          </fieldset>

          <section className="border-t border-line pt-4" aria-label="Render loop">
            <p className="mk-label m-0 text-muted">Render loop</p>
            <p className="m-0 mt-1.5 text-[13.5px]" data-loop-state={status ? (paused || status.awake === 0 ? 'idle' : 'running') : 'unknown'}>{loopState}</p>
            <p className="m-0 mt-1 font-mono text-[12px] text-muted">
              {ready && diag ? `${formatCount(diag.frames)} frames drawn · ${formatCount(diag.renderer.calls)} draw calls · ${formatCount(diag.renderer.triangles)} triangles` : '—'}
            </p>
            <p className="m-0 mt-1.5 text-[12px] leading-snug text-muted">The canvas renders on demand: Rapier requests a frame only while a body is awake, so once everything sleeps the frame counter stops.</p>
          </section>
        </form>
      </div>

      <section className="mx-auto mt-12 grid max-w-[1360px] gap-6 px-4 @3xl:grid-cols-2 @3xl:px-8" aria-label="When physics is justified">
        <div className="border-t border-line-strong pt-3">
          <h3 className="m-0 font-display text-[1.15rem] font-semibold">Physics earns its place when…</h3>
          <ul className="m-0 mt-2 grid gap-1.5 pl-5 text-[14px] leading-relaxed text-muted">
            <li>the outcome is not scripted: stacking, toppling and collisions are what the visitor came to play with;</li>
            <li>many objects touch each other and you cannot predict the contacts;</li>
            <li>constraints (hinges, ropes, joints) are the content.</li>
          </ul>
        </div>
        <div className="border-t border-line-strong pt-3">
          <h3 className="m-0 font-display text-[1.15rem] font-semibold">Reach for maths instead when…</h3>
          <ul className="m-0 mt-2 grid gap-1.5 pl-5 text-[14px] leading-relaxed text-muted">
            <li>something should spring, ease, bounce or follow a path — that is a damped spring or a curve, not a solver;</li>
            <li>the motion is decorative or must look the same every time;</li>
            <li>the budget cannot afford a WebAssembly download, a fixed-step loop and body limits. Here the engine is a separate chunk, loaded only when the table is on screen.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
