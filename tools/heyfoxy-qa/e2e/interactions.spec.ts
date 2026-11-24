import { expect, test } from '@playwright/test';
import { setTheme, signInDemo, type QaTheme } from './support';

/**
 * Interacciones de la interfaz V2 que la línea base (capturas estáticas) no cubría y que
 * fallaron en la revisión del Preview V2 (2026-11-24): menú móvil, tooltips del riel,
 * periodo en los enlaces de la cabecera y gráficos en la primera pantalla.
 */
test.beforeEach(async ({ context, baseURL }, info) => {
  const theme = (info.project.metadata.theme ?? 'legacy') as QaTheme;
  test.skip(theme === 'legacy', 'interacciones de la interfaz V2');
  await setTheme(context, baseURL!, theme);
  await signInDemo(context, baseURL!);
});

test('menú móvil: panel a pantalla completa y navegable', async ({ page }) => {
  const vp = page.viewportSize()!;
  test.skip(vp.width >= 768, 'solo por debajo de md');
  await page.goto('/?periodo=30d');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  const dialog = page.getByRole('dialog', { name: 'Menú principal' });
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.height, 'el panel ocupa todo el alto').toBeGreaterThanOrEqual(
    vp.height - 2,
  );
  const explorer = dialog.getByRole('link', { name: 'Social Explorer' });
  await expect(explorer).toBeInViewport();
  await expect(
    dialog.getByRole('button', { name: 'Cerrar menú' }),
  ).toBeFocused();
  await explorer.click();
  await expect(page).toHaveURL(/\/publicaciones\?periodo=30d$/);
  await expect(dialog).toBeHidden();
});

test('riel de tablet: tooltip visible y sin scroll horizontal', async ({
  page,
}) => {
  const vp = page.viewportSize()!;
  test.skip(vp.width < 768 || vp.width >= 1280, 'solo riel de iconos (md–xl)');
  await page.goto('/');
  const aside = page.locator('aside').first();
  await aside.getByRole('link', { name: 'Social Explorer' }).hover();
  const tip = page.locator('nav[aria-label="Principal"] span.fixed', {
    hasText: 'Social Explorer',
  });
  await expect(tip).toBeVisible();
  const tb = (await tip.boundingBox())!;
  const ab = (await aside.boundingBox())!;
  expect(tb.x, 'el tooltip sale del riel').toBeGreaterThanOrEqual(
    ab.x + ab.width,
  );
  const scrollX = await aside.evaluate(
    (el) => el.scrollWidth > el.clientWidth + 1,
  );
  expect(scrollX, 'scroll horizontal en el riel').toBe(false);
});

test('la cabecera conserva el periodo', async ({ page }) => {
  await page.goto('/publicaciones?periodo=30d');
  await expect(
    page.locator('header a[href^="/?periodo=30d#foxy"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('header a[href="/alertas?periodo=30d"]'),
  ).toHaveCount(1);
});

test('escritorio: KPI en una fila y gráficos en la primera pantalla', async ({
  page,
}) => {
  const vp = page.viewportSize()!;
  test.skip(vp.width < 1280, 'solo escritorio');
  await page.goto('/?periodo=30d');
  const chart = page.getByRole('heading', {
    name: 'Evolución de la conversación',
  });
  const cb = (await chart.boundingBox())!;
  expect(cb.y + 80, 'gráfico visible sin desplazarse').toBeLessThan(vp.height);
  const tops = new Set(
    await Promise.all(
      (
        await page
          .getByText(
            /^(Conversaciones analizadas|Sentimiento neto|Alcance total|Interacciones|Alertas por revisar|Incidentes activos)$/,
          )
          .all()
      ).map(async (l) => Math.round(((await l.boundingBox())?.y ?? 0) / 20)),
    ),
  );
  expect(tops.size, 'las seis KPI comparten fila').toBe(1);
});
