# Motion craft — designed, physical, alive, touchable

> **Quick card** — the must-dos from this file; read on for the reasons and the detail.
>
> - Write a motion brief before code: the surface's character in three adjectives, its signature move, and how each primary control answers a hand.
> - On Expressive and Immersive surfaces, meet the craft floor in §1; a surface that only fades in is unfinished.
> - Give moving things weight: springs that keep input velocity, overlap and follow-through, exits faster than entrances.
> - Light the surface from one direction: layered shadows, highlights and depth that change when elements lift, press or tilt.
> - Make it respond: pointer, scroll velocity, drag and data should change what the motion does, not only start it.
> - Let people touch the main object directly (drag, scrub, turn, throw), with a button and keyboard twin.
> - Hold every gate in `experience-profiles.md` §5; craft is added after the response, never in front of it.

The other shared files say what motion must never do. This one says what it has to achieve. A build that passes
every gate and feels like a slideshow of fades has failed the brief as surely as one that hijacks scroll.

Restraint is a decision for a surface (Essential), not the default for the plugin. Where the profile is
Expressive or Immersive, the job is motion design: timing, weight, light and response chosen on purpose and
carried through the whole surface.

## 1. The craft floor

Minimum for a finished surface. Below it, report the surface as incomplete rather than as restrained.

| | Essential | Expressive | Immersive |
|---|---|---|---|
| **Designed** | Every state change has a transition from tokens | A signature move people would recognise; entrances choreographed, not uniformly faded | A motion language: recurring moves, pacing that varies between beats |
| **Physical** | Press and release feel instant | Springs on anything touched or dragged; overlap and follow-through on groups | Mass differs by size; velocity carries through; secondary motion on arrival |
| **Lit** | Consistent elevation | Shadows and highlights respond to hover, press and lift | One light direction across DOM and canvas; depth layers; material response |
| **Alive** | Data and state updates animate between values | At least one element responds continuously to pointer or scroll | The scene keeps responding: input, scroll velocity, time or data drive it |
| **Touchable** | Every control has all states | One direct-manipulation interaction (drag, scrub, swipe, reorder) | The main subject can be handled: turned, thrown, scrubbed, configured |

## 2. Designed — motion-design principles in tokens

Animation principles, translated to this plugin's vocabulary (`library/src/motion/tokens.ts`).

| Principle | In an interface | Tokens and building blocks |
|---|---|---|
| Timing and spacing | Size and distance set the duration; easing sets the character. Nothing eases linearly except opacity and scrubbing | `duration.*`, `easing.enter` / `exit` / `emphasized` |
| Anticipation | A small counter-move before a large one: a button dips before it launches, a card pulls back before it flies | `easing.anticipate`; a 4–12 px or 2–3 % wind-up (`distance.nudge`, `short`) |
| Follow-through and overlap | Parts arrive at different times: the container lands, then its content, then the detail. Nothing stops dead | `stagger.*`, `createSequence` labels; `spring.settle`, `spring.glide` |
| Secondary action | A quieter motion that supports the main one: the shadow widens as the card lifts, the icon turns as the menu opens | Second track in the same sequence; counts once toward concurrency when it reads as one move |
| Arcs | Things that travel far curve; straight lines look mechanical | Separate easings on `x` and `y`, or `offset-path` |
| Squash and stretch | Elastic scale on press and release, kept small in UI (0.96–1.04) | `spring.press`, `spring.pop`, `easing.overshoot` |
| Staging | One thing leads at a time; the eye is taken somewhere | Profile concurrency limit; dim or still the rest |
| Exaggeration | The signature move is allowed to be big. Pick one and commit | `duration.cinematic`, `distance.travel`, scaled by profile |

Choose the **signature move** in the brief: the one motion that belongs to this product and no other (how a card
opens, how the headline sets, how the object turns to face the pointer). Reuse its timing and easing wherever
the same idea recurs, so the surface reads as one hand.

## 3. Physical and lit — realism

Realism here means plausible, not photographic: things behave as if they had mass and sat in light.

**Weight.**
- Anything a finger or pointer moves is driven by a spring and keeps its release velocity
  (`spring.release`; Motion `drag`). A drag that snaps back on a fixed curve feels dead.
- Larger things move slower and settle softer (`spring.glide`); small things are quick and tight (`spring.press`).
- Use `springToLinear()` to give CSS and WAAPI transitions a real spring without a JavaScript loop; for values the
  hand drives every frame, step them with `stepSpring()` (and `useSettleLoop()` to sleep once settled).
- Add resistance at limits (rubber-banding) instead of a hard stop; add friction to thrown content.

**Light.**
- Decide one light direction per surface and keep it across shadows, gradients, borders and any 3D scene.
- Elevation is two shadows, not one: a tight contact shadow and a wide soft one. Lifting an element shrinks
  the first and grows the second; pressing does the opposite.
- Let highlights answer the pointer on hero surfaces (`spotlight-border-card`, `tilt-parallax-card`,
  `press-depth-button`).
- Depth cues: scale, blur, contrast and parallax speed all fall off with distance
  (`parallax-depth-layers`, `layered-depth-stack`). Texture stops flat fills looking synthetic
  (`grain-gradient-mesh`).

**In 3D.** A lit model under an environment with a contact shadow and correct tone mapping reads as real; a
flat-lit mesh on a gradient reads as a demo. Art direction, environment lighting, materials and depth cues:
`studio-3d` `references/graphics.md` §5, §9, §10, §12. Physics when collision or constraint is the content:
`references/physics.md`.

## 4. Alive — dynamic and reactive

A dynamic surface has motion whose values come from somewhere: the pointer, scroll position and velocity, a
drag, live data, time of day, the content itself. Playback of a fixed clip is the weakest form.

| Driver | What it changes | Starting points in the catalogue |
|---|---|---|
| Pointer position | Tilt, highlight, field distortion, attraction, a light source | `magnetic-button`, `dot-grid-pointer-field`, `image-ripple-distortion`, `tilt-parallax-card`, `cursor-follower`, `liquid-glass-lens` |
| Scroll position and velocity | Progress, camera, skew or stretch proportional to speed | `scroll-pin-chapters`, `scroll-camera-dolly`, `kinetic-marquee`, `horizontal-scroll-gallery` |
| Gesture | Position, then momentum after release | `swipe-card-stack`, `drag-reorder-list`, `pull-to-reveal-sheet`, `liquid-glass-lens` |
| Data and state | Values morph instead of swapping; designed animation plays per state | `number-ticker`, `line-chart-morph`, `bar-race-transition`, `flip-grid-reorder`, `lottie-micro-interactions`, `rive-state-machine` |
| Time and procedure | Never the same frame twice, within a designed range | `shader-aurora-plane`, `particle-field-gpu`, `blob-morph`, `variable-weight-wave` |

Confirm ids with `maquettekit catalog search`. Smooth continuous drivers (lerp or spring toward the target)
instead of applying raw input, and stop the loop when the value has settled or the element is off screen.

## 5. Touchable — interaction

Feedback tells the user something happened. Interaction design lets them do it with their hands.

- **Direct manipulation first** for the main subject: drag to reorder, scrub a timeline, swipe a stack, turn a
  product, pull a sheet. Buttons remain as the equivalent path (`accessibility.md`), not as the only one.
- **Every press has depth**: an immediate pressed state within a frame, a release that springs back.
- **Hover is a conversation** on fine pointers: proximity, direction of entry and speed can all shape the
  response. On touch, give the same information on press or in view.
- **Gestures keep velocity** and can be interrupted and reversed at any point. A flick and a slow drag must
  end differently.
- **Reward the person's own action** once, briefly (`reaction-burst`, `like-heart-morph`,
  `morph-submit-button`); never reward the page loading.

## 6. The motion brief

Write this before the motion pass and put it in the report. Five lines:

1. **Character** — three adjectives that exclude things ("heavy, deliberate, glassy", not "smooth, modern").
2. **Signature move** — the one motion that identifies the surface, with its tokens.
3. **Physical model** — what has mass, where the light comes from, which springs.
4. **Drivers** — what the surface responds to continuously (§4).
5. **Hands** — the direct-manipulation interaction and its button and keyboard twin.

## 7. Before you call it finished

- Watch it at normal speed, then with the pointer moving, then scrolling fast. Is anything inert that the
  brief said should respond?
- Could a screenshot of the resting state pass for a static template? Then the craft floor in §1 is not met.
- Does any element stop dead, move in a straight line across the page, or share one easing with everything else?
- Is the signature move recognisable without the rest of the page?
- Turn reduced motion on: content, hierarchy and feedback survive; weight, travel and ambient motion are gone.

## 8. What does not change

Every gate in `experience-profiles.md` §5 holds at every level of ambition: reduced motion, pause and skip
controls, uninterrupted input, content reachable without the spectacle, the performance budget, one animation
owner per element. Feedback still starts in the next frame; richness comes after the response. Ambition that
breaks a gate is a defect, and so is a gate-clean surface with no craft.
