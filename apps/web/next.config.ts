import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // Docker enables the portable runtime; local Windows builds avoid standalone symlinks.
  output: process.env.NEXT_OUTPUT_STANDALONE === '1' ? 'standalone' : undefined,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  experimental: { cpus: 2 },
};

export default nextConfig;
