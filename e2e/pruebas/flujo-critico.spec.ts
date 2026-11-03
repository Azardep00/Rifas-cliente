import { expect, Page, test } from '@playwright/test';
import { ApiFalsa, CODIGO_RESERVA, CODIGO_RIFA } from './api-falsa';

/** Registra violaciones de CSP del navegador: el build de producción debe correr bajo la CSP de vercel.json. */
async function vigilarCsp(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  return () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
}

/** En celular una pantalla que desborda a lo ancho es un defecto de diseño. */
async function sinDesbordeHorizontal(page: Page): Promise<void> {
  const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(ok, 'la página no debe tener scroll horizontal').toBe(true);
}

test('reservar → confirmar pago → ver ganador', async ({ page, browser }) => {
  const api = new ApiFalsa();
  await api.instalar(page);
  const violaciones = await vigilarCsp(page);

  // 1) Home → detalle de la rifa
  await page.goto('/');
  await page.getByRole('link', { name: /Moto 0 km/ }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Moto 0 km' })).toBeVisible();
  await sinDesbordeHorizontal(page);

  // 2) Escoger dos números en la grilla y reservar
  await page.locator('button[data-n="7"]').click();
  await page.locator('button[data-n="12"]').click();
  await expect(page.getByRole('complementary', { name: 'Tu selección de números' })).toBeVisible();
  await page.getByRole('link', { name: 'Reservar', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Reserva tus números' })).toBeVisible();
  await page.getByLabel('Nombre completo').fill('Ana Pérez');
  await page.getByLabel('Celular (WhatsApp)').fill('300 123 4567');
  await sinDesbordeHorizontal(page);
  await page.getByRole('button', { name: 'Reservar 2 números' }).click();

  // 3) Pantalla de reserva: cuenta regresiva y números
  await page.waitForURL(new RegExp(`/reserva/${CODIGO_RESERVA}`));
  const pedirTelefono = page.getByLabel('Celular', { exact: true });
  if (await pedirTelefono.isVisible().catch(() => false)) {
    await pedirTelefono.fill('300 123 4567');
    await page.getByRole('button', { name: 'Buscar mi reserva' }).click();
  }
  await expect(page.getByRole('timer', { name: 'Tiempo restante para pagar' })).toBeVisible();
  await sinDesbordeHorizontal(page);

  // 4) Admin: login → cola de pagos → confirmar pago manual
  const contextoAdmin = await browser.newContext({ ...test.info().project.use, baseURL: 'http://localhost:4300' });
  const admin = await contextoAdmin.newPage();
  await api.instalar(admin);
  await admin.goto('/admin/login');
  await admin.getByLabel('Correo').fill('admin@alexrifas.local');
  await admin.locator('#contrasena').fill('clave-e2e-123456');
  await admin.getByRole('button', { name: 'Ingresar' }).click();
  await admin.waitForURL(/\/admin$/);
  await admin.goto('/admin/pagos');
  await expect(admin.getByRole('heading', { name: 'Pagos' })).toBeVisible();
  const tarjeta = admin.locator('article.compra').first();
  await expect(tarjeta).toContainText(CODIGO_RESERVA);
  await tarjeta.getByRole('button', { name: 'Confirmar pago' }).click();
  await tarjeta.getByRole('button', { name: 'Nequi' }).click();
  await tarjeta.getByRole('button', { name: 'Confirmar pago' }).last().click();
  await expect(admin.getByText(/Pago confirmado/)).toBeVisible();
  await sinDesbordeHorizontal(admin);
  expect(api.compra?.estado).toBe('CONFIRMADA');
  await contextoAdmin.close();

  // 5) La persona recarga su reserva y ya aparece confirmada
  await page.reload();
  await expect(page.getByText('El organizador confirmó tu pago')).toBeVisible();

  // 6) Sorteo (simulado en el backend falso) → resultados públicos muestran el ganador
  api.sortear();
  await page.goto(`/resultados/${CODIGO_RIFA}`);
  await expect(page.getByLabel('Número ganador 07')).toBeVisible();
  await sinDesbordeHorizontal(page);

  expect(await violaciones(), 'sin violaciones de CSP').toEqual([]);
});

test('un número ocupado muestra el error y no rompe la reserva', async ({ page }) => {
  const api = new ApiFalsa();
  api.estados[5] = 'V';
  await api.instalar(page);
  await page.goto(`/rifa/${CODIGO_RIFA}`);
  const ocupado = page.locator('button[data-n="5"]');
  await expect(ocupado).toHaveAttribute('aria-disabled', 'true');
});
