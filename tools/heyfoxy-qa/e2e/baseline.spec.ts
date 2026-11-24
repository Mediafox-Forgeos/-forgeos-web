import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  RECORD,
  ROUTES,
  openRoute,
  readDebt,
  setTheme,
  signInDemo,
  writeDebt,
  type QaTheme,
} from './support';

/**
 * Línea base de Hey Foxy antes de la V2 (WO-HF-V2-00). Por cada vista y viewport:
 *  1. Funcional: HTTP 200, sin errores de consola ni excepciones, un <h1>.
 *  2. Accesibilidad: axe WCAG 2.x A/AA; falla si aparece una violación serious/critical
 *     que no está en baseline/known-debt.json (deuda conocida y acordada).
 *  3. Desbordamiento horizontal: falla si aparece uno nuevo respecto a la deuda conocida.
 *  4. Visual: captura de página completa comparada con baseline/screenshots/.
 *
 * `pnpm e2e:record` regenera capturas y deuda; revisar el diff antes de versionar.
 */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const GRAVE = new Set(['serious', 'critical']);
/** Recursos que faltan hoy (deuda conocida, se corrige en WO-HF-V2-01). */
const KNOWN_MISSING = new Set<string>([]);

for (const route of ROUTES) {
  test(`${route.name} (${route.path})`, async ({
    page,
    context,
    baseURL,
  }, info) => {
    const key = `${info.project.name}/${route.name}`;
    const problems: string[] = [];
    page.on('console', (m) => {
      // Los 4xx/5xx de recursos se comprueban con su URL en el listener de respuestas.
      // (Chrome pide /favicon.ico fuera de la página: hoy no existe, deuda de WO-HF-V2-01.)
      if (
        m.type() === 'error' &&
        !m.text().startsWith('Failed to load resource')
      )
        problems.push(`console: ${m.text()}`);
    });
    page.on('response', (r) => {
      const url = new URL(r.url());
      if (r.status() >= 400 && !KNOWN_MISSING.has(url.pathname))
        problems.push(`HTTP ${r.status()} ${url.pathname}`);
    });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

    const theme = (info.project.metadata.theme ?? 'legacy') as QaTheme;
    test.skip(theme === 'legacy' && !!route.v2Only, 'vista solo V2');
    await setTheme(context, baseURL!, theme);
    if (route.auth) await signInDemo(context, baseURL!);

    // 1. Funcional
    const status = await openRoute(page, route);
    expect(status, `HTTP de ${route.path}`).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    expect(problems, 'errores de consola o de página').toEqual([]);

    // 2. Accesibilidad
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    const grave = axe.violations.filter((v) => GRAVE.has(v.impact ?? ''));
    const found = grave.map((v) => v.id).sort();
    info.annotations.push({
      type: 'axe',
      description:
        axe.violations
          .map((v) => `${v.impact}:${v.id}(${v.nodes.length})`)
          .join(' ') || 'sin violaciones',
    });

    // 3. Desbordamiento horizontal
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    );

    if (RECORD) {
      writeDebt((d) => {
        d.a11y[key] = found;
        d.overflow = d.overflow.filter((k) => k !== key);
        if (overflow) d.overflow.push(key);
      });
    } else {
      const debt = readDebt();
      const known = new Set(debt.a11y[key] ?? []);
      const nuevas = grave
        .filter((v) => !known.has(v.id))
        .map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} nodos)`);
      expect(
        nuevas,
        'violaciones axe graves nuevas (no están en la deuda conocida)',
      ).toEqual([]);
      if (overflow) {
        expect(debt.overflow, 'desbordamiento horizontal nuevo').toContain(key);
      }
    }

    // 4. Visual: todas las vistas en el tema clásico; en V2, solo las vistas migradas (D-2).
    if (
      info.project.metadata.shots !== false &&
      (theme === 'legacy' || route.v2)
    ) {
      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: true,
      });
    }
  });
}
