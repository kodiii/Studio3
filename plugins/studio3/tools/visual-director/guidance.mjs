// @ts-check
/**
 * Check catalogue and file-agnostic fix guidance, keyed by check id.
 * `kind` states how the result is produced:
 *   measured  — read directly from the browser (DOM geometry, network, computed style, API counters)
 *   heuristic — measured inputs combined with a rule of thumb; may produce false positives
 */
export const CHECKS = [
  { id: 'horizontal-overflow', title: 'Horizontal overflow', category: 'layout', kind: 'measured' },
  { id: 'clipped-content', title: 'Clipped text content', category: 'layout', kind: 'measured' },
  { id: 'broken-layout', title: 'Broken-layout heuristics', category: 'layout', kind: 'heuristic' },
  { id: 'failed-assets', title: 'Failed assets and network requests', category: 'assets', kind: 'measured' },
  { id: 'console-errors', title: 'Console errors and uncaught exceptions', category: 'runtime', kind: 'measured' },
  { id: 'accessibility-axe', title: 'Accessibility (axe-core, WCAG 2.x A/AA)', category: 'accessibility', kind: 'measured' },
  { id: 'keyboard-navigation', title: 'Keyboard navigation (Tab order, traps, reachability)', category: 'accessibility', kind: 'measured' },
  { id: 'focus-visible', title: 'Visible focus indicator', category: 'accessibility', kind: 'measured' },
  { id: 'dialog-focus', title: 'Dialog / menu focus management', category: 'accessibility', kind: 'measured' },
  { id: 'responsive', title: 'Responsive regressions (tap targets, fixed widths, viewport meta)', category: 'responsive', kind: 'measured' },
  { id: 'reduced-motion', title: 'Reduced-motion behaviour', category: 'motion', kind: 'measured' },
  { id: 'motion-summary', title: 'Motion behaviour summary', category: 'motion', kind: 'measured' },
  { id: 'state-capture', title: 'Interactive state capture', category: 'capture', kind: 'measured' },
  { id: 'video-capture', title: 'Video capture', category: 'capture', kind: 'measured' },
  { id: '3d-canvas-init', title: '3D: canvas / context initialisation', category: '3d', kind: 'measured' },
  { id: '3d-context-lost', title: '3D: context loss', category: '3d', kind: 'measured' },
  { id: '3d-assets', title: '3D: models and textures', category: '3d', kind: 'measured' },
  { id: '3d-budgets', title: '3D: draw calls, triangles, texture and geometry memory vs configured budgets', category: '3d', kind: 'measured' },
  { id: '3d-frame-time', title: '3D: frame-time stability (headless software rendering)', category: '3d', kind: 'measured' },
  { id: '3d-render-loop', title: '3D: render-loop behaviour when idle', category: '3d', kind: 'measured' },
  { id: '3d-resize', title: '3D: canvas resize behaviour', category: '3d', kind: 'measured' },
  { id: '3d-interaction', title: '3D: pointer / touch interaction errors', category: '3d', kind: 'measured' },
  { id: '3d-cleanup', title: '3D: scene cleanup on navigation', category: '3d', kind: 'measured' },
  { id: '3d-fallback', title: '3D: unsupported-device fallback', category: '3d', kind: 'heuristic' },
  { id: '3d-webgpu', title: '3D: WebGPU availability', category: '3d', kind: 'measured' },
];

export const CHECK_BY_ID = Object.fromEntries(CHECKS.map((c) => [c.id, c]));

/** File-agnostic guidance for the Improve → Retest loop. */
export const GUIDANCE = {
  'horizontal-overflow': 'Find the offending element listed in the evidence and remove the fixed width / negative margin / unbroken content that pushes it past the viewport. Prefer max-width: 100%, min-width: 0 on flex/grid children, flex-wrap, and overflow-wrap: anywhere for long strings. Do not hide the symptom with overflow-x: hidden on <body>.',
  'clipped-content': 'Text is cut off by an overflow: hidden/clip box. Let the container grow (remove the fixed height/width, use min-height), allow wrapping, or — if truncation is intended — use text-overflow: ellipsis and expose the full text (title / accessible name).',
  'broken-layout': 'Inspect the element in the evidence. Zero-size media usually means a missing src or collapsed container (set aspect-ratio or explicit dimensions); overlapping controls need layout (not absolute positioning) or spacing; text below 11px should be raised to a readable size; offscreen content should be either removed, hidden with the hidden attribute, or positioned intentionally.',
  'failed-assets': 'The request in the evidence failed. Fix the path (check base URL / public directory / case sensitivity), add the missing file, or remove the reference. For 3D models and textures verify the loader path and that the asset is shipped with the build.',
  'console-errors': 'Reproduce the error in the browser console on the listed route, read the stack trace, and fix the root cause. Guard optional browser APIs and null DOM lookups; do not silence errors with empty catch blocks.',
  'accessibility-axe': 'Follow the axe rule help URL in the evidence. Typical fixes: add alt text or aria-label, associate <label> with inputs, raise colour contrast to at least 4.5:1 (3:1 for large text), give the page a lang, title and landmarks, and use valid ARIA roles/attributes.',
  'keyboard-navigation': 'Every interactive element must be reachable and operable with the keyboard. Use native <button>/<a href> instead of clickable <div>s (or add role, tabindex="0" and Enter/Space handlers); remove focus traps outside modal dialogs; make sure Tab can leave every widget.',
  'focus-visible': 'Restore a visible focus indicator: remove outline: none or pair it with a :focus-visible style (outline or box-shadow with at least 3:1 contrast against adjacent colours).',
  'dialog-focus': 'When a dialog or menu opens, move focus into it (native <dialog>.showModal() does this), close it on Escape, and return focus to the element that opened it. Prefer native <dialog>/popover over custom implementations.',
  'responsive': 'Make touch targets at least 24×24 CSS px (44×44 recommended) or give them enough spacing; replace fixed pixel widths with fluid ones (max-width: 100%, clamp(), minmax()); include <meta name="viewport" content="width=device-width, initial-scale=1">.',
  'reduced-motion': 'Honour prefers-reduced-motion: wrap non-essential animation in @media (prefers-reduced-motion: no-preference) or disable/replace it under (prefers-reduced-motion: reduce); for JS-driven motion check window.matchMedia("(prefers-reduced-motion: reduce)") and render a static state. Opacity/colour fades are generally acceptable replacements for movement.',
  'motion-summary': 'Performance hint: animate transform and opacity instead of layout-triggering properties (width, height, top, left, margin…). Verify on real devices — headless timing is not representative.',
  'state-capture': 'An explicit state from --states could not be reached. Check the selectors and step order in the states file against the current markup.',
  'video-capture': 'Video capture needs the Playwright ffmpeg build (npx playwright install ffmpeg). It is optional; screenshots and animation frames are captured regardless.',
  '3d-canvas-init': 'The page requested a WebGL/WebGPU context and did not get one. Check context attributes, create the context once, handle a null return from getContext, and provide a fallback.',
  '3d-context-lost': 'Handle webglcontextlost (preventDefault) and webglcontextrestored (re-create GPU resources). Frequent loss usually means too many contexts or too much GPU memory.',
  '3d-assets': 'A model or texture failed to load. Fix the URL passed to the loader, ship the asset (and its .bin / texture dependencies), and add an error handler that shows a fallback instead of an empty scene.',
  '3d-budgets': 'The measured value exceeds the configured budget (a project setting, not a universal limit). Reduce draw calls by merging/instancing, simplify geometry or add LODs, and compress/resize textures (KTX2/Basis, smaller dimensions, fewer mip chains). Adjust the budget with --budgets if it does not fit the project.',
  '3d-frame-time': 'Frame intervals were measured in headless software rendering and are not representative of user devices. Use them only to spot regressions between passes; profile on real hardware before drawing conclusions.',
  '3d-render-loop': 'The scene keeps rendering while idle. If nothing is animating, render on demand (frameloop="demand" in React Three Fiber, or only call render() after input / camera / resize changes) and pause when the tab is hidden or the canvas is offscreen.',
  '3d-resize': 'On resize, update the drawing buffer to clientWidth × clientHeight × min(devicePixelRatio, cap), update the viewport and camera aspect, and re-render. A canvas whose attribute size has a different aspect ratio from its CSS size is stretched.',
  '3d-interaction': 'Pointer/touch input over the canvas raised errors. Guard handlers against missing intersections / null state, and register pointer events with touch-action set appropriately.',
  '3d-cleanup': 'Dispose geometries, materials, textures and the renderer, cancel the animation frame and remove listeners when the scene unmounts or the page is hidden. Expose window.__STUDIO3_3D__.disposed to make cleanup observable.',
  '3d-fallback': 'Detect a null/failed context and render fallback content (static image, poster or text) in the canvas container — mark it with data-studio3-fallback — instead of throwing. The rest of the page must stay usable without WebGL.',
  '3d-webgpu': 'WebGPU availability depends on the browser/GPU. Always feature-detect navigator.gpu and requestAdapter() and fall back to WebGL.',
};

/** @param {string} check */
export function guidanceFor(check) {
  return GUIDANCE[check] ?? 'Inspect the evidence, reproduce on the listed route and viewport, fix the root cause, then re-run the review.';
}
