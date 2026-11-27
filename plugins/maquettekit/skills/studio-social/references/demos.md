# Social Studio demos

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - Confirm a demo with `maquettekit catalog show <id>` before citing it: `uses` recipes install as they are, `adapts` techniques live in the demo's own files.
> - Pick by loop: `creator-feed` (feed, profile), `stories` (full-screen viewer), `interactive-poll` (polls, quiz, ranking), `campaign-landing` (participation mechanic), `3d-social-post` (one 3D object in a feed).
> - Give every gesture (swipe, hold, throw, drag, sew) a visible button and a keyboard twin, as each demo does.
> - Under reduced motion nothing moves by itself, but a drag the person makes still follows their hand.
> - Optimistic actions answer in the same frame, send the final intended state with an idempotency key and roll back with a reason.
> - Keep counts labelled `Sample content` until real data replaces them; no countdowns, invented activity or gated content.
> - Put 3D in a feed photo first: one canvas mounted on request, released on close or scroll-away.
> - Re-run `ethics.md` §9 on the adapted result.

Five reference compositions live in the library at
`${CLAUDE_PLUGIN_ROOT}/library/src/demos/social/<id>/` (fallback `../../library/src/demos/social/<id>/` from
this skill's folder). Each has a `meta.ts` (summary, highlights, recipes, accessibility, reduced-motion and
performance notes, and a `dataNote` for any counts shown) and an `index.tsx`, and meets the craft floor for its
profile (`${CLAUDE_PLUGIN_ROOT}/shared/motion-craft.md` §1) as described below.

All people, handles, posts and counts are fictional and labelled as sample content; media is drawn with CSS, SVG or
canvas, apart from `3d-social-post`'s model and its render. Study demos for loops, states and gesture alternatives;
do not paste them into a user's project wholesale.

**The catalogue is the source of truth.** `uses` lists the recipes a demo imports; `adapts` lists recipes whose
technique it rebuilds in its own files. Confirm before citing:

```
maquettekit catalog list --kind demos
maquettekit catalog show creator-feed
maquettekit catalog show creator-feed --source
```

## 1. Overview

| Demo id | Proves | Profile | 3D | Load it when the task is |
|---|---|---|---|---|
| `creator-feed` | A feed where every participation control answers at once, then reconciles or rolls back honestly | Expressive | No | Feeds, profiles, creator tools |
| `stories` | Full-screen stories with every gesture mirrored by a button and a key | Expressive | No | Stories, reels viewers, onboarding carousels |
| `interactive-poll` | Polls, a quiz and a ranking ballot with honest results, announced once | Expressive | No | Polls, quizzes, votes, community questions |
| `campaign-landing` | A campaign whose participation mechanic is the hero, with real dates instead of pressure | Immersive | No | Campaigns, launches with a participation mechanic |
| `3d-social-post` | One 3D post in a feed: photo first, one canvas on request, released on exit | Expressive → Immersive | Yes | 3D posts, product showcases in feeds |

## 2. `creator-feed` — Creator Feed

A risograph printer's profile and field-note feed (ARIA feed pattern): every like, save, follow and comment answers in
the same frame, reconciles with a simulated server or rolls back with a reason, and the chronological feed ends with
"You're all caught up". It passes the ethics checklist (`ethics.md` §9).

- **Signature move:** a registration field. Each print is two stacked plates; the coral plate lags 1–4 px behind
  pointer and scroll speed and snaps into exact register on the quick `press` spring when its sheet is hovered,
  pressed or focused.
- **Physical and lit:** one top-left light; posts lift over a two-layer shadow; every control lifts on hover, stamps
  down on press and springs back.
- **Alive:** the plates drift with the page's movement and settle a hair out of register at rest.
- **Touchable:** throw the proofs carousel (it rubber-bands at the ends) or drag the comments sheet away (past 30 % or
  faster than 0.5 px/ms). Twins: Previous/Next and ←/→; Close, Esc and the scrim; the Like button for double-tap.
- **Reduced motion:** plates sit in register; like and save cross-fade in 160 ms; no heart or particles; sheets fade;
  dragging still follows the pointer.
- **Recipes:** uses `reaction-burst` (pinned note). Adapts `like-heart-morph` (like, save), `pull-to-reveal-sheet`
  (comments sheet), `grain-gradient-mesh` (paper grain) and `press-depth-button`.

**Copy:** `store.ts` (debounced requests carrying the final state and an idempotency key; "Simulate failed requests"
shows rollback); `registration.ts` (transform-only plates on one loop that sleeps when settled); `Sheet.tsx` (a modal
sheet contained in the page, background inert, focus returned). Pair with `playbook.md` §13.

## 3. `stories` — Stories

Mobile-first stories for a fictional harbour town: a tray of accounts that opens into a full-screen viewer with
segmented progress, tap zones, hold to pause and swipes, plus a story embedded in the page. On wide screens the
viewer stands on a desktop stage that takes the colour of the card on screen.

- **Signature move:** the ring you press grows into the viewer (a circular reveal from its own position), and the
  viewer closes back into it, faster than it opened.
- **Physical and lit:** swipes follow the finger with resistance at the ends, commit past 30 % or 0.5 px/ms and
  otherwise spring back; rings and buttons lift on hover and press in on a token spring.
- **Alive:** the current segment's animation is the clock; it pauses for Pause, a held press, reply focus and a
  hidden tab.
- **Touchable:** every gesture has twins: tap left/right ↔ Previous/Next and ←/→; swipe sideways ↔ peek cards,
  account buttons and Shift+←/→; hold ↔ Pause and Space; swipe down ↔ Close and Esc. Tap zones mirror right to
  left.
- **Reduced motion:** no clock (cards never advance by themselves, so Pause is removed); the viewer fades in 160 ms;
  accounts cross-fade.
- **Recipes:** uses `story-progress-segments` (segments and clock). Adapts `expanding-card-detail` (ring to viewer)
  and `press-depth-button`.

**Copy:** the clock-as-animation contract and its pause triggers; the viewer as a modal dialog contained in the page
(focus starts on Pause and returns to the ring); manual moves announced, automatic ones not; `Hints.tsx`, a gesture
guide made of real text. Pair with `interaction-patterns.md` §6–§7.

## 4. `interactive-poll` — Interactive Poll

A community radio station's listener polls: single choice, multiple choice with "of respondents" percentages and
labelled simulated live votes, a no-timer quiz, and a ranking ballot.

- **Signature move:** the FM dial is a real tuner. The needle pulls into each 0.2 MHz detent; a throw carries its
  velocity into the nearest one on a `release` spring, with a magnetic catch on 98.2.
- **Physical and lit:** single-choice rows turn into bars in place on the heavy `glide` spring, staggered, with
  percentages counting up. One top-left light: cue cards carry a two-layer shadow; a chosen option sits pressed in.
- **Alive:** the signal meter and readout answer the dial continuously; live votes are finite (40) and pausable.
- **Touchable:** turn the dial; drag the ranking ballot. Twins: the dial is a slider (←/→, Page Up/Down, Home/End)
  whose value text names frequency and station; the ballot takes Space, arrows, Space, and Esc to cancel.
- **Reduced motion:** the needle jumps to each detent (dragging still follows); bars appear at final width with a
  160 ms fade; live votes start paused.
- **Recipes:** uses `drag-reorder-list` (ranking ballot). Adapts `poll-result-bars` (single choice, flattened into the
  cue card) and `press-depth-button`.

**Copy:** `SinglePoll.tsx` (largest-remainder rounding to 100, "Your vote" in words, one polite announcement, change
vote); results promises stated up front (shown after voting, a real closing time); the quiz button that turns from
Check answer into Next question so focus never jumps. Pair with `interaction-patterns.md` §4.

## 5. `campaign-landing` — Campaign Landing

Mend March, a fictional city-wide repair challenge: a denim hero where you sew a patch on yourself, a gallery of last
year's mends you can turn over, a pledge, a share-card generator and a café leaderboard marked as sample data.
Collaborates with `studio-cinematic`.

- **Signature move:** sew it yourself. Drag the needle along the chalk line and the running stitch appears behind it;
  drag back to unpick. The needle turns corners on a spring, its thread is a short verlet rope that trails and whips,
  and the last stitch ties off as the patch settles.
- **Physical and lit:** one top-left light; gallery photos lift, press and turn over on a spring to their "before"
  side; filters reorder with staggered, interruptible glides.
- **Alive:** two indigo fields follow the pointer at different depths (≤ 14 px) under a work-lamp highlight that
  moves with it; the share card tilts toward it; all stop when it does.
- **Touchable:** the needle, with twins: a slider (←/→ one stitch, Page Up/Down a side, Home/End), "Finish for me"
  and "Unpick"; gallery photos are toggle buttons.
- **Reduced motion:** the patch starts sewn; needle and thread jump to each stitch; nothing follows the pointer; the
  gallery cross-fades; no burst. Dragging the needle still sews.
- **Recipes:** uses `split-line-reveal` (headline). Adapts `svg-path-draw` (the stitch, driven by the pointer),
  `flip-grid-reorder` (gallery), `morph-submit-button` (pledge key), `reaction-burst` (one burst of patches),
  `grain-gradient-mesh` (grain), `tilt-parallax-card` (share card) and `press-depth-button`.

**Copy:** honest framing in place of pressure: real dates (1–31 March 2027) with no countdown, "no prizes, on
purpose", an opt-in gallery, a leaderboard (the bar-race pattern) that says nobody is behind;
`ShareCard.tsx` (a canvas with a written equivalent, redrawn only when its text or colour changes).

## 6. `3d-social-post` — 3D Social Post

An astronomy club's feed where one post holds a brass token you can turn in 3D. The post is complete as a photo with
facts and a "Download model (GLB)" link; "Interact in 3D" mounts the feed's single `StudioCanvas` (three-kit `Model`,
`OrbitInspect`, `LightingRig`, `AnimationPlayer`). Collaborates with `studio-3d`.

- **Signature move:** the photo becomes the object: once the model reports loaded, the photo cross-fades to the live
  token, standing three-quarters round as in the photo.
- **Physical and lit:** a generated "observatory" environment (no HDRI download) puts a warm softbox up and to the
  left, the page's light direction, for the brass to reflect; controls lift toward that light, press in one frame
  and spring back.
- **Alive:** before activation the photo tilts toward the pointer and a glint masked to the token crosses the brass.
- **Touchable:** orbit and zoom the token. Twins: 44 px buttons (turn, zoom, reset, spin, Close 3D) and arrows,
  `+`/`−` and `0` on the focused view; vertical swipes keep scrolling the feed.
- **Reduced motion:** the token never spins by itself; orbit moves are direct; no tilt, glint or reaction pops.
- **Recipes:** adapts `tilt-parallax-card` (photo tilt and glint) and `press-depth-button`.

**Copy:** activation by intent and release on exit (Close 3D, or scrolling a screen away, unmounts the canvas; the
cached model is evicted a second later); only the 2 kB manifest fetched up front; real download progress; no Interact
button without WebGL, the photo being the marked fallback. Pair with `social-3d.md` §4–§5.

## 7. Using a demo as a starting point

1. Read `meta.ts` first: highlights, `uses`, `adapts`, `dataNote`, accessibility and reduced-motion notes say what to
   keep.
2. Map the user's own participation loop (`playbook.md` §1) and write a motion brief (`motion-craft.md` §6); do not
   inherit a demo's surfaces, signature move or visual direction because they exist.
3. Rebuild the relevant ideas in the project's stack with its tokens (`maquettekit.design.json`), delegating recipe
   adaptation to `studio-components`. A `uses` recipe installs as it is (`maquettekit catalog install <id>`); an
   `adapts` technique lives in the demo's own files.
4. Keep every gesture's button and keyboard twin, and each reduced-motion form.
5. Replace all sample people, posts and counts with real data, or keep visible `Sample content` labels.
6. Re-run the ethics checklist (`ethics.md` §9) on the adapted result; a demo passing it does not mean the adaptation
   does.
7. If the project is not React, treat the demo as a specification: loops, states, gesture alternatives, timings and
   accessibility carry over; the code does not.
