/* =========================================================
   Tecnologia para Todos — Aplicação Principal (Abas, Aulas e Glossário)
   ========================================================= */
(function () {
  'use strict';

  const TPT = (window.TPT = window.TPT || {});
  const LESSONS = window.TPT_LESSONS || [];
  const GLOSSARY = window.TPT_GLOSSARY || [];
  const { highlightPython, escapeHtml } = TPT.syntax;

  const STORAGE_LESSON_KEY = 'tpt.currentLesson';
  const STORAGE_DONE_KEY = 'tpt.completedCards';

  let currentTab = 'inicio';
  let currentLessonId = localStorage.getItem(STORAGE_LESSON_KEY) || (LESSONS[0] && LESSONS[0].id) || 'aula-1';
  let currentGlossaryCat = 'all';
  let glossaryQuery = '';
  let completedCards = new Set();

  function t(key, vars) {
    return TPT.i18n && typeof TPT.i18n.t === 'function' ? TPT.i18n.t(key, vars) : key;
  }

  function currentLang() {
    return TPT.i18n && typeof TPT.i18n.getLang === 'function' ? TPT.i18n.getLang() : 'pt';
  }

  function getLocalizedLessons() {
    const lang = currentLang();
    const map = window.TPT_LESSONS_I18N && window.TPT_LESSONS_I18N[lang];
    if (lang === 'pt' || !map) return LESSONS;

    const lessonOverrides = map.lessons || {};
    const cardOverrides = map.cards || {};

    return LESSONS.map((lesson) => {
      const lOver = lessonOverrides[lesson.id] || {};
      const topics = (lesson.topics || []).map((topic, idx) => {
        const tOver = lOver.topics && lOver.topics[idx];
        return tOver ? Object.assign({}, topic, tOver) : topic;
      });
      const cards = (lesson.cards || []).map((card) => {
        const cOver = cardOverrides[card.id];
        if (!cOver) return card;
        const mergedItems = card.items
          ? card.items.map((it, idx) => {
              const iOver = cOver.items && cOver.items[idx];
              return iOver ? Object.assign({}, it, iOver) : it;
            })
          : card.items;
        return Object.assign({}, card, cOver, { items: mergedItems });
      });
      return Object.assign({}, lesson, lOver, { topics, cards });
    });
  }

  function getLocalizedGlossary() {
    const lang = currentLang();
    const map = window.TPT_GLOSSARY_I18N && window.TPT_GLOSSARY_I18N[lang];
    return GLOSSARY.map((item) => {
      const over = map && map[item.term];
      if (!over) return Object.assign({}, item, { displayTerm: item.term });
      return Object.assign({}, item, {
        displayTerm: over.termLabel || item.term,
        simple: over.simple || item.simple,
        output: over.output || item.output,
      });
    });
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_DONE_KEY) || '[]');
    if (Array.isArray(saved)) completedCards = new Set(saved);
  } catch (_) {}

  function saveCompleted() {
    try {
      localStorage.setItem(STORAGE_DONE_KEY, JSON.stringify([...completedCards]));
    } catch (_) {}
  }

  /* ---------- Toast (aviso rápido na parte inferior) ---------- */
  let toastTimer = null;
  function showToast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }
  TPT.showToast = showToast;

  /* ---------- Cores pastéis dos badges e cards (estilo slides) ---------- */
  const COLOR_MAP = {
    sol: { badge: 'bg-sol-soft text-amber-900 border border-amber-300/70', topic: 'bg-sol text-navy' },
    menta: { badge: 'bg-menta-soft text-teal-900 border border-teal-300/70', topic: 'bg-menta text-navy' },
    salmao: { badge: 'bg-salmao-soft text-rose-950 border border-rose-300/70', topic: 'bg-salmao text-navy' },
    lavanda: { badge: 'bg-lavanda-soft text-indigo-950 border border-indigo-300/70', topic: 'bg-lavanda text-navy' },
    coral: { badge: 'bg-coral-soft text-red-950 border border-red-300/70', topic: 'bg-coral text-white' },
    ceu: { badge: 'bg-ceu-soft text-sky-950 border border-sky-300/70', topic: 'bg-ceu text-navy' },
  };

  /* ---------- Formata a saída esperada, destacando [[o que a pessoa digita]] ---------- */
  function formatOutput(raw) {
    const safe = escapeHtml(raw);
    const typedTitle = escapeHtml(t('lessons.typedTitle'));
    return safe.replace(/\[\[([\s\S]*?)\]\]/g, `<span class="typed" title="${typedTitle}">$1</span>`);
  }

  /* ---------- Bloco de código reutilizável ---------- */
  function renderCodeBlock(code) {
    const encoded = encodeURIComponent(code);
    return `
      <div class="code-block">
        <div class="code-block-head">
          <span class="dot bg-coral"></span>
          <span class="dot bg-sol"></span>
          <span class="dot bg-menta"></span>
          <span class="ml-2 font-mono text-xs text-slate-400">python</span>
          <button type="button" class="copy-btn" data-copy-code="${encoded}" title="${escapeHtml(t('lessons.copyTitle'))}">${escapeHtml(t('lessons.copyBtn'))}</button>
        </div>
        <pre><code>${highlightPython(code)}</code></pre>
      </div>
    `;
  }

  /* =========================================================
     1. NAVEGAÇÃO POR ABAS
     ========================================================= */
  const VALID_TABS = ['inicio', 'aulas', 'glossario', 'playground', 'melhorias'];

  function switchTab(tab, opts) {
    const options = opts || {};
    const target = VALID_TABS.includes(tab) ? tab : 'inicio';
    currentTab = target;

    document.querySelectorAll('[role="tab"][data-tab]').forEach((btn) => {
      const active = btn.getAttribute('data-tab') === target;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    document.querySelectorAll('.view').forEach((panel) => {
      panel.hidden = panel.id !== `view-${target}`;
    });

    if (!options.skipHash) {
      history.replaceState(null, '', `#${target}`);
    }

    if (target === 'playground' && TPT.playground) {
      TPT.playground.onActivate();
    } else if (target === 'melhorias' && TPT.issues && TPT.issues.onActivate) {
      TPT.issues.onActivate();
    }

    if (!options.keepScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /** Carrega um código no Playground e muda para a aba Playground */
  function openInPlayground(code, title, cardId) {
    if (cardId) {
      completedCards.add(cardId);
      saveCompleted();
      renderLessons();
    }
    switchTab('playground');
    if (TPT.playground) {
      TPT.playground.setCode(code, title);
    }
    showToast(t('lessons.loadedToast', { title }));
  }

  /* =========================================================
     2. TRILHA DE AULAS
     ========================================================= */
  function getCurrentLesson() {
    const lessons = getLocalizedLessons();
    return lessons.find((l) => l.id === currentLessonId) || lessons[0];
  }

  function renderLessonPicker() {
    const host = document.getElementById('lesson-picker');
    if (!host) return;
    host.innerHTML = getLocalizedLessons().map((lesson) => {
      const active = lesson.id === currentLessonId;
      return `
        <button type="button" data-select-lesson="${lesson.id}"
          class="px-5 py-3.5 rounded-2xl font-display font-bold text-left transition flex items-center gap-3 border ${
            active
              ? 'bg-navy text-white border-navy shadow-lift'
              : 'bg-white text-navy border-navy/10 hover:bg-creme-200 shadow-soft'
          }">
          <span class="text-2xl" aria-hidden="true">${lesson.emoji}</span>
          <span>
            <span class="block text-xs uppercase tracking-wider ${active ? 'text-sol' : 'text-navy/50'}">${escapeHtml(t('lessons.lessonLabel', { n: lesson.number }))}</span>
            <span class="block text-base">${escapeHtml(lesson.title)}</span>
          </span>
        </button>
      `;
    }).join('');
  }

  function renderLessonHero(lesson) {
    const host = document.getElementById('lesson-hero');
    if (!host || !lesson) return;

    const testableCards = lesson.cards.filter((c) => c.code || c.playground);
    const doneCount = testableCards.filter((c) => completedCards.has(c.id)).length;
    const pct = testableCards.length ? Math.round((doneCount / testableCards.length) * 100) : 0;

    const topicsHtml = (lesson.topics || [])
      .map((tp) => {
        const style = (COLOR_MAP[tp.color] && COLOR_MAP[tp.color].topic) || 'bg-sol text-navy';
        return `
          <div class="${style} rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-soft">
            <span class="text-3xl mb-3" aria-hidden="true">${tp.emoji}</span>
            <div>
              <div class="font-display font-extrabold text-lg sm:text-xl">${escapeHtml(tp.name)}</div>
              <div class="text-sm font-semibold opacity-80">${escapeHtml(tp.desc)}</div>
            </div>
          </div>
        `;
      })
      .join('');

    host.innerHTML = `
      <div class="rounded-3xl bg-navy text-white p-6 sm:p-9 shadow-lift relative overflow-hidden">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <span class="inline-block text-xs font-extrabold uppercase tracking-[0.18em] text-sol">
              ${escapeHtml(t('lessons.heroEyebrow', { n: lesson.number }))}
            </span>
            <h2 class="font-display font-extrabold text-3xl sm:text-5xl mt-2 tracking-tight">
              ${escapeHtml(lesson.title)} <span aria-hidden="true">${lesson.emoji}</span>
            </h2>
            <p class="mt-2 text-menta font-mono text-sm sm:text-base font-semibold">${escapeHtml(lesson.subtitle)}</p>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-2xl p-4 sm:p-5 min-w-[240px]">
            <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
              <span>${escapeHtml(t('lessons.testedProgress'))}</span>
              <span class="text-sol">${doneCount} / ${testableCards.length}</span>
            </div>
            <div class="progress-track bg-white/15">
              <div class="progress-fill" style="width:${pct}%"></div>
            </div>
            <p class="text-xs text-slate-300 mt-2">${escapeHtml(t('lessons.heroHint'))}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-7">
          ${topicsHtml}
        </div>
      </div>
    `;
  }

  function renderItemsPills(items) {
    if (!items || !items.length) return '';
    return `
      <div class="grid gap-2 sm:grid-cols-2">
        ${items
          .map(
            (it) => `
          <div class="flex items-center gap-2.5 bg-creme rounded-xl px-3.5 py-2.5 border border-navy/5 text-sm">
            ${it.emoji ? `<span class="text-lg" aria-hidden="true">${it.emoji}</span>` : ''}
            <span class="font-mono font-bold text-navy">${escapeHtml(it.label || '')}</span>
            ${it.text ? `<span class="text-navy/70 font-medium">${escapeHtml(it.text)}</span>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  function renderCard(card) {
    const color = COLOR_MAP[card.color] || COLOR_MAP.sol;
    const codeForPlayground = card.playground || card.code || '';
    const encodedPlay = encodeURIComponent(codeForPlayground);
    const encodedTitle = encodeURIComponent(card.title);
    const isDone = completedCards.has(card.id);
    const btnLabel = card.buttonLabel || t('lessons.tryInPlaygroundBtn');

    // Card de Desafio (fundo coral como no slide "Desafio 1 ⚡")
    if (card.kind === 'challenge') {
      return `
        <article class="md:col-span-2 rounded-3xl bg-coral text-navy p-6 sm:p-8 shadow-lift flex flex-col gap-5 fade-in">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="badge bg-white/90 text-navy">${escapeHtml(t('lessons.challengeBadge'))}</span>
            ${isDone ? `<span class="badge bg-menta text-navy">${escapeHtml(t('lessons.testedBadge'))}</span>` : ''}
          </div>
          <h3 class="font-display font-extrabold text-2xl sm:text-4xl tracking-tight">
            ${escapeHtml(card.title)} <span aria-hidden="true">${card.emoji || '⚡'}</span>
          </h3>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            ${(card.items || [])
              .map(
                (it) => `
              <div class="bg-creme rounded-2xl p-5 shadow-soft flex flex-col gap-2">
                <span class="text-3xl" aria-hidden="true">${it.emoji || '✨'}</span>
                <span class="font-display font-bold text-base sm:text-lg leading-snug">${escapeHtml(it.label)}</span>
              </div>
            `
              )
              .join('')}
          </div>
          <div class="pt-1">
            <button type="button" class="btn-primary bg-navy text-white hover:bg-navy-800"
              data-try-code="${encodedPlay}" data-try-title="${encodedTitle}" data-card-id="${card.id}">
              ${escapeHtml(t('lessons.challengeBtn'))}
            </button>
          </div>
        </article>
      `;
    }

    // Card de Mini Projeto (largura total, 2 colunas internas)
    if (card.kind === 'project') {
      return `
        <article class="md:col-span-2 rounded-3xl bg-menta-soft border-2 border-teal-300/80 p-6 sm:p-8 shadow-lift flex flex-col gap-5 fade-in">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="badge bg-navy text-sol">${escapeHtml(card.tag || 'Mini Projeto')}</span>
            ${isDone ? `<span class="badge bg-white text-teal-900">${escapeHtml(t('lessons.testedPlaygroundBadge'))}</span>` : ''}
          </div>
          <h3 class="font-display font-extrabold text-2xl sm:text-3xl tracking-tight">
            ${escapeHtml(card.title)} <span aria-hidden="true">${card.emoji || '🚀'}</span>
          </h3>
          <div class="grid gap-5 lg:grid-cols-2 items-start">
            <div class="flex flex-col gap-4">
              ${card.code ? renderCodeBlock(card.code) : ''}
            </div>
            <div class="bg-white rounded-2xl p-5 shadow-soft border border-navy/5 flex flex-col gap-4">
              ${
                card.output
                  ? `
                <div class="output-box">
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-xs font-extrabold uppercase tracking-wider text-emerald-800">${escapeHtml(t('lessons.exampleOutputLabel'))}</span>
                    ${card.output.includes('[[') ? `<span class="text-xs font-semibold text-amber-800 bg-sol-soft px-2 py-0.5 rounded-md">${escapeHtml(t('lessons.typedBadge'))}</span>` : ''}
                  </div>
                  <pre>${formatOutput(card.output)}</pre>
                </div>
              `
                  : ''
              }
              ${renderItemsPills(card.items)}
              ${card.tip ? `<div class="tip-box"><span aria-hidden="true">💡</span><span>${escapeHtml(card.tip)}</span></div>` : ''}
              <button type="button" class="btn-primary w-full sm:w-auto"
                data-try-code="${encodedPlay}" data-try-title="${encodedTitle}" data-card-id="${card.id}">
                ${escapeHtml(btnLabel)}
              </button>
            </div>
          </div>
        </article>
      `;
    }

    // Card de Resumo final da aula (estilo slide 20)
    if (card.kind === 'summary') {
      return `
        <article class="md:col-span-2 rounded-3xl bg-navy text-white p-6 sm:p-8 shadow-lift fade-in">
          <h3 class="font-display font-extrabold text-2xl sm:text-3xl mb-5">
            ${escapeHtml(card.title)} <span aria-hidden="true">${card.emoji || '🎉'}</span>
          </h3>
          <div class="grid gap-3 sm:grid-cols-2">
            ${(card.items || [])
              .map(
                (it) => `
              <div class="bg-menta text-navy rounded-2xl px-5 py-4 font-display font-bold text-base sm:text-lg flex items-center gap-3">
                <span aria-hidden="true">✅</span>
                <span><strong>${escapeHtml(it.label)}</strong> ${escapeHtml(it.text || '')}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </article>
      `;
    }

    // Card padrão (código ou conceito)
    return `
      <article class="rounded-3xl bg-white border border-navy/10 p-6 shadow-soft hover:shadow-lift transition flex flex-col gap-4 fade-in">
        <div class="flex items-center justify-between gap-2">
          <span class="badge ${color.badge}">${escapeHtml(card.tag || '')}</span>
          ${isDone ? `<span class="badge bg-menta-soft text-teal-900">${escapeHtml(t('lessons.testedBadge'))}</span>` : ''}
        </div>
        <div>
          <h3 class="font-display font-extrabold text-xl sm:text-2xl tracking-tight flex items-center gap-2">
            <span>${escapeHtml(card.title)}</span>
            <span aria-hidden="true">${card.emoji || ''}</span>
          </h3>
          ${card.text ? `<p class="text-navy/70 mt-1.5 text-base leading-relaxed">${escapeHtml(card.text)}</p>` : ''}
        </div>

        ${card.code ? renderCodeBlock(card.code) : ''}

        ${
          card.output
            ? `
          <div class="output-box">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-extrabold uppercase tracking-wider text-emerald-800">${escapeHtml(t('lessons.expectedOutputLabel'))}</span>
              ${card.output.includes('[[') ? `<span class="text-xs font-semibold text-amber-800 bg-sol-soft px-2 py-0.5 rounded-md">${escapeHtml(t('lessons.typedBadge'))}</span>` : ''}
            </div>
            <pre>${formatOutput(card.output)}</pre>
          </div>
        `
            : ''
        }

        ${renderItemsPills(card.items)}

        ${card.tip ? `<div class="tip-box mt-auto"><span aria-hidden="true">💡</span><span>${escapeHtml(card.tip)}</span></div>` : ''}

        ${
          codeForPlayground
            ? `
          <div class="pt-1 mt-auto">
            <button type="button" class="btn-primary w-full"
              data-try-code="${encodedPlay}" data-try-title="${encodedTitle}" data-card-id="${card.id}">
              ${escapeHtml(btnLabel)}
            </button>
          </div>
        `
            : ''
        }
      </article>
    `;
  }

  function renderLessonNav(lesson) {
    const host = document.getElementById('lesson-nav');
    if (!host) return;
    const lessons = getLocalizedLessons();
    const idx = lessons.findIndex((l) => l.id === lesson.id);
    const prev = lessons[idx - 1];
    const next = lessons[idx + 1];

    host.innerHTML = `
      <div>
        ${
          prev
            ? `<button type="button" data-select-lesson="${prev.id}" class="btn-soft">
                ← ${escapeHtml(t('lessons.lessonLabel', { n: prev.number }))}: ${escapeHtml(prev.title)}
              </button>`
            : ''
        }
      </div>
      <div class="flex flex-wrap gap-3">
        <button type="button" data-go-tab="glossario" class="btn-soft">${escapeHtml(t('lessons.viewGlossaryBtn'))}</button>
        ${
          next
            ? `<button type="button" data-select-lesson="${next.id}" class="btn-primary">
                ${escapeHtml(t('lessons.nextLessonBtn', { n: next.number, title: next.title }))}
              </button>`
            : `<button type="button" data-go-tab="playground" class="btn-primary">
                ${escapeHtml(t('lessons.openFreePlaygroundBtn'))}
              </button>`
        }
      </div>
    `;
  }

  function renderLessons() {
    const lesson = getCurrentLesson();
    if (!lesson) return;
    renderLessonPicker();
    renderLessonHero(lesson);

    const cardsHost = document.getElementById('lesson-cards');
    if (cardsHost) {
      cardsHost.innerHTML = lesson.cards.map(renderCard).join('');
    }
    renderLessonNav(lesson);
  }

  /* =========================================================
     3. GLOSSÁRIO DE PALAVRAS
     ========================================================= */
  function normalize(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function getCategories() {
    const set = new Set(['all']);
    GLOSSARY.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return [...set];
  }

  function getCategoryLabel(catKey) {
    const translated = t(`glossary.categories.${catKey}`);
    return translated && translated !== `glossary.categories.${catKey}` ? translated : catKey;
  }

  function renderGlossaryFilters() {
    const host = document.getElementById('glossary-filters');
    if (!host) return;
    host.innerHTML = getCategories()
      .map((cat) => {
        const active = cat === currentGlossaryCat;
        return `
          <button type="button" data-glossary-cat="${escapeHtml(cat)}"
            class="px-4 py-2 rounded-xl font-bold text-sm transition border ${
              active
                ? 'bg-navy text-white border-navy shadow-soft'
                : 'bg-white text-navy/75 border-navy/10 hover:bg-creme-200'
            }">
            ${escapeHtml(getCategoryLabel(cat))}
          </button>
        `;
      })
      .join('');
  }

  function renderGlossary() {
    renderGlossaryFilters();
    const grid = document.getElementById('glossary-grid');
    const empty = document.getElementById('glossary-empty');
    const count = document.getElementById('glossary-count');
    if (!grid) return;

    const localizedGlossary = getLocalizedGlossary();
    const q = normalize(glossaryQuery);
    const filtered = localizedGlossary.filter((item) => {
      if (currentGlossaryCat !== 'all' && item.category !== currentGlossaryCat) return false;
      if (!q) return true;
      const haystack = normalize(
        [
          item.term,
          item.displayTerm,
          item.category,
          getCategoryLabel(item.category),
          item.simple,
          item.example,
          item.tr && item.tr.es,
          item.tr && item.tr.en,
          item.tr && item.tr.fr,
        ].join(' ')
      );
      return haystack.includes(q);
    });

    if (count) {
      count.textContent =
        filtered.length === localizedGlossary.length
          ? t('glossary.countAll', { total: localizedGlossary.length })
          : t('glossary.countFiltered', { found: filtered.length, total: localizedGlossary.length });
    }

    if (!filtered.length) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    grid.innerHTML = filtered
      .map((item) => {
        const encoded = item.example ? encodeURIComponent(item.example) : '';
        const encodedTitle = encodeURIComponent(item.displayTerm || item.term);
        return `
          <article class="rounded-3xl bg-white border border-navy/10 p-6 shadow-soft flex flex-col gap-3.5 fade-in">
            <div class="flex items-center justify-between gap-2">
              <span class="badge bg-ceu-soft text-sky-950">${escapeHtml(getCategoryLabel(item.category))}</span>
              <span class="text-xs font-bold text-navy/45">${escapeHtml(t('glossary.lessonTag', { n: item.lesson || 1 }))}</span>
            </div>
            <h3 class="font-mono font-extrabold text-xl text-navy flex items-center gap-2">
              <span aria-hidden="true">${item.emoji || '📌'}</span>
              <span>${escapeHtml(item.displayTerm || item.term)}</span>
            </h3>
            <p class="text-navy/80 text-base leading-relaxed">${escapeHtml(item.simple)}</p>

            ${
              item.tr
                ? `
              <div class="flex flex-wrap gap-1.5 text-xs font-semibold text-navy/70">
                ${item.tr.es ? `<span class="bg-creme px-2.5 py-1 rounded-lg border border-navy/5">🇪🇸 ${escapeHtml(item.tr.es)}</span>` : ''}
                ${item.tr.en ? `<span class="bg-creme px-2.5 py-1 rounded-lg border border-navy/5">🇬🇧 ${escapeHtml(item.tr.en)}</span>` : ''}
                ${item.tr.fr ? `<span class="bg-creme px-2.5 py-1 rounded-lg border border-navy/5">🇫🇷 ${escapeHtml(item.tr.fr)}</span>` : ''}
              </div>
            `
                : ''
            }

            ${item.example ? renderCodeBlock(item.example) : ''}
            ${
              item.output
                ? `<div class="output-box"><span class="text-xs font-extrabold uppercase tracking-wider text-emerald-800 block mb-0.5">${escapeHtml(t('glossary.outputLabel'))}</span><pre>${escapeHtml(item.output)}</pre></div>`
                : ''
            }
            ${
              item.example
                ? `
              <button type="button" class="btn-soft mt-auto text-sm"
                data-try-code="${encoded}" data-try-title="${encodedTitle}">
                ${escapeHtml(t('glossary.tryBtn'))}
              </button>
            `
                : ''
            }
          </article>
        `;
      })
      .join('');
  }

  /* =========================================================
     4. EVENTOS E INICIALIZAÇÃO
     ========================================================= */
  function bindEvents() {
    // Abas
    document.querySelectorAll('[role="tab"][data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    // Delegação de cliques (cards, copiar, trocar aula, filtros)
    document.addEventListener('click', (e) => {
      const tryBtn = e.target.closest('[data-try-code]');
      if (tryBtn) {
        let code = decodeURIComponent(tryBtn.getAttribute('data-try-code') || '');
        const titleKey = tryBtn.getAttribute('data-try-title-key');
        const title = titleKey
          ? t(titleKey)
          : decodeURIComponent(tryBtn.getAttribute('data-try-title') || t('lessons.defaultExampleTitle'));
        if (tryBtn.id === 'home-preview-run-btn') {
          code = `nome = input(${JSON.stringify(t('home.hero.previewCodePrompt'))})\nprint(${JSON.stringify(t('home.hero.previewCodeGreeting'))}, nome)`;
        }
        const cardId = tryBtn.getAttribute('data-card-id') || null;
        openInPlayground(code, title, cardId);
        return;
      }

      const copyBtn = e.target.closest('[data-copy-code]');
      if (copyBtn) {
        const code = decodeURIComponent(copyBtn.getAttribute('data-copy-code') || '');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(() => showToast(t('lessons.copiedToast')));
        }
        return;
      }

      const lessonBtn = e.target.closest('[data-select-lesson]');
      if (lessonBtn) {
        currentLessonId = lessonBtn.getAttribute('data-select-lesson');
        try {
          localStorage.setItem(STORAGE_LESSON_KEY, currentLessonId);
        } catch (_) {}
        renderLessons();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const catBtn = e.target.closest('[data-glossary-cat]');
      if (catBtn) {
        currentGlossaryCat = catBtn.getAttribute('data-glossary-cat') || 'all';
        renderGlossary();
        return;
      }

      const goTabBtn = e.target.closest('[data-go-tab]');
      if (goTabBtn) {
        switchTab(goTabBtn.getAttribute('data-go-tab'));
      }
    });

    // Busca no glossário
    const searchInput = document.getElementById('glossary-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        glossaryQuery = searchInput.value || '';
        renderGlossary();
      });
    }

    // Hash da URL (#inicio, #aulas, #glossario, #playground, #melhorias)
    window.addEventListener('hashchange', () => {
      const hash = (location.hash || '').replace('#', '');
      if (VALID_TABS.includes(hash) && hash !== currentTab) {
        switchTab(hash, { skipHash: true });
      }
    });
  }

  function init() {
    if (TPT.i18n) {
      TPT.i18n.init();
      TPT.i18n.onChange(() => {
        renderLessons();
        renderGlossary();
      });
    }
    if (TPT.theme) TPT.theme.init();
    if (TPT.playground) TPT.playground.init();
    if (TPT.issues) TPT.issues.init(showToast);
    renderLessons();
    renderGlossary();
    bindEvents();

    const initialHash = (location.hash || '').replace('#', '');
    switchTab(VALID_TABS.includes(initialHash) ? initialHash : 'inicio', {
      skipHash: true,
      keepScroll: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
