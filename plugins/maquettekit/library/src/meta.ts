/**
 * Catalogue metadata without the components: names, descriptions, params, technology, specialties.
 *
 * Use this — not `./registry` — wherever only metadata is needed, and always in React Server Components (Next.js App
 * Router pages, layouts, `generateStaticParams`, `generateMetadata`, sitemaps). The registry's lazy `load()` imports
 * point at 'use client' modules; imported on the server, each becomes a client reference of the page, and the page
 * then ships every recipe and demo (with three.js, GSAP and D3) in its first load. Client components that mount a
 * recipe use `./registry`, where `load()` stays a lazy chunk.
 */
import { demoMetas, effectMetas } from './meta.generated';
import type { DemoMeta, EffectMeta, Specialty } from './types';

export { demoMetas, effectMetas };
export const getEffectMeta = (id: string): EffectMeta | undefined => effectMetas.find((m) => m.id === id);
export const getDemoMeta = (specialty: string, id: string): DemoMeta | undefined => demoMetas.find((m) => m.specialty === specialty && m.id === id);
export const effectMetasFor = (specialty: Specialty): EffectMeta[] => effectMetas.filter((m) => m.specialties.includes(specialty));
export const demoMetasFor = (specialty: Specialty): DemoMeta[] => demoMetas.filter((m) => m.specialty === specialty);
