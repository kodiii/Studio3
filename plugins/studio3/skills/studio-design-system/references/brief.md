# Building the brief

`studio3 design init --out brief.json` writes an annotated template. Keys starting with `_` are comments. Every
field can also be passed as a flag to `generate` (`studio3 design --help` lists them), which is convenient for a
quick first pass; write `brief.json` once the direction is agreed so the decision is reproducible.

## Field by field

| Field | Infer from | Ask when | Default / note |
| - | - | - | - |
| `productCategory` | README, package name, routes, copy | never — infer | free text; recognised families include saas, fintech, ecommerce, portfolio, agency, editorial, devtool, healthcare, education, gaming, dashboard, social, entertainment, luxury, government, ai, hardware, food |
| `audience` | copy, docs, the user's request | unclear and it changes tone (expert vs. general public) | write it in the user's words, specific beats generic ("ops leads at mid-size logistics firms") |
| `brand.name` | package/site | — | |
| `brand.personality` | user's adjectives, existing site tone | the user gave none | 3 adjectives; they weigh 12% of direction scoring |
| `brand.existingColors` | CSS variables, Tailwind config, logo SVG fills | brand colours are "fixed" vs "inspiration" | first chromatic colour → brand hue, second → accent |
| `brand.existingFonts` | `@font-face`, font packages, `next/font` calls | licence unclear | first → display, second → text; never swap a licensed brand font for a suggestion |
| `businessGoals` | user request | — | shapes layout and component guidance; omit rather than invent |
| `targetDevices` | analytics notes, request ("mobile app", "kiosk") | — | `["desktop","mobile"]` |
| `preferredAesthetic` | user's words or a direction id | the user said nothing about look | adjectives or a direction id from `studio3 design directions` |
| `interactionComplexity` | feature scope | — | `medium`; `high` for editors, dashboards, configurators |
| `accessibility.level` / `needs` | legal context (public sector → AA minimum), user | regulated domain | `AA`; add needs such as `vestibular`, `low-vision`, `keyboard-only`, `screen-reader`, `dyslexia` |
| `performance.budget` / `lowEndDevices` | audience/markets | emerging-market or low-end audience | `balanced`; `tight` for content sites on slow networks |
| `stack.framework` / `styling` / `libs` | `package.json` | — | read it; the engine will not recommend React-only libraries for non-React stacks |
| `motionIntensity` | request ("cinematic", "calm", "snappy") | the request is ambiguous | Studio³ experience profile: `essential`, `expressive` (default), `immersive` |
| `requires3d` / `threeD.purpose` | request | 3D is mentioned vaguely ("something 3D") — ask what the 3D is for | `false`; a purpose such as "interactive product configurator" drives the `threeD` section |
| `specialty` | category | — | inferred: fintech/dashboard → data, social → social, agency/portfolio → cinematic, hardware → product/3d |

## Questions worth asking (pick at most three)

1. "Who is this for, and what should they feel in the first five seconds?" — audience + personality.
2. "Are the current brand colours and fonts fixed, or can we evolve them?" — existing assets.
3. "How much motion: calm and fast, polished, or cinematic?" — maps to essential / expressive / immersive.
4. "What would the 3D let people do that a good image could not?" — only when 3D is requested.

## Assumptions

`generate` prints `! Assumption:` lines for everything it had to infer. Treat each as a question you are answering on
the user's behalf: either accept it explicitly in your summary or update the brief and regenerate.
