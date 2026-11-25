# Launch checklist

## 1. What `maquettekit launch` measures

| Check | Major when | Why it matters |
|---|---|---|
| `title` | missing | Tab, bookmark, search result headline; > 65 characters is truncated (minor) |
| `meta-description` | missing | Search snippet and link-preview text; 50–170 characters (minor outside) |
| `lang`, `viewport` | missing | Screen-reader pronunciation and translation; mobile layout width |
| `canonical` | — (minor) | Without it, `?utm=` and trailing-slash variants split ranking; must be absolute |
| `h1` | — (minor) | Exactly one per page: the page's subject for assistive tech and search |
| `noindex` | present | Keeps the page out of search — right for staging, wrong for launch (`--allow-noindex` for staging checks) |
| `og-image` | missing, broken or not an image | The picture every chat app and social network shows; < 1200×630, > 1 MB or a relative URL are minor |
| `open-graph`, `twitter-card` | — (minor) | Titles and card size in previews |
| `favicon` | missing | Tabs, bookmarks, history; `apple-touch-icon` (minor) for home screens |
| `robots-txt` | `Disallow: /` for everyone | Blocks all crawling; a missing robots.txt and sitemap are minor |
| `not-found` | a missing URL answers 200 | "Soft 404s" get indexed and users cannot tell a broken link from a page |
| `page-weight` | — (minor) | Uncompressed bytes the first view references (HTML, CSS, scripts, eager images) over `--budget-kb` |

It fetches only the target's own origin. An `og:image` on the production domain is listed as "not checked here" —
check it once after deploying. Link previews are fetched by crawlers that **do not run JavaScript**: metadata must be
in the server-rendered or prerendered HTML.

## 2. Metadata per framework

**Next.js (App Router).** In `app/layout.tsx`: `export const metadata = { metadataBase: new URL('https://example.com'),
title: { default, template: '%s · Brand' }, description, openGraph: { siteName, type: 'website' }, twitter: { card:
'summary_large_image' } }`; per page `export const metadata` or `generateMetadata()` with `alternates: { canonical:
'/path' }`. File conventions do the rest: `app/icon.svg` (or `icon.png`), `app/apple-icon.png` (180×180),
`app/opengraph-image.tsx` (an `ImageResponse` from `next/og`, 1200×630; one per route segment if pages differ),
`app/robots.ts`, `app/sitemap.ts`, `app/not-found.tsx` (served with 404). `metadataBase` makes every image and
canonical URL absolute.

**Next.js (Pages Router).** `<Head>` from `next/head` in each page or a shared component; `pages/404.tsx`;
`public/robots.txt`, `public/favicon.ico`, a generated or static `public/sitemap.xml`.

**Astro.** Tags in the base layout's `<head>` from page props; `src/pages/404.astro`; `public/robots.txt`;
`@astrojs/sitemap` if the project already uses integrations, otherwise a static `public/sitemap.xml`.

**SvelteKit.** `<svelte:head>` per route, `+error.svelte` (status from `$page.status`), `static/robots.txt`; with the
static adapter set `fallback: '404.html'` and make sure the host serves it with status 404.

**Vite / single-page apps.** Static tags in `index.html` serve every route, so per-route previews need prerendering
(or an SSR framework). Hosts that rewrite every path to `index.html` produce soft 404s: configure unknown paths to
return 404, or prerender a `404.html` and an explicit route list.

## 3. The share image

- 1200×630 (1.91:1), PNG or JPEG, ≤ 300 KB (1 MB is the hard ceiling for some platforms), absolute URL.
- Keep text and logos out of the outer 60 px — platforms crop to squares and rounded corners.
- One message, legible at 300 px wide: the product's real UI or object, or one sentence in the display face. Colours
  and type from `maquettekit.design.json`; contrast as for body text.
- Per-page images when pages differ in purpose (pricing vs a post); one site image otherwise.
- Same honesty rules as the page: no invented ratings, logos or numbers.
- Make it from code so it stays current: Next.js `opengraph-image.tsx`; elsewhere a 1200×630 HTML page in the
  project's styles captured with a headless browser, committed as a static file.

## 4. Icons

- `favicon.svg` (it can switch colours with `@media (prefers-color-scheme: dark)`), plus `favicon.ico` 32×32 for
  old browsers and some crawlers.
- `apple-touch-icon.png` 180×180, opaque background, 10 % padding.
- Installable apps: a web manifest with 192×192 and 512×512 icons, one of them `purpose: "maskable"`.

## 5. Deploy gotchas

- **Monorepos.** A host building `apps/web` as its root directory installs only that folder's `package.json`
  dependencies. Build-time tools used by its build (TypeScript, type packages, PostCSS plugins) must be declared
  there, not only at the repository root. Reproduce with `npm install && npm run build` inside the folder on a clean
  checkout.
- **Environment variables** that are inlined at build time (`NEXT_PUBLIC_*`, `VITE_*`) must exist in the build
  environment, not only at runtime.
- **Preview vs production.** Previews are often `noindex` on purpose; confirm production is not.
- **Trailing slashes and base paths** must match between canonical URLs, sitemap entries and the host config.
- **Caching.** Hashed assets can be cached for a year; HTML should revalidate.

## 6. Not checked by the tool

Production DNS and HTTPS, real-network performance (use the host's analytics or a lab tool on the deployed URL),
structured data, search-console verification, analytics and consent banners, and how each social platform renders
the card (use their preview debuggers after deploying). Say which of these you did not verify.
