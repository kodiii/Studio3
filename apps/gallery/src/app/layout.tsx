import type { Metadata, Viewport } from 'next';
import { SITE_URL } from '@/lib/site';
import type { ReactNode } from 'react';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Maquettekit — design, motion and 3D skills for coding agents', template: '%s · Maquettekit' },
  description: 'Live, runnable recipes and demos from Maquettekit, the design, motion, interaction and 3D engineering plugin for Claude Code, Codex, OpenCode and Antigravity.',
  openGraph: { siteName: 'Maquettekit', type: 'website' },
  twitter: { card: 'summary_large_image' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f3f0e8' }, { media: '(prefers-color-scheme: dark)', color: '#0e0e0c' }] };

// Set theme before paint to avoid a flash. Static string, no user input.
const themeScript = `try{var t=localStorage.getItem('mk-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.dataset.reduced=String(localStorage.getItem('mk-reduced')==='true')}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
