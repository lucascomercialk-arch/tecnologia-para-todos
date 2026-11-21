/* =========================================================
   Tecnologia para Todos — Motor de Internacionalização (i18n)
   ---------------------------------------------------------
   • Idiomas suportados: PT (pt), ES (es), EN (en).
   • Persiste escolha em localStorage ('tpt_lang').
   • Sem preferência salva, detecta via navigator.language.
   • Aplica traduções no DOM apenas via textContent e atributos
     (Anti-XSS: zero innerHTML).
   ========================================================= */
(function (root) {
  'use strict';

  const SUPPORTED_LANGS = ['pt', 'es', 'en'];
  const HTML_LANG_MAP = { pt: 'pt-BR', es: 'es', en: 'en' };
  const STORAGE_KEY = 'tpt_lang';

  const TPT = (root.TPT = root.TPT || {});
  const listeners = new Set();
  let currentLang = null;

  function normalizeLang(raw) {
    const val = String(raw || '').trim().toLowerCase();
    if (!val) return null;
    if (val === 'pt' || val.startsWith('pt-')) return 'pt';
    if (val === 'es' || val.startsWith('es-')) return 'es';
    if (val === 'en' || val.startsWith('en-')) return 'en';
    return null;
  }

  function safeStorageGet(key) {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch (_) {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch (_) {}
  }

  function detectBrowserLang() {
    if (typeof navigator !== 'undefined') {
      const list = Array.isArray(navigator.languages) && navigator.languages.length
        ? navigator.languages
        : [navigator.language || navigator.userLanguage || ''];
      for (let i = 0; i < list.length; i += 1) {
        const matched = normalizeLang(list[i]);
        if (matched) return matched;
      }
    }
    return 'pt';
  }

  function resolveInitialLang() {
    const saved = normalizeLang(safeStorageGet(STORAGE_KEY));
    if (saved) return saved;
    return detectBrowserLang();
  }

  function getLang() {
    if (!currentLang) currentLang = resolveInitialLang();
    return currentLang;
  }

  function lookup(dict, key) {
    if (!dict || !key) return undefined;
    const parts = String(key).split('.');
    let node = dict;
    for (let i = 0; i < parts.length; i += 1) {
      if (node && typeof node === 'object' && parts[i] in node) {
        node = node[parts[i]];
      } else {
        return undefined;
      }
    }
    return typeof node === 'string' ? node : undefined;
  }

  function interpolate(text, vars) {
    if (!vars || typeof text !== 'string') return text;
    return text.replace(/\{([A-Za-z0-9_]+)\}/g, (full, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) && vars[name] !== undefined && vars[name] !== null
        ? String(vars[name])
        : full
    );
  }

  function t(key, vars) {
    const lang = getLang();
    const translations = root.TPT_TRANSLATIONS || {};
    let str = lookup(translations[lang], key);
    if (str === undefined && lang !== 'pt') {
      str = lookup(translations.pt, key);
    }
    if (str === undefined) return key;
    return interpolate(str, vars);
  }

  function applyDomTranslations() {
    if (typeof document === 'undefined') return;
    const lang = getLang();

    if (document.documentElement) {
      document.documentElement.setAttribute('lang', HTML_LANG_MAP[lang] || 'pt-BR');
    }

    const pageTitle = t('meta.title');
    if (pageTitle && pageTitle !== 'meta.title') {
      document.title = pageTitle;
    }

    const metaDesc = document.querySelector('meta[name="description"]');
    const descText = t('meta.description');
    if (metaDesc && descText && descText !== 'meta.description') {
      metaDesc.setAttribute('content', descText);
    }

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', t(key));
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria-label');
      if (key) el.setAttribute('aria-label', t(key));
    });

    document.querySelectorAll('[data-set-lang]').forEach((btn) => {
      const btnLang = normalizeLang(btn.getAttribute('data-set-lang'));
      btn.setAttribute('aria-pressed', btnLang === lang ? 'true' : 'false');
    });
  }

  function setLang(lang, options) {
    const opts = options || {};
    const next = normalizeLang(lang) || 'pt';
    const prev = currentLang;
    currentLang = next;
    if (opts.persist !== false) {
      safeStorageSet(STORAGE_KEY, next);
    }
    applyDomTranslations();
    if (opts.notify !== false && prev !== next) {
      listeners.forEach((cb) => {
        try {
          cb(next, prev);
        } catch (_) {}
      });
    }
    return next;
  }

  function onChange(cb) {
    if (typeof cb === 'function') listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function init() {
    currentLang = resolveInitialLang();
    applyDomTranslations();

    if (typeof document !== 'undefined') {
      document.querySelectorAll('[data-set-lang]').forEach((btn) => {
        if (btn.dataset.tptLangBound) return;
        btn.dataset.tptLangBound = '1';
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-set-lang');
          if (target) setLang(target, { persist: true });
        });
      });
    }
  }

  TPT.i18n = {
    SUPPORTED_LANGS,
    STORAGE_KEY,
    getLang,
    setLang,
    t,
    applyDomTranslations,
    onChange,
    init,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TPT.i18n;
  }
})(typeof window !== 'undefined' ? window : globalThis);
