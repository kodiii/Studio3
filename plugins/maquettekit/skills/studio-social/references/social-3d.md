# Social 3D — interactive posts, showcases, avatars and AR-ready previews

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - Use real-time 3D only when every "must" in §1 holds and at least one "value" row does.
> - Keep one live canvas per view, `<model-viewer>` included; every other post shows its poster.
> - Load a model only on activation ("View in 3D"), never on scroll.
> - When the activated post scrolls well away, dispose of the scene and call `clearModel(url)`.
> - Never capture feed scrolling: orbit only after activation, and wheel-zoom only while the viewer has focus.
> - Give every scene interaction a named DOM control of at least 44 px; keep price and variants in DOM.
> - Never fabricate a product or a person's likeness; get the person's consent for any real likeness.
> - Upload nothing to hosted viewers, converters or AR services without the user's explicit agreement.

You decide **whether** a social surface needs real-time 3D and **what it must do inside a feed**.
`studio-3d` builds the scene; `studio-asset-optimizer` prepares the model; `studio-cinematic` leads if the
piece is a scroll-driven campaign story. This file is the decision, the delivery options and the feed rules.

## 1. The decision

A feed is the harshest place for 3D: many items, constant scrolling, mid-range phones, metered data. Real-time
3D needs **every** "must" and at least one "value" row.

| | Criterion | How to check |
|---|---|---|
| Must | The post works as a poster image (or short video) without the scene | The poster is the feed item; 3D is an upgrade on request |
| Must | A model exists, with a licence and source, or is supplied by the user | Never fabricate a product or a person's likeness |
| Must | The feed keeps at most one live canvas per view | §4 |
| Must | Every scene interaction has a DOM control, and the information is in DOM | Product name, price, variants, captions |
| Value | People need to inspect the object from angles a few images cannot show | Shoes, furniture, collectibles, hardware |
| Value | The avatar or 3D identity is the medium people express themselves with | Avatar-first communities |
| Value | Placing the object in the person's space matters, and AR hand-off is wanted | Furniture, decor, large products |
| Value | The interactive piece is itself what people share (a remixable scene, a generated card) | Campaigns |

Otherwise use the lighter form: an image carousel, a 24–72 frame turntable sequence, a short muted video with
a poster and pause control, or CSS 3D planes (`flip-card-3d`, `tilt-parallax-card`, `layered-depth-stack`;
confirm ids with `maquettekit catalog search`, as some recipes are still planned).

## 2. Formats

| Format | What the person does | Requirements to hand over | Lighter alternative |
|---|---|---|---|
| Interactive 3D post | Taps "View in 3D", orbits, zooms, resets | Poster, model variants, orbit limits, DOM controls | Turntable image sequence |
| Spatial product showcase | Inspects, switches variants, opens details or checkout | Variant data in DOM, price in DOM, camera presets per variant | Image per variant |
| Avatar presentation | Views a profile avatar, plays an expression or pose | Consent, idle animation pausable, skinned model budget | Static avatar render |
| AR-ready preview | Opens the object in their room | AR assets per platform (§3), clear "View in your space" control, fallback | A scale reference image |
| Campaign effect | Plays with a scene and shares a capture | Capture path (§6), share sheet, honest participation counts | Interactive 2D canvas or CSS piece |

## 3. Delivery options: verify, do not assume

None of these is a default. Check each against the project's targets and the installed versions before
promising it.

| Option | What it is | Verify before relying on it |
|---|---|---|
| Maquettekit three-kit (`StudioCanvas` with React Three Fiber; `createVanillaScene` without React) | An in-page scene with fallback, demand rendering, quality profiles and diagnostics | The default for custom interaction; follows the library contract |
| `<model-viewer>` web component | A ready-made glTF/GLB viewer with camera controls, poster and AR hand-off attributes (`ar`, `ar-modes`, `ios-src`) | Licence and version as installed; bundle cost measured in the project; which AR modes work on the target devices; whether the installed version can produce iOS assets from GLB or needs a separate USDZ via `ios-src`. It is its own renderer, so it counts as the view's one canvas |
| GLB (binary glTF) | The web-native model format | Run it through `maquettekit assets validate`, `optimize` and `variants` (delegate to `studio-asset-optimizer`) |
| USDZ | The format Apple's AR Quick Look opens | Maquettekit's pipeline imports USDZ to GLB (`maquettekit assets import`) but does not export USDZ; producing one needs separate tooling the user chooses. Quick Look links take the form `<a rel="ar" href="model.usdz">` wrapping a single `<img>` |
| WebXR `immersive-ar` | AR sessions in browsers that support them | Feature-detect with `navigator.xr?.isSessionSupported('immersive-ar')`; support is limited and device-specific |
| Android Scene Viewer | A system AR viewer reached by intent | Availability depends on the device and its services; test on real hardware |
| In-app effects (lenses, filters inside social apps) | Built with each platform's own tools | Out of scope: Maquettekit builds web surfaces and assets only |

Upload nothing to hosted viewers, converters or AR services without the user's explicit agreement (shared
`technology-selection.md` rule 6).

## 4. Performance in feeds

- **One live canvas per view.** Posts show posters. A person activates one post ("View in 3D"); that post
  gets the canvas; activating another moves the canvas (or the model) there and releases the previous one.
  When several 3D items must be visible at once, render them as views of one canvas (scissored viewports,
  such as drei's `View`) rather than separate contexts.
- **Activation by intent, not by scroll.** Scrolling past a post never loads its model. Prefetch only the
  poster and, on a fast connection, perhaps the next activated post's mobile variant.
- **Poster first.** `maquettekit assets thumbnail` renders a poster from the model; the post reserves its aspect
  ratio; the canvas replaces the poster with a cross-fade no longer than the `base` token.
- **Variants.** `maquettekit assets variants --profiles desktop,mobile,low-power` produces one build per quality
  profile; the three-kit picks the variant from `useQuality()`.
- **Release.** When the activated post scrolls well away, dispose of the scene and drop cached models
  (`clearModel(url)` in the three-kit); a long feed session must not accumulate GPU memory.
- **Render on demand** (`frameloop="demand"`); idle animation only while visible and not under reduced motion.
- **Data saver** (where the browser exposes it) or a user setting: no 3D until explicitly requested, with the
  download size shown on the button.

## 5. Interaction and accessibility in a scrolling feed

- Vertical drags scroll the feed until the person has activated the viewer; then horizontal drags orbit
  (`touch-action: pan-y` on the viewer) and wheel zoom applies only while the viewer has focus.
- DOM controls next to the viewer: rotate left and right, zoom in and out, reset, play or pause animation,
  close 3D. Each ≥ 44 px with a name.
- The canvas has a label and a description; product facts, variants, price and calls to action are DOM.
- "View in your space" appears only when an AR mode is actually available on the device; otherwise it is
  absent, not disabled without explanation.
- Reduced motion: no autorotate or idle loops; camera changes cut; animations play only from their button.

## 6. Avatars and campaign effects

**Avatars**

- A real person's likeness needs that person's consent. Never generate realistic likenesses of people from
  their photos without it, and never present a generated person as a real user.
- Avatar creators offer a wide range of bodies, skin tones, hair, ages and assistive devices; nothing is
  inferred from photos about sensitive traits.
- Idle animation is subtle, pausable and off under reduced motion; voice and lip-sync are opt-in.
- Skinned meshes are expensive: budget bones and influences; simplification of skinned models is opt-in in
  the asset pipeline (`maquettekit assets optimize --allow-skinned-simplify`), and the result must be checked.

**Campaign effects and shareable captures**

- Capture the scene as an image right after a render (`canvas.toBlob()` in the same frame), or render with
  `preserveDrawingBuffer` only for the capture; a WebGL canvas otherwise reads back blank.
- Share files with `navigator.canShare({ files })` then `navigator.share({ files, title })`, with a download
  fallback.
- Participation counts, leaderboards and countdowns follow `ethics.md`: real or absent.
- Campaign pages that tell a story with scroll are led by `studio-cinematic`; you supply the participation
  pieces.

## 7. Handoff contract to studio-3d

| Field | You provide |
|---|---|
| Format | Which row of §2 and the "value" criterion from §1 |
| Asset | Model path, licence and source; results of `maquettekit assets validate`; variants and poster |
| Placement | The post or viewer container, aspect ratio, behaviour at 320 px, activation trigger |
| Props in | Active variant, camera preset, paused flag, reduced flag, quality level |
| Events out | `ready`, `error`, interaction started (so the feed can pause other media), preset reached |
| Camera | Presets with intent, orbit and zoom limits, reset view |
| AR | Which delivery options from §3 were verified on which devices; the assets for each |
| Budget | Target devices, chunk weight, draw calls, triangles, texture memory; one canvas per view |
| Fallback | Poster plus DOM information when WebGL is missing, the context is lost, or 3D is turned off |
| Accessibility | Label, description, the DOM controls in §5 |

What you require back: a component inside `StudioCanvas` (or the verified alternative from §3) that renders
on demand, disposes everything on deactivate, and reports review-run diagnostics with the caveat that
headless software rendering is not a real phone.

## 8. Checklist

- [ ] Every "must" in §1 holds; the "value" row is named, or the lighter form was chosen.
- [ ] Delivery options were verified for the target devices; nothing assumed from documentation alone.
- [ ] One live canvas per view; activation by intent; poster first; resources released on deactivate.
- [ ] Feed scrolling is never captured; orbit only after activation; DOM controls for every interaction.
- [ ] AR offered only where available; consent handled for any likeness; captures and counts honest.
- [ ] Handoff table completed; the post is complete with WebGL disabled.
