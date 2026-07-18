import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  transpilePackages: ['@mediafox/shared-types'],
  experimental: {
    outputFileTracingIncludes: {
      '**': [
        './node_modules/next/dist/compiled/source-map/**',
      ],
    },
  },
};

export default nextConfig;
