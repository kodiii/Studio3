'use client';
import { Suspense, lazy, useCallback, useEffect, useId, useMemo, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { spring as SPRING, springToLinear, useStudioMotion } from '../../../motion';
import { CameraRig, ModelBoundary, StudioCanvas, detectCapabilities, formatCount, useCanvasDiagnostics, type CameraPose, type CameraRigHandle } from '../../../three';
import type { WorldHandle, WorldStatus } from './World';
import { Lights, Table } from './Table';
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
  table: { label: 'Table', position: [6.1, 5.2, 7.7], target: [0, 0.15, 0] },
  side: { label: 'Side', position: [0, 1.6, 10.2], target: [0, 0.6, 0] },
  top: { label: 'Top', position: [0.01, 12.4, 0.8], target: [0, 0, 0] },
};
const INITIAL_MAX_ID = Math.max(...initialBodies().map((b) => b.id));
const describe = (b: BodySpec) => `${SHAPES[b.shape].name} ${b.id}`;
const hexOf = (b: BodySpec) => COLOURS.find((c) => c.id === b.colour)?.hex ?? '#c99e68';

/* ── Keycaps (the press-depth-button technique, adapted): a face on a side band over a two-layer shadow ───────── */
type KeyTone = 'paper' | 'ink' | 'signal';
function Key({ tone = 'paper', size = 'm', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: KeyTone; size?: 's' | 'm' | 'l' }) {
  return (
    <button type="button" className={`${styles.key} ${className ?? ''}`} data-tone={tone} data-size={size} {...rest}>
      <span className={styles.keyShadow} aria-hidden="true" />
      <span className={styles.keySide} aria-hidden="true" />
      <span className={styles.keyFace}>{children}</span>
    </button>
  );
}
function KeyRadio({ name, checked, onChange, children, size = 'm' }: { name: string; checked: boolean; onChange: () => void; children: ReactNode; size?: 's' | 'm' | 'l' }) {
  return (
    <label className={styles.key} data-tone="paper" data-size={size} data-latch="">
      <input type="radio" className="mk-sr-only" name={name} checked={checked} onChange={onChange} />
      <span className={styles.keyShadow} aria-hidden="true" />
      <span className={styles.keySide} aria-hidden="true" />
      <span className={styles.keyFace}>{children}</span>
    </label>
  );
}

/** Little drawings of the pieces, lit from the upper left like everything else on the page. */
function ShapeGlyph({ shape }: { shape: ShapeId }) {
  const top = '#e2c08e', front = '#c99e68', side = '#a57b4b', line = 'rgb(60 36 14 / 0.35)';
  return (
    <svg viewBox="0 0 40 28" width="40" height="28" aria-hidden="true" className={styles.glyph}>
      {shape === 'ball' ? (
        <>
          <ellipse cx="22" cy="25" rx="10" ry="2.2" fill="rgb(40 24 8 / 0.18)" />
          <circle cx="20" cy="14" r="10" fill="url(#mk-pp-ball)" />
          <defs><radialGradient id="mk-pp-ball" cx="0.36" cy="0.32" r="0.75"><stop offset="0" stopColor="#f0d3a6" /><stop offset="0.55" stopColor={front} /><stop offset="1" stopColor="#8a6238" /></radialGradient></defs>
        </>
      ) : shape === 'pillar' ? (
        <>
          <ellipse cx="22" cy="25.5" rx="8" ry="2" fill="rgb(40 24 8 / 0.18)" />
          <path d="M13 6v17a7 2.6 0 0 0 14 0V6z" fill={front} />
          <path d="M20 6v19.6a7 2.6 0 0 0 7-2.6V6z" fill={side} />
          <ellipse cx="20" cy="6" rx="7" ry="2.6" fill={top} stroke={line} strokeWidth="0.6" />
        </>
      ) : (
        (() => {
          const [w, h] = shape === 'plank' ? [30, 5] : shape === 'block' ? [22, 9] : [14, 13];
          const x = 20 - w / 2 - 2, y = 26 - h - 1, dx = 5, dy = 4;
          return (
            <>
              <ellipse cx={22} cy={25.5} rx={w / 2 + 3} ry="2" fill="rgb(40 24 8 / 0.18)" />
              <path d={`M${x} ${y}h${w}v${h}h${-w}z`} fill={front} stroke={line} strokeWidth="0.6" />
              <path d={`M${x} ${y}l${dx} ${-dy}h${w}l${-dx} ${dy}z`} fill={top} stroke={line} strokeWidth="0.6" />
              <path d={`M${x + w} ${y}l${dx} ${-dy}v${h}l${-dx} ${dy}z`} fill={side} stroke={line} strokeWidth="0.6" />
            </>
          );
        })()
      )}
    </svg>
  );
}

/** No-WebGL still: the starting arrangement drawn on the plank table, lit from the upper left. */
function TableStill() {
  const block = (x: number, y: number, w: number, h: number, c: string, key: string) => (
    <g key={key}>
      <path d={`M${x} ${y}h${w}v${h}h${-w}z`} fill={c} />
      <path d={`M${x} ${y}l6 -5h${w}l-6 5z`} fill={c} style={{ filter: 'brightness(1.25)' }} />
      <path d={`M${x + w} ${y}l6 -5v${h}l-6 5z`} fill={c} style={{ filter: 'brightness(0.72)' }} />
    </g>
  );
  return (
    <svg viewBox="0 0 420 240" className="h-auto w-[min(92%,28rem)]" aria-hidden="true">
      <defs>
        <linearGradient id="mk-pp-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9b582" /><stop offset="1" stopColor="#b98c59" /></linearGradient>
        <filter id="mk-pp-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <path d="M40 150 L210 198 L380 150 L210 110 Z" fill="url(#mk-pp-top)" />
      {[0.2, 0.4, 0.6, 0.8].map((t) => <path key={t} d={`M${40 + 170 * t} ${150 - 40 * t} L${210 + 170 * t} ${198 - 48 * t}`} stroke="rgb(90 58 28 / 0.28)" strokeWidth="1" />)}
      <path d="M40 150 L210 198 L210 210 L40 162 Z" fill="#8a6440" /><path d="M210 198 L380 150 L380 162 L210 210 Z" fill="#6b4a2f" />
      <path d="M58 166v52h10v-49z M200 206v30h12v-28z M362 166v52h-10v-49z" fill="#5c3f27" />
      <g filter="url(#mk-pp-soft)" fill="rgb(50 30 10 / 0.3)">
        <path d="M104 146h56l12 6h-56z" /><path d="M200 138h80l10 6h-80z" /><circle cx="186" cy="172" r="11" /><circle cx="318" cy="150" r="11" /><path d="M284 168h24l8 5h-24z" />
      </g>
      {block(96, 124, 44, 16, '#b5452f', 'a')}{block(104, 108, 28, 16, '#d39b2a', 'b')}{block(96, 92, 44, 16, '#3d5b8c', 'c')}{block(106, 72, 22, 20, '#6d8d5c', 'd')}
      {block(196, 102, 12, 36, '#e3d5b8', 'e')}{block(252, 102, 12, 36, '#e3d5b8', 'f')}{block(190, 94, 80, 8, '#b5452f', 'g')}
      <circle cx="178" cy="164" r="11" fill="#3d5b8c" /><circle cx="174" cy="160" r="3.5" fill="#fff" opacity="0.35" />
      <circle cx="310" cy="142" r="11" fill="#6d8d5c" /><circle cx="306" cy="138" r="3.5" fill="#fff" opacity="0.35" />
      {block(276, 152, 20, 18, '#d39b2a', 'h')}
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
  const [introPlaying, setIntroPlaying] = useState(false);
  const nextId = useRef(INITIAL_MAX_ID);
  const world = useRef<WorldHandle>(null);
  const rig = useRef<CameraRigHandle>(null);
  const diag = useCanvasDiagnostics(500);
  // Keys release on a real spring (motion tokens), sampled once into a CSS linear() curve.
  const release = useMemo(() => springToLinear(SPRING.pop), []);

  useEffect(() => { setWebgl(detectCapabilities().webgl); }, []);
  // Reduced motion: the simulation never starts by itself — the "Run simulation" button starts it.
  useEffect(() => { if (reduced) setPaused(true); }, [reduced]);

  const gravity = useMemo(() => GRAVITY[gravityDir].v.map((c) => c * 9.81 * strength) as [number, number, number], [gravityDir, strength]);
  const onReady = useCallback(() => setEngine('ready'), []);
  const onStatus = useCallback((s: WorldStatus) => setStatus(s), []);
  const onIntro = useCallback((p: boolean) => setIntroPlaying(p), []);
  const onRemove = useCallback((ids: number[]) => {
    setBodies((list) => {
      const gone = list.filter((b) => ids.includes(b.id));
      if (gone.length) setMessage(`${gone.map(describe).join(', ')} fell off the table and ${gone.length > 1 ? 'were' : 'was'} removed.`);
      return gone.length ? list.filter((b) => !ids.includes(b.id)) : list;
    });
    setSelected((s) => (s != null && ids.includes(s) ? null : s));
  }, []);

  const add = () => {
    world.current?.skipIntro();
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
  const reset = () => { nextId.current = INITIAL_MAX_ID; setBodies(initialBodies()); setSelected(null); setGeneration((g) => g + 1); setMessage(reduced ? 'Table reset.' : 'Table reset: the blocks drop back in.'); };

  const live = webgl === true;
  const ready = live && engine === 'ready';
  const sel = bodies.find((b) => b.id === selected) ?? null;
  const selState = sel ? status?.states[sel.id] : undefined;
  const loopState = !status ? '—' : paused ? 'idle — simulation paused' : status.awake > 0 ? `running — ${status.awake} of ${status.total} bodies awake` : `idle — all ${status.total} bodies asleep, no frames being drawn`;
  const rootStyle = { '--release-ease': release.easing, '--release-dur': `${release.duration}ms` } as CSSProperties;

  return (
    <div className={`${styles.root} bg-bg pb-20 text-ink`} style={rootStyle} data-reduced={reduced || undefined}>
      <header className="mx-auto grid max-w-[1360px] gap-4 px-4 pt-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] @3xl:items-end @3xl:px-8 @3xl:pt-10">
        <div>
          <p className="mk-label m-0 text-muted">Blockwerk · play table (fictional)</p>
          <h2 className="mk-display m-0 mt-3 text-[clamp(2.6rem,8.4cqi,5.6rem)]">Stack it. <span className="font-serif font-normal italic tracking-[-0.02em]">Knock it down.</span></h2>
        </div>
        <p className="m-0 max-w-[44ch] text-[15px] leading-relaxed text-muted">
          Lacquered wooden blocks on a plank table, simulated with Rapier. Pick one up, flick it to throw, build a bridge, tilt the world. Everything you can do with a pointer you can also do from the body list.
        </p>
      </header>

      <div className="mx-auto mt-6 grid max-w-[1360px] gap-6 px-4 @3xl:px-8 @5xl:grid-cols-[minmax(0,1fr)_23rem] @5xl:gap-8">
        <section aria-label="Play table" className="min-w-0">
          <div className={styles.stage}>
            <StudioCanvas
              label="Play table with wooden blocks"
              description={`A plank table holding ${bodies.length} lacquered wooden toys: ${SHAPE_ORDER.map((s) => `${bodies.filter((b) => b.shape === s).length} ${SHAPES[s].plural.toLowerCase()}`).join(', ')}. ${sel ? `Selected: ${describe(sel)}.` : ''}`}
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
              <Table />
              <CameraRig ref={rig} presets={VIEWS} preset={view} referenceAspect={1.35} />
              <ModelBoundary resetKey={attempt} onError={() => setEngine('error')}>
                <Suspense fallback={null}>
                  <World
                    key={generation} ref={world} bodies={bodies} paused={paused} gravity={gravity} selected={selected} intro={!reduced} reduced={reduced}
                    onSelect={setSelected} onRemove={onRemove} onStatus={onStatus} onReady={onReady} onIntro={onIntro}
                  />
                </Suspense>
              </ModelBoundary>
            </StudioCanvas>

            {live && engine === 'loading' ? (
              <div className={`${styles.card} absolute left-3 top-3 w-60 p-2.5`} role="status">
                <p className="m-0 text-[13px]">Loading the physics engine…</p>
                <p className="m-0 mt-0.5 text-[12px] text-muted">Rapier (WebAssembly), fetched on demand</p>
                <progress className={`${styles.progress} mt-2`} aria-label="Loading the physics engine" />
              </div>
            ) : null}
            {live && engine === 'error' ? (
              <div className={`${styles.card} absolute inset-x-3 top-3 p-3`} role="alert">
                <p className="m-0 text-[13.5px] font-medium">The physics engine could not be loaded.</p>
                <p className="m-0 mt-1 text-[12.5px] text-muted">The table is still drawn, but nothing can move. Check the connection and try again.</p>
                <Key size="s" className="mt-2" onClick={() => { setEngine('loading'); setAttempt((a) => a + 1); }}>Try again</Key>
              </div>
            ) : null}
            {ready && paused ? (
              <div className="absolute inset-0 grid place-items-center">
                <Key tone="ink" size="l" onClick={() => setPaused(false)}>
                  <span className="grid gap-0.5 text-center">
                    <span>Run simulation</span>
                    <span className="text-[12px] font-normal opacity-80">{reduced ? 'Paused because reduced motion is on' : 'Paused'}</span>
                  </span>
                </Key>
              </div>
            ) : null}
            {ready && introPlaying ? (
              <div className="absolute bottom-2.5 right-3"><Key size="s" onClick={() => world.current?.skipIntro()}>Skip intro</Key></div>
            ) : null}
            {ready ? <p className={`mk-label pointer-events-none absolute bottom-2.5 left-3 m-0 ${styles.stageLabel}`}>{bodies.length} / {MAX_BODIES} bodies · {status && status.awake === 0 ? 'all asleep' : `${status?.awake ?? 0} awake`}</p> : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <fieldset className="m-0 flex gap-1.5 border-0 p-0" disabled={!live}>
              <legend className="mk-sr-only">Camera view</legend>
              {Object.entries(VIEWS).map(([k, v]) => (
                <KeyRadio key={k} size="s" name={`${uid}view`} checked={view === k} onChange={() => setView(k)}>{v.label}</KeyRadio>
              ))}
            </fieldset>
            <p className="m-0 text-[12.5px] text-muted" aria-live="polite">{message}</p>
          </div>
          <p className="mt-2 text-[13px] leading-snug text-muted">Point at a block to see it lift; drag to pick it up, and let go while moving to throw it. Click empty space to deselect. Keyboard: choose a body in the list, then nudge, lift and drop it.</p>
        </section>

        <form className={styles.panel} aria-label="Play table controls" onSubmit={(e) => e.preventDefault()}>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mk-label mb-2.5 text-muted">Toy box</legend>
            <div className="grid grid-cols-3 gap-x-2 gap-y-2.5 @md:grid-cols-5 @5xl:grid-cols-3">
              {SHAPE_ORDER.map((s) => (
                <KeyRadio key={s} name={`${uid}shape`} checked={shape === s} onChange={() => setShape(s)}>
                  <span className="grid justify-items-center gap-0.5 py-1.5"><ShapeGlyph shape={s} /><span>{SHAPES[s].name}</span></span>
                </KeyRadio>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Key tone="signal" className="whitespace-nowrap" onClick={add} disabled={!ready}>Add {SHAPES[shape].name.toLowerCase()}</Key>
              <span className="text-[12.5px] leading-snug text-muted">{SHAPES[shape].note} At {MAX_BODIES}, the oldest is recycled.</span>
            </div>
          </fieldset>

          <fieldset className="m-0 border-0 border-t border-line p-0 pt-4" disabled={!ready}>
            <legend className="mk-label float-left mb-2.5 w-full text-muted">Gravity</legend>
            <div className="clear-both grid grid-cols-2 gap-x-2 gap-y-2.5">
              {(Object.keys(GRAVITY) as GravityDir[]).map((g) => (
                <KeyRadio key={g} size="s" name={`${uid}g`} checked={gravityDir === g} onChange={() => setGravityDir(g)}>{GRAVITY[g].label}</KeyRadio>
              ))}
            </div>
            <label className="mt-3 grid gap-1 text-[13px]">
              <span className="flex justify-between"><span>Strength</span><span className="font-mono text-[12px] text-muted">{(9.81 * strength).toFixed(1)} m/s²</span></span>
              <input type="range" className={styles.range} min={25} max={200} step={5} value={Math.round(strength * 100)} onChange={(e) => setStrength(Number(e.target.value) / 100)} aria-valuetext={`${(9.81 * strength).toFixed(1)} metres per second squared`} />
            </label>
          </fieldset>

          <div className="flex flex-wrap gap-2.5 border-t border-line pt-4">
            <Key tone="ink" onClick={() => setPaused((p) => !p)} disabled={!ready}>{paused ? 'Run simulation' : 'Pause'}</Key>
            <Key onClick={reset} disabled={!live}>Reset table</Key>
          </div>

          <fieldset className="m-0 border-0 border-t border-line p-0 pt-4" disabled={!ready}>
            <legend className="mk-label float-left mb-2 w-full text-muted">Bodies ({bodies.length})</legend>
            <div className={`${styles.list} clear-both`}>
              {bodies.map((b) => (
                <label key={b.id} className={styles.item}>
                  <input type="radio" className="mk-sr-only" name={`${uid}body`} checked={selected === b.id} onChange={() => setSelected(b.id)} />
                  <span aria-hidden="true" className={styles.chip} style={{ background: hexOf(b) }} />
                  <span className="flex-1">{describe(b)} <span className="text-muted">· {b.colour}</span></span>
                  <span className="font-mono text-[11.5px] text-muted">{status?.states[b.id] ?? '—'}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label={sel ? `Move ${describe(sel)}` : 'Move the selected body'}>
              {([['left', '←', 'Nudge left'], ['away', '↑', 'Nudge away'], ['toward', '↓', 'Nudge toward'], ['right', '→', 'Nudge right']] as const).map(([d, glyph, label]) => (
                <Key key={d} size="s" aria-label={label} title={label} disabled={!sel || paused} onClick={() => sel && world.current?.nudge(sel.id, d)}>
                  <span aria-hidden="true">{glyph}</span>
                </Key>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Key size="s" disabled={!sel || paused} onClick={() => { if (!sel) return; if (selState === 'held') world.current?.drop(sel.id); else world.current?.lift(sel.id); }}>
                {selState === 'held' ? 'Drop' : 'Lift'}
              </Key>
              <Key size="s" disabled={!sel} onClick={() => { if (!sel) return; setBodies((l) => l.filter((b) => b.id !== sel.id)); setMessage(`Removed ${describe(sel)}.`); setSelected(null); }}>Remove</Key>
            </div>
            <p className="m-0 mt-2 text-[12.5px] leading-snug text-muted">{sel ? `${describe(sel)} is ${selState ?? 'loading'}.${paused ? ' Run the simulation to move it.' : ''}` : 'Choose a body to move it from the keyboard.'}</p>
          </fieldset>

          <section className="border-t border-line pt-4" aria-label="Render loop">
            <p className="mk-label m-0 text-muted">Render loop</p>
            <p className="m-0 mt-1.5 text-[13.5px]" data-loop-state={status ? (paused || status.awake === 0 ? 'idle' : 'running') : 'unknown'}>{loopState}</p>
            <p className="m-0 mt-1 font-mono text-[12px] text-muted">
              {ready && diag ? `${formatCount(diag.frames)} frames drawn · ${formatCount(diag.renderer.calls)} draw calls · ${formatCount(diag.renderer.triangles)} triangles` : '—'}
            </p>
            <p className="m-0 mt-1.5 text-[12px] leading-snug text-muted">The canvas renders on demand: Rapier requests a frame only while a body is awake, and the springs only while they move, so once everything sleeps the frame counter stops.</p>
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
            <li>something should spring, ease, bounce or follow a path — that is a damped spring or a curve, not a solver. Here the drop-in, the landing squash and the hover lift are springs on the meshes; the solver never sees them;</li>
            <li>the motion is decorative or must look the same every time;</li>
            <li>the budget cannot afford a WebAssembly download, a fixed-step loop and body limits. Here the engine is a separate chunk, loaded only when the table is on screen.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
