# Social Studio demos

Five reference compositions are planned for the library at
`${CLAUDE_PLUGIN_ROOT}/library/src/demos/social/<id>/` (fallback `../../library/src/demos/social/<id>/` from
this skill's folder). Each will have a `meta.ts` (summary, highlights, the recipes it uses, accessibility,
reduced-motion and performance notes, and a `dataNote` for any counts shown) and an `index.tsx`.

**Status: planned.** When this file was written no social demo existed in the catalogue. Confirm before
citing a demo or opening its files:

```
studio3 catalog list --kind demos
studio3 catalog show creator-feed
studio3 catalog show creator-feed --source
```

If a demo is missing, treat its section as a specification and build from the recipes directly. The recipe
lists are the planned compositions; a demo's `meta.uses` is what it really imports. Several recipes named here
are planned as well: confirm each with `studio3 catalog search <id>` or `studio3 catalog show <id>`.

All people, handles, posts, products and counts in demos are fictional and labelled `Sample content`; media is
drawn with CSS, SVG or canvas. Study demos for loops, states and gesture alternatives; do not paste them into
a user's project wholesale.

## 1. Overview

| Demo id | Proves | Profile | 3D | Load it when the task is |
|---|---|---|---|---|
| `creator-feed` | A feed and profile where every participation control is instant, honest and accessible | Expressive | No | Feeds, profiles, creator tools |
| `stories` | Full-screen stories with every gesture mirrored by buttons and keys | Expressive | No | Stories, reels viewers, onboarding carousels |
| `interactive-poll` | A poll whose results are honest, announced once and add up to 100 % | Expressive | No | Polls, quizzes, votes, community questions |
| `campaign-landing` | A shareable campaign page that invites participation without manipulation | Immersive | No | Campaigns, launches with a participation mechanic |
| `3d-social-post` | One 3D post inside a feed: poster first, activated on intent, one canvas | Expressive → Immersive | Yes | 3D posts, product showcases in feeds, AR-ready previews |

## 2. `creator-feed`

**Intent.** The participation loop end to end: a feed using the ARIA feed pattern, cards with real
semantics, optimistic likes and saves that roll back with a reason, a composer that autosaves and shows the
audience, a profile header, and a "You're up to date" end.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `like-heart-morph` | Like and save toggles |
| `reaction-burst` | Reaction set on posts |
| `skeleton-shimmer-handoff` | Card skeletons handing off without layout shift |
| `expanding-card-detail` | Thumbnail to full post viewer |
| `morph-submit-button` | Publish with pending, success and error states |
| `number-ticker` | Count changes after reconciliation (real values only) |
| `morphing-nav-pill` | Profile tabs |

**Read for:** the optimistic-update flow with idempotent requests; "12 new posts" instead of inserting above
the reader; the composer's draft recovery; the ethics checklist results in `meta.ts`.

## 3. `stories`

**Intent.** Prove that stories can be fully operable without gestures: tap zones, hold to pause, swipe
between authors, all mirrored by visible buttons and keys; no auto-advance under reduced motion.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `story-progress-segments` | Segmented progress, auto-advance, pause, previous and next |
| `like-heart-morph` | Reacting to a segment |
| `pull-to-reveal-sheet` | Reply and details sheet with snap points |
| `expanding-card-detail` | Story ring to full-screen viewer |

**Read for:** pause triggers (button, hold, `Space`, hidden tab, reply focus); right-to-left mirroring of tap
zones; segment labelling for screen readers; preloading the next segment.

## 4. `interactive-poll`

**Intent.** A poll and a quiz-style variant: radio group and Vote, results that grow from zero on one scale,
the person's vote marked in text, honest results visibility, largest-remainder rounding, change-vote path.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `poll-result-bars` | Vote → result bars with counting labels |
| `number-ticker` | Total votes |
| `morph-submit-button` | Vote submission states |
| `swipe-card-stack` | A "this or that" question deck with Skip and Choose buttons |

**Read for:** the single polite results announcement; sample totals labelled as sample data; keyboard and
button equivalents for the swipe deck.

## 5. `campaign-landing`

**Intent.** A campaign page where the participation mechanic (submit, remix, share) is the point: native
share with a copy-link fallback, real deadlines only, no gated content, a capture that can be shared.
Collaborates with `studio-cinematic` for the narrative sections.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `split-line-reveal` | Campaign headline entrance |
| `scroll-pin-chapters` | The campaign story in a few beats (led by `studio-cinematic` rules) |
| `reaction-burst` | Celebrating the person's own submission |
| `swipe-card-stack` | Browsing community entries with button alternatives |
| `kinetic-marquee` | A band of entry titles with a pause control |

**Read for:** what replaces fake urgency and scarcity; share previews; the share-file path with fallback;
how the ending stays calm and usable.

## 6. `3d-social-post`

**Intent.** Apply `social-3d.md` inside a feed: posters for every item, one activated 3D post with a live
canvas, DOM controls for orbit and zoom, an AR button only where a verified mode exists, and release of GPU
resources when the post scrolls away. Collaborates with `studio-3d`.

**Planned recipes**

| Recipe | Role in the demo |
|---|---|
| `orbit-inspect-controls` | Orbit, zoom and reset with buttons and keys; no scroll capture |
| `hotspot-annotations` | Product callouts mirrored as a DOM list |
| `camera-preset-rig` | Views per variant |
| `like-heart-morph` | Post actions outside the canvas |

**Read for:** activation by intent; the poster-to-canvas hand-over; disposal on deactivate; the feed staying
scrollable before and after activation; diagnostics reported with the headless caveat.

## 7. Using a demo as a starting point

1. Read `meta.ts` first: highlights, `uses`, `dataNote`, accessibility and reduced-motion notes tell you what to
   keep.
2. Map the user's own participation loop (`playbook.md` §1); do not inherit the demo's surfaces because they
   exist.
3. Rebuild the relevant ideas in the project's stack with its tokens (`studio3.design.json`), delegating recipe
   adaptation to `studio-components`.
4. Replace all sample people, posts and counts with real data, or keep visible `Sample content` labels.
5. Do not inherit the demo's visual direction: it belongs to a fictional community.
6. Re-run the ethics checklist (`ethics.md` §9) on the adapted result; a demo passing it does not mean the
   adaptation does.
7. If the project is not React, treat the demo as a specification: loops, states, gesture alternatives,
   timings and accessibility carry over; the code does not.
