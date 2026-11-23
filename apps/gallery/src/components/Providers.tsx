'use client';
import { StudioMotionProvider, type ExperienceProfile } from '@studio3/library/motion';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
interface Settings {
  theme: Theme; setTheme: (t: Theme) => void;
  reduced: boolean; setReduced: (r: boolean) => void;
  profile: ExperienceProfile; setProfile: (p: ExperienceProfile) => void;
}
const Ctx = createContext<Settings | null>(null);
export const useSettings = (): Settings => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings must be used inside <Providers>');
  return v;
};

const read = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function Providers({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [reduced, setReducedState] = useState(false);
  const [profile, setProfileState] = useState<ExperienceProfile>('expressive');

  useEffect(() => {
    const t = read('s3-theme');
    setThemeState(t === 'dark' || t === 'light' ? t : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setReducedState(read('s3-reduced') === 'true');
    const p = read('s3-profile');
    if (p === 'essential' || p === 'expressive' || p === 'immersive') setProfileState(p);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.dataset.reduced = String(reduced); }, [reduced]);

  const setTheme = useCallback((t: Theme) => { setThemeState(t); write('s3-theme', t); }, []);
  const setReduced = useCallback((r: boolean) => { setReducedState(r); write('s3-reduced', String(r)); }, []);
  const setProfile = useCallback((p: ExperienceProfile) => { setProfileState(p); write('s3-profile', p); }, []);
  const value = useMemo(() => ({ theme, setTheme, reduced, setReduced, profile, setProfile }), [theme, setTheme, reduced, setReduced, profile, setProfile]);

  return (
    <Ctx.Provider value={value}>
      <StudioMotionProvider reduced={reduced} profile={profile}>{children}</StudioMotionProvider>
    </Ctx.Provider>
  );
}
