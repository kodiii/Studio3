import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  // A separate output dir lets a production build run next to a dev server (e.g. NEXT_DIST_DIR=.next-prod).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@studio3/library'],
  turbopack: { root: path.resolve(import.meta.dirname, '../..') },
  outputFileTracingRoot: path.resolve(import.meta.dirname, '../..'),
  devIndicators: false,
  agentRules: false,
};
export default config;
