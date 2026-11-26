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

test('detalle: KPI, Foxy Intelligence con pestañas, distribución, evolución y navegación', async ({
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
  // Pestañas reales: solo la activa se muestra.
  const tabs = page.getByRole('tablist', { name: 'Dimensiones del análisis' });
  for (const t of [
    'Resumen',
    'Contenido',
    'Rendimiento',
    'Estrategia',
    'Creatividad',
    'Reputación',
  ])
    await expect(
      tabs.getByRole('tab', { name: new RegExp(`^${t}`) }),
    ).toBeVisible();
  await expect(page.getByText('Lo más importante')).toBeVisible();
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await tabs.getByRole('tab', { name: /^Rendimiento/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Performance Intelligence' }),
  ).toBeVisible();
  await expect(page.getByText('Lo más importante')).toHaveCount(0);
  // Teclado: flecha a la derecha pasa a Estrategia.
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('heading', { name: 'Strategic Intelligence' }),
  ).toBeVisible();
  await tabs.getByRole('tab', { name: /^Reputación/ }).click();
  await expect(page.getByRole('tabpanel')).toContainText(
    /Sin conversaciones detectadas|desactivado por privacidad|disponible/i,
  );
  // Evidencia expandible.
  await tabs.getByRole('tab', { name: /^Resumen/ }).click();
  const ev = page.locator('details', { hasText: /^Evidencia/ }).first();
  await expect(ev).not.toHaveAttribute('open', '');
  await ev.locator('summary').click();
  await expect(ev).toHaveAttribute('open', '');
  await expect(page.getByText('Hecho', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Distribución de interacciones' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Rendimiento comparable' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Evolución del rendimiento' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Me gusta', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Me gusta', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByText('Generar brief creativo · próximamente'),
  ).toBeVisible();
  const next = page.getByRole('link', { name: /Siguiente/ });
  if (await next.count()) {
    await next.click();
    await expect(page).toHaveURL(/periodo=30d/);
  }
});

test('Ask Foxy en el panel lateral: contexto de la publicación, sugerida y consulta libre honesta', async ({
  page,
}) => {
  await page.goto(POST, { waitUntil: 'networkidle' });
  const panel = page.getByRole('dialog', { name: 'Pregúntale a Foxy' });
  await expect(panel).toHaveCount(0);
  await page.getByRole('button', { name: 'Foxy IA' }).click();
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Detalle de publicación');
  await panel
    .getByRole('button', { name: '¿Qué prueba A/B recomendarías?' })
    .click();
  const answer = panel.locator('ol[aria-live="polite"]');
  await expect(answer.getByText('Prueba A/B sugerida').first()).toBeVisible();
  await expect(answer.getByText('Recomendaciones')).toBeVisible();
  await expect(answer.getByText('Preguntas de seguimiento')).toBeVisible();
  await expect(answer.getByText(/Datos sintéticos de prueba/)).toBeVisible();
  await panel
    .getByLabel('Pregunta para Foxy')
    .fill('¿Cuál es el sentido de la vida?');
  await panel.getByRole('button', { name: 'Enviar pregunta' }).click();
  await expect(
    answer.getByText(/no puede responder esta pregunta/),
  ).toBeVisible();
  // La página sigue detrás; Escape cierra y devuelve el foco al botón.
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Foxy IA' })).toBeFocused();
  // La conversación se conserva al reabrir en el mismo contexto.
  await page.getByRole('button', { name: 'Foxy IA' }).click();
  await expect(
    panel.getByText('¿Cuál es el sentido de la vida?'),
  ).toBeVisible();
});

test('Guardar como aprendizaje queda pendiente de revisión en Brand Brain', async ({
  page,
  baseURL,
}) => {
  await useHorizonte(page, baseURL!);
  await firstPost(page);
  await page
    .getByRole('tablist', { name: 'Dimensiones del análisis' })
    .getByRole('tab', { name: /^Creatividad/ })
    .click();
  await page
    .getByRole('button', { name: 'Guardar como aprendizaje' })
    .first()
    .click();
  await expect(
    page.getByRole('button', { name: 'Propuesto como aprendizaje' }).first(),
  ).toBeVisible();
  await page.goto('/brand-brain');
  await expect(
    page.getByText('Pendiente de revisión', { exact: true }).first(),
  ).toBeVisible();
});

test('Foxy Brand Brain: owner edita sin perder el periodo y la versión sube; Ask Foxy de marca', async ({
  page,
  baseURL,
}) => {
  await useHorizonte(page, baseURL!);
  await page.goto('/brand-brain?periodo=7d');
  await page
    .getByLabel('Propuesta de valor')
    .fill('[SINTÉTICO] Prevención cercana para familias.');
  await page.getByRole('button', { name: 'Guardar contexto' }).click();
  await expect(page.getByText(/Contexto guardado · versión/)).toBeVisible();
  await expect(page).toHaveURL(/periodo=7d/);
  await expect(page.getByLabel('Propuesta de valor')).toHaveValue(
    '[SINTÉTICO] Prevención cercana para familias.',
  );
  await expect(
    page.getByText(/Organización sintética de prueba/),
  ).toBeVisible();
  await page.goto('/foxy?periodo=30d');
  await expect(
    page.getByRole('heading', { name: 'Ask Foxy', level: 1 }),
  ).toBeVisible();
  await page
    .getByRole('main')
    .getByRole('button', { name: '¿Cómo se comparan Instagram y Facebook?' })
    .click();
  await expect(
    page
      .locator('ol[aria-live="polite"]')
      .getByText(/engagement mediano/)
      .first(),
  ).toBeVisible();
});
