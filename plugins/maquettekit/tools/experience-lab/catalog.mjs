// @ts-check
/**
 * Experience Lab catalogue: dimensions, signals (measured / derived / agent), profiles, gates.
 *
 * Every number the scorer uses lives here so the scoring model is inspectable and is
 * copied verbatim into experience.json (`scoring`).
 *
 * Signal `source`:
 *   measured — read in headless Chromium by a browser probe (DOM, computed style, Performance APIs, input)
 *   derived  — computed by the tool from several measurements (cross-route comparison, normal vs reduced motion…)
 *   agent    — a rubric question the agent answers after inspecting screenshots / code (`maquettekit experience rubric`)
 *
 * Normalisers (raw → 0–1):
 *   share                       x clamped to 0–1
 *   linear {bad, good}          (x − bad) / (good − bad), clamped (works for "lower is better" when good < bad)
 *   plateau {lo0, lo1, hi1, hi0} 1 inside [lo1, hi1], linear down to 0 at lo0 / hi0
 *   scale {min, max}            agent 1–5 scale → (x − min) / (max − min)
 *   choice {map}                agent option → value (e.g. yes 1, partial 0.5, no 0)
 *   band <name>                 linear with {bad, good} taken from the selected profile (`PROFILES[p].bands[name]`)
 */

export const DIMENSIONS = [
  { id: 'discoverability', title: 'Discoverability', question: 'Can people find what they can do?' },
  { id: 'usability', title: 'Usability', question: 'Can people complete tasks easily?' },
  { id: 'visualFeedback', title: 'Visual feedback', question: 'Does every control respond visibly to hover, press and action?' },
  { id: 'navigationConsistency', title: 'Navigation consistency', question: 'Is navigation the same, labelled and orienting on every page?' },
  { id: 'touchInteraction', title: 'Touch interaction', question: 'Are touch targets large, spaced and gesture-free?' },
  { id: 'keyboardSupport', title: 'Keyboard support', question: 'Is everything operable, visible and orderly with a keyboard?' },
  { id: 'motionUsefulness', title: 'Motion usefulness', question: 'Does motion fit the profile, help, and respect user preferences?' },
  { id: 'cognitiveLoad', title: 'Cognitive load', question: 'Is each view focused, consistent and scannable?' },
  { id: 'loadingExperience', title: 'Loading experience', question: 'Does content appear quickly, with honest feedback while waiting?' },
  { id: 'perceivedPerformance', title: 'Perceived performance', question: 'Does the page respond instantly and stay stable?' },
  { id: 'interactionPredictability', title: 'Interaction predictability', question: 'Do controls behave as they look and as announced?' },
  { id: 'errorHandling', title: 'Error handling', question: 'Are errors prevented, explained and recoverable?' },
  { id: 'accessibility', title: 'Accessibility', question: 'Do automated accessibility checks pass (not an audit)?' },
  { id: 'spatialInteractionClarity', title: 'Spatial interaction clarity', question: 'Is a 3D/WebGL view understandable, operable without dragging, and safe to fail?', onlyWhen: '3d' },
];
export const DIMENSION_BY_ID = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d]));

const SCALE = { type: 'scale', min: 1, max: 5 };
const YES_PARTIAL_NO = { type: 'choice', map: { yes: 1, partial: 0.5, no: 0 } };

/**
 * @typedef {object} Signal
 * @property {string} id @property {string} dimension @property {'measured'|'derived'|'agent'} source
 * @property {string} title @property {string} [measure] what exactly is measured (measured/derived)
 * @property {string} [unit] unit of the raw value
 * @property {any} normalise @property {number | Record<string, number>} weight
 * @property {string} [gate] gate this signal feeds
 * @property {string} [viewports] which viewports are probed
 * @property {string} why @property {string} what recommendation headline @property {string} how fix guidance
 * @property {string} [prompt] agent question @property {string} [inspect] how the agent should answer
 * @property {Record<string,string>} [anchors] meaning of scale points
 */

/** @type {Signal[]} */
export const SIGNALS = [
  // ------------------------------------------------------------------ discoverability
  { id: 'discoverability.accessibleNames', dimension: 'discoverability', source: 'measured', title: 'Interactive elements with an accessible name', unit: 'share',
    measure: 'Share of visible interactive elements (links, buttons, inputs, ARIA widgets, tabindex ≥ 0) whose computed accessible name is non-empty (Chromium computedName; approximation when unavailable).',
    normalise: { type: 'linear', bad: 0.5, good: 1 }, weight: 3, viewports: 'all',
    why: 'Unnamed controls are invisible to screen-reader and voice-control users and are often unlabeled icons for everyone (WCAG 4.1.2, 2.5.3).',
    what: 'Give every control an accessible name that contains its visible label', how: 'Add visible text, or aria-label / aria-labelledby on icon-only controls; give inputs a <label>; give images inside links an alt.' },
  { id: 'discoverability.affordanceSemantics', dimension: 'discoverability', source: 'measured', title: 'Clickable-looking elements without control semantics', unit: 'count (worst page)',
    measure: 'Elements with cursor: pointer, an onclick attribute or a click listener that are not links/buttons/inputs, have no interactive role and do not wrap a real control.',
    normalise: { type: 'linear', bad: 5, good: 0 }, weight: 2, viewports: 'all',
    why: 'Fake controls look clickable but are not announced, not focusable and break expectations (a div with a click handler is a defect).',
    what: 'Replace clickable <div>/<span> elements with native <button> or <a href>', how: 'Use <button type="button"> for actions and <a href> for navigation; if a custom element is unavoidable add role, tabindex="0" and Enter/Space handling.' },
  { id: 'discoverability.linkDistinguishable', dimension: 'discoverability', source: 'measured', title: 'Inline links distinguishable from text', unit: 'share',
    measure: 'Share of links inside running text that differ from the surrounding text without hover: underline, border, background, weight, or ≥ 3:1 colour contrast against the text colour.',
    normalise: { type: 'share' }, weight: 2, viewports: 'primary',
    why: 'Links identified by colour alone are missed by many users (WCAG 1.4.1).',
    what: 'Make inline links visibly different from body text', how: 'Underline links in running text (text-decoration-thickness/offset can keep it refined); colour alone needs ≥ 3:1 against the text plus a non-colour cue on hover/focus.' },
  { id: 'discoverability.primaryActionVisible', dimension: 'discoverability', source: 'measured', title: 'A visible action above the fold', unit: 'share of pages',
    measure: 'Share of route × viewport pages with at least one button-like action (button or filled/bordered link) inside the first viewport.',
    normalise: { type: 'share' }, weight: 1, viewports: 'all',
    why: 'If nothing actionable is visible on arrival, people have to hunt for the next step.',
    what: 'Show the primary action in the first viewport', how: 'Place one clearly styled primary action near the headline on every viewport; keep secondary actions visibly subordinate.' },
  { id: 'discoverability.featuresObvious', dimension: 'discoverability', source: 'agent', title: 'Primary actions and features are obvious',
    prompt: 'Looking at the above-the-fold screenshots of each route, are the primary actions and key features obvious without hunting?',
    inspect: 'Open screenshots/<route>/<viewport>-fold.png for every route and viewport. Name the primary action you expect; is it the most prominent control? Are key features labelled rather than hidden behind icons or hover?',
    anchors: { 1: 'primary action unclear or hidden', 3: 'findable with some scanning', 5: 'obvious at a glance on every viewport' },
    normalise: SCALE, weight: 3,
    why: 'Measured signals see markup, not visual prominence; only a reviewer can judge what reads as the primary action.',
    what: 'Make the primary action and key features obvious at a glance', how: 'Raise the visual priority of the primary action (size, colour, position), label icon-only features, and remove competing decoration.' },

  // ------------------------------------------------------------------ usability
  { id: 'usability.formLabels', dimension: 'usability', source: 'measured', title: 'Form fields with a programmatic label', unit: 'share',
    measure: 'Share of visible inputs, selects and textareas labelled by <label>, aria-labelledby, aria-label or title. A placeholder alone does not count.',
    normalise: { type: 'share' }, weight: 3, viewports: 'primary',
    why: 'Placeholder-only fields lose their label as soon as people type and are poorly announced (WCAG 3.3.2, 1.3.1).',
    what: 'Give every form field a visible, associated label', how: 'Use <label for="id"> (or wrap the input); keep placeholders for examples only.' },
  { id: 'usability.bodyTextSize', dimension: 'usability', source: 'measured', title: 'Body text size', unit: 'px (character-weighted median, smallest page)',
    measure: 'Character-weighted median computed font size of visible text blocks (≥ 20 characters of own text); the smallest page value is used.',
    normalise: { type: 'linear', bad: 12, good: 16 }, weight: 2, viewports: 'all',
    why: 'Body copy below ~16px is tiring to read, especially on phones.',
    what: 'Set body text to at least 16px (1rem)', how: 'Use rem-based type tokens with a 16px+ base; keep small sizes for captions and meta only.' },
  { id: 'usability.lineLength', dimension: 'usability', source: 'measured', title: 'Line length of paragraphs', unit: 'characters per line (median)',
    measure: 'Median characters per line of visible paragraphs with ≥ 120 characters and ≥ 2 lines (text length ÷ rendered line count) on the primary viewport; line-clamped or truncated paragraphs are skipped.',
    normalise: { type: 'plateau', lo0: 25, lo1: 45, hi1: 80, hi0: 120 }, weight: 1, viewports: 'primary',
    why: 'Lines much longer than ~75 characters make it hard to find the next line; very short lines break reading rhythm.',
    what: 'Keep paragraphs between about 45 and 80 characters per line', how: 'Constrain text blocks with max-inline-size: 65ch (or a container token).' },
  { id: 'usability.noHorizontalScroll', dimension: 'usability', source: 'measured', title: 'No horizontal scrolling', unit: 'share of pages',
    measure: 'Share of route × viewport pages whose document is not wider than the viewport.',
    normalise: { type: 'share' }, weight: 2, viewports: 'all',
    why: 'Two-dimensional scrolling breaks reading on small screens and at zoom (WCAG 1.4.10).',
    what: 'Remove horizontal overflow at every viewport', how: 'Find the element wider than the viewport (see `maquettekit review run`), replace fixed widths with max-width: 100% / minmax(), and let flex children shrink (min-width: 0).' },
  { id: 'usability.taskFlow', dimension: 'usability', source: 'agent', title: 'Primary task flow',
    prompt: 'Can the primary task be completed in a short, obvious sequence of steps without dead ends?',
    inspect: 'Name the primary task. Walk it through the screenshots and code: count the steps, note anything that blocks, repeats input or leaves the user without a next step.',
    anchors: { 1: 'blocked or confusing', 3: 'completable with friction', 5: 'short, obvious, no dead ends' },
    normalise: SCALE, weight: 3,
    why: 'Task efficiency cannot be inferred from the DOM; it needs a walkthrough.',
    what: 'Shorten the primary task flow and remove dead ends', how: 'Cut steps and fields, keep the next action visible at each step, and preserve entered data across steps.' },
  { id: 'usability.copyClarity', dimension: 'usability', source: 'agent', title: 'Label and message clarity',
    prompt: 'Are labels, button texts and messages specific (verbs, plain language, no jargon)?',
    inspect: 'Read the button labels, headings, form labels and messages in the screenshots. Generic labels ("Submit", "Click here", "OK") and jargon lower the score.',
    anchors: { 1: 'generic or misleading', 3: 'mostly clear', 5: 'specific and plain everywhere' },
    normalise: SCALE, weight: 2,
    why: 'Specific verbs set expectations about what will happen next.',
    what: 'Rewrite generic labels as specific verbs', how: 'Name the outcome ("Send message", "Save changes"); explain errors in plain language; avoid internal terminology.' },

  // ------------------------------------------------------------------ visual feedback
  { id: 'visualFeedback.hoverStates', dimension: 'visualFeedback', source: 'measured', title: 'Visible hover state', unit: 'share of sampled controls',
    measure: 'Up to 8 controls per page are hovered with the mouse; share whose computed style (colour, background, border, shadow, decoration, outline, transform, opacity, filter, ::before/::after) changes.',
    normalise: { type: 'band', band: 'hoverCoverage' }, weight: 3, viewports: 'pointer (primary)',
    why: 'Hover feedback confirms what is interactive before people commit to a click.',
    what: 'Give every interactive control a visible hover state', how: 'Add :hover (inside @media (hover: hover)) colour, background or underline changes to buttons and links; expressive/immersive surfaces can add a small transform.' },
  { id: 'visualFeedback.activeStates', dimension: 'visualFeedback', source: 'measured', title: 'Visible pressed (:active) state', unit: 'share of sampled controls',
    measure: 'While the mouse button is held on each sampled control, share whose computed style changes again beyond the hover state.',
    normalise: { type: 'linear', bad: 0, good: 0.6 }, weight: 1, viewports: 'pointer (primary)',
    why: 'An immediate pressed state acknowledges input before any result arrives.',
    what: 'Add an immediate pressed (:active) state to buttons', how: 'Darken the fill or scale to ~0.97 on :active with no transition delay; keep the colour change under reduced motion.' },
  { id: 'visualFeedback.animatedFeedback', dimension: 'visualFeedback', source: 'measured', title: 'Smoothly transitioned feedback', unit: 'share of hover changes',
    measure: 'Share of the observed hover changes whose changed property is covered by a CSS transition with duration > 0.',
    normalise: { type: 'band', band: 'animatedFeedback' }, weight: { essential: 0, expressive: 1, immersive: 2 }, viewports: 'pointer (primary)',
    why: 'Expressive and immersive profiles expect polished, continuous state changes; Essential accepts instant ones (weight 0).',
    what: 'Transition hover and press feedback', how: 'Add transition: background-color, color, box-shadow, transform 120–200ms with a standard easing; never delay the response itself.' },
  { id: 'visualFeedback.stateFeedback', dimension: 'visualFeedback', source: 'agent', title: 'Feedback for every action',
    prompt: 'Does every action give visible feedback within ~100 ms (pressed, loading, success or failure), including on touch?',
    inspect: 'Trigger the main actions (or read their handlers): is there a pressed state, a loading state for slow work, and a visible success/failure result?',
    anchors: { 1: 'actions often give no feedback', 3: 'feedback for most actions', 5: 'immediate, complete feedback everywhere' },
    normalise: SCALE, weight: 3,
    why: 'Only part of feedback (hover/press styles) can be measured generically; results and loading states need a walkthrough.',
    what: 'Give every action an immediate response and a visible result', how: 'Show pressed state on input, a loading state (aria-busy, disabled repeat) for slow work, and a success/failure message in a live region.' },

  // ------------------------------------------------------------------ navigation consistency
  { id: 'navigationConsistency.navLandmark', dimension: 'navigationConsistency', source: 'measured', title: 'Navigation landmark present', unit: 'share of routes',
    measure: 'Share of routes with a <nav> / role="navigation" landmark containing at least two links.',
    normalise: { type: 'share' }, weight: 2, viewports: 'primary',
    why: 'A navigation landmark lets assistive-technology users jump to navigation and signals structure to everyone (WCAG 1.3.1).',
    what: 'Wrap primary navigation in a <nav> landmark', how: 'Use <nav aria-label="Primary"> around the main links; label additional navs distinctly.' },
  { id: 'navigationConsistency.navConsistency', dimension: 'navigationConsistency', source: 'derived', title: 'Same navigation items and order across routes', unit: 'similarity 0–1',
    measure: 'Mean pairwise similarity of the destinations in navigation landmarks (outside <main>) between routes: Jaccard overlap × agreement of relative order. Needs ≥ 2 routes.',
    normalise: { type: 'share' }, weight: 3, viewports: 'primary',
    why: 'Navigation that changes between pages forces people to re-learn it (WCAG 3.2.3 Consistent Navigation).',
    what: 'Use the same navigation items in the same order on every page', how: 'Render navigation from one shared component/data source; mark the current page instead of removing or reordering items.' },
  { id: 'navigationConsistency.currentPage', dimension: 'navigationConsistency', source: 'measured', title: 'Current page marked in navigation', unit: 'share of routes',
    measure: 'On routes where a navigation link points to the current page, share where that link carries aria-current.',
    normalise: { type: 'share' }, weight: 1, viewports: 'primary',
    why: 'People need to know where they are; aria-current exposes it to assistive technology too.',
    what: 'Mark the current page in navigation with aria-current="page"', how: 'Set aria-current="page" on the active link and style [aria-current] distinctly (not by colour alone).' },
  { id: 'navigationConsistency.pageTitles', dimension: 'navigationConsistency', source: 'derived', title: 'Unique, non-empty page titles', unit: 'share of routes',
    measure: 'Share of routes whose <title> is non-empty and not shared with another assessed route.',
    normalise: { type: 'share' }, weight: 1, viewports: 'primary',
    why: 'Titles identify tabs, history entries and are announced first on navigation (WCAG 2.4.2).',
    what: 'Give every page a unique, descriptive <title>', how: 'Use "Page – Site" titles generated per route.' },
  { id: 'navigationConsistency.wayfinding', dimension: 'navigationConsistency', source: 'agent', title: 'Wayfinding',
    prompt: 'Can people always tell where they are and how to get back (active state, breadcrumbs, back links, page headings)?',
    inspect: 'Compare the routes in the screenshots: is the current location visible, is there a consistent way back up or home?',
    anchors: { 1: 'easy to get lost', 3: 'location mostly clear', 5: 'always oriented' },
    normalise: SCALE, weight: 2,
    why: 'Orientation cues are visual and contextual.',
    what: 'Make the current location and the way back obvious', how: 'Show an active navigation state, page headings that match the link text, and breadcrumbs or back links for deep pages.' },

  // ------------------------------------------------------------------ touch interaction
  { id: 'touchInteraction.targetSize24', dimension: 'touchInteraction', source: 'measured', title: 'Targets ≥ 24×24 CSS px (or spaced)', unit: 'share of targets', gate: 'targetSize',
    measure: 'On touch viewports, share of visible interactive targets that are ≥ 24×24 CSS px or whose centred 24px box does not touch another target. Inline text links and default checkboxes/radios are exempt (WCAG 2.5.8 exceptions).',
    normalise: { type: 'linear', bad: 0.8, good: 1 }, weight: 3, viewports: 'touch',
    why: 'Small, crowded targets cause mis-taps for everyone and block people with motor impairments (WCAG 2.5.8, AA).',
    what: 'Make every touch target at least 24×24 CSS px (44×44 for primary actions)', how: 'Increase padding or min-height/min-width on the listed controls, or space them so a 24px circle around each does not overlap a neighbour.' },
  { id: 'touchInteraction.targetSize44', dimension: 'touchInteraction', source: 'measured', title: 'Targets ≥ 44×44 CSS px', unit: 'share of targets',
    measure: 'On touch viewports, share of non-inline interactive targets that are at least 44×44 CSS px (Maquettekit touch default; WCAG 2.5.5 AAA).',
    normalise: { type: 'share' }, weight: 2, viewports: 'touch',
    why: '44px targets are comfortably hit with a thumb.',
    what: 'Grow touch targets toward 44×44 CSS px', how: 'Use min-height: 44px and enough horizontal padding on buttons, nav links and icon buttons under @media (pointer: coarse).' },
  { id: 'touchInteraction.targetSpacing', dimension: 'touchInteraction', source: 'measured', title: 'Spacing between targets', unit: 'share of targets',
    measure: 'On touch viewports, share of targets whose nearest neighbouring target is at least 8 CSS px away (edge to edge).',
    normalise: { type: 'share' }, weight: 1, viewports: 'touch',
    why: 'Adjacent targets without a gap invite accidental activation of the neighbour.',
    what: 'Leave at least 8px between adjacent touch targets', how: 'Use gap on flex/grid groups of links and buttons instead of packing them edge to edge.' },
  { id: 'touchInteraction.zoomAllowed', dimension: 'touchInteraction', source: 'measured', title: 'Pinch-zoom not disabled', unit: 'share of routes', gate: 'zoom',
    measure: 'Share of routes whose viewport meta neither sets user-scalable=no/0 nor maximum-scale below 2.',
    normalise: { type: 'share' }, weight: 1, viewports: 'all',
    why: 'Disabling zoom takes control away from people who need larger text (WCAG 1.4.4).',
    what: 'Allow pinch-zoom', how: 'Use <meta name="viewport" content="width=device-width, initial-scale=1"> without user-scalable or maximum-scale.' },
  { id: 'touchInteraction.gestureAlternatives', dimension: 'touchInteraction', source: 'agent', title: 'Single-pointer alternatives for gestures',
    prompt: 'Do drag, swipe and pinch interactions have single-pointer (tap/button) alternatives (WCAG 2.5.1, 2.5.7)?',
    inspect: 'List every drag/swipe/pinch interaction in the code (carousels, sliders, sortable lists, maps, 3D orbit). Is there a button, stepper or tap alternative for each? Answer "na" if there are none.',
    normalise: YES_PARTIAL_NO, weight: 2,
    why: 'Gesture alternatives are not detectable automatically.',
    what: 'Add button alternatives for drag, swipe and pinch', how: 'Pair carousels with previous/next buttons, sliders with steppers, sortable lists with move buttons and 3D orbit with rotate/zoom buttons.' },

  // ------------------------------------------------------------------ keyboard support
  { id: 'keyboardSupport.reachable', dimension: 'keyboardSupport', source: 'measured', title: 'Interactive elements reachable by Tab', unit: 'share', gate: 'keyboard',
    measure: 'Tab walk (≤ 40 stops) on the primary viewport: 1 − (interactive elements that cannot take focus + focusable elements never reached) ÷ all of them. Elements flagged only by cursor: pointer are reported under discoverability instead.',
    normalise: { type: 'linear', bad: 0.7, good: 1 }, weight: 3, viewports: 'primary',
    why: 'Everything operable with a pointer must be operable with a keyboard (WCAG 2.1.1).',
    what: 'Make every interactive element reachable and operable with the keyboard', how: 'Use native <button>/<a href>; custom widgets need tabindex="0", a role and Enter/Space handlers. Never put interactive content inside aria-hidden or inert regions.' },
  { id: 'keyboardSupport.noTrap', dimension: 'keyboardSupport', source: 'measured', title: 'No keyboard trap', unit: 'boolean', gate: 'keyboard',
    measure: 'During the Tab walk, focus never got stuck on one element or cycled inside a subset of the page.',
    normalise: { type: 'share' }, weight: 2, viewports: 'primary',
    why: 'A keyboard trap makes the rest of the page unusable (WCAG 2.1.2).',
    what: 'Remove the keyboard trap', how: 'Let Tab leave every widget; only modal dialogs contain focus, and they close on Escape.' },
  { id: 'keyboardSupport.focusVisible', dimension: 'keyboardSupport', source: 'measured', title: 'Visible focus indicator', unit: 'share of tab stops', gate: 'focusVisible',
    measure: 'Share of tab stops whose computed style (outline, box-shadow, border, background, colour, decoration) changes on focus, confirmed by a focused-vs-blurred screenshot diff when styles are unchanged.',
    normalise: { type: 'linear', bad: 0.5, good: 1 }, weight: 3, viewports: 'primary',
    why: 'Keyboard users must see where focus is (WCAG 2.4.7).',
    what: 'Give every focusable element a visible focus indicator', how: 'Add :focus-visible { outline: 2px solid <focus colour>; outline-offset: 2px } and never remove outline without a replacement of ≥ 3:1 contrast.' },
  { id: 'keyboardSupport.tabOrder', dimension: 'keyboardSupport', source: 'derived', title: 'Tab order follows visual order', unit: 'share of transitions',
    measure: 'Share of consecutive tab stops that move forward in reading order (down the page, or right within the same row), from the stops\' document positions.',
    normalise: { type: 'linear', bad: 0.6, good: 1 }, weight: 2, viewports: 'primary',
    why: 'Focus that jumps around the page is disorienting (WCAG 2.4.3, 1.3.2).',
    what: 'Make the tab order follow the visual order', how: 'Order the DOM like the layout, avoid positive tabindex, and do not reorder interactive content with CSS order or absolute positioning.' },
  { id: 'keyboardSupport.skipLink', dimension: 'keyboardSupport', source: 'measured', title: 'Skip link', unit: 'share of routes',
    measure: 'Share of routes whose first tab stop is a same-page link to an existing target (e.g. #main).',
    normalise: { type: 'share' }, weight: 1, viewports: 'primary',
    why: 'A skip link saves keyboard users from tabbing through the header on every page (WCAG 2.4.1).',
    what: 'Add a "Skip to content" link as the first focusable element', how: 'Put <a class="skip" href="#main">Skip to content</a> first in <body>; show it on focus.' },
  { id: 'keyboardSupport.popupKeyboard', dimension: 'keyboardSupport', source: 'measured', title: 'Menus, dialogs and disclosures work with the keyboard', unit: 'share of checks passed',
    measure: 'Up to 3 auto-discovered triggers ([aria-haspopup], [aria-expanded], popover/dialog buttons) per page are activated with Enter. Checks: opens with Enter; for menus/dialogs focus moves inside, Escape closes and focus returns to the trigger.',
    normalise: { type: 'share' }, weight: 2, viewports: 'primary',
    why: 'Overlays that cannot be opened, entered or closed from the keyboard strand keyboard users.',
    what: 'Make menus and dialogs keyboard operable', how: 'Open on Enter/Space, move focus into the menu or dialog, close on Escape and return focus to the trigger (native <dialog>.showModal() does most of this).' },
  { id: 'keyboardSupport.widgetKeys', dimension: 'keyboardSupport', source: 'agent', title: 'Arrow-key models in composite widgets',
    prompt: 'Do composite widgets (menus, tabs, sliders, carousels, listboxes, 3D views) follow the expected arrow-key model?',
    inspect: 'For each composite widget in the code, check the ARIA Authoring Practices keyboard model (arrows, Home/End, Escape). Answer "na" if the site has none.',
    normalise: YES_PARTIAL_NO, weight: 1,
    why: 'The Tab walk only covers Tab; arrow-key behaviour inside widgets needs inspection.',
    what: 'Implement the standard arrow-key model in composite widgets', how: 'Follow the ARIA Authoring Practices pattern for each widget (roving tabindex or aria-activedescendant).' },

  // ------------------------------------------------------------------ motion usefulness
  { id: 'motionUsefulness.reducedMotion', dimension: 'motionUsefulness', source: 'derived', title: 'Reduced-motion preference honoured', unit: 'violations (count)', gate: 'reducedMotion',
    measure: 'Each page is loaded twice (prefers-reduced-motion: no-preference / reduce). Violations under reduce: spatial (transform/position/size) animations > 100 ms or infinite loops still running or played, plus continuous pixel change across two 400 ms windows (whole view or 3D canvas).',
    normalise: { type: 'linear', bad: 3, good: 0 }, weight: 4, viewports: 'all',
    why: 'Motion can trigger vestibular symptoms; under reduced motion decorative motion must stop and transitions become short fades (Maquettekit gate; WCAG 2.3.3).',
    what: 'Honour prefers-reduced-motion for every animation', how: 'Wrap motion in @media (prefers-reduced-motion: no-preference) or neutralise it under (reduce); in JS check matchMedia("(prefers-reduced-motion: reduce)") and render a static frame for canvas/WebGL loops.' },
  { id: 'motionUsefulness.pauseControl', dimension: 'motionUsefulness', source: 'derived', title: 'Auto-playing motion can be paused', unit: 'boolean', gate: 'userControl',
    measure: '1 when no large auto-playing motion was observed (infinite or > 5 s animations on elements ≥ 4000 px², or a view/canvas still changing several seconds after load), or when a visible pause/stop/reduce-motion control exists; else 0.',
    normalise: { type: 'share' }, weight: 2, viewports: 'all',
    why: 'Anything that moves by itself for more than five seconds needs a pause, stop or hide control (WCAG 2.2.2; Maquettekit gate 2).',
    what: 'Add a visible pause control for auto-playing motion', how: 'Provide a "Pause animations" button (aria-pressed) that stops ambient CSS loops and canvas/WebGL render loops, or stop the motion after 5 s.' },
  { id: 'motionUsefulness.infiniteLoops', dimension: 'motionUsefulness', source: 'measured', title: 'Infinite animation loops', unit: 'count (worst page)',
    measure: 'Distinct infinite CSS/WAAPI animations running on visible elements in normal motion.',
    normalise: { type: 'band', band: 'infiniteLoops' }, weight: { essential: 3, expressive: 2, immersive: 1 }, viewports: 'all',
    why: 'Ambient loops compete with content; Essential surfaces should have none, Expressive very few.',
    what: 'Remove or reduce ambient animation loops', how: 'Keep loops only for loading indicators; make decorative loops finite, slower, pausable, or remove them on working surfaces.' },
  { id: 'motionUsefulness.longestAnimation', dimension: 'motionUsefulness', source: 'measured', title: 'Longest single animation', unit: 'ms (worst page)',
    measure: 'Longest duration of a finite CSS animation/transition or Web Animation observed at load and after settling (normal motion).',
    normalise: { type: 'band', band: 'longestAnimationMs' }, weight: 2, viewports: 'all',
    why: 'Long transitions make interfaces feel slow; the acceptable ceiling depends on the profile.',
    what: 'Shorten long animations to the profile\'s ceiling', how: 'Use the motion duration tokens for the profile (Essential ≈ 250 ms, Expressive ≤ 560 ms, Immersive ≤ 900 ms outside skippable sequences).' },
  { id: 'motionUsefulness.concurrency', dimension: 'motionUsefulness', source: 'measured', title: 'Simultaneous animations', unit: 'count (worst page)',
    measure: 'Distinct animations (by name; a staggered list counts once) running on visible elements at the same moment right after load.',
    normalise: { type: 'band', band: 'concurrentAnimations' }, weight: 2, viewports: 'all',
    why: 'Many simultaneous motions split attention; each profile has a budget (Essential 1, Expressive 3, Immersive 6).',
    what: 'Stagger or remove simultaneous animations', how: 'Sequence entrance motion into one orchestrated move; remove ambient motion running alongside it.' },
  { id: 'motionUsefulness.purpose', dimension: 'motionUsefulness', source: 'agent', title: 'Motion has a purpose',
    prompt: 'Does each animation explain a change, guide attention or give feedback, rather than decorate?',
    inspect: 'List the animations (see the motion evidence in experience.md and the CSS/JS). For each, name the change it explains. Decorative motion lowers the score, more so for Essential.',
    anchors: { 1: 'mostly decorative or distracting', 3: 'mixed', 5: 'every animation explains or confirms something' },
    normalise: SCALE, weight: 3,
    why: 'Purpose is a judgement call no measurement captures.',
    what: 'Keep only motion that explains, guides or confirms', how: 'Remove decorative loops and reveals; tie each remaining animation to a state change or user action.' },
  { id: 'motionUsefulness.skippable', dimension: 'motionUsefulness', source: 'agent', title: 'Sequences are skippable; scroll is not hijacked',
    prompt: 'Can intros and scripted sequences be skipped, and is native scrolling never hijacked?',
    inspect: 'Look for intro sequences, pinned/scrubbed sections and smooth-scroll libraries. Is there a skip control? Does the wheel/touch scroll at native speed? Answer "na" if there are none.',
    normalise: YES_PARTIAL_NO, weight: { essential: 0.5, expressive: 1, immersive: 2 },
    why: 'Scroll-jacking and unskippable sequences take control from the user (Maquettekit gate 2).',
    what: 'Make sequences skippable and keep native scrolling', how: 'Add a skip control to intros, give pinned sections an escape, and drop scroll-hijacking libraries.' },

  // ------------------------------------------------------------------ cognitive load
  { id: 'cognitiveLoad.fontSizes', dimension: 'cognitiveLoad', source: 'measured', title: 'Distinct font sizes', unit: 'count (worst page)',
    measure: 'Distinct computed font sizes (rounded to 1px) among visible text.',
    normalise: { type: 'linear', bad: 14, good: 6 }, weight: 2, viewports: 'primary',
    why: 'A small, consistent type scale makes hierarchy legible at a glance.',
    what: 'Consolidate font sizes into a small type scale', how: 'Replace one-off sizes with the type-scale tokens (6–8 steps).' },
  { id: 'cognitiveLoad.textColors', dimension: 'cognitiveLoad', source: 'measured', title: 'Distinct text colours', unit: 'count (worst page)',
    measure: 'Distinct computed text colours (quantised to 32 levels per channel) among visible text.',
    normalise: { type: 'linear', bad: 14, good: 5 }, weight: 1, viewports: 'primary',
    why: 'Many text colours read as noise and weaken the meaning of the ones that matter.',
    what: 'Reduce the number of text colours', how: 'Use the colour roles (text, muted, primary, semantic) instead of ad-hoc colours.' },
  { id: 'cognitiveLoad.competingActions', dimension: 'cognitiveLoad', source: 'measured', title: 'Competing actions above the fold', unit: 'count (worst page)',
    measure: 'Prominent actions inside the first viewport: filled buttons or button-like links (≥ 2000 px²) whose fill stands out from the background behind them. Ghost, chip and text buttons are not counted.',
    normalise: { type: 'linear', bad: 8, good: 3 }, weight: 2, viewports: 'all',
    why: 'More than a few prominent actions in one view dilutes the primary one.',
    what: 'Limit the first view to one primary and a few secondary actions', how: 'Demote extra actions to links or menus; keep one visually primary action per view.' },
  { id: 'cognitiveLoad.wordsAboveFold', dimension: 'cognitiveLoad', source: 'measured', title: 'Words above the fold', unit: 'words (worst page)',
    measure: 'Words of visible text rendered inside the first viewport.',
    normalise: { type: 'linear', bad: 450, good: 150 }, weight: 1, viewports: 'all',
    why: 'Dense first views are skimmed, not read.',
    what: 'Cut the text in the first view', how: 'Lead with one headline and a short lede; move detail below or behind progressive disclosure.' },
  { id: 'cognitiveLoad.headingStructure', dimension: 'cognitiveLoad', source: 'measured', title: 'Heading structure', unit: 'score 0–1 (mean of routes)',
    measure: 'Per route: 0.5 for exactly one <h1>, 0.5 for no skipped heading levels; mean over routes.',
    normalise: { type: 'share' }, weight: 2, viewports: 'primary',
    why: 'A clean heading outline lets people (and screen readers) scan the page (WCAG 1.3.1, 2.4.6).',
    what: 'Use one h1 and headings that descend without skipping levels', how: 'Pick heading levels by structure, not size; style sizes with classes.' },
  { id: 'cognitiveLoad.hierarchy', dimension: 'cognitiveLoad', source: 'agent', title: 'Clear visual hierarchy',
    prompt: 'Is there one clear focal point per view, with secondary content visibly subordinate?',
    inspect: 'Squint at each fold screenshot: what draws the eye first, second, third? Competing focal points lower the score.',
    anchors: { 1: 'no clear focal point', 3: 'mostly clear', 5: 'one obvious focal point everywhere' },
    normalise: SCALE, weight: 3,
    why: 'Visual hierarchy is perceptual; only a reviewer can judge it.',
    what: 'Establish one focal point per view', how: 'Increase contrast and size of the main element, reduce emphasis on everything else, group related items.' },
  { id: 'cognitiveLoad.progressiveDisclosure', dimension: 'cognitiveLoad', source: 'agent', title: 'Progressive disclosure',
    prompt: 'Is complexity revealed progressively (sensible defaults, no wall of options)?',
    inspect: 'Look for long forms, settings, filters and option lists. Are advanced options hidden until needed, with sensible defaults?',
    anchors: { 1: 'everything at once', 3: 'some grouping', 5: 'only what is needed, when needed' },
    normalise: SCALE, weight: 2,
    why: 'How much is shown at once is a design decision visible only in context.',
    what: 'Reveal advanced options progressively', how: 'Default the common case, group options, and move rarely used settings behind disclosure.' },

  // ------------------------------------------------------------------ loading experience
  { id: 'loadingExperience.fcp', dimension: 'loadingExperience', source: 'measured', title: 'First Contentful Paint (lab)', unit: 'ms (worst page)',
    measure: 'PerformanceObserver "paint" first-contentful-paint, headless Chromium on loopback, no throttling (lab, not field).',
    normalise: { type: 'linear', bad: 3000, good: 1800 }, weight: 2, viewports: 'all',
    why: 'Fast first paint reassures people the page is coming (web.dev: good ≤ 1.8 s, poor > 3 s; field thresholds).',
    what: 'Paint the first content sooner', how: 'Inline critical CSS, defer non-critical JS, avoid render-blocking fonts and server work before the first byte.' },
  { id: 'loadingExperience.lcp', dimension: 'loadingExperience', source: 'measured', title: 'Largest Contentful Paint (lab)', unit: 'ms (worst page)',
    measure: 'PerformanceObserver "largest-contentful-paint" (last candidate before input), headless Chromium on loopback (lab, not field).',
    normalise: { type: 'linear', bad: 4000, good: 2500 }, weight: 3, viewports: 'all',
    why: 'LCP approximates when the main content is visible (good ≤ 2.5 s, poor > 4 s at the 75th percentile in the field).',
    what: 'Show the main content sooner (LCP)', how: 'Do not lazy-load or hide the LCP element behind JS/entrance animations; preload the hero image with fetchpriority="high"; reduce blocking work.' },
  { id: 'loadingExperience.loadingFeedback', dimension: 'loadingExperience', source: 'derived', title: 'Loading feedback for deferred content', unit: 'share of pages',
    measure: 'Visible text sampled every 100 ms from navigation start. Pages whose text grows by ≥ 80 characters and ≥ 15 % more than 300 ms after first paint have deferred content; share of those that showed aria-busy, a progressbar or a skeleton/spinner before it arrived.',
    normalise: { type: 'share' }, weight: 3, viewports: 'all',
    why: 'Blank regions that fill in later look broken; skeletons and progress set expectations.',
    what: 'Show a skeleton or progress indicator while content loads', how: 'Render a same-size skeleton (or progress for long waits) in the region and set aria-busy="true" until the content arrives.' },
  { id: 'loadingExperience.mediaReserved', dimension: 'loadingExperience', source: 'measured', title: 'Space reserved for media', unit: 'share of media',
    measure: 'Share of <img>, <video> and <iframe> elements whose computed aspect-ratio is set (width/height attributes or CSS aspect-ratio).',
    normalise: { type: 'share' }, weight: 1, viewports: 'primary',
    why: 'Media without reserved space shifts the layout when it loads.',
    what: 'Reserve space for every image, video and embed', how: 'Add width and height attributes (or CSS aspect-ratio) to all media.' },
  { id: 'loadingExperience.perceivedWait', dimension: 'loadingExperience', source: 'agent', title: 'Waits are explained',
    prompt: 'During waits over ~1 s (navigation, submission, data loading), is there a progress indicator or a skeleton that matches the final layout?',
    inspect: 'Find async operations in the code (fetches, route transitions, submissions). Is each wait covered by a skeleton, spinner in the triggering control, or progress? Answer "na" if there are no waits.',
    normalise: YES_PARTIAL_NO, weight: 2,
    why: 'The lab run only sees the initial load; other waits need inspection.',
    what: 'Cover every wait over ~1 s with progress or a skeleton', how: 'Keep the triggering control\'s label, show an inline spinner, set aria-busy, and explain waits longer than ~4 s.' },

  // ------------------------------------------------------------------ perceived performance
  { id: 'perceivedPerformance.inputLatency', dimension: 'perceivedPerformance', source: 'measured', title: 'Input to next paint (lab)', unit: 'ms (worst page)',
    measure: 'A safe sample control (disclosure toggle or type="button" outside forms) is clicked twice; Event Timing duration for the interaction, or pointer timestamp → first frame after handlers (rAF + task) when below the 16 ms Event Timing threshold. Headless, unthrottled (lab).',
    normalise: { type: 'band', band: 'inputLatencyMs' }, weight: 3, viewports: 'primary',
    why: 'Feedback must paint on the next frame; long handlers make interfaces feel broken (INP good ≤ 200 ms in the field).',
    what: 'Paint feedback before doing slow work in event handlers', how: 'Update the UI first, then yield (requestAnimationFrame + setTimeout / scheduler.yield()) before heavy work; move heavy work off the main thread.' },
  { id: 'perceivedPerformance.blockingTime', dimension: 'perceivedPerformance', source: 'derived', title: 'Main-thread blocking (TBT estimate, lab)', unit: 'ms (worst page)',
    measure: 'Sum over long tasks (PerformanceObserver "longtask") after First Contentful Paint and within ~3 s of load of (duration − 50 ms).',
    normalise: { type: 'linear', bad: 600, good: 200 }, weight: 3, viewports: 'all',
    why: 'Long tasks block input while the page looks ready.',
    what: 'Break up long main-thread tasks during load', how: 'Split bundles, defer non-critical scripts, yield in long loops, and move heavy work to workers.' },
  { id: 'perceivedPerformance.layoutShift', dimension: 'perceivedPerformance', source: 'measured', title: 'Cumulative Layout Shift (lab)', unit: 'CLS (worst page)',
    measure: 'Largest session window of layout-shift entries without recent input, during load and ~1.5 s after.',
    normalise: { type: 'linear', bad: 0.25, good: 0.1 }, weight: 2, viewports: 'all',
    why: 'Content that jumps causes mis-clicks and lost reading position (good ≤ 0.1, poor > 0.25).',
    what: 'Stop content from shifting during load', how: 'Reserve space for late content (skeletons, min-height, media dimensions) and never insert banners above existing content.' },
  { id: 'perceivedPerformance.layoutAnimations', dimension: 'perceivedPerformance', source: 'measured', title: 'Layout-property animations', unit: 'distinct properties',
    measure: 'Distinct layout-triggering properties (width, height, top, left, margin, padding, …) animated or declared in transitions across pages.',
    normalise: { type: 'linear', bad: 3, good: 0 }, weight: 1, viewports: 'all',
    why: 'Animating layout properties re-runs layout every frame and janks on real devices.',
    what: 'Animate transform and opacity instead of layout properties', how: 'Replace width/height/top/left animations with transform (FLIP), clip-path or the grid-template-rows 0fr → 1fr technique.' },
  { id: 'perceivedPerformance.domSize', dimension: 'perceivedPerformance', source: 'measured', title: 'DOM size', unit: 'elements (worst page)',
    measure: 'Number of elements in the document.',
    normalise: { type: 'linear', bad: 3000, good: 800 }, weight: 1, viewports: 'primary',
    why: 'Large DOMs make style recalculation, layout and interaction slower.',
    what: 'Reduce DOM size', how: 'Virtualise long lists, render off-screen sections lazily, and remove wrapper elements.' },
  { id: 'perceivedPerformance.responsiveness', dimension: 'perceivedPerformance', source: 'agent', title: 'Instant-feeling frequent actions',
    prompt: 'Do frequent actions respond instantly (optimistic updates), with slow work deferred behind feedback?',
    inspect: 'Read the handlers of the most frequent actions (toggle, add, like, filter, navigate). Is the UI updated before network or heavy work completes?',
    anchors: { 1: 'actions wait on the network', 3: 'some instant feedback', 5: 'frequent actions feel instant' },
    normalise: SCALE, weight: 2,
    why: 'Optimistic UI and deferral are code-level decisions the lab cannot exercise.',
    what: 'Make frequent actions optimistic', how: 'Update the UI immediately, reconcile with the server afterwards, and show failures with an undo/retry.' },

  // ------------------------------------------------------------------ interaction predictability
  { id: 'interactionPredictability.expandedState', dimension: 'interactionPredictability', source: 'measured', title: 'Announced state matches what is shown', unit: 'share of triggers',
    measure: 'For auto-discovered triggers with aria-expanded / aria-controls: after activation, aria-expanded is "true" and the controlled region is visible (and vice versa).',
    normalise: { type: 'share' }, weight: 2, viewports: 'primary',
    why: 'Controls that announce one state and show another mislead assistive-technology users (WCAG 4.1.2).',
    what: 'Keep aria-expanded in sync with what is shown', how: 'Toggle aria-expanded in the same handler that shows/hides the region, and point aria-controls at it.' },
  { id: 'interactionPredictability.linkSemantics', dimension: 'interactionPredictability', source: 'measured', title: 'Links used as buttons', unit: 'count (worst page)',
    measure: 'Visible links with href="#" or javascript:, and <a> elements without href that have click handlers.',
    normalise: { type: 'linear', bad: 5, good: 0 }, weight: 2, viewports: 'all',
    why: 'Links that do not navigate break expectations (middle-click, open in new tab, announced as link).',
    what: 'Use buttons for actions and links for navigation', how: 'Replace href="#"/javascript: links with <button type="button">.' },
  { id: 'interactionPredictability.newWindowWarning', dimension: 'interactionPredictability', source: 'measured', title: 'New-window links are announced', unit: 'share of target=_blank links',
    measure: 'Share of target="_blank" links whose name, title or description mentions a new tab/window or external destination.',
    normalise: { type: 'share' }, weight: 1, viewports: 'primary',
    why: 'Unexpected new tabs disorient people and break the Back button (WCAG 3.2.5 advisory).',
    what: 'Announce links that open a new tab', how: 'Add "(opens in a new tab)" visually-hidden text or an icon with an accessible label, or drop target="_blank".' },
  { id: 'interactionPredictability.buttonStyles', dimension: 'interactionPredictability', source: 'measured', title: 'Consistent button styles', unit: 'distinct styles (worst page)',
    measure: 'Distinct combinations of radius, height, weight, size, fill and border among visible button-like controls.',
    normalise: { type: 'linear', bad: 9, good: 4 }, weight: 1, viewports: 'primary',
    why: 'When the same action looks different in different places people cannot predict what is clickable (WCAG 3.2.4).',
    what: 'Consolidate button styles into a few variants', how: 'Use one button component with primary/secondary/tertiary variants and a fixed size scale.' },
  { id: 'interactionPredictability.focusNoContextChange', dimension: 'interactionPredictability', source: 'measured', title: 'Focus never changes context', unit: 'share of routes',
    measure: 'Share of routes where tabbing through the page did not change the URL or open a window.',
    normalise: { type: 'share' }, weight: 1, viewports: 'primary',
    why: 'Receiving focus must not trigger navigation (WCAG 3.2.1).',
    what: 'Do not navigate or submit on focus', how: 'Trigger navigation only on explicit activation (click, Enter), never in focus/blur handlers.' },
  { id: 'interactionPredictability.consistentPatterns', dimension: 'interactionPredictability', source: 'agent', title: 'Consistent behaviour of components',
    prompt: 'Do the same components and gestures behave the same way everywhere (same component, same result)?',
    inspect: 'Compare repeated components across routes in the screenshots and code: cards, buttons, menus, links. Do identical-looking things behave identically?',
    anchors: { 1: 'same-looking things behave differently', 3: 'minor inconsistencies', 5: 'fully consistent' },
    normalise: SCALE, weight: 3,
    why: 'Behavioural consistency spans routes and states beyond what the probes exercise.',
    what: 'Make identical components behave identically', how: 'Share one implementation per component and remove page-specific overrides of behaviour.' },
  { id: 'interactionPredictability.reversible', dimension: 'interactionPredictability', source: 'agent', title: 'Reversible actions',
    prompt: 'Are actions reversible (undo, cancel, back) and are destructive actions confirmed?',
    inspect: 'Find destructive or irreversible actions (delete, submit, purchase). Is there undo, cancel or confirmation? Does Back work as expected? Answer 3 if there are no such actions.',
    anchors: { 1: 'irreversible without warning', 3: 'partially', 5: 'undo or confirmation everywhere it matters' },
    normalise: SCALE, weight: 2,
    why: 'Reversibility makes exploration safe.',
    what: 'Make actions reversible', how: 'Prefer undo over confirm dialogs; confirm only destructive irreversible actions; keep Back meaningful.' },

  // ------------------------------------------------------------------ error handling
  { id: 'errorHandling.formValidation', dimension: 'errorHandling', source: 'measured', title: 'Empty-submission validation', unit: 'score 0–1 (mean of forms)',
    measure: 'Each form with a text-like field (not search; ≤ 2 per page) is submitted empty with non-GET requests blocked and navigation prevented. Per form, mean of: submission blocked or handled; invalid fields marked aria-invalid (0.5 for native-only); messages tied with aria-describedby/aria-errormessage (0.5 if only in a live region); focus moved to the first error; required fields marked.',
    normalise: { type: 'share' }, weight: 4, viewports: 'primary',
    why: 'Errors must be identified in text, tied to the field and recoverable (WCAG 3.3.1, 3.3.3, 4.1.3).',
    what: 'Validate forms with inline, associated error messages', how: 'On submit: set aria-invalid="true", write a message into an element referenced by aria-describedby, move focus to the first invalid field, and mark required fields with required/aria-required and visible text.' },
  { id: 'errorHandling.liveRegions', dimension: 'errorHandling', source: 'measured', title: 'Live region ready for status messages', unit: 'share of routes',
    measure: 'On routes with a form or deferred content, share that have a live region (role=alert/status/log, aria-live, <output>) in the DOM at load.',
    normalise: { type: 'share' }, weight: 1, viewports: 'primary',
    why: 'Status and error messages that do not move focus must be announced; the live region has to exist before the message (WCAG 4.1.3).',
    what: 'Add a live region for status and error messages', how: 'Render an empty role="status" (or role="alert" for errors) element at load and insert text into it.' },
  { id: 'errorHandling.notFound', dimension: 'errorHandling', source: 'measured', title: 'Helpful 404 page', unit: 'score 0–1',
    measure: 'A non-existent route is requested: 0.4 for HTTP 404/410 (not a soft 200), 0.3 for text that explains the page was not found, 0.3 for a link home or a navigation landmark. In --serve mode a 404.html at the root is honoured like static hosts do.',
    normalise: { type: 'share' }, weight: 2, viewports: 'primary',
    why: 'A dead end without explanation or a way back strands people; a soft 200 confuses crawlers and analytics.',
    what: 'Serve a helpful 404 page with the 404 status', how: 'Return HTTP 404 with a page that says what happened, keeps the site navigation and links home or to search.' },
  { id: 'errorHandling.recovery', dimension: 'errorHandling', source: 'agent', title: 'Error and empty states explain the fix',
    prompt: 'Do error and empty states say what happened and how to fix it, and teach the next step?',
    inspect: 'Read the error, empty and offline states in the code (or trigger them). Is the message specific, does it offer the fix or a next step, and is it in text (not colour alone)?',
    anchors: { 1: 'generic or missing', 3: 'explains some', 5: 'specific with a next step everywhere' },
    normalise: SCALE, weight: 3,
    why: 'The lab only triggers an empty form submission and a 404.',
    what: 'Write error and empty states that explain the fix', how: 'State the problem, the fix and a next action; never rely on colour or a toast that disappears.' },
  { id: 'errorHandling.dataSafety', dimension: 'errorHandling', source: 'agent', title: 'Input survives errors',
    prompt: 'Is entered data preserved after errors and navigation, with destructive submissions confirmed?',
    inspect: 'Trigger a server or validation error mentally/in code: are field values kept? Is there a draft or confirmation for long or destructive input?',
    anchors: { 1: 'input is lost on error', 3: 'mostly preserved', 5: 'always preserved, destructive steps confirmed' },
    normalise: SCALE, weight: 2,
    why: 'Losing input is one of the most frustrating failures and cannot be observed generically.',
    what: 'Preserve user input across errors and navigation', how: 'Keep form state on error, restore drafts, and confirm or allow undo for destructive submissions.' },

  // ------------------------------------------------------------------ accessibility
  { id: 'accessibility.axeViolations', dimension: 'accessibility', source: 'measured', title: 'axe-core rule violations', unit: 'impact-weighted rules',
    measure: 'axe-core (WCAG 2.x A/AA tags) on the primary viewport of every route; distinct violated rules across routes weighted critical 3, serious 2, moderate 1, minor 0.5. color-contrast and target-size are scored separately.',
    normalise: { type: 'linear', bad: 10, good: 0 }, weight: 4, viewports: 'primary',
    why: 'Automated rules catch a subset of barriers (names, roles, alt text, landmarks, ARIA misuse).',
    what: 'Fix the axe-core violations', how: 'Follow each rule\'s help URL in the evidence; typical fixes are alt text, labels, valid ARIA, document language and landmarks.' },
  { id: 'accessibility.textContrast', dimension: 'accessibility', source: 'measured', title: 'Text contrast (axe color-contrast)', unit: 'share of text elements', gate: 'contrast',
    measure: 'axe-core color-contrast on the primary viewport: passing ÷ (passing + failing) text elements; elements axe cannot decide (images, gradients) are excluded and counted.',
    normalise: { type: 'linear', bad: 0.8, good: 1 }, weight: 3, viewports: 'primary',
    why: 'Low-contrast text is unreadable for many people in many conditions (WCAG 1.4.3).',
    what: 'Raise text contrast to at least 4.5:1 (3:1 for large text)', how: 'Darken the listed foreground colours or lighten their backgrounds; check hover/disabled/placeholder states and text over images by eye.' },
  { id: 'accessibility.screenReader', dimension: 'accessibility', source: 'agent', title: 'Screen-reader walkthrough',
    prompt: 'Has the primary task been completed with a screen reader (or the accessibility tree)? Answer "not-tested" if it has not.',
    inspect: 'Use VoiceOver/NVDA, or read the accessibility tree (Chrome DevTools → Accessibility). Are names, roles, reading order and announcements sensible for the primary task?',
    normalise: YES_PARTIAL_NO, weight: 2,
    why: 'Automated checks cannot confirm that names are meaningful and announcements make sense.',
    what: 'Complete the primary task with a screen reader and fix what blocks it', how: 'Fix unclear names, missing announcements and reading-order problems found in the walkthrough.' },
  { id: 'accessibility.flashing', dimension: 'accessibility', source: 'agent', title: 'No flashing content', gate: 'flashing',
    prompt: 'Does anything flash more than three times per second (strobing shaders, rapid cuts, hard white flashes)?',
    inspect: 'Inspect animated effects, video and shaders frame by frame if needed. Answer "no" only if you checked.',
    normalise: { type: 'choice', map: { no: 1, yes: 0 } }, weight: 2,
    why: 'Flashing can trigger seizures (WCAG 2.3.1); it is not measured automatically.',
    what: 'Remove content that flashes more than three times per second', how: 'Slow the effect below 3 Hz, reduce the flash area and contrast, or remove it.' },

  // ------------------------------------------------------------------ spatial interaction clarity (3D)
  { id: 'spatialInteractionClarity.instructions', dimension: 'spatialInteractionClarity', source: 'measured', title: 'Interaction instructions near the canvas', unit: 'share of 3D canvases',
    measure: 'For each visible canvas that requested a WebGL/WebGPU context: visible text near the canvas (its container, neighbouring elements, aria-describedby) that explains how to interact (drag, rotate, zoom, scroll, keys, buttons…).',
    normalise: { type: 'share' }, weight: 3, viewports: 'primary',
    why: 'Nothing about a canvas tells people they can drag, scroll or use keys.',
    what: 'Explain how to interact with the 3D view', how: 'Add a short visible instruction next to the canvas ("Drag to rotate · use the buttons to zoom") and reference it with aria-describedby.' },
  { id: 'spatialInteractionClarity.keyboardAlternatives', dimension: 'spatialInteractionClarity', source: 'measured', title: 'DOM controls for the 3D view', unit: 'score 0–1 (mean of canvases)',
    measure: 'Focusable DOM controls (buttons, inputs, links) in the canvas\'s container or neighbourhood, or controls with aria-controls pointing at it: ≥ 2 → 1, one → 0.5, none → 0.',
    normalise: { type: 'share' }, weight: 3, viewports: 'primary',
    why: 'Dragging-only orbit excludes keyboard and many motor-impaired users (WCAG 2.5.7, 2.1.1).',
    what: 'Add keyboard-operable controls for the 3D view', how: 'Provide buttons for rotate/zoom/reset (and a list of hotspots) outside the canvas.' },
  { id: 'spatialInteractionClarity.fallback', dimension: 'spatialInteractionClarity', source: 'measured', title: 'Fallback without WebGL', unit: 'share of 3D routes',
    measure: 'Each 3D route is reloaded in a second Chromium with WebGL disabled and getContext forced to null: 1 if fallback content is shown ([data-maquettekit-fallback], or image/text in the canvas container) and nothing throws, 0.5 if content shows but errors are thrown, 0 otherwise.',
    normalise: { type: 'share' }, weight: 3, viewports: 'primary',
    why: 'Some devices never get a WebGL context; the page must stay usable (Maquettekit gate 4).',
    what: 'Show fallback content when WebGL is unavailable', how: 'Handle a null context: hide the canvas and show a poster or text with the same information, marked with data-maquettekit-fallback; never throw.' },
  { id: 'spatialInteractionClarity.accessibleName', dimension: 'spatialInteractionClarity', source: 'measured', title: 'Canvas has a name', unit: 'share of 3D canvases',
    measure: 'Share of 3D canvases with an accessible name (aria-label/labelledby/title, or a named role="img"/group container) or descriptive fallback text inside <canvas>.',
    normalise: { type: 'share' }, weight: 1, viewports: 'primary',
    why: 'A canvas is opaque to assistive technology unless it is named and described.',
    what: 'Name and describe the canvas', how: 'Give the canvas (or its container) role="img" with aria-label, or a labelled group around real controls, plus a longer description nearby.' },
  { id: 'spatialInteractionClarity.orientation', dimension: 'spatialInteractionClarity', source: 'agent', title: 'Orientation in 3D',
    prompt: 'Can people recover orientation in the 3D view (reset view, camera limits, clear affordances)?',
    inspect: 'Try (or read) the camera controls: is there a reset, are rotation/zoom limited so the subject cannot be lost, are hotspots signposted?',
    anchors: { 1: 'easy to get lost', 3: 'recoverable with effort', 5: 'always oriented, one-step reset' },
    normalise: SCALE, weight: 2,
    why: 'Spatial orientation depends on camera design that cannot be probed generically.',
    what: 'Add a reset view and camera limits', how: 'Clamp orbit/zoom, add a "Reset view" button, and keep the subject framed.' },
  { id: 'spatialInteractionClarity.informationOutside', dimension: 'spatialInteractionClarity', source: 'agent', title: 'Information also outside the canvas',
    prompt: 'Is all essential information (specs, prices, labels, calls to action) also available as DOM content outside the canvas?',
    inspect: 'List the information shown only inside the 3D scene. Is each item also in the HTML?',
    normalise: YES_PARTIAL_NO, weight: 2,
    why: 'If the canvas fails or cannot be perceived, nothing essential may be lost.',
    what: 'Duplicate essential 3D information in the DOM', how: 'Render specs, hotspot text and actions as HTML next to the canvas; the scene illustrates them.' },
];
export const SIGNAL_BY_ID = Object.fromEntries(SIGNALS.map((s) => [s.id, s]));

// ======================================================================= profiles
export const PROFILE_IDS = ['essential', 'expressive', 'immersive'];

/** Dimension weights sum to 100 per profile; bands configure `band` normalisers; requirements add profile gates. */
export const PROFILES = {
  essential: {
    title: 'Essential', summary: 'Minimal animation, maximum clarity and responsiveness.',
    dimensionWeights: { discoverability: 7, usability: 10, visualFeedback: 6, navigationConsistency: 7, touchInteraction: 7, keyboardSupport: 9, motionUsefulness: 5, cognitiveLoad: 9, loadingExperience: 6, perceivedPerformance: 8, interactionPredictability: 8, errorHandling: 7, accessibility: 9, spatialInteractionClarity: 2 },
    bands: {
      hoverCoverage: { bad: 0.2, good: 0.6 }, animatedFeedback: { bad: 0.2, good: 0.8 },
      infiniteLoops: { bad: 2, good: 0 }, longestAnimationMs: { bad: 600, good: 250 }, concurrentAnimations: { bad: 4, good: 1 },
      inputLatencyMs: { bad: 300, good: 100 },
    },
    requirements: [],
    notes: ['Penalises ambient loops (none expected) and transitions longer than ~250 ms.', 'Expects near-instant feedback: input-to-paint ≤ 100 ms scores fully, ≥ 300 ms scores 0.', 'Instant (untransitioned) feedback is fine: "smoothly transitioned feedback" has weight 0.'],
  },
  expressive: {
    title: 'Expressive', summary: 'Rich feedback and polished transitions that explain change, then get out of the way.',
    dimensionWeights: { discoverability: 7, usability: 8, visualFeedback: 8, navigationConsistency: 7, touchInteraction: 7, keyboardSupport: 8, motionUsefulness: 8, cognitiveLoad: 7, loadingExperience: 6, perceivedPerformance: 7, interactionPredictability: 7, errorHandling: 6, accessibility: 9, spatialInteractionClarity: 5 },
    bands: {
      hoverCoverage: { bad: 0.4, good: 0.85 }, animatedFeedback: { bad: 0.2, good: 0.8 },
      infiniteLoops: { bad: 4, good: 1 }, longestAnimationMs: { bad: 1200, good: 560 }, concurrentAnimations: { bad: 8, good: 3 },
      inputLatencyMs: { bad: 500, good: 200 },
    },
    requirements: [],
    notes: ['Allows one subtle ambient loop and transitions up to ~560 ms.', 'Expects hover feedback on most controls, preferably transitioned.'],
  },
  immersive: {
    title: 'Immersive', summary: 'Cinematic motion, spatial and 3D experiences — always skippable, pausable and with fallbacks.',
    dimensionWeights: { discoverability: 6, usability: 6, visualFeedback: 9, navigationConsistency: 5, touchInteraction: 6, keyboardSupport: 7, motionUsefulness: 11, cognitiveLoad: 5, loadingExperience: 8, perceivedPerformance: 7, interactionPredictability: 6, errorHandling: 4, accessibility: 9, spatialInteractionClarity: 11 },
    bands: {
      hoverCoverage: { bad: 0.5, good: 0.95 }, animatedFeedback: { bad: 0.4, good: 0.9 },
      infiniteLoops: { bad: 8, good: 3 }, longestAnimationMs: { bad: 2000, good: 900 }, concurrentAnimations: { bad: 14, good: 6 },
      inputLatencyMs: { bad: 500, good: 200 },
    },
    requirements: ['spatialClarity', 'motionControls'],
    notes: ['Expects rich, transitioned feedback on nearly every control.', 'Requires spatial clarity (instructions, DOM controls, fallback) whenever a 3D canvas is present.', 'Requires a visible motion control whenever anything plays by itself.'],
  },
};

// ======================================================================= gates
/**
 * Gates are accessibility / user-control invariants. A failed gate caps the overall score
 * whatever the profile. `scope: "profile"` gates are extra requirements of one profile.
 */
export const GATES = [
  { id: 'reducedMotion', scope: 'universal', title: 'Reduced motion is honoured', standard: 'Maquettekit invariant gate 1 (three-tier policy); WCAG 2.3.3 adopted as mandatory', signals: ['motionUsefulness.reducedMotion'] },
  { id: 'userControl', scope: 'universal', title: 'Auto-playing motion > 5 s can be paused', standard: 'Maquettekit invariant gate 2; WCAG 2.2.2 Pause, Stop, Hide (A)', signals: ['motionUsefulness.pauseControl'] },
  { id: 'keyboard', scope: 'universal', title: 'Keyboard operable, no traps', standard: 'WCAG 2.1.1 Keyboard (A), 2.1.2 No Keyboard Trap (A)', signals: ['keyboardSupport.reachable', 'keyboardSupport.noTrap'] },
  { id: 'focusVisible', scope: 'universal', title: 'Focus is always visible', standard: 'WCAG 2.4.7 Focus Visible (AA)', signals: ['keyboardSupport.focusVisible'] },
  { id: 'contrast', scope: 'universal', title: 'Text contrast meets 4.5:1 / 3:1', standard: 'WCAG 1.4.3 Contrast (Minimum) (AA), measured by axe-core', signals: ['accessibility.textContrast'] },
  { id: 'targetSize', scope: 'universal', title: 'Touch targets ≥ 24×24 CSS px or spaced', standard: 'WCAG 2.5.8 Target Size (Minimum) (AA)', signals: ['touchInteraction.targetSize24'] },
  { id: 'zoom', scope: 'universal', title: 'Zoom is not disabled', standard: 'WCAG 1.4.4 Resize Text (AA)', signals: ['touchInteraction.zoomAllowed'] },
  { id: 'flashing', scope: 'universal', title: 'Nothing flashes more than 3× per second', standard: 'WCAG 2.3.1 Three Flashes (A) — agent-checked', signals: ['accessibility.flashing'] },
  { id: 'spatialClarity', scope: 'profile', profile: 'immersive', title: 'Immersive: 3D views are explained, operable without dragging and have a fallback', standard: 'Maquettekit Immersive requirement; accessibility.md §3', signals: ['spatialInteractionClarity.instructions', 'spatialInteractionClarity.keyboardAlternatives', 'spatialInteractionClarity.fallback'] },
  { id: 'motionControls', scope: 'profile', profile: 'immersive', title: 'Immersive: anything that plays by itself has a visible motion control', standard: 'Maquettekit Immersive requirement; experience-profiles.md §3 (ambient motion "pausable")', signals: ['motionUsefulness.pauseControl'] },
];
export const GATE_BY_ID = Object.fromEntries(GATES.map((g) => [g.id, g]));

/** Score caps applied after failed gates. */
export const GATE_CAPS = { one: 69, twoOrMore: 59, rule: 'One failed gate caps the overall score at 69 (grade D at best); two or more cap it at 59 (grade F). The profile never lifts a cap.' };

export const GRADES = [{ grade: 'A', min: 90 }, { grade: 'B', min: 80 }, { grade: 'C', min: 70 }, { grade: 'D', min: 60 }, { grade: 'F', min: 0 }];
export const CONFIDENCE_LABELS = [{ label: 'high', min: 0.75 }, { label: 'medium', min: 0.5 }, { label: 'low', min: 0 }];

/** @param {number} score */
export function gradeFor(score) { return (GRADES.find((g) => score >= g.min) ?? GRADES[GRADES.length - 1]).grade; }
/** @param {number} c */
export function confidenceLabel(c) { return (CONFIDENCE_LABELS.find((x) => c >= x.min) ?? CONFIDENCE_LABELS[2]).label; }

// ======================================================================= normalisation
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Resolve a signal's normaliser for a profile (bands → concrete linear). */
export function resolveNormaliser(signal, profile) {
  const n = signal.normalise;
  if (n.type === 'band') {
    const b = PROFILES[profile]?.bands?.[n.band];
    if (!b) throw new Error(`Unknown band "${n.band}" for profile ${profile}`);
    return { type: 'linear', bad: b.bad, good: b.good, band: n.band, profile };
  }
  return n;
}
/** Resolve a signal's weight for a profile. */
export function resolveWeight(signal, profile) {
  const w = signal.weight;
  return typeof w === 'number' ? w : (w[profile] ?? 0);
}

/**
 * Map a raw value to 0–1. Returns null when the value cannot be normalised.
 * @param {any} spec resolved normaliser @param {any} raw
 */
export function normalise(spec, raw) {
  if (raw === null || raw === undefined) return null;
  switch (spec.type) {
    case 'share': { if (typeof raw === 'boolean') return raw ? 1 : 0; const x = Number(raw); return Number.isFinite(x) ? clamp01(x) : null; }
    case 'linear': {
      const x = typeof raw === 'boolean' ? (raw ? 1 : 0) : Number(raw);
      if (!Number.isFinite(x)) return null;
      if (spec.good === spec.bad) return x === spec.good ? 1 : 0;
      return clamp01((x - spec.bad) / (spec.good - spec.bad));
    }
    case 'plateau': {
      const x = Number(raw);
      if (!Number.isFinite(x)) return null;
      if (x >= spec.lo1 && x <= spec.hi1) return 1;
      if (x < spec.lo1) return clamp01((x - spec.lo0) / (spec.lo1 - spec.lo0));
      return clamp01((spec.hi0 - x) / (spec.hi0 - spec.hi1));
    }
    case 'scale': { const x = Number(raw); return Number.isFinite(x) ? clamp01((x - spec.min) / (spec.max - spec.min)) : null; }
    case 'choice': { const v = spec.map[String(raw).toLowerCase()]; return v === undefined ? null : v; }
    default: return null;
  }
}

/** Human-readable description of a resolved normaliser. @param {any} n @param {string} [unit] */
export function describeNormaliser(n, unit = '') {
  const u = unit && /ms|px|words|elements|chars|characters/.test(unit) ? ` ${unit.split(' ')[0]}` : '';
  switch (n.type) {
    case 'share': return 'share used as is (0–1)';
    case 'linear': return `linear: ${n.bad}${u} → 0, ${n.good}${u} → 1 (clamped)${n.band ? ` — ${n.profile} band "${n.band}"` : ''}`;
    case 'plateau': return `plateau: 1 between ${n.lo1} and ${n.hi1}, falling to 0 at ${n.lo0} and ${n.hi0}`;
    case 'scale': return `agent scale ${n.min}–${n.max} → (answer − ${n.min}) / ${n.max - n.min}`;
    case 'choice': return `agent choice: ${Object.entries(n.map).map(([k, v]) => `${k} → ${v}`).join(', ')}`;
    default: return n.type;
  }
}
