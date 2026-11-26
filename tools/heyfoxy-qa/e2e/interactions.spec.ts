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
    page.locator('header a[href="/alertas?periodo=30d"]'),
  ).toHaveCount(1);
  // «Foxy IA» abre el copiloto lateral sin salir de la pantalla
  // (WO-HF-V2-UX-REFINEMENT-002); el acceso a Ask Foxy general conserva el periodo.
  await page.getByRole('button', { name: 'Foxy IA' }).click();
  await expect(page).toHaveURL(/\/publicaciones\?periodo=30d$/);
  await expect(
    page
      .getByRole('dialog', { name: 'Pregúntale a Foxy' })
      .locator('a[href="/foxy?periodo=30d"]'),
  ).toHaveCount(1);
});

test('escritorio: cabecera ejecutiva, KPI por red y Executive Brief en la primera pantalla', async ({
  page,
}) => {
  const vp = page.viewportSize()!;
  test.skip(vp.width < 1280, 'solo escritorio');
  await page.goto('/?periodo=30d');
  for (const name of [
    /^Indicadores de Instagram$/,
    /^Indicadores de Facebook$/,
  ]) {
    const b = (await page.getByRole('region', { name }).boundingBox())!;
    expect(b.y + b.height, 'KPI por red sin desplazarse').toBeLessThan(
      vp.height,
    );
  }
  const brief = (await page
    .getByRole('heading', {
      name: '¿Qué debería saber hoy el director de marca?',
    })
    .boundingBox())!;
  expect(brief.y + 40, 'brief visible sin desplazarse').toBeLessThan(vp.height);
  const igTop = (await page
    .getByRole('region', { name: /^Indicadores de Instagram$/ })
    .boundingBox())!.y;
  const fbTop = (await page
    .getByRole('region', { name: /^Indicadores de Facebook$/ })
    .boundingBox())!.y;
  expect(Math.abs(igTop - fbTop), 'las redes comparten fila').toBeLessThan(4);
});
