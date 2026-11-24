import path from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * Hey Foxy V2 — QA local en modo demo (WO-HF-V2-00).
 *
 * - Levanta `next start` del build de heyfoxy-web SIN variables de Supabase → modo demo,
 *   datos sintéticos en memoria. Nunca apunta a Supabase QA, Preview ni Production.
 * - Reloj fijo en el servidor (support/fixed-clock.cjs) para que las capturas sean estables.
 * - Navegador: Google Chrome del sistema (channel 'chrome'); no descarga navegadores.
 * - Viewports del plan V2: 390 (móvil), 820 (tablet), 1440 (escritorio).
 *
 * Requiere un build previo en modo demo: `pnpm run build:app` (en tools/heyfoxy-qa).
 */
const PORT = Number(process.env.HF_QA_PORT ?? 3198);
const APP_DIR = path.resolve(__dirname, '../../apps/heyfoxy-web');
const CLOCK = path.resolve(__dirname, 'support/fixed-clock.cjs');
export const FIXED_NOW = '2026-11-14T15:00:00.000Z';

export default defineConfig({
  testDir: './e2e',
  // Serie: el modo de registro escribe un único archivo de deuda y el seed demo es compartido.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  snapshotPathTemplate:
    '{testDir}/../baseline/screenshots/{projectName}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.002,
    },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: 'chrome',
    headless: true,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  // Proyectos «clásicos» (hf_ui=legacy): comparan con la línea base de Gate 2 (WO-HF-V2-00).
  // Proyectos V2: claro en los 3 viewports y oscuro en móvil y escritorio.
  projects: [
    {
      name: 'mobile-390',
      metadata: { theme: 'legacy' },
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet-820',
      metadata: { theme: 'legacy' },
      use: { viewport: { width: 820, height: 1180 }, hasTouch: true },
    },
    {
      name: 'desktop-1440',
      metadata: { theme: 'legacy' },
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'v2-light-390',
      metadata: { theme: 'v2-light' },
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      // 500 px: ancho mínimo de ventana de Chrome de escritorio (revisión del Preview V2).
      // Solo comprobaciones funcionales, axe y desbordamiento; sin capturas (D-2).
      name: 'v2-light-500',
      metadata: { theme: 'v2-light', shots: false },
      use: { viewport: { width: 500, height: 900 }, hasTouch: true },
    },
    {
      name: 'v2-light-820',
      metadata: { theme: 'v2-light' },
      use: { viewport: { width: 820, height: 1180 }, hasTouch: true },
    },
    {
      name: 'v2-light-1440',
      metadata: { theme: 'v2-light' },
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'v2-dark-390',
      metadata: { theme: 'v2-dark' },
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        colorScheme: 'dark',
      },
    },
    {
      name: 'v2-dark-1440',
      metadata: { theme: 'v2-dark' },
      use: { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' },
    },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT} -H 127.0.0.1`,
    cwd: APP_DIR,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      // Cadenas vacías → dataMode() = 'demo' (lib/env.ts). Nunca Supabase.
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
      HF_WHATSAPP_MODE: 'simulate',
      HF_QA_FIXED_NOW: FIXED_NOW,
      NODE_OPTIONS: `--require ${CLOCK}`,
      TZ: 'UTC',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
