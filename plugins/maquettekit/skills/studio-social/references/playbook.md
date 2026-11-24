# Social Studio playbook

How to design surfaces people join, contribute to and return to by choice. Taste rules are in the shared
`design-principles.md`; gesture and component mechanics are in `interaction-patterns.md`; the limits on
persuasion are in `ethics.md`.

## 1. The participation loop

Most social products run one loop: **consume → react → create → share → return**. Design it in that order,
and make each step cheaper than the last one people expect.

| Step | The person's question | Design for | Failure mode |
|---|---|---|---|
| Consume | "Is this worth my time?" | Legible cards, real names, honest context (time, source, why it is shown) | Infinite sameness, no stopping point |
| React | "Can I respond without effort?" | One-tap reactions that answer in the next frame | Slow, uncertain or hidden feedback |
| Create | "Is it safe and easy to post?" | Drafts that never vanish, a visible audience, a preview | Lost work, surprise visibility |
| Share | "Can I send this where my people are?" | Native share sheet, copy link, good previews | Share walls, tracking surprises |
| Return | "Do I want to come back?" | Real activity from real people, digests, the person's own goals | Bait notifications, streak pressure |

For each surface write one sentence: its job in the loop, and the one action it exists for.

## 2. Feeds

- **Card anatomy:** author (avatar, name, handle), time (relative, with `<time datetime>` and the absolute
  time on hover and focus), the content, media, actions (react, comment, share, save) and counts as text.
- **Semantics:** the ARIA feed pattern: `role="feed"` containing `article` elements, each labelled by its
  author line, with `aria-posinset` and `aria-setsize` (`-1` when the total is unknown), and `aria-busy="true"`
  on the feed while items load. Page Down and Page Up move between articles.
- **Ranking transparency:** a "Why am I seeing this?" entry on ranked items; a chronological option where the
  product allows it.
- **New content never pushes the reader.** Show a "12 new posts" button instead of inserting above the
  reading position; keep scroll anchoring on (`overflow-anchor` is on by default; do not disable it).
- **Loading:** skeletons shaped like cards (`skeleton-shimmer-handoff`), reserved media aspect ratios so
  nothing shifts; a "Load more" button as the fallback for infinite loading, so keyboard users reach the
  footer.
- **An end:** "You're up to date" when the person has seen everything new; then, if anything, a clearly
  separated "Suggested" section they can ignore (`ethics.md` §4).
- **States:** first use (who to follow, how to post), empty filter, offline (cached items with their age),
  error with retry per region.

## 3. Stories

Full-screen, sequential, time-limited segments grouped by author. Mechanics and accessibility are in
`interaction-patterns.md` §7; the surface needs:

- Segmented progress at the top (`story-progress-segments`), author and time, a close button, a pause
  button, and the reply or reaction affordance at the bottom.
- Text and faces kept away from the top and bottom bands where progress, names and reply controls overlay.
- Captions for video segments; alt text for image segments; text segments as real text.
- An obvious way out: close button, `Esc`, swipe down, and Back.

## 4. Carousels

- Native horizontal scrolling with `scroll-snap-type: x mandatory` on the track and `scroll-snap-align` on
  slides; visible Previous and Next buttons; a position indicator as text ("2 of 5").
- No autoplay. If a campaign insists, it pauses on hover and focus and has a visible pause button (2.2.2).
- The ARIA carousel pattern: a region with `aria-roledescription="carousel"` and a label; slides as groups
  with `aria-roledescription="slide"` and labels like "2 of 5".
- Swiping is never the only way to move (2.5.1).

## 5. Profiles

- Header: avatar, display name, handle, short bio, real counts (followers, posts) as text, the primary action
  (Follow or Message) within thumb reach, and secondary actions in a menu.
- Tabs for posts, media and other collections; the selected tab in the URL.
- States: private account, blocked, deactivated, no posts yet (on one's own profile: how to post the first
  one), and loading.
- Badges (verified, staff, creator) carry a text explanation of what they mean.
- Names come in every length, script and direction: truncate with the full name available, use `dir="auto"`,
  and test with long names, right-to-left names and emoji.

## 6. Creation flows

| Element | Rule |
|---|---|
| Drafts | Autosaved locally as the person types; restored after reload, crash or a failed upload |
| Audience | The audience (public, followers, a group, private) is visible and changeable before posting, not buried in settings |
| Media upload | Progress per file, retry on failure, cancel; aspect-ratio preview; heavy processing off the main thread |
| Alt text | A prompt to add a description for each image, skippable, editable later |
| Counters | Character counters with polite announcements near the limit, not on every keystroke |
| Preview | What followers will see, including the link preview |
| Publish | One primary action; the button shows pending state and cannot double-post |
| Undo window | Optional "Undo" for a few seconds after sending, with a visible countdown and a button reachable by keyboard |
| Edit and delete | Edited posts marked "Edited"; delete confirms with the consequence in words |

## 7. Sharing

- Use the Web Share API where it exists: `navigator.share({ title, text, url })`, called from a user gesture,
  feature-detected; for files, check `navigator.canShare({ files })` first.
- Fallback: "Copy link" (`navigator.clipboard.writeText`) with a confirmation in a polite status message.
- Link previews come from Open Graph tags (`og:title`, `og:description`, `og:image`); give every shareable
  page a specific preview image and text.
- Never gate content behind sharing; never append tracking parameters without saying so in the privacy
  information.

## 8. Discovery

- Search as an accessible combobox (ARIA Authoring Practices combobox pattern) with recent and suggested
  queries; results grouped by type (people, posts, topics).
- Explore grids reserve aspect ratios; masonry layouts that reorder visually must keep DOM order equal to
  reading order (1.3.2).
- Recommendations offer "Not interested" and "Why this?"; topics can be followed and muted.

## 9. Community

| Need | Build |
|---|---|
| Roles | Owner, moderator and member visible on names in context; permissions explained where they block an action |
| Rules | Group rules visible before joining and linked from the composer |
| Reporting | Short, categorised, confirmable; shows the report's status later; never public to the reported person |
| Blocking and muting | Immediate, quiet (no notification to the other person), reversible from settings |
| Moderation states | Pending review, removed (with the reason and how to appeal), limited; shown to the author, not just hidden |
| Joining and leaving | Leaving is as easy as joining and does not notify the group |

## 10. Messaging, events and commerce

| Surface | Must have |
|---|---|
| Messaging | Message grouping by sender and time; delivery states (sending, sent, failed with retry); read receipts and presence as user settings; real typing indicators only; `Enter` sends with `Shift+Enter` for a new line (or the reverse, configurable); new messages announced politely and summarised; the history scroller uses `overscroll-behavior: contain` and stays anchored at the bottom |
| Message requests | Messages from strangers land in a requests folder with preview, accept, delete and block |
| Events | Date, time and timezone; real capacity and attendee counts; RSVP states (going, maybe, not going) changeable; add to calendar as an `.ics` file; reminders opt-in |
| Social commerce | Product tags show price and availability in text; paid partnerships and ads labelled in words ("Paid partnership", "Ad"); real stock only; checkout handed to `studio-product` |

## 11. Thumb zones and ergonomics

| Zone (phone, one hand) | Put here | Avoid here |
|---|---|---|
| Bottom third | Primary actions, tab bar (3–5 labelled items), composer button, reply field | Destructive actions without confirmation |
| Middle | Content, secondary actions on cards | Tiny tap targets between scrolling content |
| Top corners | Rare actions (settings, close) | Frequent actions: they need a hand shift |

- Touch targets ≥ 44 px for primary actions, ≥ 24 px for everything (shared `accessibility.md`).
- Sheets and menus open from the bottom on phones; their actions are reachable without regripping.
- Respect safe areas (`env(safe-area-inset-bottom)` with `viewport-fit=cover`) so bars clear the home indicator.
- Landscape and tablets: do not stretch a phone column to full width; centre a readable column or add a rail.

## 12. Vertical media

- Reserve the aspect ratio (`aspect-ratio: 9 / 16`) before media loads; posters for every video.
- Inline playback: `muted`, `playsinline`, `preload="metadata"`, a poster; play when mostly visible, pause when
  scrolled away or when the tab is hidden; never autoplay with sound.
- Overlays (names, captions, action rail) need contrast against any frame: use a gradient scrim behind them.
- Captions on by default when muted autoplay is used; a visible captions toggle.
- Data saver (`navigator.connection?.saveData`, where supported) or a user setting: posters only until tapped.

## 13. Optimistic UI

Small, reversible actions (like, save, follow, vote, reorder) update immediately and reconcile later.

```tsx
'use client';
import { useOptimistic, useTransition } from 'react';

export function LikeButton({ liked, count, onToggle }: {
  liked: boolean; count: number; onToggle: (next: boolean) => Promise<void>;   // server action or fetch
}) {
  const [optimistic, setOptimistic] = useOptimistic({ liked, count });
  const [pending, startTransition] = useTransition();
  const toggle = () => startTransition(async () => {
    const next = !optimistic.liked;
    setOptimistic({ liked: next, count: optimistic.count + (next ? 1 : -1) });
    await onToggle(next);   // when this settles, the props must carry the server state; on failure they still
                            // hold the old state, so the button reverts: say why in a status message
  });
  return (
    <button type="button" aria-pressed={optimistic.liked} onClick={toggle} data-pending={pending || undefined}>
      Like <span className="count">{optimistic.count}</span>
    </button>
  );
}
```

- Send the final intended state with an idempotency key, not a "toggle" command, so retries and rapid taps
  converge.
- Debounce rapid toggles: the visual state flips every tap; the request carries only the last state.
- On failure, revert visibly and say why in a polite status message ("Couldn't like the post. Try again.").
- Reconcile counts with the server's value; never keep a locally inflated count.
- Queue actions while offline and mark them pending; do not pretend they were delivered.

## 14. Density

| Mode | Use | Notes |
|---|---|---|
| Media-first | Photo and video communities | One column on phones; media edge to edge; counts and actions compact |
| Text-first | Discussions, news, professional networks | Comfortable reading measure (45–75 characters); media thumbnails |
| Compact | Power users, moderation queues | Offer as a setting, never as the only mode |

## 15. Checklist

- [ ] Every surface has one job in the loop and one primary action.
- [ ] Feeds use the feed pattern, never push the reading position, and reach an end.
- [ ] Carousels and stories have buttons, text positions and pause controls; nothing advances by itself under
      reduced motion.
- [ ] The composer autosaves, shows the audience, prompts for alt text and cannot double-post.
- [ ] Sharing uses the native sheet where available, with a copy-link fallback; no share walls.
- [ ] Reporting, blocking, leaving and moderation states are designed, not left to defaults.
- [ ] Primary actions in the thumb zone; safe areas respected; 320 px and long-name tests done.
- [ ] Optimistic actions converge, roll back with a reason and never fake a count.
