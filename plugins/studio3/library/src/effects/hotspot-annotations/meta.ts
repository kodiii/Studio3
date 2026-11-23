import type { EffectMeta } from '../../types';

export const meta: EffectMeta = {
  id: 'hotspot-annotations',
  name: 'Hotspot Annotations',
  description: 'Four annotations anchored to a procedural field radio. Markers are projected on rendered frames only, fade and turn inert when the object hides them, and choosing one — from the marker or the always-readable list — glides the camera to frame it and opens its description. Esc returns to the full view.',
  category: 'spatial',
  specialties: ['3d', 'product'],
  technology: ['r3f', 'three'],
  interaction: ['press', 'keyboard', 'drag'],
  complexity: 3,
  intensity: 'moderate',
  applications: ['product feature tour', 'e-commerce detail viewer', 'museum or exhibit object notes', 'onboarding to a physical device'],
  dependencies: [
    { name: 'three', version: '^0.187.0' },
    { name: '@react-three/fiber', version: '^9.8.2' },
  ],
  params: [
    { key: 'glide', label: 'Glide time', type: 'number', default: 0.55, min: 0.2, max: 1.4, step: 0.05, unit: 's' },
    { key: 'labels', label: 'Always show labels', type: 'boolean', default: false },
    { key: 'numbering', label: 'Marker style', type: 'select', default: 'Numbers', options: ['Numbers', 'Letters'] },
    { key: 'selectOnFocus', label: 'Frame on keyboard focus', type: 'boolean', default: true },
  ],
  accessibility: [
    'The same four annotations are a real ordered list of disclosure buttons (aria-expanded / aria-controls) outside the canvas — the stable keyboard and screen-reader path; keyboard focus frames an item, Enter toggles it, Esc resets.',
    'Floating markers are pointer shortcuts only (tabindex=-1, aria-hidden), so nothing is announced twice; a polite live region confirms which feature is framed.',
    'Markers hidden behind the radio fade and become inert, so a faded, low-contrast marker can never be clicked or focused; the list always works.',
    'The canvas itself is focusable via the kit\'s OrbitInspect (arrows orbit, + / − zoom, 0 resets) and carries an accessible name; wheel zoom only applies while it has focus.',
    'Without WebGL a front-view SVG with the same numbering is shown and the list still opens every description.',
  ],
  reducedMotion: 'Camera moves become cuts (CameraRig with reduced motion), orbit damping is off and the marker fade transition is removed.',
  performance: [
    'frameloop="demand": frames render only during a camera glide or an orbit; marker projection and the four occlusion rays run inside those frames, so an idle scene costs nothing.',
    'About 16 draw calls: one rounded-box case, shared box geometry for panels, instanced feet and strap posts; perforations and the tuning scale are canvas textures drawn once.',
    'Generated environment lighting (LightingRig studio-soft, PMREM sized by quality); no shadow pass — a baked contact blob grounds the object.',
    'Every geometry, material and canvas texture created imperatively is disposed on unmount.',
  ],
  preview: { height: 560 },
};
