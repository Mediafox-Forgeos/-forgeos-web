import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Raíz del monorepo: con pnpm, `next` y sus dependencias viven en ../../node_modules.
  // Con process.cwd() el trazado excluía el runtime de Next y la función fallaba en Vercel.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Imágenes sintéticas propias (GO-IA-3, HF-QA-08): el análisis multimodal las lee del disco
  // en el servidor (sin red). Solo la ruta del detalle de publicación, donde vive la acción.
  outputFileTracingIncludes: {
    '/publicaciones/[id]': ['./public/synthetic-media/**/*'],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
