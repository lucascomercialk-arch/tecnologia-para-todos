'use strict';

const { test, expect } = require('@playwright/test');
const { setupOfflineSafeRoutes, mockTasksApi } = require('./helpers');

test.describe('Aba Melhorias & Bugs (CRUD, falhas de API, fila offline e sync)', () => {
  test('cria, exibe com segurança Anti-XSS, edita e exclui task online', async ({ page }) => {
    await setupOfflineSafeRoutes(page);
    const apiMock = await mockTasksApi(page, [
      {
        id: 'existing-1',
        title: 'Task inicial do servidor',
        description: 'Descricao inicial vinda da API',
        module: 'melhorias',
        priority: 'normal',
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    ]);

    page.on('dialog', (dialog) => dialog.accept());

    await page.goto('/#melhorias');
    await expect(page.locator('#view-melhorias')).toBeVisible();
    await expect(page.locator('#issues-connection-pill')).toContainText('API online');
    await expect(page.locator('#issues-list')).toContainText('Task inicial do servidor');

    // Cria task contendo payload HTML para comprovar renderização segura via textContent
    const xssTitle = 'Bug <img src=x onerror=alert(1)> no titulo';
    await page.fill('#issue-title', xssTitle);
    await page.fill('#issue-desc', 'Explicacao detalhada com mais de dez caracteres.');
    await page.click('#issue-submit-btn');

    await expect(page.locator('#issues-list')).toContainText(xssTitle);
    expect(await page.locator('#issues-list img').count()).toBe(0);
    expect(apiMock.tasks.some((t) => t.title === xssTitle)).toBe(true);

    // Edita inline a task criada pelo próprio navegador
    const ownCard = page.locator('#issues-list article').first();
    await ownCard.locator('button', { hasText: /Editar/i }).click();
    const editForm = ownCard.locator('form[data-edit-form-id]');
    await expect(editForm).toBeVisible();
    await editForm.locator('input[type="text"]').fill('Titulo editado com sucesso');
    await editForm.locator('button[type="submit"]').click();
    await expect(page.locator('#issues-list')).toContainText('Titulo editado com sucesso');

    // Exclui a task
    await page.locator('#issues-list article').first().locator('button', { hasText: /Excluir/i }).click();
    await expect(page.locator('#issues-list')).not.toContainText('Titulo editado com sucesso');
  });

  test('trata validação local e falhas HTTP 429, 403 e 500 com fallback em cache', async ({ page }) => {
    await setupOfflineSafeRoutes(page);
    const apiMock = await mockTasksApi(page, [
      {
        id: 'cached-1',
        title: 'Task salva em cache',
        description: 'Visivel mesmo quando servidor der 500',
        module: 'python',
        priority: 'alta',
        status: 'in_progress',
        created_at: new Date().toISOString(),
      },
    ]);

    page.on('dialog', (dialog) => dialog.accept());

    await page.goto('/#melhorias');
    await expect(page.locator('#issues-list')).toContainText('Task salva em cache');

    // 1. Validação cliente (< 5 caracteres após trim, usando espaços para disparar validação JS)
    await page.fill('#issue-title', 'abc  ');
    await page.click('#issue-submit-btn');
    await expect(page.locator('#issue-form-error')).toBeVisible();
    await expect(page.locator('#issue-form-error')).toContainText('5 e 120 caracteres');

    // 2. HTTP 429 (rate limit) exibido em PT e depois EN
    apiMock.createMode = 'http429';
    await page.fill('#issue-title', 'Sugestao bloqueada por rate limit');
    await page.click('#issue-submit-btn');
    await expect(page.locator('#issue-form-error')).toContainText('limite de 5 envios');

    await page.click('[data-set-lang="en"]');
    await page.click('#issue-submit-btn');
    await expect(page.locator('#issue-form-error')).toContainText('5 submissions per hour');

    // 3. Cria uma task normalmente para possuir autoria, depois simula HTTP 403 no DELETE
    apiMock.createMode = 'online';
    await page.fill('#issue-title', 'Task protegida no servidor');
    await page.click('#issue-submit-btn');
    await expect(page.locator('#issues-list')).toContainText('Task protegida no servidor');

    apiMock.deleteMode = 'http403';
    await page.locator('#issues-list article').first().locator('button', { hasText: /Delete/i }).click();
    await expect(page.locator('#toast')).toContainText('permission to delete');
    await expect(page.locator('#issues-list')).toContainText('Task protegida no servidor');

    // 4. HTTP 500 ao atualizar volta ao cache local preservando itens
    apiMock.getMode = 'http500';
    await page.click('#issues-refresh-btn');
    await expect(page.locator('#issues-connection-pill')).toContainText(/Offline/i);
    await expect(page.locator('#issues-list')).toContainText('Task salva em cache');
  });

  test('enfileira envio offline em localStorage e sincroniza ao reconectar', async ({ page }) => {
    await setupOfflineSafeRoutes(page);
    const apiMock = await mockTasksApi(page);

    await page.goto('/#melhorias');
    await expect(page.locator('#issues-connection-pill')).toContainText('API online');

    // Simula queda de rede no GET e POST
    apiMock.getMode = 'offline';
    apiMock.createMode = 'offline';

    await page.fill('#issue-title', 'Ideia criada sem internet');
    await page.fill('#issue-desc', 'Deve permanecer salva ate a conexao voltar.');
    await page.click('#issue-submit-btn');

    await expect(page.locator('#toast')).toContainText('salva na fila');
    await expect(page.locator('#issues-list')).toContainText('Ideia criada sem internet');
    await expect(page.locator('#issues-list')).toContainText('Aguardando sincronização');

    const queuedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('tpt_pending_sync') || '[]'));
    expect(queuedBefore).toHaveLength(1);
    expect(queuedBefore[0].title).toBe('Ideia criada sem internet');

    // Recarrega ainda offline -> fila continua no localStorage
    await page.reload();
    await page.click('#tab-melhorias');
    await expect(page.locator('#issues-list')).toContainText('Ideia criada sem internet');
    await expect(page.locator('#issues-connection-pill')).toContainText(/Offline \(1 na fila\)/i);

    // Conexão volta -> clicar em Atualizar sincroniza a fila com a API
    apiMock.getMode = 'online';
    apiMock.createMode = 'online';
    await page.click('#issues-refresh-btn');

    await expect(page.locator('#issues-connection-pill')).toContainText('API online');
    await expect(page.locator('#issues-list')).toContainText('Ideia criada sem internet');
    await expect(page.locator('#issues-list')).not.toContainText('Aguardando sincronização');
    expect(apiMock.tasks.some((t) => t.title === 'Ideia criada sem internet')).toBe(true);

    const queuedAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('tpt_pending_sync') || '[]'));
    expect(queuedAfter).toEqual([]);
  });
});
