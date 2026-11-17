/* =========================================================
   Tecnologia para Todos — Aba Melhorias & Bugs (Issues #1, #2…)
   ---------------------------------------------------------
   • Cada sugestão ou bug registrado recebe um número sequencial
     único (#1, #2, #3...) que nunca se repete.
   • Os dados ficam salvos no navegador (localStorage) e podem
     ser copiados em Markdown com 1 clique.
   ========================================================= */
(function () {
  'use strict';

  const TPT = (window.TPT = window.TPT || {});
  const { escapeHtml } = TPT.syntax;

  const STORAGE_ISSUES_KEY = 'tpt.issues.list';
  const STORAGE_SEQ_KEY = 'tpt.issues.nextNumber';

  const INITIAL_ISSUES = [
    {
      number: 1,
      type: 'conteudo',
      area: 'Geral',
      title: 'Criar Aula 3 sobre Funções (def) e Dicionários',
      desc: 'Seria muito legal ter uma próxima aula mostrando como criar funções com def para organizar o código e dicionários para guardar dados com chave e valor.',
      author: 'Lucas R. K.',
      status: 'open',
      votes: 3,
      createdAt: 'Hoje',
    },
    {
      number: 2,
      type: 'melhoria',
      area: 'Playground',
      title: 'Botão para baixar o código escrito como arquivo .py',
      desc: 'Permitir que o aluno salve o programa que escreveu no Playground direto no computador ou celular como meu_programa.py.',
      author: 'Comunidade',
      status: 'done',
      votes: 2,
      createdAt: 'Hoje',
    },
  ];

  const TYPE_META = {
    melhoria: { label: '💡 Melhoria', badge: 'bg-sol-soft text-amber-950 border border-amber-300/70' },
    bug: { label: '🐞 Bug / Erro', badge: 'bg-coral-soft text-red-950 border border-red-300/70' },
    conteudo: { label: '📘 Nova Aula', badge: 'bg-ceu-soft text-sky-950 border border-sky-300/70' },
  };

  let issues = [];
  let nextNumber = 3;
  let currentFilter = 'all';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_ISSUES_KEY);
      const seq = Number(localStorage.getItem(STORAGE_SEQ_KEY));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) issues = parsed;
      } else {
        issues = INITIAL_ISSUES.slice();
      }
      const maxExisting = issues.reduce((m, it) => Math.max(m, Number(it.number) || 0), 0);
      nextNumber = Math.max(seq || 1, maxExisting + 1);
    } catch (_) {
      issues = INITIAL_ISSUES.slice();
      nextNumber = 3;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_ISSUES_KEY, JSON.stringify(issues));
      localStorage.setItem(STORAGE_SEQ_KEY, String(nextNumber));
    } catch (_) {}
  }

  function formatDate() {
    try {
      return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch (_) {
      return 'Agora';
    }
  }

  function updateBadgesAndCounters() {
    const openCount = issues.filter((i) => i.status !== 'done').length;
    const doneCount = issues.filter((i) => i.status === 'done').length;
    const bugCount = issues.filter((i) => i.type === 'bug' && i.status !== 'done').length;

    const navBadge = document.getElementById('issues-nav-badge');
    if (navBadge) {
      navBadge.textContent = String(openCount);
    }

    const nextBadge = document.getElementById('issue-next-number');
    const submitNum = document.getElementById('issue-submit-num');
    if (nextBadge) nextBadge.textContent = `#${nextNumber}`;
    if (submitNum) submitNum.textContent = `#${nextNumber}`;

    const statsHost = document.getElementById('issues-stats');
    if (statsHost) {
      statsHost.innerHTML = `
        <div class="px-4 py-2.5 rounded-2xl bg-white border border-navy/10 shadow-soft text-sm font-bold flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
          <span>${openCount} ${openCount === 1 ? 'aberta' : 'abertas'}</span>
        </div>
        <div class="px-4 py-2.5 rounded-2xl bg-white border border-navy/10 shadow-soft text-sm font-bold flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          <span>${doneCount} ${doneCount === 1 ? 'resolvida' : 'resolvidas'}</span>
        </div>
        <div class="px-4 py-2.5 rounded-2xl bg-white border border-navy/10 shadow-soft text-sm font-bold flex items-center gap-2">
          <span aria-hidden="true">🐞</span>
          <span>${bugCount} ${bugCount === 1 ? 'bug aberto' : 'bugs abertos'}</span>
        </div>
      `;
    }
  }

  function renderFilterBar() {
    const host = document.getElementById('issues-filter-bar');
    if (!host) return;

    const filters = [
      { id: 'all', label: 'Todas' },
      { id: 'open', label: '🟢 Abertas' },
      { id: 'done', label: '✅ Resolvidas' },
      { id: 'melhoria', label: '💡 Melhorias' },
      { id: 'bug', label: '🐞 Bugs' },
      { id: 'conteudo', label: '📘 Conteúdo' },
    ];

    host.innerHTML = filters
      .map((f) => {
        const active = f.id === currentFilter;
        return `
          <button type="button" data-issue-filter="${f.id}"
            class="px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition ${
              active ? 'bg-navy text-white shadow-soft' : 'bg-creme text-navy/75 hover:bg-creme-200'
            }">
            ${f.label}
          </button>
        `;
      })
      .join('');
  }

  function getFilteredIssues() {
    return issues
      .slice()
      .sort((a, b) => b.number - a.number)
      .filter((it) => {
        if (currentFilter === 'open') return it.status !== 'done';
        if (currentFilter === 'done') return it.status === 'done';
        if (['melhoria', 'bug', 'conteudo'].includes(currentFilter)) return it.type === currentFilter;
        return true;
      });
  }

  function renderList() {
    updateBadgesAndCounters();
    renderFilterBar();

    const listHost = document.getElementById('issues-list');
    const emptyHost = document.getElementById('issues-empty');
    if (!listHost) return;

    const filtered = getFilteredIssues();
    if (!filtered.length) {
      listHost.innerHTML = '';
      if (emptyHost) emptyHost.classList.remove('hidden');
      return;
    }
    if (emptyHost) emptyHost.classList.add('hidden');

    listHost.innerHTML = filtered
      .map((item) => {
        const meta = TYPE_META[item.type] || TYPE_META.melhoria;
        const isDone = item.status === 'done';
        return `
          <article class="rounded-3xl bg-white border ${
            isDone ? 'border-emerald-300/80 opacity-85' : 'border-navy/10'
          } p-5 sm:p-6 shadow-soft flex flex-col gap-3 fade-in">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-mono font-extrabold text-sm px-2.5 py-1 rounded-lg bg-navy text-sol">
                  #${item.number}
                </span>
                <span class="badge ${meta.badge}">${meta.label}</span>
                <span class="badge bg-creme text-navy/75 border border-navy/10">${escapeHtml(item.area || 'Geral')}</span>
                ${
                  isDone
                    ? '<span class="badge bg-menta-soft text-teal-950 border border-teal-300/70">✅ Resolvida</span>'
                    : '<span class="badge bg-amber-100/80 text-amber-900">🟢 Aberta</span>'
                }
              </div>
              <span class="text-xs font-semibold text-navy/45">
                por ${escapeHtml(item.author || 'Anônimo')} · ${escapeHtml(item.createdAt || 'Hoje')}
              </span>
            </div>

            <h3 class="font-display font-extrabold text-lg sm:text-xl text-navy ${isDone ? 'line-through opacity-75' : ''}">
              ${escapeHtml(item.title)}
            </h3>

            <p class="text-navy/75 text-sm sm:text-base leading-relaxed whitespace-pre-line">${escapeHtml(item.desc)}</p>

            <div class="pt-2 border-t border-navy/5 flex flex-wrap items-center justify-between gap-2">
              <button type="button" data-issue-vote="${item.number}"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-creme hover:bg-sol-soft border border-navy/10 text-xs font-extrabold text-navy transition"
                title="Apoiar esta ideia ou confirmar este bug">
                👍 Apoiar <span class="font-mono">(${Number(item.votes) || 0})</span>
              </button>

              <div class="flex items-center gap-2">
                <button type="button" data-issue-toggle="${item.number}"
                  class="px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    isDone
                      ? 'bg-creme text-navy hover:bg-creme-200 border border-navy/10'
                      : 'bg-menta-soft text-teal-950 hover:bg-menta border border-teal-300/70'
                  }">
                  ${isDone ? '↩ Reabrir' : '✓ Marcar como resolvida'}
                </button>
                <button type="button" data-issue-delete="${item.number}"
                  class="px-2.5 py-1.5 rounded-xl text-xs font-bold text-navy/45 hover:text-red-700 hover:bg-coral-soft transition"
                  title="Excluir task #${item.number}" aria-label="Excluir task #${item.number}">
                  🗑️
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function addIssue({ type, area, author, title, desc }) {
    const number = nextNumber++;
    const item = {
      number,
      type: type || 'melhoria',
      area: area || 'Geral',
      author: (author || '').trim() || 'Anônimo',
      title: title.trim(),
      desc: desc.trim(),
      status: 'open',
      votes: 1,
      createdAt: formatDate(),
    };
    issues.push(item);
    saveState();
    currentFilter = 'all';
    renderList();
    return item;
  }

  function exportMarkdown() {
    if (!issues.length) return '# Melhorias & Bugs\n\nNenhuma task registrada.';
    const lines = ['# 💡 Melhorias & Bugs — Tecnologia para Todos\n'];
    issues
      .slice()
      .sort((a, b) => a.number - b.number)
      .forEach((it) => {
        const mark = it.status === 'done' ? 'x' : ' ';
        const meta = (TYPE_META[it.type] && TYPE_META[it.type].label) || it.type;
        lines.push(`- [${mark}] **#${it.number}** [${meta} · ${it.area}] **${it.title}** — ${it.desc} *(por ${it.author}, 👍 ${it.votes || 0})*`);
      });
    return lines.join('\n');
  }

  function init(notifyToast) {
    loadState();
    renderList();

    const form = document.getElementById('issue-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const typeInput = form.querySelector('input[name="issue-type"]:checked');
        const areaInput = document.getElementById('issue-area');
        const authorInput = document.getElementById('issue-author');
        const titleInput = document.getElementById('issue-title');
        const descInput = document.getElementById('issue-desc');

        const title = (titleInput && titleInput.value.trim()) || '';
        const desc = (descInput && descInput.value.trim()) || '';
        if (!title || !desc) return;

        const created = addIssue({
          type: typeInput ? typeInput.value : 'melhoria',
          area: areaInput ? areaInput.value : 'Geral',
          author: authorInput ? authorInput.value : '',
          title,
          desc,
        });

        if (titleInput) titleInput.value = '';
        if (descInput) descInput.value = '';
        if (notifyToast) notifyToast(`🎉 Task #${created.number} criada com sucesso!`);
      });
    }

    const copyBtn = document.getElementById('issues-copy-md');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const md = exportMarkdown();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(md).then(() => {
            if (notifyToast) notifyToast('📋 Lista de tasks (#) copiada em Markdown!');
          });
        }
      });
    }

    document.addEventListener('click', (e) => {
      const filterBtn = e.target.closest('[data-issue-filter]');
      if (filterBtn) {
        currentFilter = filterBtn.getAttribute('data-issue-filter') || 'all';
        renderList();
        return;
      }

      const voteBtn = e.target.closest('[data-issue-vote]');
      if (voteBtn) {
        const num = Number(voteBtn.getAttribute('data-issue-vote'));
        const target = issues.find((i) => i.number === num);
        if (target) {
          target.votes = (Number(target.votes) || 0) + 1;
          saveState();
          renderList();
        }
        return;
      }

      const toggleBtn = e.target.closest('[data-issue-toggle]');
      if (toggleBtn) {
        const num = Number(toggleBtn.getAttribute('data-issue-toggle'));
        const target = issues.find((i) => i.number === num);
        if (target) {
          target.status = target.status === 'done' ? 'open' : 'done';
          saveState();
          renderList();
          if (notifyToast) {
            notifyToast(target.status === 'done' ? `✅ Task #${num} marcada como resolvida!` : `↩ Task #${num} reaberta.`);
          }
        }
        return;
      }

      const delBtn = e.target.closest('[data-issue-delete]');
      if (delBtn) {
        const num = Number(delBtn.getAttribute('data-issue-delete'));
        issues = issues.filter((i) => i.number !== num);
        saveState();
        renderList();
        if (notifyToast) notifyToast(`🗑️ Task #${num} removida.`);
      }
    });
  }

  TPT.issues = { init, renderList };
})();
