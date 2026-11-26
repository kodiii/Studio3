/**
 * IconPlayer — drives one lottie-web AnimationItem as a two-state icon.
 *
 * Every move starts from the frame on screen: a toggle plays forward or backward from wherever the icon is (mid
 * wind-up, mid transition, mid release), so it can be interrupted and reversed at any frame and nothing is queued.
 * Hover/focus plays the wind-up of the next transition and holds it; the click then continues from that frame.
 * lottie-web only ticks while an instance plays, so an idle icon costs nothing.
 */
import type { AnimationItem } from 'lottie-web/build/player/lottie_light';
import { duration } from '../../motion';
import type { LottieSegments } from './segments';

type Mode = 'rest' | 'preview' | 'release' | 'toggle' | 'scrub';
const EPS = 0.01;
/**
 * A hover preview plays the wind-up in the `fast` token's time. When a toggle starts straight from rest (touch,
 * keyboard, a quick click), the same frames are compressed into the `instant` token's time so the commit lands sooner.
 */
const BRISK = duration.fast / duration.instant;

export interface PlayerSnapshot { frame: number; mode: Mode }

export class IconPlayer {
  private mode: Mode = 'rest';
  private target: number | null = null;
  private pressed: boolean;
  private hovered = false;
  private focused = false;
  /** A preview may start. Cleared by a toggle, re-armed when pointer and focus have both left. */
  private armed = true;
  private hoverEnabled = true;
  private speed = 1;
  /** While set, the wind-up plays at BRISK × speed until the frame passes `until` in direction `dir`. */
  private brisk: { until: number; dir: 1 | -1 } | null = null;
  private readonly onComplete = (): void => this.landed();
  private readonly onEnterFrame = (): void => {
    const f = this.frame();
    if (this.brisk && (this.brisk.dir > 0 ? f >= this.brisk.until : f <= this.brisk.until)) this.calm();
    this.listener?.(f);
  };

  constructor(
    private readonly anim: AnimationItem,
    private segments: LottieSegments,
    pressed: boolean,
    /** Composition out point: the whole timeline is [0, op]. */
    private readonly op: number,
    private readonly listener?: (frame: number) => void,
  ) {
    this.pressed = pressed;
    anim.addEventListener('complete', this.onComplete);
    anim.addEventListener('enterFrame', this.onEnterFrame); // lottie only emits it while playing or seeking
    this.seek(this.rest());
  }

  /** Absolute frame on screen (lottie reports frames relative to the current segment). */
  frame(): number { return this.anim.firstFrame + this.anim.currentFrame; }
  get lastFrame(): number { return (this.segments.off ?? this.segments.on)[1]; }
  private rest(): number { return this.pressed ? this.segments.on[1] : this.segments.on[0]; }

  private calm(): void {
    if (!this.brisk) return;
    this.brisk = null;
    this.anim.setSpeed(this.speed);
  }

  private seek(frame: number): void {
    this.calm();
    this.anim.setSegment(0, this.op);
    this.anim.goToAndStop(frame, true);
  }

  /** Play from the current frame to `to`. lottie stops a forward segment one frame early, so aim one frame past. */
  private playTo(to: number): void {
    this.calm();
    const from = this.frame();
    this.target = to;
    if (Math.abs(from - to) < 0.5) { this.seek(to); this.landed(); return; }
    this.anim.playSegments(to > from ? [from, to + 1] : [from, to], true);
  }

  private landed(): void {
    const to = this.target;
    this.target = null;
    if (to === null) return;
    const off = this.segments.off;
    // The end of the off transition looks exactly like the start of the on one: park there so the next toggle can
    // play `on` forward again.
    this.seek(off && Math.abs(to - off[1]) < EPS ? this.segments.on[0] : to);
    if (this.mode === 'toggle' || this.mode === 'release') this.mode = 'rest';
  }

  /** Animate to the rest pose of the logical state, choosing the direction from the current frame. */
  private settle(): void {
    const [a, b] = this.segments.on;
    const off = this.segments.off;
    const f = this.frame();
    if (this.pressed) {
      if (off && f >= off[1] - EPS) this.seek(a);
      this.playTo(b); // forward through `on`, or backward through `off` when interrupted mid-way
    } else {
      this.playTo(off && f >= b - EPS ? off[1] : a);
    }
  }

  setPressed(next: boolean, animate: boolean): void {
    if (next === this.pressed) return;
    const fromRest = this.mode === 'rest';
    this.pressed = next;
    this.armed = false;
    if (!animate) { this.jumpToRest(); return; }
    this.mode = 'toggle';
    this.settle();
    if (fromRest && this.target !== null) this.hurryWindUp();
  }

  /** Compress the wind-up of a transition that starts at rest (see BRISK). */
  private hurryWindUp(): void {
    const [a, b] = this.segments.on;
    const off = this.segments.off;
    const n = (this.pressed ? this.segments.hover?.on : this.segments.hover?.off) ?? 0;
    if (n <= 0) return;
    const f = this.frame();
    const end = this.pressed ? a + n : off ? b + n : b - n;
    const dir: 1 | -1 = end >= f ? 1 : -1;
    if (Math.abs(end - f) < 0.5) return;
    this.brisk = { until: end, dir };
    this.anim.setSpeed(this.speed * BRISK);
  }

  /** Stop wherever the icon is and show the rest pose of the current state (reduced motion). */
  jumpToRest(): void {
    this.mode = 'rest';
    this.target = null;
    this.seek(this.rest());
  }

  pointer(over: boolean): void { this.hovered = over; this.engage(); }
  focus(on: boolean): void { this.focused = on; this.engage(); }

  private engage(): void {
    if (!this.hovered && !this.focused) {
      this.armed = true;
      if (this.mode === 'preview') { this.mode = 'release'; this.playTo(this.rest()); }
      return;
    }
    if ((this.mode !== 'rest' && this.mode !== 'release') || !this.armed || !this.hoverEnabled) return;
    const [a, b] = this.segments.on;
    const n = (this.pressed ? this.segments.hover?.off : this.segments.hover?.on) ?? 0;
    if (n <= 0) return;
    this.mode = 'preview';
    this.playTo(this.pressed ? (this.segments.off ? b + n : b - n) : a + n);
  }

  setHoverEnabled(on: boolean): void {
    this.hoverEnabled = on;
    if (!on && this.mode === 'preview') { this.mode = 'release'; this.playTo(this.rest()); }
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.05, speed);
    this.anim.setSpeed(this.brisk ? this.speed * BRISK : this.speed);
  }

  setSegments(segments: LottieSegments): void {
    this.segments = segments;
    if (this.mode === 'rest') this.seek(this.rest());
  }

  /** Direct manipulation: show any frame. `release()` then plays to the rest pose of the current state. */
  scrub(frame: number): void {
    this.mode = 'scrub';
    this.target = null;
    this.seek(Math.min(this.lastFrame, Math.max(0, frame)));
  }

  release(animate = true): void {
    if (this.mode !== 'scrub') return;
    if (!animate) { this.jumpToRest(); return; }
    this.mode = 'toggle';
    this.settle();
  }

  snapshot(): PlayerSnapshot { return { frame: this.frame(), mode: this.mode }; }

  /** Continue from another instance's state (the data was rebuilt): same frame, same intent. */
  restore(s: PlayerSnapshot): void {
    this.seek(s.frame);
    if (s.mode === 'preview') { this.mode = 'preview'; this.armed = true; return; }
    this.mode = 'toggle';
    this.settle();
  }

  dispose(): void {
    this.brisk = null;
    this.anim.removeEventListener('complete', this.onComplete);
    this.anim.removeEventListener('enterFrame', this.onEnterFrame);
    this.anim.destroy();
  }
}
