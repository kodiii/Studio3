(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var paused = false;
  // One motion control for the whole site: pauses ambient CSS loops and the 3D auto-rotation.
  var toggle = document.querySelector('.motion-toggle');
  toggle.addEventListener('click', function () {
    paused = !paused;
    document.documentElement.classList.toggle('paused', paused);
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = paused ? 'Resume animations' : 'Pause animations';
  });
  // Disclosure: aria-expanded always mirrors what is shown.
  document.querySelectorAll('[aria-controls][aria-expanded]').forEach(function (b) {
    var panel = document.getElementById(b.getAttribute('aria-controls'));
    b.addEventListener('click', function () { var open = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(open)); panel.hidden = !open; });
  });
  // Deferred content behind a skeleton + aria-busy, announced in a live region.
  var updates = document.getElementById('updates');
  if (updates) setTimeout(function () {
    updates.innerHTML = '<li>Faster feedback: every button now paints its pressed state on the next frame.</li><li>Clearer errors: form messages say what to fix and stay next to the field.</li><li>Calmer motion: ambient loops pause with one control and stop under reduced motion.</li>';
    updates.setAttribute('aria-busy', 'false');
    document.getElementById('updates-status').textContent = '3 updates loaded';
  }, 700);
  // Form validation: aria-invalid + aria-describedby messages + focus on the first error.
  var form = document.getElementById('contact');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var problems = [];
    [['name', 'Enter your name.'], ['email', 'Enter an email address like name@example.com.']].forEach(function (f) {
      var el = document.getElementById(f[0]); var err = document.getElementById(f[0] + '-error');
      var bad = !el.value.trim() || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value));
      el.setAttribute('aria-invalid', String(bad)); err.textContent = bad ? f[1] : '';
      if (bad) problems.push(el);
    });
    document.getElementById('form-errors').textContent = problems.length ? 'Please fix ' + problems.length + ' field(s) below.' : '';
    if (problems.length) problems[0].focus(); else document.getElementById('form-status').textContent = 'Thanks — your message was sent.';
  });
  // Raw WebGL scene: auto-rotates (pausable), static under reduced motion, fallback without WebGL.
  var canvas = document.getElementById('scene');
  if (!canvas) return;
  var gl = null;
  try { gl = canvas.getContext('webgl'); } catch (err) { gl = null; }
  if (!gl) { canvas.hidden = true; document.querySelector('[data-maquettekit-fallback]').hidden = false; return; }
  function sh(t, s) { var x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; }
  var pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;attribute vec3 c;uniform float a;varying vec3 v;void main(){float s=sin(a),k=cos(a);gl_Position=vec4(p.x*k-p.y*s,p.x*s+p.y*k,0.,1.);v=c;}'));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec3 v;void main(){gl_FragColor=vec4(v,1.);}'));
  gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, .7, 1, .4, .3, -.6, -.5, .3, .8, 1, .6, -.5, 1, .9, .3]), gl.STATIC_DRAW);
  var P = gl.getAttribLocation(pr, 'p'), C = gl.getAttribLocation(pr, 'c'), uA = gl.getUniformLocation(pr, 'a');
  gl.enableVertexAttribArray(P); gl.vertexAttribPointer(P, 2, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(C); gl.vertexAttribPointer(C, 3, gl.FLOAT, false, 20, 8);
  var angle = 0;
  function draw() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h); gl.clearColor(.06, .09, .16, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(uA, angle); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function loop() { if (!paused) { angle += 0.02; draw(); } requestAnimationFrame(loop); }
  if (reduce) draw(); else loop();
  document.querySelectorAll('[data-rotate]').forEach(function (b) { b.addEventListener('click', function () { angle += 0.4 * Number(b.getAttribute('data-rotate')); draw(); }); });
  document.querySelector('[data-reset]').addEventListener('click', function () { angle = 0; draw(); });
  var dragging = false, lastX = 0;
  canvas.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; });
  window.addEventListener('pointerup', function () { dragging = false; });
  canvas.addEventListener('pointermove', function (e) { if (dragging) { angle += (e.clientX - lastX) * 0.01; lastX = e.clientX; draw(); } });
})();
