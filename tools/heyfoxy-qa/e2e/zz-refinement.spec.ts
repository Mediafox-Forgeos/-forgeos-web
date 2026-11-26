import { expect, test, type Page } from '@playwright/test';
import { setTheme, signInDemo, type QaTheme } from './support';

/**
 * WO-HF-V2-UX-REFINEMENT-002: pruebas de los defectos de la validación del Preview b499fe1
 * (composición, visualizaciones, tooltips, Home, copiloto y revisión de aprendizajes).
 * Archivo «zz-»: se ejecuta al final porque la revisión de aprendizajes modifica la demo.
 */
const POST = '/publicaciones/demo-clinica-aurora-post-instagram?periodo=30d';
const WIDTHS = [390, 500, 820, 1440, 1536, 1920];

test.describe.configure({ mode: 'serial' });
test.beforeEach(async ({ context, baseURL }, info) => {
  test.skip(
    info.project.name !== 'v2-light-1440',
    'recorre sus propios anchos: un solo proyecto',
  );
  await setTheme(
    context,
    baseURL!,
    (info.project.metadata.theme ?? 'v2-light') as QaTheme,
  );
  await signInDemo(context, baseURL!);
});

const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test('detalle: composición sin columna fija, sin desbordes y barras alineadas en todos los anchos', async ({
  page,
}) => {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(POST, { waitUntil: 'networkidle' });
    expect(await overflowX(page), `desborde a ${w}px`).toBeLessThanOrEqual(0);
    // La publicación original no queda fijada (HF-UX-17).
    const pos = await page
      .getByRole('article', { name: /Publicación original/ })
      .evaluate((el) => {
        let n: HTMLElement | null = el as HTMLElement;
        while (n) {
          if (getComputedStyle(n).position === 'sticky') return 'sticky';
          n = n.parentElement;
        }
        return 'static';
      });
    expect(pos, `columna fija a ${w}px`).toBe('static');
    // Distribución: etiqueta y valor en una sola línea por fila (HF-UX-16).
    const rows = page
      .getByRole('heading', { name: 'Distribución de interacciones' })
      .locator('xpath=ancestor::section[1]')
      .locator('ul > li > div:first-child');
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const h = (await rows.nth(i).boundingBox())!.height;
      expect(h, `fila ${i} partida a ${w}px`).toBeLessThan(30);
    }
  }
});

test('tooltips de las métricas visibles y dentro de la pantalla (HF-UX-15)', async ({
  page,
}) => {
  for (const w of [390, 1440, 1920]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(POST, { waitUntil: 'networkidle' });
    const btns = page.getByRole('button', { name: /^Qué es / });
    const count = await btns.count();
    expect(count).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < count; i++) {
      const b = btns.nth(i);
      await b.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await b.focus();
      const tip = b.locator('xpath=following-sibling::*[@role="tooltip"]');
      await expect(tip).toBeVisible();
      const box = (await tip.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(w + 1);
      // No lo tapa ni lo recorta ningún contenedor: el centro pertenece al tooltip.
      const own = await tip.evaluate((el) => {
        // El tooltip no recibe eventos (pointer-events: none); para la prueba de
        // superposición se activa un momento.
        (el as HTMLElement).style.pointerEvents = 'auto';
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        );
        (el as HTMLElement).style.pointerEvents = '';
        return !!hit && el.contains(hit);
      });
      expect(own, `tooltip ${i} recortado a ${w}px`).toBe(true);
      await b.blur();
    }
  }
});

test('Intelligence Home: brief de 3 a 5 hallazgos, KPI por red, reputación separada', async ({
  page,
}) => {
  await page.goto('/?periodo=30d', { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('heading', {
      name: '¿Qué debería saber hoy el director de marca?',
    }),
  ).toBeVisible();
  const items = page
    .getByRole('heading', {
      name: '¿Qué debería saber hoy el director de marca?',
    })
    .locator('xpath=ancestor::section[1]')
    .locator('ol > li');
  const n = await items.count();
  expect(n).toBeGreaterThanOrEqual(3);
  expect(n).toBeLessThanOrEqual(5);
  await expect(
    page
      .getByText('Motor local por reglas · sin IA generativa', {
        exact: false,
      })
      .first(),
  ).toBeVisible();
  // KPI por red, sin «Alcance total» que mezcle redes.
  await expect(page.getByText('Alcance total')).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Indicadores de Instagram' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Indicadores de Facebook' }),
  ).toContainText('Impresiones únicas acumulado');
  await expect(page.getByText('no son personas únicas').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reputación' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Foxy Brand Brain' }),
  ).toBeVisible();
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto('/?periodo=30d', { waitUntil: 'networkidle' });
    expect(await overflowX(page), `desborde a ${w}px`).toBeLessThanOrEqual(0);
  }
});

test('copiloto: pregunta sugerida desde Home; en móvil ocupa la pantalla completa', async ({
  page,
}) => {
  await page.goto('/?periodo=30d', { waitUntil: 'networkidle' });
  await page
    .getByRole('main')
    .getByRole('button', {
      name: '¿Qué deberíamos publicar la próxima semana?',
    })
    .click();
  const panel = page.getByRole('dialog', { name: 'Pregúntale a Foxy' });
  await expect(panel).toContainText('Intelligence Home');
  await expect(
    panel.getByText(/Propuesta|Recomendaciones/).first(),
  ).toBeVisible();
  // El periodo y la página se conservan.
  await expect(page).toHaveURL(/\/\?periodo=30d$/);
  await page.setViewportSize({ width: 390, height: 844 });
  const box = (await panel.boundingBox())!;
  expect(Math.round(box.width)).toBe(390);
  await panel.getByRole('button', { name: 'Cerrar Foxy' }).click();
  await expect(panel).toHaveCount(0);
});

test('Brand Brain: revisar un aprendizaje (rechazo exige motivo; aprobar registra autor)', async ({
  page,
  baseURL,
}) => {
  // Modifica datos: Banco Horizonte (las capturas de referencia usan Clínica Aurora).
  await page.context().addCookies([
    {
      name: 'hf_org',
      value: '00000000-0000-4000-a000-0000000000b1',
      url: baseURL!,
    },
  ]);
  await page.goto('/publicaciones?periodo=90d', { waitUntil: 'networkidle' });
  const href = await page
    .locator('main a[href^="/publicaciones/"]')
    .first()
    .getAttribute('href');
  await page.goto(href!, { waitUntil: 'networkidle' });
  await page
    .getByRole('tablist', { name: 'Dimensiones del análisis' })
    .getByRole('tab', { name: /^Creatividad/ })
    .click();
  await page
    .getByRole('button', { name: 'Guardar como aprendizaje' })
    .last()
    .click();
  await expect(
    page.getByRole('button', { name: 'Propuesto como aprendizaje' }).first(),
  ).toBeVisible();
  await page.goto('/brand-brain?periodo=30d', { waitUntil: 'networkidle' });
  const pending = page
    .getByRole('heading', { name: /^Pendientes de revisión/ })
    .locator('xpath=ancestor::section[1]');
  const card = pending.getByRole('article').first();
  const title = (await card.getByRole('heading').textContent())!;
  await expect(card).toContainText('Pendiente de revisión');
  await expect(card).toContainText('Propuesto por: Laura');
  await card.getByText(/^Evidencia/).click();
  await expect(
    card.getByRole('link', { name: 'Publicación analizada' }),
  ).toHaveAttribute('href', /periodo=30d/);
  await card.getByRole('button', { name: 'Rechazar' }).click();
  await expect(card.getByRole('alert')).toContainText('motivo');
  await card
    .getByLabel(/Motivo o nota de la decisión/)
    .fill('[PRUEBA QA] Coincide con lo observado en el piloto sintético');
  await card.getByRole('button', { name: 'Aprobar' }).click();
  const history = page
    .getByRole('heading', { name: /^Historial de decisiones/ })
    .locator('xpath=ancestor::section[1]');
  const done = history.getByRole('article', { name: title });
  await expect(done).toContainText('Aprobado por: Laura');
  await expect(done).toContainText('[PRUEBA QA] Coincide');
  await expect(done.getByRole('button', { name: 'Aprobar' })).toHaveCount(0);
  await expect(done.getByRole('button', { name: 'Archivar' })).toBeVisible();
});
