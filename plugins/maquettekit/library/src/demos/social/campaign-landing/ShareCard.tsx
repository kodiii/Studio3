'use client';
/**
 * Share-card generator: a 1080 × 1080 canvas redrawn from the form, downloadable as a PNG and shareable as a file
 * where the browser supports it (navigator.canShare({ files })). The canvas has a written equivalent that updates
 * with the text; drawing waits for the page fonts so the PNG matches the preview.
 */
import { useEffect, useId, useRef, useState } from 'react';
import styles from './styles.module.css';

const THREADS = [
  { id: 'saffron', label: 'Saffron', color: '#f0b44c' },
  { id: 'coral', label: 'Coral', color: '#ff8a6b' },
  { id: 'chalk', label: 'Chalk', color: '#f3efe6' },
] as const;
type Thread = (typeof THREADS)[number]['id'];
const SIZE = 1080;

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function draw(canvas: HTMLCanvasElement, item: string, thread: Thread, fonts: { display: string; serif: string; mono: string }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const color = THREADS.find((t) => t.id === thread)?.color ?? '#f0b44c';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1e2a4a';
  ctx.fillRect(0, 0, SIZE, SIZE);
  // twill
  ctx.strokeStyle = 'rgba(243, 239, 230, 0.05)';
  ctx.lineWidth = 3;
  for (let x = -SIZE; x < SIZE; x += 18) { ctx.beginPath(); ctx.moveTo(x, SIZE); ctx.lineTo(x + SIZE, 0); ctx.stroke(); }
  ctx.fillStyle = '#c9cfe0';
  ctx.font = `500 30px ${fonts.mono}`;
  ctx.fillText('MEND MARCH · 1–31 MARCH 2027', 84, 120);
  ctx.fillStyle = '#f3efe6';
  ctx.font = `italic 72px ${fonts.serif}`;
  ctx.fillText('I’m mending my', 84, 300);
  let size = 128;
  let lines: string[] = [];
  for (; size >= 72; size -= 8) {
    ctx.font = `800 ${size}px ${fonts.display}`;
    lines = wrap(ctx, item || 'one thing', SIZE - 168);
    if (lines.length <= 3) break;
  }
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, 84, 300 + size * 1.02 * (i + 1)));
  // running stitch
  ctx.setLineDash([26, 18]);
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.beginPath(); ctx.moveTo(84, 812); ctx.bezierCurveTo(330, 772, 520, 852, 700, 800); ctx.stroke();
  // patch
  ctx.save();
  ctx.translate(856, 866); ctx.rotate(-0.07);
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.fillRect(-110, -110, 220, 220);
  ctx.setLineDash([16, 12]);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#1e2a4a';
  ctx.strokeRect(-92, -92, 184, 184);
  ctx.restore();
  ctx.setLineDash([]);
  ctx.fillStyle = '#c9cfe0';
  ctx.font = `500 28px ${fonts.mono}`;
  ctx.fillText('THE MENDING COMMONS', 84, 1000);
}

export function ShareCard({ item: initial }: { item: string }) {
  const uid = useId();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [item, setItem] = useState(initial);
  const [thread, setThread] = useState<Thread>('saffron');
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { if (initial) setItem(initial); }, [initial]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    let alive = true;
    const cs = getComputedStyle(c);
    const fonts = {
      display: cs.getPropertyValue('--mk-font-display').trim() || 'sans-serif',
      serif: cs.getPropertyValue('--mk-font-serif').trim() || 'serif',
      mono: cs.getPropertyValue('--mk-font-mono').trim() || 'monospace',
    };
    draw(c, item, thread, fonts);
    // Redraw once the webfonts are ready so the PNG uses them, not the fallback.
    document.fonts?.ready.then(() => { if (alive) draw(c, item, thread, fonts); }, () => {});
    return () => { alive = false; };
  }, [item, thread]);

  useEffect(() => {
    try {
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      setCanShareFiles(typeof nav.share === 'function' && !!nav.canShare?.({ files: [new File([''], 'probe.png', { type: 'image/png' })] }));
    } catch { setCanShareFiles(false); }
  }, []);

  const toBlob = () => new Promise<Blob | null>((resolve) => canvas.current ? canvas.current.toBlob(resolve, 'image/png') : resolve(null));
  const download = async () => {
    const blob = await toBlob();
    if (!blob) { setNote('Could not create the image in this browser.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mend-march-2027.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNote('Saved mend-march-2027.png.');
  };
  const share = async () => {
    const blob = await toBlob();
    if (!blob) return;
    try {
      await navigator.share({ files: [new File([blob], 'mend-march-2027.png', { type: 'image/png' })], title: 'Mend March 2027' });
      setNote('Shared.');
    } catch (e) { if ((e as Error).name !== 'AbortError') setNote('Sharing failed — download the image instead.'); }
  };

  const text = item.trim() || 'one thing';
  return (
    <div className={styles.card}>
      <div className={styles.cardControls}>
        <label htmlFor={`${uid}-item`} className={styles.label}>Text on the card</label>
        <div className={styles.cardInputRow}>
          <span aria-hidden="true" className={styles.cardPrefix}>I’m mending my</span>
          <input id={`${uid}-item`} className={styles.input} value={item} maxLength={60} placeholder="one thing" onChange={(e) => setItem(e.target.value)} aria-describedby={`${uid}-prefix`} />
        </div>
        <p id={`${uid}-prefix`} className={styles.small}>The card reads “I’m mending my …”. Up to 60 characters.</p>
        <fieldset className={styles.threads}>
          <legend className={styles.label}>Thread colour</legend>
          {THREADS.map((t) => (
            <label key={t.id} className={styles.thread}>
              <input type="radio" name={`${uid}-thread`} checked={thread === t.id} onChange={() => setThread(t.id)} />
              <span className={styles.swatch} style={{ background: t.color }} aria-hidden="true" />
              {t.label}
            </label>
          ))}
        </fieldset>
        <div className={styles.cardActions}>
          <button type="button" className={styles.primary} onClick={() => void download()}>Download PNG</button>
          {canShareFiles ? <button type="button" className={styles.ghost} onClick={() => void share()}>Share image…</button> : null}
        </div>
        <p className={styles.small} aria-live="polite">{note || 'Your card is made in this browser; nothing is uploaded.'}</p>
      </div>
      <canvas ref={canvas} width={SIZE} height={SIZE} className={styles.canvas} role="img"
        aria-label={`Share card preview: I’m mending my ${text}. Mend March, 1 to 31 March 2027. The Mending Commons.`} />
    </div>
  );
}
