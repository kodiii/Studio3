import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Library tests that need a DOM declare `// @vitest-environment jsdom` in their first line.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // @gsap/react's "main" is a CJS build that require()s its own copy of gsap; bundlers (Next, Vite) use its ESM
    // "module" entry instead. Point tests at the same ESM entry so useGSAP and the recipes share one gsap instance —
    // otherwise useGSAP contexts cannot see (and revert) the recipes' tweens and ScrollTriggers.
    alias: { '@gsap/react': fileURLToPath(new URL('./node_modules/@gsap/react/src/index.js', import.meta.url)) },
  },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx,mjs}'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 60_000,
    css: { modules: { classNameStrategy: 'non-scoped' } },
    server: { deps: { inline: [/@studio3\/library/, /@gsap\/react/] } },
  },
});
