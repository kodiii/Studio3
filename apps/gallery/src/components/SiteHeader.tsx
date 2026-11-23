'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SPECIALTIES } from '@/lib/site';
import { useSettings } from './Providers';

const NAV = [
  { href: '/effects', label: 'Effects' },
  { href: '/studios', label: 'Studios' },
  { href: '/3d', label: '3D Gallery' },
  { href: '/system', label: 'System' },
];

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-[-0.04em] ${className}`}>
      Studio<sup className="ml-[0.04em] align-super text-[0.55em] font-semibold text-signal">3</sup>
    </span>
  );
}

function Toggle({ pressed, onChange, label, children }: { pressed: boolean; onChange: (v: boolean) => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={() => onChange(!pressed)}
      className="s3-label inline-flex h-9 items-center gap-2 rounded-full border border-line px-3 text-ink transition-colors duration-150 hover:border-line-strong aria-pressed:border-line-strong aria-pressed:bg-ink aria-pressed:text-bg"
    >
      {children}
    </button>
  );
}

export function SettingsControls({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, reduced, setReduced } = useSettings();
  return (
    <div className="flex items-center gap-2">
      <Toggle pressed={reduced} onChange={setReduced} label="Reduce motion in previews">
        <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
        {compact ? 'Motion' : reduced ? 'Motion reduced' : 'Reduce motion'}
      </Toggle>
      <Toggle pressed={theme === 'dark'} onChange={(v) => setTheme(v ? 'dark' : 'light')} label="Dark theme">
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M6 1a5 5 0 0 1 0 10z" fill="currentColor" /></svg>
        {compact ? null : theme === 'dark' ? 'Dark' : 'Light'}
      </Toggle>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-sm">
      <a href="#main" className="s3-label absolute left-3 top-3 -translate-y-16 rounded bg-ink px-3 py-2 text-bg focus:translate-y-0">Skip to content</a>
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Studio³ home" className="flex items-baseline gap-3">
          <Wordmark className="text-[1.35rem] leading-none" />
          <span className="s3-label hidden text-muted md:inline">v4.0 Gallery</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + '/');
            return (
              <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
                className="s3-label relative rounded-full px-3 py-2 text-muted transition-colors duration-150 hover:text-ink aria-[current=page]:text-ink">
                {n.label}
                {active ? <span aria-hidden="true" className="absolute inset-x-3 -bottom-[11px] h-[2px] bg-signal" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><SettingsControls /></div>
          <button type="button" className="s3-label inline-flex h-9 items-center rounded-full border border-line px-3 lg:hidden" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>
      <div id="site-menu" ref={panel} hidden={!open} className="border-t border-line bg-bg lg:hidden">
        <nav aria-label="Mobile" className="mx-auto grid max-w-[1400px] gap-1 px-4 py-4 sm:px-6">
          {NAV.map((n) => <Link key={n.href} href={n.href} className="font-display border-b border-line py-3 text-2xl font-semibold tracking-tight">{n.label}</Link>)}
          <p className="s3-label mt-4 text-muted">Specialties</p>
          <div className="flex flex-wrap gap-2 py-2">
            {SPECIALTIES.map((s) => <Link key={s.id} href={`/studios/${s.id}`} className="s3-label rounded-full border border-line px-3 py-2">{s.name}</Link>)}
          </div>
          <div className="pt-3 sm:hidden"><SettingsControls /></div>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto]">
        <div>
          <Wordmark className="text-3xl" />
          <p className="mt-3 max-w-md text-sm text-muted">Design Intelligence. Motion Engineering. Digital Experiences. Everything on this site is running source from the plugin’s library — nothing is a mock-up.</p>
        </div>
        <ul className="s3-label grid grid-cols-2 gap-x-10 gap-y-2 text-muted">
          <li><Link className="hover:text-ink" href="/effects">Effects</Link></li>
          <li><Link className="hover:text-ink" href="/studios">Studios</Link></li>
          <li><Link className="hover:text-ink" href="/3d">3D Gallery</Link></li>
          <li><Link className="hover:text-ink" href="/system">System</Link></li>
        </ul>
      </div>
      <p className="s3-label border-t border-line px-4 py-4 text-center text-muted sm:px-6">MIT licensed · No telemetry · All demo data is simulated and labelled as such</p>
    </footer>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">{children}</main>
      <SiteFooter />
    </>
  );
}
