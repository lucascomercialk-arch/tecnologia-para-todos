/* =========================================================
   Tecnologia para Todos — Gerenciador de Tema (Claro/Escuro)
   ---------------------------------------------------------
   • Persiste escolha em localStorage ('tpt_theme').
   • Sem preferência salva, acompanha prefers-color-scheme.
   • Atualiza atributo data-theme, classe dark, meta theme-color
     e acessibilidade do botão #theme-toggle.
   ========================================================= */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'tpt_theme';
  const TPT = (root.TPT = root.TPT || {});
  const listeners = new Set();

  let mediaQuery = null;

  function safeStorageGet(key) {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch (_) {
      return null;
    }
  }

  function safeStorageSet(key, val) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, val);
    } catch (_) {}
  }

  function getSavedTheme() {
    const saved = safeStorageGet(STORAGE_KEY);
    return saved === 'dark' || saved === 'light' ? saved : null;
  }

  function getSystemTheme() {
    if (typeof root.matchMedia === 'function') {
      try {
        return root.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } catch (_) {}
    }
    return 'light';
  }

  function getTheme() {
    if (typeof document !== 'undefined' && document.documentElement) {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'dark' || attr === 'light') return attr;
    }
    return getSavedTheme() || getSystemTheme();
  }

  function translateLabel(key, fallback) {
    if (TPT.i18n && typeof TPT.i18n.t === 'function') {
      const val = TPT.i18n.t(key);
      if (val && val !== key) return val;
    }
    return fallback;
  }

  function updateToggleButton(theme) {
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const isDark = theme === 'dark';
    const label = isDark
      ? translateLabel('a11y.toggleThemeToLight', 'Alternar para modo claro')
      : translateLabel('a11y.toggleThemeToDark', 'Alternar para modo escuro');

    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    btn.setAttribute('aria-label', label);
    btn.title = label;

    const iconEl = btn.querySelector('[data-theme-icon]');
    if (iconEl) {
      iconEl.textContent = isDark ? '☀️' : '🌙';
    } else {
      btn.textContent = isDark ? '☀️' : '🌙';
    }
  }

  function applyTheme(theme) {
    const resolved = theme === 'dark' ? 'dark' : 'light';
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', resolved);
      if (document.documentElement.classList) {
        document.documentElement.classList.toggle('dark', resolved === 'dark');
      }
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', resolved === 'dark' ? '#0B1120' : '#131B3A');
      }
    }
    updateToggleButton(resolved);
    return resolved;
  }

  function notifyListeners(theme) {
    listeners.forEach((cb) => {
      try {
        cb(theme);
      } catch (_) {}
    });
  }

  function setTheme(theme, options) {
    const opts = options || {};
    const persist = opts.persist !== false;
    const resolved = applyTheme(theme);
    if (persist) {
      safeStorageSet(STORAGE_KEY, resolved);
    }
    notifyListeners(resolved);
    return resolved;
  }

  function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    return setTheme(next, { persist: true });
  }

  function onChange(cb) {
    if (typeof cb === 'function') listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function init() {
    const initial = getSavedTheme() || getSystemTheme();
    applyTheme(initial);

    if (typeof document !== 'undefined') {
      const btn = document.getElementById('theme-toggle');
      if (btn && !btn.dataset.tptThemeBound) {
        btn.dataset.tptThemeBound = '1';
        btn.addEventListener('click', () => {
          toggleTheme();
        });
      }
    }

    if (typeof root.matchMedia === 'function' && !mediaQuery) {
      try {
        mediaQuery = root.matchMedia('(prefers-color-scheme: dark)');
        const onSystemChange = (e) => {
          if (!getSavedTheme()) {
            const next = e.matches ? 'dark' : 'light';
            applyTheme(next);
            notifyListeners(next);
          }
        };
        if (typeof mediaQuery.addEventListener === 'function') {
          mediaQuery.addEventListener('change', onSystemChange);
        } else if (typeof mediaQuery.addListener === 'function') {
          mediaQuery.addListener(onSystemChange);
        }
      } catch (_) {}
    }

    if (TPT.i18n && typeof TPT.i18n.onChange === 'function') {
      TPT.i18n.onChange(() => updateToggleButton(getTheme()));
    }
  }

  TPT.theme = {
    STORAGE_KEY,
    getTheme,
    setTheme,
    toggleTheme,
    onChange,
    init,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TPT.theme;
  }
})(typeof window !== 'undefined' ? window : globalThis);
