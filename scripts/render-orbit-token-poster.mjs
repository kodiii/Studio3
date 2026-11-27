#!/usr/bin/env node
// @ts-check
/**
 * Renders the 3D social post's poster — apps/gallery/public/models/orbit-token.png (512²) and orbit-token.webp
 * (1024², the manifest's fallback image) — from the delivered desktop variant, with the live view's scene:
 * the "observatory" environment and lights, the opening camera, the brass finish and the poster box, all read from
 * plugins/maquettekit/library/src/demos/social/3d-social-post/tokenScene.ts. The token is drawn alone on a
 * transparent background (the frame's night sky, floor glow and contact shadow come from the page); the camera's
 * view offset crops the 4:5 frame to the poster's square, so the photo and the first 3D frame line up.
 *
 * Run after the asset pipeline (assets/models/README.md), from the repo root; needs Node ≥ 22.18 (type stripping):
 *   node scripts/render-orbit-token-poster.mjs
 * Renders with headless Chromium + three.js from node_modules, served from 127.0.0.1; nothing is fetched from the
 * network. Also records the poster in orbit-token.variants.report.{json,md}.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { launchBrowser } from '../plugins/maquettekit/tools/lib/browser.mjs';
import { serveStatic } from '../plugins/maquettekit/tools/lib/static-server.mjs';
import { resolveThreeRoot, stageThree } from '../plugins/maquettekit/tools/asset-pipeline/thumbnail.mjs';
import * as tokenScene from '../plugins/maquettekit/library/src/demos/social/3d-social-post/tokenScene.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = path.join(REPO, 'apps/gallery/public/models');
const GLB = path.join(MODELS, 'orbit-token.desktop.glb');
const PNG = path.join(MODELS, 'orbit-token.png');
const WEBP = path.join(MODELS, 'orbit-token.webp');
const RENDER = 2048; // supersampled, then reduced to 1024 (WebP) and 512 (PNG)

const cfg = {
  size: RENDER, preset: tokenScene.OBSERVATORY, camera: tokenScene.CAMERA, target: tokenScene.TARGET, scale: tokenScene.MODEL_SCALE,
  brass: tokenScene.BRASS, frameAspect: tokenScene.FRAME_ASPECT, posterWidth: tokenScene.POSTER_WIDTH,
  envSize: 256, // LightingRig's PMREM size (three never goes below 256)
};

// Mirrors the live view: R3F's renderer defaults (sRGB output, ACES Filmic), LightingRig's generated environment and
// direct lights, <Model scale>, OrbitInspect's look-at target, and BrassFinish's material.
const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>orbit-token poster</title>
<style>html,body{margin:0;background:transparent}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"./three/build/three.module.js","three/addons/":"./three/examples/jsm/"}}</script>
</head><body><script type="module">
const cfg = ${JSON.stringify(cfg)};
try {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(cfg.size, cfg.size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = cfg.preset.exposure;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const p = cfg.preset;
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: p.env.room, side: THREE.BackSide })));
  for (const panel of p.env.panels) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(panel.size[0], panel.size[1]),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(panel.color).multiplyScalar(panel.intensity), side: THREE.DoubleSide }));
    m.position.set(...panel.position); m.lookAt(0, 0, 0); env.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.035, 0.1, 100, { size: cfg.envSize }).texture;
  scene.environmentIntensity = p.env.intensity;
  scene.add(new THREE.AmbientLight(p.ambient.color, p.ambient.intensity));
  for (const l of [p.key, p.fill, p.rim]) {
    if (!l) continue;
    const d = new THREE.DirectionalLight(l.color, l.intensity); d.position.set(...l.position); scene.add(d); // target: origin, as in R3F
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync('./model.glb');
  const group = new THREE.Group(); group.scale.setScalar(cfg.scale); group.add(gltf.scene); scene.add(group);
  const b = cfg.brass;
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(...b.color), metalness: b.metalness, roughness: b.roughness, clearcoat: b.clearcoat,
      clearcoatRoughness: b.clearcoatRoughness, envMapIntensity: b.envMapIntensity, side: o.material.side,
    });
  });

  // The 4:5 frame, of which the poster is the centred square posterWidth wide: render just that square.
  const camera = new THREE.PerspectiveCamera(cfg.camera.fov, cfg.frameAspect, cfg.camera.near, cfg.camera.far);
  camera.position.set(...cfg.camera.position);
  camera.lookAt(...cfg.target);
  const fullW = cfg.size / cfg.posterWidth; const fullH = fullW / cfg.frameAspect;
  camera.setViewOffset(fullW, fullH, (fullW - cfg.size) / 2, (fullH - cfg.size) / 2, cfg.size, cfg.size);

  await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  window.__poster = { ok: true, dataUrl: canvas.toDataURL('image/png'), three: THREE.REVISION,
    renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown' };
} catch (err) { window.__poster = { ok: false, error: String(err && err.stack || err) }; }
</script></body></html>`;

const threeRoot = resolveThreeRoot();
if (!threeRoot) throw new Error('three.js is not installed (npm ci).');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-token-poster-'));
/** @type {any} */ let browser = null; /** @type {any} */ let server = null;
try {
  stageThree(threeRoot, dir, { draco: false, ktx2: false });
  fs.copyFileSync(GLB, path.join(dir, 'model.glb'));
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  browser = await launchBrowser({});
  server = await serveStatic(dir);
  const page = await (await browser.newContext({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 1 })).newPage();
  await page.goto(`${server.url}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction('window.__poster !== undefined', undefined, { timeout: 120_000 });
  const res = /** @type {any} */ (await page.evaluate('window.__poster'));
  if (!res.ok) throw new Error(`Poster render failed: ${res.error}`);
  const full = Buffer.from(String(res.dataUrl).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(PNG, await sharp(full).resize(512, 512, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer());
  fs.writeFileSync(WEBP, await sharp(full).resize(1024, 1024, { kernel: 'lanczos3' }).webp({ quality: 88 }).toBuffer());

  // Record it in the variant report, replacing the pipeline's generic preview entry.
  const reportJson = path.join(MODELS, 'orbit-token.variants.report.json');
  const reportMd = path.join(MODELS, 'orbit-token.variants.report.md');
  const report = JSON.parse(fs.readFileSync(reportJson, 'utf8'));
  report.thumbnail = {
    status: 'ok', thumbnail: 'orbit-token.png', thumbnailSize: 512, fallbackImage: 'orbit-token.webp', fallbackSize: 1024,
    renderedFrom: 'orbit-token.desktop.glb', renderedBy: 'scripts/render-orbit-token-poster.mjs',
    note: 'Poster for the 3D social post: rendered with the live view\'s environment, lights, camera and brass finish (tokenScene.ts), cropped to the poster box, not the pipeline\'s neutral preview.',
    renderer: res.renderer, three: res.three,
  };
  fs.writeFileSync(reportJson, `${JSON.stringify(report, null, 2)}\n`);
  const md = fs.readFileSync(reportMd, 'utf8').replace(/^- Thumbnail: .*$/m,
    '- Thumbnail: ok — `orbit-token.png`, fallback `orbit-token.webp` — the 3D post\'s poster, rendered by `scripts/render-orbit-token-poster.mjs` with the live view\'s scene');
  fs.writeFileSync(reportMd, md);
  console.log(`orbit-token poster: ${path.relative(REPO, PNG)} (512²), ${path.relative(REPO, WEBP)} (1024²) — ${res.renderer}, three r${res.three}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await server.close().catch(() => {});
  fs.rmSync(dir, { recursive: true, force: true });
}
