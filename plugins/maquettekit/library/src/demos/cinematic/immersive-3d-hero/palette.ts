/**
 * Kelda Ridge's night is an image, not a theme: the journey is staged at dusk → night in both gallery themes, so the
 * aurora always reads. These are the scene's "film stock" colours, shared by the live scene and the SVG poster. DOM
 * text over the stage uses the night tokens in styles.module.css (contrast checked against the brightest sky).
 */
export const NIGHT = {
  /** Sky at dusk (hero, lake) and at full night (ridge, sky); the afterglow sits on the north-west horizon. */
  duskTop: '#121c36',
  duskHorizon: '#33304c',
  afterglow: '#9c5038',
  nightTop: '#02040a',
  nightHorizon: '#0a111f',
  /** Aurora: oxygen green at the lower edge, violet tops, a rose fringe where the curtain folds. */
  aurGreen: '#47f59b',
  aurViolet: '#7a46d8',
  aurRose: '#ff5c8a',
  /** Ground drawn as contours: index lines pale, minor lines cool grey, the lake darker than the land. */
  groundDusk: '#0d1323',
  groundNight: '#060910',
  line: '#3a4964',
  index: '#9db0d0',
  water: '#03060c',
  /** The walking route and cairns (red head-torch light) and the warm beam of the torch itself. */
  route: '#ff5a2b',
  torch: '#ffb26b',
  star: '#e6edf8',
} as const;

/** Where each named stop sits on the camera path (0–1): drives the colour script when the camera cuts. */
export const STOP_U = { overview: 0, lake: 1 / 3, ridge: 2 / 3, sky: 1 } as const;
