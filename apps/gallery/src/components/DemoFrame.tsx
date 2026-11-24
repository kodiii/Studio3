'use client';
import type { DemoMeta } from '@maquettekit/library/types';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CodeViewer } from './CodeViewer';
import { DemoStage } from './DemoStage';
import { useSettings } from './Providers';
import { Wordmark } from './SiteHeader';

const WIDTHS = [{ id: 'full', label: 'Full', w: null }, { id: 'tablet', label: '820', w: 820 }, { id: 'mobile', label: '390', w: 390 }] as const;

/** Slim chrome around a full-page demo: back link, device width, reduced motion, notes + source drawer. */
export function DemoFrame({ meta }: { meta: DemoMeta }) {
  const { reduced, setReduced, theme, setTheme } = useSettings();
  const [width, setWidth] = useState<(typeof WIDTHS)[number]['id']>('full');
  const [info, setInfo] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const w = WIDTHS.find((x) => x.id === width)?.w ?? null;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (info && !d.open) d.showModal();
    if (!info && d.open) d.close();
  }, [info]);

  return (
    <div data-specialty={meta.specialty} className="min-h-dvh bg-surface-2">
      <div className="sticky top-0 z-50 flex h-11 items-center justify-between gap-3 border-b border-line bg-bg px-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/studios/${meta.specialty}`} className="mk-label flex shrink-0 items-center gap-2 text-muted hover:text-ink">
            <span aria-hidden="true">←</span><Wordmark className="text-base text-ink" /><span className="mk-sr-only">: back to the {meta.specialty} studio</span>
          </Link>
          <h1 className="truncate text-sm font-medium">{meta.name}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div role="radiogroup" aria-label="Preview width" className="hidden gap-0.5 md:flex">
            {WIDTHS.map((x) => (
              <label key={x.id} className="mk-label cursor-pointer rounded-full border border-transparent px-2 py-1 text-muted has-checked:border-line-strong has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-focus">
                <input type="radio" name="demo-width" className="mk-sr-only" checked={width === x.id} onChange={() => setWidth(x.id)} />{x.label}
              </label>
            ))}
          </div>
          <button type="button" aria-pressed={reduced} onClick={() => setReduced(!reduced)} className="mk-label rounded-full border border-line px-2.5 py-1 aria-pressed:bg-ink aria-pressed:text-bg">Reduce motion</button>
          <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="mk-label hidden rounded-full border border-line px-2.5 py-1 aria-pressed:bg-ink aria-pressed:text-bg sm:block">Dark</button>
          <button type="button" onClick={() => setInfo(true)} aria-haspopup="dialog" className="mk-label rounded-full bg-ink px-2.5 py-1 text-bg">Notes &amp; source</button>
        </div>
      </div>

      <div className="mx-auto bg-bg transition-[max-width] duration-300 ease-emphasized" style={{ maxWidth: w ?? '100%', boxShadow: w ? '0 0 0 1px var(--mk-line)' : undefined }} data-demo-width={width}>
        <DemoStage specialty={meta.specialty} id={meta.id} />
      </div>

      <dialog ref={dialog} onClose={() => setInfo(false)} aria-labelledby="demo-info-title"
        className="m-0 ml-auto h-dvh max-h-none w-[min(720px,100vw)] max-w-none border-l border-line bg-bg p-0 text-ink backdrop:bg-black/40">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 id="demo-info-title" className="font-display text-xl font-semibold tracking-tight">{meta.name}</h2>
          <button type="button" onClick={() => setInfo(false)} className="mk-label rounded-full border border-line px-3 py-1.5">Close</button>
        </div>
        <div className="grid gap-7 overflow-y-auto p-5" style={{ maxHeight: 'calc(100dvh - 57px)' }}>
          <p className="text-base leading-relaxed">{meta.summary}</p>
          {meta.dataNote ? <p className="border-l-2 border-signal pl-3 text-sm"><strong>Data:</strong> {meta.dataNote}</p> : null}
          {([['What it demonstrates', meta.highlights], ['Accessibility', meta.accessibility], ['Performance', meta.performance]] as const).map(([t, items]) => (
            <section key={t}>
              <h3 className="mk-label border-b border-line pb-2 text-muted">{t}</h3>
              <ul className="mt-3 grid gap-2 text-sm leading-relaxed">{items.map((i) => <li key={i} className="grid grid-cols-[auto_1fr] gap-2.5"><span aria-hidden="true" className="mt-[0.6em] h-px w-3 bg-signal" />{i}</li>)}</ul>
            </section>
          ))}
          <section>
            <h3 className="mk-label border-b border-line pb-2 text-muted">Reduced motion</h3>
            <p className="mt-3 text-sm leading-relaxed">{meta.reducedMotion}</p>
          </section>
          {meta.uses.length ? (
            <section>
              <h3 className="mk-label border-b border-line pb-2 text-muted">Recipes composed</h3>
              <ul className="mt-3 flex flex-wrap gap-1.5">{meta.uses.map((u) => <li key={u}><Link href={`/effects/${u}`} className="rounded-full border border-line px-2.5 py-1 font-mono text-xs hover:border-line-strong">{u}</Link></li>)}</ul>
            </section>
          ) : null}
          {meta.adapts?.length ? (
            <section>
              <h3 className="mk-label border-b border-line pb-2 text-muted">Techniques adapted from (re-implemented, not imported)</h3>
              <ul className="mt-3 flex flex-wrap gap-1.5">{meta.adapts.map((u) => <li key={u}><Link href={`/effects/${u}`} className="rounded-full border border-dashed border-line px-2.5 py-1 font-mono text-xs hover:border-line-strong">{u}</Link></li>)}</ul>
            </section>
          ) : null}
          <section>
            <h3 className="mk-label mb-3 text-muted">Source — library/src/demos/{meta.specialty}/{meta.id}</h3>
            {info ? <CodeViewer kind="demos" id={`${meta.specialty}--${meta.id}`} /> : null}
          </section>
        </div>
      </dialog>
    </div>
  );
}
