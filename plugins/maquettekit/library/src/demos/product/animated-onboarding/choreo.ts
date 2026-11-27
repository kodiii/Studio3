/**
 * Step-change choreography on real elements (no View Transitions, so no bitmap snapshots and no cross-faded page).
 *
 *  - An answer never becomes a picture: its text is captured as text (string + computed type), a live DOM "flyer"
 *    takes over at the exact spot, lifts off (anticipation), then travels to its line on the ticket on an arc (x and y
 *    are driven by two different springs) while its type morphs from the question's face to the ticket's mono. At
 *    the landing the real ticket line, held invisible until then, takes over at the same pixel.
 *  - Springs come from the motion tokens, sampled into CSS linear() curves.
 */
import { cssEase, duration as D, spring, springToLinear } from '../../../motion';

export const GLIDE = springToLinear(spring.glide);
export const SETTLE = springToLinear(spring.settle);
export const POP = springToLinear(spring.pop);

export interface Source {
  key: string;
  text: string;
  /** Text origin: left edge and vertical centre, page coordinates. */
  x: number;
  y: number;
  font: Pick<CSSStyleDeclaration, 'fontFamily' | 'fontSize' | 'fontWeight' | 'letterSpacing' | 'color'>;
  el: HTMLElement;
}

const fontOf = (el: Element) => {
  const cs = getComputedStyle(el);
  return { fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing, color: cs.color };
};

/** Read every `[data-fly-src]` in the leaving step: what it says, where its text sits and how it is set. */
export function captureSources(scope: HTMLElement): Source[] {
  const out: Source[] = [];
  for (const el of scope.querySelectorAll<HTMLElement>('[data-fly-src]')) {
    const key = el.dataset.flySrc;
    if (!key) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1) continue;
    if (el instanceof HTMLInputElement) {
      const text = el.value.trim();
      if (!text) continue;
      const cs = getComputedStyle(el);
      out.push({ key, text, x: r.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), y: r.top + r.height / 2, font: fontOf(el), el });
    } else {
      const text = (el.textContent ?? '').trim();
      if (!text) continue;
      out.push({ key, text, x: r.left, y: r.top + r.height / 2, font: fontOf(el), el });
    }
  }
  return out;
}

export interface Flight { cancel(): void }

/**
 * Lift every source off its step now (the text detaches from its field while the step exits). Returns a `launch`
 * that, once the ticket shows the new state, sends each flyer to `[data-fly-dst=key]` and resolves on the landing.
 */
export function liftOff(sources: Source[], layer: HTMLElement): { launch: (ticket: HTMLElement, onLand: (dst: HTMLElement, i: number) => void) => void; cancel: () => void } {
  const anims: Animation[] = [];
  const flyers: HTMLElement[] = [];
  const held: HTMLElement[] = [];
  const origin = layer.getBoundingClientRect();
  const items = sources.map((s) => {
    const outer = document.createElement('div');
    outer.className = layer.dataset.flyerClass ?? '';
    outer.setAttribute('aria-hidden', 'true');
    outer.style.left = `${(s.x - origin.left).toFixed(2)}px`;
    outer.style.top = `${(s.y - origin.top).toFixed(2)}px`;
    const inner = document.createElement('div');
    const echo = document.createElement('span');
    echo.textContent = s.text;
    Object.assign(echo.style, s.font);
    const mono = document.createElement('span');
    inner.append(echo, mono);
    outer.append(inner);
    layer.append(outer);
    flyers.push(outer);
    // The original text hides in the same frame the flyer appears: one copy on screen at any time.
    if (s.el instanceof HTMLInputElement) s.el.style.color = 'transparent'; else s.el.style.visibility = 'hidden';
    // Anticipation: the answer lifts toward the viewer before it travels.
    anims.push(inner.animate([{ translate: '0 0', scale: '1' }, { translate: '0 -7px', scale: '1.035' }], { duration: D.fast, easing: cssEase('emphasized'), fill: 'forwards' }));
    return { s, outer, inner, echo, mono };
  });

  const launch = (ticket: HTMLElement, onLand: (dst: HTMLElement, i: number) => void) => {
    const now = layer.getBoundingClientRect();
    const shift = { x: now.left - origin.left, y: now.top - origin.top };
    const used = new Map<string, number>();
    items.forEach((it, i) => {
      const dsts = [...ticket.querySelectorAll<HTMLElement>(`[data-fly-dst="${it.s.key}"]`)];
      const dst = dsts[0];
      if (!dst) { it.outer.remove(); return; }
      const many = (used.get(it.s.key) ?? 0) > 0 || sources.filter((x) => x.key === it.s.key).length > 1;
      used.set(it.s.key, (used.get(it.s.key) ?? 0) + 1);
      const r = dst.getBoundingClientRect();
      const dx = r.left - it.s.x - shift.x;
      const dy = r.top + r.height / 2 - it.s.y - shift.y;
      if (!held.includes(dst)) { dst.style.visibility = 'hidden'; held.push(dst); }
      if (!many) {
        it.mono.textContent = (dst.textContent ?? '').trim();
        Object.assign(it.mono.style, fontOf(dst));
      }
      const delay = i * 46;
      // An arc, not a line: y settles on a quicker spring than x, so the answer rises first and then crosses over.
      anims.push(it.outer.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx.toFixed(2)}px)` }], { duration: GLIDE.duration, delay, easing: GLIDE.easing, fill: 'forwards' }));
      anims.push(it.inner.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${dy.toFixed(2)}px)` }], { duration: SETTLE.duration, delay, easing: SETTLE.easing, fill: 'forwards' }));
      anims.push(it.inner.animate([{ translate: '0 -7px', scale: '1.035' }, { translate: '0 0', scale: '1' }], { duration: GLIDE.duration, delay, easing: cssEase('standard'), fill: 'forwards' }));
      // Type morph: the question's face hands over to the ticket's mono mid-flight (many-to-one answers just fade in).
      anims.push(it.echo.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0, offset: many ? 0.9 : 0.55 }, { opacity: 0 }], { duration: GLIDE.duration, delay, easing: 'linear', fill: 'forwards' }));
      if (!many) anims.push(it.mono.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.22 }, { opacity: 1, offset: 0.66 }, { opacity: 1 }], { duration: GLIDE.duration, delay, easing: 'linear', fill: 'forwards' }));
      const land = anims[anims.length - (many ? 4 : 5)];
      land.finished.then(() => {
        it.outer.remove();
        dst.style.visibility = '';
        onLand(dst, i);
      }, () => {});
    });
  };

  const cancel = () => {
    for (const a of anims) { try { a.cancel(); } catch { /* detached */ } }
    for (const f of flyers) f.remove();
    for (const h of held) h.style.visibility = '';
    for (const s of sources) { if (s.el instanceof HTMLInputElement) s.el.style.color = ''; else s.el.style.visibility = ''; }
  };
  return { launch, cancel };
}
