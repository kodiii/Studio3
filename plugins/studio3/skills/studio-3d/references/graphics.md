# Graphics — shaders, colour, geometry, particles, environments, effects

Good materials and light make most scenes; custom shaders are for what materials cannot do. Every snippet here was
written against three 0.187 and `@react-three/fiber` 9.8; re-check chunk and class names after an upgrade.

## 1. Choose the shader route

| Route | Use when | Keeps three's lighting, shadows, fog | Fragility |
|---|---|---|---|
| Built-in materials (`MeshStandardMaterial`, `MeshPhysicalMaterial`) | Anything that should look like a real material | Yes | None |
| `onBeforeCompile` patch of a built-in material | A small change to a lit material: reveal, dissolve, sway, tinting by height | Yes | Patches `#include <chunk>` names, which change between releases (`output_fragment` became `opaque_fragment` in r154) |
| `ShaderMaterial` | Unlit or stylised surfaces, full-screen backgrounds, particles | No (write your own) | Low; three still injects matrices, attributes, precision and the `#include` library |
| `RawShaderMaterial` | You need complete control of the source, including precision and attributes | No | You declare everything |
| Node materials / TSL (`three/webgpu`, `three/tsl`) | You render with `WebGPURenderer` | Yes (node versions) | Does not run on `WebGLRenderer`; GLSL materials and `onBeforeCompile` do not run on `WebGPURenderer` |

## 2. `ShaderMaterial` in R3F

Uniforms live in one memoised object; mutate `.value`, never recreate the object (that recompiles nothing, but
loses the binding). Request frames yourself in demand mode.

```tsx
'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Color } from 'three';
import { useStudioMotion } from './motion';

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uInk;
uniform vec3 uGlow;
varying vec2 vUv;
void main() {
  float band = 0.5 + 0.5 * sin(vUv.y * 12.0 + uTime);
  gl_FragColor = vec4(mix(uInk, uGlow, band * vUv.x), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function BandedPlane({ ink, glow, animate }: { ink: string; glow: string; animate: boolean }) {
  const { reduced } = useStudioMotion();
  const invalidate = useThree((s) => s.invalidate);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uInk: { value: new Color() }, uGlow: { value: new Color() } }), []);
  useEffect(() => { uniforms.uInk.value.set(ink); uniforms.uGlow.value.set(glow); invalidate(); }, [ink, glow, uniforms, invalidate]);
  const running = animate && !reduced; // decorative motion: tier 1, removed under reduced motion
  useEffect(() => { invalidate(); }, [running, invalidate]);
  useFrame((state, dt) => {
    if (!running) return;
    // Wrap at a multiple of 2π: no visible jump, and small numbers keep mediump GPUs precise.
    uniforms.uTime.value = (uniforms.uTime.value + Math.min(dt, 1 / 30)) % (Math.PI * 200);
    state.invalidate();
  });
  return (
    <mesh>
      <planeGeometry args={[2, 1]} />
      <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} />
    </mesh>
  );
}
```

- End custom fragment shaders with `#include <tonemapping_fragment>` (only if the surface should be tone-mapped)
  and `#include <colorspace_fragment>` (always, so output is sRGB like everything else).
- `new Color('#hex')` converts sRGB to three's linear working space; the colour-space chunk converts back. Do not
  gamma-correct by hand.
- Do not hard-code `precision highp float;`: three prepends the renderer's precision. (The `shader-aurora-plane`
  recipe does; harmless under WebGL 2, where fragment `highp` is guaranteed, but it overrides a `mediump` choice.)

## 3. Patching a lit material with `onBeforeCompile`

```tsx
import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';

/** A height-based reveal on a standard material. Animate `uniforms.uReveal.value` (0 = hidden). */
export function useRevealMaterial(color: string) {
  const result = useMemo(() => {
    const uniforms = { uReveal: { value: 0 } };
    const material = new MeshStandardMaterial({ color, roughness: 0.6 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uReveal = uniforms.uReveal;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vHeight;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeight = position.y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uReveal;\nvarying float vHeight;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vHeight > uReveal) discard;');
    };
    material.customProgramCacheKey = () => 'reveal-v1'; // distinct program per patch
    return { material, uniforms };
  }, [color]);
  useEffect(() => () => result.material.dispose(), [result]); // a prop-passed material is not disposed by R3F
  return result;
}
```

Use it as `<mesh material={result.material}>`. Assert that each `replace` found its chunk in development
(`shader.fragmentShader.includes(...)`): a silent miss renders the unpatched material. `dispose()` frees GPU
memory only; three re-uploads the object if it is rendered again, so StrictMode's re-run is safe here.

## 4. Node materials and TSL (WebGPU path)

Only behind `detectWebGPU()`, with the WebGL scene as the default, tested path. `WebGPURenderer` falls back to its
own WebGL 2 backend when no adapter exists, so a TSL scene can run without WebGPU, but it is still a separate code
path from GLSL and from the three-kit components (`LightingRig` uses the WebGL `PMREMGenerator`). The node
postprocessing class is `RenderPipeline` in 0.187 (`PostProcessing` is its deprecated alias since r183).

Pattern: resolve `detectWebGPU()` once in an effect (keep the poster on screen meanwhile); when it reports no
adapter, render the WebGL scene; when it does, render `StudioCanvas` with an async renderer factory —
`gl={async ({ canvas }) => { const { WebGPURenderer } = await import('three/webgpu'); const r = new
WebGPURenderer({ canvas: canvas as HTMLCanvasElement, antialias: true }); await r.init(); return r; }}` (R3F 9
accepts a promise-returning `gl`). Studio³'s automated tests never exercise this path (headless CI has no adapter):
verify on real devices and say so.

```ts
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { color, mix, sin, time, uv } from 'three/tsl';

export function makePulseMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ roughness: 0.4 });
  material.colorNode = mix(color('#0f6b57'), color('#ff4a1c'), sin(time.add(uv().y.mul(6))).mul(0.5).add(0.5));
  return material;
}
```

## 5. Colour management and tone mapping

| Setting | R3F `Canvas` default | Change when |
|---|---|---|
| Output colour space | sRGB | Never for normal pages (`linear` prop turns it off) |
| Tone mapping | ACES Filmic | `flat` → no tone mapping (UI-like colours, exact brand swatches); `gl.toneMapping = AgXToneMapping` or `NeutralToneMapping` for gentler highlight roll-off |
| Exposure | 1 | `LightingRig` sets `toneMappingExposure` per preset; it has no effect with `flat` |
| `ColorManagement.enabled` | true | Never |

- Colour textures (base colour, emissive) are `SRGBColorSpace`; data textures (normal, roughness, metalness,
  occlusion) have no colour space. `GLTFLoader` tags them; you tag textures you load yourself.
- ACES shifts saturated brand colours. Check swatches after tone mapping; for elements that must match a token
  exactly (a sun disc, a UI marker), set `toneMapped={false}` on that material.
- `Color.setHSL(h, s, l)` works in the linear working space; pass `SRGBColorSpace` as the fourth argument to match
  CSS `hsl()`.

## 6. Procedural geometry

- Build `BufferGeometry` from typed arrays; call `computeVertexNormals()` for lit surfaces and
  `computeBoundingSphere()` after editing positions (culling and raycasting use it).
- Seed variation deterministically (index-based hashes, golden-angle spirals); `Math.random()` in render changes the
  scene on every remount and breaks screenshot comparison.
- Extrusions and lathes (`ExtrudeGeometry`, `LatheGeometry`, `Shape`) cover most product primitives; scale segment
  counts with `useQuality().density`.

## 7. Instancing

One draw call for many copies of the same geometry and material. Working references: the `spatial-data` demo
(one instanced mesh per node shape, restyled by rewriting instance colours and matrices) and `scroll-camera-dolly`
(instanced columns written once in a layout effect).

- Write matrices with `setMatrixAt(i, object.matrix)` after `object.updateMatrix()`, colours with
  `setColorAt(i, colour)`, then set `instanceMatrix.needsUpdate` (and `instanceColor.needsUpdate`) and call
  `invalidate()`.
- Call `computeBoundingSphere()` after placing instances so culling uses their real spread, or set
  `frustumCulled={false}` when they move every frame.
- Derive the count from `useQuality().density`; layouts from deterministic sequences (golden-angle spirals,
  index hashes), never `Math.random()` in render.

- Changing `args` recreates the mesh; to vary the visible number, allocate the maximum and set `mesh.count`.
- Different geometries sharing one material: `BatchedMesh`. Drei's `<Instances>`/`<Merged>` are declarative
  wrappers when per-instance React components are worth their cost.

## 8. GPU particles

Move particles in the vertex shader from time and a per-particle seed; the CPU writes one uniform per frame.

```glsl
attribute float aSeed;               // per-particle random in 0..1, generated once (seeded)
uniform float uTime, uSize, uPixelRatio;
varying float vFade;
void main() {
  vec3 p = position;
  float t = uTime * (0.2 + aSeed * 0.3);
  p.y = mod(p.y + 2.0 + t, 4.0) - 2.0;            // rise and wrap, entirely on the GPU
  p.x += sin(t * 2.0 + aSeed * 6.2831) * 0.15;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio / -mv.z;      // size attenuation; uPixelRatio from useThree(s => s.viewport.dpr)
  vFade = 1.0 - abs(p.y) / 2.0;
}
```

On the CPU side: build the `BufferGeometry` (positions plus the `aSeed` attribute) in `useMemo` keyed on the count
and dispose it in an effect cleanup (a prop-passed geometry is not disposed by R3F); render `<points>` with a
`shaderMaterial` (`transparent`, `depthWrite={false}`, `AdditiveBlending`, `frustumCulled={false}`); in `useFrame`
add the clamped `dt` to `uTime` and call `invalidate()` unless reduced motion holds the field still. Working code:
the `particle-field-gpu` recipe and the `particle-experience` demo (three forms morphing in the vertex shader).

- Count from `useQuality().density` (1 / 0.6 / 0.3 by default); fill rate, not vertex count, is the usual limit:
  large soft sprites with additive blending cost the most.
- GPUs cap `gl_PointSize` (query `ALIASED_POINT_SIZE_RANGE`); for big sprites use instanced quads.
- Ambient particles are tier 1: removed or frozen under reduced motion, and pausable when they run longer than
  five seconds alongside content (WCAG 2.2.2).

## 9. Environment lighting without remote HDRIs

| Source | Network | Notes |
|---|---|---|
| `LightingRig` (`studio-soft`, `product-contrast`, `warm-evening`, `technical-flat`, or a custom `LightingPreset`) | None | Emissive panels in a tinted room, prefiltered with `PMREMGenerator`. In 0.187 PMREM sizes are at least 256, so the low/medium profiles' `envResolution` (64/128) render at 256 |
| three `RoomEnvironment` (`three/addons/environments/RoomEnvironment.js`) + `PMREMGenerator.fromScene` | None | Neutral studio; good for vanilla scenes |
| Drei `<Environment>` with `<Lightformer>` children | None | Renders the children once into a cube target (`frames={1}` default; `Infinity` re-renders every frame — avoid) |
| Drei `<Environment preset="…">` | **Downloads** HDR files from `raw.githack.com` | Do not ship; self-host a file instead |
| Your own `.hdr`/`.exr` with `HDRLoader`/`EXRLoader` | Own origin | `RGBELoader` is deprecated since r180: use `HDRLoader` |

Local studio light with Drei: `<Environment resolution={256}>` containing `<Lightformer form="rect"
intensity={4} position={[0, 5, -2]} scale={[8, 3, 1]} />` children — rendered once, nothing downloaded.

## 10. Transmission, refraction and other expensive materials

- `MeshPhysicalMaterial` with `transmission > 0` makes the renderer draw the opaque scene into an extra render
  target every frame such a material is visible; `renderer.transmissionResolutionScale` (default 1) trades
  sharpness for cost. Drei's `MeshTransmissionMaterial` adds its own buffer render per material.
- Use transmission when glass or liquid is the product; elsewhere use opacity, clearcoat and roughness.
- `clearcoat`, `sheen`, `iridescence` and `anisotropy` each add shader work; gate them by quality level on
  surfaces that fill the screen.

## 11. Conditional postprocessing

Only when art direction names an effect materials cannot produce, and only where `useQuality().postprocessing` is
true (the `high` profile by default). `@react-three/postprocessing` is not installed in Studio³; three's own
composer needs no new dependency:

```tsx
'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Vector2 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { useQuality } from './three';

export function Bloom({ strength = 0.6 }: { strength?: number }) {
  const { postprocessing } = useQuality();
  return postprocessing ? <BloomComposer strength={strength} /> : null; // otherwise R3F renders normally
}

function BloomComposer({ strength }: { strength: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const invalidate = useThree((s) => s.invalidate);
  const { composer, bloom } = useMemo(() => {
    const c = new EffectComposer(gl);
    const b = new UnrealBloomPass(new Vector2(256, 256), 0.6, 0.4, 0.85);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(b);
    c.addPass(new OutputPass()); // tone mapping and sRGB conversion happen here, last
    return { composer: c, bloom: b };
  }, [gl, scene, camera]);
  useEffect(() => { bloom.strength = strength; invalidate(); }, [bloom, strength, invalidate]);
  useEffect(() => { composer.setPixelRatio(dpr); composer.setSize(size.width, size.height); invalidate(); }, [composer, size, dpr, invalidate]);
  useEffect(() => () => { for (const p of composer.passes) p.dispose(); composer.dispose(); }, [composer]);
  useFrame(() => composer.render(), 1); // priority > 0: this callback renders instead of R3F
  return null;
}
```

Demand mode still applies: the composer renders only on requested frames. Measure the cost on the target device
before keeping it; every pass is a full-screen draw at the current DPR.

## 12. Depth cues, transitions and precision

- **Depth without passes**: fog (`<fog attach="fog" args={[colour, near, far]} />`), atmospheric colour falloff,
  contact shadows, a little parallax between layers. Depth of field and ambient occlusion passes are `high` only.
- **Shader transitions** (dissolve, wipe, cross-fade between two textures): drive one `uProgress` uniform from a
  timeline (`animation.md`); under reduced motion set it to the end value in one frame. No white flashes or
  strobing: nothing may flash more than three times a second (WCAG 2.3.1).
- **Mobile precision**: `mediump` floats keep about three significant digits. Keep time uniforms small (wrap at a
  multiple of the period), keep world coordinates near the origin, avoid `fract(sin(x) * 43758.5453)` hashes on
  large inputs in fragment shaders, and keep the near/far ratio modest to avoid z-fighting.

## 13. Checklist

- [ ] The lightest route in §1 was used; custom shaders end with the colour-space chunk.
- [ ] Colour textures are sRGB, data textures linear; brand colours checked after tone mapping.
- [ ] No remote HDRI, decoder or font is fetched at runtime.
- [ ] Particle and instance counts come from the quality profile; decorative motion stops under reduced motion.
- [ ] Postprocessing, transmission and shadow maps are gated by profile and justified in the report.
