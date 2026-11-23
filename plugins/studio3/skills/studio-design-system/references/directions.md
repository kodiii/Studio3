# Art directions

The engine ships 14 directions. Each defines a thesis, type pairing (open-licensed families), hue strategy, chroma
range, radius/elevation personality, density, motion temperament, 3D art direction and suitability scores. Selection
is a transparent weighted score — category 0.22, aesthetic 0.26, personality 0.12, audience 0.08, specialty 0.10,
motion 0.08, complexity 0.06, constraints 0.08 — recorded with the runner-up in `meta.selection`. Run
`studio3 design directions` for the authoritative list; this table was generated from it.

| id | thesis | type (display / text / mono) | shape (radius, elevation, density) | default mode | strongest for |
| - | - | - | - | - | - |
| `editorial-swiss` | A strict typographic grid where scale contrast and one signal colour do all the work that decoration usually does. | Archivo / Hanken Grotesk / IBM Plex Mono | sharp, flat, comfortable | light | editorial, agency, portfolio, saas |
| `warm-minimal` | Minimalism with body heat: paper-toned surfaces, a serif voice for ideas and a quiet sans for work. | Instrument Serif / Instrument Sans / Geist Mono | soft, soft, spacious | light | food, healthcare, luxury, ecommerce |
| `technical-mono` | An instrument panel for people who read documentation: neutral, exact, and structured by borders and monospace detail. | Geist / Geist / JetBrains Mono | subtle, flat, compact | dark | devtool, ai, dashboard, saas |
| `kinetic-brutalist` | Raw structure at full volume: hard edges, oversized type and motion that hits like a rubber stamp. | Bricolage Grotesque / Schibsted Grotesk / Martian Mono | sharp, hard, comfortable | light | agency, portfolio, entertainment, gaming |
| `soft-tactile` | Interfaces that feel pressable: rounded forms, layered diffuse light and colour that is gentle but never washed out. | Manrope / DM Sans / DM Mono | round, soft, comfortable | light | healthcare, education, social, ecommerce |
| `dark-cinema` | A screening room: deep, slightly tinted blacks, light used like a cinematographer and pacing that lets a frame land. | Syne / Sora / Martian Mono | subtle, glow, spacious | dark | entertainment, gaming, agency, portfolio |
| `scientific-precision` | The clarity of a well-set journal figure: measured, annotated and calm, so the numbers are the loudest thing on the page. | IBM Plex Sans / IBM Plex Sans / IBM Plex Mono | subtle, flat, compact | light | ai, dashboard, fintech, healthcare |
| `playful-geometric` | A box of well-made shapes: circles, squares and arcs in confident colour, arranged with a sense of humour. | Unbounded / Figtree / Red Hat Mono | pill, hard, comfortable | light | education, social, gaming, food |
| `luxury-quiet` | Wealth whispers: a high-contrast serif, wide-tracked small caps, vast margins and almost no colour. | Cormorant Garamond / Jost / IBM Plex Mono | sharp, flat, spacious | light | luxury, portfolio, ecommerce, agency |
| `terminal-dense` | Maximum signal per pixel: a keyboard-first console where monospace alignment and a single phosphor accent organise everything. | JetBrains Mono / Inter / JetBrains Mono | sharp, flat, compact | dark | devtool, dashboard, ai, fintech |
| `organic-analog` | The feel of print and material: soft serifs, earthy pigments, paper grain and shapes that look cut by hand. | Fraunces / Newsreader / DM Mono | soft, soft, spacious | light | food, editorial, ecommerce, healthcare |
| `neo-retro-signal` | Broadcast graphics and instrument labels from 1978 rebuilt for the web: quirky grotesques, signal colours and rounded-rectangle hardware. | Familjen Grotesk / Space Grotesk / Space Mono | soft, hard, comfortable | light | entertainment, portfolio, agency, hardware |
| `civic-clear` | Design as a public service: plain language, unmistakable controls and legibility for everyone, on any device. | Public Sans / Atkinson Hyperlegible / IBM Plex Mono | subtle, flat, comfortable | light | government, healthcare, education, fintech |
| `spatial-showroom` | The page is a gallery wall around a real-time object: bright, airy, and engineered so the 3D subject is the hero and the interface its caption. | Outfit / Onest / Geist Mono | soft, soft, comfortable | light | hardware, ecommerce, luxury, agency |

## Choosing well

- Lead with the audience's task, not your taste: dense tools want `technical-mono`, `terminal-dense` or
  `scientific-precision`; persuasion pages want `editorial-swiss`, `warm-minimal` or `luxury-quiet`;
  narrative work wants `dark-cinema`, `kinetic-brutalist` or `spatial-showroom`; public services want `civic-clear`.
- When the top two scores are within a few hundredths, present both with one line each and let the user choose.
- A direction is a starting point. Adjust through `overrides` and keep the direction's `avoid` list.
- Never stack two directions in one product; if a campaign needs a different voice, create a separate design file
  for that surface.

## Distinctiveness checks

Before handing over, compare the result with the anti-pattern list in
`${CLAUDE_PLUGIN_ROOT}/shared/design-principles.md`. A system is generic when its colour is the default
framework blue or a purple-blue gradient, its type is a single neutral sans at default tracking, and every surface is a
rounded card with a soft shadow. Each direction counters that with one dominant idea — hold on to it.
