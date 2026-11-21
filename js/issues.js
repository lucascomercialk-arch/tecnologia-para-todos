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

  const MODULE_META = {
    melhorias: { label: '💡 Melhoria', cls: 'badge bg-sol-soft text-amber-950 border border-amber-300/70' },
    bug: { label: '🐞 Bug', cls: 'badge bg-coral-soft text-red-950 border border-red-300/70' },
    python: { label: '🐍 Python', cls: 'badge bg-ceu-soft text-sky-950 border border-sky-300/70' },
    html: { label: '🌐 HTML/CSS', cls: 'badge bg-lavanda-soft text-indigo-950 border border-indigo-300/70' },
    geral: { label: '🏠 Geral', cls: 'badge bg-creme text-navy/80 border border-navy/10' },
    glossario: { label: '📖 Glossário', cls: 'badge bg-menta-soft text-teal-950 border border-teal-300/70' },
    playground: { label: '💻 Playground', cls: 'badge bg-ceu-soft text-sky-950 border border-sky-300/70' },
  };

  const PRIORITY_META = {
    baixa: { label: 'Baixa', cls: 'badge bg-creme text-navy/65 border border-navy/10' },
    normal: { label: 'Normal', cls: 'badge bg-ceu-soft text-sky-900 border border-sky-200' },
    alta: { label: '🔥 Alta', cls: 'badge bg-salmao-soft text-rose-950 border border-rose-300/70' },
  };

  const STATUS_META = {
    pending: { label: '🟡 Pendente', cls: 'badge bg-amber-100/80 text-amber-900' },
    in_progress: { label: '🔵 Em andamento', cls: 'badge bg-ceu-soft text-sky-950 border border-sky-300/70' },
    done: { label: '✅ Concluída', cls: 'badge bg-menta-soft text-teal-950 border border-teal-300/70' },
  };

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
    if (!iso) return 'Agora';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return 'Agora';
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch (_) {
      return 'Agora';
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
      let labelText = 'API conectada';
      if (isSyncing) {
        connPill.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold bg-ceu-soft text-sky-950 border border-sky-300/70';
        dot.classList.add('bg-sky-500');
        labelText = 'Sincronizando…';
      } else if (fromCache) {
        connPill.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold bg-sol-soft text-amber-950 border border-amber-300/70';
        dot.classList.add('bg-amber-500');
        labelText = pendingCount > 0 ? `Offline (${pendingCount} na fila)` : 'Offline (cache local)';
      } else {
        connPill.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold bg-menta-soft text-teal-950 border border-teal-300/70';
        dot.classList.add('bg-emerald-500');
        labelText = pendingCount > 0 ? `API online · ${pendingCount} pendente(s)` : 'API online';
      }
      connPill.appendChild(dot);
      connPill.appendChild(document.createTextNode(labelText));
    }

    const adminBtn = document.getElementById('issues-admin-btn');
    if (adminBtn && tasksApi) {
      const active = tasksApi.isAdminActive();
      adminBtn.textContent = active ? '🔓 Admin ativo' : '🔐 Admin';
      adminBtn.title = active
        ? 'Modo Admin ativo (clique para sair)'
        : 'Entrar no modo Admin com ADMIN_KEY';
      adminBtn.className = active
        ? 'px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-navy text-sol border border-navy shadow-soft transition'
        : 'px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-white text-navy/70 border border-navy/15 hover:bg-creme-200 transition';
    }
  }

  function renderStats() {
    const pendingQueue = tasksApi ? tasksApi.getPendingSync() : [];
    const allForCounts = pendingQueue.concat(
      !statusFilter && !moduleFilter ? serverTasks : (tasksApi ? tasksApi.getCachedTasks() : serverTasks)
    );

    const openCount = allForCounts.filter((t) => t.status !== 'done').length;
    const progressCount = allForCounts.filter((t) => t.status === 'in_progress').length;
    const doneCount = allForCounts.filter((t) => t.status === 'done').length;

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

    statsHost.appendChild(makeStatChip('bg-amber-400', null, `${openCount} ${openCount === 1 ? 'aberta' : 'abertas'}`));
    if (progressCount > 0) {
      statsHost.appendChild(makeStatChip('bg-sky-400', null, `${progressCount} em andamento`));
    }
    statsHost.appendChild(makeStatChip('bg-emerald-400', null, `${doneCount} ${doneCount === 1 ? 'concluída' : 'concluídas'}`));
    if (pendingQueue.length > 0) {
      statsHost.appendChild(makeStatChip(null, '⏳', `${pendingQueue.length} aguardando sync`));
    }
  }

  function renderFilterBar() {
    const host = document.getElementById('issues-filter-bar');
    if (!host) return;
    clearNode(host);

    const filters = [
      { id: '', label: 'Todas' },
      { id: 'pending', label: '🟡 Pendentes' },
      { id: 'in_progress', label: '🔵 Em andamento' },
      { id: 'done', label: '✅ Concluídas' },
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
      attrs: { required: 'true', minlength: '5', maxlength: '120', placeholder: 'Título (5 a 120 caracteres)' },
    });

    const row = createEl('div', { className: 'grid sm:grid-cols-2 gap-2.5' });
    const modSelect = createEl('select', {
      className: 'px-3 py-2 rounded-xl bg-creme border border-navy/15 font-semibold text-sm text-navy focus:outline-none focus:ring-2 focus:ring-sol',
    });
    ['melhorias', 'bug', 'python', 'html', 'geral'].forEach((m) => {
      const opt = createEl('option', {
        value: m,
        text: (MODULE_META[m] && MODULE_META[m].label) || m,
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
        text: `Prioridade: ${(PRIORITY_META[p] && PRIORITY_META[p].label) || p}`,
      });
      if (task.priority === p) opt.selected = true;
      prioSelect.appendChild(opt);
    });
    row.appendChild(modSelect);
    row.appendChild(prioSelect);

    const descInput = createEl('textarea', {
      value: task.description || '',
      className: 'w-full px-3.5 py-2.5 rounded-xl bg-creme border border-navy/15 font-medium text-sm text-navy focus:outline-none focus:ring-2 focus:ring-sol',
      attrs: { rows: '3', maxlength: '1000', placeholder: 'Descrição (opcional; se preencher, use 10 a 1000 caracteres)' },
    });

    const actions = createEl('div', { className: 'flex flex-wrap gap-2 justify-end' });
    const cancelBtn = createEl('button', {
      type: 'button',
      text: 'Cancelar',
      className: 'btn-soft text-xs py-2 px-3',
    });
    cancelBtn.addEventListener('click', () => {
      editingTaskId = null;
      renderList();
    });

    const saveBtn = createEl('button', {
      type: 'submit',
      text: '💾 Salvar alterações',
      className: 'btn-primary text-xs py-2 px-4',
    });
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newTitle = titleInput.value.trim();
      const newDesc = descInput.value.trim();
      if (newTitle.length < 5 || newTitle.length > 120) {
        notify('⚠️ O título precisa ter entre 5 e 120 caracteres.');
        return;
      }
      if (newDesc && (newDesc.length < 10 || newDesc.length > 1000)) {
        notify('⚠️ A descrição (quando preenchida) deve ter entre 10 e 1000 caracteres.');
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
      serverTasks = serverTasks.map((t) => (t.id === res.task.id ? res.task : t));
      notify('✅ Task atualizada!');
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
    const modMeta = MODULE_META[item.module] || {
      label: item.module || 'geral',
      cls: 'badge bg-creme text-navy/80 border border-navy/10',
    };
    const prioMeta = PRIORITY_META[item.priority] || PRIORITY_META.normal;
    const stMeta = STATUS_META[item.status] || STATUS_META.pending;
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
          text: '⏳ Aguardando sincronização',
        })
      );
    } else {
      badgesWrap.appendChild(createEl('span', { className: stMeta.cls, text: stMeta.label }));
    }

    if (isOwned) {
      badgesWrap.appendChild(
        createEl('span', {
          className: 'badge bg-lavanda-soft text-indigo-950 border border-indigo-200',
          text: '👤 Sua task',
        })
      );
    }

    if (safeGithubUrl) {
      const ghLink = createEl('a', {
        href: safeGithubUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'badge bg-navy text-white hover:bg-navy-800 transition no-underline',
        text: item.github_issue_number ? `GitHub #${item.github_issue_number} ↗` : 'GitHub Issue ↗',
        title: 'Abrir Issue correspondente no GitHub',
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
          text: 'Será enviada automaticamente quando a conexão voltar.',
        })
      );

      const btns = createEl('div', { className: 'flex items-center gap-2' });
      const retryBtn = createEl('button', {
        type: 'button',
        text: '🔄 Reenviar',
        className: 'px-3 py-1.5 rounded-xl bg-sol-soft hover:bg-sol text-navy text-xs font-extrabold border border-amber-300/80 transition',
      });
      retryBtn.addEventListener('click', async () => {
        await handleSyncAndRefresh(false);
      });

      const removeLocalBtn = createEl('button', {
        type: 'button',
        text: '🗑️ Remover',
        className: 'px-2.5 py-1.5 rounded-xl text-xs font-bold text-navy/60 hover:text-red-700 hover:bg-coral-soft transition',
        title: 'Remover da fila offline',
      });
      removeLocalBtn.addEventListener('click', async () => {
        await tasksApi.deleteTask(item.tempId || item.id);
        notify('🗑️ Item removido da fila offline.');
        renderList();
      });

      btns.appendChild(retryBtn);
      btns.appendChild(removeLocalBtn);
      footer.appendChild(btns);
      card.appendChild(footer);
    } else if (canManage) {
      const footer = createEl('div', {
        className: 'pt-2.5 border-t border-navy/5 flex flex-wrap items-center justify-between gap-2',
      });

      const statusWrap = createEl('div', { className: 'flex items-center gap-2' });
      const statusLabel = createEl('span', {
        className: 'text-xs font-bold text-navy/55',
        text: 'Status:',
      });
      const statusSelect = createEl('select', {
        className: 'px-2.5 py-1.5 rounded-xl bg-creme border border-navy/10 text-xs font-extrabold text-navy focus:outline-none focus:ring-2 focus:ring-sol',
        ariaLabel: 'Alterar status da task',
      });
      [
        { value: 'pending', label: '🟡 Pendente' },
        { value: 'in_progress', label: '🔵 Em andamento' },
        { value: 'done', label: '✅ Concluída' },
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
        serverTasks = serverTasks.map((t) => (t.id === res.task.id ? res.task : t));
        notify(nextStatus === 'done' ? '✅ Task concluída!' : '🔄 Status atualizado!');
        renderList();
      });

      statusWrap.appendChild(statusLabel);
      statusWrap.appendChild(statusSelect);
      footer.appendChild(statusWrap);

      const btns = createEl('div', { className: 'flex items-center gap-2' });
      const editBtn = createEl('button', {
        type: 'button',
        text: '✏️ Editar',
        className: 'px-3 py-1.5 rounded-xl bg-creme hover:bg-creme-200 border border-navy/10 text-xs font-extrabold text-navy transition',
      });
      editBtn.addEventListener('click', () => {
        editingTaskId = item.id;
        renderList();
      });

      const delBtn = createEl('button', {
        type: 'button',
        text: '🗑️ Excluir',
        className: 'px-3 py-1.5 rounded-xl text-xs font-extrabold text-navy/60 hover:text-red-700 hover:bg-coral-soft transition',
      });
      delBtn.addEventListener('click', async () => {
        if (!window.confirm(`Deseja excluir a task "${item.title}"?`)) return;
        delBtn.disabled = true;
        const res = await tasksApi.deleteTask(item.id);
        if (!res.ok) {
          delBtn.disabled = false;
          notify(`⚠️ ${res.message}`);
          return;
        }
        serverTasks = serverTasks.filter((t) => t.id !== item.id);
        if (editingTaskId === item.id) editingTaskId = null;
        notify('🗑️ Task excluída.');
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
        notify(`✅ ${syncRes.syncedCount} task(s) da fila offline sincronizada(s)!`);
      }
      await loadTasksFromApi();
    } finally {
      isSyncing = false;
      renderConnectionAndAdmin();
    }
  }

  function exportMarkdown() {
    const combined = getCombinedVisibleTasks();
    if (!combined.length) return '# Melhorias & Tasks — Tecnologia para Todos\n\nNenhuma task registrada.';
    const lines = ['# 💡 Melhorias & Tasks — Tecnologia para Todos\n'];
    combined.forEach((it) => {
      const mark = it.status === 'done' ? 'x' : ' ';
      const gh = it.github_issue_number ? ` (GitHub #${it.github_issue_number})` : '';
      const desc = it.description ? ` — ${it.description}` : '';
      lines.push(`- [${mark}] [${it.module} · ${it.priority}] **${it.title}**${desc}${gh}`);
    });
    return lines.join('\n');
  }

  /* ---------- Inicialização ---------- */
  function init(notifyToast) {
    toastFn = notifyToast;

    if (tasksApi) {
      tasksApi.getClientId();
      tasksApi.onSyncUpdate(async (summary) => {
        if (summary && summary.syncedCount > 0) {
          notify(`✅ ${summary.syncedCount} task(s) offline sincronizada(s) com o servidor!`);
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
          showFormError('O título precisa ter entre 5 e 120 caracteres.');
          if (titleInput) titleInput.focus();
          return;
        }
        if (desc && (desc.length < 10 || desc.length > 1000)) {
          showFormError('Se preencher a descrição, escreva entre 10 e 1000 caracteres (ou deixe em branco).');
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
          showFormError(res.message || 'Não foi possível criar a task.');
          notify(`⚠️ ${res.message || 'Erro ao enviar task.'}`);
          return;
        }

        if (titleInput) titleInput.value = '';
        if (descInput) descInput.value = '';
        if (titleCount) titleCount.textContent = '0/120';

        if (res.queued) {
          notify('⏳ Sem conexão: task salva na fila e será enviada ao reconectar!');
          renderList();
        } else {
          notify('🎉 Task criada! Sincronizando com o GitHub…');
          await loadTasksFromApi();
          clearTimeout(bgRefreshTimer);
          bgRefreshTimer = setTimeout(() => {
            loadTasksFromApi();
          }, 2500);
        }
      });
    }

    const adminBtn = document.getElementById('issues-admin-btn');
    if (adminBtn && tasksApi) {
      adminBtn.addEventListener('click', () => {
        if (tasksApi.isAdminActive()) {
          if (window.confirm('Deseja desativar o Modo Admin neste navegador?')) {
            tasksApi.clearAdminKey();
            editingTaskId = null;
            renderList();
            notify('🔒 Modo Admin desativado.');
          }
          return;
        }
        const key = window.prompt('Digite a chave de administrador (ADMIN_KEY):');
        if (key && key.trim()) {
          tasksApi.setAdminKey(key.trim());
          renderList();
          notify('🔓 Modo Admin ativado!');
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
        notify('🔄 Lista atualizada.');
      });
    }

    const copyBtn = document.getElementById('issues-copy-md');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const md = exportMarkdown();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(md).then(() => {
            notify('📋 Lista de tasks copiada em Markdown!');
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
