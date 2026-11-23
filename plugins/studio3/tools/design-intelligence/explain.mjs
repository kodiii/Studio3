// @ts-check
/** Markdown rationale for a design document — written to be pasted into a design brief. */
import { applyOverrides } from './generate.mjs';
import { UserError } from '../lib/log.mjs';

export const SECTIONS = ['direction', 'color', 'type', 'layout', 'components', 'motion', '3d', 'performance', 'libraries', 'accessibility', 'specialty'];
const ALIAS = { typography: 'type', colour: 'color', threed: '3d', threeD: '3d', a11y: 'accessibility', spacing: 'layout', shape: 'layout', interaction: 'components', visualdirection: 'direction' };
const ul = (items) => items.map((i) => `- ${i}`).join('\n');

/** @param {any} input @param {{ section?: string }} [opts] */
export function explainDesign(input, opts = {}) {
  const doc = applyOverrides(input);
  const want = opts.section ? (ALIAS[opts.section] ?? ALIAS[opts.section.toLowerCase()] ?? opts.section.toLowerCase()) : null;
  if (want && !SECTIONS.includes(want)) throw new UserError(`Unknown section "${opts.section}". Use one of: ${SECTIONS.join(', ')}.`);
  if (want === '3d' && !doc.threeD) throw new UserError('This design has no 3D section (brief.requires3d is false).');
  const b = doc.brief;
  const sel = doc.meta.selection;
  const mode = doc.color.defaultMode;
  const c = doc.color[mode];
  const t = doc.typography;
  /** @type {Record<string, () => string>} */
  const parts = {
    direction: () => {
      const rows = Object.entries(sel.chosen.breakdown).map(([k, v]) => `| ${k} | ${v.value} | ${v.weight} | ${v.contribution} |`).join('\n');
      return [
        `## Visual direction — ${doc.visualDirection.name}`,
        `> ${doc.visualDirection.thesis}`,
        `**Why this direction.** Scored ${sel.chosen.score} for “${b.productCategory}” / “${b.audience}” / “${b.preferredAesthetic || 'no stated aesthetic'}” (${sel.forced ? 'forced by the caller' : 'highest of ' + sel.ranking.length}). Runner-up: \`${sel.runnerUp.id}\` at ${sel.runnerUp.score}.`,
        `| Component | Value (0–1) | Weight | Contribution |\n|---|---|---|---|\n${rows}`,
        sel.chosen.matched.aesthetic.length || sel.chosen.matched.personality.length ? `Matched words: ${[...sel.chosen.matched.aesthetic, ...sel.chosen.matched.personality, ...sel.chosen.matched.audience].join(', ')}.` : '',
        sel.chosen.notes.length ? `Constraint notes: ${sel.chosen.notes.join('; ')}.` : '',
        `**Principles**\n${ul(doc.visualDirection.principles)}`,
        `**Compositional devices**\n${ul(doc.visualDirection.compositionalDevices)}`,
        `**Avoid**\n${ul(doc.visualDirection.avoid)}`,
        doc.meta.assumptions.length ? `**Assumptions made (brief gaps)**\n${ul(doc.meta.assumptions)}` : '',
      ].filter(Boolean).join('\n\n');
    },
    color: () => {
      const roles = ['bg', 'surface', 'text', 'textMuted', 'primary', 'onPrimary', 'primaryText', 'accent', 'focusRing', 'border'];
      const row = (r) => `| ${r} | \`${doc.color.light.roles[r].hex}\` | \`${doc.color.dark.roles[r].hex}\` |`;
      const worst = (m) => doc.color[m].contrast.filter((p) => p.kind === 'text').reduce((a, p) => (p.ratio < a.ratio ? p : a));
      return [
        '## Colour',
        `${doc.color.strategy} Authored in OKLCH, gamut-mapped to sRGB. Default mode: **${mode}**.`,
        `**Brand hue ${doc.color.brand.hue}°, chroma ${doc.color.brand.chroma}.** ${doc.color.brand.derivation} Accent: ${doc.color.brand.accentDerivation} Neutrals are tinted toward the brand hue.`,
        `| Role | Light | Dark |\n|---|---|---|\n${roles.map(row).join('\n')}`,
        `**Contrast (${doc.color.contrastPolicy.standard})** — ${doc.color.light.contrast.length + doc.color.dark.contrast.length} pairs checked, ${[...doc.color.light.contrast, ...doc.color.dark.contrast].filter((p) => !p.pass).length} failing. Tightest text pair: light ${worst('light').fg} on ${worst('light').bg} = ${worst('light').ratio}:1; dark ${worst('dark').fg} on ${worst('dark').bg} = ${worst('dark').ratio}:1.`,
        doc.color.adjustments.length ? `**Adjusted for contrast (${doc.color.adjustments.length})**\n${ul(doc.color.adjustments.map((a) => `${a.mode} \`${a.role}\`: ${a.from} → ${a.to} (${a.reason})`))}` : 'No lightness adjustments were needed to meet contrast.',
        c.dataViz ? `**Data visualisation** — 8 categorical colours ordered for adjacent distinguishability (min ΔE ${c.dataViz.check.minAdjacentDeltaE}; protan ${c.dataViz.check.minAdjacentDeltaEProtan}, deutan ${c.dataViz.check.minAdjacentDeltaEDeutan}; threshold ${c.dataViz.check.threshold}): ${c.dataViz.categorical.map((x) => `\`${x.hex}\``).join(' ')}` : '',
      ].filter(Boolean).join('\n\n');
    },
    type: () => [
      '## Typography',
      `| Role | Family | Source | Licence |\n|---|---|---|---|\n${Object.entries(t.families).map(([k, f]) => `| ${k} | ${f.family} | \`${f.source}\` | ${f.license} |`).join('\n')}`,
      ul(Object.entries(t.families).map(([k, f]) => `**${f.family}** (${k}) — ${f.character}`)),
      `**Scale** — modular ratio ${t.scale.ratio.min} (at ${t.scale.viewportPx.min}px) → ${t.scale.ratio.max} (at ${t.scale.viewportPx.max}px), base ${t.scale.basePx.min}–${t.scale.basePx.max}px, fluid via \`clamp()\`.`,
      `| Step | Min | Max | Line height | Use |\n|---|---|---|---|---|\n${Object.entries(t.scale.steps).map(([k, s]) => `| ${k} | ${s.minPx}px | ${s.maxPx}px | ${s.lineHeight} | ${s.use} |`).join('\n')}`,
      `Weights: text ${t.weights.regular}, display ${t.weights.display}. Display tracking ${t.tracking.display}. Labels: ${t.labels}.`,
      `**Rules**\n${ul([...t.rules, ...t.notes])}`,
    ].join('\n\n'),
    layout: () => [
      '## Layout, spacing and shape',
      `Grid: ${Object.entries(doc.layout.grid.columns).map(([k, v]) => `${v} columns (${k})`).join(' → ')}; breakpoints ${Object.entries(doc.layout.breakpoints).map(([k, v]) => `${k} ${v}px`).join(', ')}; content width ${doc.layout.containers.content}px, prose ${doc.layout.containers.prose}.`,
      `Spacing: ${doc.spacing.base}px base, **${doc.spacing.density.mode}** density (controls ${Object.values(doc.spacing.density.controlHeight).join('/')}px). ${doc.spacing.density.note}`,
      `Radius: **${doc.radius.personality}** (${Object.entries(doc.radius.scale).filter(([k]) => k !== 'full').map(([k, v]) => `${k} ${v}px`).join(', ')}). ${doc.radius.rule}`,
      `Elevation: **${doc.elevation.style}** — ${doc.elevation.description}`,
      `**Principles**\n${ul(doc.layout.principles)}`,
    ].join('\n\n'),
    components: () => [
      '## Components and interaction',
      doc.components.language,
      ul([`**Buttons** — ${doc.components.buttons.style}`, `**Inputs** — ${doc.components.inputs.style}`, `**Cards** — ${doc.components.cards.style}`, `**Navigation** — ${doc.components.navigation.style}`]),
      `States every interactive component must design: ${doc.components.states.join(', ')}. ${doc.components.targetSize.rule}`,
      `**Interaction principles**\n${ul(doc.interaction.principles)}`,
      `Latency targets: press feedback ≤ ${doc.interaction.feedbackLatency.pressFeedbackMs}ms, simple transition ≈ ${doc.interaction.feedbackLatency.simpleTransitionMs}ms, progress indicator after ${doc.interaction.feedbackLatency.showProgressAfterMs}ms (${doc.interaction.feedbackLatency.note})`,
    ].join('\n\n'),
    motion: () => [
      `## Motion — ${doc.motion.profile} profile`,
      `${doc.motion.profileNote} Temperament: ${doc.motion.temperament}`,
      `Durations (ms): ${Object.entries(doc.motion.durations).map(([k, v]) => `${k} ${v}`).join(' · ')}. Signature easing \`${doc.motion.easings.signature.css}\`; default spring **${doc.motion.springs.default}** (stiffness ${doc.motion.springs[doc.motion.springs.default].stiffness}, damping ${doc.motion.springs[doc.motion.springs.default].damping}). Stagger ${doc.motion.stagger.eachMs}ms, max ${doc.motion.stagger.maxTotalMs}ms total.`,
      `**Choreography**\n${ul(Object.entries(doc.motion.choreography).map(([k, v]) => `**${k}** — ${v}`))}`,
      `**Reduced motion** — ${doc.motion.reducedMotion.policy}\n${ul(Object.entries(doc.motion.reducedMotion.tiers).map(([k, v]) => `**${k}** — ${v}`))}`,
      `| Preset | Purpose | Duration | Easing | Reduced-motion tier |\n|---|---|---|---|---|\n${doc.motion.presets.map((p) => `| ${p.name} | ${p.purpose} | ${p.duration.replace(/[{}]/g, '').split('.').pop()} | ${p.easing.replace(/[{}]/g, '').split('.').pop()} | ${p.reducedMotionTier} |`).join('\n')}`,
      `Device scaling: ${Object.entries(doc.motion.intensityScaling).map(([k, v]) => `${k} ×${v.scale}`).join(', ')}.`,
    ].join('\n\n'),
    '3d': () => {
      const d = doc.threeD;
      return [
        '## 3D',
        `Purpose: ${d.purpose}. ${d.artDirection}`,
        `**Technology: ${d.technology.recommendation}**${d.technology.packages.length ? ` (\`${d.technology.packages.join('`, `')}\`)` : ''} — ${d.technology.reasoning}`,
        ul(d.technology.considered.map((o) => `${o.option}: *${o.verdict}* — ${o.reasoning}`)),
        `WebGPU: ${d.technology.webgpu}`,
        `**Lighting** — key: ${d.lighting.key}; fill: ${d.lighting.fill}; rim: ${d.lighting.rim}; environment: ${d.lighting.environment}.`,
        `**Materials**\n${ul(d.materials.principles)}`,
        `**Camera** — ${d.camera.fovDeg}° FOV; ${d.camera.framing}; ${d.camera.movement}.`,
        `**Quality profiles** (${d.qualityProfiles.note})\n\n| Tier | DPR max | Shadows | Post-processing | Texture max |\n|---|---|---|---|---|\n${['desktop', 'mobile', 'lowPower'].map((k) => `| ${k} | ${d.qualityProfiles[k].dprMax} | ${d.qualityProfiles[k].shadows} | ${d.qualityProfiles[k].postprocessing} | ${d.qualityProfiles[k].textureMaxPx}px |`).join('\n')}`,
        `**Fallback**\n${ul([...d.fallback.strategy, ...d.fallback.accessibility])}`,
      ].join('\n\n');
    },
    performance: () => {
      const p = doc.performance;
      return ['## Performance', `_${p.note}_`, `Budget “${p.budget}”: LCP ≤ ${p.coreWebVitals.lcpMs}ms, INP ≤ ${p.coreWebVitals.inpMs}ms, CLS ≤ ${p.coreWebVitals.cls}; initial route ≤ ${p.initialRouteKbCompressed.total}kB compressed (JS ${p.initialRouteKbCompressed.javascript}, CSS ${p.initialRouteKbCompressed.css}, fonts ${p.initialRouteKbCompressed.fonts}); TBT ≤ ${p.runtime.totalBlockingTimeMs}ms.`, ul(p.practices)].join('\n\n');
    },
    libraries: () => ['## Libraries', doc.libraries.principle, `**Recommended**\n${ul(doc.libraries.recommended.map((r) => `**${r.name}**${r.status ? ` (${r.status})` : ''} — ${r.role}. ${r.why}`))}`, `**Avoid**\n${ul(doc.libraries.avoid.map((r) => `**${r.name}** — ${r.why}`))}`].join('\n\n'),
    accessibility: () => ['## Accessibility', ul(doc.accessibility.requirements), `**Checklist**\n${doc.accessibility.checklist.map((x) => `- [ ] ${x.check}${x.automated ? ' _(automatable)_' : ''}`).join('\n')}`].join('\n\n'),
    specialty: () => [`## Specialty — ${doc.specialtyNotes.specialty}`, ul(doc.specialtyNotes.notes)].join('\n\n'),
  };
  const order = want ? [want] : SECTIONS.filter((s) => s !== '3d' || doc.threeD);
  const head = want ? '' : `# ${b.brand.name} — design rationale\n\n_${doc.visualDirection.name} · ${doc.motion.profile} motion · WCAG ${b.accessibility.level} · brief \`${doc.meta.briefHash}\`${doc.meta.overridesApplied.length ? ` · ${doc.meta.overridesApplied.length} override(s) applied` : ''}_\n\n`;
  return `${head}${order.map((s) => parts[s]()).join('\n\n')}\n`;
}
