import { expect, test } from '@playwright/test';
import { setTheme, signInDemo, type QaTheme } from './support';

/**
 * Foxy Intelligence (WO-HF-V2-INTELLIGENCE-001 + addendum): centro de inteligencia de la
 * publicación, Ask Foxy contextual, «Guardar como aprendizaje» y Foxy Brand Brain.
 * Modo demo: datos sintéticos, motor local por reglas (sin red ni IA generativa).
 */
const POST = '/publicaciones/demo-clinica-aurora-post-instagram?periodo=30d';
/** Los flujos que MODIFICAN datos de la demo usan Banco Horizonte: las capturas usan Aurora. */
const HORIZONTE = '00000000-0000-4000-a000-0000000000b1';
async function useHorizonte(
  page: import('@playwright/test').Page,
  baseURL: string,
) {
  await page
    .context()
    .addCookies([{ name: 'hf_org', value: HORIZONTE, url: baseURL }]);
}
async function firstPost(page: import('@playwright/test').Page) {
  await page.goto('/publicaciones?periodo=90d', { waitUntil: 'networkidle' });
  const href = await page
    .locator('main a[href^="/publicaciones/"]')
    .first()
    .getAttribute('href');
  await page.goto(href!, { waitUntil: 'networkidle' });
}

test.describe.configure({ mode: 'serial' });
test.beforeEach(async ({ context, baseURL }, info) => {
  test.skip(
    info.project.name !== 'v2-light-1440',
    'flujo con estado: un solo proyecto',
  );
  await setTheme(
    context,
    baseURL!,
    (info.project.metadata.theme ?? 'v2-light') as QaTheme,
  );
  await signInDemo(context, baseURL!);
});

test('detalle: KPI, Foxy Content Intelligence, distribución, evolución y navegación', async ({
  page,
}) => {
  await page.goto(POST, { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('heading', {
      name: '¿Qué podemos aprender de esta publicación?',
    }),
  ).toBeVisible();
  await expect(
    page.getByText('Motor local por reglas · sin IA generativa').first(),
  ).toBeVisible();
  for (const layer of [
    'Content Intelligence',
    'Performance Intelligence',
    'Strategic Intelligence',
    'Creative Intelligence',
    'Reputation Intelligence',
  ])
    await expect(page.getByRole('heading', { name: layer })).toBeVisible();
  await expect(page.getByText('Hecho', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Distribución de interacciones' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Evolución del rendimiento' }),
  ).toBeVisible();
  // Selector de métrica de la evolución
  await page.getByRole('button', { name: 'Me gusta', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Me gusta', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  // Próximas capacidades: visibles, sin simular acciones
  await expect(
    page.getByText('Generar brief creativo · próximamente'),
  ).toBeVisible();
  // Navegación entre publicaciones conserva el periodo
  const next = page.getByRole('link', { name: /Siguiente/ });
  if (await next.count()) {
    await next.click();
    await expect(page).toHaveURL(/periodo=30d/);
  }
});

test('Ask Foxy contextual: pregunta sugerida y consulta libre honesta', async ({
  page,
}) => {
  await page.goto(POST, { waitUntil: 'networkidle' });
  await page
    .getByRole('button', { name: '¿Qué prueba A/B recomendarías?' })
    .click();
  const answer = page.locator('ol[aria-live="polite"]');
  await expect(answer.getByText('Prueba A/B sugerida').first()).toBeVisible();
  await expect(answer.getByText('Recomendación').first()).toBeVisible();
  await expect(answer.getByText(/Datos sintéticos de prueba/)).toBeVisible();
  await page
    .getByLabel('Pregunta para Foxy')
    .fill('¿Cuál es el sentido de la vida?');
  await page.getByRole('button', { name: 'Enviar pregunta' }).click();
  await expect(
    answer.getByText(/no puede responder esta pregunta/),
  ).toBeVisible();
});

test('Guardar como aprendizaje queda como propuesta en Brand Brain', async ({
  page,
  baseURL,
}) => {
  await useHorizonte(page, baseURL!);
  await firstPost(page);
  const save = page
    .getByRole('button', { name: 'Guardar como aprendizaje' })
    .first();
  await save.click();
  await expect(
    page.getByRole('button', { name: 'Propuesto como aprendizaje' }).first(),
  ).toBeVisible();
  await page.goto('/brand-brain');
  await expect(
    page.getByText('Propuesto', { exact: true }).first(),
  ).toBeVisible();
});

test('Foxy Brand Brain: owner edita y la versión sube; Ask Foxy de marca', async ({
  page,
  baseURL,
}) => {
  await useHorizonte(page, baseURL!);
  await page.goto('/brand-brain');
  await page
    .getByLabel('Propuesta de valor')
    .fill('[SINTÉTICO] Prevención cercana para familias.');
  await page.getByRole('button', { name: 'Guardar contexto' }).click();
  await expect(page.getByText(/Contexto guardado \(versión/)).toBeVisible();
  await expect(page.getByLabel('Propuesta de valor')).toHaveValue(
    '[SINTÉTICO] Prevención cercana para familias.',
  );
  await page.goto('/foxy?periodo=30d');
  await expect(
    page.getByRole('heading', { name: 'Ask Foxy', level: 1 }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '¿Cómo se comparan Instagram y Facebook?' })
    .click();
  await expect(
    page
      .locator('ol[aria-live="polite"]')
      .getByText(/mediana de engagement/)
      .first(),
  ).toBeVisible();
});
