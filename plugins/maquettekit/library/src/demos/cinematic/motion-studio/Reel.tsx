'use client';
/**
 * The showreel: seven shots on one seekable Web Animations timeline (createSequence from the motion kit), so Play,
 * Pause and the scrubber all drive the same clock. Play is the lottie-micro-interactions play ⇄ pause icon. The reel
 * is motion as content, so it only ever moves after Play; under reduced motion each shot holds its final frame and
 * shots change with a 160 ms cross-fade. The timecode and scrubber are written straight to the DOM per frame.
 */
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createSequence, duration as D, useRafLoop, useStudioMotion, type Sequence } from '../../../motion';
import { ICONS, LottieIcon } from '../../../effects/lottie-micro-interactions';
import { REEL_MS, SHOTS, STUDIO, type ShotId } from './content';
import s from './stage.module.css';

const PLAY = ICONS.play.build(2);
const FPS = 24;
const EASE = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  enter: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  exit: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  overshoot: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

export const timecode = (ms: number): string => {
  const f = Math.floor((ms / 1000) * FPS);
  const ss = Math.floor(f / FPS), ff = f % FPS;
  return `${String(Math.floor(ss / 60)).padStart(2, '0')}:${String(ss % 60).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
};
const shotAt = (ms: number) => SHOTS.reduce((cur, sh) => (ms >= sh.at ? sh : cur), SHOTS[0]);

/** Bounce samples for the ball shot, in the 1600 × 900 viewBox: from off-screen left to the full stop. */
function ballKeys(end: { x: number; y: number }, r: number) {
  const g = 3600; // units / s²
  const floor = end.y;
  const hops = [
    { x0: -120, y0: 150, x1: end.x - 640, apex: 0 },
    { x1: end.x - 230, apex: 300 },
    { x1: end.x - 50, apex: 110 },
    { x1: end.x, apex: 34 },
  ];
  const frames: { t: number; x: number; y: number; sx: number; sy: number; rot: number }[] = [];
  let t = 0, x = hops[0].x0!, y = hops[0].y0!;
  hops.forEach((h, i) => {
    const v0 = i === 0 ? 0 : Math.sqrt(2 * g * h.apex);
    const yStart = i === 0 ? y : floor;
    const T = (v0 + Math.sqrt(v0 * v0 + 2 * g * (floor - yStart))) / g;
    const xStart = x;
    for (let k = 0; k < 12; k++) {
      const u = (k / 12) * T;
      const vy = -v0 + g * u;
      const vx = (h.x1 - xStart) / T;
      const st = Math.min(0.3, Math.hypot(vx, vy) / 5200);
      frames.push({ t: t + u, x: xStart + vx * u, y: yStart - v0 * u + 0.5 * g * u * u, sx: 1 + st, sy: 1 / (1 + st), rot: (Math.atan2(vy, vx) * 180) / Math.PI });
    }
    t += T;
    x = h.x1;
    // Contact: squash flat, then recover (two short frames).
    frames.push({ t, x, y: floor + r * 0.3, sx: 1.34, sy: 0.7, rot: 0 });
    frames.push({ t: t + 0.05, x, y: floor, sx: 0.94, sy: 1.06, rot: 0 });
    t += 0.05;
  });
  frames.push({ t: t + 0.16, x: end.x, y: floor, sx: 1, sy: 1, rot: 0 });
  return { frames, total: t + 0.16 };
}

function build(root: HTMLElement, reduced: boolean): Sequence {
  const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const qa = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
  const seq = createSequence();
  const XF = reduced ? D.fast : 1;
  // Visibility per shot: one animation per element, so earlier and later steps never fight over opacity.
  for (const sh of SHOTS) {
    const el = q(`[data-shot="${sh.id}"]`);
    if (!el) continue;
    const a = XF / sh.len;
    const last = sh.id === 'end';
    seq.add(el, [
      { opacity: 0, offset: 0 }, { opacity: 1, offset: Math.min(0.5, a) },
      { opacity: 1, offset: last ? 1 : 1 - Math.min(0.49, a) }, { opacity: last ? 1 : 0, offset: 1 },
    ], { at: sh.at, duration: sh.len, easing: 'linear' });
  }
  // The full stop sits after the real text, measured now that the fonts have loaded (reduced motion rests there too).
  const ball = q<SVGGElement>('[data-ball]');
  const line = q<SVGTextElement>('[data-ball-line]');
  const R = 22, base = 560;
  let ex = 1352;
  try { const bb = line?.getBBox(); if (bb && bb.width > 0) ex = bb.x + bb.width + 14 + R; } catch { /* not rendered */ }
  const ey = base - R;
  if (ball) ball.style.transform = `translate(${ex.toFixed(1)}px, ${ey}px)`;
  q('[data-ball-shadow]')?.setAttribute('cx', (ex + 4).toFixed(1));
  if (reduced) return seq;
  const S = Object.fromEntries(SHOTS.map((x) => [x.id, x.at])) as Record<ShotId, number>;

  // 1 · Slate: the board rises into frame, the stick opens wider (anticipation) and claps shut with a bounce.
  seq.add(q('[data-slate-board]'), [{ transform: 'translateY(115%)' }, { transform: 'translateY(-3%)', offset: 0.7 }, { transform: 'none' }], { at: S.slate + 80, duration: 760, easing: EASE.out });
  seq.add(q('[data-slate-stick]'), [
    { transform: 'rotate(0deg)' }, { transform: 'rotate(-24deg)', offset: 0.35 }, { transform: 'rotate(-31deg)', offset: 0.62 },
    { transform: 'rotate(0deg)', offset: 0.78 }, { transform: 'rotate(-4deg)', offset: 0.86 }, { transform: 'rotate(0deg)' },
  ], { at: S.slate + 300, duration: 1300, easing: 'linear' });
  seq.add(qa('[data-slate-tick]'), [{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1)', offset: 0.3 }, { opacity: 0, transform: 'scale(1.5)' }], { at: S.slate + 1320, duration: 420, easing: EASE.out, stagger: 30 });

  // 2 · Nothing stops dead: the words arrive lead-first, then the ball bounces in and lands as the full stop.
  seq.add(qa('[data-ball-word]'), [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'none' }], { at: S.ball + 120, duration: 620, easing: EASE.out, stagger: 110 });
  if (ball) {
    const { frames, total } = ballKeys({ x: ex, y: ey }, R);
    seq.add(ball, frames.map((f) => ({ offset: f.t / total, transform: `translate(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px) rotate(${f.rot.toFixed(1)}deg) scale(${f.sx.toFixed(3)}, ${f.sy.toFixed(3)}) rotate(${(-f.rot).toFixed(1)}deg)` })), { at: S.ball + 700, duration: total * 1000, easing: 'linear' });
    seq.add(q('[data-ball-shadow]'), [{ opacity: 0 }, { opacity: 0.22 }], { at: S.ball + 700 + total * 1000 - 200, duration: 200, easing: 'linear' });
  }
  // 3 · Tidewater: the tide runs under a wordmark whose letters ride the swell.
  qa('[data-tide-line]').forEach((el, i) => seq.add(el, [{ transform: 'translateX(0px)' }, { transform: `translateX(${i % 2 ? 160 : -160}px)` }], { at: S.tide, duration: 3200, easing: 'linear' }));
  qa('[data-tide-letter]').forEach((el, i) => seq.add(el, [
    { opacity: 0, transform: 'translateY(60%)' }, { opacity: 1, transform: 'translateY(-8%)', offset: 0.3 },
    { opacity: 1, transform: 'translateY(6%)', offset: 0.62 }, { opacity: 1, transform: 'translateY(0%)' },
  ], { at: S.tide + 160 + i * 55, duration: 2400, easing: EASE.inOut }));

  // 4 · The Night Ferry: the beam crosses the sea, the title surfaces, the ferry drifts.
  seq.add(q('[data-ferry-beam]'), [{ transform: 'rotate(-16deg)' }, { transform: 'rotate(10deg)' }], { at: S.ferry, duration: 3200, easing: EASE.inOut });
  seq.add(q('[data-ferry-boat]'), [{ transform: 'translateX(-60px)' }, { transform: 'translateX(40px)' }], { at: S.ferry, duration: 3200, easing: 'linear' });
  seq.add(q('[data-ferry-title]'), [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { at: S.ferry + 700, duration: 1100, easing: EASE.enter });
  seq.add(q('[data-ferry-credit]'), [{ opacity: 0 }, { opacity: 1 }], { at: S.ferry + 1500, duration: 700, easing: 'linear' });

  // 5 · Halden Type: weight lands on the beat, width breathes between.
  seq.add(q('[data-type-glyph]'), [
    { fontWeight: 200, fontStretch: '100%' }, { fontWeight: 800, fontStretch: '100%', offset: 0.32 },
    { fontWeight: 800, fontStretch: '75%', offset: 0.6 }, { fontWeight: 500, fontStretch: '100%', offset: 0.86 }, { fontWeight: 600, fontStretch: '100%' },
  ], { at: S.type + 150, duration: 2700, easing: EASE.inOut });
  seq.add(q('[data-type-knob]'), [{ transform: 'translateX(0%)' }, { transform: 'translateX(100%)', offset: 0.32 }, { transform: 'translateX(100%)', offset: 0.6 }, { transform: 'translateX(50%)', offset: 0.86 }, { transform: 'translateX(66%)' }], { at: S.type + 150, duration: 2700, easing: EASE.inOut });

  // 6 · Crumb: the phone lands, then the rolls hop in turn (squash on landing, stretch on take-off).
  seq.add(q('[data-crumb-phone]'), [{ transform: 'translateY(70%)' }, { transform: 'translateY(-4%)', offset: 0.68 }, { transform: 'none' }], { at: S.crumb + 60, duration: 820, easing: EASE.out });
  qa('[data-crumb-roll]').forEach((el, i) => seq.add(el, [
    { transform: 'translateY(0) scale(1, 1)' }, { transform: 'translateY(0) scale(1.18, 0.82)', offset: 0.12 },
    { transform: 'translateY(-70%) scale(0.9, 1.12)', offset: 0.3 }, { transform: 'translateY(-96%) scale(1, 1)', offset: 0.45 },
    { transform: 'translateY(0) scale(1.24, 0.78)', offset: 0.72 }, { transform: 'translateY(0) scale(0.96, 1.04)', offset: 0.84 },
    { transform: 'translateY(0) scale(1, 1)' },
  ], { at: S.crumb + 760 + i * 260, duration: 900, easing: 'linear' }));

  // 7 · End card: "Lead" arrives, "Lag" lags behind it and overshoots further. Follow-through, as a logo.
  seq.add(q('[data-end-lead]'), [{ opacity: 0, transform: 'translateX(-40%)' }, { opacity: 1, transform: 'translateX(3%)', offset: 0.6 }, { opacity: 1, transform: 'none' }], { at: S.end + 80, duration: 700, easing: EASE.out });
  seq.add(q('[data-end-amp]'), [{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1.12)', offset: 0.6 }, { opacity: 1, transform: 'none' }], { at: S.end + 220, duration: 600, easing: EASE.out });
  seq.add(q('[data-end-lag]'), [{ opacity: 0, transform: 'translateX(-90%)' }, { opacity: 1, transform: 'translateX(9%)', offset: 0.55 }, { opacity: 1, transform: 'translateX(-2%)', offset: 0.8 }, { opacity: 1, transform: 'none' }], { at: S.end + 300, duration: 1000, easing: EASE.out });
  seq.add(q('[data-end-mail]'), [{ opacity: 0 }, { opacity: 1 }], { at: S.end + 1100, duration: 600, easing: 'linear' });
  return seq;
}

export function Reel({ onPlaying }: { onPlaying: (playing: boolean) => void }) {
  const { reduced } = useStudioMotion();
  const uid = useId();
  const screen = useRef<HTMLDivElement>(null);
  const seq = useRef<Sequence | null>(null);
  const tc = useRef<Text | null>(null);
  const range = useRef<HTMLInputElement>(null);
  const shotName = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [said, setSaid] = useState('');
  const resumeAfterScrub = useRef(false);
  const onPlayingRef = useRef(onPlaying);
  onPlayingRef.current = onPlaying;

  /** Timecode, scrubber and shot name from the sequence clock (DOM writes, no render). */
  const paint = useCallback((ms?: number) => {
    const t = ms ?? (seq.current ? seq.current.progress * REEL_MS : 0);
    if (tc.current) tc.current.nodeValue = timecode(t);
    const r = range.current;
    if (r) {
      r.value = String(Math.round(t));
      r.setAttribute('aria-valuetext', `${timecode(t).slice(0, 5)} of ${timecode(REEL_MS).slice(0, 5)}, ${shotAt(t).label}`);
    }
    const label = shotAt(t).label;
    if (shotName.current && shotName.current.textContent !== label) shotName.current.textContent = label;
  }, []);

  /** The timeline is built on first use (fonts are in by then), and again when reduced motion changes. */
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const ensure = useCallback((): Sequence | null => {
    if (!seq.current && screen.current) seq.current = build(screen.current, reducedRef.current);
    return seq.current;
  }, []);
  const firstReduced = useRef(reduced);
  useEffect(() => {
    if (firstReduced.current === reduced) return;
    firstReduced.current = reduced;
    const prev = seq.current;
    if (!prev) return;
    const at = prev.progress;
    prev.cancel();
    seq.current = null;
    setPlaying(false);
    ensure()?.seek(at);
  }, [reduced, ensure]);
  useEffect(() => () => { seq.current?.cancel(); seq.current = null; }, []);

  useEffect(() => { onPlayingRef.current(playing); }, [playing]);
  useEffect(() => () => onPlayingRef.current(false), []);

  useRafLoop(screen, () => paint(), playing);

  const play = () => {
    const sq = ensure();
    if (!sq) return;
    setStarted(true);
    setPlaying(true);
    setSaid('Reel playing.');
    sq.play().then((finished) => {
      if (!finished || seq.current !== sq) return;
      setPlaying(false);
      setSaid('Reel finished.');
      paint(REEL_MS);
    });
  };
  const pause = () => {
    seq.current?.pause();
    setPlaying(false);
    setSaid('Reel paused.');
    paint();
  };
  const toggle = (on: boolean) => (on ? play() : pause());

  const scrubTo = (ms: number) => {
    const sq = ensure();
    if (!sq) return;
    setStarted(true);
    sq.seek(ms / REEL_MS);
    paint(ms);
    if (playing) setPlaying(false);
  };

  const ends = SHOTS.map((x) => x.at);
  return (
    <div className={s.reel}>
      <div
        ref={screen}
        className={s.screen}
        data-lit=""
        data-started={started || undefined}
        onClick={() => toggle(!playing)}
        aria-hidden="true"
      >
        <div className={s.shot} data-shot="slate">
          <div className={s.slateBoard} data-slate-board="">
            <div className={s.slateStick} data-slate-stick="">{Array.from({ length: 9 }, (_, i) => <span key={i} />)}</div>
            <div className={s.slateBody}>
              <p><span>Prod.</span>Reel 2026</p>
              <p><span>Studio</span>{STUDIO.name}</p>
              <p><span>Scene</span>01</p><p><span>Take</span>03</p>
            </div>
            <i className={s.slateTick} data-slate-tick="" style={{ '--a': '-30deg' } as CSSProperties} />
            <i className={s.slateTick} data-slate-tick="" style={{ '--a': '-60deg' } as CSSProperties} />
            <i className={s.slateTick} data-slate-tick="" style={{ '--a': '-90deg' } as CSSProperties} />
          </div>
        </div>

        <div className={s.shot} data-shot="ball">
          <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet" className={s.ballSvg} focusable="false">
            <text x="200" y="560" className={s.ballText} data-ball-line="">
              <tspan data-ball-word="" className={s.ballDisplay}>Nothing</tspan>
              <tspan data-ball-word="" className={s.ballSerif} dx="30">stops</tspan>
              <tspan data-ball-word="" className={s.ballDisplay} dx="30">dead</tspan>
            </text>
            <ellipse data-ball-shadow="" className={s.ballShadow} cx="1356" cy="563" rx="25" ry="5" />
            <g data-ball="" className={s.ballBody} style={{ transform: 'translate(1352px, 538px)' }}>
              <circle r="22" />
            </g>
          </svg>
          <p className={s.shotCap}>Bounce timed by hand · squash on every contact</p>
        </div>

        <div className={s.shot} data-shot="tide">
          <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className={s.tideSvg} focusable="false">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <path key={i} data-tide-line="" d={(() => { let d = `M-480 ${560 + i * 40}`; for (let x = -480; x < 2080; x += 160) d += ` q40 ${-(10 + i * 3)} 80 0 t80 0`; return d; })()} strokeWidth={2 + i * 0.5} opacity={0.3 + i * 0.08} />
            ))}
          </svg>
          <p className={s.tideMark}>{'TIDEWATER'.split('').map((l, i) => <span key={i} data-tide-letter="" style={{ '--y': `${(Math.sin(i * 0.78) * 0.09).toFixed(3)}em` } as CSSProperties}>{l}</span>)}</p>
          <p className={s.shotCap} data-top="">Tidewater Institute · living identity · 2025</p>
        </div>

        <div className={s.shot} data-shot="ferry">
          <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className={s.ferrySvg} focusable="false">
            <defs>
              <linearGradient id={`${uid}beam`} x1="1" y1="0" x2="0" y2="0">
                <stop offset="0" stopColor="#ffe2a0" stopOpacity="0.7" />
                <stop offset="1" stopColor="#ffe2a0" stopOpacity="0" />
              </linearGradient>
            </defs>
            <rect y="610" width="1600" height="290" fill="#070b1f" />
            <g data-ferry-beam="" style={{ transformOrigin: '1290px 330px' }}><path d="M1290 330 L120 170 L120 500 Z" fill={`url(#${uid}beam)`} /></g>
            <path d="M1262 610 L1274 350 h32 L1318 610Z" fill="#d9d4ea" />
            <path d="M1266 520h48v26h-50zM1270 430h40v26h-41z" fill="#b8213a" />
            <rect x="1272" y="306" width="36" height="44" rx="6" fill="#ffe29a" />
            <g data-ferry-boat=""><path d="M330 610h330l-34 38H364z" fill="#03050f" /><rect x="410" y="570" width="180" height="40" rx="5" fill="#03050f" /><g fill="#ffcf6b">{[426, 452, 478, 504, 530, 556].map((x) => <rect key={x} x={x} y="582" width="13" height="10" rx="2" />)}</g></g>
          </svg>
          <p className={s.ferryTitle} data-ferry-title="">The Night Ferry</p>
          <p className={s.ferryCredit} data-ferry-credit="">main titles · sample</p>
        </div>

        <div className={s.shot} data-shot="type">
          <span className={s.typeGlyph} data-type-glyph="">Rg</span>
          <span className={s.typeAxis}><span>wght</span><span className={s.typeTrack}><span className={s.typeKnob} data-type-knob="" /></span><span>wdth</span></span>
          <p className={s.shotCap}>Halden Type · variable specimen · 2024</p>
        </div>

        <div className={s.shot} data-shot="crumb">
          <div className={s.crumbPhone} data-crumb-phone=""><span className={s.crumbLoaf} /><span className={s.crumbWord}>Crumb</span><span className={s.crumbDots}><i /><i /><i /></span></div>
          <div className={s.crumbShelf}>{[0, 1, 2].map((i) => <span key={i} className={s.crumbRoll} data-crumb-roll="" />)}</div>
          <p className={s.shotCap}>Crumb · onboarding · 2023</p>
        </div>

        <div className={s.shot} data-shot="end">
          <p className={s.endMark}>
            <span data-end-lead="">Lead</span>
            <span data-end-amp="" className={s.endAmp}>&amp;</span>
            <span data-end-lag="">Lag</span>
          </p>
          <p className={s.endMail} data-end-mail="">{STUDIO.email} · a fictional studio</p>
        </div>

        <div className={s.poster}>
          <p className={s.posterKicker}>Reel 2026 <span>·</span> sample</p>
          <p className={s.posterTitle}>Twenty seconds<br />of follow-through.</p>
          <p className={s.posterHint}>Press play. Birb has been waiting.</p>
        </div>
        <span className={s.vignette} />
        {/* Keyed, so the cursor follower meets a new element (and reads the new label) when the state flips. */}
        <span key={playing ? 'pause' : 'play'} className={s.hit} data-cursor-label={playing ? 'Pause' : 'Play'} />
      </div>

      <div className={s.transport}>
        <span className={s.playWrap} data-cursor="magnet">
          <LottieIcon
            animationData={PLAY}
            segments={ICONS.play.segments}
            grid={24}
            size={40}
            label="Play reel"
            pressed={playing}
            onToggle={toggle}
            className={s.playButton}
          />
        </span>
        <span className={s.timecode} aria-hidden="true"><span ref={(el) => { if (el && !tc.current) { tc.current = document.createTextNode(timecode(0)); el.appendChild(tc.current); } }} /><span className={s.tcTotal}> / {timecode(REEL_MS)}</span></span>
        <div className={s.scrub}>
          <input
            ref={range}
            className={s.range}
            type="range"
            min={0}
            max={REEL_MS}
            step={Math.round(1000 / FPS)}
            defaultValue={0}
            aria-label="Reel position"
            aria-valuetext={`00:00 of ${timecode(REEL_MS).slice(0, 5)}, ${SHOTS[0].label}`}
            onPointerDown={() => { resumeAfterScrub.current = playing; if (playing) pause(); }}
            onPointerUp={() => { if (resumeAfterScrub.current) { resumeAfterScrub.current = false; play(); } }}
            onInput={(e) => scrubTo(Number((e.target as HTMLInputElement).value))}
          />
          <span className={s.marks} aria-hidden="true">{ends.map((t) => <i key={t} style={{ left: `${(t / REEL_MS) * 100}%` }} />)}</span>
        </div>
        <span className={s.shotName} aria-hidden="true"><span ref={shotName}>{SHOTS[0].label}</span></span>
      </div>
      <p className={s.srOnly} role="status">{said}</p>
    </div>
  );
}
