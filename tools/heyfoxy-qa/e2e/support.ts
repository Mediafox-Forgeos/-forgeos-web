import fs from 'node:fs';
import path from 'node:path';
import { expect, type BrowserContext, type Page } from '@playwright/test';

/** Organizaciones y usuarios del modo demo (apps/heyfoxy-web/lib/demo/seed.ts). */
export const ORG_CLINICA = '00000000-0000-4000-a000-0000000000a1';
export const DEMO_OWNER = 'demo-user-owner';

export type QaRoute = {
  /** Nombre estable: archivo de captura y clave de deuda. */
  name: string;
  path: string;
  auth: boolean;
  /** Ruta con id dinámico: se llega navegando desde `path` y pulsando el primer enlace que case. */
  followLink?: RegExp;
  /** Vista migrada a V2: sus capturas V2 se versionan (D-2: solo capturas esenciales). */
  v2?: boolean;
  /** Solo existe en la interfaz V2 (p. ej. el catálogo /ds). */
  v2Only?: boolean;
};

/** Todas las vistas actuales del Command Center + autenticación (línea base pre-V2). */
export const ROUTES: QaRoute[] = [
  { name: 'login', path: '/login', auth: false },
  { name: 'login-recuperar', path: '/login/recuperar', auth: false },
  { name: 'resumen', path: '/', auth: true, v2: true },
  { name: 'conversaciones', path: '/conversaciones', auth: true },
  { name: 'alertas', path: '/alertas', auth: true },
  { name: 'revision', path: '/revision', auth: true },
  { name: 'incidentes', path: '/incidentes', auth: true },
  {
    name: 'incidente-detalle',
    path: '/incidentes',
    auth: true,
    followLink: /^\/incidentes\/[^/]+$/,
  },
  { name: 'temas', path: '/temas', auth: true },
  { name: 'publicaciones', path: '/publicaciones', auth: true, v2: true },
  {
    name: 'publicacion-detalle',
    path: '/publicaciones/demo-clinica-aurora-post-instagram',
    auth: true,
    v2: true,
  },
  { name: 'reportes', path: '/reportes', auth: true },
  { name: 'cobertura', path: '/cobertura', auth: true },
  { name: 'whatsapp', path: '/whatsapp', auth: true },
  { name: 'uso', path: '/uso', auth: true },
  { name: 'configuracion', path: '/configuracion', auth: true },
  { name: 'catalogo-ds', path: '/ds', auth: true, v2: true, v2Only: true },
  { name: 'buscar', path: '/buscar?q=citas', auth: true, v2Only: true },
];

export type QaTheme = 'legacy' | 'v2-light' | 'v2-dark';

/** Preferencia de tema de la app (cookie hf_ui), también en rutas sin sesión. */
export async function setTheme(
  context: BrowserContext,
  baseURL: string,
  theme: QaTheme,
) {
  await context.addCookies([{ name: 'hf_ui', value: theme, url: baseURL }]);
}

export async function signInDemo(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: 'hf_demo_user', value: DEMO_OWNER, url: baseURL },
    { name: 'hf_org', value: ORG_CLINICA, url: baseURL },
  ]);
}

/** Abre la ruta y devuelve el código HTTP del documento final. */
export async function openRoute(page: Page, route: QaRoute): Promise<number> {
  const res = await page.goto(route.path, { waitUntil: 'networkidle' });
  let status = res?.status() ?? 0;
  if (route.followLink) {
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
    const target = hrefs.find((h) => route.followLink!.test(h));
    expect(
      target,
      `enlace que case ${route.followLink} en ${route.path}`,
    ).toBeTruthy();
    const detail = await page.goto(target!, { waitUntil: 'networkidle' });
    status = detail?.status() ?? 0;
  }
  // Recorre la página para que carguen las imágenes diferidas (loading="lazy") y vuelve arriba;
  // fuentes cargadas antes de capturar o auditar.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
    window.scrollTo(0, 0);
    // Solo imágenes visibles (las diapositivas ocultas de un carrusel no cargan nunca) y con tope.
    const pending = [...document.images]
      .filter((img) => !img.complete && img.checkVisibility())
      .map(
        (img) =>
          new Promise((r) => {
            img.addEventListener('load', r, { once: true });
            img.addEventListener('error', r, { once: true });
          }),
      );
    await Promise.race([
      Promise.all(pending),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    await document.fonts.ready;
  });
  return status;
}

/* ---------- Deuda conocida (línea base) ---------- */

export type Debt = {
  /** clave `${project}/${route}` → reglas axe serious/critical conocidas */
  a11y: Record<string, string[]>;
  /** claves `${project}/${route}` con desbordamiento horizontal conocido */
  overflow: string[];
};

const DEBT_FILE = path.resolve(__dirname, '../baseline/known-debt.json');
export const RECORD = process.env.HF_QA_RECORD === '1';

export function readDebt(): Debt {
  if (!fs.existsSync(DEBT_FILE)) return { a11y: {}, overflow: [] };
  return JSON.parse(fs.readFileSync(DEBT_FILE, 'utf8')) as Debt;
}

/** Solo en modo registro (workers: 1, escritura serie). Mantiene el archivo ordenado. */
export function writeDebt(mutate: (d: Debt) => void) {
  const d = readDebt();
  mutate(d);
  const sorted: Debt = {
    a11y: Object.fromEntries(
      Object.entries(d.a11y)
        .filter(([, v]) => v.length > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, [...new Set(v)].sort()]),
    ),
    overflow: [...new Set(d.overflow)].sort(),
  };
  fs.mkdirSync(path.dirname(DEBT_FILE), { recursive: true });
  fs.writeFileSync(DEBT_FILE, JSON.stringify(sorted, null, 2) + '\n');
}
