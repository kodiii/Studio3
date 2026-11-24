'use client';
/**
 * Motion preference context.
 * `useStudioMotion()` is the single source of truth every recipe reads:
 *   - `reduced`: OS `prefers-reduced-motion` OR an explicit in-app override
 *   - `profile`: Essential / Expressive / Immersive experience profile
 *   - `scale`: multipliers derived from the profile (zeroed distance when reduced)
 * The provider is optional: without it, hooks fall back to the media query.
 */
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { profileScale, type ExperienceProfile } from './tokens';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}
const getSnapshot = (): boolean => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches;
const getServerSnapshot = (): boolean => false;

/** Live OS-level reduced-motion preference (SSR-safe, updates on change). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export interface StudioMotion {
  reduced: boolean;
  profile: ExperienceProfile;
  scale: { duration: number; distance: number; stagger: number; maxConcurrent: number };
}

interface Overrides { reduced?: boolean | null; profile?: ExperienceProfile }
const Ctx = createContext<Overrides>({});

export function StudioMotionProvider({ reduced = null, profile, children }: Overrides & { children: ReactNode }) {
  const value = useMemo(() => ({ reduced, profile }), [reduced, profile]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudioMotion(): StudioMotion {
  const o = useContext(Ctx);
  const os = usePrefersReducedMotion();
  // An override can only ADD reduction on top of the OS preference, never remove it.
  const reduced = os || o.reduced === true;
  const profile = o.profile ?? 'expressive';
  return useMemo(() => {
    const s = profileScale[profile];
    return { reduced, profile, scale: reduced ? { ...s, distance: 0, stagger: 0, maxConcurrent: 1 } : s };
  }, [reduced, profile]);
}

/** Convenience: just the boolean. */
export function useReducedMotion(): boolean {
  return useStudioMotion().reduced;
}
