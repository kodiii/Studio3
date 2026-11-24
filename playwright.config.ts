import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the gallery (effects, demos, 3D) — run: npm run test:e2e
 * By default a production build is served (`npm run build` first, or set MAQUETTEKIT_E2E_DEV=1 to use `next dev`).
 * Point at an already running server with MAQUETTEKIT_BASE_URL. Software WebGL (SwiftShader) is enabled so 3D tests
 * run without a GPU; WebGPU is not assumed anywhere.
 */
const PORT = Number(process.env.MAQUETTEKIT_PORT ?? 3333);
const baseURL = process.env.MAQUETTEKIT_BASE_URL ?? `http://localhost:${PORT}`;
const dev = process.env.MAQUETTEKIT_E2E_DEV === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' } },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  snapshotPathTemplate: 'tests/e2e/__screenshots__/{testFilePath}/{arg}{ext}',
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } }],
  webServer: process.env.MAQUETTEKIT_BASE_URL ? undefined : {
    command: dev ? 'npm run dev' : 'npm run start',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 240_000,
    stdout: 'ignore',
  },
});
