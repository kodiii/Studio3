// @ts-check
/**
 * `studio3 assets thumbnail` — render a preview PNG with headless Chromium + three.js.
 * Everything is served from a temporary directory on 127.0.0.1; nothing is uploaded
 * and nothing is fetched from the network. When the browser stack is unavailable
 * the result is an explicit `{ status: "skipped", reason }`, never a fake image.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveDep } from '../lib/resolve.mjs';
import { launchBrowser } from '../lib/browser.mjs';
import { serveStatic } from '../lib/static-server.mjs';
import { UserError } from '../lib/log.mjs';
import { readGltfJson, loadSharp } from './io.mjs';

/** @param {string} from @param {string} to */
function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

/**
 * Locate the three.js package root via its exported loader path.
 * @returns {string | null}
 */
export function resolveThreeRoot() {
  const loader = resolveDep('three/examples/jsm/loaders/GLTFLoader.js');
  if (!loader) return null;
  const root = path.resolve(path.dirname(loader), '..', '..', '..');
  return fs.existsSync(path.join(root, 'build', 'three.module.js')) ? root : null;
}

/**
 * Copy the three.js files the viewer page needs into `<dir>/three`.
 * @param {string} threeRoot @param {string} dir @param {{ draco: boolean, ktx2: boolean }} needs
 */
export function stageThree(threeRoot, dir, needs) {
  const dst = path.join(dir, 'three');
  const files = [
    'build/three.module.js', 'build/three.core.js',
    'examples/jsm/loaders/GLTFLoader.js', 'examples/jsm/utils/BufferGeometryUtils.js', 'examples/jsm/utils/SkeletonUtils.js',
    'examples/jsm/libs/meshopt_decoder.module.js', 'examples/jsm/environments/RoomEnvironment.js',
  ];
  if (needs.draco) files.push('examples/jsm/loaders/DRACOLoader.js', 'examples/jsm/libs/draco/gltf');
  if (needs.ktx2) files.push('examples/jsm/loaders/KTX2Loader.js', 'examples/jsm/utils/WorkerPool.js', 'examples/jsm/libs/ktx-parse.module.js', 'examples/jsm/libs/zstddec.module.js', 'examples/jsm/math/ColorSpaces.js', 'examples/jsm/libs/basis');
  for (const f of files) {
    const from = path.join(threeRoot, f);
    if (fs.existsSync(from)) copy(from, path.join(dst, f));
  }
  return dst;
}

/**
 * The viewer page. Reports through `window.__studio3Thumb`.
 * @param {{ model: string, size: number, background: string | null, draco: boolean, ktx2: boolean }} o
 */
export function viewerHtml(o) {
  const cfg = JSON.stringify(o);
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Studio³ thumbnail</title>
<style>html,body{margin:0;background:transparent}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"./three/build/three.module.js","three/addons/":"./three/examples/jsm/"}}</script>
</head><body>
<script type="module">
const cfg = ${cfg};
const fail = (error, extra = {}) => { window.__studio3Thumb = { ok: false, error: String(error && error.message || error), ...extra }; };
window.addEventListener('error', (e) => { if (!window.__studio3Thumb) fail(e.message || 'script error'); });
window.addEventListener('unhandledrejection', (e) => { if (!window.__studio3Thumb) fail(e.reason); });
try {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

  const canvas = document.createElement('canvas');
  canvas.width = cfg.size; canvas.height = cfg.size;
  document.body.appendChild(canvas);
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
  if (!gl) { fail('WebGL2 context could not be created', { webgl: false }); throw new Error('__handled'); }
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(cfg.size, cfg.size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  if (cfg.background) renderer.setClearColor(new THREE.Color(cfg.background), 1); else renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (cfg.draco) {
    const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
    loader.setDRACOLoader(new DRACOLoader().setDecoderPath('./three/examples/jsm/libs/draco/gltf/'));
  }
  if (cfg.ktx2) {
    const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
    loader.setKTX2Loader(new KTX2Loader().setTranscoderPath('./three/examples/jsm/libs/basis/').detectSupport(renderer));
  }
  const gltf = await loader.loadAsync(cfg.model);
  const model = gltf.scene;
  scene.add(model);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) { fail('Model has no renderable geometry'); throw new Error('__handled'); }
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const r = Math.max(sphere.radius, 1e-6);
  const fov = 30;
  const camera = new THREE.PerspectiveCamera(fov, 1, r / 50, r * 50);
  const dist = (r / Math.sin(THREE.MathUtils.degToRad(fov / 2))) * 1.04;
  const dir = new THREE.Vector3(0.62, 0.42, 1).normalize();
  camera.position.copy(sphere.center).addScaledVector(dir, dist);
  camera.lookAt(sphere.center);

  // Neutral three-point lighting, positioned relative to the bounding sphere.
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.copy(sphere.center).add(new THREE.Vector3(1.2, 1.8, 1.6).multiplyScalar(r * 3));
  const fill = new THREE.DirectionalLight(0xffffff, 0.8); fill.position.copy(sphere.center).add(new THREE.Vector3(-1.8, 0.6, 1.0).multiplyScalar(r * 3));
  const rim = new THREE.DirectionalLight(0xffffff, 1.4); rim.position.copy(sphere.center).add(new THREE.Vector3(-0.4, 1.4, -2.0).multiplyScalar(r * 3));
  for (const l of [key, fill, rim]) { l.target.position.copy(sphere.center); scene.add(l, l.target); }

  let meshes = 0; let triangles = 0;
  model.traverse((o) => { if (o.isMesh) { meshes++; const g = o.geometry; triangles += (g.index ? g.index.count : g.attributes.position.count) / 3; } });

  await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  renderer.render(scene, camera);
  gl.finish();
  window.__studio3Thumb = {
    ok: true, dataUrl: canvas.toDataURL('image/png'), meshes, triangles: Math.round(triangles),
    renderer: (() => { const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; })(),
    three: THREE.REVISION,
  };
} catch (err) {
  if (!window.__studio3Thumb) fail(err);
}
</script></body></html>`;
}

/** @param {string | undefined} bg */
export function parseBackground(bg) {
  if (bg === undefined || bg === null || bg === 'transparent' || bg === 'none') return null;
  if (typeof bg === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(bg)) return bg;
  throw new UserError(`--background must be "transparent" or a hex colour like '#1a1a1a' (got ${JSON.stringify(bg)}).`);
}

/**
 * Render a model to PNG bytes.
 * @param {string} file absolute .glb/.gltf path (read-only)
 * @param {{ size?: number, background?: string | null, timeoutMs?: number, gpu?: boolean }} [opts]
 * @returns {Promise<{ status: 'ok', png: Buffer, size: number, background: string | null, meshes: number, triangles: number, renderer: string, three: string, blank: boolean | null }
 *   | { status: 'skipped' | 'failed', reason: string }>}
 */
export async function renderThumbnail(file, opts = {}) {
  const size = opts.size ?? 512;
  if (!Number.isInteger(size) || size < 16 || size > 4096) throw new UserError(`--size must be an integer between 16 and 4096 (got ${opts.size}).`);
  const background = opts.background ?? null;

  const threeRoot = resolveThreeRoot();
  if (!threeRoot) return { status: 'skipped', reason: 'three.js is not installed (needed for the thumbnail viewer page); install it with "npm install -D three" or run "studio3 setup".' };
  if (!resolveDep('playwright')) return { status: 'skipped', reason: 'Playwright is not installed; run "studio3 setup" and "npx playwright install chromium".' };

  let json;
  try { json = readGltfJson(file); } catch (err) { throw new UserError(`${path.basename(file)} is not a readable glTF/GLB file: ${/** @type {any} */ (err).message}`); }
  const used = Array.isArray(json.extensionsUsed) ? json.extensionsUsed : [];
  const needs = { draco: used.includes('KHR_draco_mesh_compression'), ktx2: used.includes('KHR_texture_basisu') };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio3-thumb-'));
  /** @type {any} */ let browser = null;
  /** @type {any} */ let server = null;
  try {
    stageThree(threeRoot, dir, needs);
    const modelName = `model${path.extname(file).toLowerCase()}`;
    fs.copyFileSync(file, path.join(dir, modelName));
    // External resources of a .gltf are copied next to it (relative, local URIs only).
    for (const entry of [...(json.buffers ?? []), ...(json.images ?? [])]) {
      const uri = entry?.uri;
      if (typeof uri !== 'string' || uri.startsWith('data:') || /^[a-z][a-z0-9+.-]*:/i.test(uri)) continue;
      const from = path.resolve(path.dirname(file), decodeURIComponent(uri));
      const to = path.resolve(dir, decodeURIComponent(uri));
      if (fs.existsSync(from) && to.startsWith(dir + path.sep)) copy(from, to);
    }
    fs.writeFileSync(path.join(dir, 'index.html'), viewerHtml({ model: `./${modelName}`, size, background, ...needs }));

    try { browser = await launchBrowser({ gpu: opts.gpu }); }
    catch (err) { return { status: 'skipped', reason: String(/** @type {any} */ (err).message).split('\n')[0] }; }
    server = await serveStatic(dir);
    const context = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    /** @type {string[]} */
    const pageErrors = [];
    page.on('pageerror', (/** @type {any} */ e) => pageErrors.push(String(e?.message ?? e)));
    await page.goto(`${server.url}/index.html`, { waitUntil: 'load', timeout: 30_000 });
    let result;
    try {
      await page.waitForFunction('window.__studio3Thumb !== undefined', undefined, { timeout: opts.timeoutMs ?? 120_000 });
      result = await page.evaluate('window.__studio3Thumb');
    } catch {
      return { status: 'failed', reason: `Timed out waiting for the render${pageErrors.length ? ` (page errors: ${pageErrors.join(' | ')})` : ''}.` };
    }
    if (!result.ok) {
      if (result.webgl === false || /webgl/i.test(result.error ?? '')) return { status: 'skipped', reason: `WebGL is unavailable in this browser environment: ${result.error}` };
      return { status: 'failed', reason: `Render failed: ${result.error}` };
    }
    const png = Buffer.from(String(result.dataUrl).replace(/^data:image\/png;base64,/, ''), 'base64');
    // Blank detection (uniform image = nothing was drawn).
    /** @type {boolean | null} */
    let blank = null;
    const sharp = await loadSharp();
    if (sharp) {
      const stats = await sharp(png).stats();
      blank = stats.channels.every((/** @type {any} */ c) => c.stdev < 0.5);
    }
    if (blank) return { status: 'failed', reason: 'The render came back blank (uniform image); the model may be outside the camera frustum or fully transparent.' };
    return { status: 'ok', png, size, background, meshes: result.meshes, triangles: result.triangles, renderer: result.renderer, three: result.three, blank };
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await server.close().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
