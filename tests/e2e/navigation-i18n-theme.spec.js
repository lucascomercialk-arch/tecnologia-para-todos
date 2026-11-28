'use strict';

const { test, expect } = require('@playwright/test');
const { setupOfflineSafeRoutes, mockTasksApi } = require('./helpers');

test.describe('Carregamento inicial, tema claro/escuro e troca de idiomas', () => {
  test('carrega a página inicial sem erros JS nem overflow horizontal', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await setupOfflineSafeRoutes(page);
    await mockTasksApi(page);

    await page.goto('/');

    await expect(page).toHaveTitle(/Tecnologia para Todos/);
    await expect(page.locator('#view-inicio')).toBeVisible();
    await expect(page.locator('#view-aulas')).toBeHidden();
    await expect(page.locator('#home-preview-run-btn')).toBeVisible();
    await expect(page.locator('#theme-toggle')).toBeVisible();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    expect(pageErrors).toEqual([]);
  });

  test('alterna modo claro/escuro, persiste em localStorage e respeita prefers-color-scheme', async ({ page }) => {
    await setupOfflineSafeRoutes(page);
    await mockTasksApi(page);

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-pressed', 'true');
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(darkBg).toBe('rgb(11, 17, 32)');

    // Troca manual para claro persiste após recarregar a página
    await page.click('#theme-toggle');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => localStorage.getItem('tpt_theme'))).toBe('light');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Troca para escuro e persiste após reload
    await page.click('#theme-toggle');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('tpt_theme'))).toBe('dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('alterna idiomas PT, ES e EN, atualiza html[lang] e persiste escolha', async ({ page }) => {
    await setupOfflineSafeRoutes(page);
    await mockTasksApi(page);

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.locator('#tab-aulas')).toContainText('Trilha de Aulas');

    await page.click('[data-set-lang="es"]');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('[data-set-lang="es"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tab-aulas')).toContainText('Ruta de Clases');
    await expect(page.locator('[data-i18n="home.hero.ctaLearn"]')).toContainText('Empezar a Aprender');

    await page.click('[data-set-lang="en"]');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('[data-set-lang="en"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tab-aulas')).toContainText('Lessons Path');
    await expect(page.locator('[data-i18n="home.hero.ctaLearn"]')).toContainText('Start Learning');
    await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-label', /Switch to dark mode/i);
    expect(await page.evaluate(() => localStorage.getItem('tpt_lang'))).toBe('en');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#tab-aulas')).toContainText('Lessons Path');

    await page.click('[data-set-lang="pt"]');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.locator('#tab-aulas')).toContainText('Trilha de Aulas');
  });

  test('detecta idioma inicial pelo navigator.language quando localStorage está vazio', async ({ page }) => {
    await setupOfflineSafeRoutes(page);
    await mockTasksApi(page);

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'language', { get: () => 'es-ES' });
      Object.defineProperty(navigator, 'languages', { get: () => ['es-ES'] });
    });

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('[data-set-lang="es"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tab-aulas')).toContainText('Ruta de Clases');
  });
});
