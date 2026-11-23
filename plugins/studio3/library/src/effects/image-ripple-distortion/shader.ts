/** Full-frame poster transition: a ripple front travels out from the origin, displacing and splitting colour. */
export const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0); // clip-space quad; the canvas itself has the poster's aspect ratio
}`;

export const fragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uFrom, uTo;
uniform float uProgress, uAmp, uChroma, uFreq, uTime, uHover, uAspect, uFade;
uniform vec2 uOrigin, uPointer;

vec3 sampleSplit(sampler2D tex, vec2 uv, vec2 split) {
  return vec3(texture2D(tex, uv + split).r, texture2D(tex, uv).g, texture2D(tex, uv - split).b);
}

void main() {
  vec2 uv = vUv;
  vec2 d = (uv - uOrigin) * vec2(uAspect, 1.0);
  float dist = length(d);
  vec2 dir = dist > 1e-4 ? d / dist : vec2(0.0);
  float front = uProgress * 1.75;                                  // reaches the far corner at progress 1
  float band = exp(-pow((dist - front) * 4.5, 2.0));               // energy concentrated around the front
  float wave = sin((dist - front) * uFreq * 6.2831853) * band;
  float env = sin(uProgress * 3.1415927);                          // calm at rest, strongest mid-transition
  vec2 offset = dir * wave * uAmp * env * (1.0 - uFade);

  // Subtle hover ripple around the pointer (fades with uHover).
  vec2 hp = (uv - uPointer) * vec2(uAspect, 1.0);
  float hd = length(hp);
  vec2 hdir = hd > 1e-4 ? hp / hd : vec2(0.0);
  offset += hdir * sin(hd * 70.0 - uTime * 5.0) * exp(-hd * 9.0) * 0.0045 * uHover * (1.0 - uFade);

  vec2 split = offset * uChroma * 0.9;
  vec3 a = sampleSplit(uFrom, uv + offset, split);
  vec3 b = sampleSplit(uTo, uv + offset * 0.6, split);
  // Inside the front the new poster shows; reduced motion (uFade = 1) is a plain cross-fade.
  float reveal = mix(1.0 - smoothstep(front - 0.08, front + 0.02, dist), uProgress, uFade);
  gl_FragColor = vec4(mix(a, b, reveal), 1.0);
  #include <colorspace_fragment>
}`;
