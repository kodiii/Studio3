// @ts-check
/**
 * Design-token lint: finds values in a project's styles that are not from its design system — colour literals off
 * the palette, and spacing, font sizes, radii and durations off their scales — and suggests the nearest token.
 *
 * Allowed values come from maquettekit.design.json (through its CSS token export, so every value maps to its
 * `--mk-*` name) and from token definitions already in the project: custom properties declared in `:root`, `html`,
 * `:host`, `[data-theme…]`, `.theme-…` or Tailwind v4 `@theme` blocks, and SCSS/LESS variables. A category with no
 * tokens at all is not judged (everything would be "off-token"); the summary says so instead.
 *
 * Scanned: CSS/SCSS/LESS files; <style> blocks and style="" attributes in HTML/Vue/Svelte/Astro; JSX style={{…}}
 * objects, styled-components/emotion templates and Tailwind arbitrary values (bg-[#123456], p-[13px]) in JS/TS.
 * A `maquettekit-lint-ignore` comment skips its own line; on a line of its own it also skips the next line.
 */
import fs from 'node:fs';
import path from 'node:path';
import { deltaEOk, rgbToHex } from './color.mjs';
import { exportTokens } from './exports.mjs';

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.nuxt', '.svelte-kit', '.astro', '.output', '.vercel', '.turbo', '.cache', 'dist', 'build', 'out', 'coverage', '.maquettekit', 'vendor']);
const CSS_EXT = new Set(['.css', '.scss', '.sass', '.less', '.pcss']);
const MARKUP_EXT = new Set(['.html', '.htm', '.vue', '.svelte', '.astro']);
const JS_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const MAX_FILE_BYTES = 512 * 1024;
const ROOTISH = /^(?::root|html|:host|\[data-theme[^\]]*\]|\[data-mode[^\]]*\]|\.(?:theme|dark|light)\b[\w-]*|@theme\b)/;

// ---------------------------------------------------------------------------------------------------------------
// value parsing
// ---------------------------------------------------------------------------------------------------------------
const NAMED_OK = new Set(['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'revert', 'none']);
/** Next.js metadata image routes written as code (rendered to PNG by ImageResponse). */
const IMAGE_ROUTE = /(^|\/)(opengraph-image|twitter-image|icon|apple-icon)\d*\.[cm]?[jt]sx?$/;
const COLOUR_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(\s*[^()]*\)|\b(?:oklch|oklab|lab|lch)\(\s*[^()]*\)/g;

/** @param {string} lit @returns {string|null} 6-digit lowercase hex (alpha ignored) */
export function colourToHex(lit) {
  const s = lit.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    if (h.length === 6 || h.length === 8) return `#${h.slice(0, 6)}`;
    return null;
  }
  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/.exec(s);
  if (m) {
    const ch = (v) => (v.endsWith('%') ? (parseFloat(v) / 100) * 255 : parseFloat(v)) / 255;
    return rgbToHex({ r: ch(m[1]), g: ch(m[2]), b: ch(m[3]) });
  }
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(s);
  if (m) {
    const h = parseFloat(m[1]) / 360; const sat = parseFloat(m[2]) / 100; const l = parseFloat(m[3]) / 100;
    const f = (n) => { const k = (n + h * 12) % 12; const a = sat * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return rgbToHex({ r: f(0), g: f(8), b: f(4) });
  }
  return null; // oklch()/lab() literals are compared as text only
}

/**
 * `var(--x, fallback)` → `var(--x)`: a fallback only applies when the token is missing, so it is not a hard-coded
 * value in the design-system sense. Handles nested parentheses in the fallback.
 * @param {string} value
 */
export function stripVarFallbacks(value) {
  let out = ''; let i = 0;
  while (i < value.length) {
    const at = value.indexOf('var(', i);
    if (at === -1) { out += value.slice(i); break; }
    out += value.slice(i, at + 4);
    let depth = 1; let j = at + 4; let comma = -1;
    for (; j < value.length && depth > 0; j++) {
      const ch = value[j];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 1 && comma === -1) comma = j;
    }
    const inner = value.slice(at + 4, j - 1);
    out += `${comma === -1 ? inner : value.slice(at + 4, comma)})`;
    i = j;
  }
  return out;
}

/** All px-equivalent lengths in a value outside calc()/var()/url(). rem/px only (em and % are relative). */
function lengthsOf(value) {
  const plain = value.replace(/\b(?:calc|var|env|url|min|max|clamp)\([^()]*(?:\([^()]*\)[^()]*)*\)/g, ' ');
  const out = [];
  for (const m of plain.matchAll(/(-?\d*\.?\d+)(px|rem)\b/g)) out.push({ raw: m[0], px: Math.abs(parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1)) });
  return out;
}
/** Durations (ms) in a value outside calc()/var(). */
function durationsOf(value) {
  const plain = value.replace(/\b(?:calc|var|cubic-bezier|steps)\([^()]*\)/g, ' ');
  const out = [];
  for (const m of plain.matchAll(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g)) out.push({ raw: m[0], ms: parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1) });
  return out;
}

/** Fast 1-based line lookup for offsets in a source string. @param {string} src */
function lineIndexer(src) {
  const breaks = [];
  for (let k = 0; k < src.length; k++) if (src.charCodeAt(k) === 10) breaks.push(k);
  return (i) => { let lo = 0; let hi = breaks.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (breaks[mid] < i) lo = mid + 1; else hi = mid; } return lo + 1; };
}

// ---------------------------------------------------------------------------------------------------------------
// CSS declaration scanner (handles nesting, strings, comments, url(); good enough for lint, not a full parser)
// ---------------------------------------------------------------------------------------------------------------
/**
 * @param {string} css
 * @param {number} [lineOffset] 0-based line of css[0] in the file
 * @returns {{ prop: string, value: string, line: number, token: boolean }[]}
 */
export function scanCss(css, lineOffset = 0) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
  const out = [];
  const stack = [];
  let buf = ''; let bufStart = 0; let quote = ''; let paren = 0;
  const lineOf = lineIndexer(text);
  const lineAt = (i) => lineOf(i) - 1;
  let blockSeq = 0;
  const blockIds = [];
  const flush = (end) => {
    const raw = buf; buf = '';
    const t = raw.trim();
    if (!t || !stack.length) return;
    const ci = t.indexOf(':');
    if (ci <= 0) return;
    const prop = t.slice(0, ci).trim().toLowerCase();
    if (!/^(--|\$|@)?[a-z][\w-]*$/i.test(prop)) return; // selectors such as a:hover reach here without "{"
    const value = t.slice(ci + 1).trim().replace(/\s*!important$/i, '');
    const lead = raw.length - raw.trimStart().length;
    const token = /^(--|\$|@)/.test(prop) && (prop[0] !== '-' || stack.some((s) => ROOTISH.test(s)));
    out.push({ prop, value, line: lineOffset + lineAt(bufStart + lead) + 1, token, block: blockIds[blockIds.length - 1] });
    void end;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { buf += ch; if (ch === quote && text[i - 1] !== '\\') quote = ''; continue; }
    if (ch === '"' || ch === "'") { quote = ch; if (!buf) bufStart = i; buf += ch; continue; }
    if (ch === '(') paren++;
    if (ch === ')') paren = Math.max(0, paren - 1);
    if (paren === 0 && ch === ';') { flush(i); bufStart = i + 1; continue; }
    if (paren === 0 && ch === '{') { stack.push(buf.trim()); blockIds.push(++blockSeq); buf = ''; bufStart = i + 1; continue; }
    if (paren === 0 && ch === '}') { flush(i); stack.pop(); blockIds.pop(); bufStart = i + 1; continue; }
    if (!buf) bufStart = i;
    buf += ch;
  }
  // A block that declares only custom properties (and color-scheme) may re-theme a subtree, e.g. [data-stage='ink']
  // redefining --mk-bg. Its properties become tokens only if they redefine names declared at the root (decided by
  // lintProject once every file is read); otherwise they are component-local variables and are linted.
  const byBlock = new Map();
  for (const d of out) { if (!byBlock.has(d.block)) byBlock.set(d.block, []); byBlock.get(d.block).push(d); }
  for (const decls of byBlock.values()) {
    if (decls.length && decls.every((d) => d.prop.startsWith('--') || d.prop === 'color-scheme')) for (const d of decls) if (d.prop.startsWith('--') && !d.token) d.theme = true;
  }
  return out.map(({ block, ...d }) => d);
}

/** Inline declarations ("color: red; padding: 4px") as if inside a rule. */
function scanInline(decls, line) {
  return scanCss(`x{${decls}}`, line - 1).map((d) => ({ ...d, line }));
}

const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const UNITLESS_PX = /^(margin|padding|gap|rowGap|columnGap|fontSize|borderRadius|border\w*Radius|margin\w+|padding\w+)$/;

/** Declarations found in a JS/TS/JSX source: style objects, styled templates, Tailwind arbitrary values. */
function scanScript(src) {
  const out = [];
  const lineOf = lineIndexer(src);
  // JSX style={{ ... }} (one level of nesting is enough for style objects)
  for (const m of src.matchAll(/style=\{\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\}/g)) {
    for (const kv of m[1].matchAll(/([A-Za-z]+)\s*:\s*(?:(['"`])([^'"`]*)\2|(-?\d+(?:\.\d+)?)(?![\w.]))/g)) {
      const prop = kebab(kv[1]);
      const value = kv[3] !== undefined ? kv[3] : (UNITLESS_PX.test(kv[1]) ? `${kv[4]}px` : kv[4]);
      out.push({ prop, value, line: lineOf(m.index + kv.index), token: false });
    }
  }
  // styled-components / emotion / lit css templates
  for (const m of src.matchAll(/(?:styled(?:\.\w+|\([^)]*\))(?:\.attrs\([^)]*\))?|\bcss|createGlobalStyle|keyframes)\s*`([^`]*)`/g)) {
    const body = m[1].replace(/\$\{[^}]*\}/g, 'var(--interp)');
    const start = lineOf(m.index) - 1;
    out.push(...scanCss(/[{]/.test(body) ? body : `x{${body}}`, start));
  }
  out.push(...scanTailwind(src, lineOf));
  return out;
}

/** Tailwind arbitrary values in class strings. */
function scanTailwind(src, lineOf) {
  const out = [];
  const map = [
    [/(?<![\w-])(?:bg|text|border(?:-[trblxy])?|fill|stroke|from|via|to|ring|outline|decoration|accent|caret|divide|placeholder|shadow)-\[(#[0-9a-fA-F]{3,8}|rgba?\([^\]]+\)|hsla?\([^\]]+\))\]/g, 'color'],
    [/(?<![\w-])(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y)-\[(-?\d*\.?\d+(?:px|rem))\]/g, 'padding'],
    [/(?<![\w-])text-\[(\d*\.?\d+(?:px|rem))\]/g, 'font-size'],
    [/(?<![\w-])rounded(?:-[a-z]{1,2})?-\[(\d*\.?\d+(?:px|rem))\]/g, 'border-radius'],
    [/(?<![\w-])(?:duration|delay)-\[(\d*\.?\d+m?s)\]/g, 'transition-duration'],
  ];
  for (const [re, prop] of map) for (const m of src.matchAll(re)) out.push({ prop, value: m[1].replace(/_/g, ' '), line: lineOf(m.index), token: false, tailwind: m[0] });
  return out;
}

/** Declarations from markup: <style> blocks, style="" attributes, Tailwind classes. */
function scanMarkup(src) {
  const out = [];
  const lineOf = lineIndexer(src);
  for (const m of src.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) out.push(...scanCss(m[1], lineOf(m.index + m[0].indexOf('>') + 1) - 1));
  for (const m of src.matchAll(/\sstyle\s*=\s*(["'])([^"']*)\1/gi)) out.push(...scanInline(m[2], lineOf(m.index)));
  out.push(...scanTailwind(src, lineOf));
  // script blocks in SFCs may hold JSX/style objects too
  for (const m of src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) out.push(...scanScript(m[1]).map((d) => ({ ...d, line: d.line + lineOf(m.index) - 1 })));
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// token sets
// ---------------------------------------------------------------------------------------------------------------
const CAT_HINT = {
  spacing: /(?:^|[-_$])(space|spacing|gap|gutter|inset|pad|padding|margin|stack|section|indent)/i,
  radius: /radius|rounded|corner/i,
  fontSize: /(?:^|[-_$])(text|font-size|fs|type|size-(?:xs|sm|md|base|lg|xl|\d?xl))(?:$|[-_])/i,
  duration: /duration|delay|stagger|timing|speed|motion-/i,
};

function emptySets() {
  return { colours: new Map(), spacing: new Map(), radius: new Map(), fontSize: new Map(), fontSizeText: new Map(), duration: new Map() };
}
function addNamed(map, key, name) { if (!map.has(key)) map.set(key, []); if (name && !map.get(key).includes(name)) map.get(key).push(name); }

/** Add one token definition (custom property or preprocessor variable) to the sets. */
function addToken(sets, name, value) {
  for (const lit of value.match(COLOUR_RE) ?? []) { const hex = colourToHex(lit); if (hex) addNamed(sets.colours, hex, name); }
  const ls = lengthsOf(value);
  if (CAT_HINT.radius.test(name)) for (const l of ls) addNamed(sets.radius, round(l.px), name);
  else if (CAT_HINT.fontSize.test(name) && !/colou?r/i.test(name)) {
    addNamed(sets.fontSizeText, value.trim(), name);
    for (const l of [...ls, ...clampBounds(value)]) addNamed(sets.fontSize, round(l.px), name);
  } else if (CAT_HINT.spacing.test(name)) for (const l of ls) addNamed(sets.spacing, round(l.px), name);
  if (CAT_HINT.duration.test(name)) for (const d of durationsOf(value)) addNamed(sets.duration, Math.round(d.ms), name);
}
const round = (px) => Math.round(px * 100) / 100;
/** min and max of clamp(a, b, c) when given in px/rem */
function clampBounds(value) {
  const m = /clamp\(\s*([\d.]+)(px|rem)\s*,[^,]+,\s*([\d.]+)(px|rem)\s*\)/.exec(value);
  if (!m) return [];
  return [{ raw: '', px: parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1) }, { raw: '', px: parseFloat(m[3]) * (m[4] === 'rem' ? 16 : 1) }];
}

/** Token sets from a design file: its full CSS export, plus the raw scales for robustness. */
function addDesignFile(sets, doc) {
  const css = exportTokens(doc, 'css');
  for (const d of scanCss(css)) if (d.prop.startsWith('--')) addToken(sets, d.prop, d.value);
  for (const [k, v] of Object.entries(doc.spacing?.scale ?? {})) addNamed(sets.spacing, round(Number(v)), `--mk-space-${String(k).replace('.', '_')}`);
  for (const [k, v] of Object.entries(doc.radius?.scale ?? {})) addNamed(sets.radius, round(Number(v)), `--mk-radius-${k}`);
  for (const [k, s] of Object.entries(doc.typography?.scale?.steps ?? {})) { addNamed(sets.fontSize, round(s.minPx), `--mk-text-${k}`); addNamed(sets.fontSize, round(s.maxPx), `--mk-text-${k}`); }
  for (const [k, v] of Object.entries(doc.motion?.durations ?? {})) addNamed(sets.duration, Number(v), `--mk-duration-${k}`);
}

// ---------------------------------------------------------------------------------------------------------------
// project walk
// ---------------------------------------------------------------------------------------------------------------
function walk(dir, files, root, ignore) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.storybook') { if (e.isDirectory()) continue; }
    const p = path.join(dir, e.name);
    const rel = path.relative(root, p).split(path.sep).join('/');
    if (ignore.some((g) => rel === g || rel.startsWith(`${g.replace(/\/$/, '')}/`) || (g.startsWith('*.') && rel.endsWith(g.slice(1))))) continue;
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p, files, root, ignore); continue; }
    const ext = path.extname(e.name).toLowerCase();
    if (CSS_EXT.has(ext) || MARKUP_EXT.has(ext) || JS_EXT.has(ext)) files.push(p);
  }
}

const isGenerated = (src) => /Generated by maquettekit-design-intelligence/.test(src.slice(0, 600));

/**
 * @param {{ dir?: string, design?: string|null, tokens?: string[], ignore?: string[], maxFindings?: number }} opts
 */
export function lintProject(opts = {}) {
  const root = path.resolve(opts.dir ?? '.');
  const designPath = opts.design === null ? null : path.resolve(root, opts.design ?? 'maquettekit.design.json');
  const sets = emptySets();
  const sources = [];
  /** @type {string|null} */ let designError = null;
  if (designPath && fs.existsSync(designPath)) {
    try {
      addDesignFile(sets, JSON.parse(fs.readFileSync(designPath, 'utf8')));
      sources.push(path.relative(root, designPath) || path.basename(designPath));
    } catch (err) {
      designError = `${path.basename(designPath)} could not be read (${/** @type {Error} */ (err).message}); linted against the project's own tokens only`;
    }
  }
  const files = [];
  walk(root, files, root, opts.ignore ?? []);
  for (const t of opts.tokens ?? []) { const p = path.resolve(root, t); if (fs.existsSync(p) && !files.includes(p)) files.push(p); }

  /** @type {{ file: string, decls: any[], ignored: Set<number>, generated: boolean }[]} */
  const parsed = [];
  for (const f of files) {
    let src = '';
    try { if (fs.statSync(f).size > MAX_FILE_BYTES) continue; src = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const ext = path.extname(f).toLowerCase();
    const lineOf = lineIndexer(src);
    const decls = CSS_EXT.has(ext) ? [...scanCss(src), ...scanTailwind(src, lineOf)] : MARKUP_EXT.has(ext) ? scanMarkup(src) : scanScript(src);
    const ignored = new Set();
    // a trailing marker covers its own line; a marker alone on a comment line covers the next line
    src.split('\n').forEach((l, i) => {
      if (!l.includes('maquettekit-lint-ignore')) return;
      ignored.add(i + 1);
      if (/^\s*(\/\*|\/\/|<!--|\{\s*\/\*)/.test(l)) ignored.add(i + 2);
    });
    parsed.push({ file: path.relative(root, f).split(path.sep).join('/'), decls, ignored, generated: isGenerated(src) });
  }
  // pass 1: root tokens; pass 2: theme blocks that redefine root token names
  const rootNames = new Set(parsed.flatMap((p) => p.decls.filter((d) => d.token && d.prop.startsWith('--')).map((d) => d.prop)));
  for (const p of parsed) {
    let definesTokens = false;
    for (const d of p.decls) {
      if (d.theme && rootNames.has(d.prop)) d.token = true;
      if (d.token) { addToken(sets, d.prop, d.value); definesTokens = true; }
    }
    if (definesTokens && !sources.includes(p.file)) sources.push(p.file);
  }
  const linted = parsed.filter((p) => !p.generated);

  // judge a category only when its tokens look like a system rather than one or two stray variables
  const has = { colours: sets.colours.size >= 4, spacing: sets.spacing.size >= 4, radius: sets.radius.size >= 2, fontSize: sets.fontSize.size >= 3, duration: sets.duration.size >= 2 };
  const findings = [];
  const distinct = { colours: new Set(), fontSizes: new Set(), spacing: new Set(), radius: new Set(), durations: new Set() };
  const nearestColour = (hex) => {
    let best = null;
    for (const [h, names] of sets.colours) { const d = deltaEOk(hex, h); if (!best || d < best.d) best = { hex: h, d, name: names[0] }; }
    return best;
  };
  const nearestNum = (map, v) => { let best = null; for (const [k, names] of map) { const d = Math.abs(k - v); if (!best || d < best.d) best = { v: k, d, name: names[0] }; } return best; };
  const fmtVar = (name) => (name ? (name.startsWith('--') ? `var(${name})` : name) : 'a token');

  const imageRoutes = [];
  for (const { file, decls, ignored } of linted) {
    // Next.js metadata image routes (opengraph-image, twitter-image, icon, apple-icon as code) render to PNG with
    // ImageResponse: CSS variables do not resolve there and sizes are image pixels, not the page's scales. Judge only
    // whether their colours are on the palette, and point at the token's value rather than var().
    const imageRoute = IMAGE_ROUTE.test(file);
    if (imageRoute) imageRoutes.push(file);
    for (const d of decls) {
      if (d.token || ignored.has(d.line)) continue;
      const prop = d.prop;
      if (prop.startsWith('$') || prop.startsWith('@')) continue;
      const base = { file, line: d.line, property: prop, ...(d.tailwind ? { tailwind: d.tailwind } : {}) };
      d.value = stripVarFallbacks(d.value);
      // colours (anywhere except url())
      const valueNoUrl = d.value.replace(/url\([^)]*\)/g, '');
      for (const lit of valueNoUrl.match(COLOUR_RE) ?? []) {
        distinct.colours.add(lit.toLowerCase());
        if (!has.colours) continue;
        const hex = colourToHex(lit);
        if (hex && sets.colours.has(hex)) {
          if (!imageRoute) findings.push({ ...base, rule: 'literal-token-colour', severity: 'minor', value: lit, message: `${lit} equals a token; write ${fmtVar(sets.colours.get(hex)[0])} so theme changes reach it.` });
          continue;
        }
        const near = hex ? nearestColour(hex) : null;
        const shadow = /shadow|filter/.test(prop);
        const nearText = near ? (imageRoute ? `; nearest token ${near.name} — use its value ${near.hex} (image routes cannot read CSS variables)` : `; nearest token ${fmtVar(near.name)} (${near.hex}, ΔE ${near.d.toFixed(3)})`) : '';
        findings.push({ ...base, rule: 'off-token-colour', severity: shadow ? 'minor' : 'major', value: lit,
          message: `${lit} is not in the palette${nearText}.`, ...(near ? { suggestion: imageRoute ? near.hex : near.name, distance: Number(near.d.toFixed(4)) } : {}) });
      }
      for (const named of valueNoUrl.match(/(?<![\w-])(?:white|black|red|blue|green|gray|grey|orange|purple|yellow|pink|silver|navy|teal)(?![\w-])/gi) ?? []) {
        if (!/color|background|border|fill|stroke|outline|shadow/.test(prop) || NAMED_OK.has(named.toLowerCase()) || !has.colours) continue;
        findings.push({ ...base, rule: 'off-token-colour', severity: 'major', value: named, message: `Named colour "${named}" is not from the palette.` });
      }
      if (imageRoute) continue; // scales are the page's, not the image's
      // spacing
      if (/^(margin|padding|gap|row-gap|column-gap)(-|$)|^(margin|padding)-(top|right|bottom|left|inline|block)/.test(prop)) {
        for (const l of lengthsOf(d.value)) {
          if (l.px === 0 || l.px === 1) continue;
          distinct.spacing.add(round(l.px));
          if (!has.spacing) continue;
          const near = nearestNum(sets.spacing, l.px);
          if (near && near.d <= 0.5) continue;
          findings.push({ ...base, rule: 'off-scale-spacing', severity: 'minor', value: l.raw, message: `${l.raw} is not on the spacing scale${near ? `; nearest ${fmtVar(near.name)} (${near.v}px)` : ''}.`, ...(near ? { suggestion: near.name } : {}) });
        }
      }
      // font size
      if (prop === 'font-size' || (prop === 'font' && /\d(px|rem)/.test(d.value))) {
        const v = d.value.trim();
        if (/var\(/.test(v) || sets.fontSizeText.has(v)) continue;
        const ls = prop === 'font' ? lengthsOf(v.split('/')[0]).slice(0, 1) : lengthsOf(v);
        for (const l of ls) {
          distinct.fontSizes.add(round(l.px));
          if (!has.fontSize) continue;
          const near = nearestNum(sets.fontSize, l.px);
          if (near && near.d <= 0.5) continue;
          findings.push({ ...base, rule: 'off-scale-font-size', severity: 'minor', value: l.raw, message: `${l.raw} is not on the type scale${near ? `; nearest ${fmtVar(near.name)}` : ''}.`, ...(near ? { suggestion: near.name } : {}) });
        }
        if (/^clamp\(/.test(v) && has.fontSize && !ls.length) findings.push({ ...base, rule: 'off-scale-font-size', severity: 'minor', value: v, message: `Fluid size ${v} is not one of the type-scale steps.` });
      }
      // radius
      if (/^border(-[a-z]+)*-radius$/.test(prop)) {
        for (const l of lengthsOf(d.value)) {
          if (l.px === 0 || l.px >= 999) continue;
          distinct.radius.add(round(l.px));
          if (!has.radius) continue;
          const near = nearestNum(sets.radius, l.px);
          if (near && near.d <= 0.5) continue;
          findings.push({ ...base, rule: 'off-scale-radius', severity: 'minor', value: l.raw, message: `${l.raw} is not on the radius scale${near ? `; nearest ${fmtVar(near.name)} (${near.v}px)` : ''}.`, ...(near ? { suggestion: near.name } : {}) });
        }
      }
      // durations
      if (/^(transition|animation)(-duration|-delay)?$/.test(prop)) {
        for (const t of durationsOf(d.value)) {
          if (t.ms < 1) continue; // 0s, or the 0.01ms reduced-motion override
          distinct.durations.add(t.ms);
          if (!has.duration) continue;
          const near = nearestNum(sets.duration, t.ms);
          if (near && near.d <= 5) continue;
          findings.push({ ...base, rule: 'off-token-duration', severity: 'minor', value: t.raw, message: `${t.raw} is not a motion token${near ? `; nearest ${fmtVar(near.name)} (${near.v}ms)` : ''}.`, ...(near ? { suggestion: near.name } : {}) });
        }
      }
    }
  }

  const notJudged = Object.entries(has).filter(([, v]) => !v).map(([k]) => k);
  const metrics = { distinctColourLiterals: distinct.colours.size, distinctFontSizes: distinct.fontSizes.size, distinctSpacingValues: distinct.spacing.size, distinctRadii: distinct.radius.size, distinctDurations: distinct.durations.size };
  if (distinct.fontSizes.size > 8) findings.push({ rule: 'too-many-font-sizes', severity: 'info', file: null, line: null, value: String(distinct.fontSizes.size), message: `${distinct.fontSizes.size} distinct literal font sizes; a type scale usually needs 6–8.` });
  const order = { major: 0, minor: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || String(a.file).localeCompare(String(b.file)) || (a.line ?? 0) - (b.line ?? 0));
  const max = opts.maxFindings ?? 500;
  const bySeverity = { major: 0, minor: 0, info: 0 };
  for (const f of findings) bySeverity[f.severity]++;
  const byRule = {};
  for (const f of findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
  return {
    tool: 'maquettekit-design-lint', root, tokenSources: sources, tokensFound: Object.fromEntries(Object.entries(sets).filter(([k]) => k !== 'fontSizeText').map(([k, v]) => [k, v.size])),
    notJudged, filesScanned: linted.length, imageRoutes, metrics, ...(designError ? { designError } : {}), summary: { ...bySeverity, total: findings.length, byRule },
    findings: findings.slice(0, max), truncated: findings.length > max,
  };
}

/** Markdown report. @param {ReturnType<typeof lintProject>} r */
export function lintMarkdown(r) {
  const lines = ['# Design-token lint', '', `Scanned ${r.filesScanned} files in \`${r.root}\`. Token sources: ${r.tokenSources.length ? r.tokenSources.map((s) => `\`${s}\``).join(', ') : '**none found**'}.`, ''];
  if (r.notJudged.length) lines.push(`Not judged (no tokens defined): ${r.notJudged.join(', ')}.`, '');
  if (r.imageRoutes?.length) lines.push(`Image routes (rendered to PNG; only palette colours judged): ${r.imageRoutes.map((f) => `\`${f}\``).join(', ')}.`, '');
  lines.push(`**${r.summary.major} major, ${r.summary.minor} minor, ${r.summary.info} info.**`, '');
  if (r.findings.length) {
    lines.push('| Severity | Where | Property | Value | Finding |', '| - | - | - | - | - |');
    for (const f of r.findings) lines.push(`| ${f.severity} | ${f.file ? `${f.file}:${f.line}` : '—'} | ${f.property ?? ''} | \`${f.value}\` | ${f.message.replace(/\|/g, '\\|')} |`);
  }
  lines.push('', `Distinct literals: ${r.metrics.distinctColourLiterals} colours, ${r.metrics.distinctFontSizes} font sizes, ${r.metrics.distinctSpacingValues} spacing values, ${r.metrics.distinctRadii} radii, ${r.metrics.distinctDurations} durations.`);
  return `${lines.join('\n')}\n`;
}
