import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  outputFileTracingIncludes: {
    '**': ['./apps/movos-web/node_modules/next/dist/compiled/source-map/**'],
  },
  transpilePackages: ['@mediafox/shared-types'],
};

export default nextConfig;
