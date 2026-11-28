import { describe, expect, it } from 'vitest';
import { createBrowserContext } from './vm-env.js';

function createTasksEnv(fetchImpl) {
  const { windowObj, localStorage } = createBrowserContext(
    ['data/i18n/ui.js', 'js/i18n.js', 'js/tasks-api.js'],
    {
      location: { hostname: 'localhost', protocol: 'http:' },
      fetch: fetchImpl,
    }
  );
  windowObj.TPT.i18n.init();
  return {
    api: windowObj.TPT.tasksApi,
    i18n: windowObj.TPT.i18n,
    translations: windowObj.TPT_TRANSLATIONS,
    localStorage,
  };
}

describe('TPT.tasksApi', () => {
  it('gerencia identidade do navegador, posse de tasks e permissões admin', () => {
    const { api, localStorage } = createTasksEnv(async () => ({ ok: true, json: async () => [] }));
    const cid1 = api.getClientId();
    const cid2 = api.getClientId();
    expect(cid1).toMatch(/^[0-9a-f-]{36}$/i);
    expect(cid2).toBe(cid1);
    expect(localStorage.getItem('tpt_client_id')).toBe(cid1);

    expect(api.canManageTask({ id: 'task-1' })).toBe(false);
    expect(api.canManageTask({ id: 'task-1', pendingSync: true })).toBe(false);

    expect(api.setAdminKey('  admin-secret  ')).toBe(true);
    expect(api.isAdminActive()).toBe(true);
    expect(api.canManageTask({ id: 'task-other' })).toBe(true);
    expect(api.canManageTask({ id: 'pending-1', pendingSync: true })).toBe(false);

    api.clearAdminKey();
    expect(api.isAdminActive()).toBe(false);
    expect(api.canManageTask({ id: 'task-other' })).toBe(false);
  });

  it('fetchTasks armazena em cache quando online e usa cache filtrado em HTTP 500 ou erro de rede', async () => {
    const sample = [
      { id: '1', title: 'Bug CSS', module: 'html', status: 'pending' },
      { id: '2', title: 'Aula listas', module: 'python', status: 'done' },
      { id: '3', title: 'Melhorar console', module: 'python', status: 'pending' },
    ];
    let mode = 'online';

    const { api } = createTasksEnv(async () => {
      if (mode === 'offline') throw new Error('Network error');
      if (mode === 'http500') return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => sample };
    });

    const onlineRes = await api.fetchTasks();
    expect(onlineRes.fromCache).toBe(false);
    expect(onlineRes.tasks).toHaveLength(3);
    expect(api.getCachedTasks()).toHaveLength(3);

    mode = 'http500';
    const err500 = await api.fetchTasks({ module: 'python', status: 'pending' });
    expect(err500.fromCache).toBe(true);
    expect(err500.status).toBe(500);
    expect(err500.tasks).toEqual([{ id: '3', title: 'Melhorar console', module: 'python', status: 'pending' }]);

    mode = 'offline';
    const offlineFiltered = await api.fetchTasks({ module: 'html' });
    expect(offlineFiltered.fromCache).toBe(true);
    expect(offlineFiltered.tasks).toEqual([{ id: '1', title: 'Bug CSS', module: 'html', status: 'pending' }]);
  });

  it('createTask cria com X-Client-Id, trata 429/422 e enfileira offline em 5xx ou falha de rede', async () => {
    const calls = [];
    let nextResponder = async () => ({
      ok: true,
      status: 201,
      json: async () => ({ id: 'srv-1', title: 'Nova ideia', module: 'melhorias', status: 'pending' }),
    });

    const { api, i18n, translations } = createTasksEnv(async (url, opts) => {
      calls.push({ url, opts });
      return nextResponder();
    });

    const created = await api.createTask({
      title: '  Nova ideia  ',
      module: 'python',
      description: '  Detalhes  ',
      priority: 'alta',
    });
    expect(created.ok).toBe(true);
    expect(created.queued).toBe(false);
    expect(api.isOwnedTask('srv-1')).toBe(true);
    expect(api.canManageTask(created.task)).toBe(true);
    expect(calls[0].opts.headers['X-Client-Id']).toBe(api.getClientId());

    nextResponder = async () => ({ ok: false, status: 429, json: async () => ({}) });
    for (const lang of ['pt', 'es', 'en']) {
      i18n.setLang(lang);
      const r429 = await api.createTask({ title: 'Teste 429' });
      expect(r429).toEqual({
        ok: false,
        status: 429,
        message: translations[lang].tasksApi.errors.rateLimit,
      });
    }

    nextResponder = async () => ({
      ok: false,
      status: 422,
      json: async () => ({ detail: [{ msg: 'Value error, Título muito curto' }] }),
    });
    const r422 = await api.createTask({ title: 'Abc' });
    expect(r422).toEqual({ ok: false, status: 422, message: 'Título muito curto' });

    nextResponder = async () => ({ ok: false, status: 503, json: async () => ({}) });
    const queued503 = await api.createTask({ title: 'Task durante 503' });
    expect(queued503.ok).toBe(true);
    expect(queued503.queued).toBe(true);
    expect(queued503.task.pendingSync).toBe(true);

    nextResponder = async () => {
      throw new Error('Failed to fetch');
    };
    const queuedNet = await api.createTask({ title: 'Task sem rede' });
    expect(queuedNet.ok).toBe(true);
    expect(queuedNet.queued).toBe(true);
    expect(api.getPendingSync()).toHaveLength(2);
  });

  it('updateTask e deleteTask enviam X-Admin-Key, removem fila local e localizam erros 403/rede', async () => {
    const requests = [];
    let handler = async () => {
      throw new Error('offline');
    };

    const { api, i18n, translations } = createTasksEnv(async (url, opts) => {
      requests.push({ url, opts });
      return handler();
    });

    const offlineCreated = await api.createTask({ title: 'Item apenas offline' });
    expect(api.getPendingSync()).toHaveLength(1);

    const localDel = await api.deleteTask(offlineCreated.task.tempId);
    expect(localDel).toEqual({ ok: true, removedLocal: true });
    expect(api.getPendingSync()).toHaveLength(0);

    handler = async () => ({ ok: false, status: 403, json: async () => ({}) });
    api.setAdminKey('secret-key');
    i18n.setLang('en');

    const patchForbidden = await api.updateTask('id-99', { status: 'done' });
    expect(requests.at(-1).opts.headers['X-Admin-Key']).toBe('secret-key');
    expect(patchForbidden).toEqual({
      ok: false,
      status: 403,
      message: translations.en.tasksApi.errors.editForbidden,
    });

    const delForbidden = await api.deleteTask('id-99');
    expect(delForbidden).toEqual({
      ok: false,
      status: 403,
      message: translations.en.tasksApi.errors.deleteForbidden,
    });

    handler = async () => {
      throw new Error('ECONNRESET');
    };
    const netErr = await api.updateTask('id-99', { title: 'Outro' });
    expect(netErr).toEqual({
      ok: false,
      networkError: true,
      message: translations.en.tasksApi.errors.network,
    });
  });

  it('syncPendingTasks sincroniza itens válidos, descarta 422, para em 429 e deduplica chamadas', async () => {
    let mode = 'offline';
    let postCall = 0;

    const { api } = createTasksEnv(async () => {
      if (mode === 'offline') throw new Error('offline');
      postCall += 1;
      if (postCall === 1) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ id: 'srv-a', title: 'Valida', module: 'python', status: 'pending' }),
        };
      }
      if (postCall === 2) {
        return { ok: false, status: 422, json: async () => ({}) };
      }
      return { ok: false, status: 429, json: async () => ({}) };
    });

    await api.createTask({ title: 'Valida' });
    await api.createTask({ title: 'Invalida no backend' });
    await api.createTask({ title: 'Aguarda rate limit' });
    expect(api.getPendingSync()).toHaveLength(3);

    const summaries = [];
    const unsubscribe = api.onSyncUpdate((s) => summaries.push(s));

    mode = 'online';
    const [res1, res2] = await Promise.all([api.syncPendingTasks(), api.syncPendingTasks()]);
    expect(res1).toBe(res2);
    expect(res1).toEqual({ syncedCount: 1, remainingCount: 1, droppedCount: 1 });
    expect(api.getPendingSync().map((x) => x.title)).toEqual(['Aguarda rate limit']);
    expect(api.isOwnedTask('srv-a')).toBe(true);
    expect(summaries).toEqual([{ syncedCount: 1, remainingCount: 1, droppedCount: 1 }]);
    unsubscribe();
  });
});
