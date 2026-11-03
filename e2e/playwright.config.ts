import { defineConfig, devices } from '@playwright/test';

/** App pensada para celular: el proyecto principal es un Pixel 5; el de escritorio es el contraste. */
export default defineConfig({
  testDir: './pruebas',
  timeout: 45_000,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4300', trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'es-CO' },
  projects: [
    { name: 'movil', use: { ...devices['Pixel 5'] } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: { command: 'node servidor.mjs', url: 'http://localhost:4300', reuseExistingServer: !process.env['CI'], timeout: 30_000 },
});
