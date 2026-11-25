#!/usr/bin/env node
// @ts-check
/**
 * Claude Code UserPromptSubmit hook. When a prompt looks like front-end design work, it adds one line of
 * context naming the Maquettekit skill to load. Smaller models often answer UI requests directly and never
 * open a skill (measured in evals/README.md), so the rules and tools in the skill are never used.
 *
 * - Never blocks or rewrites a prompt; on any error it exits 0 silently.
 * - Suggests each skill at most once per session (state: one small JSON file per session id in
 *   $CLAUDE_PLUGIN_DATA, else the OS temp dir). The prompt itself is never stored or printed.
 * - Off with MAQUETTEKIT_ROUTING_HINTS=0.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** A topic word rather than a concrete UI surface: counts half as much as a normal pattern. @param {RegExp} re */
const weak = (re) => ({ re, w: 1 });

/**
 * Ordered by specificity: Maquettekit-specific and narrow areas first, broad UI last. A plain RegExp names a
 * concrete surface or technique and weighs 2; weak() marks a topic word that also appears in non-UI requests.
 */
export const ROUTES = [
  { skill: 'studio-setup', area: 'Maquettekit setup', patterns: [/\bmaquettekit\b.{0,40}\b(doctor|setup|install|uninstall|upgrade|not working|missing|error)/i, /\bplaywright\b.{0,40}\b(missing|not installed|won'?t launch|cannot launch)/i] },
  { skill: 'studio-components', area: 'Maquettekit component library', patterns: [/\bmaquettekit\b.{0,60}\b(effects?|components?|recipes?|catalog(?:ue)?|library)\b/i, /\b(do|does) (you|it|maquettekit) have an? .{0,40}\b(effect|component|recipe)\b/i] },
  { skill: 'studio-asset-optimizer', area: '3D asset optimisation', patterns: [/\b(compress|optimi[sz]e|shrink|reduce|slim)\b.{0,60}\b(glb|gltf|3d models?|meshes|textures?)\b/i, /\b(glb|gltf)\b.{0,60}\b(too (big|large|heavy)|slow|mb)\b/i, /\b(draco|meshopt|ktx2|gltf-transform)\b/i] },
  { skill: 'studio-3d', area: 'real-time 3D', patterns: [/\b3d\b/i, /\bthree\.?js\b/i, /\br3f\b|react[- ]three[- ]fiber/i, /\bweb(gl|gpu)\b/i, /\b(glb|gltf)\b/i, /\bshaders?\b/i, weak(/\bparticles?\b/i), /\bmodel viewer\b|\bexploded view\b|\bhotspots?\b/i] },
  { skill: 'studio-data', area: 'data visualisation', patterns: [/\bdashboards?\b/i, /\bcharts?\b/i, weak(/\bgraphs?\b/i), /\bkpis?\b/i, weak(/\banalytics\b/i), /\bdata tables?\b/i, /\bvisuali[sz](e|ation)\b/i, /\b(sparklines?|heatmaps?|candlesticks?|time series)\b/i] },
  { skill: 'studio-cinematic', area: 'cinematic, scroll-driven storytelling', patterns: [/\bscrollytelling\b/i, /\bscroll[- ]driven\b/i, weak(/\bstorytelling\b/i), /\blaunch (page|film|site)\b/i, /\bkinetic (type|typography)\b/i, weak(/\bimmersive\b/i), /\bparallax\b/i, /\bcinematic\b/i, /\bpinned sections?\b/i] },
  { skill: 'studio-social', area: 'social and participation UI', patterns: [weak(/\b(news ?)?feeds?\b/i), /\b(emoji )?reactions?\b/i, /\bpolls?\b/i, /\bstories (row|bar|tray)\b|\binstagram[- ]style stories\b/i, /\bcomments? (thread|section)\b/i, /\bcreator tools?\b/i] },
  { skill: 'studio-motion', area: 'animation and interaction feedback', patterns: [/\banimat(e|ed|es|ing|ion|ions)\b/i, weak(/\btransitions?\b/i), /\bstagger(ed)?\b/i, /\beasing\b/i, /\bmicro[- ]?interactions?\b/i, /\bhover (effects?|states?|animation)\b/i, /\bpress (feedback|state|effect)\b/i, weak(/\bentrance\b/i), /\bspring (animation|physics)\b/i, /\breduced motion\b/i, /\b(framer motion|gsap)\b/i] },
  { skill: 'studio-design-system', area: 'design system and tokens', patterns: [/\bdesign system\b/i, /\bdesign tokens?\b/i, /\b(colou?r|spacing|motion) tokens\b/i, /\bcolou?r palette\b/i, /\btype scale\b/i, /\btypography (scale|system)\b/i] },
  { skill: 'studio-experience', area: 'interaction quality', patterns: [/\binteraction quality\b/i, /\bfeels? (too much|janky|sluggish|cluttered|busy)\b/i, /\btoo much (animation|motion)\b/i, /\bexperience (audit|assessment)\b/i] },
  { skill: 'studio-match', area: 'matching a reference image or mockup', patterns: [/\b(make|build) (it|this|the page|the component)? ?(look )?like (this|the) ?(mockup|design|screenshot|figma|image)?\b/i, /\b(mock-?ups?|figma|sketch file|penpot|design export|pixel[- ]perfect)\b/i, /\bmatch(es|ing)? (the|this|our) (design|mockup|screenshot|figma)\b/i, /\b(doesn'?t|does not) (look like|match) the (design|mockup)\b/i] },
  { skill: 'studio-launch', area: 'launch readiness (metadata, share images, icons, crawlers)', patterns: [/\b(ready to (launch|ship|go live)|before (we|i) (launch|ship|go live|deploy)|go[- ]live|pre[- ]?launch|launch (checklist|readiness))\b/i, /\b(seo|open ?graph|og[:\s-]?image|social (share|preview) (image|card)|link previews?|twitter cards?|favicons?|apple[- ]touch[- ]icons?|robots\.txt|sitemaps?|meta (tags?|descriptions?))\b/i, /\b404 page\b/i] },
  { skill: 'studio-review', area: 'browser review of a page', patterns: [/\breview (this|the|my|our)? ?(page|site|ui|layout|website|screen)\b/i, /\bcheck https?:\/\/\S+/i, /\blocalhost:\d+/i, /\bvisual regression\b/i, /\b(accessibility|a11y) (audit|check|review)\b/i] },
  { skill: 'studio-product', area: 'product UI', patterns: [/\blanding page\b/i, /\bpricing\b/i, /\bsign[- ]?up (flow|form|page)\b|\bsignup\b/i, /\bonboarding\b/i, /\bcheckout\b/i, /\b(web|html|sign[- ]?in|login|contact|registration|checkout) forms?\b|\bform (validation|fields?)\b/i, /\bsettings (page|screen|panel)\b/i, /\bapp shell\b|\bnavbar\b|\bnavigation (menu|bar)\b/i, /\bempty states?\b/i, /\bproduct page\b/i, /\bmarketing (site|page)\b/i, /\bhero section\b/i, weak(/\bredesign\b/i), weak(/\b(look|feel)s? (good|better|nicer|modern|polished)\b/i), weak(/\b(ui|ux)\b/i)] },
];

/**
 * Up to two skills that match the prompt, best first. Specific areas beat broad ones on ties.
 * @param {string} prompt
 * @returns {{ skill: string, area: string, score: number }[]}
 */
export function suggest(prompt) {
  const text = String(prompt || '').slice(0, 4000);
  const hits = [];
  ROUTES.forEach((r, order) => {
    const score = r.patterns.reduce((n, p) => { const { re, w } = p instanceof RegExp ? { re: p, w: 2 } : p; return n + (re.test(text) ? w : 0); }, 0);
    if (score >= 2) hits.push({ skill: r.skill, area: r.area, score, order }); // one concrete match, or two topic words
  });
  hits.sort((a, b) => b.score - a.score || a.order - b.order);
  // a second area is named only when it has a concrete match of its own, not a passing topic word
  const picks = hits.slice(0, 2).filter((h, i) => i === 0 || h.score >= 2);
  return picks.map(({ skill, area, score }) => ({ skill, area, score }));
}

/** @param {{ skill: string, area: string }[]} picks @param {string} prefix */
export function hintText(picks, prefix = 'maquettekit:') {
  const [a, b] = picks;
  const also = b ? ` If the request also involves ${b.area}, load \`${prefix}${b.skill}\` as well.` : '';
  return `Maquettekit routing hint: this request looks like ${a.area} work. Before planning, advising or writing code, load the \`${prefix}${a.skill}\` skill with the Skill tool; it carries the rules, recipes and verification tools for this kind of work.${also} Ignore this hint if the request is not front-end or design work.`;
}

function stateFile(sessionId) {
  const dir = path.join(process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'maquettekit'), 'route-hints');
  return path.join(dir, `${String(sessionId).replace(/[^\w.-]/g, '_').slice(0, 120)}.json`);
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  if (/^(0|false|off|no)$/i.test(process.env.MAQUETTEKIT_ROUTING_HINTS ?? '')) return;
  let input;
  try { input = JSON.parse(await readStdin()); } catch { return; }
  let picks = suggest(input?.prompt ?? '');
  if (!picks.length) return;
  let seen = [];
  const file = input?.session_id ? stateFile(input.session_id) : null;
  if (file) { try { seen = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { seen = []; } }
  picks = picks.filter((p) => !seen.includes(p.skill));
  if (!picks.length) return;
  if (file) {
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify([...seen, ...picks.map((p) => p.skill)])); } catch { /* hints still work without state */ }
  }
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: hintText(picks) } }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {}).finally(() => process.exit(0));
}
