# Social interaction patterns — reactions, polls, comments, gestures, stories, transitions

Load when building any participation control or gesture. Every gesture here has a button and a keyboard
twin; build them together.

## 1. Feedback timing and springs

- The pressed state paints in the next frame; the network can take as long as it likes behind an optimistic
  update (`playbook.md` §13).
- Celebration (bursts, pops) follows the person's own action only, lasts under about a second, and is removed
  under reduced motion.
- Springs come from the motion tokens, named by role:

| Token | stiffness / damping / mass | Use |
|---|---|---|
| `press` | 520 / 34 / 0.8 | Buttons, toggles, chips: fast, no visible bounce |
| `settle` | 260 / 28 / 1 | Cards, popovers and sheets coming to rest |
| `release` | 180 / 20 / 1 | Objects released from a drag; carries the gesture's velocity |
| `pop` | 420 / 14 / 0.9 | Celebratory feedback (likes, reactions); sparingly |
| `glide` | 120 / 22 / 1.2 | Large surfaces and shared-element transitions |

In CSS or WAAPI, `springToLinear(spring.pop)` samples a spring into a `linear()` easing plus its settle
duration, so no JavaScript loop is needed.

## 2. Reactions

| Variant | Pattern | Keyboard and assistive tech |
|---|---|---|
| Single reaction (like) | Toggle button, `aria-pressed`, count as text | `Enter`/`Space`; the name stays "Like", the pressed state carries the change |
| Reaction set (several emotions) | A trigger button that opens a menu or a popover radio group of reactions | `Enter` opens; arrows move; `Enter` chooses; `Esc` closes and returns focus |
| Long-press to open the set | Allowed as a shortcut only | The visible trigger above is required (2.5.1); suppress the native callout (`-webkit-touch-callout: none`) on that control only |
| Live applause (streams) | Burst of shapes over the player (`reaction-burst`) | One polite confirmation in words; the canvas is `aria-hidden` |

- Counts are text, reconcile with the server and never inflate (`ethics.md` §3).
- A burst draws from a fixed particle pool on one canvas that sleeps when idle; no allocation per tap.
- Reduced motion: no particles; the count updates and the chip changes fill.

## 3. Like and save morphs

- Morph, do not swap: the heart fills from its centre on the `pop` spring, the bookmark ribbon unrolls
  (`like-heart-morph`). Undo plays a shorter, quieter reverse.
- Rapid toggling must never desynchronise: each toggle cancels the previous animation and starts from the
  current computed state.
- State is carried by fill and caption as well as colour; focus ring on the whole control; ≥ 44 px target.
- Double-tap on media to like is a shortcut, never the only path; give the media `touch-action: manipulation`
  to remove the double-tap zoom delay, and keep the Like button visible.

## 4. Polls

- A poll is a radio group (`fieldset` + `legend` with the question) and a Vote button; the options become
  result bars that grow to their share, with counting labels (`poll-result-bars`).
- Show whether results are visible before voting, and keep that promise; show the closing time and the total
  votes; mark the person's choice with text and an icon ("Your vote"); allow changing the vote while the poll
  is open, if the product allows it.
- Announce results once in a polite status message ("Results: Option A 48 %, Option B 39 %, Option C 13 %").
- Rounded percentages must add up to 100. Use the largest-remainder method (or show one decimal):

```ts
export function percentages(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  const raw = counts.map((c) => (c / total) * 100);
  const out = raw.map(Math.floor);
  let rest = 100 - out.reduce((a, b) => a + b, 0);
  const byRemainder = raw.map((r, i) => [r - out[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of byRemainder) { if (rest-- <= 0) break; out[i]++; }
  return out;
}
```

- Bars start at zero and share one scale; the leading option is marked by text or weight, not colour alone.
- Sample polls show sample totals labelled `Sample content`; never seed a real poll with fake votes.

## 5. Comments

| Need | Rule |
|---|---|
| Threading | At most two or three visual levels; deeper replies continue behind "Continue this thread" |
| Long threads | "Show 12 more replies" buttons that load in place and keep focus on the first new reply |
| Sorting | Visible and labelled ("Top", "Newest"); remembers the choice |
| Composer | A labelled textarea; mentions as an accessible combobox; `Enter` behaviour stated; a draft kept if the person navigates away |
| Posting | Pending state on the new comment; on success focus stays in the composer and a polite message confirms; on failure the text is kept with Retry |
| Edits and removal | "Edited" marker; removed comments leave a placeholder with the reason category ("Removed by a moderator") so threads still make sense |
| Time | `<time datetime>` with relative text; absolute time on hover and focus |
| Safety | User text escaped, links shortened visibly but complete in `href`, `rel="ugc noopener"` on user links |

## 6. Swipe and gesture navigation

| Gesture | Required alternative | WCAG |
|---|---|---|
| Swipe a card left or right (dismiss, save) | Skip and Save buttons; arrow keys on the focused card (`swipe-card-stack`) | 2.5.1, 2.1.1 |
| Drag to reorder | Move up and down buttons, or grab with `Space`, arrows, drop with `Space` | 2.5.7, 2.1.1 |
| Long-press for options | A visible "More options" button | 2.5.1 |
| Double-tap to like | The Like button | 2.5.1 |
| Pinch to zoom media | Zoom buttons; never block the browser's own zoom | 2.5.1, 1.4.4 |
| Pull to refresh | A Refresh button; new-content button in the feed | 2.5.1 |
| Swipe down to dismiss a viewer | Close button and `Esc` | 2.5.1, 2.1.1 |

**Implementing a swipe**

- Pointer events with `setPointerCapture(e.pointerId)` on `pointerdown`; handle `pointercancel` as an abort
  that springs back.
- `touch-action: pan-y` on horizontally swipeable elements, so vertical page scrolling stays native.
- Commit when the drag passes about 30–40 % of the element's width or the release velocity exceeds roughly
  0.5 px/ms (500 px/s) in that direction; otherwise spring back with `settle`. With Motion's `drag`, read
  `info.offset.x` and `info.velocity.x` in `onDragEnd`.
- Release with the `release` spring, seeded with the gesture's velocity, so the card leaves at the speed the
  hand threw it.
- Rubber-band beyond limits (resistance grows with distance); tie rotation and opacity to the offset, not to
  time.
- Avoid starting horizontal swipes at the screen edges, where mobile systems use edge swipes for Back.
- Offer Undo for dismissals; announce the outcome politely ("Saved to Later").

## 7. Stories mechanics

| Input | Action | Notes |
|---|---|---|
| Tap the right part (about two-thirds) | Next segment | Mirror the zones in right-to-left layouts |
| Tap the left third | Previous segment | |
| Press and hold (about 200–300 ms or more) | Pause while held | Release resumes; a hold never also counts as a tap |
| Swipe left or right | Next or previous author | Buttons for the same |
| Swipe down | Close | Close button and `Esc` |
| Swipe up / Reply field | Reply or open details | Opening the reply field pauses the story |
| `←` / `→`, `Space`, `Esc` | Previous, next, pause or play, close | Keys work as soon as the viewer opens |

- **Pause control visible** at all times (2.2.2), first in the focus order inside the viewer.
- **Auto-advance** about 5–7 s for image and text segments, a video's own length for video; pause when the tab
  is hidden (`visibilitychange`), when focus enters the reply field, and when a menu or sheet opens.
- **Reduced motion:** no auto-advance; the person advances by tap, key or button; segment changes cut or
  cross-fade within 200 ms (`story-progress-segments` follows this).
- **Assistive tech:** each segment has a heading or label ("Story 2 of 6 from Ana, 3 h ago") and real content
  (alt text, captions, text); announce politely on manual navigation, not on every automatic advance.
- **Preloading:** the next segment's media loads while the current one plays; the progress bar never runs while
  the segment is still loading.

## 8. Media-to-detail transitions

- A thumbnail grows into the viewer as one object: View Transitions where supported, Motion `layoutId` in
  React, or FLIP (`flip()` from the motion module); `expanding-card-detail` shows the pattern.
- Durations `moderate`–`slow` with `glide`; one hero element, the rest cross-fades; interruptible (Back
  mid-way works).
- The viewer has a close button, `Esc`, and swipe down to dismiss with the backdrop's opacity tied to the drag
  offset; releasing short of the threshold springs back.
- Focus moves into the viewer on open and returns to the thumbnail on close; the background is `inert`.
- The URL changes so the item is linkable, and closing restores the feed's scroll position exactly.
- Reduced motion: cut or a ≤ 200 ms cross-fade.

## 9. Sheets

- Snap points (peek, half, full), rubber-banding at the ends, velocity-aware snapping, the backdrop's opacity
  tied to position (`pull-to-reveal-sheet`).
- Modal sheets: `role="dialog"`, `aria-modal="true"`, a label, focus moved in and trapped, background `inert`,
  `Esc` closes, focus returns to the opener.
- Non-modal sheets (a map's results panel): a labelled region with buttons to expand and collapse, and
  `aria-expanded` on the handle button.
- Scrollable content inside a sheet uses `overscroll-behavior: contain` so it does not drag the page or
  trigger pull-to-refresh.
- The drag handle is also a button (step through snap points); every snap point is reachable without
  dragging (2.5.7).

## 10. Checklist

- [ ] Feedback paints in the next frame; celebration only for the person's own action; removed under
      reduced motion.
- [ ] Toggles use `aria-pressed` with stable names; counts are text and reconcile with the server.
- [ ] Reaction sets open from a visible button; long-press is only a shortcut.
- [ ] Poll percentages sum to 100; the person's vote is marked in text; results visibility is honest.
- [ ] Comments keep drafts, show pending and failed states, and render user text safely.
- [ ] Every gesture in §6 has its button and key alternative; swipes use `touch-action: pan-y`.
- [ ] Stories pause by button, hold, `Space`, hidden tab and reply focus; no auto-advance under reduced
      motion.
- [ ] Media viewers move focus, restore scroll and update the URL; sheets reach every snap point by button.
