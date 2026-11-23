'use client';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { cssEase, duration as D, flip, useStudioMotion, viewTransition } from '../../../motion';
import {
  EMPTY, GOALS, INTEGRATIONS, ORDER, PREP_LIST, ROLES, STEPS,
  allowed, clear, hashFor, indexOf, load, save, stepFromHash, validateEmail, validateKitchen,
  type Data, type GoalId, type IntegrationId, type RoleId, type StepId,
} from './data';
import { Check, MorphButton, type MorphPhase } from './MorphButton';
import styles from './styles.module.css';

/** Answer elements and their ticket lines share these names so the View Transitions API can fly one into the other. */
const fly = (name: string | false | null | undefined): CSSProperties | undefined =>
  name ? ({ viewTransitionName: `larder-a-${name}`, viewTransitionClass: 'larder-fly' } as CSSProperties) : undefined;

const TRANSITION_CSS = `
::view-transition-group(larder-step) { animation-duration: ${D.moderate}ms; }
::view-transition-old(larder-step) { animation: ${D.base}ms ${cssEase('exit')} both larder-out; }
::view-transition-new(larder-step) { animation: ${D.moderate}ms ${cssEase('emphasized')} 60ms both larder-in; }
:root[data-larder-dir='back']::view-transition-old(larder-step) { animation-name: larder-out-back; }
:root[data-larder-dir='back']::view-transition-new(larder-step) { animation-name: larder-in-back; }
::view-transition-old(larder-progress) { display: none; }
::view-transition-new(larder-progress) { animation: none; }
::view-transition-group(larder-ticket), ::view-transition-group(*.larder-fly) { animation-duration: ${D.slow - 80}ms; animation-timing-function: ${cssEase('emphasized')}; }
:root[data-larder-vt='fade']::view-transition-group(*) { animation: none; }
:root[data-larder-vt='fade']::view-transition-old(*) { animation: 180ms linear both larder-fade-out; }
:root[data-larder-vt='fade']::view-transition-new(*) { animation: 180ms linear both larder-fade-in; }
@keyframes larder-out { to { opacity: 0; transform: translateX(-28px); } }
@keyframes larder-in { from { opacity: 0; transform: translateX(28px); } }
@keyframes larder-out-back { to { opacity: 0; transform: translateX(28px); } }
@keyframes larder-in-back { from { opacity: 0; transform: translateX(-28px); } }
@keyframes larder-fade-out { to { opacity: 0; } }
@keyframes larder-fade-in { from { opacity: 0; } }
`;

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

/* ── Ticket on the rail: the running summary every answer flies into ──── */
function Ticket({ data, step, flight }: { data: Data; step: StepId; flight: StepId | null }) {
  const role = ROLES.find((r) => r.id === data.role);
  const goals = GOALS.filter((g) => data.goals.includes(g.id));
  const connected = INTEGRATIONS.filter((i) => data.connected.includes(i.id));
  const skipped = (s: StepId) => data.skipped.includes(s);
  type Line = { s: StepId; label: string; value: string | null; items?: { key: string; text: string }[] };
  const lines: Line[] = [
    { s: 'kitchen', label: 'Kitchen', value: data.kitchen.trim() || null },
    { s: 'role', label: 'Role', value: role?.name ?? (skipped('role') ? 'Skipped' : null) },
    { s: 'goals', label: 'First lists', value: goals.length ? '' : skipped('goals') ? 'Prep lists (default)' : null, items: goals.map((g) => ({ key: `goal-${g.id}`, text: g.name })) },
    { s: 'connect', label: 'Connected', value: connected.length ? '' : indexOf(step) > indexOf('connect') ? 'Sample data' : null, items: connected.map((i) => ({ key: `int-${i.id}`, text: i.name })) },
    { s: 'brigade', label: 'Brigade', value: data.invited.length ? `${data.invited.length} invited` : skipped('brigade') ? 'Just you for now' : null },
  ];
  const answered = lines.filter((l) => l.s !== step && (l.value !== null)).length;
  return (
    <aside className={styles.rail} aria-label="Setup ticket">
      <div className={styles.railBar} aria-hidden="true" />
      <div className={styles.ticket} style={{ viewTransitionName: 'larder-ticket' } as CSSProperties}>
        <span className={styles.clip} aria-hidden="true" />
        <p className={styles.ticketHead}><span>Larder · setup</span><span>No. 001</span></p>
        <dl className={styles.ticketLines}>
          {lines.map((l) => {
            const editing = l.s === step;
            const filled = !editing && l.value !== null;
            const flying = flight === l.s;
            return (
              <div key={l.s} className={styles.ticketLine} data-state={editing ? 'editing' : filled ? 'filled' : 'empty'}>
                <dt>{l.label}</dt>
                <dd>
                  {editing ? <span className={styles.ticketEditing}>answering now…</span>
                    : !filled ? <span className={styles.ticketEmpty}>—</span>
                      : l.items?.length ? (
                        <span className={styles.ticketItems}>{l.items.map((it) => <span key={it.key} style={fly(flying && it.key)}>{it.text}</span>)}</span>
                      ) : <span style={fly(flying && !l.items?.length && l.s)}>{l.value}</span>}
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
    <div className={styles.progress} role="group" aria-label="Setup progress" style={{ viewTransitionName: 'larder-progress' } as CSSProperties}>
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
function StepShell({ n, question, why, headingRef, uid, onSubmit, children, actions, onBack }: StepShellProps) {
  // Enter on a radio or checkbox advances, like Enter in a text field.
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    const t = e.target as HTMLInputElement;
    if (e.key === 'Enter' && t.tagName === 'INPUT' && (t.type === 'radio' || t.type === 'checkbox')) { e.preventDefault(); e.currentTarget.requestSubmit(); }
  };
  return (
    <form className={styles.form} noValidate onSubmit={onSubmit} onKeyDown={onKeyDown} aria-labelledby={`${uid}q`}>
      {onBack ? (
        <button type="button" className={styles.back} onClick={onBack}>
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3 5 8l5 5" /></svg>Back
        </button>
      ) : null}
      <h2 id={`${uid}q`} ref={headingRef} tabIndex={-1} className={styles.question}>
        <span className={styles.eyebrow}>{n <= 5 ? `Step ${n} of 5` : 'All set'}</span>
        <span className={styles.questionText}>{question}</span>
      </h2>
      <p className={styles.why}>{why}</p>
      <div className={styles.body}>{children}</div>
      <div className={styles.actions}>{actions}</div>
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
  const [flight, setFlight] = useState<StepId | null>(null);
  const [failNext, setFailNext] = useState(false);
  const [ready, setReady] = useState(false);

  const stepRef = useRef(step); stepRef.current = step;
  const dataRef = useRef(data); dataRef.current = data;
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const failRef = useRef(failNext); failRef.current = failNext;
  /** Demo switch: the next simulated request fails once, then the switch turns itself off. */
  const takeFailure = useCallback(() => { if (!failRef.current) return false; failRef.current = false; setFailNext(false); return true; }, []);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const depth = useRef(0);
  const vtToken = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const patch = useCallback((p: Patch) => setData((d) => ({ ...d, ...(typeof p === 'function' ? p(d) : p) })), []);

  /** One place that changes step: shared-element view transition, focus to the new heading. */
  const transitionTo = useCallback((next: StepId, dir: 'forward' | 'back', p?: Partial<Data>) => {
    const from = stepRef.current;
    const root = document.documentElement;
    const token = ++vtToken.current;
    root.dataset.larderDir = dir;
    root.dataset.larderVt = reducedRef.current ? 'fade' : 'move';
    const update = () => {
      flushSync(() => {
        if (p) setData((d) => ({ ...d, ...p }));
        setFlight(dir === 'forward' ? from : null);
        setStep(next);
      });
      const h = heading.current;
      if (h) {
        h.focus({ preventScroll: true });
        if (h.getBoundingClientRect().top < 56) h.scrollIntoView({ block: 'start' });
      }
    };
    void viewTransition(update).then(() => {
      if (token !== vtToken.current) return;
      delete root.dataset.larderDir;
      delete root.dataset.larderVt;
      if (alive.current) setFlight(null);
    });
  }, []);

  const goForward = useCallback((next: StepId, p?: Partial<Data>) => {
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
    return () => {
      window.removeEventListener('popstate', onPop);
      delete document.documentElement.dataset.larderDir;
      delete document.documentElement.dataset.larderVt;
    };
  }, [transitionTo]);
  useEffect(() => { if (ready) save(step, data); }, [ready, step, data]);

  const restart = () => {
    clear();
    depth.current = 0;
    window.history.replaceState(null, '', hashFor('kitchen'));
    transitionTo('kitchen', 'back', { ...EMPTY });
  };

  const skip = (s: StepId, next: StepId, p: Partial<Data>) => goForward(next, { ...p, skipped: [...new Set([...dataRef.current.skipped, s])] });
  const setHeading = (el: HTMLHeadingElement | null) => { heading.current = el; };
  const shell = { uid, headingRef: setHeading };

  let panel: ReactNode = null;
  if (step === 'kitchen') panel = <KitchenStep key="kitchen" {...shell} data={data} patch={patch} onNext={(kitchen) => goForward('role', { kitchen })} />;
  if (step === 'role') panel = <RoleStep key="role" {...shell} data={data} patch={patch} onBack={goBack} onNext={() => goForward('goals', { skipped: data.skipped.filter((x) => x !== 'role') })} onSkip={() => skip('role', 'goals', { role: null })} />;
  if (step === 'goals') panel = <GoalsStep key="goals" {...shell} data={data} patch={patch} onBack={goBack} onNext={() => goForward('connect', { skipped: data.skipped.filter((x) => x !== 'goals') })} onSkip={() => skip('goals', 'connect', { goals: [] })} />;
  if (step === 'connect') panel = <ConnectStep key="connect" {...shell} data={data} patch={patch} reduced={reduced} takeFailure={takeFailure} onBack={goBack} onNext={() => goForward('brigade')} />;
  if (step === 'brigade') panel = <BrigadeStep key="brigade" {...shell} data={data} patch={patch} reduced={reduced} takeFailure={takeFailure} onBack={goBack} onSent={(invited) => goForward('done', { invited, skipped: data.skipped.filter((x) => x !== 'brigade') })} onSkip={() => skip('brigade', 'done', { invited: [] })} />;
  if (step === 'done') panel = <DoneStep key="done" {...shell} data={data} reduced={reduced} onRestart={restart} />;

  return (
    <div className={styles.root} data-reduced={reduced || undefined}>
      <style>{TRANSITION_CSS}</style>
      <header className={styles.top}>
        <p className={styles.brand}><span className={styles.mark} aria-hidden="true">L</span><span>Larder</span><span className={styles.brandSub}>Kitchen setup</span></p>
        <span className={styles.tag}>Sample workspace</span>
      </header>

      <div className={styles.main}>
        <section className={styles.flow} aria-label="Kitchen setup">
          <Progress step={step} />
          <div className={styles.panel} style={{ viewTransitionName: 'larder-step' } as CSSProperties}>{panel}</div>
        </section>
        <Ticket data={data} step={step} flight={flight} />
      </div>

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
        <div className={styles.inputWrap} style={fly(!error && data.kitchen.trim() && 'kitchen')}>
          <input
            ref={input} id={`${uid}kitchen`} className={styles.input} type="text" name="kitchen" autoComplete="organization" enterKeyHint="next"
            placeholder="e.g. The Gannet" value={data.kitchen} spellCheck={false}
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
          <label key={r.id} className={styles.card} style={fly(data.role === r.id && 'role')}>
            <input ref={i === 0 ? first : undefined} className={styles.cardInput} type="radio" name={`${uid}role`} value={r.id} checked={data.role === r.id}
              onChange={() => { patch({ role: r.id }); setError(null); }} />
            <RoleIcon id={r.id} />
            <span className={styles.cardName}>{r.name}</span>
            <span className={styles.cardNote}>{r.note}</span>
          </label>
        ))}
      </fieldset>
      <p id={`${uid}role-err`} className={styles.error} aria-live="polite">{error ? <><Bang />{error}</> : null}</p>
    </StepShell>
  );
}

function GoalsStep({ uid, headingRef, data, patch, onNext, onBack, onSkip }: ShellBits & { data: Data; patch: (p: Patch) => void; onNext: () => void; onBack: () => void; onSkip: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  const toggle = (id: GoalId, on: boolean) => {
    patch((d) => ({ goals: GOALS.map((g) => g.id).filter((g) => (g === id ? on : d.goals.includes(g))) }));
    if (on) setError(null);
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!data.goals.length) { setError('Choose at least one list, or skip and Larder will start with prep lists.'); first.current?.focus(); return; }
    onNext();
  };
  return (
    <StepShell n={3} uid={uid} headingRef={headingRef} onSubmit={submit} onBack={onBack}
      question="What should Larder build first?" why="Pick one or more. We build these from tonight’s service, so they’re useful from tomorrow morning."
      actions={<StepActions skip={<button type="button" className={styles.quiet} onClick={onSkip}>Skip for now</button>} />}>
      <fieldset className={styles.cards} data-kind="goals" aria-describedby={error ? `${uid}goal-err` : undefined}>
        <legend className={styles.srOnly}>Lists to build first</legend>
        {GOALS.map((g, i) => {
          const on = data.goals.includes(g.id);
          return (
            <label key={g.id} className={styles.card} data-kind="check" style={fly(on && `goal-${g.id}`)}>
              <input ref={i === 0 ? first : undefined} className={styles.cardInput} type="checkbox" checked={on} aria-invalid={error ? true : undefined}
                onChange={(e) => toggle(g.id, e.currentTarget.checked)} />
              <span className={styles.tick} aria-hidden="true"><Check /></span>
              <span className={styles.cardName}>{g.name}</span>
              <span className={styles.cardNote}>{g.note}</span>
            </label>
          );
        })}
      </fieldset>
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
                <p className={styles.intName}>{it.name} <span className={styles.intKind}>{it.note}</span></p>
                <p className={styles.intReads} id={`${uid}${it.id}-reads`}>{it.reads}</p>
                <p className={styles.intStatus} aria-live="polite" id={`${uid}${it.id}-status`}>
                  {ph === 'success' ? <span style={fly(`int-${it.id}`)} className={styles.okChip}><Check />Connected (simulated)</span>
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
    flip(els, () => flushSync(mutate), { duration: D.base, reducedMotion: reduced });
  };
  const add = () => {
    const key = nextKey.current++;
    reflow(() => setRows((r) => [...r, { key, value: '', touched: false }]));
    requestAnimationFrame(() => {
      const el = inputs.current.get(key);
      el?.focus();
      if (el && !reduced && typeof el.animate === 'function') el.closest('li')?.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: D.base, easing: cssEase('emphasized') });
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
      <ul ref={list} className={styles.invites} style={fly(phase !== 'idle' && phase !== 'error' && 'brigade')}>
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
          <ol className={styles.prepList} data-enter={!reduced || undefined}>
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
