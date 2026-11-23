import { duration, easing, cssEase, spring, stagger, springToLinear, profileScale, type EasingToken, type SpringToken } from '@studio3/library/motion/tokens';
import { defaultBudgets, defaultQualityProfiles } from '@studio3/library/three/quality';
import { Shell } from '@/components/SiteHeader';
import { EasingDemo } from '@/components/EasingDemo';

export const metadata = { title: 'System' };

const COLORS = ['bg', 'surface', 'surface-2', 'ink', 'ink-muted', 'line-strong', 'signal', 'accent-product', 'accent-cinematic', 'accent-data', 'accent-social', 'accent-3d', 'focus', 'success', 'danger'];
const H = ({ children }: { children: React.ReactNode }) => <h2 className="s3-display border-b border-line-strong pb-3 text-[clamp(1.75rem,4vw,3rem)]">{children}</h2>;

export default function SystemPage() {
  return (
    <Shell>
      <div className="mx-auto grid max-w-[1400px] gap-16 px-4 pb-10 sm:px-6">
        <header className="border-b border-line py-10">
          <p className="s3-label text-muted">Shared configuration · motion presets · quality profiles</p>
          <h1 className="s3-display mt-3 text-[clamp(2.75rem,8vw,6.5rem)]">The system</h1>
          <p className="mt-4 max-w-2xl text-muted">The values below are read from the library at build time — the same tokens every recipe imports. Nothing here is a separate style guide that can drift.</p>
        </header>

        <section aria-labelledby="type-h" className="grid gap-6">
          <H><span id="type-h">Typography</span></H>
          <div className="grid gap-8 md:grid-cols-2">
            <p className="font-display text-[clamp(2.5rem,7vw,5.5rem)] font-bold leading-[0.9] tracking-[-0.04em]">Bricolage Grotesque<span className="s3-label mt-3 block font-normal tracking-normal text-muted">Display · variable wght 200–800, wdth, opsz · OFL-1.1</span></p>
            <div className="grid gap-6">
              <p className="font-serif text-4xl italic leading-tight">Instrument Serif, for the one line that needs a voice.<span className="s3-label mt-2 block not-italic text-muted">Accent · OFL-1.1</span></p>
              <p className="text-base leading-relaxed">Geist carries interface copy: quiet, even, legible at 13 px. Body measure stays between 45 and 75 characters.<span className="s3-label mt-2 block text-muted">Text · OFL-1.1</span></p>
              <p className="font-mono text-sm">JetBrains Mono — 0123456789 · labels, indices, code<span className="s3-label mt-2 block text-muted">Mono · OFL-1.1</span></p>
            </div>
          </div>
        </section>

        <section aria-labelledby="color-h" className="grid gap-6">
          <H><span id="color-h">Colour roles</span></H>
          <p className="max-w-2xl text-sm text-muted">Paper, ink and one signal. Each specialty owns a single accent; nothing else is coloured. Swatches follow the active theme.</p>
          <ul className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
            {COLORS.map((c) => (
              <li key={c} className="bg-surface p-3">
                <div className="h-16 border border-line" style={{ background: `var(--s3-${c})` }} />
                <code className="mt-2 block font-mono text-xs">--s3-{c}</code>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="motion-h" className="grid gap-6">
          <H><span id="motion-h">Motion tokens</span></H>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h3 className="s3-label mb-3 text-muted">Durations</h3>
              <table className="w-full text-sm"><tbody>
                {Object.entries(duration).map(([k, v]) => (
                  <tr key={k} className="border-b border-line"><th scope="row" className="py-2 text-left font-mono text-xs font-normal">{k}</th><td className="w-full px-4"><div className="h-1.5 bg-ink" style={{ width: `${(v / 1400) * 100}%` }} /></td><td className="py-2 text-right font-mono text-xs tabular-nums">{v}ms</td></tr>
                ))}
              </tbody></table>
              <h3 className="s3-label mb-3 mt-8 text-muted">Stagger</h3>
              <p className="font-mono text-xs">{Object.entries(stagger).map(([k, v]) => `${k} ${v}ms`).join(' · ')}</p>
              <h3 className="s3-label mb-3 mt-8 text-muted">Experience profiles (multipliers)</h3>
              <table className="w-full text-sm">
                <thead><tr className="s3-label border-b border-line-strong text-left text-muted"><th scope="col" className="py-2 font-normal">Profile</th><th scope="col" className="font-normal">Duration</th><th scope="col" className="font-normal">Distance</th><th scope="col" className="font-normal">Stagger</th><th scope="col" className="font-normal">Concurrent</th></tr></thead>
                <tbody>{Object.entries(profileScale).map(([k, v]) => (
                  <tr key={k} className="border-b border-line font-mono text-xs tabular-nums"><th scope="row" className="py-2 text-left font-normal">{k}</th><td>×{v.duration}</td><td>×{v.distance}</td><td>×{v.stagger}</td><td>{v.maxConcurrent}</td></tr>
                ))}</tbody>
              </table>
              <p className="mt-3 text-xs text-muted">A profile shapes motion; it never overrides reduced motion, keyboard access or user control.</p>
            </div>
            <div>
              <h3 className="s3-label mb-3 text-muted">Easings &amp; springs — press play</h3>
              <EasingDemo
                easings={(Object.keys(easing) as EasingToken[]).map((k) => ({ name: k, css: cssEase(k), ms: duration.slow }))}
                springs={(Object.keys(spring) as SpringToken[]).map((k) => { const s = springToLinear(spring[k]); return { name: k, css: s.easing, ms: s.duration, note: `k ${spring[k].stiffness} · c ${spring[k].damping} · m ${spring[k].mass}` }; })}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="quality-h" className="grid gap-6">
          <H><span id="quality-h">3D quality profiles</span></H>
          <p className="max-w-2xl text-sm text-muted">Starting points, not universal thresholds. Budgets are configurable per project and must be verified on the devices you ship to.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="s3-label border-b border-line-strong text-left text-muted">{['Level', 'DPR', 'AA', 'Shadows', 'Post', 'Texture max', 'Variant', 'Density', 'Draw-call budget', 'Triangle budget'].map((h) => <th key={h} scope="col" className="py-2 pr-4 font-normal">{h}</th>)}</tr></thead>
              <tbody>{Object.values(defaultQualityProfiles).map((p) => (
                <tr key={p.level} className="border-b border-line font-mono text-xs tabular-nums">
                  <th scope="row" className="py-2 pr-4 text-left font-normal">{p.level}</th><td>{p.dpr.join('–')}</td><td>{p.antialias ? 'on' : 'off'}</td><td>{p.shadows ? p.shadowMapSize : 'off'}</td><td>{p.postprocessing ? 'on' : 'off'}</td><td>{p.textureMax}px</td><td>{p.modelVariant}</td><td>×{p.density}</td><td>{defaultBudgets[p.level].drawCalls}</td><td>{defaultBudgets[p.level].triangles.toLocaleString('en')}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      </div>
    </Shell>
  );
}
