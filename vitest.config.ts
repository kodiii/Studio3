import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx,mjs}'],
    environment: 'node',
    environmentMatchGlobs: [['tests/unit/library/**', 'jsdom'], ['tests/unit/gallery/**', 'jsdom']],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
