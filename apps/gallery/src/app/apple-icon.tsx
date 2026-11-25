import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Home-screen icon: the favicon's mark on an opaque square (iOS masks the corners itself). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#bf2f09' }}>
        <svg width="112" height="112" viewBox="0 0 32 32"><path d="M7 24V8h3.6L16 15.6 21.4 8H25v16h-3.4V13.7L16 21.3l-5.6-7.6V24z" fill="#f3f0e8" /></svg>
      </div>
    ),
    size,
  );
}
