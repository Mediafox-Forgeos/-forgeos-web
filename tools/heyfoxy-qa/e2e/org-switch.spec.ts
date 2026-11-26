import { expect, test, type Page } from '@playwright/test';
import { setTheme, signInDemo, type QaTheme } from './support';

/**
 * Selector de organización (bloqueo del piloto MedPlus, 2026-11-26): elegir otra organización
 * en el desplegable cambia la organización activa sin más pasos, el desplegable refleja la
 * organización activa tras el cambio, y los datos de la otra organización dejan de verse.
 * Modo demo: owner con dos organizaciones (Clínica Aurora y Banco Horizonte).
 */
const AURORA = '00000000-0000-4000-a000-0000000000a1';
const HORIZONTE = '00000000-0000-4000-a000-0000000000b1';
const AURORA_POST = '/publicaciones/demo-clinica-aurora-post-instagram';

test.beforeEach(async ({ context, baseURL }, info) => {
  test.skip(
    !['desktop-1440', 'v2-light-1440'].includes(info.project.name),
    'un proyecto por tema',
  );
  await setTheme(
    context,
    baseURL!,
    (info.project.metadata.theme ?? 'legacy') as QaTheme,
  );
  await signInDemo(context, baseURL!);
});

const selectOf = (page: Page, theme: string) =>
  page.locator(theme === 'legacy' ? 'select#org' : 'select#org-side');

test('cambiar de organización solo con el desplegable, ida y vuelta, sin mezclar datos', async ({
  page,
}, info) => {
  const theme = String(info.project.metadata.theme ?? 'legacy');
  const select = selectOf(page, theme);
  const form = page.locator('form', { has: select });

  await page.goto('/publicaciones', { waitUntil: 'networkidle' });
  await expect(select).toHaveValue(AURORA);
  await expect(page.locator(`a[href="${AURORA_POST}"]`).first()).toBeVisible();

  // Solo elegir: sin pulsar «Cambiar organización».
  await select.selectOption(HORIZONTE);
  await expect(form).toContainText('Banco Horizonte');
  await expect(select).toHaveValue(HORIZONTE);
  await expect(page.locator(`a[href="${AURORA_POST}"]`)).toHaveCount(0);
  // La publicación de Aurora no es accesible desde Horizonte.
  const res = await page.goto(AURORA_POST);
  expect(res?.status()).toBe(404);

  await page.goto('/publicaciones', { waitUntil: 'networkidle' });
  await expect(select).toHaveValue(HORIZONTE);
  await select.selectOption(AURORA);
  await expect(form).toContainText('Clínica Aurora');
  await expect(select).toHaveValue(AURORA);
  await expect(page.locator(`a[href="${AURORA_POST}"]`).first()).toBeVisible();
});

test('una cookie de organización ajena se ignora (vuelve a una membresía real)', async ({
  page,
  context,
  baseURL,
}, info) => {
  await context.addCookies([
    {
      name: 'hf_org',
      value: '99999999-0000-4000-a000-000000000099',
      url: baseURL!,
    },
  ]);
  await page.goto('/publicaciones', { waitUntil: 'networkidle' });
  await expect(
    selectOf(page, String(info.project.metadata.theme ?? 'legacy')),
  ).toHaveValue(AURORA);
});
