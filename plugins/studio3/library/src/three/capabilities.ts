/**
 * Graphics capability detection. Never assume WebGPU; never assume WebGL.
 * All probes are side-effect free (probe contexts are released immediately).
 */
export interface GraphicsCapabilities {
  webgl: boolean;
  webgl2: boolean;
  /** `navigator.gpu` exists. An adapter may still be unavailable — see `detectWebGPU()`. */
  webgpuApi: boolean;
  maxTextureSize: number | null;
  /** Unmasked renderer string when the browser exposes it (often redacted). */
  renderer: string | null;
  /** Software rasteriser (SwiftShader / llvmpipe / WARP): treat as low-power. */
  softwareRenderer: boolean;
  /** Coarse device class from public signals only; a starting point, not a verdict. */
  deviceClass: 'desktop' | 'mobile' | 'low-power';
}

let cached: GraphicsCapabilities | null = null;

export function detectCapabilities(force = false): GraphicsCapabilities {
  if (cached && !force) return cached;
  const none: GraphicsCapabilities = { webgl: false, webgl2: false, webgpuApi: false, maxTextureSize: null, renderer: null, softwareRenderer: false, deviceClass: 'low-power' };
  if (typeof document === 'undefined') return none;
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  let webgl2 = false;
  try {
    const canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    webgl2 = !!gl;
    if (!gl) gl = (canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  } catch { gl = null; }
  let renderer: string | null = null;
  let maxTextureSize: number | null = null;
  if (gl) {
    try {
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : null;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { /* ignore */ }
  }
  const software = !!renderer && /swiftshader|llvmpipe|softpipe|software|warp|basic render/i.test(renderer);
  const nav = navigator as Navigator & { deviceMemory?: number; gpu?: unknown };
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const lowMem = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const fewCores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4;
  const deviceClass: GraphicsCapabilities['deviceClass'] = !gl || software || (coarse && (lowMem || fewCores)) ? 'low-power' : coarse ? 'mobile' : 'desktop';
  cached = { webgl: !!gl, webgl2, webgpuApi: !!nav.gpu, maxTextureSize, renderer, softwareRenderer: software, deviceClass };
  return cached;
}

/**
 * Real WebGPU availability: the API exists AND an adapter can be acquired.
 * Always pair with a WebGL fallback path.
 */
export async function detectWebGPU(): Promise<{ available: boolean; reason?: string }> {
  const gpu = typeof navigator !== 'undefined' ? (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu : undefined;
  if (!gpu) return { available: false, reason: 'navigator.gpu is not exposed by this browser' };
  try {
    const adapter = await gpu.requestAdapter();
    return adapter ? { available: true } : { available: false, reason: 'no GPU adapter available' };
  } catch (e) {
    return { available: false, reason: e instanceof Error ? e.message : 'requestAdapter failed' };
  }
}
