'use client';
/**
 * The participation flow: pledge one mend. Errors appear on blur (once a field was touched) and on submit, with
 * aria-invalid + aria-describedby; a failed submit moves focus to the first problem. Nothing personal is required
 * (the name is optional), showing the entry in the gallery is opt-in, and nothing leaves the page.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { duration as D, useStudioMotion } from '../../../motion';
import { CAFES, CATEGORIES } from './data';
import styles from './styles.module.css';

export interface Pledge { item: string; category: string; where: string; name: string; gallery: boolean }
type Field = 'item' | 'category' | 'where' | 'name';
const ORDER: Field[] = ['item', 'category', 'where', 'name'];

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
  const [say, setSay] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneHead = useRef<HTMLHeadingElement>(null);
  const check = useRef<SVGPathElement>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const errors = validate(v);
  const show = (f: Field) => (tried || touched[f]) && errors[f];
  const id = (s: string) => `${uid}-${s}`;
  const set = <K extends keyof Pledge>(k: K, val: Pledge[K]) => setV((p) => ({ ...p, [k]: val }));
  const described = (f: Field, hint?: boolean) => [hint ? id(`${f}-hint`) : '', show(f) ? id(`${f}-err`) : ''].filter(Boolean).join(' ') || undefined;

  useEffect(() => {
    if (status !== 'done') return;
    doneHead.current?.focus();
    const p = check.current;
    if (!p || reduced || typeof p.animate !== 'function') return;
    const a = p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: D.slow, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    return () => a.cancel();
  }, [status, reduced]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    setTried(true);
    const bad = ORDER.filter((f) => errors[f]);
    if (bad.length) {
      setSay(`${bad.length === 1 ? 'One answer needs' : `${bad.length} answers need`} attention.`);
      const first = bad[0];
      const target = first === 'category' ? document.querySelector<HTMLInputElement>(`input[name="${id('category')}"]`) : document.getElementById(id(first));
      target?.focus();
      return;
    }
    setStatus('sending');
    setSay('Saving your pledge…');
    timer.current = setTimeout(() => { setStatus('done'); setSay(''); onPledged({ ...v, item: v.item.trim(), name: v.name.trim() }); }, 700);
  };

  if (status === 'done') {
    return (
      <div className={styles.done}>
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
        <button type="button" className={styles.ghost} onClick={() => { setStatus('idle'); onEdit(); }}>Edit pledge</button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-describedby={id('privacy')}>
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
        <button type="submit" className={styles.primary} aria-disabled={status === 'sending' || undefined}>
          {status === 'sending' ? 'Pledging…' : 'Pledge my mend'}
        </button>
        <p id={id('privacy')} className={styles.small}>No email needed. Demo: your pledge stays on this page.</p>
      </div>
      <p className="mk-sr-only" role="status" aria-live="polite">{say}</p>
    </form>
  );
}
