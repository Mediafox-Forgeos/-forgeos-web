import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { setTheme, signInDemo, type QaTheme } from './support';

/**
 * Fuentes y cobertura V2 (WO-HF-METRICOOL-INTEGRATION-001): flujo de conexión simulado con el
 * servidor Metricool sintético (modo demo). No hay red ni credenciales reales.
 */
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ context, baseURL }, info) => {
  const theme = (info.project.metadata.theme ?? 'legacy') as QaTheme;
  test.skip(
    theme === 'legacy' || info.project.name !== 'v2-light-1440',
    'flujo con estado: un solo proyecto',
  );
  await setTheme(context, baseURL!, theme);
  await signInDemo(context, baseURL!);
});

test('conectar, sincronizar, pausar y desconectar (simulación)', async ({
  page,
}) => {
  await page.goto('/cobertura');
  const reset = page.getByRole('button', { name: 'Reiniciar simulación' });
  if (await reset.isVisible()) await reset.click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Metricool' }),
  ).toBeVisible();
  await expect(page.getByText('Simulación · datos sintéticos')).toBeVisible();
  await expect(page.getByText('No conectada')).toBeVisible();
  await page.getByRole('button', { name: 'Conectar marca' }).click();
  await expect(
    page.getByText('Marca conectada. Ya puedes sincronizar.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sincronizar ahora' }).click();
  await expect(page.getByText('Sincronización completada.')).toBeVisible();
  const matrix = page.getByRole('region', { name: 'Matriz de cobertura' });
  await expect(
    matrix.getByRole('rowheader', { name: 'Instagram' }),
  ).toBeVisible();
  await expect(matrix).toContainText('Sin permiso'); // Facebook sin permiso de comentarios en la simulación
  await expect(matrix).toContainText('CSV'); // TikTok: no disponible con motivo
  await expect(
    page.getByRole('heading', { name: 'Publicaciones importadas' }),
  ).toBeVisible();
  await expect(
    page.getByText('Carrusel · 2 medios entregados por la fuente'),
  ).toBeVisible();
  await expect(
    page.getByText('Video · la fuente solo entrega la miniatura'),
  ).toBeVisible();
  await expect(page.getByText('La fuente no entregó imagen')).toBeVisible();
  // Ningún secreto en la página.
  const html = await page.content();
  expect(html).not.toMatch(/fixture-token|X-Mc-Auth/);
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    axe.violations
      .filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
      .map((v) => v.id),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Pausar' }).click();
  await expect(
    page.getByText('Sincronización pausada para esta organización.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sincronizar ahora' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Reanudar' }).click();
  await page.getByText('Desconectar', { exact: true }).click();
  await page
    .getByLabel('Escribe DESCONECTAR para confirmar')
    .fill('DESCONECTAR');
  await page.getByRole('button', { name: 'Confirmar desconexión' }).click();
  await expect(page.getByText('Metricool desconectado.')).toBeVisible();
  await page.getByRole('button', { name: 'Reiniciar simulación' }).click();
});

test('viewer: ve el estado, no las acciones', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: 'hf_demo_user', value: 'demo-user-viewer', url: baseURL! },
  ]);
  await page.goto('/cobertura');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Metricool' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Conectar marca|Sincronizar ahora/ }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Solo owner y admin pueden sincronizar'),
  ).toBeVisible();
});
