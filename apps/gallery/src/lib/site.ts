import { SPECIALTIES, type Specialty } from '@maquettekit/library/types';

export { SPECIALTIES };

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
