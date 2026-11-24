# Ethics — participation people choose

Load at step 3 of every social build and again before the report. This file sets hard limits. The brief
wins on style; it does not win on deception. When a request conflicts with these rules, follow §8.

## 1. The tests

Apply all three to every mechanic that asks for attention, data or time.

1. **Informed agreement.** Would the person agree to this design if they understood exactly how it works?
2. **Whose goal.** Does it serve the person's goal, or only an engagement metric?
3. **Symmetry.** Is stopping, declining or leaving as easy as starting, accepting or joining?

A mechanic that fails any test is redesigned, not decorated.

## 2. Prohibited patterns

| Pattern | Examples | Build instead |
|---|---|---|
| Disguised content | Ads styled as posts without a label; sponsored results unmarked | "Ad" or "Paid partnership" in words on the item |
| Forced engagement | Like, share or follow to unlock content; invite five friends to continue | Content available on its own terms; sharing optional |
| Contact harvesting | Uploading the address book by default; inviting contacts automatically | Opt-in with a plain explanation; nothing sent without a per-message choice |
| Confirmshaming | "No thanks, I don't care about my friends" | Neutral options: "Not now" |
| Nagging | Re-asking for permissions or upgrades every session | Ask once in context; respect "No" for a stated period |
| Obstruction | Deleting an account takes a phone call; leaving a group needs five steps | Leaving and deleting as easy as joining; data export available |
| Fake social proof | Inflated counts; bots counted as people; invented "Ana and 12 others liked this" | Real counts or none (§3) |
| Fake activity | Notifications about activity that did not happen; fake "typing…"; fake viewers | Notifications only for real events (§6) |
| Fake urgency or scarcity | Countdowns that reset; "only 2 left" when untrue; "your story expires" pressure | Real deadlines and real stock, stated plainly |
| Streak and loss pressure | Threats that a streak or status will be lost; guilt messages | Optional streaks with freezes; no loss messaging |
| Variable-reward traps | Slot-machine refreshes; random rewards for opening the app | Predictable, chronological or explainable ranking |
| Default oversharing | Public by default for sensitive data; location on; "suggest me to contacts" on | The privacy defaults in §5 |
| Unequal consent choices | A large "Accept" and a hidden "Reject"; a cookie wall with no real choice | Equal-weight choices, the same number of steps |
| Infinite autoplay without control | Next video starts with no off switch; feeds with no end | §4 |

## 3. Counts, presence and social proof

- Counts are real, reconciled with the server, and never inflated. Rounding is honest ("1.2k" for 1,234),
  inflation is not. Show "—" or nothing when a count is unknown.
- Bots, test accounts and paid actions are not counted as people; if they participate, they are labelled.
- "Live", "online now", "typing…" and viewer counts appear only when driven by real presence events.
- A ticking number driven by a random function is a lie, whatever the brief says. `number-ticker` may animate
  to a real value once.
- Offer "Hide like counts" as a setting where counts drive comparison and pressure.
- Sample content in demos and prototypes is visibly labelled `Sample content`; it never imitates real people,
  brands or creators.

## 4. Autoplay, feeds and time well spent

- **Autoplay:** muted only; a visible pause control; off under reduced motion and data saver; a setting to
  turn it off entirely.
- **Autoplay-next:** shows what is next with a visible countdown and a Cancel button; can be turned off; off
  by default where the audience may include children.
- **Feeds end.** "You're up to date" when everything new has been seen. Anything after it is clearly marked
  as suggested, separated, and easy to leave.
- **Time-well-spent affordances** to offer (choose what fits the product, and let people opt in):

| Affordance | What it does |
|---|---|
| Caught-up marker | Ends the new-content portion of a feed |
| Chronological feed option | Removes the ranking for people who want it |
| Mute and snooze | Hides people or topics for a period, quietly |
| Notification digest | Batches activity into one message at a chosen time |
| Quiet hours | No notifications in a chosen window |
| Usage summary and break reminders | Shown only if the person turns them on |
| "Not interested" and "Why this?" | Control over recommendations, with an explanation |

## 5. Privacy defaults

| Setting | Default | Why |
|---|---|---|
| Who sees a new post | Visible and chosen in the composer before posting; the person's last explicit choice persists | No surprise audiences |
| Location on posts | Off; added per post | Location reveals home, school and routines |
| Photo metadata | Location (GPS) and device metadata stripped on upload | Images carry coordinates by default on many phones |
| Contact upload | Off; opt-in with an explanation of what is stored | Other people's data |
| Findable by email or phone | Off, or asked explicitly | Lets anyone with a number locate the account |
| Read receipts, online status, last seen | User-controlled; reciprocity explained | Social obligation pressure |
| Messages from strangers | Into a requests folder, not the inbox | Harassment and spam |
| Tags and mentions | Option to approve before they appear on the profile | Control over one's own profile |
| Data export and deletion | Available in settings, self-serve | Leaving must be possible |
| Ad personalisation | As the applicable law requires, and never pre-ticked | Consent must be real |

## 6. Notifications

- Separate controls by type: activity on my content, messages, people I follow, product news, promotions.
  Promotions are off unless the person turns them on.
- Never ask for notification permission on first launch. Ask in context, after the person does something a
  notification would help with, with a short explanation first; respect "Not now".
- Every notification reports a real event; no bait ("You have a new follower!" that leads to a suggestion).
- Batch and rate-limit; digests for high-volume activity; quiet hours honoured.
- Badges count real unread items and clear when read.
- Each notification offers a way to turn its type off.

## 7. Minors and vulnerable users

If the product may be used by children or teenagers, assume it is:

- High privacy by default: private accounts, no public location, no discoverability by contact details,
  messages from adult strangers off.
- No nudges to weaken privacy settings; no streaks, loss pressure or appearance-based rankings.
- Autoplay-next and infinite feeds off by default; time-management affordances on by default.
- Reporting and blocking prominent and simple.
- Tell the user that rules may apply: for example the EU Digital Services Act (which prohibits deceptive
  interface design on online platforms and requires protections for minors) and the UK Age Appropriate Design
  Code. This is not legal advice; recommend a legal review for products aimed at or likely used by children.

## 8. When the brief asks for a manipulative pattern

1. Say plainly, in one or two sentences, why you advise against it: trust, retention through goodwill, and,
   in many jurisdictions, consumer-protection and platform law.
2. Offer the honest equivalent from the tables above (real deadlines instead of resetting timers, digests
   instead of bait notifications, real counts instead of inflated ones).
3. Never build deception: fake counts, fake activity, fake reviews or testimonials, fake urgency or scarcity,
   disguised ads. These are refused even when requested.
4. For patterns that are aggressive but not deceptive (frequent prompts, prominent upsells), follow the user's
   decision after stating the concern, and record it in the report.

## 9. The checklist

The build passes only when every line holds. Report each line as pass, fail or not applicable, with one
phrase of evidence.

**Honesty**
- [ ] Every count, presence indicator, typing indicator and notification reflects a real event or value.
- [ ] Ads and paid partnerships are labelled in words on the item.
- [ ] No fake urgency, scarcity, streak pressure or invented social proof anywhere.
- [ ] Sample content is labelled and imitates no real person, brand or creator.

**Choice and control**
- [ ] No content is gated behind liking, sharing, following or inviting.
- [ ] Declining is neutral (no confirmshaming) and equal in weight and steps to accepting.
- [ ] Leaving a group, unfollowing, cancelling and deleting the account are as easy as joining.
- [ ] Autoplay is muted, pausable and switchable off; autoplay-next can be cancelled and turned off.
- [ ] Feeds have a caught-up point; suggested content after it is marked and separable.

**Privacy**
- [ ] The audience is visible before posting; defaults follow §5.
- [ ] Location, contact upload and discoverability are opt-in; photo location metadata is stripped.
- [ ] Read receipts and online status are user-controlled.

**Notifications**
- [ ] Permission is requested in context, never on first launch; "Not now" is respected.
- [ ] Notification types have separate controls; promotions are off by default; quiet hours or digests exist
      where volume is high.

**Minors (if applicable)**
- [ ] The defaults in §7 apply, and the user has been told that legal review is advisable.

**Wellbeing**
- [ ] At least the caught-up marker plus one other affordance from §4 is present, or the report explains why
      none fits.
