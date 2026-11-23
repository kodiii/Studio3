# Using the outputs at runtime

## Decoders

Register only the decoders the manifest lists for the chosen variant (`variants[].decoders`):

```ts
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder); // EXT_meshopt_compression
// Draco:  loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/gltf/'))
// KTX2:   loader.setKTX2Loader(new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer))
```

Serve Draco/Basis WASM files from your own origin. A file with a *required* extension does not load without its
decoder: keep the manifest's `fallbackImage` ready. Verify import paths against the installed three.js version.

In Studio³ React projects use the three-kit's model loading (`library/src/three/components`), which wires the meshopt
decoder, selects the variant from the active quality profile and reports load errors to the StudioCanvas fallback.

## Picking a variant

```ts
type Variant = { profile: string; file: string; bytes: number; triangles: number; decoders: string[] };
const byProfile = { high: 'desktop', medium: 'mobile', low: 'low-power' } as const;
function pickVariant(variants: Variant[], quality: keyof typeof byProfile): Variant {
  return variants.find((v) => v.profile === byProfile[quality]) ?? variants[0];
}
```

The kit's quality profiles map `high → desktop`, `medium → mobile`, `low → low-power` (`modelVariant`).

## Parts, materials and clips

Optimised variants keep part nodes, names, extras and transforms; the mesh of a named part lives in an unnamed child
node (quantisation needs that). Address parts by name and traverse:

```ts
const part = gltf.scene.getObjectByName('Grille');
part?.traverse((o) => { if ((o as THREE.Mesh).isMesh) { /* highlight, swap material … */ } });
```

Clip names, part names and materials are listed in the manifest (`animations`, `animationClips`, `parts`,
`materials`). Build UI from the manifest rather than hard-coding them.

## Loading UX

- Show progress only when it is real: bytes loaded / `Content-Length` when known, otherwise an indeterminate state.
- Show the thumbnail or fallback image immediately; swap in the canvas when the model is ready.
- On error, keep the fallback and say what failed; never leave an empty canvas.
- Lazy-load models that are below the fold; preload the hero model with a `<link rel="preload">` only when it is
  needed for the first view.
