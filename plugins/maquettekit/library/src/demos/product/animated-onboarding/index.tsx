'use client';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { cssEase, duration as D, flip, spring as SPRING, stagger as STAGGER, useRafLoop, useStudioMotion } from '../../../motion';
import { POP, SETTLE, captureSources, liftOff } from './choreo';
import {
  EMPTY, GOALS, INTEGRATIONS, ORDER, PREP_LIST, ROLES, STEPS,
  allowed, clear, hashFor, indexOf, load, save, stepFromHash, validateEmail, validateKitchen,
  type Data, type GoalId, type IntegrationId, type RoleId, type StepId,
} from './data';
import { Check, MorphButton, type MorphPhase } from './MorphButton';
import styles from './styles.module.css';

function RoleIcon({ id }: { id: RoleId }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg className={styles.roleIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {id === 'head-chef' ? <><path {...p} d="M4 20 15.5 8.5l3.5 1-9 9.5Z" /><path {...p} d="m15.5 8.5 3-3.5a1.6 1.6 0 0 1 2.3 2.2L19 9.5" /></> : null}
      {id === 'owner' ? <><circle {...p} cx="8" cy="8" r="4" /><path {...p} d="m11 11 9 9M16.5 16.5l2-2M14 14l2-2" /></> : null}
      {id === 'sous-chef' ? <><path {...p} d="M12 21v-7" /><path {...p} d="M12 14c-3.5 0-5-3.4-5-6.5S9.2 3 12 3s5 1.4 5 4.5-1.5 6.5-5 6.5Z" /><path {...p} d="M12 3c-1.4 1.6-2 3.4-2 5.6S10.6 12.4 12 14c1.4-1.6 2-3.2 2-5.4S13.4 4.6 12 3Z" /></> : null}
      {id === 'manager' ? <><rect {...p} x="5" y="4.5" width="14" height="16.5" rx="2" /><path {...p} d="M9 4.5V3h6v1.5M8.5 10h7M8.5 13.5h7M8.5 17h4" /></> : null}
    </svg>
  );
}

function Bang() {
  return <svg className={styles.errIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="7" /><path d="M8 4.5v4.2M8 11.3v.2" /></svg>;
}

/* ── The ticket hangs from a clip: landings, scroll velocity and a brushing pointer swing it on a spring ─── */
function useSwing(ticket: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const sim = useRef({ x: 0, v: 0 });
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const kick = useCallback((dv: number) => {
    if (!enabled) return;
    sim.current.v = Math.max(-90, Math.min(90, sim.current.v + dv));
    if (!runningRef.current) { runningRef.current = true; setRunning(true); }
  }, [enabled]);
  useRafLoop(ticket, (dt) => {
    const s = sim.current, c = SPRING.release;
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) { s.v += ((-c.stiffness * s.x - c.damping * s.v) / c.mass) * h; s.x += s.v * h; }
    s.x = Math.max(-4, Math.min(4, s.x));
    ticket.current?.style.setProperty('--swing', s.x.toFixed(3));
    if (Math.abs(s.x) < 0.004 && Math.abs(s.v) < 0.02) { s.x = 0; s.v = 0; ticket.current?.style.setProperty('--swing', '0'); runningRef.current = false; setRunning(false); }
  }, running && enabled);
  // Scrolling the page sways the paper a little, in proportion to the scroll speed.
  useEffect(() => {
    if (!enabled) return;
    let last = window.scrollY, t = performance.now();
    const onScroll = () => {
      const now = performance.now(), y = window.scrollY;
      const vel = (y - last) / Math.max(8, now - t);
      last = y; t = now;
      kick(Math.max(-14, Math.min(14, vel * 9)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enabled, kick]);
  return kick;
}

/* ── Ticket on the rail: the running summary every answer flies into ──── */
function Ticket({ data, step, ticketRef, onBrush }: { data: Data; step: StepId; ticketRef: RefObject<HTMLDivElement | null>; onBrush: (dv: number) => void }) {
  const role = ROLES.find((r) => r.id === data.role);
  const goals = data.goals.map((id) => GOALS.find((g) => g.id === id)).filter((g): g is (typeof GOALS)[number] => !!g);
  const connected = INTEGRATIONS.filter((i) => data.connected.includes(i.id));
  const skipped = (s: StepId) => data.skipped.includes(s);
  type Line = { s: StepId; label: string; value: string | null; items?: { key: string; text: string; n?: number }[] };
  const lines: Line[] = [
    { s: 'kitchen', label: 'Kitchen', value: data.kitchen.trim() || null },
    { s: 'role', label: 'Role', value: role?.name ?? (skipped('role') ? 'Skipped' : null) },
    { s: 'goals', label: 'First lists', value: goals.length ? '' : skipped('goals') ? 'Prep lists (default)' : null, items: goals.map((g, i) => ({ key: `goal-${g.id}`, text: g.name, n: i + 1 })) },
    { s: 'connect', label: 'Connected', value: connected.length ? '' : indexOf(step) > indexOf('connect') ? 'Sample data' : null, items: connected.map((i) => ({ key: `int-${i.id}`, text: i.name })) },
    { s: 'brigade', label: 'Brigade', value: data.invited.length ? `${data.invited.length} invited` : skipped('brigade') ? 'Just you for now' : null },
  ];
  const answered = lines.filter((l) => l.s !== step && l.value !== null).length;
  const lastX = useRef<number | null>(null);
  return (
    <aside className={styles.rail} aria-label="Setup ticket">
      <div className={styles.railBar} aria-hidden="true" />
      <div ref={ticketRef} className={styles.ticket}
        onPointerMove={(e) => { if (e.pointerType === 'touch') return; const x = e.clientX; if (lastX.current !== null) onBrush((x - lastX.current) * 0.5); lastX.current = x; }}
        onPointerLeave={() => { lastX.current = null; }}>
        <span className={styles.clip} aria-hidden="true" />
        <p className={styles.ticketHead}><span>Larder · setup</span><span>No. 001</span></p>
        <dl className={styles.ticketLines}>
          {lines.map((l) => {
            const editing = l.s === step;
            const filled = !editing && l.value !== null;
            return (
              <div key={l.s} className={styles.ticketLine} data-state={editing ? 'editing' : filled ? 'filled' : 'empty'}>
                <dt>{l.label}</dt>
                <dd>
                  {editing ? <span className={styles.ticketEditing}>answering now…</span>
                    : !filled ? <span className={styles.ticketEmpty}>—</span>
                      : l.items?.length ? (
                        <span className={styles.ticketItems}>{l.items.map((it) => (
                          <span key={it.key} className={styles.ticketItem}>{it.n ? <span className={styles.ticketRank}>{it.n}</span> : null}<span data-fly-dst={it.key}>{it.text}</span></span>
                        ))}</span>
                      ) : <span data-fly-dst={l.s}>{l.value}</span>}
                </dd>
              </div>
            );
          })}
        </dl>
        <p className={styles.ticketFoot}><span>{step === 'done' ? 'Complete' : `${answered} of 5 answered`}</span><span>Sample workspace</span></p>
      </div>
    </aside>
  );
}

function Progress({ step }: { step: StepId }) {
  const cur = indexOf(step);
  return (
    <div className={styles.progress} role="group" aria-label="Setup progress">
      <ol>
        {STEPS.map((s, i) => {
          const state = i < cur ? 'done' : i === cur ? 'current' : 'todo';
          return (
            <li key={s.id} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
              <span className={styles.seg} aria-hidden="true" />
              <span className={styles.segLabel}>{s.short}<span className={styles.srOnly}>{state === 'done' ? ', done' : state === 'current' ? ', current step' : ', not started'}</span></span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

interface StepShellProps {
  n: number; question: ReactNode; why: string; headingRef: (el: HTMLHeadingElement | null) => void; uid: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void; children: ReactNode; actions: ReactNode; onBack?: () => void;
}
/** Every direct child is a `data-part`: the parts leave and arrive one after another, not as one block. */
function StepShell({ n, question, why, headingRef, uid, onSubmit, children, actions, onBack }: StepShellProps) {
  // Enter on a radio or checkbox advances, like Enter in a text field.
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    const t = e.target as HTMLInputElement;
    if (e.key === 'Enter' && t.tagName === 'INPUT' && (t.type === 'radio' || t.type === 'checkbox')) { e.preventDefault(); e.currentTarget.requestSubmit(); }
  };
  return (
    <form className={styles.form} noValidate onSubmit={onSubmit} onKeyDown={onKeyDown} aria-labelledby={`${uid}q`}>
      {onBack ? (
        <div data-part="">
          <button type="button" className={styles.back} onClick={onBack}>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3 5 8l5 5" /></svg>Back
          </button>
        </div>
      ) : null}
      <h2 id={`${uid}q`} ref={headingRef} tabIndex={-1} className={styles.question} data-part="">
        <span className={styles.eyebrow}>{n <= 5 ? `Step ${n} of 5` : 'All set'}</span>
        <span className={styles.questionText}>{question}</span>
      </h2>
      <p className={styles.why} data-part="">{why}</p>
      <div className={styles.body} data-part="">{children}</div>
      <div className={styles.actions} data-part="">{actions}</div>
    </form>
  );
}

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
type Patch = Partial<Data> | ((d: Data) => Partial<Data>);

export default function AnimatedOnboarding() {
  const uid = useId();
  const { reduced } = useStudioMotion();
  const [step, setStep] = useState<StepId>('kitchen');
  const [data, setData] = useState<Data>(EMPTY);
  const [failNext, setFailNext] = useState(false);
  const [ready, setReady] = useState(false);

  const stepRef = useRef(step); stepRef.current = step;
  const dataRef = useRef(data); dataRef.current = data;
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const failRef = useRef(failNext); failRef.current = failNext;
  /** Demo switch: the next simulated request fails once, then the switch turns itself off. */
  const takeFailure = useCallback(() => { if (!failRef.current) return false; failRef.current = false; setFailNext(false); return true; }, []);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const ticket = useRef<HTMLDivElement>(null);
  const depth = useRef(0);
  const token = useRef(0);
  const pending = useRef<StepId | null>(null);
  const running = useRef<{ anims: Animation[]; timers: number[]; flight: { cancel: () => void } | null }>({ anims: [], timers: [], flight: null });
  const kick = useSwing(ticket, !reduced);

  const patch = useCallback((p: Patch) => setData((d) => ({ ...d, ...(typeof p === 'function' ? p(d) : p) })), []);

  /** Stop whatever step change is still moving: animations, timers and flyers; held text reappears. */
  const stopAll = useCallback(() => {
    const r = running.current;
    for (const a of r.anims) { try { a.cancel(); } catch { /* detached */ } }
    for (const t of r.timers) window.clearTimeout(t);
    r.flight?.cancel();
    running.current = { anims: [], timers: [], flight: null };
    pending.current = null;
  }, []);
  useEffect(() => () => stopAll(), [stopAll]);

  /**
   * One place that changes step. Forward: answers lift off their fields, the step's parts leave left (fast, staggered),
   * the next step's parts arrive from the right (slower, staggered), the answers fly onto the ticket and land with a
   * stamp that swings it. Back: the same moves mirrored, without flights. Focus goes to the new heading at the swap;
   * the new step is interactive the moment it is on screen.
   */
  const transitionTo = useCallback((next: StepId, dir: 'forward' | 'back', p?: Partial<Data>) => {
    stopAll();
    const my = ++token.current;
    const root = panel.current;
    const swap = () => {
      flushSync(() => {
        if (p) setData((d) => ({ ...d, ...p }));
        setStep(next);
      });
      const h = heading.current;
      if (h) {
        h.focus({ preventScroll: true });
        if (h.getBoundingClientRect().top < 56) h.scrollIntoView({ block: 'start' });
      }
    };
    if (reducedRef.current || !root || !layer.current) {
      swap();
      // Reduced motion: the new step simply fades in (≤ 200 ms).
      const parts = panel.current?.querySelectorAll<HTMLElement>('[data-part]');
      if (reducedRef.current && parts) for (const el of parts) running.current.anims.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'linear' }));
      return;
    }
    const sign = dir === 'forward' ? 1 : -1;
    const sources = dir === 'forward' ? captureSources(root) : [];
    const flight = sources.length ? liftOff(sources, layer.current) : null;
    running.current.flight = flight;
    pending.current = next;
    const out = [...root.querySelectorAll<HTMLElement>('[data-part]')];
    out.forEach((el, i) => {
      running.current.anims.push(el.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-28 * sign}px)` }],
        { duration: D.fast, delay: i * STAGGER.tight, easing: cssEase('exit'), fill: 'forwards' },
      ));
    });
    const exitEnd = D.fast + Math.max(0, out.length - 1) * STAGGER.tight;
    running.current.timers.push(window.setTimeout(() => {
      if (my !== token.current) return;
      for (const a of running.current.anims) { try { a.cancel(); } catch { /* gone */ } }
      running.current.anims = [];
      pending.current = null;
      swap();
      const parts = [...(panel.current?.querySelectorAll<HTMLElement>('[data-part]') ?? [])];
      parts.forEach((el, i) => {
        running.current.anims.push(el.animate(
          [{ opacity: 0, transform: `translateX(${36 * sign}px)` }, { opacity: 1, transform: 'none' }],
          { duration: D.moderate, delay: i * STAGGER.base, easing: cssEase('emphasized'), fill: 'backwards' },
        ));
      });
      const t = ticket.current;
      if (flight && t) {
        flight.launch(t, (dst, i) => {
          // Landing: a stamp of ink on the line, a small pop, and the ticket swings on its clip.
          running.current.anims.push(dst.animate([{ transform: 'scale(1.12)', boxShadow: 'inset 0 -0.5em 0 color-mix(in oklab, var(--mk-signal, #bf2f09) 30%, transparent)' }, { transform: 'scale(1)', boxShadow: 'inset 0 -0.5em 0 color-mix(in oklab, var(--mk-signal, #bf2f09) 0%, transparent)' }], { duration: POP.duration, easing: POP.easing }));
          kick(i % 2 ? -26 : 34);
        });
      }
    }, exitEnd));
  }, [kick, stopAll]);

  const goForward = useCallback((next: StepId, p?: Partial<Data>) => {
    if (pending.current === next) return; // a double press while the step is leaving
    depth.current += 1;
    window.history.pushState(null, '', hashFor(next));
    transitionTo(next, 'forward', p);
  }, [transitionTo]);

  const goBack = useCallback(() => {
    const prev = ORDER[indexOf(stepRef.current) - 1];
    if (!prev) return;
    if (depth.current > 0) { window.history.back(); return; } // popstate animates it
    window.history.replaceState(null, '', hashFor(prev));
    transitionTo(prev, 'back');
  }, [transitionTo]);

  // Restore: hash names the step, sessionStorage keeps the answers (resumable after reload or remount).
  useEffect(() => {
    const saved = load();
    const d = saved?.data ?? EMPTY;
    const wanted = stepFromHash(window.location.hash) ?? saved?.step ?? 'kitchen';
    const s = allowed(wanted, d);
    setData(d);
    setStep(s);
    if (stepFromHash(window.location.hash) !== s) window.history.replaceState(null, '', hashFor(s));
    setReady(true);
    const onPop = () => {
      const target = stepFromHash(window.location.hash);
      const cur = stepRef.current;
      if (!target || target === cur) return;
      const dir = indexOf(target) < indexOf(cur) ? 'back' : 'forward';
      depth.current = Math.max(0, depth.current + (dir === 'back' ? -1 : 1));
      transitionTo(allowed(target, dataRef.current), dir);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [transitionTo]);
  useEffect(() => { if (ready) save(step, data); }, [ready, step, data]);

  // One orchestrated entrance above the fold: progress, question, answer area and ticket arrive in order.
  useEffect(() => {
    if (reduced || !ready) return;
    const root = panel.current?.parentElement?.parentElement;
    if (!root) return;
    const els = [...root.querySelectorAll<HTMLElement>('[data-enter], [data-part]')];
    const anims = els.map((el, i) => el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: D.moderate, delay: 40 + i * STAGGER.base, easing: cssEase('emphasized'), fill: 'backwards' }));
    const t = ticket.current;
    if (t) anims.push(t.animate([{ translate: '0 -34px', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: SETTLE.duration, delay: 160, easing: SETTLE.easing, fill: 'backwards' }));
    const swingIn = window.setTimeout(() => kick(28), 160 + SETTLE.duration * 0.55);
    return () => { for (const a of anims) a.cancel(); window.clearTimeout(swingIn); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const restart = () => {
    clear();
    depth.current = 0;
    window.history.replaceState(null, '', hashFor('kitchen'));
    transitionTo('kitchen', 'back', { ...EMPTY });
  };

  const skip = (s: StepId, next: StepId, p: Partial<Data>) => goForward(next, { ...p, skipped: [...new Set([...dataRef.current.skipped, s])] });
  const setHeading = (el: HTMLHeadingElement | null) => { heading.current = el; };
  const shell = { uid, headingRef: setHeading };

  let view: ReactNode = null;
  if (step === 'kitchen') view = <KitchenStep key="kitchen" {...shell} data={data} patch={patch} onNext={(kitchen) => goForward('role', { kitchen })} />;
  if (step === 'role') view = <RoleStep key="role" {...shell} data={data} patch={patch} onBack={goBack} onNext={() => goForward('goals', { skipped: data.skipped.filter((x) => x !== 'role') })} onSkip={() => skip('role', 'goals', { role: null })} />;
  if (step === 'goals') view = <GoalsStep key="goals" {...shell} data={data} patch={patch} reduced={reduced} onBack={goBack} onNext={() => goForward('connect', { skipped: data.skipped.filter((x) => x !== 'goals') })} onSkip={() => skip('goals', 'connect', { goals: [] })} />;
  if (step === 'connect') view = <ConnectStep key="connect" {...shell} data={data} patch={patch} reduced={reduced} takeFailure={takeFailure} onBack={goBack} onNext={() => goForward('brigade')} />;
  if (step === 'brigade') view = <BrigadeStep key="brigade" {...shell} data={data} patch={patch} reduced={reduced} takeFailure={takeFailure} onBack={goBack} onSent={(invited) => goForward('done', { invited, skipped: data.skipped.filter((x) => x !== 'brigade') })} onSkip={() => skip('brigade', 'done', { invited: [] })} />;
  if (step === 'done') view = <DoneStep key="done" {...shell} data={data} reduced={reduced} onRestart={restart} />;

  const springs = { '--settle': SETTLE.easing, '--settle-dur': `${SETTLE.duration}ms`, '--pop': POP.easing, '--pop-dur': `${POP.duration}ms` } as CSSProperties;
  return (
    <div className={styles.root} data-reduced={reduced || undefined} style={springs}>
      <header className={styles.top}>
        <p className={styles.brand}><span className={styles.mark} aria-hidden="true">L</span><span>Larder</span><span className={styles.brandSub}>Kitchen setup</span></p>
        <span className={styles.tag}>Sample workspace</span>
      </header>

      <div className={styles.main}>
        <section className={styles.flow} aria-label="Kitchen setup">
          <div data-enter=""><Progress step={step} /></div>
          <div ref={panel} className={styles.panel}>{view}</div>
        </section>
        <Ticket data={data} step={step} ticketRef={ticket} onBrush={kick} />
      </div>

      <div ref={layer} className={styles.flyLayer} data-flyer-class={styles.flyer} aria-hidden="true" />

      <footer className={styles.demoBar}>
        <fieldset className={styles.demoControls}>
          <legend>Demo controls <span>(not part of the product)</span></legend>
          <label className={styles.demoCheck}>
            <input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.currentTarget.checked)} />
            Make the next connection or invite fail
          </label>
          <button type="button" className={styles.textBtn} onClick={restart}>Start setup again</button>
        </fieldset>
        <p className={styles.fineprint}>Larder is a fictional product. Names, integrations and the prep list are sample content; nothing is sent anywhere.</p>
      </footer>
    </div>
  );
}

/* ── Steps ─────────────────────────────────────────────────────────────── */
type ShellBits = { uid: string; headingRef: (el: HTMLHeadingElement | null) => void };

function KitchenStep({ uid, headingRef, data, patch, onNext }: ShellBits & { data: Data; patch: (p: Patch) => void; onNext: (kitchen: string) => void }) {
  const [touched, setTouched] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const error = touched ? validateKitchen(data.kitchen) : null;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validateKitchen(data.kitchen);
    setTouched(true);
    if (err) { input.current?.focus(); return; }
    onNext(data.kitchen.trim());
  };
  return (
    <StepShell n={1} uid={uid} headingRef={headingRef} onSubmit={submit}
      question="What’s your kitchen called?" why="It names your workspace and heads every list Larder prints for the pass."
      actions={<button type="submit" className={styles.primary}>Continue<Arrow /></button>}>
      <div className={styles.field} data-invalid={error ? '' : undefined}>
        <label htmlFor={`${uid}kitchen`} className={styles.label}>Kitchen name</label>
        <div className={styles.inputWrap}>
          <input
            ref={input} id={`${uid}kitchen`} className={styles.input} type="text" name="kitchen" autoComplete="organization" enterKeyHint="next"
            placeholder="e.g. The Gannet" value={data.kitchen} spellCheck={false} data-fly-src={error ? undefined : 'kitchen'}
            aria-invalid={error ? true : undefined} aria-describedby={`${uid}kitchen-err`}
            onChange={(e) => patch({ kitchen: e.currentTarget.value })}
            onBlur={() => { if (data.kitchen !== '') setTouched(true); }}
          />
        </div>
        <p id={`${uid}kitchen-err`} className={styles.error} aria-live="polite">{error ? <><Bang />{error}</> : null}</p>
      </div>
    </StepShell>
  );
}

function RoleStep({ uid, headingRef, data, patch, onNext, onBack, onSkip }: ShellBits & { data: Data; patch: (p: Patch) => void; onNext: () => void; onBack: () => void; onSkip: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!data.role) { setError('Choose the role closest to yours, or skip this step.'); first.current?.focus(); return; }
    onNext();
  };
  return (
    <StepShell n={2} uid={uid} headingRef={headingRef} onSubmit={submit} onBack={onBack}
      question="What’s your role there?" why="Larder opens on the view you’ll use most. You can switch views at any time."
      actions={<StepActions skip={<button type="button" className={styles.quiet} onClick={onSkip}>Skip for now</button>} />}>
      <fieldset className={styles.cards} aria-describedby={error ? `${uid}role-err` : undefined}>
        <legend className={styles.srOnly}>Your role</legend>
        {ROLES.map((r, i) => (
          <label key={r.id} className={styles.card}>
            <input ref={i === 0 ? first : undefined} className={styles.cardInput} type="radio" name={`${uid}role`} value={r.id} checked={data.role === r.id}
              onChange={() => { patch({ role: r.id }); setError(null); }} />
            <RoleIcon id={r.id} />
            <span className={styles.cardName} data-fly-src={data.role === r.id ? 'role' : undefined}>{r.name}</span>
            <span className={styles.cardNote}>{r.note}</span>
          </label>
        ))}
      </fieldset>
      <p id={`${uid}role-err`} className={styles.error} aria-live="polite">{error ? <><Bang />{error}</> : null}</p>
    </StepShell>
  );
}

/**
 * First lists: pick, then rank. Chosen lists rise to the top in the order Larder builds them; drag the grip to
 * reorder (the card follows the pointer, its neighbours make room, and on release it springs into its slot with the
 * velocity it was thrown with), or focus the grip and use the arrow keys.
 */
function GoalsStep({ uid, headingRef, data, patch, reduced, onNext, onBack, onSkip }: ShellBits & { data: Data; patch: (p: Patch) => void; reduced: boolean; onNext: () => void; onBack: () => void; onSkip: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState('');
  const first = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const grips = useRef(new Map<GoalId, HTMLButtonElement>());
  const drag = useRef<{ id: GoalId; pointer: number; y0: number; from: number; to: number; slots: number[]; pitch: number; samples: { t: number; y: number }[] } | null>(null);
  const settle = useRef<{ raf: number; el: HTMLElement | null }>({ raf: 0, el: null });
  const order: GoalId[] = [...data.goals, ...GOALS.map((g) => g.id).filter((id) => !data.goals.includes(id))];
  useEffect(() => () => cancelAnimationFrame(settle.current.raf), []);

  const items = () => [...(list.current?.querySelectorAll<HTMLElement>('[data-goal]') ?? [])];
  /** Change the order with FLIP: every card glides from where it was to where it now belongs. */
  const reflow = (mutate: () => void) => flip(items(), () => flushSync(mutate), { duration: D.moderate, easing: SETTLE.easing, reducedMotion: reduced });

  const toggle = (id: GoalId, on: boolean) => {
    reflow(() => patch((d) => ({ goals: on ? [...d.goals.filter((g) => g !== id), id] : d.goals.filter((g) => g !== id) })));
    if (on) setError(null);
  };
  const move = (id: GoalId, to: number) => {
    const cur = data.goals.indexOf(id);
    const n = Math.max(0, Math.min(data.goals.length - 1, to));
    if (cur < 0 || n === cur) return;
    const next = data.goals.filter((g) => g !== id);
    next.splice(n, 0, id);
    reflow(() => patch({ goals: next }));
    const g = GOALS.find((x) => x.id === id);
    setSaid(`${g?.name} moved to priority ${n + 1} of ${next.length}.`);
    requestAnimationFrame(() => grips.current.get(id)?.focus());
  };

  const onGripKey = (e: KeyboardEvent<HTMLButtonElement>, id: GoalId) => {
    const i = data.goals.indexOf(id);
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? data.goals.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    move(id, to);
  };

  const onGripDown = (e: PointerEvent<HTMLButtonElement>, id: GoalId) => {
    if (e.button !== 0 || data.goals.length < 2) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    cancelAnimationFrame(settle.current.raf);
    const els = items().slice(0, data.goals.length);
    const tops = els.map((el) => el.getBoundingClientRect().top);
    const from = data.goals.indexOf(id);
    const pitch = tops.length > 1 ? tops[1] - tops[0] : els[0]?.getBoundingClientRect().height ?? 0;
    drag.current = { id, pointer: e.pointerId, y0: e.clientY, from, to: from, slots: tops, pitch, samples: [{ t: performance.now(), y: e.clientY }] };
    const el = els[from];
    el?.setAttribute('data-dragging', '');
  };
  const onGripMove = (e: PointerEvent<HTMLButtonElement>) => {
    const g = drag.current;
    if (!g || g.pointer !== e.pointerId) return;
    const els = items().slice(0, data.goals.length);
    const el = els[g.from];
    if (!el) return;
    let dy = e.clientY - g.y0;
    // Rubber band past the first and last slot.
    const minDy = -g.from * g.pitch, maxDy = (els.length - 1 - g.from) * g.pitch;
    if (dy < minDy) dy = minDy - Math.sqrt(minDy - dy) * 3;
    if (dy > maxDy) dy = maxDy + Math.sqrt(dy - maxDy) * 3;
    el.style.transform = `translateY(${dy.toFixed(1)}px) scale(1.02)`;
    const to = Math.max(0, Math.min(els.length - 1, Math.round(g.from + dy / g.pitch)));
    if (to !== g.to) {
      g.to = to;
      els.forEach((other, i) => {
        if (i === g.from) return;
        const shift = g.from < to && i > g.from && i <= to ? -g.pitch : g.from > to && i < g.from && i >= to ? g.pitch : 0;
        other.style.transition = reduced ? 'none' : `transform ${SETTLE.duration}ms ${SETTLE.easing}`;
        other.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    }
    g.samples.push({ t: performance.now(), y: e.clientY });
    if (g.samples.length > 6) g.samples.shift();
  };
  const onGripUp = (e: PointerEvent<HTMLButtonElement>) => {
    const g = drag.current;
    if (!g || g.pointer !== e.pointerId) return;
    drag.current = null;
    const els = items().slice(0, data.goals.length);
    const el = els[g.from];
    if (!el) return;
    const visualTop = el.getBoundingClientRect().top;
    const a = g.samples[0], b = g.samples[g.samples.length - 1];
    const velocity = b && a && b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0;
    for (const o of els) { o.style.transition = ''; o.style.transform = ''; }
    el.removeAttribute('data-dragging');
    if (g.to !== g.from) {
      const next = data.goals.filter((x) => x !== g.id);
      next.splice(g.to, 0, g.id);
      flushSync(() => patch({ goals: next }));
      const name = GOALS.find((x) => x.id === g.id)?.name;
      setSaid(`${name} moved to priority ${g.to + 1} of ${next.length}.`);
    }
    // The dropped card springs from where it was let go into its slot, keeping the throw's velocity.
    const dropped = list.current?.querySelector<HTMLElement>(`[data-goal="${g.id}"]`);
    if (!dropped || reduced) return;
    const s = { x: visualTop - dropped.getBoundingClientRect().top, v: velocity };
    let prev = performance.now();
    settle.current.el = dropped;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      const c = SPRING.release, steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
      for (let i = 0; i < steps; i++) { s.v += ((-c.stiffness * s.x - c.damping * s.v) / c.mass) * h; s.x += s.v * h; }
      if (Math.abs(s.x) < 0.3 && Math.abs(s.v) < 4) { dropped.style.transform = ''; return; }
      dropped.style.transform = `translateY(${s.x.toFixed(2)}px)`;
      settle.current.raf = requestAnimationFrame(tick);
    };
    settle.current.raf = requestAnimationFrame(tick);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!data.goals.length) { setError('Choose at least one list, or skip and Larder will start with prep lists.'); first.current?.focus(); return; }
    onNext();
  };
  return (
    <StepShell n={3} uid={uid} headingRef={headingRef} onSubmit={submit} onBack={onBack}
      question="What should Larder build first?" why="Pick one or more, then put them in order. We build these from tonight’s service, so they’re useful from tomorrow morning."
      actions={<StepActions skip={<button type="button" className={styles.quiet} onClick={onSkip}>Skip for now</button>} />}>
      <fieldset className={styles.ranks} aria-describedby={`${uid}rank-hint${error ? ` ${uid}goal-err` : ''}`}>
        <legend className={styles.srOnly}>Lists to build first, in order</legend>
        <ol ref={list} className={styles.rankList}>
          {order.map((id, i) => {
            const g = GOALS.find((x) => x.id === id)!;
            const on = data.goals.includes(id);
            const rank = on ? data.goals.indexOf(id) + 1 : 0;
            return (
              <li key={id} data-goal={id} className={styles.rankItem} data-on={on || undefined}>
                <label className={styles.card} data-kind="check">
                  <input ref={i === 0 ? first : undefined} className={styles.cardInput} type="checkbox" checked={on} aria-invalid={error ? true : undefined}
                    onChange={(e) => toggle(id, e.currentTarget.checked)} />
                  <span className={styles.tick} aria-hidden="true"><Check /></span>
                  <span className={styles.cardName} data-fly-src={on ? `goal-${id}` : undefined}>{g.name}</span>
                  <span className={styles.cardNote}>{g.note}</span>
                </label>
                {on ? (
                  <button ref={(el) => { if (el) grips.current.set(id, el); else grips.current.delete(id); }} type="button" className={styles.grip}
                    aria-label={`${g.name}: priority ${rank} of ${data.goals.length}. Move with the arrow keys.`}
                    onPointerDown={(e) => onGripDown(e, id)} onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp}
                    onKeyDown={(e) => onGripKey(e, id)}>
                    <span className={styles.rankNum} aria-hidden="true">{rank}</span>
                    <svg viewBox="0 0 12 20" aria-hidden="true" focusable="false"><circle cx="3" cy="4" r="1.5" /><circle cx="9" cy="4" r="1.5" /><circle cx="3" cy="10" r="1.5" /><circle cx="9" cy="10" r="1.5" /><circle cx="3" cy="16" r="1.5" /><circle cx="9" cy="16" r="1.5" /></svg>
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
        <p id={`${uid}rank-hint`} className={styles.rankHint}>{data.goals.length > 1 ? 'Drag a grip to change the order, or focus it and use the arrow keys.' : 'Lists you pick move to the top, in the order you pick them.'}</p>
      </fieldset>
      <p className={styles.srOnly} role="status">{said}</p>
      <p id={`${uid}goal-err`} className={styles.error} aria-live="polite">{error ? <><Bang />{error}</> : null}</p>
    </StepShell>
  );
}

function ConnectStep({ uid, headingRef, data, patch, reduced, takeFailure, onNext, onBack }: ShellBits & {
  data: Data; patch: (p: Patch) => void; reduced: boolean; takeFailure: () => boolean; onNext: () => void; onBack: () => void;
}) {
  const [phase, setPhase] = useState<Record<IntegrationId, MorphPhase>>(() => ({
    till: data.connected.includes('till') ? 'success' : 'idle',
    suppliers: data.connected.includes('suppliers') ? 'success' : 'idle',
    calendar: data.connected.includes('calendar') ? 'success' : 'idle',
  }));
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const connect = async (id: IntegrationId) => {
    if (phase[id] === 'busy' || phase[id] === 'success') return;
    setPhase((p) => ({ ...p, [id]: 'busy' }));
    await wait(reduced ? 700 : 1300);
    if (!alive.current) return;
    if (takeFailure()) {
      setPhase((p) => ({ ...p, [id]: 'error' }));
      return;
    }
    setPhase((p) => ({ ...p, [id]: 'success' }));
    patch((d) => ({ connected: INTEGRATIONS.map((i) => i.id).filter((x) => x === id || d.connected.includes(x)) }));
  };
  const anyBusy = Object.values(phase).includes('busy');
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); if (!anyBusy) onNext(); };
  return (
    <StepShell n={4} uid={uid} headingRef={headingRef} onSubmit={submit} onBack={onBack}
      question="Connect your till and suppliers" why="Forecasts come from what you actually sell. Each connection says what it reads before you allow it. Optional: sample data works too."
      actions={<StepActions next={data.connected.length ? 'Continue' : 'Continue with sample data'} />}>
      <ul className={styles.integrations}>
        {INTEGRATIONS.map((it) => {
          const ph = phase[it.id];
          return (
            <li key={it.id} className={styles.integration} data-phase={ph}>
              <div className={styles.intText}>
                <p className={styles.intName}><span data-fly-src={ph === 'success' ? `int-${it.id}` : undefined}>{it.name}</span> <span className={styles.intKind}>{it.note}</span></p>
                <p className={styles.intReads} id={`${uid}${it.id}-reads`}>{it.reads}</p>
                <p className={styles.intStatus} aria-live="polite" id={`${uid}${it.id}-status`}>
                  {ph === 'success' ? <span className={styles.okChip}><Check />Connected (simulated)</span>
                    : ph === 'error' ? <span className={styles.errText}><Bang />Couldn’t connect: the simulated service didn’t answer. Try again.</span>
                      : ph === 'busy' ? 'Connecting…' : 'Not connected'}
                </p>
              </div>
              <MorphButton size="s" reduced={reduced} phase={ph} onPress={() => void connect(it.id)} context={it.name}
                describedBy={`${uid}${it.id}-reads`}
                labels={{ idle: 'Connect', busy: 'Connecting…', success: 'Connected', error: 'Try again' }} />
            </li>
          );
        })}
      </ul>
    </StepShell>
  );
}

function BrigadeStep({ uid, headingRef, data, patch, reduced, takeFailure, onSent, onBack, onSkip }: ShellBits & {
  data: Data; patch: (p: Patch) => void; reduced: boolean; takeFailure: () => boolean; onSent: (emails: string[]) => void; onBack: () => void; onSkip: () => void;
}) {
  const nextKey = useRef(1);
  const [rows, setRows] = useState<{ key: number; value: string; touched: boolean }[]>(() =>
    (data.drafts.length ? data.drafts : data.invited.length ? data.invited : ['']).map((value) => ({ key: nextKey.current++, value, touched: false })));
  const [phase, setPhase] = useState<MorphPhase>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const after = useRef<HTMLDivElement>(null);
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const errRef = useRef<HTMLParagraphElement>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // Keep typed addresses in the flow's data so Back/Forward or a reload never loses them.
  const draft = rows.map((r) => r.value).join('\n');
  useEffect(() => { patch({ drafts: draft.split('\n') }); }, [draft, patch]);

  const errorOf = (i: number) => {
    const r = rows[i];
    return r.touched ? validateEmail(r.value, rows.filter((_, j) => j < i).map((x) => x.value)) : null;
  };
  /** FLIP the rows and everything under the list so adding/removing a row never jumps. */
  const reflow = (mutate: () => void) => {
    const els = [...(list.current?.querySelectorAll<HTMLElement>('[data-row]') ?? []), ...(after.current ? [after.current] : [])];
    flip(els, () => flushSync(mutate), { duration: D.base, easing: SETTLE.easing, reducedMotion: reduced });
  };
  const add = () => {
    const key = nextKey.current++;
    reflow(() => setRows((r) => [...r, { key, value: '', touched: false }]));
    requestAnimationFrame(() => {
      const el = inputs.current.get(key);
      el?.focus();
      if (el && !reduced && typeof el.animate === 'function') el.closest('li')?.animate([{ opacity: 0, transform: 'translateY(-8px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: SETTLE.duration, easing: SETTLE.easing });
    });
  };
  const remove = (key: number, i: number) => {
    reflow(() => setRows((r) => r.filter((x) => x.key !== key)));
    requestAnimationFrame(() => { const k = rows[i + 1]?.key ?? rows[i - 1]?.key; (k !== undefined ? inputs.current.get(k) : null)?.focus(); });
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (phase === 'busy' || phase === 'success') return;
    const touchedRows = rows.map((r) => ({ ...r, touched: r.value !== '' || r.touched }));
    setRows(touchedRows);
    const errs = touchedRows.map((r, i) => (r.value.trim() ? validateEmail(r.value, touchedRows.filter((_, j) => j < i).map((x) => x.value)) : null));
    const firstBad = errs.findIndex(Boolean);
    if (firstBad >= 0) { inputs.current.get(touchedRows[firstBad].key)?.focus(); return; }
    const emails = touchedRows.map((r) => r.value.trim()).filter(Boolean);
    if (!emails.length) { setFormError('Add at least one email address, or choose Skip for now.'); inputs.current.get(touchedRows[0]?.key)?.focus(); return; }
    setFormError(null);
    setPhase('busy');
    await wait(reduced ? 700 : 1400);
    if (!alive.current) return;
    if (takeFailure()) {
      setPhase('error');
      setFormError('The invites didn’t send: the simulated server didn’t answer. Your list is kept; try again.');
      requestAnimationFrame(() => errRef.current?.focus());
      return;
    }
    setPhase('success');
    await wait(reduced ? 0 : 520);
    if (alive.current) onSent(emails);
  };
  return (
    <StepShell n={5} uid={uid} headingRef={headingRef} onSubmit={(e) => void submit(e)} onBack={onBack}
      question="Invite your brigade" why="Everyone you invite gets the prep list on their phone before service. They can join later too."
      actions={(
        <StepActions skip={<button type="button" className={styles.quiet} onClick={onSkip}>Skip for now</button>}
          primary={<MorphButton type="submit" reduced={reduced} phase={phase} describedBy={formError ? `${uid}inv-err` : undefined}
            labels={{ idle: 'Send invites', busy: 'Sending…', success: 'Invites sent', error: 'Try again' }} />} />
      )}>
      <ul ref={list} className={styles.invites}>
        {rows.map((r, i) => {
          const err = errorOf(i);
          const id = `${uid}email${r.key}`;
          return (
            <li key={r.key} data-row className={styles.inviteRow} data-invalid={err ? '' : undefined}>
              <label htmlFor={id} className={styles.label}>{i === 0 ? 'Email address' : `Email address ${i + 1}`}</label>
              <div className={styles.inviteLine}>
                <input
                  ref={(el) => { if (el) inputs.current.set(r.key, el); else inputs.current.delete(r.key); }}
                  id={id} className={styles.input} type="email" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} enterKeyHint="send"
                  placeholder="name@yourkitchen.co" value={r.value} readOnly={phase === 'busy' || phase === 'success'}
                  data-fly-src={phase === 'success' && r.value.trim() ? 'brigade' : undefined}
                  aria-invalid={err ? true : undefined} aria-describedby={`${id}-err`}
                  onChange={(e) => { const v = e.currentTarget.value; setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, value: v } : x))); setFormError(null); }}
                  onBlur={() => setRows((rs) => rs.map((x) => (x.key === r.key && x.value !== '' ? { ...x, touched: true } : x)))}
                />
                {rows.length > 1 ? (
                  <button type="button" className={styles.remove} onClick={() => remove(r.key, i)} aria-label={`Remove ${r.value.trim() || `email address ${i + 1}`}`}>
                    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                  </button>
                ) : null}
              </div>
              <p id={`${id}-err`} className={styles.error} aria-live="polite">{err ? <><Bang />{err}</> : null}</p>
            </li>
          );
        })}
      </ul>
      <div ref={after} className={styles.afterList}>
        {rows.length < 4 ? <button type="button" className={styles.addRow} onClick={add} disabled={phase === 'busy'}>+ Add another</button> : <p className={styles.cardNote}>Four at a time; you can invite more from the team page.</p>}
        <p id={`${uid}inv-err`} ref={errRef} tabIndex={-1} className={styles.formError} aria-live="assertive">{formError ? <><Bang />{formError}</> : null}</p>
      </div>
    </StepShell>
  );
}

function DoneStep({ uid, headingRef, data, reduced, onRestart }: ShellBits & { data: Data; reduced: boolean; onRestart: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [opened, setOpened] = useState(false);
  const mark = useRef<SVGPathElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setLoaded(true), reduced ? 500 : 950);
    return () => window.clearTimeout(t);
  }, [reduced]);
  useEffect(() => {
    // One brief celebration at the first outcome (≤ 1.2 s), removed under reduced motion.
    if (reduced) return;
    const a = [
      ring.current?.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: D.slow, easing: cssEase('emphasized'), fill: 'both' }),
      mark.current?.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: D.moderate, delay: D.base, easing: cssEase('emphasized'), fill: 'both' }),
    ];
    return () => { for (const x of a) x?.cancel(); };
  }, [reduced]);
  // The real list replaces the skeleton row by row (the skeleton-shimmer handoff), each row settling on a spring.
  useEffect(() => {
    if (!loaded || reduced) return;
    const rows = [...(listRef.current?.children ?? [])] as HTMLElement[];
    const anims = rows.map((r, i) => r.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: SETTLE.duration, delay: i * STAGGER.base, easing: SETTLE.easing, fill: 'backwards' }));
    return () => { for (const x of anims) x.cancel(); };
  }, [loaded, reduced]);
  const kitchen = data.kitchen.trim() || 'Your kitchen';
  const tillNote = data.connected.includes('till') ? ' The till connection in this demo is simulated, so the figures are too.' : '';
  return (
    <StepShell n={6} uid={uid} headingRef={headingRef} onSubmit={(e) => { e.preventDefault(); setOpened(true); }}
      question={<>{kitchen} is set up.</>} why={`Here is the first thing Larder made for you: tomorrow’s prep list.${tillNote}`}
      actions={(
        <>
          <button type="submit" className={styles.primary}>Open the prep list<Arrow /></button>
          <button type="button" className={styles.quiet} onClick={onRestart}>Start again</button>
        </>
      )}>
      <svg className={styles.doneMark} viewBox="0 0 48 48" aria-hidden="true" focusable="false" data-static={reduced || undefined}>
        <circle ref={ring} cx="24" cy="24" r="21" pathLength={1} />
        <path ref={mark} d="m15 24.5 6.5 6.5L34 18" pathLength={1} />
      </svg>
      <section className={styles.prep} aria-labelledby={`${uid}prep`} aria-busy={!loaded}>
        <header className={styles.prepHead}>
          <h3 id={`${uid}prep`}>Prep list · tomorrow</h3>
          <span className={styles.tag}>Sample data</span>
        </header>
        <p className={styles.srOnly} role="status">{loaded ? 'Prep list ready: 5 items.' : 'Building tomorrow’s prep list…'}</p>
        {loaded ? (
          <ol ref={listRef} className={styles.prepList}>
            {PREP_LIST.map((p) => (
              <li key={p.item}><span className={styles.prepItem}>{p.item}</span><span className={styles.prepFor}>{p.for}</span><span className={styles.prepQty}>{p.qty}</span></li>
            ))}
          </ol>
        ) : (
          <ol className={styles.skeleton} aria-hidden="true" data-shimmer={!reduced || undefined}>
            {PREP_LIST.map((p) => <li key={p.item}><span /><span /><span /></li>)}
          </ol>
        )}
      </section>
      {opened ? <p className={styles.endNote} role="status">Demo ends here. In Larder this opens the prep list for {kitchen}, sorted by section.</p> : null}
    </StepShell>
  );
}

function StepActions({ skip, next = 'Continue', primary }: { skip?: ReactNode; next?: string; primary?: ReactNode }) {
  return (
    <>
      {primary ?? <button type="submit" className={styles.primary}>{next}<Arrow /></button>}
      {skip}
    </>
  );
}

function Arrow() {
  return <svg className={styles.arrow} viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h9.5M8.5 4l4 4-4 4" /></svg>;
}
