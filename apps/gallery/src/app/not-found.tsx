import Link from 'next/link';
import { Shell } from '@/components/SiteHeader';

export const metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <Shell>
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-20 sm:px-6">
        <p className="mk-label text-muted">404 · Page not found</p>
        <h1 className="mk-display text-[clamp(2.75rem,8vw,6.5rem)]">Nothing is running here.</h1>
        <p className="max-w-xl text-muted">The address may be mistyped, or the recipe or demo was renamed. Everything that exists is listed in the catalogue.</p>
        <ul className="flex flex-wrap gap-2">
          <li><Link href="/" className="mk-label inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-bg">Home</Link></li>
          <li><Link href="/effects" className="mk-label inline-flex min-h-11 items-center rounded-full border border-line-strong px-5">All recipes</Link></li>
          <li><Link href="/studios" className="mk-label inline-flex min-h-11 items-center rounded-full border border-line-strong px-5">Studios</Link></li>
          <li><Link href="/3d" className="mk-label inline-flex min-h-11 items-center rounded-full border border-line-strong px-5">3D gallery</Link></li>
        </ul>
      </div>
    </Shell>
  );
}
