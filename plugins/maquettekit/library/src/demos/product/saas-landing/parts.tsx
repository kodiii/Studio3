'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { spring as SPRING, useIsomorphicLayoutEffect, useRafLoop } from '../../../motion';
import { FAILED, FAQ, INBOX_URL, OVERAGE, PASSED, PLANS, TARGETS, formatUsd, type Target } from './content';
import { Json, StatusChip } from './Inbox';
import { Ticker } from './Ticker';
import styles from './styles.module.css';

/* ── Morphing indicator: measured once per change, moved with a CSS transform (no layout animation library) ── */
export function useIndicator(list: RefObject<HTMLElement | null>, index: number) {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
  useIsomorphicLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const measure = () => {
      const it = el.querySelectorAll<HTMLElement>('[data-ind]')[index];
      setBox(it ? { x: it.offsetLeft, y: it.offsetTop, w: it.offsetWidth, h: it.offsetHeight } : null);
    };
    measure();
    const raf = requestAnimationFrame(() => setReady(true));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [list, index]);
  return { box, ready };
}

export function Indicator({ state, className }: { state: ReturnType<typeof useIndicator>; className?: string }) {
  const { box, ready } = state;
  return (
    <span aria-hidden="true" className={`${styles.ind} ${className ?? ''}`} data-ready={ready || undefined}
      style={box ? { transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h } : { opacity: 0 }} />
  );
}

/* ── Scroll reveal: content is visible by default; only hidden while JS waits for it to enter ── */
export function useReveal(enabled: boolean) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!enabled || typeof IntersectionObserver === 'undefined') { for (const i of items) i.dataset.reveal = 'in'; return; }
    for (const i of items) if (i.getBoundingClientRect().top > window.innerHeight) i.dataset.reveal = 'wait';
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { (e.target as HTMLElement).dataset.reveal = 'in'; io.unobserve(e.target); }
    }, { threshold: 0.2 });
    for (const i of items) io.observe(i);
    return () => io.disconnect();
  }, [enabled]);
  return root;
}

/* ── Magnetic pull (the hero CTA only): the magnetic-button technique on this page's button ──
   A precise pointer within FIELD px of the button draws it in (capped with tanh, fading to zero at the field's edge);
   the label floats a little further than the body. Springs from the tokens; the loop sleeps once both are home. */
const FIELD = 76;
function useMagnet(anchor: RefObject<HTMLSpanElement | null>, body: RefObject<HTMLButtonElement | null>, label: RefObject<HTMLSpanElement | null>, enabled: boolean) {
  const sim = useRef({ bx: 0, bv: 0, by: 0, byv: 0, lx: 0, lv: 0, ly: 0, lyv: 0, tx: 0, ty: 0 });
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    if (!fine) return;
    const onMove = (e: globalThis.PointerEvent) => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const edge = Math.max(0, Math.hypot(Math.max(0, Math.abs(dx) - r.width / 2), Math.max(0, Math.abs(dy) - r.height / 2)));
      const s = sim.current;
      if (edge < FIELD) {
        const w = 1 - Math.min(1, edge / FIELD), lim = r.height * 0.42;
        s.tx = lim * Math.tanh((dx * 0.26 * w * w) / lim);
        s.ty = lim * Math.tanh((dy * 0.26 * w * w) / lim);
      } else { s.tx = 0; s.ty = 0; }
      if ((s.tx || s.ty || s.bx || s.by) && !runningRef.current) { runningRef.current = true; setRunning(true); }
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (body.current) body.current.style.translate = '';
      if (label.current) label.current.style.translate = '';
    };
  }, [enabled, anchor, body, label]);
  useRafLoop(anchor, (dt) => {
    const s = sim.current, c = s.tx || s.ty ? SPRING.settle : SPRING.release;
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) {
      s.bv += ((-c.stiffness * (s.bx - s.tx) - c.damping * s.bv) / c.mass) * h; s.bx += s.bv * h;
      s.byv += ((-c.stiffness * (s.by - s.ty) - c.damping * s.byv) / c.mass) * h; s.by += s.byv * h;
      s.lv += ((-c.stiffness * (s.lx - s.tx * 0.4) - c.damping * s.lv) / c.mass) * h; s.lx += s.lv * h;
      s.lyv += ((-c.stiffness * (s.ly - s.ty * 0.4) - c.damping * s.lyv) / c.mass) * h; s.ly += s.lyv * h;
    }
    if (body.current) body.current.style.translate = `${s.bx.toFixed(2)}px ${s.by.toFixed(2)}px`;
    if (label.current) label.current.style.translate = `${s.lx.toFixed(2)}px ${s.ly.toFixed(2)}px`;
    const home = !s.tx && !s.ty && Math.abs(s.bx) + Math.abs(s.by) + Math.abs(s.lx) + Math.abs(s.ly) < 0.05 && Math.abs(s.bv) + Math.abs(s.byv) < 0.2;
    if (home) {
      Object.assign(s, { bx: 0, bv: 0, by: 0, byv: 0, lx: 0, lv: 0, ly: 0, lyv: 0 });
      if (body.current) body.current.style.translate = '';
      if (label.current) label.current.style.translate = '';
      runningRef.current = false;
      setRunning(false);
    }
  }, running && enabled);
}

/* ── The single primary action, repeated with the same label ─────────── */
export function Cta({ label = 'Create a free inbox', note = 'Free up to 10,000 deliveries a month. No card.', magnetic = false, reduced = false }: { label?: string; note?: string; magnetic?: boolean; reduced?: boolean }) {
  const [said, setSaid] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const body = useRef<HTMLButtonElement>(null);
  const face = useRef<HTMLSpanElement>(null);
  useMagnet(anchor, body, face, magnetic && !reduced);
  return (
    <div className={styles.ctaWrap}>
      <span ref={anchor} className={styles.ctaAnchor}>
        <button ref={body} type="button" className={styles.primary} onClick={() => setSaid(true)}><span ref={face} className={styles.ctaFace}>{label}</span></button>
      </span>
      <p className={styles.ctaNote} aria-live="polite">{said ? 'Demo only: sign-up would start here with an email and a password, nothing else.' : note}</p>
    </div>
  );
}

/* ── How it works: capture → inspect → replay, each a working fragment ── */
const STEPS = ['Capture', 'Inspect', 'Replay'] as const;

export function HowItWorks({ reduced }: { reduced: boolean }) {
  const uid = useId();
  const [tab, setTab] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const ind = useIndicator(list, tab);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const to = e.key === 'ArrowRight' ? (i + 1) % 3 : e.key === 'ArrowLeft' ? (i + 2) % 3 : e.key === 'Home' ? 0 : e.key === 'End' ? 2 : null;
    if (to === null) return;
    e.preventDefault();
    setTab(to);
    tabs.current[to]?.focus();
  };
  return (
    <div className={styles.how}>
      <div ref={list} className={styles.tabs} role="tablist" aria-label="How Tarn works">
        <Indicator state={ind} />
        {STEPS.map((s, i) => (
          <button key={s} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" data-ind id={`${uid}t${i}`} aria-selected={tab === i}
            aria-controls={`${uid}p${i}`} tabIndex={tab === i ? 0 : -1} className={styles.tab} onClick={() => setTab(i)} onKeyDown={(e) => onKey(e, i)}>
            <span className={styles.tabNum} aria-hidden="true">{i + 1}</span>{s}
          </button>
        ))}
      </div>
      <div id={`${uid}p0`} role="tabpanel" aria-labelledby={`${uid}t0`} hidden={tab !== 0} className={styles.panel}><Capture reduced={reduced} /></div>
      <div id={`${uid}p1`} role="tabpanel" aria-labelledby={`${uid}t1`} hidden={tab !== 1} className={styles.panel}><Inspect /></div>
      <div id={`${uid}p2`} role="tabpanel" aria-labelledby={`${uid}t2`} hidden={tab !== 2} className={styles.panel}><Replay reduced={reduced} /></div>
    </div>
  );
}

function Capture({ reduced }: { reduced: boolean }) {
  const uid = useId();
  const [copied, setCopied] = useState<'idle' | 'ok' | 'manual'>('idle');
  const [events, setEvents] = useState<{ n: number; at: string }[]>([]);
  const field = useRef<HTMLInputElement>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(INBOX_URL); setCopied('ok'); }
    catch { setCopied('manual'); field.current?.focus(); field.current?.select(); }
  };
  const send = () => setEvents((e) => [{ n: e.length + 1, at: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...e].slice(0, 4));
  return (
    <div className={styles.panelGrid}>
      <div className={styles.panelCopy}>
        <h3 className={styles.panelTitle}>Give your provider one URL.</h3>
        <p>Every inbox has its own address. Paste it where your payments provider, shop or CRM asks for a webhook endpoint; Tarn answers 200 once a delivery is stored and keeps the raw bytes.</p>
      </div>
      <div className={styles.fragment}>
        <label htmlFor={`${uid}url`} className={styles.fLabel}>Webhook endpoint</label>
        <div className={styles.urlRow}>
          <input id={`${uid}url`} ref={field} className={styles.urlField} readOnly value={INBOX_URL} />
          <button type="button" className={styles.smallBtn} onClick={copy}>{copied === 'ok' ? 'Copied' : 'Copy'}</button>
        </div>
        <p className={styles.fHint} aria-live="polite">{copied === 'manual' ? 'Copying isn’t available here: the address is selected, copy it with your keyboard.' : copied === 'ok' ? 'Copied to the clipboard.' : 'Sample address (.example domains never resolve).'}</p>
        <button type="button" className={styles.smallBtn} onClick={send}>Send a test event</button>
        <ul className={styles.feed} aria-live="polite" aria-label="Received test events">
          {events.map((e) => (
            <li key={e.n} data-new={!reduced || undefined}><StatusChip status={200} /> <span className={styles.mono}>ping.test</span> <span className={styles.dimText}>stored at {e.at}</span></li>
          ))}
          {events.length === 0 ? <li className={styles.dimText}>No test events yet.</li> : null}
        </ul>
      </div>
    </div>
  );
}

function Inspect() {
  const ok = PASSED.body.split('\n');
  const bad = FAILED.body.split('\n');
  return (
    <div className={styles.panelGrid}>
      <div className={styles.panelCopy}>
        <h3 className={styles.panelTitle}>Compare the one that failed.</h3>
        <p>Pick two deliveries and Tarn lines them up. Here the failing invoice has three lines where every invoice that went through had one, which is the bug: the handler assumed a single line.</p>
      </div>
      <div className={styles.fragment}>
        <p className={styles.fLabel}>dlv_0192 <StatusChip status={200} /> → dlv_0193 <StatusChip status={500} /></p>
        <pre className={styles.diff}><code>
          {ok.map((line, i) => (line === bad[i]
            ? <span key={i} className={styles.dCtx}>{'  '}{line}{'\n'}</span>
            : <span key={i}><span className={styles.dDel}><span aria-hidden="true">− </span><span className={styles.srOnly}>passed: </span>{line.trimStart()}{'\n'}</span><span className={styles.dAdd} data-clue={/"lines"/.test(line) || undefined}><span aria-hidden="true">+ </span><span className={styles.srOnly}>failed: </span>{bad[i].trimStart()}{'\n'}</span></span>))}
        </code></pre>
      </div>
    </div>
  );
}

function Replay({ reduced }: { reduced: boolean }) {
  const uid = useId();
  const [target, setTarget] = useState<Target>('localhost');
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle');
  const [result, setResult] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const t = TARGETS.find((x) => x.id === target) ?? TARGETS[0];
  const run = () => {
    setPhase('busy');
    timer.current = window.setTimeout(() => { setPhase('done'); setResult(`200 OK in ${target === 'localhost' ? 84 : 132} ms from ${t.label}`); }, reduced ? 350 : 900);
  };
  const press = () => { if (phase === 'busy') return; if (target === 'production' && phase !== 'confirm') { setPhase('confirm'); return; } run(); };
  return (
    <div className={styles.panelGrid}>
      <div className={styles.panelCopy}>
        <h3 className={styles.panelTitle}>Replay it where you fixed it.</h3>
        <p>Send the original bytes and headers to your laptop, staging or production. A replay is marked with an <code className={styles.mono}>X-Tarn-Replay</code> header so your logs can tell it apart.</p>
      </div>
      <div className={styles.fragment}>
        <fieldset className={styles.targets}>
          <legend className={styles.fLabel}>Replay dlv_0193 to</legend>
          {TARGETS.map((x) => (
            <label key={x.id} className={styles.target}>
              <input type="radio" name={`${uid}target`} checked={target === x.id} onChange={() => { setTarget(x.id); setPhase('idle'); setResult(null); }} />
              <span><span className={styles.targetName}>{x.label}</span><span className={styles.dimText}>{x.note}</span></span>
            </label>
          ))}
        </fieldset>
        {phase === 'confirm' ? (
          <div className={styles.confirm} role="alert">
            <p>Replay to <span className={styles.mono}>{t.url}</span>? Your production handler will run again for this invoice.</p>
            <div className={styles.confirmRow}>
              <button type="button" className={styles.dangerBtn} onClick={run}>Replay to production</button>
              <button type="button" className={styles.smallBtn} onClick={() => setPhase('idle')}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className={styles.replayBtn} onClick={press} aria-busy={phase === 'busy' || undefined}>
            {phase === 'busy' ? 'Replaying…' : `Replay to ${t.label}`}
          </button>
        )}
        <p className={styles.fHint} role="status">{result ? <><StatusChip status={200} /> {result} <span className={styles.dimText}>(simulated)</span></> : ''}</p>
        {result ? <pre className={styles.code}><code><Json text={'{ "received": true, "invoice": "in_4Xa91" }'} /></code></pre> : null}
      </div>
    </div>
  );
}

/* ── Pricing ───────────────────────────────────────────────────────────── */
export function Pricing({ reduced }: { reduced: boolean }) {
  const uid = useId();
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const group = useRef<HTMLDivElement>(null);
  const ind = useIndicator(group, period === 'monthly' ? 0 : 1);
  const team = PLANS.find((p) => p.id === 'team') ?? PLANS[1];
  const monthsFree = Math.round((team.monthly * 12 - team.yearly) / team.monthly);
  const [said, setSaid] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const choose = (p: 'monthly' | 'yearly') => {
    setPeriod(p);
    setSaid(p === 'yearly' ? `Showing yearly prices. Team is ${formatUsd(team.yearly / 12)} a month, billed ${formatUsd(team.yearly)} a year.` : `Showing monthly prices. Team is ${formatUsd(team.monthly)} a month.`);
  };
  return (
    <div className={styles.pricing}>
      <fieldset className={styles.billing}>
        <legend className={styles.srOnly}>Billing period</legend>
        <div ref={group} className={styles.billingTrack}>
          <Indicator state={ind} className={styles.billingInd} />
          {(['monthly', 'yearly'] as const).map((p) => (
            <label key={p} data-ind className={styles.billingOpt}>
              <input type="radio" name={`${uid}period`} value={p} checked={period === p} onChange={() => choose(p)} />
              <span>{p === 'monthly' ? 'Monthly' : 'Yearly'}</span>
              {p === 'yearly' ? <span className={styles.save}>{monthsFree} months free</span> : null}
            </label>
          ))}
        </div>
      </fieldset>
      <p className={styles.srOnly} role="status">{said}</p>
      <div className={styles.plans}>
        {PLANS.map((p) => {
          const perMonth = period === 'monthly' ? p.monthly : p.yearly / 12;
          const primary = !!p.recommended;
          return (
            <article key={p.id} className={styles.plan} data-recommended={primary || undefined} aria-labelledby={`${uid}${p.id}`}>
              {p.recommended ? <p className={styles.badge}>Recommended</p> : null}
              <h3 id={`${uid}${p.id}`} className={styles.planName}>{p.name}</h3>
              <p className={styles.forWhom}>{p.forWhom}</p>
              <p className={styles.priceLine}>
                <Ticker value={perMonth} format={(n) => formatUsd(n)} reduced={reduced} className={styles.amount} />
                <span className={styles.unit}>per workspace / month</span>
              </p>
              <p className={styles.billed}>{p.monthly === 0 ? 'Free, no card' : period === 'yearly' ? `Billed ${formatUsd(p.yearly)} yearly` : 'Billed monthly, cancel any time'}</p>
              <p className={styles.quota}>{p.quota}</p>
              <ul className={styles.features}>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              {p.recommended ? <p className={styles.why}>{p.recommended}</p> : null}
              <button type="button" className={primary ? styles.primary : styles.secondary} onClick={() => setPicked(p.cta)}>{p.cta}</button>
            </article>
          );
        })}
      </div>
      <p className={styles.ctaNote} aria-live="polite">{picked ? `Demo only: “${picked}” would open sign-up here. Trials need no card and end without charging you.` : ''}</p>
      <p className={styles.overage}><strong>Over your quota?</strong> {OVERAGE} Prices are sample data in US dollars, excluding VAT where it applies.</p>
    </div>
  );
}

/* ── FAQ: the accordion-height-auto technique (grid rows 0fr → 1fr), with this page’s questions ── */
export function Faq() {
  const uid = useId();
  const [open, setOpen] = useState<number | null>(null);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = FAQ.length - 1;
    const to = e.key === 'ArrowDown' ? (i === last ? 0 : i + 1) : e.key === 'ArrowUp' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (to === null) return;
    e.preventDefault();
    btns.current[to]?.focus();
  };
  return (
    <div className={styles.faq}>
      {FAQ.map((f, i) => (
        <div key={f.q} className={styles.qItem} data-open={open === i || undefined}>
          <h3 className={styles.qHeading}>
            <button ref={(el) => { btns.current[i] = el; }} type="button" id={`${uid}q${i}`} aria-expanded={open === i} aria-controls={`${uid}a${i}`}
              className={styles.qBtn} onClick={() => setOpen(open === i ? null : i)} onKeyDown={(e) => onKey(e, i)}>
              <span>{f.q}</span>
              <span className={styles.qIcon} aria-hidden="true"><i /><i /></span>
            </button>
          </h3>
          <div id={`${uid}a${i}`} role="region" aria-labelledby={`${uid}q${i}`} className={styles.qPanel}>
            <div className={styles.qInner}>{f.a.map((p) => <p key={p}>{p}</p>)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Section({ id, label, title, intro, children, headingRef }: { id: string; label: string; title: ReactNode; intro?: ReactNode; children: ReactNode; headingRef?: (el: HTMLHeadingElement | null) => void }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-h`}>
      <div className={styles.sectionHead}>
        <p className={styles.kicker}>{label}</p>
        <h2 id={`${id}-h`} ref={headingRef} tabIndex={-1} className={styles.h2}>{title}</h2>
        {intro ? <p className={styles.intro}>{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}
