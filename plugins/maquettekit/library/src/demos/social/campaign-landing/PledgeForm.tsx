'use client';
/**
 * The participation flow: pledge one mend. Errors appear on blur (once a field was touched) and on submit, with
 * aria-invalid + aria-describedby; a failed submit moves focus to the first problem and gives the key a short shake.
 * Nothing personal is required (the name is optional), showing the entry in the gallery is opt-in, and nothing leaves
 * the page.
 *
 * The submit key follows the morph-submit-button technique: the pill collapses into a ring whose arc fills ever more
 * slowly while the (simulated) request runs, closes, draws a check, and only then hands over to the confirmation —
 * with a small burst of patches thrown from the key, once, for the person's own pledge. Every step starts from what is
 * on screen, and everything is cancelled on edit or unmount. Reduced motion: no morph, arc or burst; the label says
 * "Pledging…" and the confirmation appears.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { cssEase, duration as D, spring, springToLinear, useStudioMotion } from '../../../motion';
import { CAFES, CATEGORIES } from './data';
import styles from './styles.module.css';

export interface Pledge { item: string; category: string; where: string; name: string; gallery: boolean }
type Field = 'item' | 'category' | 'where' | 'name';
type Phase = 'idle' | 'sending' | 'success';
const ORDER: Field[] = ['item', 'category', 'where', 'name'];
const LATENCY = 900; // simulated request
const SETTLE = springToLinear(spring.settle);
const BURST = ['#f0b44c', '#f0b44c', '#ff8a6b', '#34478a', '#f0b44c', '#f3efe6', '#ff8a6b', '#34478a', '#f0b44c', '#f0b44c'];

function validate(v: Pledge): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {};
  const item = v.item.trim();
  if (item.length < 3) e.item = item ? 'A few more letters, please — at least 3.' : 'Tell us the one thing you will mend.';
  else if (item.length > 60) e.item = 'Keep it under 60 characters so it fits the share card.';
  if (!v.category) e.category = 'Choose what kind of thing it is.';
  if (!v.where) e.where = 'Choose a café, or “At home”.';
  if (v.name.trim().length > 40) e.name = 'Keep the name under 40 characters.';
  return e;
}

export function PledgeForm({ onPledged, onEdit }: { onPledged: (p: Pledge) => void; onEdit: () => void }) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const [v, setV] = useState<Pledge>({ item: '', category: '', where: '', name: '', gallery: false });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [tried, setTried] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [phase, setPhase] = useState<Phase>('idle');
  const [say, setSay] = useState('');
  const doneHead = useRef<HTMLHeadingElement>(null);
  const donePanel = useRef<HTMLDivElement>(null);
  const check = useRef<SVGPathElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const burstLayer = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const ring = useRef<SVGSVGElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const mark = useRef<SVGPathElement>(null);
  const run = useRef(0);
  const live = useRef(new Set<Animation>());
  const timers = useRef(new Set<number>());
  const burstFrom = useRef<{ x: number; y: number } | null>(null);

  const stopAll = () => {
    run.current++;
    live.current.forEach((a) => a.cancel()); live.current.clear();
    timers.current.forEach((t) => window.clearTimeout(t)); timers.current.clear();
  };
  useEffect(() => () => {
    run.current++;
    live.current.forEach((a) => a.cancel());
    timers.current.forEach((t) => window.clearTimeout(t));
    burstLayer.current?.replaceChildren();
  }, []);
  const animate = (el: Element | null, k: Keyframe[], o: KeyframeAnimationOptions): Animation | null => {
    if (!el || typeof el.animate !== 'function') return null;
    const a = el.animate(k, o);
    live.current.add(a);
    const off = () => live.current.delete(a);
    a.finished.then(off, off);
    return a;
  };
  const wait = (ms: number) => new Promise<void>((resolve) => {
    const t = window.setTimeout(() => { timers.current.delete(t); resolve(); }, ms);
    timers.current.add(t);
  });

  /** A handful of patches thrown up from the key on ballistic arcs (sampled into keyframes), then removed. */
  const burst = (x: number, y: number) => {
    const layer = burstLayer.current;
    if (!layer || reduced || typeof layer.animate !== 'function') return;
    BURST.forEach((c, i) => {
      const el = document.createElement('span');
      el.className = styles.burstPatch;
      el.style.setProperty('--c', c);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      layer.appendChild(el);
      const ang = (-150 + (i / (BURST.length - 1)) * 120 + (Math.random() - 0.5) * 14) * (Math.PI / 180);
      const v = 300 + Math.random() * 190, g = 1150, spin = (Math.random() - 0.5) * 720, life = 0.8 + Math.random() * 0.25;
      const frames: Keyframe[] = [];
      for (let k = 0; k <= 10; k++) {
        const t = (k / 10) * life;
        const px = Math.cos(ang) * v * t, py = Math.sin(ang) * v * t + 0.5 * g * t * t;
        frames.push({ transform: `translate(-50%, -50%) translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) rotate(${(spin * t).toFixed(0)}deg) scale(${k === 0 ? 0.3 : 1})`, opacity: k < 7 ? 1 : 1 - (k - 6) / 4 });
      }
      const a = animate(el, frames, { duration: life * 1000, easing: 'linear', fill: 'forwards' });
      const gone = () => el.remove();
      if (a) a.finished.then(gone, gone); else gone();
    });
  };

  const errors = validate(v);
  const show = (f: Field) => (tried || touched[f]) && errors[f];
  const id = (s: string) => `${uid}-${s}`;
  const set = <K extends keyof Pledge>(k: K, val: Pledge[K]) => setV((p) => ({ ...p, [k]: val }));
  const described = (f: Field, hint?: boolean) => [hint ? id(`${f}-hint`) : '', show(f) ? id(`${f}-err`) : ''].filter(Boolean).join(' ') || undefined;

  useEffect(() => {
    if (status !== 'done') return;
    doneHead.current?.focus();
    const from = burstFrom.current;
    burstFrom.current = null;
    if (reduced) return;
    if (from) burst(from.x, from.y);
    const panel = donePanel.current;
    const list: Animation[] = [];
    if (panel && typeof panel.animate === 'function') list.push(panel.animate([{ opacity: 0, transform: 'translateY(14px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: SETTLE.duration, easing: SETTLE.easing }));
    const p = check.current;
    if (p && typeof p.animate === 'function') list.push(p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: D.slow, delay: D.fast, easing: cssEase('emphasized'), fill: 'backwards' }));
    return () => list.forEach((a) => a.cancel());
  }, [status, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    setTried(true);
    const bad = ORDER.filter((f) => errors[f]);
    if (bad.length) {
      setSay(`${bad.length === 1 ? 'One answer needs' : `${bad.length} answers need`} attention.`);
      const first = bad[0];
      const target = first === 'category' ? document.querySelector<HTMLInputElement>(`input[name="${id('category')}"]`) : document.getElementById(id(first));
      target?.focus();
      if (!reduced) animate(btn.current, [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: D.slow * 0.8, easing: 'ease-out' });
      return;
    }
    stopAll();
    const my = run.current;
    const pledge = { ...v, item: v.item.trim(), name: v.name.trim() };
    setStatus('sending');
    setPhase('sending');
    setSay('Saving your pledge…');
    const finish = () => {
      const b = btn.current?.getBoundingClientRect(), w = wrap.current?.getBoundingClientRect();
      burstFrom.current = b && w ? { x: b.left + b.width / 2 - w.left, y: b.top + b.height / 2 - w.top } : null;
      setStatus('done'); setPhase('idle'); setSay(''); onPledged(pledge);
    };
    if (reduced) { await wait(LATENCY); if (my === run.current) finish(); return; }

    // 1 · the pill collapses into a ring; the arc fills on a curve that never completes by itself.
    const b = btn.current;
    const from = b?.getBoundingClientRect();
    animate(label.current, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: D.fast, easing: cssEase('exit'), fill: 'forwards' });
    if (b && from) animate(b, [{ width: `${from.width}px` }, { width: `${from.height}px` }], { duration: D.moderate, easing: cssEase('emphasized'), fill: 'forwards' });
    animate(ring.current, [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'none' }], { duration: D.base, delay: D.moderate * 0.55, easing: cssEase('emphasized'), fill: 'both' });
    const fill = animate(arc.current, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0.1 }], { duration: LATENCY * 1.5, delay: D.moderate * 0.55, easing: cssEase('enter'), fill: 'both' });
    await wait(LATENCY);
    if (my !== run.current) return;
    // 2 · the request is back: close the ring, draw the check, hold a beat, then the confirmation takes over.
    const atNow = arc.current ? parseFloat(getComputedStyle(arc.current).strokeDashoffset) || 0 : 0;
    fill?.cancel();
    animate(arc.current, [{ strokeDashoffset: atNow }, { strokeDashoffset: 0 }], { duration: D.fast, easing: cssEase('standard'), fill: 'forwards' });
    await wait(D.fast);
    if (my !== run.current) return;
    setPhase('success');
    animate(ring.current, [{ opacity: 1 }, { opacity: 0 }], { duration: D.base, easing: 'linear', fill: 'forwards' });
    animate(mark.current, [{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], { duration: D.moderate, delay: 60, easing: cssEase('emphasized'), fill: 'both' });
    await wait(D.moderate + D.base);
    if (my !== run.current) return;
    finish();
  };

  if (status === 'done') {
    return (
      <div ref={wrap} className={styles.pledgeWrap}>
      <div ref={donePanel} className={styles.done}>
        <svg viewBox="0 0 64 64" className={styles.doneMark} aria-hidden="true" focusable="false">
          <rect x="6" y="6" width="52" height="52" rx="4" className={styles.donePatch} />
          <path ref={check} d="M18 33l10 10 18-22" pathLength={1} className={styles.doneCheck} />
        </svg>
        <h3 ref={doneHead} tabIndex={-1} className={styles.doneTitle}>Pledged: {v.item.trim()}</h3>
        <p>
          See you in March. Mend it {v.where === 'At home' ? 'at home' : `at ${v.where}`} any day from 1 to 31 March 2027
          {v.gallery ? ', and your before-and-after can go in the gallery.' : '. Your pledge stays out of the gallery, as you chose.'}
        </p>
        <p className={styles.small}>Demo: nothing was sent or stored. Edit it, or make a share card below.</p>
        <button type="button" className={styles.ghost} onClick={() => { stopAll(); setStatus('idle'); onEdit(); }}>Edit pledge</button>
      </div>
      <div ref={burstLayer} className={styles.burstLayer} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div ref={wrap} className={styles.pledgeWrap}>
    <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate aria-describedby={id('privacy')}>
      <div className={styles.field}>
        <label htmlFor={id('item')} className={styles.label}>What will you mend?</label>
        <p id={id('item-hint')} className={styles.small}>One thing is plenty: a jumper, a lamp, a wobbly chair.</p>
        <input id={id('item')} className={styles.input} value={v.item} maxLength={80} autoComplete="off"
          aria-invalid={show('item') ? true : undefined} aria-describedby={described('item', true)}
          onChange={(e) => set('item', e.target.value)} onBlur={() => setTouched((t) => ({ ...t, item: true }))} />
        {show('item') ? <p id={id('item-err')} className={styles.error}>{errors.item}</p> : null}
      </div>

      <fieldset className={styles.field}>
        <legend className={styles.label}>What kind of thing is it?</legend>
        <div className={styles.choices}>
          {[...CATEGORIES, 'Something else'].map((c) => (
            <label key={c} className={styles.choice}>
              <input type="radio" name={id('category')} value={c} checked={v.category === c}
                aria-invalid={show('category') ? true : undefined} aria-describedby={show('category') ? id('category-err') : undefined}
                onChange={() => { set('category', c); setTouched((t) => ({ ...t, category: true })); }} />
              <span>{c}</span>
            </label>
          ))}
        </div>
        {show('category') ? <p id={id('category-err')} className={styles.error}>{errors.category}</p> : null}
      </fieldset>

      <div className={styles.field}>
        <label htmlFor={id('where')} className={styles.label}>Where will you mend it?</label>
        <select id={id('where')} className={styles.input} value={v.where}
          aria-invalid={show('where') ? true : undefined} aria-describedby={described('where')}
          onChange={(e) => set('where', e.target.value)} onBlur={() => setTouched((t) => ({ ...t, where: true }))}>
          <option value="">Choose…</option>
          <option>At home</option>
          {CAFES.map((c) => <option key={c}>{c}</option>)}
        </select>
        {show('where') ? <p id={id('where-err')} className={styles.error}>{errors.where}</p> : null}
      </div>

      <div className={styles.field}>
        <label htmlFor={id('name')} className={styles.label}>Name to show <span className={styles.optional}>(optional)</span></label>
        <p id={id('name-hint')} className={styles.small}>Leave it blank to stay anonymous.</p>
        <input id={id('name')} className={styles.input} value={v.name} maxLength={60} autoComplete="nickname"
          aria-invalid={show('name') ? true : undefined} aria-describedby={described('name', true)}
          onChange={(e) => set('name', e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: true }))} />
        {show('name') ? <p id={id('name-err')} className={styles.error}>{errors.name}</p> : null}
      </div>

      <label className={styles.check}>
        <input type="checkbox" checked={v.gallery} onChange={(e) => set('gallery', e.target.checked)} />
        <span>Show my before-and-after in the 2027 gallery (you can change your mind later)</span>
      </label>

      <div className={styles.submitRow}>
        <span className={styles.morphSlot}>
          {/* The slot keeps the widest label's width, so nothing around the key moves while it morphs. */}
          <span className={styles.morphSizer} aria-hidden="true"><span>Pledge my mend</span><span>Pledging…</span></span>
          <button ref={btn} type="submit" className={`${styles.primary} ${styles.morphKey}`} data-phase={phase}
            aria-busy={phase === 'sending' || undefined} aria-disabled={status === 'sending' || undefined}>
            <span ref={label} className={styles.morphLabel}>{status === 'sending' ? 'Pledging…' : 'Pledge my mend'}</span>
            <svg ref={ring} className={styles.morphRing} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle className={styles.morphTrack} cx="12" cy="12" r="10" />
              <circle ref={arc} className={styles.morphArc} cx="12" cy="12" r="10" pathLength={1} transform="rotate(-90 12 12)" />
            </svg>
            <svg className={styles.morphMark} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path ref={mark} className={styles.morphCheck} d="m7 12.5 3.4 3.4L17.2 8.6" pathLength={1} />
            </svg>
          </button>
        </span>
        <p id={id('privacy')} className={styles.small}>No email needed. Demo: your pledge stays on this page.</p>
      </div>
      <p className="mk-sr-only" role="status" aria-live="polite">{say}</p>
    </form>
    <div ref={burstLayer} className={styles.burstLayer} aria-hidden="true" />
    </div>
  );
}
