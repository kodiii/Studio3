'use client';
/**
 * AnimationPlayer — named glTF clips through one AnimationMixer.
 *
 *  - play / pause / toggle / seek (scrub) / speed / loop, cross-fade when the active clip changes while playing
 *  - the mixer only ticks while playing, and each tick requests exactly one more frame (render-on-demand)
 *  - `onState` reports clip, time, duration and playing for DOM transport controls (throttled; no per-frame React state)
 *  - reduced motion: never auto-plays and pauses if the preference turns on; an explicit `play()` from a user
 *    control still works (motion that is the content stays available behind a control)
 *  - cleanup: `stopAllAction()` + `uncacheRoot()` so the mixer holds no references to the model
 */
import { useFrame, useThree } from '@react-three/fiber';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction, type AnimationClip, type Object3D } from 'three';
import { useStudioMotion } from '../../motion';

export interface AnimationState { clip: string | null; time: number; duration: number; playing: boolean }

export interface AnimationPlayerHandle {
  play(): void;
  pause(): void;
  toggle(): void;
  /** Jump to a time in seconds (clamped) and render that pose, playing or not. */
  seek(seconds: number): void;
  getState(): AnimationState;
}

export interface AnimationPlayerProps {
  root: Object3D | null;
  clips: readonly AnimationClip[];
  /** Active clip name. Defaults to the first clip. */
  clip?: string | null;
  /** Start playing on mount. Ignored under reduced motion. */
  autoPlay?: boolean;
  speed?: number;
  loop?: boolean;
  /** Cross-fade seconds when `clip` changes during playback. */
  crossFade?: number;
  /** Throttled state for UI (default every 100 ms while playing, plus every state change). */
  onState?: (state: AnimationState) => void;
  stateInterval?: number;
}

export const AnimationPlayer = forwardRef<AnimationPlayerHandle, AnimationPlayerProps>(function AnimationPlayer(
  { root, clips, clip, autoPlay = false, speed = 1, loop = true, crossFade = 0.3, onState, stateInterval = 100 }, ref,
) {
  const invalidate = useThree((s) => s.invalidate);
  const { reduced } = useStudioMotion();
  const mixer = useMemo(() => (root ? new AnimationMixer(root) : null), [root]);
  const s = useRef({ action: null as AnimationAction | null, playing: false, lastEmit: 0 });
  const live = useRef({ onState, loop, reduced, autoPlay, crossFade });
  live.current = { onState, loop, reduced, autoPlay, crossFade };
  const name = clip ?? clips[0]?.name ?? null;

  const api = useMemo<AnimationPlayerHandle>(() => {
    const state = (): AnimationState => {
      const a = s.current.action;
      return { clip: a?.getClip().name ?? null, time: a ? a.time : 0, duration: a?.getClip().duration ?? 0, playing: s.current.playing };
    };
    const emit = () => { s.current.lastEmit = performance.now(); live.current.onState?.(state()); };
    return {
      play() {
        const a = s.current.action;
        if (!a || !mixer) return;
        if (!live.current.loop && a.time >= a.getClip().duration - 1e-3) a.reset();
        a.paused = false; a.play();
        s.current.playing = true; emit(); invalidate();
      },
      pause() { if (s.current.action) s.current.action.paused = true; s.current.playing = false; emit(); },
      toggle() { s.current.playing ? this.pause() : this.play(); },
      seek(t) {
        const a = s.current.action;
        if (!a || !mixer) return;
        const wasPaused = a.paused;
        a.play(); a.paused = false;
        a.time = Math.min(a.getClip().duration, Math.max(0, t));
        mixer.update(0);
        a.paused = wasPaused || !s.current.playing;
        emit(); invalidate();
      },
      getState: state,
      ...({ _emit: emit } as object),
    };
  }, [mixer, invalidate]);
  useImperativeHandle(ref, () => api, [api]);
  const emit = (api as unknown as { _emit: () => void })._emit;

  // Mixer lifecycle
  useEffect(() => {
    if (!mixer || !root) return;
    const finished = () => { s.current.playing = false; emit(); };
    mixer.addEventListener('finished', finished);
    return () => {
      mixer.removeEventListener('finished', finished);
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      s.current.action = null; s.current.playing = false;
    };
  }, [mixer, root, emit]);

  // Active clip (with cross-fade while playing)
  useEffect(() => {
    if (!mixer) return;
    const next = clips.find((c) => c.name === name);
    const prev = s.current.action;
    if (!next) { prev?.stop(); s.current.action = null; emit(); return; }
    if (prev?.getClip() === next) return;
    const action = mixer.clipAction(next);
    action.reset();
    const playing = prev ? s.current.playing : live.current.autoPlay && !live.current.reduced;
    action.play();
    if (prev && playing && live.current.crossFade > 0 && !live.current.reduced) prev.crossFadeTo(action, live.current.crossFade, false);
    else prev?.stop();
    action.paused = !playing;
    s.current.action = action; s.current.playing = playing;
    mixer.update(0);
    emit(); invalidate();
  }, [mixer, clips, name, emit, invalidate]);

  useEffect(() => {
    const a = s.current.action;
    if (!a) return;
    a.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    a.clampWhenFinished = !loop;
  }, [loop, name, mixer]);
  useEffect(() => { if (mixer) mixer.timeScale = speed; }, [mixer, speed]);
  useEffect(() => { if (reduced && s.current.playing) api.pause(); }, [reduced, api]);

  useFrame((_, dt) => {
    if (!mixer || !s.current.playing) return;
    mixer.update(Math.min(dt, 0.1));
    if (performance.now() - s.current.lastEmit >= stateInterval) emit();
    if (s.current.playing) invalidate();
  });
  return null;
});
