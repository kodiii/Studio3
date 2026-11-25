# Maquettekit design principles — the taste code

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - The brief wins: build what it asks for, even a purple gradient.
> - Before markup, plan 4–6 named colours with roles, two or three type roles, a layout device, one bold move, three things to avoid.
> - Use at most two type families and one signal colour unless the brief requires more.
> - Meet contrast floors in both themes: body text 4.5:1; large text, UI boundaries and meaningful graphics 3:1.
> - Give every interactive element rest, hover, focus-visible, active, disabled and, where relevant, loading states.
> - Never invent metrics, testimonials or client logos; label sample content (`Sample data`).
> - Check every view at 320, 390, 768, 1024 and 1440 px, in each theme.
> - Score each view 1–5 on the six rubric axes; fix any 1 or 2.

Read this before you choose a visual direction and again before you call a build finished. It applies to
every specialty. Tokens, palettes and font files come from the Design Intelligence Engine
(`studio-design-system`); this file is about the judgement that tokens cannot encode.

The rule above all others: **the brief wins.** If the user asks for a purple gradient, centred hero or three
feature cards, build that, and build it well. Everything below governs what you do when the choice is yours.

## 1. Establish a direction before you write markup

A direction is a decision you can state in one sentence and that excludes things. "Clean and modern" excludes
nothing. "A parts catalogue for a bike workshop: monospaced labels, hairline rules, one safety-orange signal
colour, photography cut out on paper-white" excludes most of what you would otherwise reach for.

Derive it from the subject, in this order:

1. **Subject vernacular.** What do the objects, documents and places of this domain look like? Shipping labels,
   lab notebooks, mixing desks, ledger paper, exhibition wall text, timetable boards. Borrow structure, not
   decoration.
2. **Audience and job.** Who is looking, for how long, and what must they leave able to do? An operator at
   hour six of a shift needs different contrast, density and motion than a first-time visitor.
3. **One point of boldness.** Pick a single place to be unmistakable: the type scale, the colour, the layout
   device, or one orchestrated motion moment. Everything else supports it quietly.
4. **Constraints.** Existing brand colours, the project's stack, the experience profile
   (`experience-profiles.md`), performance budget (`performance.md`).

Write the direction down as a short plan before building: 4–6 named colours with roles, two or three type
roles, the layout device, the one bold move, and three things you will *not* do. Then review the plan against
the brief and replace every part that would be equally true of any other project.

| Weak plan line | Why it fails | Stronger version |
|---|---|---|
| "Modern sans-serif for a clean look" | True of every site | "Condensed grotesque at 12–14 vw for chapter titles, set tight; humanist sans at 17 px for reading" |
| "Blue primary to convey trust" | Category cliché | "Ink-navy text on warm paper; the only saturated colour is the green used for confirmed transfers" |
| "Cards with subtle shadows" | A kit, not a decision | "No cards: a 12-column ledger with hairline row rules; elevation only for the one floating action" |
| "Smooth animations throughout" | Motion without a job | "One entrance sequence for the headline; everything else responds to input in under 240 ms" |

## 2. Typography

Type carries most of the perceived quality. Spend effort here first.

**Pairing.** Use one family with a wide range of weights/widths, or two families with clearly different jobs
(display vs. text, or text vs. mono for data). Three families needs a reason you can state. Pair by contrast of
structure (serif display + sans text; condensed display + regular-width text), never two near-identical sans.

**Scale.** Choose a ratio and stick to it. Guidance, not law:

| Context | Ratio | Body size | Display ceiling |
|---|---|---|---|
| Dense tools, dashboards | 1.125–1.2 | 13–15 px | 28–36 px |
| Product marketing, docs | 1.25–1.333 | 16–18 px | 56–88 px |
| Editorial, cinematic | 1.414–1.618 | 17–20 px | 96 px to ~18 vw |

Use `clamp()` for fluid display sizes with a rem-based term so user zoom still works:
`font-size: clamp(2.5rem, 1.2rem + 5.5vw, 6rem);`

**Measure and leading.**

- Body measure 45–75 characters (`max-width: 65ch` is a sound default). Never let text run past ~80.
- Line-height falls as size rises: about 1.5–1.65 for body, 1.2–1.3 for subheads, 0.9–1.1 for large display.
  Serif and long-form text want the upper end.
- Tighten tracking on large display type (−0.01 to −0.04 em); open it on small caps and labels
  (+0.04 to +0.1 em). Never track lowercase body text.

**Optical details that separate careful work from default work.**

- `font-variant-numeric: tabular-nums` wherever numbers align or change in place.
- `text-wrap: balance` on headings and `text-wrap: pretty` on paragraphs where supported; both degrade safely.
- Real quotation marks, en dashes in ranges, non-breaking spaces between a number and its unit.
- Hang punctuation and bullets where the grid allows; align text to text, not box to box.
- Weight contrast must be visible: 400 against 600+, not 400 against 500.
- Load only the weights you use; declare a metric-compatible fallback to limit layout shift (see `performance.md`).

## 3. Composition

**Grid.** Start from a real grid (12-column for marketing, 4/8-column for dense tools, a baseline unit of 4 px).
Then break it once, deliberately: an image that bleeds, a headline that spans the gutter, an offset column.

**Asymmetry over centring.** Centred stacks are the easiest layout and read as unconsidered when used for every
section. Default to a left-anchored text column with a contrasting element off-axis. Centre only short,
ceremonial content (a single statement, a closing call to action).

**Whitespace is a material.** Space encodes grouping: related items sit closer than unrelated ones, and the
ratio should be obvious (at least 2:1 between "between groups" and "within group"). Use a spacing scale
(4, 8, 12, 16, 24, 32, 48, 64, 96, 128) and skip steps rather than nudging by 2 px.

**Rhythm.** Vary section density on purpose: a dense section after a sparse one, a full-bleed band after a
contained column. Identical padding, identical structure and identical width for every section produces the
"stack of slides" look.

**Hierarchy test.** Blur the page or squint. You should still be able to name the first, second and third
thing the eye lands on. If two elements compete for first, demote one.

## 4. Colour

- **Restraint.** A neutral ramp, one signal colour, and at most one accent cover almost every interface. Extra
  hues must carry meaning (status, category), not decoration.
- **Work in OKLCH.** Lightness is perceptually even, so ramps and state colours stay consistent:
  `oklch(62% 0.19 255)` → hover `oklch(56% 0.19 255)`. Provide an sRGB fallback only if the project's browser
  support requires it; check the project's targets rather than assuming.
- **Tint the neutrals.** Pure grey looks dead next to a brand hue. Give neutrals 0.005–0.02 chroma in the brand
  hue (or its complement for warmth).
- **Avoid pure black on pure white, and the reverse.** Use near-black ink and off-white paper; on dark themes
  use a tinted near-black surface and off-white text to limit halation.
- **Contrast is a floor, not a style.** Body text ≥ 4.5:1, large text ≥ 3:1, UI boundaries and meaningful
  graphics ≥ 3:1 (details and criteria in `accessibility.md`). Check both themes.
- **Dark mode is a second design**, not an inversion: lower chroma on large fills, lighter and less saturated
  signal colours, elevation by lighter surfaces instead of shadows.

## 5. Detail

- Every interactive element has all of: rest, hover, focus-visible, active, disabled, loading (where relevant).
- Radii follow one logic: nested radius = outer radius − padding. Mixed arbitrary radii look accidental.
- Borders and shadows: choose one primary method of separation per surface. Hairline rules *or* soft elevation.
- Icons share one stroke weight and optical size, and sit on the text baseline grid. An icon without a label
  needs an accessible name and, usually, a visible label too.
- Copy is part of the design. Name things as the user would, keep one verb per action through a whole flow
  ("Publish" never becomes "Post" then "Submit"), and write errors that say what to do next.
- Imagery must be specific. If you have no real photography or product UI, draw a diagram, show real interface
  states, or use type. Never fill the gap with stock-like abstraction.

## 6. Formulaic patterns and what to do instead

These are defaults that appear when nobody chose anything. None is forbidden; each needs a reason.

| Formulaic default | Why it reads as generated | Better alternative |
|---|---|---|
| Purple→blue (or indigo→pink) gradient hero | The single most common unexamined palette | Derive hue from the subject; use flat colour with one tonal step, or a gradient between two close hues in OKLCH |
| Glassmorphism on every surface | Blur costs paint time and erases hierarchy when everything floats | Solid surfaces; reserve translucency for one layer that truly overlaps moving content (e.g. a sticky bar) |
| Everything centred | No reading axis, no tension | Left-anchored column, off-axis media, one centred moment at most |
| Emoji as bullets or icons | Inconsistent rendering, no brand voice, noisy for screen readers | A single icon set, or numbered/typographic markers |
| Three identical feature cards (icon, heading, two lines) | Says the features are interchangeable | Rank them: one large demonstration with real UI, two supporting points as text |
| Eyebrow label + headline + subhead + two buttons, repeated per section | Template skeleton | Let each section's content decide its form: a table, a quote, a diagram, a full-bleed image |
| Rounded-2xl cards with soft shadow on a grey page | Kit default | Rules and alignment for grouping; cards only when items are movable or independently actionable |
| Fade-up on scroll for every block | Motion with no meaning; delays reading | Static content; one orchestrated entrance where it matters |
| Gradient text on headings | Lowers contrast, usually unmotivated | Solid ink; put the colour in one word's background or an underline if emphasis is needed |
| Fake metrics ("10x faster", "99.99 %"), invented testimonials, made-up client logos | Dishonest and, in many jurisdictions, unlawful | Real figures with a source, or omit; clearly labelled placeholders (`Sample data`) while content is pending |
| Filler copy ("Unlock the power of…", "Seamlessly streamline…") | Says nothing about this product | A concrete claim with a noun and a number, or a description of what happens when you press the button |
| Dark page, neon accent, glow on everything | The "tech" costume | Dark only if the use case wants it (media, night use, terminals); one emissive element at most |
| Cream background + serif + terracotta | The "tasteful" costume | Same test: can you justify each from the subject? |
| Decorative 3D blob or particle field behind the hero | Expensive, unrelated to content | A real artefact of the product, or nothing; see each specialty's 3D criteria |
| Identical hover lift (`translateY(-4px)` + shadow) on every card | Uniform, uninformative | Hover reveals something useful (secondary action, preview) or does nothing |

## 7. Self-critique rubric

Score every finished view 1–5 on each axis. This is the same agent-led assessment the Visual Director asks for
after its measured checks; record the scores in your report as **subjective**, never as measurements.

| Axis | 1 | 3 | 5 |
|---|---|---|---|
| Composition | Uniform stacked sections, everything centred | Clear grid, some variation, no deliberate tension | A distinct layout idea; asymmetry and whitespace used on purpose; survives at 390 px and 1440 px |
| Typography | Default font, flat scale, long lines | Consistent scale and measure; details missed | Purposeful pairing, optical details handled, numbers tabular, display type composed not just enlarged |
| Hierarchy | Several elements compete for first place | Primary is clear, secondary levels muddy | Squint test passes: first, second, third are unambiguous on every view |
| Spacing | Arbitrary values, grouping unclear | On a scale, grouping mostly legible | Spacing alone communicates structure; rhythm varies intentionally |
| Originality | Could be any product in any category | One distinctive element inside a familiar shell | Direction is specific to the subject; no row of the table in §6 applies without a stated reason |
| Motion purpose | Decorative, uniform, or blocking | Mostly functional, some gratuitous | Every animation explains a change, gives feedback or directs attention; nothing delays the user |

Gate: any axis at 1 or 2 is a defect to fix before delivery. An average under 3.5 means run another
improve→retest pass (maximum three; see `workflow.md`). Do not round up your own work: if you cannot name the
specific decision that earns a 4, it is a 3.

## 8. Before you hand over

- [ ] The direction can be stated in one sentence that would not fit a competitor.
- [ ] No more than two type families and one signal colour unless the brief requires more.
- [ ] Every view checked at 320, 390, 768, 1024 and 1440 px wide, light and dark where both exist.
- [ ] No fabricated proof; all sample content is labelled.
- [ ] Rubric scores recorded with one sentence of evidence per axis.
