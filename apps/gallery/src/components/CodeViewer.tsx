'use client';
import { useEffect, useMemo, useState } from 'react';

interface SourceFile { file: string; code: string }

const KEYWORDS = new Set(['import', 'from', 'export', 'default', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'of', 'in', 'new', 'type', 'interface', 'extends', 'as', 'satisfies', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'null', 'undefined', 'true', 'false', 'void', 'class', 'readonly', 'switch', 'case', 'break', 'continue']);
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(\b\d[\d_.]*(?:px|ms|s|%|rem|em|deg)?\b)|([A-Za-z_$][\w$]*)/g;

/** Tiny dependency-free highlighter: comments, strings, numbers, keywords. Returns React nodes (no innerHTML). */
function highlight(code: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of code.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(code.slice(last, idx));
    const [text, comment, str, num, ident] = m;
    const cls = comment ? 'text-muted italic' : str ? 'text-success' : num ? 'text-signal' : ident && KEYWORDS.has(ident) ? 'font-semibold text-accent' : '';
    out.push(cls ? <span key={i++} className={cls}>{text}</span> : text);
    last = idx + text.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function CodeViewer({ kind, id }: { kind: 'effects' | 'demos'; id: string }) {
  const [files, setFiles] = useState<SourceFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    let alive = true;
    setFiles(null); setError(null); setActive(0);
    fetch(`/sources/${kind}/${id}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { files: SourceFile[] }) => { if (alive) setFiles(j.files); })
      .catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [kind, id]);

  const file = files?.[active];
  const nodes = useMemo(() => (file ? highlight(file.code) : []), [file]);
  const lines = file ? file.code.split('\n').length : 0;

  const copy = async () => {
    if (!file) return;
    try { await navigator.clipboard.writeText(file.code); setCopied('ok'); } catch { setCopied('fail'); }
    window.setTimeout(() => setCopied('idle'), 1800);
  };

  if (error) return <p role="alert" className="font-mono text-sm text-danger">Could not load source ({error}).</p>;
  if (!files || !file) return <p className="s3-label text-muted" aria-live="polite">Loading source…</p>;

  return (
    <div data-code-viewer="" data-stage="ink" className="overflow-hidden rounded-[var(--s3-radius-m)] border border-line bg-bg text-ink">
      <div className="flex items-center justify-between gap-2 border-b border-line pr-2">
        <div role="tablist" aria-label="Source files" className="flex min-w-0 overflow-x-auto">
          {files.map((f, i) => (
            <button key={f.file} role="tab" type="button" aria-selected={i === active} tabIndex={i === active ? 0 : -1} onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                const n = (i + (e.key === 'ArrowRight' ? 1 : files.length - 1)) % files.length;
                setActive(n);
                (e.currentTarget.parentElement?.children[n] as HTMLElement | undefined)?.focus();
              }}
              className="whitespace-nowrap border-r border-line px-3 py-2.5 font-mono text-xs text-muted aria-selected:bg-surface aria-selected:text-ink">
              {f.file}
            </button>
          ))}
        </div>
        <button type="button" onClick={copy} data-copy-code="" className="s3-label shrink-0 rounded-full border border-line px-3 py-1.5 hover:border-line-strong">
          <span aria-live="polite">{copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Copy failed' : 'Copy code'}</span>
        </button>
      </div>
      <div role="tabpanel" tabIndex={0} aria-label={`${file.file}, ${lines} lines`} className="max-h-[560px] overflow-auto">
        <pre className="min-w-max p-4 font-mono text-[12.5px] leading-[1.65]"><code>{nodes}</code></pre>
      </div>
    </div>
  );
}
