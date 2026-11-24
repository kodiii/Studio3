'use client';
import { useRef, useState, type KeyboardEvent } from 'react';
import { COLS, ROWS, cellName, cm, colName, textOn, type Palette } from './data';
import s from './styles.module.css';

interface Props {
  values: Float32Array;
  pal: Palette;
  active: number | null;
  selected: number | null;
  onActive: (i: number | null) => void;
  onSelect: (i: number | null) => void;
  label: string;
}

/** Flat map: an ARIA grid (column letters west → east, row numbers north → south); arrows move, Enter pins a cell. */
export function Heatmap({ values, pal, active, selected, onActive, onSelect, label }: Props) {
  const [focus, setFocus] = useState(0);
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const key = (i: number) => (ev: KeyboardEvent<HTMLSpanElement>) => {
    const c = i % COLS, r = Math.floor(i / COLS);
    const next = ev.key === 'ArrowRight' ? (c < COLS - 1 ? i + 1 : i) : ev.key === 'ArrowLeft' ? (c > 0 ? i - 1 : i)
      : ev.key === 'ArrowDown' ? (r < ROWS - 1 ? i + COLS : i) : ev.key === 'ArrowUp' ? (r > 0 ? i - COLS : i)
      : ev.key === 'Home' ? (ev.ctrlKey ? 0 : r * COLS) : ev.key === 'End' ? (ev.ctrlKey ? COLS * ROWS - 1 : r * COLS + COLS - 1) : null;
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSelect(selected === i ? null : i); return; }
    if (ev.key === 'Escape') { onSelect(null); return; }
    if (next === null) return;
    ev.preventDefault();
    setFocus(next);
    refs.current[next]?.focus();
  };
  const tpl = { gridTemplateColumns: `1.75rem repeat(${COLS}, minmax(24px, 1fr))` };

  return (
    <div className={s.heatScroll}>
      <div role="grid" aria-label={label} aria-rowcount={ROWS + 1} aria-colcount={COLS + 1} className={s.heat} onPointerLeave={() => onActive(null)}>
        <div role="row" className={s.heatRow} style={tpl}>
          <span role="columnheader" className={s.corner}><span className={s.srOnly}>Row</span></span>
          {Array.from({ length: COLS }, (_, c) => <span key={c} role="columnheader" className={s.colHead}>{colName(c)}</span>)}
        </div>
        {Array.from({ length: ROWS }, (_, r) => (
          <div key={r} role="row" className={s.heatRow} style={tpl}>
            <span role="rowheader" className={s.rowHead}>{r + 1}</span>
            {Array.from({ length: COLS }, (_, c) => {
              const i = r * COLS + c;
              const v = values[i];
              const ok = Number.isFinite(v);
              const bg = ok ? pal.color(v) : '';
              return (
                <span
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  role="gridcell"
                  tabIndex={i === focus ? 0 : -1}
                  aria-selected={selected === i}
                  className={s.cell}
                  data-missing={ok ? undefined : ''}
                  data-active={active === i || undefined}
                  style={ok ? { background: bg, color: textOn(bg) } : undefined}
                  onFocus={() => { setFocus(i); onActive(i); }}
                  onPointerEnter={() => onActive(i)}
                  onClick={() => { setFocus(i); onSelect(selected === i ? null : i); }}
                  onKeyDown={key(i)}
                >
                  <span className={s.cellVal} aria-hidden="true">{ok ? cm.format(v) : '–'}</span>
                  <span className={s.srOnly}>{ok ? `${cm.format(v)} cm` : 'no reading'}, {cellName(i)}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
