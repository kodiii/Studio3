'use client';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { cssEase, duration as D, spring as SPRING, springToLinear, stepSpring, useElementSize, useIsomorphicLayoutEffect, useSettleLoop } from '../../../motion';
import { DELIVERIES, FAILED, INBOX_URL, secondsOf, type Delivery } from './content';
import styles from './styles.module.css';

const POP = springToLinear(SPRING.pop);
const DAY = 86400;
/** Deliveries in time order (the list shows them newest first). */
const BY_TIME = [...DELIVERIES].sort((a, b) => secondsOf(a.at) - secondsOf(b.at));
const hhmm = (sec: number) => { const s = Math.max(0, Math.min(DAY - 1, Math.round(sec))); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`; };
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** Minimal JSON tokeniser for the payload view (keys, strings, numbers, punctuation). */
export function Json({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?)|(true|false|null)|([{}[\],])/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] && m[2]) out.push(<span key={k++} className={styles.jKey}>{m[1]}</span>, m[2]);
    else if (m[1]) out.push(<span key={k++} className={styles.jStr}>{m[1]}</span>);
    else if (m[3] || m[4]) out.push(<span key={k++} className={styles.jNum}>{m[3] ?? m[4]}</span>);
    else out.push(<span key={k++} className={styles.jPunct}>{m[5]}</span>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

export function StatusChip({ status, chip }: { status: number; chip?: string }) {
  const ok = status < 400;
  return <span className={styles.status} data-ok={ok} data-chip={chip}>{status}<span className={styles.srOnly}>{ok ? ' OK' : ' error'}</span></span>;
}

interface Attempt { status: number; ms: number; label: string }

/* ── Yesterday, as a strip you can scrub ───────────────────────────────────
   Each delivery is a tick at its time of day (height = response time, colour = status). The playhead is a spring:
   drag it and the delivery under it is selected live; let go and it keeps its velocity, then settles on the
   nearest delivery. The list rows are its twin, and the arrow keys step between deliveries. */
function Timeline({ selected, onSelect, statusOf, reduced }: { selected: Delivery; onSelect: (id: string) => void; statusOf: (d: Delivery) => number; reduced: boolean }) {
  const uid = useId();
  const track = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const size = useElementSize(track);
  const sim = useRef({ x: reduced ? secondsOf(selected.at) : 0, v: 0, target: secondsOf(selected.at) });
  const drag = useRef<{ id: number } | null>(null);
  const last = useRef(selected.id);

  const write = useCallback(() => {
    const el = head.current;
    if (!el || size.width < 1) return;
    el.style.transform = `translateX(${((sim.current.x / DAY) * size.width).toFixed(2)}px)`;
    if (label.current) label.current.textContent = hhmm(sim.current.x);
  }, [size.width]);
  // The playhead's spring: while held it chases the hand on `press`; let go, it lands on `release` and the loop sleeps.
  const wake = useSettleLoop(track, (dt) => {
    const s = sim.current, held = !!drag.current;
    const settled = stepSpring(s, s.target, held ? SPRING.press : SPRING.release, dt, held ? undefined : { restDelta: 8, restSpeed: 30 });
    write();
    if (held) { const d = nearest(s.x); if (d.id !== last.current) { last.current = d.id; onSelect(d.id); } }
    return !held && settled;
  }, !reduced);
  useEffect(() => { write(); }, [write]);

  // The list (or the keyboard) chose a delivery: glide there.
  useEffect(() => {
    if (drag.current) return;
    last.current = selected.id;
    sim.current.target = secondsOf(selected.at);
    if (reduced) { sim.current.x = sim.current.target; sim.current.v = 0; write(); } else wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.id, reduced]);

  const nearest = (sec: number) => BY_TIME.reduce((b, d) => (Math.abs(secondsOf(d.at) - sec) < Math.abs(secondsOf(b.at) - sec) ? d : b), BY_TIME[0]);

  const timeAt = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    return r && r.width > 0 ? Math.max(0, Math.min(DAY - 1, ((clientX - r.left) / r.width) * DAY)) : sim.current.x;
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId };
    head.current?.focus({ preventScroll: true });
    sim.current.target = timeAt(e.clientX);
    if (reduced) { sim.current.x = sim.current.target; write(); const d = nearest(sim.current.x); if (d.id !== last.current) { last.current = d.id; onSelect(d.id); } } else wake();
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    sim.current.target = timeAt(e.clientX);
    if (reduced) { sim.current.x = sim.current.target; write(); const d = nearest(sim.current.x); if (d.id !== last.current) { last.current = d.id; onSelect(d.id); } }
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    // Keep the throw: project the release along its velocity, then settle on the delivery nearest to that point.
    const s = sim.current;
    const d = nearest(s.x + s.v * 0.2);
    last.current = d.id;
    s.target = secondsOf(d.at);
    onSelect(d.id);
    if (reduced) { s.x = s.target; write(); } else wake();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = BY_TIME.findIndex((d) => d.id === selected.id);
    const to = e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown' ? i - 1
      : e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp' ? i + 1
        : e.key === 'Home' ? 0 : e.key === 'End' ? BY_TIME.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const d = BY_TIME[Math.max(0, Math.min(BY_TIME.length - 1, to))];
    if (d.id !== selected.id) onSelect(d.id);
  };

  const st = statusOf(selected);
  return (
    <div className={styles.timeline}>
      <div className={styles.tlHead}>
        <span id={`${uid}tl`}>Yesterday · {DELIVERIES.length} deliveries</span>
        <span className={styles.tlHint} aria-hidden="true">Tick height = response time</span>
      </div>
      <div ref={track} className={styles.tlTrack} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {[0, 6, 12, 18].map((h) => <span key={h} className={styles.tlHour} style={{ left: `${(h / 24) * 100}%`, translate: h ? undefined : '0 0' }} aria-hidden="true">{String(h).padStart(2, '0')}</span>)}
        {BY_TIME.map((d, i) => {
          const status = statusOf(d);
          return (
            <span key={d.id} className={styles.tlTick} data-ok={status < 400} data-on={d.id === selected.id || undefined} data-chip={d.id}
              style={{ left: `${(secondsOf(d.at) / DAY) * 100}%`, height: `${Math.round(22 + (d.ms / 320) * 70)}%`, '--i': i } as CSSProperties} aria-hidden="true" />
          );
        })}
        <div ref={head} className={styles.playhead} role="slider" tabIndex={0} aria-labelledby={`${uid}tl`}
          aria-valuemin={0} aria-valuemax={DAY - 1} aria-valuenow={secondsOf(selected.at)}
          aria-valuetext={`${selected.at}, ${selected.event}, ${st} ${st < 400 ? 'OK' : 'error'}`} onKeyDown={onKey}>
          <span className={styles.phLine} aria-hidden="true" />
          <span className={styles.phKnob} aria-hidden="true"><span ref={label}>{hhmm(sim.current.x)}</span></span>
        </div>
      </div>
    </div>
  );
}

export function Inbox({ reduced }: { reduced: boolean }) {
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const rowInd = useRef<HTMLSpanElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const code = useRef<HTMLPreElement>(null);
  const path = useRef<SVGPathElement>(null);
  const packet = useRef<HTMLSpanElement>(null);
  const endpoint = useRef<HTMLSpanElement>(null);
  const burst = useRef<HTMLSpanElement>(null);
  const [selectedId, setSelectedId] = useState(FAILED.id);
  const [attempts, setAttempts] = useState<Record<string, Attempt[]>>({});
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const anims = useRef(new Set<Animation>());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; const set = anims.current; return () => { alive.current = false; for (const a of set) a.cancel(); }; }, []);
  const track = (a: Animation | undefined | null) => { if (!a) return a; anims.current.add(a); const off = () => anims.current.delete(a); a.finished.then(off, off); return a; };

  const selected = DELIVERIES.find((d) => d.id === selectedId) ?? FAILED;
  const list_ = attempts[selected.id] ?? [];
  const latest = (d: Delivery) => (attempts[d.id] ?? []).at(-1)?.status ?? d.status;
  const fixed = list_.some((a) => a.status < 400);

  // The selection highlight slides between rows (measured once per change, moved with a transform).
  useIsomorphicLayoutEffect(() => {
    const row = list.current?.querySelector<HTMLElement>(`[data-row="${selected.id}"]`);
    const ind = rowInd.current;
    if (!row || !ind) return;
    ind.style.transform = `translateY(${row.offsetTop}px)`;
    ind.style.height = `${row.offsetHeight}px`;
  }, [selected.id]);
  // The payload view eases in on every change of delivery (scrubbing reads as flipping through the day).
  const first = useRef(true);
  useIsomorphicLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduced) return;
    for (const el of [detail.current, code.current]) track(el?.animate([{ opacity: 0.35, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: D.base, easing: cssEase('emphasized') }));
  }, [selected.id]);

  const select = useCallback((id: string) => setSelectedId(id), []);

  /** The signature replay: the payload leaves its row along a drawn path, reaches the endpoint, and the 500 springs to 200. */
  const replay = async () => {
    if (busy) return;
    const id = selected.id;
    setBusy(true);
    setSaid('Replaying to localhost:3000…');
    const commit = () => {
      const a: Attempt = { status: 200, ms: 84, label: 'Replay to localhost:3000' };
      flushSync(() => setAttempts((m) => ({ ...m, [id]: [...(m[id] ?? []), a] })));
      setBusy(false);
      setSaid(`Replay finished: 200 OK in ${a.ms} milliseconds (simulated).`);
    };
    const b = body.current, p = path.current, pk = packet.current, ep = endpoint.current;
    const fromEl = root.current?.querySelector<HTMLElement>(`[data-row="${id}"] [data-chip]`);
    if (reduced || !b || !p || !pk || !ep || !fromEl || typeof pk.animate !== 'function') {
      await wait(350);
      if (!alive.current) return;
      commit();
      return;
    }
    const br = b.getBoundingClientRect(), fr = fromEl.getBoundingClientRect(), tr = ep.getBoundingClientRect();
    const sx = fr.right - br.left + 4, sy = fr.top + fr.height / 2 - br.top;
    const ex = tr.left - br.left + 12, ey = tr.top + tr.height / 2 - br.top;
    // An arc, not a line: the path rises out of the row and drops onto the endpoint.
    const lift = Math.max(60, Math.abs(ex - sx) * 0.35);
    const d = `M${sx.toFixed(1)} ${sy.toFixed(1)} C${(sx + (ex - sx) * 0.35).toFixed(1)} ${(Math.min(sy, ey) - lift).toFixed(1)}, ${(ex - (ex - sx) * 0.15).toFixed(1)} ${(Math.min(sy, ey) - lift * 0.6).toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    p.setAttribute('d', d);
    pk.style.offsetPath = `path('${d}')`;
    b.dataset.replaying = '';
    track(p.animate([{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], { duration: D.slow, easing: cssEase('emphasized'), fill: 'forwards' }));
    const travel = track(pk.animate([
      { offsetDistance: '0%', transform: 'scale(0.4)', opacity: 0 },
      { offsetDistance: '6%', transform: 'scale(1.06)', opacity: 1, offset: 0.14 },
      { offsetDistance: '100%', transform: 'scale(0.8)', opacity: 1 },
    ], { duration: 820, delay: 120, easing: cssEase('inOut'), fill: 'forwards' }));
    try { await travel?.finished; } catch { return; }
    if (!alive.current) return;
    // Arrival: the endpoint takes the hit, the chips squash, the answer comes back 200 and springs out.
    track(ep.animate([{ transform: 'scale(1.1)' }, { transform: 'none' }], { duration: POP.duration, easing: POP.easing }));
    track(pk.animate([{ opacity: 1, transform: 'scale(0.8)' }, { opacity: 0, transform: 'scale(0.3)' }], { duration: D.fast, easing: cssEase('exit'), fill: 'forwards' }));
    const chips = () => [...(root.current?.querySelectorAll<HTMLElement>(`[data-chip="${id}"]`) ?? [])];
    const squash = chips().map((c) => track(c.animate([{ transform: 'none' }, { transform: 'scale(0.55, 0.8)', opacity: 0.25 }], { duration: 110, easing: cssEase('exit'), fill: 'forwards' })));
    await wait(110);
    if (!alive.current) return;
    commit();
    for (const s of squash) s?.cancel();
    for (const c of chips()) track(c.animate([{ transform: 'scale(0.55, 0.8)', opacity: 0.25 }, { transform: 'none', opacity: 1 }], { duration: POP.duration, easing: POP.easing }));
    const resp = root.current?.querySelector<HTMLElement>(`[data-resp] [data-chip="${id}"]`);
    const bu = burst.current;
    if (resp && bu) {
      const rr = resp.getBoundingClientRect();
      bu.style.left = `${(rr.left + rr.width / 2 - br.left).toFixed(1)}px`;
      bu.style.top = `${(rr.top + rr.height / 2 - br.top).toFixed(1)}px`;
      [...bu.children].forEach((ray, i) => {
        const ang = (i / bu.children.length) * 360 + 22.5;
        track((ray as HTMLElement).animate([
          { transform: `rotate(${ang}deg) translateX(10px) scaleX(0.2)`, opacity: 0 },
          { transform: `rotate(${ang}deg) translateX(18px) scaleX(1)`, opacity: 1, offset: 0.35 },
          { transform: `rotate(${ang}deg) translateX(30px) scaleX(0.3)`, opacity: 0 },
        ], { duration: D.slow, easing: cssEase('emphasized'), fill: 'forwards' }));
      });
    }
    track(p.animate([{ strokeDashoffset: 0, opacity: 1 }, { strokeDashoffset: -1, opacity: 0.2 }], { duration: D.moderate, delay: D.fast, easing: cssEase('exit'), fill: 'forwards' }))?.finished.then(() => { delete b.dataset.replaying; }, () => {});
  };

  return (
    <div ref={root} className={styles.window} role="group" aria-label="Tarn inbox, sample data">
      <div className={styles.winBar}>
        <span className={styles.winDots} aria-hidden="true"><i /><i /><i /></span>
        <span className={styles.winTitle}>payments</span>
        <span className={styles.winUrl}>{INBOX_URL}</span>
        <span className={styles.sampleTag}>Sample data</span>
      </div>
      <Timeline selected={selected} onSelect={select} statusOf={latest} reduced={reduced} />
      <div ref={body} className={styles.winBody}>
        <div className={styles.listWrap}>
        <span ref={rowInd} className={styles.rowInd} aria-hidden="true" />
        <ul ref={list} className={styles.deliveries} aria-label="Deliveries">
          {DELIVERIES.map((d) => (
            <li key={d.id} data-row={d.id}>
              <button type="button" className={styles.delivery} aria-pressed={selected.id === d.id} onClick={() => select(d.id)}>
                <StatusChip status={latest(d)} chip={d.id} />
                <span className={styles.dEvent}>{d.event}</span>
                <span className={styles.dMeta}>{d.source} · {d.at}</span>
              </button>
            </li>
          ))}
        </ul>
        </div>
        <div className={styles.detail}>
          <div ref={detail}>
            <p className={styles.reqLine}><span className={styles.method}>POST</span> /hooks/{selected.source} <span className={styles.dimText}>· {selected.id} · yesterday {selected.at}</span></p>
            <p className={styles.respLine} data-resp="">
              <StatusChip status={latest(selected)} chip={selected.id} />{' '}
              <span>{fixed ? 'Replay answered 200 OK in 84 ms (simulated). The original 500 stays in the history.' : selected.status >= 400 ? 'Your endpoint answered 500: TypeError, lines.map is not a function' : `Delivered in ${selected.ms} ms`}</span>
            </p>
          </div>
          <p className={styles.replayTarget}>
            <span className={styles.fLabel}>Target</span>
            <span ref={endpoint} className={styles.endpoint}><span className={styles.endDot} aria-hidden="true" />localhost:3000<span className={styles.dimText}>/hooks/{selected.source}</span></span>
          </p>
          <div className={styles.replayRow}>
            <button type="button" className={styles.replayBtn} onClick={() => void replay()} aria-busy={busy || undefined} aria-describedby={`${uid}said`}>
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" /><path d="M2.5 2.5v3h3" /></svg>
              {busy ? 'Replaying…' : fixed ? 'Replay again' : 'Replay to localhost:3000'}
            </button>
            <p id={`${uid}said`} className={styles.said} role="status">{said || (selected.status >= 400 && !fixed ? 'Fixed the bug? Replay the exact delivery that failed.' : 'Replay any delivery, as many times as you need.')}</p>
          </div>
          {list_.length ? (
            <ol className={styles.attempts} aria-label="History">
              <li><StatusChip status={selected.status} /> Original delivery · {selected.ms} ms</li>
              {list_.map((a, i) => <li key={i} data-new={i === list_.length - 1 || undefined}><StatusChip status={a.status} /> {a.label} · {a.ms} ms <span className={styles.dimText}>(simulated)</span></li>)}
            </ol>
          ) : null}
          <pre ref={code} className={styles.code}><code><Json text={selected.body} /></code></pre>
        </div>
        <svg className={styles.flight} aria-hidden="true" focusable="false"><path ref={path} pathLength={1} /></svg>
        <span ref={packet} className={styles.packet} aria-hidden="true">{'{ }'} evt</span>
        <span ref={burst} className={styles.burst} aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</span>
      </div>
    </div>
  );
}
