'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createSequence, distance, duration as D, useIsomorphicLayoutEffect, useStudioMotion, type Sequence } from '../../motion';
import type { EffectProps } from '../../types';
import styles from './styles.module.css';

type Params = { entrance: string; stagger: number; dim: number; shortcut: boolean; closeOnRun: boolean };

interface Command { id: string; group: string; label: string; keys?: string }

/** Sample commands. Running one only reports its name: nothing is executed. */
const COMMANDS: readonly Command[] = [
  { id: 'projects', group: 'Navigate', label: 'Go to projects', keys: 'G P' },
  { id: 'inbox', group: 'Navigate', label: 'Go to inbox', keys: 'G I' },
  { id: 'settings', group: 'Navigate', label: 'Open settings', keys: 'G S' },
  { id: 'new-project', group: 'Create', label: 'New project', keys: 'N' },
  { id: 'new-note', group: 'Create', label: 'New meeting note' },
  { id: 'invite', group: 'Create', label: 'Invite a teammate' },
  { id: 'theme', group: 'Preferences', label: 'Switch colour theme' },
  { id: 'shortcuts', group: 'Preferences', label: 'Show keyboard shortcuts', keys: '?' },
];

/** Case-insensitive match: contiguous substring first, otherwise in-order subsequence. Returns matched indices. */
function match(label: string, query: string): number[] | null {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const l = label.toLowerCase();
  const at = l.indexOf(q);
  if (at >= 0) return Array.from({ length: q.length }, (_, i) => at + i);
  const hits: number[] = [];
  let from = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const i = l.indexOf(ch, from);
    if (i < 0) return null;
    hits.push(i);
    from = i + 1;
  }
  return hits;
}

function highlight(label: string, hits: number[]): ReactNode {
  if (!hits.length) return label;
  const set = new Set(hits);
  const out: ReactNode[] = [];
  let buf = '';
  let marked = false;
  Array.from(label).forEach((ch, i) => {
    const m = set.has(i);
    if (m !== marked && buf) { out.push(marked ? <mark key={i}>{buf}</mark> : buf); buf = ''; }
    marked = m;
    buf += ch;
  });
  if (buf) out.push(marked ? <mark key="end">{buf}</mark> : buf);
  return out;
}

export default function CommandMenuReveal({ params }: EffectProps<Params>) {
  const { reduced, scale } = useStudioMotion();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [mac, setMac] = useState(false);

  const dialog = useRef<HTMLDialogElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const seqs = useRef<{ enter: Sequence | null; exit: Sequence | null; closing: boolean }>({ enter: null, exit: null, closing: false });

  const results = useMemo(() => {
    const out: { cmd: Command; hits: number[] }[] = [];
    for (const cmd of COMMANDS) { const hits = match(cmd.label, query); if (hits) out.push({ cmd, hits }); }
    return out;
  }, [query]);
  const groups = useMemo(() => {
    const g: { name: string; items: { cmd: Command; hits: number[]; index: number }[] }[] = [];
    results.forEach((r, index) => {
      let bucket = g.find((x) => x.name === r.cmd.group);
      if (!bucket) { bucket = { name: r.cmd.group, items: [] }; g.push(bucket); }
      bucket.items.push({ ...r, index });
    });
    return g;
  }, [results]);
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));
  const optionId = (i: number) => `${uid}opt${i}`;

  useEffect(() => { setMac(/Mac|iPhone|iPad/.test(navigator.platform)); }, []);

  const requestClose = useCallback(() => {
    const d = dialog.current;
    const s = seqs.current;
    if (!d?.open || s.closing) return;
    s.closing = true;
    // Single-keyframe steps animate from wherever the entrance currently is, so closing mid-entrance does not jump.
    const exit = createSequence({ reducedMotion: reduced, durationScale: scale.duration });
    exit
      .add(panel.current, [{ opacity: 0, transform: 'translateY(-6px) scale(0.985)' }], { duration: D.fast, easing: 'exit' })
      .add(backdrop.current, [{ opacity: 0 }], { duration: D.base, easing: 'linear', at: 0 });
    s.exit = exit;
    void exit.play().then(() => { if (dialog.current?.open) dialog.current.close(); });
  }, [reduced, scale.duration]);

  // Open: show the modal, then play backdrop → panel → rows as one sequence.
  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    const d = dialog.current;
    if (!d) return;
    const s = seqs.current;
    s.closing = false;
    if (!d.open) d.showModal();
    const from = params.entrance === 'rise' ? `translateY(${distance.base}px)` : params.entrance === 'scale' ? 'scale(0.94)' : `translateY(-${distance.short}px) scale(0.985)`;
    const enter = createSequence({ reducedMotion: reduced, durationScale: scale.duration });
    enter
      .add(backdrop.current, [{ opacity: 0 }, { opacity: 1 }], { duration: D.base, easing: 'linear' })
      .add(panel.current, [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }], { duration: D.moderate, easing: 'emphasized', at: 40 })
      .add(list.current?.querySelectorAll('[data-row]'), [{ opacity: 0, transform: `translateY(${distance.short / 1.5}px)` }, { opacity: 1, transform: 'none' }], { duration: D.base, easing: 'enter', at: 120, stagger: params.stagger * scale.stagger });
    s.enter = enter;
    void enter.play();
    return () => { s.enter?.cancel(); s.exit?.cancel(); s.enter = null; s.exit = null; };
    // Rows stagger on open only; filtering must not replay the entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Native close (our request, or anything else that closes the dialog) resets state.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onClose = () => { setOpen(false); setQuery(''); setActive(0); };
    const onCancel = (e: Event) => { e.preventDefault(); requestClose(); };
    d.addEventListener('close', onClose);
    d.addEventListener('cancel', onCancel);
    return () => { d.removeEventListener('close', onClose); d.removeEventListener('cancel', onCancel); if (d.open) d.close(); };
  }, [requestClose]);

  useEffect(() => {
    if (!params.shortcut) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey) || e.altKey) return;
      e.preventDefault();
      if (dialog.current?.open) requestClose(); else setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [params.shortcut, requestClose]);

  useEffect(() => {
    if (open) document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, open]);

  const run = (cmd: Command) => {
    setLastRun(cmd.label);
    if (params.closeOnRun) requestClose();
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = results.length;
    if (e.key === 'Enter') { e.preventDefault(); const r = results[activeIndex]; if (r) run(r.cmd); return; }
    if (!n) return;
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = (activeIndex + 1) % n;
    else if (e.key === 'ArrowUp') next = (activeIndex - 1 + n) % n;
    else if (e.key === 'Home' && e.ctrlKey) next = 0;
    else if (e.key === 'End' && e.ctrlKey) next = n - 1;
    else if (e.key === 'PageDown') next = n - 1;
    else if (e.key === 'PageUp') next = 0;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  };

  return (
    <div className={styles.root}>
      <button type="button" className={styles.trigger} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <span className={styles.triggerText}>Search or run a command</span>
        {params.shortcut ? <kbd className={styles.kbd}>{mac ? '⌘K' : 'Ctrl K'}</kbd> : null}
      </button>
      <p className={styles.status} role="status">
        <span className={styles.statusLabel}>Last run</span>
        <span>{lastRun ? `${lastRun} (sample action, nothing happened)` : 'Nothing yet'}</span>
      </p>

      <dialog ref={dialog} className={styles.dialog} aria-label="Command menu" style={{ ['--cm-dim' as string]: params.dim }}>
        {open ? (
          <>
            <div ref={backdrop} className={styles.backdrop} onPointerDown={requestClose} />
            <div ref={panel} className={styles.panel}>
              <div className={styles.search}>
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                <input
                  autoFocus
                  className={styles.input}
                  type="text"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={`${uid}list`}
                  aria-activedescendant={results.length ? optionId(activeIndex) : undefined}
                  aria-autocomplete="list"
                  aria-label="Search commands"
                  placeholder="Type a command…"
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                  onKeyDown={onInputKey}
                />
                <button type="button" className={styles.esc} onClick={requestClose} aria-label="Close command menu"><kbd>Esc</kbd></button>
              </div>
              <div ref={list} id={`${uid}list`} role="listbox" aria-label="Commands" className={styles.list}>
                {groups.map((g) => (
                  <div key={g.name} role="group" aria-labelledby={`${uid}g${g.name}`} className={styles.group}>
                    <div id={`${uid}g${g.name}`} data-row className={styles.groupLabel}>{g.name}</div>
                    {g.items.map(({ cmd, hits, index }) => (
                      <div
                        key={cmd.id}
                        id={optionId(index)}
                        role="option"
                        aria-selected={index === activeIndex}
                        data-row
                        className={styles.option}
                        onPointerMove={() => { if (index !== activeIndex) setActive(index); }}
                        onClick={() => run(cmd)}
                      >
                        <span className={styles.optionLabel}>{highlight(cmd.label, hits)}</span>
                        {cmd.keys ? <span className={styles.keys} aria-hidden="true">{cmd.keys.split(' ').map((k, i) => <kbd key={i}>{k}</kbd>)}</span> : null}
                      </div>
                    ))}
                  </div>
                ))}
                {results.length === 0 ? <p className={styles.empty} role="status">No commands match “{query}”.</p> : null}
              </div>
              <div className={styles.footer} aria-hidden="true">
                <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
                <span><kbd>↵</kbd> run</span>
                <span className={styles.footerNote}>{results.length} sample {results.length === 1 ? 'command' : 'commands'}</span>
              </div>
            </div>
          </>
        ) : null}
      </dialog>
    </div>
  );
}
