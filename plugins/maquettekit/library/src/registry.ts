import { demos, effects } from './registry.generated';
import type { DemoEntry, EffectEntry, Specialty } from './types';

export { demos, effects };
export const getEffect = (id: string): EffectEntry | undefined => effects.find((e) => e.meta.id === id);
export const getDemo = (specialty: string, id: string): DemoEntry | undefined => demos.find((d) => d.meta.specialty === specialty && d.meta.id === id);
export const effectsFor = (specialty: Specialty): EffectEntry[] => effects.filter((e) => e.meta.specialties.includes(specialty));
export const demosFor = (specialty: Specialty): DemoEntry[] => demos.filter((d) => d.meta.specialty === specialty);
