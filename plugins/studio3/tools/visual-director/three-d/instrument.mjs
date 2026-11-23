// @ts-check
/**
 * 3D instrumentation, installed with context.addInitScript() BEFORE any page script runs.
 * Self-contained: must not reference anything outside its own body.
 *
 * Wraps canvas.getContext (HTMLCanvasElement + OffscreenCanvas on the main thread) and the
 * WebGL1/2 prototypes to count draw calls, estimate triangles, texture bytes and geometry
 * bytes. All byte figures are ESTIMATES (width × height × 4, ×1.33 when mipmapped).
 * Context-loss events are tagged `intentional` when the page asked for them through
 * WEBGL_lose_context.loseContext() (capability probes releasing their context, three's
 * renderer.forceContextLoss() on teardown) and `attached: false` when the canvas was never in the
 * document (a probe canvas) — the diagnostics only count the rest as real losses.
 * Workers are not instrumented.
 * @param {{ forceNoGL?: boolean }} [opts]
 */
export function instrument3D(opts) {
  const w = /** @type {any} */ (window);
  if (w.__S3VD_3D__) return;
  const S = {
    forceNoGL: !!(opts && opts.forceNoGL),
    contexts: /** @type {any[]} */ ([]),
    events: /** @type {any[]} */ ([]),
    calls: 0, tris: 0, frameCalls: 0, frameTris: 0,
    frames: /** @type {number[][]} */ ([]),
    textures: { created: 0, deleted: 0, uploads: 0, bytes: 0 },
    buffers: { created: 0, deleted: 0, bytes: 0 },
    programs: { created: 0, deleted: 0 },
    gpu: { present: !!(/** @type {any} */ (navigator).gpu), requested: false, adapter: /** @type {any} */ (null), error: /** @type {any} */ (null) },
    canvases: /** @type {any[]} */ ([]),
  };
  Object.defineProperty(w, '__S3VD_3D__', { value: S, enumerable: false });

  // ---- context-loss bookkeeping ------------------------------------------------
  const intentionalLoss = new WeakMap(); // canvas → pending loseContext() requests
  const attachedEver = new WeakSet(); // DOM canvases seen in the document at least once
  const noteAttached = (cv) => { try { if (cv && cv.isConnected === true) attachedEver.add(cv); } catch { /* ignore */ } };
  // OffscreenCanvas has no isConnected: it may be displayed through transferControlToOffscreen(), so it counts.
  const wasAttached = (cv) => { noteAttached(cv); return !cv || typeof cv.isConnected !== 'boolean' || attachedEver.has(cv); };

  // ---- per-frame accounting --------------------------------------------------
  const raf = w.requestAnimationFrame.bind(w);
  const tick = (t) => {
    for (const c of S.canvases) if (!c.offscreen) noteAttached(c.canvas);
    S.frames.push([t, S.frameCalls, S.frameTris]);
    if (S.frames.length > 1200) S.frames.splice(0, 400);
    S.frameCalls = 0; S.frameTris = 0;
    raf(tick);
  };
  raf(tick);
  const record = (calls, tris) => { S.calls += calls; S.tris += tris; S.frameCalls += calls; S.frameTris += tris; };
  const triCount = (mode, count) => (mode === 4 ? Math.floor(count / 3) : (mode === 5 || mode === 6) ? Math.max(0, count - 2) : 0);
  const sum = (list, offset, n) => { let s = 0; try { for (let i = 0; i < n; i++) s += list[offset + i] || 0; } catch { /* ignore */ } return s; };

  // ---- GL state shadows ------------------------------------------------------
  const texInfo = new WeakMap(); const bufInfo = new WeakMap(); const glState = new WeakMap();
  const st = (gl) => { let s = glState.get(gl); if (!s) { s = { unit: 0, tex: Object.create(null), buf: Object.create(null) }; glState.set(gl, s); } return s; };
  const texKey = (target) => (target >= 0x8515 && target <= 0x851A ? 0x8513 : target);
  const texTotal = (i) => { let s = 0; for (const k in i.parts) s += i.parts[k]; return Math.round(s * (i.mip && !i.exact ? 1.33 : 1)); };
  const withTex = (gl, target, fn) => {
    const s = st(gl); const tex = s.tex[s.unit + ':' + texKey(target)];
    if (!tex) return;
    let i = texInfo.get(tex);
    if (!i) { i = { parts: Object.create(null), mip: false, exact: false }; texInfo.set(tex, i); }
    const before = texTotal(i);
    fn(i);
    S.textures.bytes += texTotal(i) - before;
  };
  const srcDim = (src) => (src ? [src.videoWidth || src.naturalWidth || src.displayWidth || src.width || 0, src.videoHeight || src.naturalHeight || src.displayHeight || src.height || 0] : [0, 0]);

  const pre = (proto, name, fn) => {
    const orig = proto[name];
    if (typeof orig !== 'function') return;
    proto[name] = function () { try { fn.apply(this, arguments); } catch { /* never break the page */ } return orig.apply(this, arguments); };
  };
  const post = (proto, name, fn) => {
    const orig = proto[name];
    if (typeof orig !== 'function') return;
    proto[name] = function () { const r = orig.apply(this, arguments); try { fn.call(this, r, arguments); } catch { /* never break the page */ } return r; };
  };
  const wrappedExt = new WeakSet();
  const wrapExt = (name, ext, gl) => {
    if (!ext || typeof ext !== 'object' || wrappedExt.has(ext)) return;
    wrappedExt.add(ext);
    const n = String(name).toLowerCase();
    const own = (k, fn) => { const o = ext[k]; if (typeof o !== 'function') return; try { ext[k] = function () { try { fn.apply(this, arguments); } catch { /* ignore */ } return o.apply(ext, arguments); }; } catch { /* ignore */ } };
    if (n === 'angle_instanced_arrays') {
      own('drawArraysInstancedANGLE', (mode, first, count, inst) => record(1, triCount(mode, count) * (inst || 1)));
      own('drawElementsInstancedANGLE', (mode, count, type, offset, inst) => record(1, triCount(mode, count) * (inst || 1)));
    } else if (n === 'webgl_multi_draw') {
      own('multiDrawArraysWEBGL', (mode, firsts, fo, counts, co, dc) => record(dc || 1, triCount(mode, sum(counts, co, dc))));
      own('multiDrawElementsWEBGL', (mode, counts, co, type, offsets, oo, dc) => record(dc || 1, triCount(mode, sum(counts, co, dc))));
      own('multiDrawArraysInstancedWEBGL', (mode, firsts, fo, counts, co, ic, io, dc) => record(dc || 1, triCount(mode, sum(counts, co, dc)) * Math.max(1, (ic && ic[io]) || 1)));
      own('multiDrawElementsInstancedWEBGL', (mode, counts, co, type, offsets, oo, ic, io, dc) => record(dc || 1, triCount(mode, sum(counts, co, dc)) * Math.max(1, (ic && ic[io]) || 1)));
    } else if (n === 'webgl_lose_context') {
      // A loss the page requests itself is not a failure: mark the next webglcontextlost on this canvas.
      own('loseContext', () => {
        const cv = gl && gl.canvas;
        if (!cv || (typeof gl.isContextLost === 'function' && gl.isContextLost())) return; // already lost: no event follows
        intentionalLoss.set(cv, (intentionalLoss.get(cv) || 0) + 1);
      });
    }
  };

  const patchGL = (Ctor) => {
    if (!Ctor || !Ctor.prototype) return;
    const p = Ctor.prototype;
    pre(p, 'drawArrays', (mode, first, count) => record(1, triCount(mode, count)));
    pre(p, 'drawElements', (mode, count) => record(1, triCount(mode, count)));
    pre(p, 'drawRangeElements', (mode, start, end, count) => record(1, triCount(mode, count)));
    pre(p, 'drawArraysInstanced', (mode, first, count, inst) => record(1, triCount(mode, count) * (inst || 1)));
    pre(p, 'drawElementsInstanced', (mode, count, type, offset, inst) => record(1, triCount(mode, count) * (inst || 1)));
    post(p, 'getExtension', function (r, args) { wrapExt(args[0], r, this); });
    post(p, 'createTexture', () => { S.textures.created++; });
    pre(p, 'deleteTexture', (tex) => { if (!tex) return; const i = texInfo.get(tex); if (i) { S.textures.bytes -= texTotal(i); texInfo.delete(tex); } S.textures.deleted++; });
    pre(p, 'activeTexture', function (unit) { st(this).unit = unit - 0x84C0; });
    pre(p, 'bindTexture', function (target, tex) { const s = st(this); s.tex[s.unit + ':' + texKey(target)] = tex; });
    pre(p, 'texImage2D', function (target, level, ifmt, a, b) {
      if (level !== 0) return;
      let wd; let ht;
      if (arguments.length >= 9) { wd = a; ht = b; } else { const d = srcDim(arguments[5]); wd = d[0]; ht = d[1]; }
      S.textures.uploads++;
      withTex(this, target, (i) => { i.parts[target] = (wd || 0) * (ht || 0) * 4; });
    });
    pre(p, 'texImage3D', function (target, level, ifmt, wd, ht, depth) { if (level !== 0) return; S.textures.uploads++; withTex(this, target, (i) => { i.parts[target] = (wd || 0) * (ht || 0) * (depth || 1) * 4; }); });
    pre(p, 'texStorage2D', function (target, levels, ifmt, wd, ht) { withTex(this, target, (i) => { i.parts.storage = wd * ht * 4 * (texKey(target) === 0x8513 ? 6 : 1); i.mip = levels > 1; }); });
    pre(p, 'texStorage3D', function (target, levels, ifmt, wd, ht, depth) { withTex(this, target, (i) => { i.parts.storage = wd * ht * depth * 4; i.mip = levels > 1; }); });
    pre(p, 'compressedTexImage2D', function (target, level, ifmt, wd, ht, border, data) {
      const bytes = data && typeof data === 'object' && data.byteLength ? data.byteLength : (typeof data === 'number' ? data : Math.ceil((wd || 0) * (ht || 0)));
      if (level === 0) S.textures.uploads++;
      withTex(this, target, (i) => { i.exact = true; i.parts[target + ':' + level] = bytes; });
    });
    pre(p, 'generateMipmap', function (target) { withTex(this, target, (i) => { i.mip = true; }); });
    post(p, 'createBuffer', () => { S.buffers.created++; });
    pre(p, 'bindBuffer', function (target, buf) { st(this).buf[target] = buf; });
    pre(p, 'bufferData', function (target, data) {
      const buf = st(this).buf[target]; if (!buf) return;
      const bytes = typeof data === 'number' ? data : (data && data.byteLength) || 0;
      S.buffers.bytes += bytes - (bufInfo.get(buf) || 0);
      bufInfo.set(buf, bytes);
    });
    pre(p, 'deleteBuffer', (buf) => { if (!buf) return; S.buffers.bytes -= bufInfo.get(buf) || 0; bufInfo.delete(buf); S.buffers.deleted++; });
    post(p, 'createProgram', () => { S.programs.created++; });
    pre(p, 'deleteProgram', (prog) => { if (prog) S.programs.deleted++; });
  };
  patchGL(w.WebGLRenderingContext);
  patchGL(w.WebGL2RenderingContext);

  // ---- context creation ------------------------------------------------------
  const tracked = new WeakSet();
  const patchGetContext = (Ctor, offscreen) => {
    if (!Ctor || !Ctor.prototype || typeof Ctor.prototype.getContext !== 'function') return;
    const orig = Ctor.prototype.getContext;
    Ctor.prototype.getContext = function (type) {
      const t = String(type);
      if (!/^(webgl2?|experimental-webgl2?|webgpu)$/.test(t)) return orig.apply(this, arguments);
      const rec = { type: t, ok: false, forced: false, offscreen, t: performance.now(), error: null };
      if (S.contexts.length < 60) S.contexts.push(rec);
      const canvas = this;
      if (!tracked.has(canvas) && typeof canvas.addEventListener === 'function') {
        tracked.add(canvas);
        for (const ev of ['webglcontextlost', 'webglcontextrestored', 'webglcontextcreationerror']) {
          canvas.addEventListener(ev, (e) => {
            /** @type {any} */ const rec = { type: ev, t: performance.now(), message: (e && e.statusMessage) || '' };
            if (ev === 'webglcontextlost') {
              const pending = intentionalLoss.get(canvas) || 0;
              if (pending > 0) intentionalLoss.set(canvas, pending - 1);
              rec.intentional = pending > 0;
              rec.attached = wasAttached(canvas);
            } else if (ev === 'webglcontextrestored') intentionalLoss.delete(canvas);
            if (S.events.length < 60) S.events.push(rec);
          });
        }
      }
      if (S.forceNoGL) {
        rec.forced = true;
        try { if (typeof canvas.dispatchEvent === 'function' && t !== 'webgpu') { const e = new Event('webglcontextcreationerror'); /** @type {any} */ (e).statusMessage = 'WebGL disabled (Studio3 no-WebGL simulation)'; canvas.dispatchEvent(e); } } catch { /* ignore */ }
        return null;
      }
      let ctx = null;
      try { ctx = orig.apply(this, arguments); } catch (e) { rec.error = String((e && e.message) || e); throw e; }
      rec.ok = !!ctx;
      noteAttached(canvas);
      if (ctx && !S.canvases.some((c) => c.canvas === canvas)) S.canvases.push({ canvas, type: t, offscreen });
      return ctx;
    };
  };
  patchGetContext(w.HTMLCanvasElement, false);
  patchGetContext(w.OffscreenCanvas, true);

  // ---- WebGPU ----------------------------------------------------------------
  try {
    const gpu = /** @type {any} */ (navigator).gpu;
    if (gpu && typeof gpu.requestAdapter === 'function') {
      const orig = gpu.requestAdapter;
      gpu.requestAdapter = function () {
        S.gpu.requested = true;
        if (S.forceNoGL) { S.gpu.adapter = 'null (forced)'; return Promise.resolve(null); }
        const pr = orig.apply(gpu, arguments);
        Promise.resolve(pr).then((a) => { S.gpu.adapter = a ? 'obtained' : 'null'; }, (e) => { S.gpu.error = String((e && e.message) || e); });
        return pr;
      };
    }
  } catch { /* ignore */ }
}

/** Runs in the page: serialisable snapshot of the instrumentation + cooperative hook. */
export function pageSnapshot3D() {
  const w = /** @type {any} */ (window);
  const S = w.__S3VD_3D__;
  if (!S) return null;
  const H = w.__S3VD__;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  let hook = null;
  try {
    const h = w.__STUDIO3_3D__;
    if (h && typeof h === 'object') {
      const r = h.renderer && typeof h.renderer === 'object' ? h.renderer : null;
      hook = {
        renderer: r ? { calls: num(r.calls), triangles: num(r.triangles), geometries: num(r.geometries), textures: num(r.textures), programs: num(r.programs) } : null,
        frameloop: typeof h.frameloop === 'string' ? h.frameloop : undefined,
        quality: typeof h.quality === 'string' ? h.quality : undefined,
        disposed: num(h.disposed),
      };
    }
  } catch { /* ignore */ }
  return {
    t: performance.now(), dpr: w.devicePixelRatio, forceNoGL: S.forceNoGL,
    contexts: S.contexts.slice(), events: S.events.slice(), calls: S.calls, tris: S.tris,
    frames: S.frames.slice(-900),
    textures: { ...S.textures, live: S.textures.created - S.textures.deleted },
    buffers: { ...S.buffers, live: S.buffers.created - S.buffers.deleted },
    programs: { ...S.programs, live: S.programs.created - S.programs.deleted },
    gpu: { ...S.gpu },
    canvases: S.canvases.filter((c) => !c.offscreen).map((c) => {
      const cv = c.canvas; const r = cv.getBoundingClientRect();
      return {
        selector: H ? H.sel(cv) : 'canvas', container: H && cv.parentElement ? H.sel(cv.parentElement) : null, type: c.type, connected: cv.isConnected,
        width: cv.width, height: cv.height, clientWidth: cv.clientWidth, clientHeight: cv.clientHeight,
        rect: { x: r.left, y: r.top, width: r.width, height: r.height }, visible: H ? H.visible(cv) : true,
      };
    }),
    offscreenContexts: S.canvases.filter((c) => c.offscreen).length,
    domCanvasCount: document.querySelectorAll('canvas').length,
    viewport: { width: w.innerWidth, height: w.innerHeight },
    hook,
  };
}
