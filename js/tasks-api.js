/* =========================================================
   Tecnologia para Todos — Cliente da API de Tasks & Fila Offline
   ---------------------------------------------------------
   • Configure PRODUCTION_API_BASE_URL com a URL HTTPS do
     túnel/proxy do servidor Atlas quando publicar.
   • Em ambiente local (localhost / 127.0.0.1 / file:), usa
     automaticamente http://localhost:3050.
   ========================================================= */
(function (root) {
  'use strict';

  const PRODUCTION_API_BASE_URL = 'https://atlas-hub.tail16e072.ts.net:8443'; // URL HTTPS via Tailscale Funnel (porta 8443) no servidor Atlas
  const LOCAL_API_BASE_URL = 'http://localhost:3050';
  const IS_LOCAL_HOST =
    typeof location !== 'undefined' &&
    (location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.protocol === 'file:');

  const API_BASE_URL = (
    (root && root.TPT_API_BASE_URL) ||
    (IS_LOCAL_HOST ? LOCAL_API_BASE_URL : PRODUCTION_API_BASE_URL)
  ).replace(/\/+$/, '');

  const REQUEST_TIMEOUT_MS = 8000;

  const KEY_CLIENT_ID = 'tpt_client_id';
  const KEY_OWNED_TASKS = 'tpt_owned_tasks';
  const KEY_ADMIN_KEY = 'tpt_admin_key';
  const KEY_PENDING_SYNC = 'tpt_pending_sync';
  const KEY_TASKS_CACHE = 'tpt_tasks_cache';

  const TPT = (root.TPT = root.TPT || {});

  function generateUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = (Math.random() * 16) | 0;
      const v = ch === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function storageRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }

  function readJsonArray(key) {
    try {
      const raw = storageGet(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeJsonArray(key, list) {
    storageSet(key, JSON.stringify(Array.isArray(list) ? list : []));
  }

  /* ---------- Identidade invisível & Admin ---------- */
  function getClientId() {
    let cid = (storageGet(KEY_CLIENT_ID) || '').trim();
    if (!cid) {
      cid = generateUuid();
      storageSet(KEY_CLIENT_ID, cid);
    }
    return cid;
  }

  function getOwnedTaskIds() {
    return readJsonArray(KEY_OWNED_TASKS);
  }

  function addOwnedTaskId(taskId) {
    if (!taskId) return;
    const list = getOwnedTaskIds();
    if (!list.includes(taskId)) {
      list.push(taskId);
      writeJsonArray(KEY_OWNED_TASKS, list);
    }
  }

  function removeOwnedTaskId(taskId) {
    if (!taskId) return;
    const list = getOwnedTaskIds().filter((id) => id !== taskId);
    writeJsonArray(KEY_OWNED_TASKS, list);
  }

  function isOwnedTask(taskId) {
    if (!taskId) return false;
    return getOwnedTaskIds().includes(taskId);
  }

  function getAdminKey() {
    return (storageGet(KEY_ADMIN_KEY) || '').trim();
  }

  function isAdminActive() {
    return Boolean(getAdminKey());
  }

  function setAdminKey(key) {
    const cleaned = String(key || '').trim();
    if (!cleaned) {
      storageRemove(KEY_ADMIN_KEY);
      return false;
    }
    storageSet(KEY_ADMIN_KEY, cleaned);
    return true;
  }

  function clearAdminKey() {
    storageRemove(KEY_ADMIN_KEY);
  }

  function canManageTask(task) {
    if (!task || task.pendingSync) return false;
    return isAdminActive() || isOwnedTask(task.id);
  }

  /* ---------- Cache local e Fila Offline ---------- */
  function getCachedTasks() {
    return readJsonArray(KEY_TASKS_CACHE);
  }

  function upsertCacheTask(task) {
    if (!task || !task.id) return;
    const list = getCachedTasks().filter((item) => item.id !== task.id);
    list.unshift(task);
    writeJsonArray(KEY_TASKS_CACHE, list);
  }

  function removeCacheTask(taskId) {
    if (!taskId) return;
    writeJsonArray(
      KEY_TASKS_CACHE,
      getCachedTasks().filter((item) => item.id !== taskId)
    );
  }

  function getPendingSync() {
    return readJsonArray(KEY_PENDING_SYNC);
  }

  function setPendingSync(list) {
    writeJsonArray(KEY_PENDING_SYNC, list);
  }

  function removePendingSync(tempId) {
    if (!tempId) return;
    setPendingSync(
      getPendingSync().filter((item) => item.tempId !== tempId && item.id !== tempId)
    );
  }

  function filterLocally(tasks, filters) {
    const mod = filters && filters.module ? String(filters.module).trim().toLowerCase() : '';
    const st = filters && filters.status ? String(filters.status).trim().toLowerCase() : '';
    return tasks.filter((item) => {
      if (mod && String(item.module || '').toLowerCase() !== mod) return false;
      if (st && String(item.status || '').toLowerCase() !== st) return false;
      return true;
    });
  }

  /* ---------- HTTP Helpers ---------- */
  async function fetchWithTimeout(url, options) {
    const opts = options || {};
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      : null;
    try {
      return await fetch(
        url,
        Object.assign({}, opts, controller ? { signal: controller.signal } : {})
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function extractErrorMessage(resp, fallback) {
    try {
      const data = await resp.json();
      if (data && typeof data.detail === 'string') return data.detail;
      if (data && Array.isArray(data.detail) && data.detail.length) {
        const first = data.detail[0];
        if (first && first.msg) return String(first.msg).replace(/^Value error,\s*/i, '');
      }
    } catch (_) {}
    return fallback;
  }

  /* ---------- Operações na API ---------- */
  async function fetchTasks(filters) {
    const opts = filters || {};
    const params = new URLSearchParams();
    if (opts.module) params.set('module', String(opts.module).trim().toLowerCase());
    if (opts.status) params.set('status', String(opts.status).trim().toLowerCase());
    const qs = params.toString();
    const url = `${API_BASE_URL}/api/tasks${qs ? `?${qs}` : ''}`;

    try {
      const resp = await fetchWithTimeout(url, { method: 'GET' });
      if (!resp.ok) {
        return {
          tasks: filterLocally(getCachedTasks(), opts),
          fromCache: true,
          status: resp.status,
        };
      }
      const data = await resp.json();
      const tasks = Array.isArray(data) ? data : [];
      if (!opts.module && !opts.status) {
        writeJsonArray(KEY_TASKS_CACHE, tasks);
      }
      return { tasks, fromCache: false };
    } catch (_) {
      return {
        tasks: filterLocally(getCachedTasks(), opts),
        fromCache: true,
      };
    }
  }

  async function createTask(payload) {
    const body = {
      title: String((payload && payload.title) || '').trim(),
      module: String((payload && payload.module) || 'melhorias').trim().toLowerCase(),
      description: String((payload && payload.description) || '').trim(),
      priority: String((payload && payload.priority) || 'normal').trim().toLowerCase(),
    };

    try {
      const resp = await fetchWithTimeout(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': getClientId(),
        },
        body: JSON.stringify(body),
      });

      if (resp.status === 201 || resp.ok) {
        const task = await resp.json();
        addOwnedTaskId(task.id);
        upsertCacheTask(task);
        return { ok: true, task, queued: false };
      }

      if (resp.status >= 400 && resp.status < 500) {
        const fallbackMsg =
          resp.status === 429
            ? 'Você atingiu o limite de 5 envios por hora. Aguarde um pouco antes de enviar novamente.'
            : 'Verifique os campos preenchidos e tente novamente.';
        const message = await extractErrorMessage(resp, fallbackMsg);
        return { ok: false, status: resp.status, message };
      }

      // Erros 5xx entram na fila de resiliência
      return enqueuePendingTask(body);
    } catch (_) {
      // Falha de rede / timeout entra na fila offline
      return enqueuePendingTask(body);
    }
  }

  function enqueuePendingTask(body) {
    const now = new Date().toISOString();
    const tempId = `pending-${generateUuid()}`;
    const pendingTask = {
      tempId,
      id: tempId,
      title: body.title,
      module: body.module,
      description: body.description,
      priority: body.priority,
      status: 'pending',
      pendingSync: true,
      github_issue_number: null,
      github_issue_url: null,
      created_at: now,
      updated_at: now,
    };
    const queue = getPendingSync();
    queue.push(pendingTask);
    setPendingSync(queue);
    return { ok: true, task: pendingTask, queued: true };
  }

  async function updateTask(taskId, patch) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Client-Id': getClientId(),
    };
    const adminKey = getAdminKey();
    if (adminKey) headers['X-Admin-Key'] = adminKey;

    try {
      const resp = await fetchWithTimeout(
        `${API_BASE_URL}/api/tasks/${encodeURIComponent(taskId)}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify(patch || {}),
        }
      );

      if (resp.ok) {
        const task = await resp.json();
        upsertCacheTask(task);
        return { ok: true, task };
      }

      const message = await extractErrorMessage(
        resp,
        resp.status === 403
          ? 'Sem permissão para editar esta task.'
          : 'Não foi possível atualizar esta task.'
      );
      return { ok: false, status: resp.status, message };
    } catch (_) {
      return {
        ok: false,
        networkError: true,
        message: 'Sem conexão com o servidor no momento. Tente novamente em instantes.',
      };
    }
  }

  async function deleteTask(taskId) {
    const pending = getPendingSync();
    if (pending.some((item) => item.tempId === taskId || item.id === taskId)) {
      removePendingSync(taskId);
      return { ok: true, removedLocal: true };
    }

    const headers = {
      'X-Client-Id': getClientId(),
    };
    const adminKey = getAdminKey();
    if (adminKey) headers['X-Admin-Key'] = adminKey;

    try {
      const resp = await fetchWithTimeout(
        `${API_BASE_URL}/api/tasks/${encodeURIComponent(taskId)}`,
        {
          method: 'DELETE',
          headers,
        }
      );

      if (resp.ok) {
        removeOwnedTaskId(taskId);
        removeCacheTask(taskId);
        return { ok: true };
      }

      const message = await extractErrorMessage(
        resp,
        resp.status === 403
          ? 'Sem permissão para excluir esta task.'
          : 'Não foi possível excluir esta task.'
      );
      return { ok: false, status: resp.status, message };
    } catch (_) {
      return {
        ok: false,
        networkError: true,
        message: 'Sem conexão com o servidor no momento. Tente novamente em instantes.',
      };
    }
  }

  /* ---------- Sincronização Automática da Fila Offline ---------- */
  let syncPromise = null;
  const syncListeners = new Set();

  function onSyncUpdate(cb) {
    if (typeof cb === 'function') syncListeners.add(cb);
    return () => syncListeners.delete(cb);
  }

  function notifySyncListeners(summary) {
    syncListeners.forEach((cb) => {
      try {
        cb(summary);
      } catch (_) {}
    });
  }

  async function syncPendingTasks() {
    if (syncPromise) return syncPromise;

    syncPromise = (async () => {
      const snapshot = getPendingSync();
      if (!snapshot.length) {
        return { syncedCount: 0, remainingCount: 0, droppedCount: 0 };
      }

      let syncedCount = 0;
      let droppedCount = 0;
      const clientId = getClientId();

      for (let i = 0; i < snapshot.length; i += 1) {
        const item = snapshot[i];
        try {
          const resp = await fetchWithTimeout(`${API_BASE_URL}/api/tasks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Client-Id': clientId,
            },
            body: JSON.stringify({
              title: item.title,
              module: item.module,
              description: item.description || '',
              priority: item.priority || 'normal',
            }),
          });

          if (resp.status === 201 || resp.ok) {
            const created = await resp.json();
            removePendingSync(item.tempId || item.id);
            addOwnedTaskId(created.id);
            upsertCacheTask(created);
            syncedCount += 1;
          } else if (resp.status === 400 || resp.status === 422) {
            // Descarta item inválido para não travar a fila
            removePendingSync(item.tempId || item.id);
            droppedCount += 1;
          } else {
            // Rate limit (429) ou erro 5xx: mantém restante na fila
            break;
          }
        } catch (_) {
          // Rede ainda indisponível: interrompe mantendo restante
          break;
        }
      }

      const summary = {
        syncedCount,
        remainingCount: getPendingSync().length,
        droppedCount,
      };
      if (syncedCount > 0 || droppedCount > 0) {
        notifySyncListeners(summary);
      }
      return summary;
    })();

    try {
      return await syncPromise;
    } finally {
      syncPromise = null;
    }
  }

  if (typeof root !== 'undefined' && typeof root.addEventListener === 'function') {
    root.addEventListener('online', () => {
      syncPendingTasks();
    });
  }

  TPT.tasksApi = {
    API_BASE_URL,
    getClientId,
    getOwnedTaskIds,
    isOwnedTask,
    getAdminKey,
    isAdminActive,
    setAdminKey,
    clearAdminKey,
    canManageTask,
    getCachedTasks,
    getPendingSync,
    removePendingSync,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    syncPendingTasks,
    onSyncUpdate,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TPT.tasksApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
