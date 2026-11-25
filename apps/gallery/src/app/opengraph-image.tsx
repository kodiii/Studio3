import { ImageResponse } from 'next/og';

export const alt = 'Maquettekit — design, motion and 3D skills for coding agents';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SPECIALTIES = [
  ['Product', '#2446d8'], ['Cinematic', '#bf2f09'], ['Data', '#0a6e4d'], ['Social', '#b8166f'], ['3D', '#8a5a00'], // --mk-accent-* (light)
] as const;

/** The site-wide share image: wordmark, one line of what it is, the five studios. Text stays clear of the outer 72 px. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 84, background: '#f3f0e8', color: '#11110f' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#bf2f09" /><path d="M7 24V8h3.6L16 15.6 21.4 8H25v16h-3.4V13.7L16 21.3l-5.6-7.6V24z" fill="#f3f0e8" /></svg>
          <div style={{ display: 'flex', fontSize: 30, letterSpacing: 4, textTransform: 'uppercase', color: '#5c5a52' }}>Plugin for coding agents</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 132, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>
            Maquette<span style={{ color: '#bf2f09', fontWeight: 400, letterSpacing: -2, marginLeft: -22 }}>kit</span>
          </div>
          <div style={{ display: 'flex', fontSize: 44, marginTop: 24, lineHeight: 1.2 }}>Design, motion and 3D skills — with tools that measure the result.</div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {SPECIALTIES.map(([name, colour]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 26, padding: '10px 18px', borderRadius: 999, border: '2px solid #11110f22' }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: colour }} />{name}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
