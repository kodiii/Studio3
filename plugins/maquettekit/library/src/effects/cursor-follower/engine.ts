/**
 * Cursor follower engine: listeners, cached geometry, springs and one write pass per frame.
 * The React wrapper (cursor-follower.tsx) owns the DOM and the rAF loop; this class only reads the inputs the
 * listeners collect and turns them into transforms. Every frame reads first (cached rects, caret position) and
 * writes after, so the loop never forces a layout after its own writes.
 */
import { spring as SPRING, type SpringConfig } from '../../motion';
import { atRest, axis, clamp, park, quicken, stepAxis, type Axis } from './physics';

/** What the follower is showing. `hidden` while the pointer is outside the scope or the keyboard is in use. */
export type CursorState = 'hidden' | 'default' | 'magnet' | 'text' | 'label';
type Kind = 'default' | 'magnet' | 'text' | 'label' | 'none';

export interface FollowerOptions {
  follow: SpringConfig;
  size: number;
  stretch: number;
  dot: boolean;
  pull: number;
  padding: number;
}

export interface FollowerNodes {
  /** The element the follower lives in (`document.documentElement` for a page-wide follower). */
  scope: HTMLElement;
  /** Both fixed layers: ring layer, then label layer. */
  layers: readonly HTMLElement[];
  ringBody: HTMLElement;
  ring: SVGRectElement;
  dot: HTMLElement;
  labelBody: HTMLElement;
  fill: HTMLElement;
  fillRect: SVGRectElement;
  shadow: HTMLElement;
  text: HTMLElement;
}

export interface FollowerHooks {
  /** Start the frame loop (no-op while it runs). */
  wake: () => void;
  /** Every spring is at rest: stop the loop. */
  sleep: () => void;
  /** A label target was entered with new text. */
  label: (text: string) => void;
  state: (s: CursorState) => void;
}

interface Box { left: number; top: number; width: number; height: number }
interface Magnet { el: HTMLElement | SVGElement; rect: Box; radius: number; x: Axis; y: Axis; engaged: boolean; written: string }

export const CURSOR_SELECTOR = '[data-cursor], [data-cursor-label]';
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'Fn', 'OS']);

/* Springs — all Motion Lab tokens, some played faster (same damping ratio, so the same character). */
const DOT = quicken(SPRING.press, 4); // the dot is nearly weightless: ~16 px behind at 1000 px/s, then exactly on
const SHAPE = SPRING.settle; // outline morphs land without a visible bounce
const ENTER = SPRING.settle;
const EXIT = quicken(SPRING.press, 1.25); // exits are faster than entrances
const PRESS_IN = quicken(SPRING.press, 1.5); // press feedback lands within a couple of frames
const PRESS_OUT = SPRING.pop; // the release overshoots: follow-through
const JELLY = SPRING.pop; // squash and stretch wobble
const BLOOM = SPRING.settle;
const FADE = SPRING.press;
const TRACK = SPRING.settle; // an engaged magnet following the pointer
const HOME = SPRING.release; // a released magnet keeps its velocity on the way home

/* Model constants (shape and scale, not timing). */
const STRETCH_SPEED = 1500; // px/s at which the stretch reaches tanh(1) ≈ 76 % of its maximum
const ACCEL_REF = 9000; // px/s² of speeding up or braking at which those terms reach tanh(1) of their weight
const PUSH_WEIGHT = 0.2; // speeding up stretches a little more (the soft body lags its own centre)
const BRAKE_WEIGHT = 0.42; // braking squashes it against its travel (the soft body keeps going for a moment)
const ACCEL_SMOOTH = 40; // 1/s: low-pass on the measured acceleration
const MIN_STRETCH = -0.2; // deepest squash
const MAX_STRETCH = 0.9;
const CARET_W = 0.5; // caret geometry; with the 1.5 px stroke it reads as a 2 px bar
const LABEL_PAD = 18; // horizontal padding of a label pill
const ORIENT_RATE = 22; // 1/s: how fast the stretch axis turns toward the direction of travel
const PULL_CAP = 20; // px: furthest a magnet travels
const PRESS_PX = 8; // a press squeezes the outline by about this much on each side
const LABEL_DROP = 0.36; // the label disc hangs below-right of the cursor tip (× its height), clear of the native arrow

const clamp01 = (v: number): number => clamp(v, 0, 1);
const f2 = (v: number): string => (Math.abs(v) < 0.005 ? '0' : v.toFixed(2));
const f4 = (v: number): string => (Math.abs(v) < 0.00005 ? '0' : v.toFixed(4));

function kindOf(t: Element | null): Kind {
  if (!t) return 'default';
  const k = t.getAttribute('data-cursor');
  if (k === 'none') return 'none';
  if (k === 'magnet') return t.matches(':disabled') ? 'default' : 'magnet';
  if (k === 'text') return 'text';
  return t.hasAttribute('data-cursor-label') ? 'label' : 'default';
}

function radiusOf(el: Element, box: Box): number {
  const raw = getComputedStyle(el).borderTopLeftRadius || '0';
  const n = parseFloat(raw) || 0;
  return raw.trim().endsWith('%') ? (n / 100) * Math.min(box.width, box.height) : n;
}

export class FollowerEngine {
  private readonly n: FollowerNodes;
  private readonly opts: () => FollowerOptions;
  private readonly hooks: FollowerHooks;
  private readonly page: boolean;

  // Inputs gathered by the listeners (client coordinates).
  private px = 0;
  private py = 0;
  private hasPointer = false;
  private inside = false;
  private keyboard = false;
  private foreign = false; // last pointer was touch or pen
  private pressed = false;
  private target: Element | null = null;
  private kind: Kind = 'default';
  private visual: Exclude<Kind, 'none'> = 'default';
  private magnet: Magnet | null = null;
  private readonly magnets = new Map<Element, Magnet>();
  private textEl: Element | null = null;
  private fontSize = 16;
  private caret: { x: number; y: number; h: number } | null = null;
  private labelText = '';
  private labelW = 0;
  private geomDirty = true;
  private caretDirty = false;

  // Cached geometry.
  private ox = 0;
  private oy = 0;
  private clip = '';

  // Springs.
  private readonly rx = axis();
  private readonly ry = axis();
  private readonly dx = axis();
  private readonly dy = axis();
  private readonly w = axis();
  private readonly h = axis();
  private readonly r = axis();
  private readonly presence = axis();
  private readonly press = axis();
  private readonly jelly = axis();
  private readonly freedom = axis(1);
  private readonly stroke = axis(1);
  private readonly caretAmt = axis();
  private readonly fillAmt = axis();
  private readonly textAmt = axis();
  private readonly dotAmt = axis(1);
  private oc = 1; // stretch axis as a doubled angle, so a reversal along the same line never flips it
  private os = 0;
  private lastSpeed = 0;
  private accel = 0; // smoothed rate of change of the ring's speed (px/s²)

  // Output cache (skip identical writes).
  private out = { body: '', labelBody: '', dot: '', fill: '', shadow: '', text: '', ringO: '', labelO: '', fillO: '', shadowO: '', textO: '', stroke: '', caret: '', clip: '', geom: '' };
  private idle = true;
  private shown: CursorState = 'hidden';
  private ro: ResizeObserver | null = null;

  constructor(nodes: FollowerNodes, opts: () => FollowerOptions, hooks: FollowerHooks, page: boolean) {
    this.n = nodes;
    this.opts = opts;
    this.hooks = hooks;
    this.page = page;
    const s = opts().size;
    park(this.w, s);
    park(this.h, s);
    park(this.r, s / 2);
  }

  attach(): void {
    const s = this.n.scope;
    s.addEventListener('pointermove', this.onMove, { capture: true, passive: true });
    s.addEventListener('pointerdown', this.onDown, { capture: true, passive: true });
    s.addEventListener('pointerleave', this.onLeave, { passive: true });
    window.addEventListener('pointerup', this.onUp, { capture: true, passive: true });
    window.addEventListener('pointercancel', this.onUp, { capture: true, passive: true });
    window.addEventListener('keydown', this.onKey, { capture: true, passive: true });
    window.addEventListener('scroll', this.onGeometry, { capture: true, passive: true });
    window.addEventListener('resize', this.onGeometry, { passive: true });
    window.addEventListener('blur', this.onBlur);
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(this.onGeometry);
      this.ro.observe(s);
    }
  }

  detach(): void {
    const s = this.n.scope;
    s.removeEventListener('pointermove', this.onMove, { capture: true });
    s.removeEventListener('pointerdown', this.onDown, { capture: true });
    s.removeEventListener('pointerleave', this.onLeave);
    window.removeEventListener('pointerup', this.onUp, { capture: true });
    window.removeEventListener('pointercancel', this.onUp, { capture: true });
    window.removeEventListener('keydown', this.onKey, { capture: true });
    window.removeEventListener('scroll', this.onGeometry, { capture: true });
    window.removeEventListener('resize', this.onGeometry);
    window.removeEventListener('blur', this.onBlur);
    this.ro?.disconnect();
    this.ro = null;
    // Hand every magnet back exactly as it was.
    for (const m of this.magnets.values()) m.el.style.translate = '';
    this.magnets.clear();
    this.magnet = null;
  }

  /** Options changed: animate toward the new values if anything is on screen. */
  nudge(): void { if (!this.idle) this.hooks.wake(); }

  setLabelWidth(px: number): void {
    if (Math.abs(px - this.labelW) < 0.5) return;
    this.labelW = px;
    if (!this.idle) this.hooks.wake();
  }

  // ── Listeners ─────────────────────────────────────────────────────────────────────────────────
  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') { this.goForeign(); return; } // touch and pen keep the native experience only
    this.foreign = false;
    this.keyboard = false;
    this.inside = true;
    this.hasPointer = true;
    this.px = e.clientX;
    this.py = e.clientY;
    if (!this.pressed || !this.target) this.retarget(e.target as Element | null);
    if (this.kind === 'text') this.caretDirty = true;
    this.hooks.wake();
  };

  private readonly onDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') { this.goForeign(); return; }
    this.foreign = false;
    this.keyboard = false;
    this.inside = true;
    this.hasPointer = true;
    this.px = e.clientX;
    this.py = e.clientY;
    this.retarget(e.target as Element | null);
    if (e.button === 0) this.pressed = true;
    this.hooks.wake();
  };

  private readonly onUp = (): void => {
    if (!this.pressed) return;
    this.pressed = false;
    // Content may have moved under the pointer during a drag: look again on the next frame.
    this.geomDirty = true;
    this.hooks.wake();
  };

  private readonly onLeave = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' && e.pointerType !== '') return;
    // Keep the current state while fading out (a label disc leaves as a disc); magnets release on their own.
    this.inside = false;
    this.hooks.wake();
  };

  private readonly onKey = (e: KeyboardEvent): void => {
    if (MODIFIERS.has(e.key) || this.keyboard) return;
    this.keyboard = true; // keyboard navigation: step aside for the focus ring until the mouse moves again
    this.hooks.wake();
  };

  private readonly onGeometry = (): void => {
    this.geomDirty = true;
    if (!this.idle || this.inside) this.hooks.wake();
  };

  private readonly onBlur = (): void => {
    this.inside = false;
    this.pressed = false;
    this.hooks.wake();
  };

  private goForeign(): void {
    if (this.foreign) return;
    this.foreign = true;
    this.pressed = false;
    this.hooks.wake();
  }

  // ── Targets ───────────────────────────────────────────────────────────────────────────────────
  /** Resolve the contextual target under the pointer. Reads layout only when the target changes. */
  private retarget(el: Element | null): void {
    let t = el && typeof el.closest === 'function' ? el.closest(CURSOR_SELECTOR) : null;
    if (t && !this.n.scope.contains(t)) t = null;
    if (t === this.target) return;
    this.target = t;
    const kind = kindOf(t);
    if (this.magnet && this.magnet.el !== t) { this.magnet.engaged = false; this.magnet = null; }
    this.textEl = null;
    if (kind === 'magnet' && t) {
      let m = this.magnets.get(t);
      if (!m) {
        m = { el: t as HTMLElement, rect: { left: 0, top: 0, width: 0, height: 0 }, radius: 0, x: axis(), y: axis(), engaged: true, written: '' };
        this.magnets.set(t, m);
      }
      m.engaged = true;
      this.measureMagnet(m);
      m.radius = radiusOf(t, m.rect);
      this.magnet = m;
    } else if (kind === 'text' && t) {
      this.textEl = t;
      this.fontSize = parseFloat(getComputedStyle(t).fontSize) || 16;
      this.caret = null;
      this.caretDirty = true;
    } else if (kind === 'label' && t) {
      const text = t.getAttribute('data-cursor-label') ?? '';
      if (text !== this.labelText) { this.labelText = text; this.hooks.label(text); }
    }
    this.kind = kind;
  }

  /** The magnet's untransformed box: the translate we wrote is subtracted, so the pull never feeds back. */
  private measureMagnet(m: Magnet): void {
    const b = m.el.getBoundingClientRect();
    m.rect = { left: b.left - m.x.x, top: b.top - m.y.x, width: b.width, height: b.height };
  }

  /** Refresh cached geometry after scroll or resize. Runs at the start of a frame, before any write. */
  private measure(): void {
    this.geomDirty = false;
    const L = this.n.layers[0].getBoundingClientRect();
    this.ox = L.left;
    this.oy = L.top;
    let inScope = true;
    if (!this.page) {
      const s = this.n.scope.getBoundingClientRect();
      const t = Math.max(0, s.top - L.top), l = Math.max(0, s.left - L.left);
      const rr = Math.max(0, L.right - s.right), b = Math.max(0, L.bottom - s.bottom);
      this.clip = `inset(${f2(t)}px ${f2(rr)}px ${f2(b)}px ${f2(l)}px)`;
      inScope = this.px >= s.left && this.px <= s.right && this.py >= s.top && this.py <= s.bottom;
    }
    for (const m of this.magnets.values()) if (m.engaged) this.measureMagnet(m);
    if (!this.inside || !this.hasPointer || this.pressed) return;
    // The page scrolled under a resting pointer: whatever is under it now decides the state.
    const hit = inScope && typeof document.elementFromPoint === 'function' ? document.elementFromPoint(this.px, this.py) : null;
    if (!inScope || (hit && !this.n.scope.contains(hit))) { this.inside = false; return; }
    if (hit) this.retarget(hit);
    if (this.kind === 'text') this.caretDirty = true;
  }

  /** Where a click would put the text caret: the follower snaps to real character boundaries and line boxes. */
  private measureCaret(): void {
    this.caretDirty = false;
    const t = this.textEl;
    if (!t) { this.caret = null; return; }
    let rect: DOMRect | null = null;
    try {
      if (typeof document.caretPositionFromPoint === 'function') {
        const pos = document.caretPositionFromPoint(this.px, this.py);
        if (pos && t.contains(pos.offsetNode)) rect = pos.getClientRect();
      } else if (typeof document.caretRangeFromPoint === 'function') {
        const range = document.caretRangeFromPoint(this.px, this.py);
        if (range && t.contains(range.startContainer)) rect = range.getBoundingClientRect();
      }
    } catch { rect = null; }
    const fs = this.fontSize;
    this.caret = rect && rect.height > 0
      ? { x: rect.left, y: rect.top + rect.height / 2, h: clamp(rect.height * 1.08, fs, fs * 1.6) }
      : { x: this.px, y: this.py, h: fs * 1.2 };
  }

  // ── Frame ─────────────────────────────────────────────────────────────────────────────────────
  tick(dt: number): void {
    // Read pass.
    if (this.geomDirty) this.measure();
    if (this.caretDirty) this.measureCaret();

    const o = this.opts();
    const visible = this.inside && this.hasPointer && !this.keyboard && !this.foreign && this.kind !== 'none';
    if (this.kind !== 'none') this.visual = this.kind;
    const { rx, ry, dx, dy, w, h, r, presence, press, jelly, freedom, stroke, caretAmt, fillAmt, textAmt, dotAmt } = this;

    // Re-entry: appear at the pointer as the plain ring and grow in from there (never fly in from far away).
    if (visible && presence.x < 0.02 && presence.v <= 0) {
      park(rx, this.px); park(ry, this.py); park(dx, this.px); park(dy, this.py);
      park(w, o.size); park(h, o.size); park(r, o.size / 2);
      park(jelly, 0); park(freedom, 1); park(stroke, 1); park(caretAmt, 0); park(fillAmt, 0); park(textAmt, 0);
      this.lastSpeed = 0;
      this.accel = 0;
    }

    // Targets for the current state.
    let tx = this.px, ty = this.py;
    let tw = o.size, th = o.size, tr = o.size / 2;
    let freeT = 1, strokeT = 1, caretT = 0, fillT = 0, dotT = o.dot ? 1 : 0, pressable = true;
    const m = this.magnet;
    if (this.visual === 'magnet' && m) {
      tx = m.rect.left + m.rect.width / 2 + m.x.x;
      ty = m.rect.top + m.rect.height / 2 + m.y.x;
      tw = m.rect.width + o.padding * 2;
      th = m.rect.height + o.padding * 2;
      tr = Math.min(m.radius + o.padding, tw / 2, th / 2);
      freeT = 0;
    } else if (this.visual === 'text' && this.caret) {
      tx = this.caret.x;
      ty = this.caret.y;
      tw = CARET_W;
      th = this.caret.h;
      tr = CARET_W / 2;
      freeT = 0.12; caretT = 1; dotT = 0; pressable = false;
    } else if (this.visual === 'label') {
      th = clamp(o.size * 2.3, 72, 132);
      tw = Math.max(th, this.labelW + LABEL_PAD * 2);
      tr = th / 2;
      tx += th * LABEL_DROP;
      ty += th * LABEL_DROP;
      freeT = 0.6; strokeT = 0; fillT = 1; dotT = 0;
    }
    const presenceT = visible ? 1 : 0;
    const pressT = this.pressed && visible && pressable ? 1 : 0;
    const textT = fillT && fillAmt.x > 0.62 ? 1 : 0; // the label lands after its disc: overlap, not unison

    // Integrate.
    stepAxis(rx, tx, o.follow, dt);
    stepAxis(ry, ty, o.follow, dt);
    stepAxis(dx, this.px, DOT, dt);
    stepAxis(dy, this.py, DOT, dt);
    stepAxis(w, tw, SHAPE, dt);
    stepAxis(h, th, SHAPE, dt);
    stepAxis(r, tr, SHAPE, dt);
    stepAxis(presence, presenceT, visible ? ENTER : EXIT, dt);
    stepAxis(press, pressT, pressT ? PRESS_IN : PRESS_OUT, dt);
    stepAxis(freedom, freeT, SHAPE, dt);
    stepAxis(stroke, strokeT, FADE, dt);
    stepAxis(caretAmt, caretT, FADE, dt);
    stepAxis(fillAmt, fillT, fillT ? BLOOM : EXIT, dt);
    stepAxis(textAmt, textT, textT ? BLOOM : EXIT, dt);
    stepAxis(dotAmt, dotT, FADE, dt);
    // Squash and stretch from the ring's own motion: speed stretches it along its travel, braking squashes it
    // against the travel (the soft body keeps going for a moment), and an underdamped spring lets it wobble round.
    const speed = Math.hypot(rx.v, ry.v);
    if (dt > 0) {
      const a = (speed - this.lastSpeed) / dt;
      this.accel += (a - this.accel) * (1 - Math.exp(-dt * ACCEL_SMOOTH));
    }
    this.lastSpeed = speed;
    const drive = Math.tanh(speed / STRETCH_SPEED)
      + PUSH_WEIGHT * Math.tanh(Math.max(0, this.accel) / ACCEL_REF)
      + BRAKE_WEIGHT * Math.tanh(Math.min(0, this.accel) / ACCEL_REF);
    const jellyT = clamp(o.stretch * clamp01(freedom.x) * drive, MIN_STRETCH * o.stretch, MAX_STRETCH);
    stepAxis(jelly, jellyT, JELLY, dt);
    if (speed > 30 && dt > 0) {
      const a = Math.atan2(ry.v, rx.v) * 2;
      const k = 1 - Math.exp(-dt * ORIENT_RATE * Math.min(1, speed / 400));
      this.oc += (Math.cos(a) - this.oc) * k;
      this.os += (Math.sin(a) - this.os) * k;
    }
    let magnetsAtRest = true;
    for (const mm of this.magnets.values()) {
      if (!mm.el.isConnected) { // the element left the page: forget it
        this.magnets.delete(mm.el);
        if (this.magnet === mm) { this.magnet = null; this.target = null; this.kind = 'default'; }
        continue;
      }
      const engaged = mm.engaged && visible;
      let mx = 0, my = 0;
      if (engaged) {
        const cap = Math.max(1, Math.min(PULL_CAP, mm.rect.width * 0.35, mm.rect.height * 0.35));
        mx = cap * Math.tanh(((this.px - (mm.rect.left + mm.rect.width / 2)) * o.pull) / cap);
        my = cap * Math.tanh(((this.py - (mm.rect.top + mm.rect.height / 2)) * o.pull) / cap);
      }
      const cfg = engaged ? TRACK : HOME;
      stepAxis(mm.x, mx, cfg, dt);
      stepAxis(mm.y, my, cfg, dt);
      const still = atRest(mm.x, mx, 0.02) && atRest(mm.y, my, 0.02);
      if (!still) magnetsAtRest = false;
      const css = !engaged && still ? '' : `${f2(mm.x.x)}px ${f2(mm.y.x)}px`;
      if (css !== mm.written) { mm.written = css; mm.el.style.translate = css; }
      if (!engaged && still && !mm.engaged) { park(mm.x, 0); park(mm.y, 0); this.magnets.delete(mm.el); }
    }

    // Write pass.
    const pres = clamp01(presence.x);
    const W = Math.max(0, w.x), H = Math.max(0, h.x), R = clamp(r.x, 0, Math.min(W, H) / 2);
    // Only round outlines smear: stretching a pill or a caret along a diagonal would shear it.
    const round = Math.min(W, H) / Math.max(W, H, 1e-3);
    const S = clamp(jelly.x, MIN_STRETCH, MAX_STRETCH) * round * round;
    const sx = 1 + S, sy = 1 / (1 + S);
    const theta = Math.atan2(this.os, this.oc) / 2;
    // A press squeezes the outline by ~PRESS_PX, but around a magnet it never closes the gap onto the element.
    const depth = this.visual === 'magnet' && this.magnet
      ? clamp((o.padding * 1.2) / Math.max(1, W, H), 0.015, 0.12)
      : clamp((PRESS_PX * 2) / Math.max(1, W, H), 0.035, 0.24);
    const k = (0.3 + 0.7 * pres) * (1 - depth * press.x);
    const turn = `rotate(${f4(theta)}rad)`, back = `rotate(${f4(-theta)}rad)`;
    const body = `translate3d(${f2(rx.x - this.ox)}px, ${f2(ry.x - this.oy)}px, 0) ${turn} scale(${f4(sx * k)}, ${f4(sy * k)}) ${back}`;
    const dk = pres * clamp01(dotAmt.x) * (1 + 0.45 * press.x);
    const fs = 0.3 + 0.7 * clamp01(fillAmt.x);
    const ta = clamp01(textAmt.x);
    const out = this.out;
    const set = (key: keyof typeof out, value: string, apply: (v: string) => void) => { if (out[key] !== value) { out[key] = value; apply(value); } };
    const n = this.n;
    set('body', body, (v) => { n.ringBody.style.transform = v; });
    // The label layer only needs to move while it shows something.
    if (fillAmt.x > 0.0005 || textAmt.x > 0.0005) set('labelBody', body, (v) => { n.labelBody.style.transform = v; });
    set('dot', `translate3d(${f2(dx.x - this.ox)}px, ${f2(dy.x - this.oy)}px, 0) scale(${f4(Math.max(0, dk))})`, (v) => { n.dot.style.transform = v; });
    set('ringO', f4(pres), (v) => { n.ringBody.style.opacity = v; n.dot.style.opacity = v; });
    set('labelO', f4(pres), (v) => { n.labelBody.style.opacity = v; });
    set('stroke', f4(clamp01(stroke.x)), (v) => { n.ring.style.strokeOpacity = v; });
    set('caret', f4(clamp01(caretAmt.x) * clamp01((10 - W) / 7)), (v) => { n.ring.style.fillOpacity = v; });
    set('fill', `scale(${f4(fs)})`, (v) => { n.fill.style.transform = v; });
    set('fillO', f4(clamp01(fillAmt.x * 2.2)), (v) => { n.fill.style.opacity = v; });
    set('shadow', `translate3d(0, ${f2(3 + 5 * clamp01(fillAmt.x))}px, 0) scale(${f4((W * fs) / 100)}, ${f4((H * fs) / 100)})`, (v) => { n.shadow.style.transform = v; });
    set('shadowO', f4(clamp01(fillAmt.x)), (v) => { n.shadow.style.opacity = v; });
    // The label text keeps its proportions while the disc smears: undo the stretch, then rise into place.
    if (ta > 0.0005) set('text', `${turn} scale(${f4(1 / sx)}, ${f4(1 / sy)}) ${back} translate3d(0, ${f2((1 - ta) * 6)}px, 0) scale(${f4(0.86 + 0.14 * ta)})`, (v) => { n.text.style.transform = v; });
    set('textO', f4(ta), (v) => { n.text.style.opacity = v; });
    const geom = `${f2(W)} ${f2(H)} ${f2(R)}`;
    set('geom', geom, () => {
      for (const rect of [n.ring, n.fillRect]) {
        rect.setAttribute('x', f2(-W / 2));
        rect.setAttribute('y', f2(-H / 2));
        rect.setAttribute('width', f2(W));
        rect.setAttribute('height', f2(H));
        rect.setAttribute('rx', f2(R));
        rect.setAttribute('ry', f2(R));
      }
    });
    if (!this.page) set('clip', this.clip, (v) => { for (const l of n.layers) l.style.clipPath = v; });

    const hidden = !visible && pres < 0.002 && Math.abs(presence.v) < 0.02;
    if (hidden !== this.idle) {
      this.idle = hidden;
      for (const l of n.layers) l.toggleAttribute('data-idle', hidden);
    }
    const shown: CursorState = visible ? (this.kind === 'none' ? 'hidden' : this.kind) : 'hidden';
    if (shown !== this.shown) { this.shown = shown; this.hooks.state(shown); }

    // Sleep once everything has landed.
    if (this.geomDirty || this.caretDirty || !magnetsAtRest) return;
    if (hidden) { this.hooks.sleep(); return; }
    const E = 0.05, e = 0.002;
    const rest = atRest(rx, tx, E) && atRest(ry, ty, E) && atRest(dx, this.px, E) && atRest(dy, this.py, E)
      && atRest(w, tw, E) && atRest(h, th, E) && atRest(r, tr, E)
      && atRest(presence, presenceT, e) && atRest(press, pressT, e) && atRest(jelly, jellyT, e) && atRest(freedom, freeT, e)
      && atRest(stroke, strokeT, e) && atRest(caretAmt, caretT, e) && atRest(fillAmt, fillT, e) && atRest(textAmt, textT, e) && atRest(dotAmt, dotT, e);
    if (rest) this.hooks.sleep();
  }
}
