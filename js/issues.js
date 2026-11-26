/* =========================================================
   Tecnologia para Todos — Aba Melhorias & Tasks (API + Offline)
   ---------------------------------------------------------
   • Consome window.TPT.tasksApi (FastAPI + SQLite + GitHub Issues).
   • Renderização 100% segura via createElement / textContent
     (Anti-XSS: nenhum uso de innerHTML).
   • Suporte a fila offline (tpt_pending_sync), cache de leitura
     (tpt_tasks_cache), propriedade por navegador (X-Client-Id)
     e modo Admin (X-Admin-Key).
   ========================================================= */
(function () {
  'use strict';

  const TPT = (window.TPT = window.TPT || {});
  const tasksApi = TPT.tasksApi;

  function t(key, vars) {
    return TPT.i18n && typeof TPT.i18n.t === 'function' ? TPT.i18n.t(key, vars) : key;
  }

  function getLocaleTag() {
    const lang = TPT.i18n && typeof TPT.i18n.getLang === 'function' ? TPT.i18n.getLang() : 'pt';
    if (lang === 'es') return 'es-ES';
    if (lang === 'en') return 'en-US';
    return 'pt-BR';
  }

  const MODULE_CLASS_MAP = {
    melhorias: { key: 'issues.modules.melhorias', cls: 'badge bg-sol-soft text-amber-950 border border-amber-300/70' },
    bug: { key: 'issues.modules.bugShort', cls: 'badge bg-coral-soft text-red-950 border border-red-300/70' },
    python: { key: 'issues.modules.python', cls: 'badge bg-ceu-soft text-sky-950 border border-sky-300/70' },
    html: { key: 'issues.modules.html', cls: 'badge bg-lavanda-soft text-indigo-950 border border-indigo-300/70' },
    geral: { key: 'issues.modules.geralShort', cls: 'badge bg-creme text-navy/80 border border-navy/10' },
    glossario: { key: 'issues.modules.glossario', cls: 'badge bg-menta-soft text-teal-950 border border-teal-300/70' },
    playground: { key: 'issues.modules.playground', cls: 'badge bg-ceu-soft text-sky-950 border border-sky-300/70' },
  };

  const PRIORITY_CLASS_MAP = {
    baixa: { key: 'issues.priorityTags.baixa', cls: 'badge bg-creme text-navy/65 border border-navy/10' },
    normal: { key: 'issues.priorityTags.normal', cls: 'badge bg-ceu-soft text-sky-900 border border-sky-200' },
    alta: { key: 'issues.priorityTags.alta', cls: 'badge bg-salmao-soft text-rose-950 border border-rose-300/70' },
  };

  const STATUS_CLASS_MAP = {
    pending: { key: 'issues.statuses.pending', cls: 'badge bg-amber-100/80 text-amber-900' },
    in_progress: { key: 'issues.statuses.in_progress', cls: 'badge bg-ceu-soft text-sky-950 border border-sky-300/70' },
    done: { key: 'issues.statuses.done', cls: 'badge bg-menta-soft text-teal-950 border border-teal-300/70' },
  };

  function getModuleMeta(mod) {
    const info = MODULE_CLASS_MAP[mod];
    return info
      ? { label: t(info.key), cls: info.cls }
      : { label: mod || t('issues.modules.geralShort'), cls: 'badge bg-creme text-navy/80 border border-navy/10' };
  }

  function getPriorityMeta(prio) {
    const info = PRIORITY_CLASS_MAP[prio] || PRIORITY_CLASS_MAP.normal;
    return { label: t(info.key), cls: info.cls };
  }

  function getStatusMeta(st) {
    const info = STATUS_CLASS_MAP[st] || STATUS_CLASS_MAP.pending;
    return { label: t(info.key), cls: info.cls };
  }

  let statusFilter = '';
  let moduleFilter = '';
  let serverTasks = [];
  let fromCache = false;
  let isSyncing = false;
  let editingTaskId = null;
  let toastFn = null;
  let bgRefreshTimer = null;

  /* ---------- Helpers seguros de DOM (Anti-XSS) ---------- */
  function createEl(tag, options, children) {
    const node = document.createElement(tag);
    const opts = options || {};
    if (opts.className) node.className = opts.className;
    if (opts.text !== undefined && opts.text !== null) node.textContent = String(opts.text);
    if (opts.type) node.type = opts.type;
    if (opts.title) node.title = opts.title;
    if (opts.ariaLabel) node.setAttribute('aria-label', opts.ariaLabel);
    if (opts.value !== undefined) node.value = String(opts.value);
    if (opts.href) node.href = opts.href;
    if (opts.target) node.target = opts.target;
    if (opts.rel) node.rel = opts.rel;
    if (opts.attrs) {
      Object.keys(opts.attrs).forEach((k) => {
        if (opts.attrs[k] !== undefined && opts.attrs[k] !== null) {
          node.setAttribute(k, String(opts.attrs[k]));
        }
      });
    }
    if (Array.isArray(children)) {
      children.forEach((child) => {
        if (child !== null && child !== undefined) node.appendChild(child);
      });
    }
    return node;
  }

  function clearNode(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function safeGithubIssueUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'https:' && parsed.hostname === 'github.com') {
        return parsed.toString();
      }
    } catch (_) {}
    return null;
  }

  function formatShortDate(iso) {
    if (!iso) return t('issues.card.now');
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return t('issues.card.now');
      return d.toLocaleDateString(getLocaleTag(), { day: '2-digit', month: 'short' });
    } catch (_) {
      return t('issues.card.now');
    }
  }

  function notify(msg) {
    if (typeof toastFn === 'function') toastFn(msg);
  }

  function showFormError(msg) {
    const box = document.getElementById('issue-form-error');
    if (!box) return;
    if (!msg) {
      box.textContent = '';
      box.classList.add('hidden');
      return;
    }
    box.textContent = msg;
    box.classList.remove('hidden');
  }

  /* ---------- Combinação de fila offline + tasks da API ---------- */
  function filterPendingLocal(pendingList) {
    return pendingList.filter((item) => {
      if (moduleFilter && String(item.module || '').toLowerCase() !== moduleFilter) return false;
      if (statusFilter && String(item.status || 'pending').toLowerCase() !== statusFilter) return false;
      return true;
    });
  }

  function getCombinedVisibleTasks() {
    const pending = tasksApi ? filterPendingLocal(tasksApi.getPendingSync()) : [];
    const pendingSorted = pending.slice().reverse();
    return pendingSorted.concat(serverTasks);
  }

  /* ---------- Renderização de Status, Placar, Admin e Filtros ---------- */
  function renderConnectionAndAdmin() {
    const connPill = document.getElementById('issues-connection-pill');
    const pendingCount = tasksApi ? tasksApi.getPendingSync().length : 0;

    if (connPill) {
      clearNode(connPill);
      const dot = createEl('span', { className: 'w-2 h-2 rounded-full' });
      let labelText = t('issues.conn.online');
      if (isSyncing) {
        connPill.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold bg-ceu-soft text-sky-950 border border-sky-300/70';
        dot.classList.add('bg-sky-500');
        labelText = t('issues.conn.syncing');
      } else if (fromCache) {
        connPill.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold bg-sol-soft text-amber-950 border border-amber-300/70';
        dot.classList.add('bg-amber-500');
        labelText = pendingCount > 0 ? t('issues.conn.offlineQueue', { n: pendingCount }) : t('issues.conn.offlineCache');
      } else {
        connPill.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold bg-menta-soft text-teal-950 border border-teal-300/70';
        dot.classList.add('bg-emerald-500');
        labelText = pendingCount > 0 ? t('issues.conn.onlinePending', { n: pendingCount }) : t('issues.conn.online');
      }
      connPill.appendChild(dot);
      connPill.appendChild(document.createTextNode(labelText));
    }
  }

  function renderStats() {
    const pendingQueue = tasksApi ? tasksApi.getPendingSync() : [];
    const allForCounts = pendingQueue.concat(
      !statusFilter && !moduleFilter ? serverTasks : (tasksApi ? tasksApi.getCachedTasks() : serverTasks)
    );

    const openCount = allForCounts.filter((tItem) => tItem.status !== 'done').length;
    const progressCount = allForCounts.filter((tItem) => tItem.status === 'in_progress').length;
    const doneCount = allForCounts.filter((tItem) => tItem.status === 'done').length;

    const navBadge = document.getElementById('issues-nav-badge');
    if (navBadge) navBadge.textContent = String(openCount);

    const statsHost = document.getElementById('issues-stats');
    if (!statsHost) return;
    clearNode(statsHost);

    const makeStatChip = (dotCls, emoji, text) => {
      const chip = createEl('div', {
        className: 'px-3.5 py-2 rounded-2xl bg-white border border-navy/10 shadow-soft text-xs sm:text-sm font-bold flex items-center gap-2',
      });
      if (dotCls) {
        chip.appendChild(createEl('span', { className: `w-2.5 h-2.5 rounded-full ${dotCls}` }));
      } else if (emoji) {
        chip.appendChild(createEl('span', { text: emoji, attrs: { 'aria-hidden': 'true' } }));
      }
      chip.appendChild(createEl('span', { text }));
      return chip;
    };

    const openText = openCount === 1 ? t('issues.stats.openOne') : t('issues.stats.openMany', { n: openCount });
    const doneText = doneCount === 1 ? t('issues.stats.doneOne') : t('issues.stats.doneMany', { n: doneCount });

    statsHost.appendChild(makeStatChip('bg-amber-400', null, openText));
    if (progressCount > 0) {
      statsHost.appendChild(makeStatChip('bg-sky-400', null, t('issues.stats.inProgress', { n: progressCount })));
    }
    statsHost.appendChild(makeStatChip('bg-emerald-400', null, doneText));
    if (pendingQueue.length > 0) {
      statsHost.appendChild(makeStatChip(null, '⏳', t('issues.stats.waitingSync', { n: pendingQueue.length })));
    }
  }

  function renderFilterBar() {
    const host = document.getElementById('issues-filter-bar');
    if (!host) return;
    clearNode(host);

    const filters = [
      { id: '', label: t('issues.statusFilters.all') },
      { id: 'pending', label: t('issues.statusFilters.pending') },
      { id: 'in_progress', label: t('issues.statusFilters.in_progress') },
      { id: 'done', label: t('issues.statusFilters.done') },
    ];

    filters.forEach((f) => {
      const active = f.id === statusFilter;
      const btn = createEl('button', {
        type: 'button',
        text: f.label,
        className: `px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition ${
          active ? 'bg-navy text-white shadow-soft' : 'bg-creme text-navy/75 hover:bg-creme-200'
        }`,
        attrs: { 'data-issue-status-filter': f.id },
      });
      host.appendChild(btn);
    });
  }

  /* ---------- Edição Inline Segura dentro do Card ---------- */
  function buildInlineEditForm(task) {
    const form = createEl('form', {
      className: 'mt-2 pt-3 border-t border-navy/10 flex flex-col gap-3',
      attrs: { 'data-edit-form-id': task.id },
    });

    const titleInput = createEl('input', {
      type: 'text',
      value: task.title,
      className: 'w-full px-3.5 py-2.5 rounded-xl bg-creme border border-navy/15 font-semibold text-sm text-navy focus:outline-none focus:ring-2 focus:ring-sol',
      attrs: { required: 'true', minlength: '5', maxlength: '120', placeholder: t('issues.card.editTitlePlaceholder') },
    });

    const row = createEl('div', { className: 'grid sm:grid-cols-2 gap-2.5' });
    const modSelect = createEl('select', {
      className: 'px-3 py-2 rounded-xl bg-creme border border-navy/15 font-semibold text-sm text-navy focus:outline-none focus:ring-2 focus:ring-sol',
    });
    ['melhorias', 'bug', 'python', 'html', 'geral'].forEach((m) => {
      const opt = createEl('option', {
        value: m,
        text: getModuleMeta(m).label,
      });
      if (task.module === m) opt.selected = true;
      modSelect.appendChild(opt);
    });

    const prioSelect = createEl('select', {
      className: 'px-3 py-2 rounded-xl bg-creme border border-navy/15 font-semibold text-sm text-navy focus:outline-none focus:ring-2 focus:ring-sol',
    });
    ['baixa', 'normal', 'alta'].forEach((p) => {
      const opt = createEl('option', {
        value: p,
        text: t('issues.card.editPriorityPrefix', { label: getPriorityMeta(p).label }),
      });
      if (task.priority === p) opt.selected = true;
      prioSelect.appendChild(opt);
    });
    row.appendChild(modSelect);
    row.appendChild(prioSelect);

    const descInput = createEl('textarea', {
      value: task.description || '',
      className: 'w-full px-3.5 py-2.5 rounded-xl bg-creme border border-navy/15 font-medium text-sm text-navy focus:outline-none focus:ring-2 focus:ring-sol',
      attrs: { rows: '3', maxlength: '1000', placeholder: t('issues.card.editDescPlaceholder') },
    });

    const actions = createEl('div', { className: 'flex flex-wrap gap-2 justify-end' });
    const cancelBtn = createEl('button', {
      type: 'button',
      text: t('issues.card.cancelBtn'),
      className: 'btn-soft text-xs py-2 px-3',
    });
    cancelBtn.addEventListener('click', () => {
      editingTaskId = null;
      renderList();
    });

    const saveBtn = createEl('button', {
      type: 'submit',
      text: t('issues.card.saveBtn'),
      className: 'btn-primary text-xs py-2 px-4',
    });
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newTitle = titleInput.value.trim();
      const newDesc = descInput.value.trim();
      if (newTitle.length < 5 || newTitle.length > 120) {
        notify(`⚠️ ${t('issues.messages.titleLengthErr')}`);
        return;
      }
      if (newDesc && (newDesc.length < 10 || newDesc.length > 1000)) {
        notify(`⚠️ ${t('issues.messages.descLengthErr')}`);
        return;
      }
      saveBtn.disabled = true;
      const res = await tasksApi.updateTask(task.id, {
        title: newTitle,
        module: modSelect.value,
        priority: prioSelect.value,
        description: newDesc,
      });
      saveBtn.disabled = false;
      if (!res.ok) {
        notify(`⚠️ ${res.message}`);
        return;
      }
      editingTaskId = null;
      serverTasks = serverTasks.map((tItem) => (tItem.id === res.task.id ? res.task : tItem));
      notify(t('issues.messages.updatedToast'));
      renderList();
    });

    form.appendChild(titleInput);
    form.appendChild(row);
    form.appendChild(descInput);
    form.appendChild(actions);
    return form;
  }

  /* ---------- Card de Task (100% Anti-XSS) ---------- */
  function buildTaskCard(item) {
    const isPendingSync = Boolean(item.pendingSync);
    const isDone = item.status === 'done';
    const modMeta = getModuleMeta(item.module);
    const prioMeta = getPriorityMeta(item.priority);
    const stMeta = getStatusMeta(item.status);
    const canManage = tasksApi ? tasksApi.canManageTask(item) : false;
    const isOwned = !isPendingSync && tasksApi && tasksApi.isOwnedTask(item.id);
    const safeGithubUrl = safeGithubIssueUrl(item.github_issue_url);

    let borderCls = 'border-navy/10';
    if (isPendingSync) borderCls = 'border-amber-300 bg-amber-50/40';
    else if (isDone) borderCls = 'border-emerald-300/80 opacity-85';

    const card = createEl('article', {
      className: `rounded-3xl bg-white border ${borderCls} p-5 sm:p-6 shadow-soft flex flex-col gap-3 fade-in`,
    });

    // Cabeçalho com badges
    const head = createEl('div', { className: 'flex flex-wrap items-center justify-between gap-2' });
    const badgesWrap = createEl('div', { className: 'flex flex-wrap items-center gap-1.5' });

    badgesWrap.appendChild(createEl('span', { className: modMeta.cls, text: modMeta.label }));
    badgesWrap.appendChild(createEl('span', { className: prioMeta.cls, text: prioMeta.label }));

    if (isPendingSync) {
      badgesWrap.appendChild(
        createEl('span', {
          className: 'badge bg-sol-soft text-amber-950 border border-amber-300',
          text: t('issues.card.waitingSync'),
        })
      );
    } else {
      badgesWrap.appendChild(createEl('span', { className: stMeta.cls, text: stMeta.label }));
    }

    if (isOwned) {
      badgesWrap.appendChild(
        createEl('span', {
          className: 'badge bg-lavanda-soft text-indigo-950 border border-indigo-200',
          text: t('issues.card.owned'),
        })
      );
    }

    if (safeGithubUrl) {
      const ghLink = createEl('a', {
        href: safeGithubUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'badge bg-navy text-white hover:bg-navy-800 transition no-underline',
        text: item.github_issue_number
          ? t('issues.card.githubIssue', { n: item.github_issue_number })
          : t('issues.card.githubIssueGeneric'),
        title: t('issues.card.githubIssueTitle'),
      });
      badgesWrap.appendChild(ghLink);
    }

    const dateLabel = createEl('span', {
      className: 'text-xs font-semibold text-navy/45',
      text: formatShortDate(item.created_at),
    });

    head.appendChild(badgesWrap);
    head.appendChild(dateLabel);
    card.appendChild(head);

    // Conteúdo textual (exclusivamente textContent)
    const titleEl = createEl('h3', {
      className: `font-display font-extrabold text-lg sm:text-xl text-navy ${isDone ? 'line-through opacity-75' : ''}`,
      text: item.title,
    });
    card.appendChild(titleEl);

    if (item.description) {
      const descEl = createEl('p', {
        className: 'text-navy/75 text-sm sm:text-base leading-relaxed whitespace-pre-line',
        text: item.description,
      });
      card.appendChild(descEl);
    }

    // Edição inline aberta
    if (editingTaskId === item.id && canManage) {
      card.appendChild(buildInlineEditForm(item));
      return card;
    }

    // Rodapé de ações
    if (isPendingSync) {
      const footer = createEl('div', {
        className: 'pt-2.5 border-t border-amber-200/70 flex flex-wrap items-center justify-between gap-2',
      });
      footer.appendChild(
        createEl('span', {
          className: 'text-xs font-semibold text-amber-900',
          text: t('issues.card.offlineHint'),
        })
      );

      const btns = createEl('div', { className: 'flex items-center gap-2' });
      const retryBtn = createEl('button', {
        type: 'button',
        text: t('issues.card.retryBtn'),
        className: 'px-3 py-1.5 rounded-xl bg-sol-soft hover:bg-sol text-navy text-xs font-extrabold border border-amber-300/80 transition',
      });
      retryBtn.addEventListener('click', async () => {
        await handleSyncAndRefresh(false);
      });

      const removeLocalBtn = createEl('button', {
        type: 'button',
        text: t('issues.card.removeLocalBtn'),
        className: 'px-2.5 py-1.5 rounded-xl text-xs font-bold text-navy/60 hover:text-red-700 hover:bg-coral-soft transition',
        title: t('issues.card.removeLocalTitle'),
      });
      removeLocalBtn.addEventListener('click', async () => {
        await tasksApi.deleteTask(item.tempId || item.id);
        notify(t('issues.messages.removedOfflineToast'));
        renderList();
      });

      btns.appendChild(retryBtn);
      btns.appendChild(removeLocalBtn);
      footer.appendChild(btns);
      card.appendChild(footer);
    } else if (canManage) {
      const showStatusSelect = Boolean(tasksApi && tasksApi.isAdminActive());
      const footer = createEl('div', {
        className: `pt-2.5 border-t border-navy/5 flex flex-wrap items-center gap-2 ${
          showStatusSelect ? 'justify-between' : 'justify-end'
        }`,
      });

      if (showStatusSelect) {
        const statusWrap = createEl('div', { className: 'flex items-center gap-2' });
        const statusLabel = createEl('span', {
          className: 'text-xs font-bold text-navy/55',
          text: t('issues.card.statusLabel'),
        });
        const statusSelect = createEl('select', {
          className: 'px-2.5 py-1.5 rounded-xl bg-creme border border-navy/10 text-xs font-extrabold text-navy focus:outline-none focus:ring-2 focus:ring-sol',
          ariaLabel: t('issues.card.statusAria'),
        });
        [
          { value: 'pending', label: t('issues.statuses.pending') },
          { value: 'in_progress', label: t('issues.statuses.in_progress') },
          { value: 'done', label: t('issues.statuses.done') },
        ].forEach((optItem) => {
          const opt = createEl('option', { value: optItem.value, text: optItem.label });
          if (item.status === optItem.value) opt.selected = true;
          statusSelect.appendChild(opt);
        });

        statusSelect.addEventListener('change', async () => {
          const nextStatus = statusSelect.value;
          statusSelect.disabled = true;
          const res = await tasksApi.updateTask(item.id, { status: nextStatus });
          statusSelect.disabled = false;
          if (!res.ok) {
            statusSelect.value = item.status;
            notify(`⚠️ ${res.message}`);
            return;
          }
          serverTasks = serverTasks.map((tItem) => (tItem.id === res.task.id ? res.task : tItem));
          notify(nextStatus === 'done' ? t('issues.messages.statusDoneToast') : t('issues.messages.statusUpdatedToast'));
          renderList();
        });

        statusWrap.appendChild(statusLabel);
        statusWrap.appendChild(statusSelect);
        footer.appendChild(statusWrap);
      }

      const btns = createEl('div', { className: 'flex items-center gap-2' });
      const editBtn = createEl('button', {
        type: 'button',
        text: t('issues.card.editBtn'),
        className: 'px-3 py-1.5 rounded-xl bg-creme hover:bg-creme-200 border border-navy/10 text-xs font-extrabold text-navy transition',
      });
      editBtn.addEventListener('click', () => {
        editingTaskId = item.id;
        renderList();
      });

      const delBtn = createEl('button', {
        type: 'button',
        text: t('issues.card.deleteBtn'),
        className: 'px-3 py-1.5 rounded-xl text-xs font-extrabold text-navy/60 hover:text-red-700 hover:bg-coral-soft transition',
      });
      delBtn.addEventListener('click', async () => {
        if (!window.confirm(t('issues.card.confirmDelete', { title: item.title }))) return;
        delBtn.disabled = true;
        const res = await tasksApi.deleteTask(item.id);
        if (!res.ok) {
          delBtn.disabled = false;
          notify(`⚠️ ${res.message}`);
          return;
        }
        serverTasks = serverTasks.filter((tItem) => tItem.id !== item.id);
        if (editingTaskId === item.id) editingTaskId = null;
        notify(t('issues.messages.deletedToast'));
        renderList();
      });

      btns.appendChild(editBtn);
      btns.appendChild(delBtn);
      footer.appendChild(btns);
      card.appendChild(footer);
    }

    return card;
  }

  function renderList() {
    renderConnectionAndAdmin();
    renderStats();
    renderFilterBar();

    const listHost = document.getElementById('issues-list');
    const emptyHost = document.getElementById('issues-empty');
    if (!listHost) return;
    clearNode(listHost);

    const combined = getCombinedVisibleTasks();
    if (!combined.length) {
      if (emptyHost) emptyHost.classList.remove('hidden');
      return;
    }
    if (emptyHost) emptyHost.classList.add('hidden');

    const frag = document.createDocumentFragment();
    combined.forEach((item) => {
      frag.appendChild(buildTaskCard(item));
    });
    listHost.appendChild(frag);
  }

  /* ---------- Carregamento & Sincronização ---------- */
  async function loadTasksFromApi() {
    if (!tasksApi) return;
    const result = await tasksApi.fetchTasks({
      module: moduleFilter || undefined,
      status: statusFilter || undefined,
    });
    serverTasks = result.tasks || [];
    fromCache = Boolean(result.fromCache);
    renderList();
  }

  async function handleSyncAndRefresh(silent) {
    if (!tasksApi) return;
    isSyncing = true;
    renderConnectionAndAdmin();
    try {
      const syncRes = await tasksApi.syncPendingTasks();
      if (!silent && syncRes.syncedCount > 0) {
        notify(t('issues.messages.syncedToast', { n: syncRes.syncedCount }));
      }
      await loadTasksFromApi();
    } finally {
      isSyncing = false;
      renderConnectionAndAdmin();
    }
  }

  function exportMarkdown() {
    const combined = getCombinedVisibleTasks();
    if (!combined.length) return t('issues.messages.mdEmpty');
    const lines = [t('issues.messages.mdHeader')];
    combined.forEach((it) => {
      const mark = it.status === 'done' ? 'x' : ' ';
      const modLabel = getModuleMeta(it.module).label;
      const prioLabel = getPriorityMeta(it.priority).label;
      const gh = it.github_issue_number ? ` (GitHub #${it.github_issue_number})` : '';
      const desc = it.description ? ` — ${it.description}` : '';
      lines.push(`- [${mark}] [${modLabel} · ${prioLabel}] **${it.title}**${desc}${gh}`);
    });
    return lines.join('\n');
  }

  /* ---------- Inicialização ---------- */
  function init(notifyToast) {
    toastFn = notifyToast;

    if (TPT.i18n && typeof TPT.i18n.onChange === 'function') {
      TPT.i18n.onChange(() => renderList());
    }

    if (tasksApi) {
      tasksApi.getClientId();
      tasksApi.onSyncUpdate(async (summary) => {
        if (summary && summary.syncedCount > 0) {
          notify(t('issues.messages.syncedOnlineToast', { n: summary.syncedCount }));
        }
        await loadTasksFromApi();
      });
    }

    const titleInput = document.getElementById('issue-title');
    const titleCount = document.getElementById('issue-title-count');
    if (titleInput && titleCount) {
      const updateCounter = () => {
        titleCount.textContent = `${titleInput.value.trim().length}/120`;
      };
      titleInput.addEventListener('input', updateCounter);
      updateCounter();
    }

    const form = document.getElementById('issue-form');
    if (form && tasksApi) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showFormError('');

        const modInput = form.querySelector('input[name="issue-module"]:checked');
        const prioInput = document.getElementById('issue-priority');
        const descInput = document.getElementById('issue-desc');
        const submitBtn = document.getElementById('issue-submit-btn');

        const title = (titleInput && titleInput.value.trim()) || '';
        const desc = (descInput && descInput.value.trim()) || '';
        const moduleVal = modInput ? modInput.value : 'melhorias';
        const priorityVal = prioInput ? prioInput.value : 'normal';

        if (title.length < 5 || title.length > 120) {
          showFormError(t('issues.messages.titleLengthErr'));
          if (titleInput) titleInput.focus();
          return;
        }
        if (desc && (desc.length < 10 || desc.length > 1000)) {
          showFormError(t('issues.messages.descLengthErr'));
          if (descInput) descInput.focus();
          return;
        }

        if (submitBtn) submitBtn.disabled = true;
        const res = await tasksApi.createTask({
          title,
          module: moduleVal,
          description: desc,
          priority: priorityVal,
        });
        if (submitBtn) submitBtn.disabled = false;

        if (!res.ok) {
          showFormError(res.message || t('issues.messages.createErr'));
          notify(`⚠️ ${res.message || t('issues.messages.sendErrToast')}`);
          return;
        }

        if (titleInput) titleInput.value = '';
        if (descInput) descInput.value = '';
        if (titleCount) titleCount.textContent = '0/120';

        if (res.queued) {
          notify(t('issues.messages.queuedToast'));
          renderList();
        } else {
          notify(t('issues.messages.createdToast'));
          await loadTasksFromApi();
          clearTimeout(bgRefreshTimer);
          bgRefreshTimer = setTimeout(() => {
            loadTasksFromApi();
          }, 2500);
        }
      });
    }

    const modFilterEl = document.getElementById('issues-module-filter');
    if (modFilterEl) {
      modFilterEl.addEventListener('change', async () => {
        moduleFilter = modFilterEl.value || '';
        await loadTasksFromApi();
      });
    }

    const refreshBtn = document.getElementById('issues-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await handleSyncAndRefresh(false);
        notify(t('issues.messages.refreshedToast'));
      });
    }

    const copyBtn = document.getElementById('issues-copy-md');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const md = exportMarkdown();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(md).then(() => {
            notify(t('issues.messages.copiedMdToast'));
          });
        }
      });
    }

    document.addEventListener('click', async (e) => {
      const filterBtn = e.target.closest('[data-issue-status-filter]');
      if (filterBtn) {
        statusFilter = filterBtn.getAttribute('data-issue-status-filter') || '';
        await loadTasksFromApi();
      }
    });

    renderList();
    handleSyncAndRefresh(true);
  }

  function onActivate() {
    handleSyncAndRefresh(true);
  }

  TPT.issues = { init, onActivate, renderList };
})();
