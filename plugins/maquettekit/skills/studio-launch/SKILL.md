---
name: studio-launch
description: Launch Studio. Use when a site or page is about to go live or be shared — "ready to launch", "before we ship", "go-live checklist", "pre-launch", SEO basics, meta tags and descriptions, the social share / Open Graph image, Twitter cards, favicons and app icons, robots.txt and sitemaps, the 404 page, page weight, or "why does my link preview look wrong". Load it before advising as well as before editing. Checks the production build over HTTP, fixes what is missing, and hands rendering and accessibility to studio-review. Not for designing pages (the specialty studios) or browser QA of layout and interaction (studio-review).
argument-hint: "[production preview url or static export dir]"
license: MIT
metadata:
  short-description: Metadata, share images, icons, crawler rules, 404 and page weight before going live
  module: launch
---

# Launch Studio

**Make the first impression survive the link.** A page is first seen as a search result, a chat preview or a
bookmark. Each of those reads metadata, an image and an icon that no screenshot of the page shows.

## Use when

- The work is about to be deployed, announced or shared, or the user asks for a launch or go-live check.
- Link previews, search snippets, favicons, robots.txt, sitemaps or the 404 page are wrong or missing.
- A specialty studio finishes a page that will be public.

Don't use when the question is how the page looks or behaves in a browser → `studio-review`; when it is about the
interaction quality → `studio-experience`.

## Tooling

Maquettekit tools run through one dispatcher: `node "${CLAUDE_PLUGIN_ROOT}/tools/maquettekit.mjs" <command>`. On hosts
that do not substitute that variable (Codex), the same file is `../../tools/maquettekit.mjs` relative to this
SKILL.md. Below, `maquettekit <command>` is shorthand for that invocation. Details: `${CLAUDE_PLUGIN_ROOT}/shared/tooling.md`.
`maquettekit launch` needs no browser and no optional dependency.

## Workflow

1. **Build for production.** Use the production build — `npm run build` then the framework's start or preview
   command, or the static export folder. The dev server injects scripts and differs in headers and size. If the
   project deploys from a monorepo sub-folder, also build that folder on its own (`npm install` inside it on a clean
   checkout): hosts like Vercel install only that folder's dependencies, which is where launch-day build failures
   come from. See `references/launch-checklist.md` §5.
2. **Measure.** `maquettekit launch --url <preview-url> --routes /,/pricing,…` (or `--serve <export-dir>`). It checks
   every route for title and description, `lang`, viewport, canonical, one `<h1>`, Open Graph and Twitter tags, a
   reachable 1200×630 share image, favicon and apple-touch icon, `noindex`, robots.txt and sitemap, whether a missing
   page answers 404, and page weight. Results: `.maquettekit/launch/launch.md`.
3. **Fix majors, then minors**, with the framework's own mechanism (`references/launch-checklist.md` §2): Next.js
   `metadata` / `generateMetadata`, `app/icon.*`, `app/opengraph-image.*`, `app/robots.ts`, `app/sitemap.ts`;
   Astro and other static sites write the tags in the layout and ship `public/robots.txt`, `public/sitemap.xml` and a
   `404.html`. Set an absolute base URL once (`metadataBase` in Next.js) so canonical and image URLs are absolute.
4. **Design the share image** (`references/launch-checklist.md` §3): 1200×630, the product's own typography and
   colours from `maquettekit.design.json`, the real product or a single clear statement, legible at 300 px wide,
   under 300 KB. Never a stock collage, never text in the outer 60 px where platforms crop.
5. **Re-measure** with `maquettekit launch` until no major finding remains, then run `maquettekit check` for
   rendering, accessibility and layout on the same build.
6. **Report**: what was added or changed per route, the remaining minors with reasons, and what was not checked
   here (absolute URLs on the production host, real-network performance, search-console verification).

## Non-negotiables

- [ ] Every public route has a specific `<title>` (≤ 65 characters) and a description (50–170 characters) written for
      that page — not one site-wide string.
- [ ] `<html lang>`, a `width=device-width` viewport, and exactly one `<h1>` per page.
- [ ] A share image of at least 1200×630 that loads from the page's own host, plus `og:title`, `og:description` and
      `twitter:card`.
- [ ] A favicon (SVG or 32×32 PNG) and a 180×180 apple-touch icon.
- [ ] A URL that does not exist answers HTTP 404 with a page that links home — never a 200 "soft 404".
- [ ] Production is not blocked from search: no `noindex`, no `Disallow: /` for all crawlers (staging may be).
- [ ] Initial page weight is within budget (default 1.5 MB uncompressed) or the overage is reported with its cause.
- [ ] No invented claims in metadata: descriptions and share images follow the same honesty rules as the page.

## Reference files

| File | Load when |
|---|---|
| `references/launch-checklist.md` | Step 1 (monorepo builds), step 3 (per-framework metadata), step 4 (share image), and for anything `launch` cannot check over HTTP |
| `${CLAUDE_PLUGIN_ROOT}/shared/performance.md` | The page-weight finding needs a plan |
| `${CLAUDE_PLUGIN_ROOT}/shared/accessibility.md` | Before handing over to `studio-review` |

## Expected deliverables

- Metadata, icons, share image, robots.txt, sitemap and 404 page in the project's framework conventions.
- `.maquettekit/launch/launch.md` from the final run with no major findings, or each remaining one explained.
- A short launch note: routes covered, changes made, what to verify on the production domain after deploying.

## Validation

1. `maquettekit launch --url <production-preview> --routes <every public route>` exits 0 (no major findings), or the
   report lists each remaining major with the user's decision.
2. The production build itself ran (`npm run build` or the framework equivalent) without errors.
3. `maquettekit check` ran on the same build and its critical items are fixed.
4. You opened the share image file and confirmed it is 1200×630 and legible at small size, or you say you could not.

Never write that a check passed unless it ran in this session and you saw the output.
