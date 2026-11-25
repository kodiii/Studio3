import { SPECIALTIES, type Specialty } from '@maquettekit/library/types';

export { SPECIALTIES };

/** Public URL of this gallery: canonical links, share images and the sitemap are absolute against it. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maquettekit.vercel.app').replace(/\/$/, '');

/** Shorten to a search-snippet length at a word boundary. */
const clip = (text: string, max = 160): string => (text.length <= max ? text : `${text.slice(0, text.lastIndexOf(' ', max - 1)).replace(/[,;:.\s—-]+$/, '')}…`);
const SHARE_IMAGE = { url: '/opengraph-image', width: 1200, height: 630, alt: 'Maquettekit — design, motion and 3D skills for coding agents' };

/**
 * Per-page metadata with its own canonical URL and link-preview text. Next replaces (does not merge) a parent's
 * openGraph, so the site share image is named again here.
 */
export function pageMeta({ title, description, path }: { title?: string; description?: string; path: string }) {
  const desc = description ? clip(description) : undefined;
  return {
    ...(title ? { title } : {}),
    ...(desc ? { description: desc } : {}),
    alternates: { canonical: path },
    openGraph: { siteName: 'Maquettekit', type: 'website' as const, url: path, images: [SHARE_IMAGE], ...(title ? { title: `${title} · Maquettekit` } : {}), ...(desc ? { description: desc } : {}) },
    twitter: { card: 'summary_large_image' as const, images: [SHARE_IMAGE.url], ...(title ? { title: `${title} · Maquettekit` } : {}), ...(desc ? { description: desc } : {}) },
  };
}

/** Public source repository (also used for the GitHub links in the header, footer and home page). */
export const REPO_URL = 'https://github.com/kodiii/Studio3';
export const specialtyIndex = (id: Specialty): string => String(SPECIALTIES.findIndex((s) => s.id === id) + 1).padStart(2, '0');

export const MODULES = [
  { id: 'motion-lab', name: 'Motion Lab', skill: 'studio-motion', line: 'Tokens, orchestration and the recipe catalogue every specialty animates with.' },
  { id: 'visual-director', name: 'Visual Director', skill: 'studio-review', line: 'Playwright captures, deterministic checks, 3D diagnostics, before/after reports.' },
  { id: 'experience-lab', name: 'Experience Lab', skill: 'studio-experience', line: 'Transparent heuristic scoring across fourteen interaction dimensions.' },
  { id: 'design-intelligence', name: 'Design Intelligence', skill: 'studio-design-system', line: 'A brief in, a persisted design system out: maquettekit.design.json.' },
  { id: 'library', name: 'Component & Effect Library', skill: 'studio-components', line: 'The source behind this gallery, shipped inside the plugin.' },
] as const;

export const TECH_LABEL: Record<string, string> = {
  css: 'CSS', waapi: 'Web Animations', 'view-transitions': 'View Transitions', motion: 'Motion', gsap: 'GSAP', svg: 'SVG',
  canvas2d: 'Canvas 2D', d3: 'D3', three: 'three.js', r3f: 'React Three Fiber', drei: 'Drei', rapier: 'Rapier', glsl: 'GLSL',
};
export const isWebGL = (tech: readonly string[]): boolean => tech.some((t) => t === 'three' || t === 'r3f' || t === 'glsl' || t === 'drei' || t === 'rapier');
