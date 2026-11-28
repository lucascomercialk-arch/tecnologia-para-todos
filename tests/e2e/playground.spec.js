'use strict';

const { test, expect } = require('@playwright/test');
const { setupOfflineSafeRoutes, mockTasksApi } = require('./helpers');

test.describe('Playground Python (execução, input interativo, erros e ações)', () => {
  test('carrega exemplo da Home, executa código com input() interativo e mostra saída', async ({ page }) => {
    await setupOfflineSafeRoutes(page);
    await mockTasksApi(page);

    await page.goto('/');
    await page.click('#home-preview-run-btn');

    await expect(page.locator('#view-playground')).toBeVisible();
    const editor = page.locator('.fallback-editor');
    await expect(editor).toBeVisible();
    expect(await editor.inputValue()).toContain('input(');

    await page.click('#pg-run');

    // Console solicita entrada interativa
    const consoleInput = page.locator('#pg-console .console-input');
    await expect(consoleInput).toBeVisible();
    await consoleInput.fill('Camila');
    await consoleInput.press('Enter');

    await expect(page.locator('#pg-console .console-echo')).toContainText('Camila');
    await expect(page.locator('#pg-console')).toContainText('Bem-vindo(a), Camila');
    await expect(page.locator('#pg-console')).toContainText('Programa finalizado');
  });

  test('executa código simples, traduz erro em PT e re-renderiza em EN ao trocar idioma', async ({ page }) => {
    await setupOfflineSafeRoutes(page);
    await mockTasksApi(page);

    await page.goto('/#playground');
    const editor = page.locator('.fallback-editor');
    await expect(editor).toBeVisible();

    // Execução simples sem input()
    await editor.fill('print("Olá Playground")');
    await page.click('#pg-run');
    await expect(page.locator('#pg-console')).toContainText('Olá Playground');

    // Execução com erro de importação
    await editor.fill('import modulo_inexistente');
    await page.click('#pg-run');
    const errCard = page.locator('#pg-console .err-card');
    await expect(errCard).toBeVisible();
    await expect(errCard).toContainText('Biblioteca não encontrada');
    await expect(errCard).toContainText('modulo_inexistente');

    // Troca idioma para EN -> cartão de erro ativo é atualizado na hora
    await page.click('[data-set-lang="en"]');
    await expect(errCard).toContainText('Library not found');
    await expect(errCard).toContainText('modulo_inexistente');
  });

  test('interrompe execução com Parar, ajusta fonte, limpa editor/console e baixa .py localizado', async ({ page }) => {
    await setupOfflineSafeRoutes(page);
    await mockTasksApi(page);

    await page.goto('/#playground');
    const editor = page.locator('.fallback-editor');
    await expect(editor).toBeVisible();

    // Loop infinito + botão Parar
    await editor.fill('while True:\n    print("loop")');
    await page.click('#pg-run');
    await expect(page.locator('#pg-stop')).toBeVisible();
    await page.click('#pg-stop');
    await expect(page.locator('#pg-stop')).toBeHidden();
    await expect(page.locator('#pg-console')).toContainText('interrompida');

    // Fonte A+ / A-
    const beforeSize = await editor.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    await page.click('#pg-font-up');
    const upSize = await editor.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(upSize).toBeGreaterThan(beforeSize);
    await page.click('#pg-font-down');
    const downSize = await editor.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(downSize).toBe(beforeSize);

    // Download .py com nome localizado (PT -> meu_programa.py, EN -> my_program.py)
    const [dlPt] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#pg-download-code'),
    ]);
    expect(dlPt.suggestedFilename()).toBe('meu_programa.py');

    await page.click('[data-set-lang="en"]');
    const [dlEn] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#pg-download-code'),
    ]);
    expect(dlEn.suggestedFilename()).toBe('my_program.py');

    // Limpar console e editor
    await page.click('#pg-clear-console');
    await expect(page.locator('#pg-console')).toContainText('Console cleared');

    await page.click('#pg-clear-code');
    expect(await editor.inputValue()).toBe('');
  });
});
