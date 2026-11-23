# Conversion patterns — landing pages, proof, pricing, calls to action

Load for marketing surfaces. The aim is a page that lets the right visitor decide quickly and correctly.

## 1. Landing page structure

Start from this skeleton and delete what the product does not need. Do not add sections to look complete.

| # | Section | Job | Length guide | Common failure |
|---|---|---|---|---|
| 1 | Hero | Say what it is, for whom; show it; offer the action | One viewport, action visible without scrolling at 390 × 700 | Abstract headline, abstract visual |
| 2 | Demonstration | Show one real task done with the product | 1–2 viewports | Feature grid instead of a demonstration |
| 3 | Differentiator | The one thing that is different, argued | 1 viewport | Six equal "benefits" |
| 4 | Supporting capabilities | The next three or four things people ask about | Compact; text-led | Three identical cards |
| 5 | Proof | Evidence from real use | Short | Invented logos and quotes |
| 6 | Pricing or path to price | Remove cost uncertainty | Table or one line + link | "Contact us" with no anchor |
| 7 | Objections | The real questions before buying | 4–7 questions, answers in full sentences | FAQ padded with marketing |
| 8 | Final action | Restate the offer and the first step | Short | A different offer than the hero |

Navigation: logo, three to five links, one primary action. The footer carries everything else.

## 2. Hero formulas that are not generic

A hero has four parts: **claim, clarifier, product view, action**. The generic hero fails at the claim.

**Write the claim with this test:** would a competitor be unable to say it, and would a stranger understand
what the product does from it alone?

| Formula | Pattern | Example (fictional product) |
|---|---|---|
| Outcome with a number you can show | *[Result] in [time/effort]*, proven by the visual | "Month-end close in an afternoon" over a ledger animating to reconciled |
| The removed step | *[Task] without [hated step]* | "Ship a changelog without opening a doc" |
| The concrete object | *Name the thing it makes* | "A status page your customers will actually read" |
| The contrast | *[Old way] → [new way]* shown side by side | Raw log on the left, grouped incident on the right |
| The demonstration as headline | An interactive product fragment is the hero; the headline is a caption | A working command bar: "Type what you want to deploy" |
| The audience call | *For [specific role] who [specific situation]* | "For two-person finance teams who inherited a spreadsheet" |

Never: "The all-in-one platform for…", "Supercharge your…", "Reimagine…", "…made simple", "The future of…".
If numbers are not real and sourced, do not use the first formula.

**Clarifier.** One or two sentences, plain: what it is (category noun), who it is for, what makes it different.
This is where the category word lives so the headline can be vivid.

**Product view.** Rules in the playbook §1. In the hero specifically:

- It must be visible in the first viewport on mobile; if it pushes the action below the fold, place the action
  above it.
- Give it a single orchestrated entrance at most, starting from a visible state (see the shared
  `performance.md` on LCP). Suitable recipes: `split-line-reveal` for the headline, `layered-depth-stack` or
  `parallax-depth-layers` at low amplitude for the view, `spotlight-border-card` for a pointer accent.
- No autoplaying background video with text over it unless contrast holds at every frame and a pause control
  exists.

**Layout options beyond centred-stack:**

| Layout | When |
|---|---|
| Split: text left (5 columns), product right (7), product bleeds off the edge | Default for software |
| Product-first: a full-width interactive fragment, headline as caption beneath | The product explains itself |
| Type-first: very large claim, product view begins at the fold and continues below | Strong claim, complex product |
| Editorial: asymmetric columns with a marginal note or specification list | Technical or premium positioning |

## 3. Social proof — honesty rules

Proof persuades only if it is true, and fabricated proof is deceptive. These are hard rules.

1. **Never invent** customer names, logos, quotes, ratings, review counts, user numbers, download counts,
   awards, press mentions or performance figures. Not as placeholders either, unless clearly labelled.
2. **If the user has not supplied proof**, build the section with a visible `Placeholder: replace with real
   customer evidence` label on each slot, or omit the section. Tell the user which you did.
3. **Attribute fully**: person's name, role and organisation for quotes (with permission, which is the user's
   responsibility; remind them). Anonymous quotes are stated as such ("Head of operations, logistics company").
4. **Numbers carry a source and date**: "4.7 average from 1,208 reviews on [store], March 2026".
5. **Logos imply endorsement.** Use only organisations that are customers and have agreed. A grey logo strip
   of famous companies is the most recognisable fake signal there is.
6. **No live counters that are not live.** A ticking "users online" number driven by a random function is a
   lie. `number-ticker` may animate to a real value once, on entry.
7. **Selective is fine; misleading is not.** Do not crop a quote to reverse its meaning or present a pilot as
   a deployment.

Better proof formats than a logo strip:

| Format | Why it works |
|---|---|
| One detailed customer story with a specific before/after | Specificity is credible |
| A real artefact: a public status page, an open-source repository, a changelog | Verifiable |
| Product facts: uptime history, security attestations with links, data location | Answers a risk question |
| Quotes placed next to the feature they describe | Evidence where the claim is made |
| Usage demonstration instead of testimony | The product is its own proof |

## 4. Pricing tables

**Structure**

- Up to three plans side by side, plus an "enterprise/contact" line if needed. More than four: use a
  selector (team size, usage) that reduces the choice.
- Each plan: name, one-line "for whom", price with unit and period, the primary action, then five to seven
  differentiating features. Shared features go in the comparison table, not in every column.
- Recommend one plan only with a reason in words. Emphasise it by position and a label, not by making the
  others hard to read.
- State what is not obvious: per seat or flat, currency, tax, what happens when limits are exceeded, trial
  length and what happens at its end, how to cancel.
- Mobile: stack plans with the recommended one first, or use tabs. Keep the comparison table as a real
  `<table>` in a horizontally scrollable region with a sticky first column.

**Semantics.** Plans are a list or a set of `article`s with headings; the comparison is a `<table>` with
`<th scope="col">` plans and `<th scope="row">` features; included/excluded uses text ("Included", "Not
included") available to assistive technology, not only tick and cross icons.

### Animated billing toggle

The toggle is a labelled two-option control. Requirements:

- A radio group or a switch with an explicit label ("Bill yearly"), not an unlabeled pill.
- Prices update in place; widths do not jump (tabular figures, fixed min-width).
- The saving is stated in words ("2 months free"), computed from the real prices.
- The change is announced once to assistive technology.
- Under reduced motion the numbers swap instantly.

```tsx
'use client';
import { useState } from 'react';

type Period = 'monthly' | 'yearly';
const plans = [
  { id: 'team', name: 'Team', monthly: 12, yearly: 120 }, // yearly = total per seat per year
];

export function BillingToggle() {
  const [period, setPeriod] = useState<Period>('monthly');
  return (
    <>
      <fieldset className="toggle">
        <legend className="sr-only">Billing period</legend>
        {(['monthly', 'yearly'] as const).map((p) => (
          <label key={p}>
            <input type="radio" name="period" value={p}
                   checked={period === p} onChange={() => setPeriod(p)} />
            <span>{p === 'monthly' ? 'Monthly' : 'Yearly'}</span>
          </label>
        ))}
      </fieldset>

      {plans.map((plan) => {
        const perMonth = period === 'monthly' ? plan.monthly : plan.yearly / 12;
        return (
          <article key={plan.id}>
            <h3>{plan.name}</h3>
            <p className="price">
              <span className="amount">£{perMonth.toFixed(perMonth % 1 ? 2 : 0)}</span>
              <span className="unit"> per seat / month</span>
            </p>
            <p className="note">
              {period === 'yearly' ? `Billed £${plan.yearly} per seat yearly` : 'Billed monthly'}
            </p>
          </article>
        );
      })}

      {/* One polite announcement instead of every digit changing */}
      <p role="status" className="sr-only">
        {period === 'yearly' ? 'Showing yearly prices' : 'Showing monthly prices'}
      </p>
    </>
  );
}
```

```css
.amount { font-variant-numeric: tabular-nums; display: inline-block; min-width: 4ch; }
.toggle label:has(:focus-visible) { outline: 2px solid var(--s3-focus, currentColor); outline-offset: 2px; }
```

To animate the digits, wrap the amount with the `number-ticker` recipe (confirm with
`studio3 catalog show number-ticker`); keep the animated element `aria-hidden` and the plain value in the
accessible text, duration at most the `base` token, and no animation under reduced motion. The selection
indicator can use `morphing-nav-pill`.

## 5. Call-to-action hierarchy

| Level | Appearance | Count per view | Label |
|---|---|---|---|
| Primary | Filled, signal colour, highest contrast | Exactly one | Verb + object + qualifier: "Start free trial", "Create workspace" |
| Secondary | Outline or tonal | Zero to two | Alternative commitment: "See pricing", "Watch 2-min demo" |
| Tertiary | Text link with underline or arrow | As needed | Navigation: "Read the docs" |

Rules:

- The same primary action and label from hero to footer. Changing the ask mid-page splits intent.
- Say what happens next, close to the button: "No card required", "Takes 2 minutes", "You'll get a calendar
  link". Only if true.
- Button text describes the action, never "Submit", "Click here", "Learn more" without an object.
- Size: at least 44 px high on touch; full width on narrow screens inside forms; never two primaries
  competing side by side.
- Sticky action bars on mobile are acceptable if they are short, do not cover focused elements (2.4.11) and
  can be dismissed or do not obscure content at the end of the page.
- Feedback: pressed state within one frame (`press-depth-button`); `magnetic-button` only on fine pointers,
  Expressive or Immersive profile, and only for the single primary action.
- The email-only waitlist form is one field and one button on one line (stacked on mobile), with a visible
  label, inline validation on submit, and a success message that replaces the form and is announced.

## 6. Do / do not

| Do | Do not |
|---|---|
| Put the category noun in the first two sentences | Make the visitor infer what it is from a metaphor |
| Use the product's real UI as imagery | Use an isometric illustration of "collaboration" |
| Let one section be dense and one be nearly empty | Give every section identical padding and structure |
| Answer the pricing question on the page | Send every visitor to a sales form for a number |
| Write FAQ answers that include the uncomfortable facts | Write questions nobody asked |
| Measure the hero at 390 × 700 and 1440 × 800 | Design only at one desktop width |
| Keep proof next to the claim it supports | Collect proof into a wall no one reads |

## 7. Checklist for a marketing page

- [ ] Claim passes the competitor test; clarifier contains the category noun and the audience.
- [ ] Product view present, real, filled, visible on mobile first viewport.
- [ ] One primary action, same label throughout, with a true reassurance line.
- [ ] All proof is real and attributed, or labelled placeholder, or absent.
- [ ] Complete price visible or one click away; toggle does not shift layout.
- [ ] Sections ordered by visitor questions; none without a job.
- [ ] No pattern from the playbook's dark-pattern table.
