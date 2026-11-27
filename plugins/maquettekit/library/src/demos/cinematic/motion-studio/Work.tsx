'use client';
/**
 * Selected work. Each card is a lit object on the light table: it leans toward the pointer on a token spring (the
 * feature card is heavier: it leans less and settles on spring.glide), lifts as it is hovered (its soft shadow
 * lengthens away from the page lamp, the contact shadow shrinks), presses down within a frame and pops back. The
 * hovered card plays its still. "View" opens a modal case sheet whose artwork flies out of the card (FLIP on
 * spring.glide) and flies back, faster, on close. The heart is the lottie-micro-interactions LottieIcon.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { duration as D, spring, springToLinear, useRafLoop, useStudioMotion, type SpringConfig } from '../../../motion';
import { ICONS, LottieIcon } from '../../../effects/lottie-micro-interactions';
import { CASES, type CaseId, type CaseStudy } from './content';
import { CaseArt } from './art';
import s from './styles.module.css';

const HEART = ICONS.heart.build(2);
const GLIDE = springToLinear(spring.glide);

type Channel = 'rx' | 'ry' | 'lift';
const CH: readonly Channel[] = ['rx', 'ry', 'lift'];

/** Tilt and lift on a token spring, one loop per card that runs only while the card is moving. */
function useCardPhysics(card: React.RefObject<HTMLElement | null>, max: number, cfg: SpringConfig, off: boolean) {
  const sim = useRef({ x: { rx: 0, ry: 0, lift: 0 }, v: { rx: 0, ry: 0, lift: 0 }, t: { rx: 0, ry: 0, lift: 0 } });
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const write = () => {
    const el = card.current;
    if (!el) return;
    const { x } = sim.current;
    el.style.setProperty('--rx', x.rx.toFixed(3));
    el.style.setProperty('--ry', x.ry.toFixed(3));
    el.style.setProperty('--lift', x.lift.toFixed(3));
  };
  const aim = (t: Partial<Record<Channel, number>>) => {
    Object.assign(sim.current.t, t);
    if (!runningRef.current) { runningRef.current = true; setRunning(true); }
  };
  useRafLoop(card, (dt) => {
    const q = sim.current;
    const n = Math.max(1, Math.ceil(dt * 240));
    const h = dt / n;
    for (let i = 0; i < n; i++) for (const c of CH) {
      q.v[c] += ((-cfg.stiffness * (q.x[c] - q.t[c]) - cfg.damping * q.v[c]) / cfg.mass) * h;
      q.x[c] += q.v[c] * h;
    }
    write();
    if (CH.every((c) => Math.abs(q.x[c] - q.t[c]) < 0.002 && Math.abs(q.v[c]) < 0.02)) {
      for (const c of CH) { q.x[c] = q.t[c]; q.v[c] = 0; }
      write();
      runningRef.current = false;
      setRunning(false);
    }
  }, running && !off);
  useEffect(() => {
    if (!off) return;
    const q = sim.current;
    for (const c of CH) { q.x[c] = 0; q.v[c] = 0; q.t[c] = 0; }
    card.current?.style.removeProperty('--rx');
    card.current?.style.removeProperty('--ry');
    card.current?.style.removeProperty('--lift');
  }, [off, card]);
  return {
    move: (e: ReactPointerEvent<HTMLElement>) => {
      if (off || e.pointerType === 'touch') return;
      const r = e.currentTarget.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width - 0.5, v = (e.clientY - r.top) / r.height - 0.5;
      aim({ rx: -v * max, ry: u * max, lift: 1 });
    },
    leave: () => { if (!off) aim({ rx: 0, ry: 0, lift: 0 }); },
    focus: () => { if (!off) aim({ rx: max * 0.3, ry: -max * 0.45, lift: 1 }); },
  };
}

function Card({ c, saved, onSave, onOpen, reduced, fine }: {
  c: CaseStudy; saved: boolean; onSave: (id: CaseId, on: boolean) => void;
  onOpen: (c: CaseStudy, art: HTMLElement | null) => void; reduced: boolean; fine: boolean;
}) {
  const card = useRef<HTMLElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);
  const [pressed, setPressed] = useState(false);
  // Mass by size: the feature card is heavier, so it leans less and settles slower.
  const phys = useCardPhysics(card, c.feature ? 4 : 7, c.feature ? spring.glide : spring.settle, reduced || !fine);
  return (
    <article
      ref={card}
      className={s.card}
      data-lit=""
      data-feature={c.feature || undefined}
      data-play={(play && !reduced) || undefined}
      data-pressed={pressed || undefined}
      onPointerEnter={(e) => { if (e.pointerType !== 'touch') setPlay(true); }}
      onPointerMove={phys.move}
      onPointerLeave={() => { setPlay(false); setPressed(false); phys.leave(); }}
      onPointerDown={(e) => { if (e.button === 0 && !(e.target as Element).closest('[data-save]')) setPressed(true); }}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onFocus={(e) => { if ((e.target as Element).matches(':focus-visible')) { setPlay(true); phys.focus(); } }}
      onBlur={() => { setPlay(false); phys.leave(); }}
    >
      <span className={s.cardShadow} aria-hidden="true" />
      <div className={s.cardBody}>
        <div ref={art} className={s.cardArt} aria-hidden="true"><CaseArt id={c.id} /><span className={s.cardSheen} /></div>
        <div className={s.cardText}>
          <p className={s.cardKind}>{c.kind} <span aria-hidden="true">·</span> {c.year}</p>
          <h3 className={s.cardTitle}>
            <button type="button" className={s.cardOpen} data-cursor-label="View" aria-haspopup="dialog" onClick={() => onOpen(c, art.current)}>
              <span className={s.cardClient}>{c.client}</span>
              <span className={s.cardLine}>{c.title}</span>
            </button>
          </h3>
        </div>
        <span className={s.saveWrap} data-save="" data-cursor="magnet">
          <LottieIcon
            animationData={HEART}
            segments={ICONS.heart.segments}
            grid={24}
            size={22}
            label={`Save ${c.client}`}
            pressed={saved}
            onToggle={(v) => onSave(c.id, v)}
            className={s.save}
          />
        </span>
      </div>
    </article>
  );
}

function useFine(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const up = () => setFine(mq.matches);
    up();
    mq.addEventListener('change', up);
    return () => mq.removeEventListener('change', up);
  }, []);
  return fine;
}

export function Work({ saved, onSave }: { saved: ReadonlySet<CaseId>; onSave: (id: CaseId, on: boolean) => void }) {
  const { reduced } = useStudioMotion();
  const fine = useFine();
  const [open, setOpen] = useState<{ c: CaseStudy; from: HTMLElement | null; aspect: number } | null>(null);
  const onOpen = useCallback((c: CaseStudy, from: HTMLElement | null) => {
    const r = from?.getBoundingClientRect();
    setOpen({ c, from, aspect: r && r.height ? r.width / r.height : 4 / 3 });
  }, []);
  return (
    <>
      <ul className={s.workGrid}>
        {CASES.map((c) => (
          <li key={c.id} className={s.workCell} data-case={c.id} data-reveal="">
            <Card c={c} saved={saved.has(c.id)} onSave={onSave} onOpen={onOpen} reduced={reduced} fine={fine} />
          </li>
        ))}
      </ul>
      {open ? <CaseDialog key={open.c.id} {...open} saved={saved.has(open.c.id)} onSave={onSave} reduced={reduced} onClosed={() => setOpen(null)} /> : null}
    </>
  );
}

function CaseDialog({ c, from, aspect, saved, onSave, reduced, onClosed }: {
  c: CaseStudy; from: HTMLElement | null; aspect: number; saved: boolean; onSave: (id: CaseId, on: boolean) => void; reduced: boolean; onClosed: () => void;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const live = useRef<Animation[]>([]);
  const closing = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = `ll-case-${c.id}`;
  const flyFrom = useMemo(() => () => from?.getBoundingClientRect() ?? null, [from]);

  const stop = () => { for (const a of live.current) a.cancel(); live.current = []; };
  useEffect(() => () => stop(), []);

  useLayoutEffect(() => {
    const d = dlg.current, a = art.current, p = panel.current;
    if (!d || !a || !p) return;
    opener.current = document.activeElement as HTMLElement | null;
    const src = flyFrom();
    d.showModal();
    close.current?.focus({ preventScroll: true });
    if (reduced) {
      live.current.push(d.animate({ opacity: [0, 1] }, { duration: D.fast, easing: 'linear' }));
      return;
    }
    const dst = a.getBoundingClientRect();
    if (src && dst.width && dst.height) {
      from?.closest('article')?.setAttribute('data-flying', '');
      const k = src.width / dst.width;
      live.current.push(a.animate(
        [{ transformOrigin: '0 0', transform: `translate(${src.left - dst.left}px, ${src.top - dst.top}px) scale(${k})`, borderRadius: '10px' }, { transformOrigin: '0 0', transform: 'none' }],
        { duration: GLIDE.duration, easing: GLIDE.easing },
      ));
    }
    live.current.push(d.animate({ opacity: [0, 1] }, { duration: D.base, easing: 'linear', pseudoElement: '::backdrop' }));
    Array.from(p.children).forEach((el, i) => {
      live.current.push(el.animate(
        [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }],
        { duration: D.slow, delay: 140 + i * 48, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' },
      ));
    });
  }, [flyFrom, from, reduced]);

  const requestClose = useCallback(() => {
    const d = dlg.current, a = art.current, p = panel.current;
    if (!d || closing.current) return;
    closing.current = true;
    stop();
    const done = () => {
      from?.closest('article')?.removeAttribute('data-flying');
      if (d.open) d.close();
      const back = opener.current;
      onClosed();
      if (back && back.isConnected) back.focus({ preventScroll: true });
    };
    if (reduced || !a || !p) {
      const fade = d.animate({ opacity: [1, 0] }, { duration: D.fast, easing: 'linear', fill: 'forwards' });
      fade.finished.then(done, done);
      return;
    }
    // Exits are quicker than entrances: the sheet fades first, the art flies home on a firmer curve.
    const src = flyFrom();
    const dst = a.getBoundingClientRect();
    const onScreen = src && src.bottom > 0 && src.top < window.innerHeight;
    const anims: Animation[] = [
      p.animate({ opacity: [1, 0], transform: ['none', 'translateY(10px)'] }, { duration: D.fast, easing: 'cubic-bezier(0.3, 0, 0.8, 0.15)', fill: 'forwards' }),
      d.animate({ opacity: [1, 0] }, { duration: D.moderate, easing: 'linear', fill: 'forwards', pseudoElement: '::backdrop' }),
      onScreen && dst.width
        ? a.animate(
          [{ transformOrigin: '0 0', transform: 'none' }, { transformOrigin: '0 0', transform: `translate(${src.left - dst.left}px, ${src.top - dst.top}px) scale(${src.width / dst.width})`, borderRadius: '10px' }],
          { duration: D.moderate, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'forwards' },
        )
        : a.animate({ opacity: [1, 0] }, { duration: D.fast, easing: 'linear', fill: 'forwards' }),
    ];
    live.current = anims;
    Promise.all(anims.map((x) => x.finished)).then(done, done);
  }, [flyFrom, from, onClosed, reduced]);

  return (
    <dialog
      ref={dlg}
      className={s.dialog}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); requestClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <div className={s.dialogInner} onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}>
        <div ref={art} className={s.dialogArt} style={{ aspectRatio: String(aspect) } as CSSProperties} aria-hidden="true"><CaseArt id={c.id} /></div>
        <div ref={panel} className={s.dialogPanel}>
          <p className={s.kicker}>Case study <span aria-hidden="true">·</span> sample work <span aria-hidden="true">·</span> {c.year}</p>
          <h3 id={titleId} className={s.dialogTitle}>{c.client}</h3>
          <p className={s.dialogLede}>{c.title}</p>
          <p className={s.dialogBody} data-cursor="text">{c.summary}</p>
          <div>
            <h4 className={s.dialogH4}>What we did</h4>
            <ul className={s.dialogList}>{c.did.map((d) => <li key={d}>{d}</li>)}</ul>
          </div>
          <div className={s.dialogActions}>
            <LottieIcon
              animationData={HEART}
              segments={ICONS.heart.segments}
              grid={24}
              size={22}
              label={`Save ${c.client}`}
              pressed={saved}
              onToggle={(v) => onSave(c.id, v)}
              className={s.savePill}
            >
              <span>Save to shortlist</span>
            </LottieIcon>
            <button ref={close} type="button" className={s.ghostButton} onClick={requestClose}>Close</button>
          </div>
          <p className={s.fine}>{c.client} is a fictional client and this is sample work: there is no full case study to read.</p>
        </div>
      </div>
    </dialog>
  );
}
