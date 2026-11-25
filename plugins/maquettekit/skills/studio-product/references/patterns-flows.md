# Flow patterns — onboarding, forms, states, transitions, tours

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - Show no errors before a field is first left; validate on blur with content and on submit, focusing the first invalid field.
> - Keep labels visible above fields, never in the placeholder; never disable paste or clear the form on error.
> - Say how to fix the error, under the field, with text, icon and border, never colour alone.
> - Give each onboarding step one primary action, honest progress, a working back button and focus moved to its heading; make it skippable and resumable across reloads.
> - Design all five states for every async surface; never blank the whole view for one failed panel.
> - Show nothing for waits under about 300 ms; make skeletons reserve the content's exact space.
> - Give destructive or costly submissions a review step or undo (WCAG 3.3.4).

Load for in-product work: anything the user moves through step by step.

## 1. Onboarding

**Goal:** the user reaches the product's first real outcome (the "it works" moment) as early as possible.
Everything else waits.

1. Name the first outcome in one sentence ("the first invoice is sent", "the first deploy is live").
2. List what the product strictly needs to get there. That list is the onboarding. Everything else moves to
   later, contextual prompts.
3. Order steps so that each produces something visible.

| Pattern | Use when | Rules |
|---|---|---|
| No onboarding: sensible defaults + sample content | The product is usable immediately | Sample content is labelled and deletable in one action |
| Single-question steps | 3–6 decisions that change the setup | One question per screen, large targets, Enter advances, Back works, progress shown |
| Checklist in the product | Setup spans sessions | 3–5 items, each links to the real feature; dismissible; completes itself as the user acts |
| Learn-by-doing first task | The core action is unfamiliar | The real UI with one guided path; no fake sandbox that differs from the product |
| Import / connect | Value depends on existing data | Show what will be read before asking permission; allow skipping with a sample |

**Rules for every pattern**

- Skippable and resumable. State survives reload. Skipping never punishes.
- Ask for an account as late as the product allows; ask for payment only when something is being bought.
- Progress is honest: "Step 2 of 4", with the total not growing. Mark it up so it is announced (a heading
  such as "Step 2 of 4: Invite your team" is enough).
- Each step has one primary action. "Skip for now" is a plain secondary control, not hidden small print.
- Focus moves to the new step's heading on advance; the browser back button goes to the previous step.
- Personalisation questions are justified to the user ("so we can set up the right template").
- Celebrate the first outcome once, briefly (≤ 1.2 s, non-blocking, removed under reduced motion), then get
  out of the way.

**Motion.** Steps transition with direction: forward content enters from the reading-direction end, back
reverses. Duration `moderate` (360 ms) or less; under reduced motion a ≤ 200 ms cross-fade. The progress
indicator animates its fill, not its layout. Controls are interactive as soon as they are visible.

## 2. Forms

### Layout and fields
- One column. Multi-column only for short related fields (postcode + city).
- Labels above fields, always visible. Placeholder text is an example at most, never the label.
- Mark the minority: if most fields are required, mark the optional ones with "(optional)" in the label.
- Use the right control: radio group for 2–5 exclusive options, select for more, checkbox for independent
  yes/no, switch only for settings that apply immediately.
- Input attributes do real work: `type`, `inputmode`, `autocomplete`, `enterkeyhint`, `autocapitalize`.
- Accept what people type: spaces in card numbers, any phone format, pasted values. Normalise in code.
- Group with `fieldset`/`legend`. Help text is tied with `aria-describedby`.
- Never disable paste. Never clear the form on error. Offer show/hide on password fields.

### Validation timing

| Moment | Validate? | Why |
|---|---|---|
| While typing, field not yet left | No errors. Positive confirmation is allowed (password requirements ticking off) | Errors on the first keystroke scold a user who has not finished |
| On blur, field has content | Yes | They finished; tell them now |
| On blur, field empty | No, wait for submit | They may be tabbing through |
| While typing, after an error is shown | Yes, clear the error as soon as the value becomes valid | Reward the fix immediately |
| On submit | Validate everything; focus the first invalid field; show a summary if the form is long | Nothing may be missed |
| Async checks (username taken) | Debounce about 400–600 ms after typing stops; show a neutral "Checking…" | Avoid flicker and request floods |

This is "reward early, punish late". Implement it as a small state machine per field:

```tsx
'use client';
import { useId, useState } from 'react';

type Props = {
  label: string;
  validate: (value: string) => string | null; // null = valid, string = how to fix it
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onBlur' | 'value'>;

export function Field({ label, validate, ...input }: Props) {
  const id = useId();
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);   // set on first blur with content, or on submit
  const error = touched ? validate(value) : null;

  return (
    <div className="field" data-invalid={error ? '' : undefined}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => setValue(e.target.value)}   // re-validates live only once `touched`
        onBlur={() => { if (value !== '') setTouched(true); }}
        {...input}
      />
      {/* Container stays mounted so the message is announced when it appears */}
      <p id={`${id}-error`} className="error" aria-live="polite">{error}</p>
    </div>
  );
}
```

On submit, set every field to touched, then move focus to the first invalid input. Use the form library the
project already has; this sketch shows the timing, not a replacement for it.

### Error messages
| Weak | Strong |
|---|---|
| "Invalid input" | "Enter a date in the future, for example 14 March 2027" |
| "Error 422" | "That email is already registered. Sign in or reset your password" |
| "Required" | "Enter your company name" |
| "Password does not meet requirements" | Requirements listed beforehand, each ticking off as met |

- Text plus icon plus border; never colour alone. Message sits directly under the field.
- Reserve vertical space or animate the message in without shifting neighbours abruptly (opacity plus a small
  height transition; instant under reduced motion).
- Server errors map to fields where possible; the rest go in a summary at the top that receives focus.
- A failed submission keeps every value. A failed network request offers retry.
- Destructive or costly submissions get a review step or an undo (WCAG 3.3.4).

### Submit feedback
Press → button enters loading within one frame (label stays or changes to a verb form; width locked) →
success (brief confirmation then navigation, or `morph-submit-button`) or error (button returns to rest,
message appears, focus moves to it). Never leave the user on an unchanged screen after success.

## 3. Empty, loading, error and partial states

Every async surface has five states. Design all five before the "ideal" one.

| State | Content | Rules |
|---|---|---|
| **Empty (first use)** | What will appear here, why it matters, one action to create the first item | Not a sad illustration. Show a labelled example or template if it helps |
| **Empty (no results)** | What was searched or filtered, how to widen it, a "Clear filters" action | Keep the filters visible; never show first-use copy here |
| **Empty (cleared)** | Calm confirmation ("All caught up") | No call to action needed |
| **Loading** | Skeleton that matches the final layout, or nothing for fast responses | See timing below |
| **Error** | What failed in plain words, whether data is safe, retry, an alternative route | Inline in the region that failed; keep the rest of the page working |
| **Partial** | The data that did load plus a marked gap with retry | Never blank the whole view for one failed panel |
| **Offline / stale** | Last known data with its time, a "reconnecting" indicator | Disable only the actions that cannot work |

**Loading timing**

| Expected wait | Show |
|---|---|
| < about 300 ms | Nothing. A flash of skeleton is worse than a brief pause |
| 300 ms – 2 s | Skeleton shaped like the content (`skeleton-shimmer-handoff`), shown after a short delay |
| 2 – 10 s | Skeleton plus a text status; progressive content as it arrives |
| > 10 s | Determinate progress or steps (`progress-orbit-loader` for an indeterminate accent), a way to cancel or leave and be notified |

- Skeletons reserve the exact space of the content (no layout shift on arrival) and hand off with a cross-fade
  no longer than the `base` token. The shimmer is decorative: remove it under reduced motion and mark the
  skeleton `aria-hidden`, with `aria-busy="true"` on the region and one status message for assistive technology.
- Prefer optimistic updates for small, reversible actions (rename, toggle, reorder): apply immediately, sync
  in the background, roll back visibly with an explanation on failure.
- Spinners are for controls (inside a button); skeletons are for content.

## 4. Shared-element transitions

Use when an element persists across a view change (a card becomes a detail page, a thumbnail becomes a
viewer). The transition explains "this is the same thing".

| Tool | Use when | Notes |
|---|---|---|
| View Transitions API | Navigations or DOM swaps where the browser can snapshot old and new states | Feature-detect `document.startViewTransition`; without it the update simply happens instantly. Each `view-transition-name` must be unique among elements rendered at that moment. Check support for the project's targets, and the framework's own integration, before relying on it |
| Motion `layoutId` / `layout` | React, both states rendered by the same tree, interruption matters | Wrap related elements in a `LayoutGroup`; animating layout scales children, so correct text and radius distortion (see `studio-motion`) |
| FLIP by hand (the library's `flip()` helper) | No framework support, or lists reordering | Measure first, mutate, invert with transforms, play |

```ts
// Progressive enhancement: works everywhere, animates where supported.
function openDetail(update: () => void, reduced: boolean) {
  if (reduced || !('startViewTransition' in document)) { update(); return; }
  document.startViewTransition(update);
}
```

```css
.card[data-active] .thumb { view-transition-name: product-thumb; }
.detail .hero-image       { view-transition-name: product-thumb; }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```

Rules: duration `moderate` to `slow` (360–560 ms) with the `emphasized` easing or the `glide` spring; only one
shared element is the hero, the rest cross-fade; the transition must be interruptible (pressing back mid-way
works); focus moves to the detail heading afterwards; the URL changes so the state is linkable. Library
recipe to study: `expanding-card-detail`.

## 5. Product tours and feature hints

Tours are the weakest form of onboarding: people dismiss them and learn nothing. Prefer, in order:

1. A better empty state that makes the first action obvious.
2. Inline hints placed in the layout next to the feature, dismissible, shown once.
3. A checklist linking to real features.
4. A stepped tour, only when the interface is unavoidably dense.

If you build a tour:

- 3–5 steps, each anchored to a real control, each asking the user to do the thing rather than read about it.
- "Skip tour" on every step; "Back" and "Next"; step count shown; `Esc` closes.
- The popover is a non-modal dialog with a label; focus moves into it on each step and returns to the anchor
  when it closes. The highlighted control remains operable.
- The spotlight overlay must not hide the focused element (2.4.11) and must not trap pointer users.
- Remember completion and dismissal per user; never show it again uninvited. Offer a way to replay it from
  help.
- Motion: the popover moves between anchors in `moderate` time or less, or cross-fades under reduced motion;
  the page scrolls the anchor into view with `scroll-margin` so sticky headers do not cover it.

## 6. Flow checklist

- [ ] The first real outcome is named, and the flow contains only what it needs.
- [ ] Every step: one primary action, back works, progress honest, state survives reload.
- [ ] Field validation follows the timing table; errors say how to fix; nothing is lost on failure.
- [ ] All five states exist for every async surface; skeletons match final layout.
- [ ] Shared-element transitions are progressive enhancements with instant fallbacks.
- [ ] Any tour is skippable, short, remembered, and leaves controls operable.
- [ ] Whole flow completed by keyboard and at 320 px.
