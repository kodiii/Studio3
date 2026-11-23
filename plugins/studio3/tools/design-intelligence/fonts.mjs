// @ts-check
/**
 * Open-licensed type catalogue. Every family is published under the SIL Open Font
 * License 1.1 and distributed by Google Fonts / Fontsource. Package names follow
 * the Fontsource convention (`@fontsource-variable/<id>` for variable builds,
 * `@fontsource/<id>` for static) — verify the exact package at install time.
 * `fallback` is the local stack used while the web font loads; `adjust` describes
 * how to tune a metric-compatible @font-face fallback to limit layout shift.
 */
const OFL = 'SIL Open Font License 1.1';
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF = 'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif';
const MONO = 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, "Liberation Mono", monospace';

const f = (name, kind, pkg, variable, note = '') => ({ name, kind, package: pkg, variable, license: OFL, note });
/** @type {Record<string, { name: string, kind: 'sans' | 'serif' | 'mono' | 'display', package: string, variable: boolean, license: string, note: string }>} */
export const FONTS = {
  archivo: f('Archivo', 'sans', '@fontsource-variable/archivo', true, 'Grotesque with a width axis; tight headlines at high weight.'),
  hankenGrotesk: f('Hanken Grotesk', 'sans', '@fontsource-variable/hanken-grotesk', true, 'Neutral, slightly warm workhorse grotesque.'),
  instrumentSerif: f('Instrument Serif', 'serif', '@fontsource/instrument-serif', false, 'Condensed display serif; one weight plus italic — headlines only.'),
  instrumentSans: f('Instrument Sans', 'sans', '@fontsource-variable/instrument-sans', true, 'Crisp contemporary sans with a width axis.'),
  geist: f('Geist', 'sans', '@fontsource-variable/geist', true, 'Swiss-inspired UI sans tuned for interfaces.'),
  geistMono: f('Geist Mono', 'mono', '@fontsource-variable/geist-mono', true, 'Companion mono to Geist.'),
  jetbrainsMono: f('JetBrains Mono', 'mono', '@fontsource-variable/jetbrains-mono', true, 'Tall x-height code face; disable ligatures for data.'),
  bricolage: f('Bricolage Grotesque', 'display', '@fontsource-variable/bricolage-grotesque', true, 'Expressive grotesque with optical-size and width axes.'),
  schibsted: f('Schibsted Grotesk', 'sans', '@fontsource-variable/schibsted-grotesk', true, 'Editorial news grotesque, sturdy at text sizes.'),
  martianMono: f('Martian Mono', 'mono', '@fontsource-variable/martian-mono', true, 'Wide, assertive monospace with a width axis.'),
  manrope: f('Manrope', 'sans', '@fontsource-variable/manrope', true, 'Rounded-geometric sans, friendly at heavier weights.'),
  dmSans: f('DM Sans', 'sans', '@fontsource-variable/dm-sans', true, 'Low-contrast geometric sans with optical sizing.'),
  dmMono: f('DM Mono', 'mono', '@fontsource/dm-mono', false, 'Soft, typewriter-leaning mono (300/400/500).'),
  syne: f('Syne', 'display', '@fontsource-variable/syne', true, 'Wide, idiosyncratic display sans; use for titles only.'),
  sora: f('Sora', 'sans', '@fontsource-variable/sora', true, 'Geometric sans with generous apertures; reads well on dark.'),
  plexSans: f('IBM Plex Sans', 'sans', '@fontsource/ibm-plex-sans', false, 'Engineered grotesque with a matching serif and mono.'),
  plexSerif: f('IBM Plex Serif', 'serif', '@fontsource/ibm-plex-serif', false, 'Long-form companion to Plex Sans.'),
  plexMono: f('IBM Plex Mono', 'mono', '@fontsource/ibm-plex-mono', false, 'Clear numerals; good for tables and code.'),
  unbounded: f('Unbounded', 'display', '@fontsource-variable/unbounded', true, 'Very wide rounded display; short headlines only.'),
  figtree: f('Figtree', 'sans', '@fontsource-variable/figtree', true, 'Clean, friendly geometric sans.'),
  redHatMono: f('Red Hat Mono', 'mono', '@fontsource-variable/red-hat-mono', true, 'Open, rounded mono.'),
  cormorant: f('Cormorant Garamond', 'serif', '@fontsource/cormorant-garamond', false, 'High-contrast display Garamond; needs size ≥ 24px.'),
  jost: f('Jost', 'sans', '@fontsource-variable/jost', true, 'Futura-inspired geometric sans; elegant in light weights with tracking.'),
  inter: f('Inter', 'sans', '@fontsource-variable/inter', true, 'Dense-UI workhorse; enable tabular numerals (tnum) and cv11.'),
  fraunces: f('Fraunces', 'serif', '@fontsource-variable/fraunces', true, 'Old-style soft serif with SOFT and WONK axes.'),
  newsreader: f('Newsreader', 'serif', '@fontsource-variable/newsreader', true, 'Text serif with optical sizing for long reading.'),
  familjen: f('Familjen Grotesk', 'sans', '@fontsource-variable/familjen-grotesk', true, 'Quirky Scandinavian grotesque with distinctive terminals.'),
  spaceGrotesk: f('Space Grotesk', 'sans', '@fontsource-variable/space-grotesk', true, 'Proportional sibling of Space Mono; techno-retro flavour.'),
  spaceMono: f('Space Mono', 'mono', '@fontsource/space-mono', false, 'Retro-futurist mono (400/700).'),
  publicSans: f('Public Sans', 'sans', '@fontsource-variable/public-sans', true, 'Neutral civic sans derived from Libre Franklin (USWDS).'),
  atkinson: f('Atkinson Hyperlegible', 'sans', '@fontsource/atkinson-hyperlegible', false, 'Designed with the Braille Institute for maximum character distinction.'),
  outfit: f('Outfit', 'sans', '@fontsource-variable/outfit', true, 'Geometric display sans with even colour.'),
  onest: f('Onest', 'sans', '@fontsource-variable/onest', true, 'Compact humanist-geometric sans; steady at small sizes.'),
  literata: f('Literata', 'serif', '@fontsource-variable/literata', true, 'Book serif built for screens.'),
  bigShoulders: f('Big Shoulders Display', 'display', '@fontsource-variable/big-shoulders-display', true, 'Condensed industrial display.'),
};

const stackFor = (kind) => (kind === 'serif' ? SERIF : kind === 'mono' ? MONO : SANS);
const ADJUST = {
  sans: 'Declare a fallback @font-face over local Arial with size-adjust / ascent-override tuned to this family (e.g. generated with Fontaine or Capsize) so swapping does not shift layout.',
  display: 'Display faces differ widely from system fonts: reserve headline height (min-height or line-clamp) and tune a size-adjust fallback over local Arial.',
  serif: 'Declare a fallback @font-face over local Georgia / Times New Roman with size-adjust and ascent-override matched to this family.',
  mono: 'System monospace fallbacks have near-identical advance widths; set size-adjust only if the x-height differs visibly.',
};

/**
 * Resolve a family spec for the design file.
 * @param {string} key catalogue key, or a brand-supplied family name
 * @param {'display' | 'text' | 'mono'} role
 */
export function resolveFont(key, role) {
  const hit = FONTS[key] ?? Object.values(FONTS).find((x) => x.name.toLowerCase() === String(key).toLowerCase());
  if (hit) {
    return {
      family: hit.name,
      stack: `"${hit.name}${hit.variable ? ' Variable' : ''}", "${hit.name}", ${stackFor(role === 'mono' ? 'mono' : hit.kind)}`,
      source: hit.package,
      variable: hit.variable,
      license: hit.license,
      character: hit.note,
      fallbackMetrics: ADJUST[role === 'mono' ? 'mono' : hit.kind],
    };
  }
  const kind = role === 'mono' ? 'mono' : /serif|garamond|times|georgia|didot|bodoni|caslon|baskerville/i.test(key) && !/sans/i.test(key) ? 'serif' : 'sans';
  return {
    family: key,
    stack: `"${key}", ${stackFor(kind)}`,
    source: 'brand-supplied',
    variable: false,
    license: 'Brand-supplied — confirm the web-font licence covers this deployment before shipping.',
    character: 'Existing brand typeface, kept for continuity.',
    fallbackMetrics: ADJUST[kind],
  };
}
