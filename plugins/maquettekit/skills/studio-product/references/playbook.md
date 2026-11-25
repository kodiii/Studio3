# Product Studio playbook

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - Show the hero product view as DOM or vector in a filled state, with a text alternative.
> - Implement every applicable states-matrix row; loading buttons keep width, stay focusable, set `aria-busy` and prevent double submission.
> - Never make hover the only way to discover an action.
> - State the price and billing period next to the button, leave marketing consent unticked, and never fake counters, reviews or scarcity.
> - Always provide a skip link, a visible current location, a working back button and focus moved to the new view's heading.
> - Use one-column forms with labels above; validate when a field is finished; never lose the user's work.
> - Never stretch forms or text to full width or set captions below 12 px.
> - Use one primary action style, once per view.

How to design a product surface that is specific to its brand and effortless to use. General taste rules are
in the shared `design-principles.md`; this file covers what is particular to product work.

## 1. Brand-specific art direction

A product's look should be derivable from what it does. Work through this table before choosing anything.

| Question | Example answer | Design consequence |
|---|---|---|
| What is the product's raw material? | Invoices | Tabular figures, ledger rules, a paper-like surface, stamps for status |
| What does success look like to the user? | "Everything reconciled" | A calm, complete state is the hero image; green is reserved for it |
| What is the competitor default? | Blue SaaS with floating cards | Avoid blue and cards; choose ink + one warm signal |
| What is the brand's temperament? | Exacting, slightly dry | Tight grid, small radii, no bounce in motion, plain verbs |
| Where is the one bold move? | Type | Oversized numerals as section anchors |

Feed the answers into the Design Intelligence Engine brief. If a generated direction (for example
`warm-minimal`, `technical-mono`, `editorial-swiss`, `soft-tactile`; list them with `maquettekit design directions`)
fits, use it as the base and adjust; do not accept it unexamined.

**Show the product.** The strongest art direction for product work is the product itself, rendered honestly:

- Build the hero UI as real DOM (a trimmed, static version of the actual interface), not a screenshot in a
  browser frame. It scales, themes, animates and stays sharp.
- Show a meaningful state: data filled in, mid-task, with the outcome visible. Never an empty shell.
- Crop boldly. One focused region at large scale beats a whole dashboard at thumbnail size.
- If the product is not visual (an API, infrastructure), show its artefacts: a request and response, a log line
  before and after, a diff, a diagram of the flow.

## 2. Information architecture

### Pages
Write the outline first. Each section gets one job and one sentence. If you cannot say what a section is for,
delete it.

| Job | Question it answers | Typical form |
|---|---|---|
| Orient | What is this, for whom? | Headline + product view |
| Demonstrate | How does it work? | One annotated walkthrough, interactive if cheap |
| Differentiate | Why this over the alternative? | Comparison, a before/after, a constraint you remove |
| Prove | Does it work for people like me? | Real evidence with attribution (rules in `patterns-conversion.md`) |
| De-risk | What will it cost, how hard is it to leave? | Pricing, guarantees, security facts, FAQ |
| Act | What do I do now? | One primary action, repeated at natural stopping points |

Order by the visitor's questions, not by the organisation chart. Most pages need five to seven sections.

### Applications
- **Objects before screens.** List the nouns users manage (projects, invoices, members). Navigation is the list
  of nouns; verbs live on the objects.
- **Depth ≤ 3.** Global area → collection → item. Deeper structures need breadcrumbs and search.
- **One home per thing.** If a setting can be reached from two places, one is a link to the other.
- **Name by user vocabulary.** If support tickets call it "seats", the UI does not call it "licence units".

## 3. Layout systems

| Surface | Grid | Content width | Notes |
|---|---|---|---|
| Marketing page | 12 columns, 24–32 px gutters | Text 60–70ch; media may bleed | Vary section structure; see rhythm in the shared principles |
| App shell | Fixed nav (56–72 px collapsed, 220–280 px expanded) + fluid content | Content max 1200–1440 px, forms 480–640 px | Never stretch forms or text to full width |
| Settings | Two columns from ~900 px: section nav + single column of groups | 640–720 px | Group label left, controls right only if labels are short |
| Detail page | Main (2/3) + meta rail (1/3) | Rail collapses under main on narrow screens | Rail holds status, owner, dates, actions |
| Mobile | 4 columns, 16–20 px margins | Full width | Primary action in the thumb zone; avoid top-right-only actions |

Use container queries for components that live in several widths (cards, tables, side panels), viewport media
queries only for page-level shell changes.

**Breakpoints are where the content breaks**, not device names. Resize slowly and add a rule where a line gets
too long, a row wraps badly or a target gets too small.

## 4. Type and spacing for product UI

| Role | Size / line-height | Weight | Use |
|---|---|---|---|
| Display | clamp(2.5rem, 1.2rem + 5.5vw, 5.5rem) / 1.0–1.05 | 500–700 | One per marketing page |
| Title | 1.5–2rem / 1.2 | 600 | Page and section titles |
| Heading | 1.125–1.25rem / 1.3 | 600 | Card and group headings |
| Body | 1rem (0.9375rem in dense apps) / 1.5 | 400 | Default text |
| Label | 0.8125–0.875rem / 1.3 | 500 | Form labels, table headers, buttons |
| Caption | 0.75rem / 1.35 | 400–500 | Help text, meta; never below 12 px |
| Mono | 0.875em relative | 400 | Code, ids, keys, tabular data |

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Rules of thumb:

- Inside a control: 8–12 px vertical, 12–16 px horizontal. Control height 36–40 px desktop, 44–48 px touch.
- Label to field: 6–8 px. Field to help/error: 4–6 px. Field to next field: 16–24 px. Group to group: 32–48 px.
- Section padding on marketing pages: 96–160 px desktop, 56–80 px mobile, and deliberately not identical for
  every section.
- Inside-to-outside ratio: padding within a group is smaller than the gap between groups, by at least 2:1.

## 5. Component states matrix

Build the whole row. Missing states are the most common reason product UI feels unfinished.

| Component | Rest | Hover | Focus-visible | Active/pressed | Disabled | Loading | Success | Error |
|---|---|---|---|---|---|---|---|---|
| Button | yes | tone shift | ring | depth/scale ≤ 2 % | reduced contrast, `disabled` or `aria-disabled` | spinner or label change, width locked | optional morph (`morph-submit-button`) | returns to rest + message nearby |
| Text field | yes | border tone | ring + border | n/a | yes | n/a (async validation: inline indicator) | optional check | border + icon + text message |
| Select / combobox | yes | yes | ring | open | yes | options loading row | n/a | as text field |
| Checkbox / radio / switch | yes | yes | ring | pressed | yes | switch may show pending | n/a | group-level message |
| Link | yes | underline change | ring | yes | n/a | n/a | visited where useful | n/a |
| Card (interactive) | yes | reveal of secondary action | ring on the single primary link | yes | n/a | skeleton | n/a | inline retry |
| Tabs | yes | yes | ring; arrows move | selected indicator animates | yes | panel skeleton | n/a | panel error |
| Menu / popover | closed | n/a | focus moves in | item active | item disabled | n/a | n/a | n/a |
| Dialog | closed | n/a | focus trapped, returns on close | n/a | n/a | body loading | closes or confirms | inline, never a second dialog |
| Toast | hidden | pauses timer | focusable action | n/a | n/a | n/a | yes | persistent until dismissed |
| Table row | yes | highlight | ring on row or first cell | selected | n/a | skeleton rows | n/a | row-level message |

Rules:

- Loading buttons keep their width and stay focusable; set `aria-busy` and prevent double submission in code.
- Disabled is a last resort. Prefer leaving a submit button enabled and explaining what is missing on press;
  a disabled button cannot tell the user why.
- Hover must never be the only way to discover an action (touch and keyboard users have no hover).
- Selected, current and focused are three different states with three different treatments.

## 6. Conversion without dark patterns

Persuasion is helping someone decide correctly. Manipulation is making them decide against their interest.

| Do | Do not |
|---|---|
| State the price, billing period and what happens after a trial, next to the button | Reveal fees at the last step; hide the monthly price behind "from" |
| Offer a free tier or trial with honest limits | Require a card "for verification" without saying when it is charged |
| Make declining neutral: "No thanks" | Confirm-shame: "No, I don't want to save money" |
| Leave marketing consent unticked | Pre-tick consent, bundle it with terms |
| Show real stock or real deadlines if they exist | Countdown timers that reset; "3 people are viewing this" |
| Let people cancel where they signed up, in as few steps | Cancellation by phone only; a maze of retention offers |
| Default to the plan most users need | Default to the most expensive option; disguise the cheaper one |
| Ask for information when it is needed, and say why | Collect everything up front "to personalise" |

If the user asks for one of the right-hand patterns, say plainly why you advise against it (trust, and in many
jurisdictions consumer-protection law), offer the honest equivalent, and follow their decision only for
patterns that are not deceptive. Do not build fake counters, fake reviews or fake scarcity.

## 7. Navigation patterns

| Situation | Pattern | Notes |
|---|---|---|
| Marketing site, ≤ 6 destinations | Horizontal bar; primary action at the end | Sticky only if it stays short (≤ 64 px) and does not obscure focus (WCAG 2.4.11) |
| Marketing site, many destinations | Grouped disclosure menus opened by click | Not hover-only; `Esc` closes; arrow keys within |
| App, 4–8 top-level objects | Left rail with icons + labels | Collapsible, but labels available; current item marked with `aria-current="page"` |
| App, mobile | Bottom bar, 3–5 items, labels always visible | Do not hide the primary area behind a hamburger |
| Power users | Command menu (`command-menu-reveal`) on a documented shortcut | Complements, never replaces, visible navigation |
| Section switching in a page | Tabs or a segmented control with an animated indicator (`morphing-nav-pill`) | Indicator animation ≤ 240 ms; selection applies immediately |
| Full-screen menu | Only for brand-led sites (`fullscreen-menu-curtain`) | Focus trapped inside; background inert; closes on `Esc` |

Always: a skip link, a visible current location, a working browser back button (state in the URL), and focus
moved to the new view's heading on client-side navigation.

## 8. Pricing, onboarding and forms in one paragraph each

Details are in the two pattern files; these are the positions to hold.

- **Pricing.** Three or fewer plans, differences stated as outcomes, the complete price visible, one
  recommended plan marked for a stated reason ("most teams of 5–20"), a comparison table below for the
  thorough. The billing-period toggle changes numbers in place without layout shift.
- **Onboarding.** Get the user to the product's first real outcome in as few steps as possible; every step
  either collects something the product cannot work without or teaches by doing. Skippable, resumable, with
  progress shown.
- **Forms.** One column, labels above, the fewest fields, the right input types, validation when the user has
  finished with a field, and submission that never loses their work.

## 9. Product storytelling

A product page is an argument with a shape: **situation → friction → the product in action → outcome →
evidence → ask**. Tell it with the interface.

- **Lead with the outcome state.** Show the finished report, the deployed site, the reconciled ledger, then
  show how you get there.
- **One continuous demonstration beats six disconnected features.** Follow one realistic piece of work through
  the product. Use a pinned or stepped walkthrough only if each step changes the view meaningfully
  (`scroll-pin-chapters`; keep it to three to five steps and delegate heavy scroll work to `studio-cinematic`).
- **Make it touchable where cheap.** A toggle, a slider, an editable field in the hero that really changes the
  view teaches more than a paragraph. Keep it keyboard-operable and never required.
- **Write captions, not slogans.** Under each view, one sentence saying what is happening and why it matters.
- **End on the first step, not the grand vision.** The final call to action describes what happens when it is
  pressed ("Create your first workspace: free, no card").

## 10. Product-specific review checklist

- [ ] Five-second test: product, audience and primary action are identifiable from the first viewport.
- [ ] The hero product view is DOM or vector, shows a filled state, and has a text alternative.
- [ ] One primary action style, used once per view.
- [ ] Every row of the states matrix that applies is implemented.
- [ ] Navigation shows where you are; back button and deep links work.
- [ ] No pattern from the right-hand column of §6.
- [ ] Copy uses the user's nouns; one verb per action across the flow; no filler phrases.
- [ ] Checked at 320, 390, 768, 1024, 1440 px; light and dark if both exist.
