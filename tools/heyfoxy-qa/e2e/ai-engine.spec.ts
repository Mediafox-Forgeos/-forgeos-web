import { expect, test } from '@playwright/test';
import { setTheme, signInDemo, type QaTheme } from './support';

/**
 * WO-HF-AI-ENGINE-001: el motor generativo está preparado pero NO activado (servidor de QA sin
 * proveedor ni clave). Se comprueba que todo sigue en el motor local, identificado, y que el
 * endpoint de Ask Foxy en streaming exige sesión y mismo origen.
 */
test.beforeEach(async ({ context, baseURL }, info) => {
  test.skip(info.project.name !== 'v2-light-1440', 'un solo proyecto');
  await setTheme(
    context,
    baseURL!,
    (info.project.metadata.theme ?? 'v2-light') as QaTheme,
  );
});

test('Uso y presupuestos: motor, modelos verificados y clave sin configurar', async ({
  page,
  context,
  baseURL,
}) => {
  await signInDemo(context, baseURL!);
  await page.goto('/uso', { waitUntil: 'networkidle' });
  const engine = page
    .getByRole('heading', { name: 'Foxy Intelligence Engine' })
    .locator('xpath=ancestor::*[contains(@class,"rounded")][1]');
  await expect(engine).toContainText(
    'Motor local por reglas · sin IA generativa',
  );
  await expect(engine).toContainText('No configurada');
  for (const id of ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'])
    await expect(engine).toContainText(id);
  await expect(
    page.getByText('Consumo de IA generativa este mes'),
  ).toBeVisible();
});

test('endpoint de Ask Foxy: sin sesión no responde; otro origen 403', async ({
  request,
  context,
  baseURL,
}) => {
  const body = { question: '¿Qué funcionó?', requestId: 'qa-prueba-0001' };
  const anon = await request.post('/api/foxy/ask', {
    data: body,
    headers: { origin: baseURL! },
    maxRedirects: 0,
  });
  // Sin sesión no se llega al motor: el middleware redirige a /login (o el endpoint responde 401).
  expect([302, 303, 307, 401]).toContain(anon.status());
  if (anon.status() !== 401)
    expect(anon.headers()['location']).toContain('/login');
  await signInDemo(context, baseURL!);
  const cross = await context.request.post('/api/foxy/ask', {
    data: body,
    headers: { origin: 'https://evil.example' },
    maxRedirects: 0,
  });
  expect(cross.status()).toBe(403);
});

test('Ask Foxy lateral responde por streaming con el motor local identificado', async ({
  page,
  context,
  baseURL,
}) => {
  await signInDemo(context, baseURL!);
  await page.goto(
    '/publicaciones/demo-clinica-aurora-post-instagram?periodo=30d',
    { waitUntil: 'networkidle' },
  );
  await page.locator('#copilot-trigger').click();
  const panel = page.getByRole('dialog', { name: 'Pregúntale a Foxy' });
  await expect(panel).toContainText(
    'Motor local por reglas · sin IA generativa',
  );
  const res = page.waitForResponse((r) => r.url().endsWith('/api/foxy/ask'));
  await panel.getByRole('button', { name: /^¿/ }).first().click();
  const r = await res;
  expect(r.headers()['content-type']).toContain('application/x-ndjson');
  await expect(
    panel.locator('article, p').filter({ hasText: /\S/ }).first(),
  ).toBeVisible();
  await expect(panel.getByRole('alert')).toHaveCount(0);
});
