'use strict';

const { test, expect } = require('@playwright/test');
const { setupOfflineSafeRoutes, mockTasksApi } = require('./helpers');

test.describe('Navegação das aulas e glossário', () => {
  test('navega pelas Aulas 1, 2 e 3, marca progresso no Playground e traduz conteúdo', async ({ page }) => {
    await setupOfflineSafeRoutes(page);
    await mockTasksApi(page);

    await page.goto('/');
    await page.locator('#view-inicio [data-go-tab="aulas"]').first().click();

    await expect(page.locator('#view-aulas')).toBeVisible();
    await expect(page).toHaveURL(/#aulas$/);
    await expect(page.locator('#lesson-hero')).toContainText('Primeiros Passos');

    // Troca para Aula 2 e depois Aula 3
    await page.click('[data-select-lesson="aula-2"]');
    await expect(page.locator('#lesson-hero')).toContainText('Listas e Repetições');

    await page.click('[data-select-lesson="aula-3"]');
    await expect(page.locator('#lesson-hero')).toContainText('Bibliotecas Básicas');
    await expect(page.locator('#lesson-cards')).toContainText('random.randint()');
    await expect(page.locator('#lesson-cards')).toContainText('time.sleep()');

    // Traduz Aula 3 para Inglês em tempo real
    await page.click('[data-set-lang="en"]');
    await expect(page.locator('#lesson-hero')).toContainText('Basic Libraries');
    await expect(page.locator('#lesson-cards')).toContainText('What is a library?');

    // Clica em "Try in Playground" em um card da Aula 3
    const firstTryBtn = page.locator('#lesson-cards [data-try-code]').first();
    await firstTryBtn.click();

    await expect(page.locator('#view-playground')).toBeVisible();
    await expect(page).toHaveURL(/#playground$/);
    const editorVal = await page.locator('.fallback-editor').inputValue();
    expect(editorVal).toContain('random');

    // Volta para Aulas e confirma card marcado como testado
    await page.click('#tab-aulas');
    await expect(page.locator('#lesson-cards')).toContainText('✓ Tried');
    const savedDone = await page.evaluate(() => JSON.parse(localStorage.getItem('tpt.completedCards') || '[]'));
    expect(savedDone.length).toBeGreaterThan(0);
  });

  test('filtra categorias e busca termos no glossário em múltiplos idiomas', async ({ page }) => {
    await setupOfflineSafeRoutes(page);
    await mockTasksApi(page);

    await page.goto('/');
    await page.click('#tab-glossario');
    await expect(page.locator('#view-glossario')).toBeVisible();

    // Filtra por Bibliotecas
    await page.click('[data-glossary-cat="Bibliotecas"]');
    await expect(page.locator('#glossary-grid')).toContainText('time.sleep()');
    await expect(page.locator('#glossary-grid')).toContainText('random.randint()');

    // Muda para inglês e valida categoria traduzida
    await page.click('[data-set-lang="en"]');
    await expect(page.locator('[data-glossary-cat="Bibliotecas"]')).toContainText('Libraries');
    await expect(page.locator('#glossary-grid')).toContainText('library / module');

    // Busca termo específico e também termo inexistente
    await page.click('[data-glossary-cat="all"]');
    await page.fill('#glossary-search', 'while');
    await expect(page.locator('#glossary-grid')).toContainText('while');

    await page.fill('#glossary-search', 'palavra_que_nao_existe_123');
    await expect(page.locator('#glossary-empty')).toBeVisible();
  });
});
