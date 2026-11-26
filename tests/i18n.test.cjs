const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXPECTED_LANGS = ['pt', 'es', 'en'];

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

function flattenDict(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const nextKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenDict(v, nextKey, out);
    } else {
      out[nextKey] = v;
    }
  }
  return out;
}

function extractPlaceholders(str) {
  return [...String(str).matchAll(/\{([A-Za-z0-9_]+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(',');
}

function stripJsComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

function loadScripts(files, varNames) {
  const windowObj = { TPT: {} };
  const context = vm.createContext({
    window: windowObj,
    globalThis: windowObj,
    self: windowObj,
    console,
  });
  windowObj.window = windowObj;
  windowObj.self = windowObj;
  windowObj.globalThis = windowObj;

  for (const rel of files) {
    vm.runInContext(readRepoFile(rel), context, { filename: rel });
  }

  const probe = varNames
    .map((name) => `${name}: (typeof ${name} !== 'undefined' ? ${name} : window.${name})`)
    .join(',\n');
  return vm.runInContext(`({ ${probe} })`, context);
}

let failures = 0;
function runTest(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return res.then(
        () => console.log(`PASS: ${name}`),
        (err) => {
          failures += 1;
          console.error(`FAIL: ${name}\n  ${err && err.stack ? err.stack : err}`);
        }
      );
    }
    console.log(`PASS: ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL: ${name}\n  ${err && err.stack ? err.stack : err}`);
  }
  return Promise.resolve();
}

function createStorage() {
  const store = new Map();
  return {
    getItem(k) {
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      store.set(String(k), String(v));
    },
    removeItem(k) {
      store.delete(String(k));
    },
    clear() {
      store.clear();
    },
  };
}

function createClassList() {
  const set = new Set();
  return {
    add(...items) {
      items.forEach((c) => set.add(c));
    },
    remove(...items) {
      items.forEach((c) => set.delete(c));
    },
    toggle(c, force) {
      if (force === undefined) {
        if (set.has(c)) {
          set.delete(c);
          return false;
        }
        set.add(c);
        return true;
      }
      if (force) {
        set.add(c);
        return true;
      }
      set.delete(c);
      return false;
    },
    contains(c) {
      return set.has(c);
    },
  };
}

function createMockElement(tagName, attrs = {}) {
  const attributes = new Map(Object.entries(attrs));
  const listeners = new Map();
  const el = {
    tagName: tagName.toUpperCase(),
    dataset: {},
    classList: createClassList(),
    style: {},
    title: attrs.title || '',
    _textContent: '',
    get textContent() {
      return this._textContent;
    },
    set textContent(v) {
      this._textContent = String(v);
    },
    setAttribute(k, v) {
      const strVal = String(v);
      attributes.set(k, strVal);
      if (k === 'title') this.title = strVal;
      if (k.startsWith('data-')) {
        const camel = k
          .slice(5)
          .replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        this.dataset[camel] = strVal;
      }
    },
    getAttribute(k) {
      return attributes.has(k) ? attributes.get(k) : null;
    },
    hasAttribute(k) {
      return attributes.has(k);
    },
    querySelector() {
      return null;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(evt) {
      (listeners.get(evt.type) || []).forEach((fn) => fn.call(el, evt));
    },
  };
  return el;
}

function makeDomEnv({ initialDark = false, navLanguage = 'pt-BR', i18nElements = [], langButtons = [] } = {}) {
  const localStorage = createStorage();
  const docEl = createMockElement('html');
  const toggleBtn = createMockElement('button', { id: 'theme-toggle' });
  const themeIcon = createMockElement('span', { 'data-theme-icon': '' });
  toggleBtn.querySelector = (sel) => (sel === '[data-theme-icon]' ? themeIcon : null);
  const metaTheme = createMockElement('meta', { name: 'theme-color', content: '#131B3A' });
  const metaDesc = createMockElement('meta', { name: 'description', content: '' });

  const mqlListeners = [];
  let darkMatches = initialDark;
  const mediaQueryList = {
    media: '(prefers-color-scheme: dark)',
    get matches() {
      return darkMatches;
    },
    addEventListener(type, fn) {
      if (type === 'change') mqlListeners.push(fn);
    },
    addListener(fn) {
      mqlListeners.push(fn);
    },
  };

  const document = {
    documentElement: docEl,
    body: createMockElement('body'),
    title: '',
    getElementById(id) {
      if (id === 'theme-toggle') return toggleBtn;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '#theme-toggle' || selector === '[data-theme-toggle]') return [toggleBtn];
      if (selector === '[data-set-lang]') return langButtons;
      if (selector === '[data-i18n]') return i18nElements.filter((el) => el.hasAttribute('data-i18n'));
      if (selector === '[data-i18n-placeholder]') return i18nElements.filter((el) => el.hasAttribute('data-i18n-placeholder'));
      if (selector === '[data-i18n-title]') return i18nElements.filter((el) => el.hasAttribute('data-i18n-title'));
      if (selector === '[data-i18n-aria-label]') return i18nElements.filter((el) => el.hasAttribute('data-i18n-aria-label'));
      return [];
    },
    querySelector(selector) {
      if (selector === 'meta[name="theme-color"]') return metaTheme;
      if (selector === 'meta[name="description"]') return metaDesc;
      const list = this.querySelectorAll(selector);
      return list.length > 0 ? list[0] : null;
    },
  };

  const navigator = { language: navLanguage, languages: [navLanguage] };

  const windowObj = {
    TPT: {},
    localStorage,
    document,
    navigator,
    addEventListener() {},
    matchMedia(query) {
      if (String(query).includes('prefers-color-scheme: dark')) return mediaQueryList;
      return { matches: false, addEventListener() {} };
    },
  };
  windowObj.window = windowObj;
  windowObj.self = windowObj;
  windowObj.globalThis = windowObj;

  return {
    windowObj,
    localStorage,
    docEl,
    toggleBtn,
    themeIcon,
    metaTheme,
    metaDesc,
    triggerSystemDark(isDark) {
      darkMatches = isDark;
      mqlListeners.forEach((fn) => fn({ matches: isDark, media: '(prefers-color-scheme: dark)' }));
    },
  };
}

async function main() {
  const loaded = loadScripts(
    [
      'data/i18n/ui.js',
      'data/lessons.js',
      'data/i18n/lessons-i18n.js',
      'data/glossary.js',
      'data/i18n/glossary-i18n.js',
    ],
    ['TPT_TRANSLATIONS', 'TPT_LESSONS', 'TPT_LESSONS_I18N', 'TPT_GLOSSARY', 'TPT_GLOSSARY_I18N']
  );

  const flatDicts = {};
  for (const lang of EXPECTED_LANGS) {
    flatDicts[lang] = flattenDict(loaded.TPT_TRANSLATIONS[lang]);
  }

  await runTest('1. TPT_TRANSLATIONS parity & non-empty values across pt, es, en', () => {
    for (const lang of EXPECTED_LANGS) {
      assert.ok(
        loaded.TPT_TRANSLATIONS[lang] && typeof loaded.TPT_TRANSLATIONS[lang] === 'object',
        `Missing language dictionary: ${lang}`
      );
    }

    const ptKeys = Object.keys(flatDicts.pt).sort();
    assert.ok(ptKeys.length > 0, 'Base pt dictionary must not be empty');

    for (const lang of ['es', 'en']) {
      const langKeys = Object.keys(flatDicts[lang]).sort();
      const missing = ptKeys.filter((k) => !(k in flatDicts[lang]));
      const extra = langKeys.filter((k) => !(k in flatDicts.pt));
      assert.deepEqual(missing, [], `Keys missing in ${lang}: ${missing.join(', ')}`);
      assert.deepEqual(extra, [], `Extra keys in ${lang} absent in pt: ${extra.join(', ')}`);
    }

    for (const lang of EXPECTED_LANGS) {
      const empty = Object.entries(flatDicts[lang])
        .filter(([, v]) => typeof v !== 'string' || v.trim().length === 0)
        .map(([k]) => k);
      assert.deepEqual(empty, [], `Empty or non-string values in ${lang}: ${empty.join(', ')}`);
    }
    console.log(`   -> ${ptKeys.length} UI translation keys validated across ${EXPECTED_LANGS.join(', ')}`);
  });

  await runTest('2. Placeholder {var} parity across pt, es, en', () => {
    const mismatches = [];
    for (const key of Object.keys(flatDicts.pt)) {
      const baseVars = extractPlaceholders(flatDicts.pt[key]);
      for (const lang of ['es', 'en']) {
        const langVars = extractPlaceholders(flatDicts[lang][key]);
        if (langVars !== baseVars) {
          mismatches.push(`${key}: pt={${baseVars}} ${lang}={${langVars}}`);
        }
      }
    }
    assert.deepEqual(mismatches, [], `Placeholder mismatches:\n${mismatches.join('\n')}`);
  });

  await runTest('3. Zero orphaned/unused UI keys in data/i18n/ui.js', () => {
    const sourceFiles = [
      'index.html',
      'js/app.js',
      'js/playground.js',
      'js/issues.js',
      'js/theme.js',
      'js/i18n.js',
      'js/tasks-api.js',
      'js/pyodide-worker.js',
    ];
    const combined = sourceFiles.map((f) => readRepoFile(f)).join('\n');
    const unused = [];
    for (const key of Object.keys(flatDicts.pt)) {
      if (key.startsWith('meta.') || key.startsWith('glossary.categories.')) continue;
      if (!combined.includes(key)) unused.push(key);
    }
    assert.deepEqual(unused, [], `Unused keys in data/i18n/ui.js: ${unused.join(', ')}`);
  });

  await runTest('4. All index.html data-i18n* keys exist in pt, es, en', () => {
    const html = readRepoFile('index.html');
    const attrRe = /data-i18n(?:-(?:placeholder|title|aria-label))?="([^"]+)"/g;
    const keys = new Set();
    let m;
    while ((m = attrRe.exec(html)) !== null) {
      keys.add(m[1]);
    }
    assert.ok(keys.size > 0, 'Expected data-i18n* attributes in index.html');

    const missing = [];
    for (const key of keys) {
      for (const lang of EXPECTED_LANGS) {
        if (!(key in flatDicts[lang])) missing.push(`${lang}:${key}`);
      }
    }
    assert.deepEqual(missing, [], `Missing HTML translation keys: ${missing.join(', ')}`);
  });

  await runTest('5. No untranslated placeholder, title, or aria-label attributes in index.html', () => {
    const html = readRepoFile('index.html')
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    const untranslated = [];
    const tagRe = /<([a-zA-Z0-9-]+)([^>]*)>/g;
    let tagMatch;
    while ((tagMatch = tagRe.exec(html)) !== null) {
      const attrs = tagMatch[2];
      for (const attr of ['placeholder', 'title', 'aria-label']) {
        const valRe = new RegExp(`(?<!-)\\b${attr}="([^"]+)"`);
        const valMatch = valRe.exec(attrs);
        if (!valMatch) continue;
        if (attrs.includes(`data-i18n-${attr}=`)) continue;
        if (attrs.includes('id="theme-toggle"')) continue;
        if (attr === 'title' && attrs.includes('data-set-lang=')) continue;
        untranslated.push(`${attr}="${valMatch[1]}"`);
      }
    }
    assert.deepEqual(
      untranslated,
      [],
      `Attributes in index.html missing data-i18n-*: ${untranslated.join(', ')}`
    );
  });

  await runTest('6. All literal translation keys in JS modules exist in pt, es, en', () => {
    const jsFiles = [
      'js/app.js',
      'js/playground.js',
      'js/issues.js',
      'js/theme.js',
      'js/tasks-api.js',
      'js/pyodide-worker.js',
    ];
    const patterns = [
      /(?:^|[^.\w$])(?:TPT\.i18n\.|i18n\.)?(?:t|translateLabel)\(\s*['"]([a-zA-Z0-9_.-]+)['"]/gm,
      /\bmessageKey\s*:\s*['"]([a-zA-Z0-9_.-]+)['"]/gm,
      /\bkey\s*:\s*['"]((?:a11y|header|home|lessons|glossary|playground|issues|tasksApi|footer)\.[a-zA-Z0-9_.-]+)['"]/gm,
      /\bsetExampleLabel\(\s*['"]([a-zA-Z0-9_.-]+)['"]/gm,
      /\bsetStatus\([^,]+,\s*['"]([a-zA-Z0-9_.-]+)['"]/gm,
    ];
    const keys = new Set();
    for (const file of jsFiles) {
      const src = readRepoFile(file);
      for (const re of patterns) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(src)) !== null) {
          keys.add(m[1]);
        }
      }
    }
    assert.ok(keys.size > 0, 'Expected literal translation keys in JS');

    const missing = [];
    for (const key of keys) {
      for (const lang of EXPECTED_LANGS) {
        if (!(key in flatDicts[lang])) missing.push(`${lang}:${key}`);
      }
    }
    assert.deepEqual(missing, [], `Missing JS translation keys: ${missing.join(', ')}`);
  });

  await runTest('7. TPT_LESSONS_I18N covers every lesson, topic, card, and field in es and en', () => {
    const lessons = loaded.TPT_LESSONS;
    const lessonsI18n = loaded.TPT_LESSONS_I18N;
    assert.ok(Array.isArray(lessons) && lessons.length >= 3, 'Expected at least 3 lessons');

    const missingFields = [];
    for (const lang of ['es', 'en']) {
      const bundle = lessonsI18n[lang];
      assert.ok(bundle && bundle.lessons && bundle.cards, `Missing ${lang} lesson bundle`);

      for (const lesson of lessons) {
        const trLesson = bundle.lessons[lesson.id];
        assert.ok(trLesson, `Missing lesson ${lesson.id} in ${lang}`);
        if (!trLesson.title) missingFields.push(`${lang}:${lesson.id}.title`);
        if (lesson.subtitle && !trLesson.subtitle) missingFields.push(`${lang}:${lesson.id}.subtitle`);
        if (Array.isArray(lesson.topics)) {
          assert.equal(
            trLesson.topics && trLesson.topics.length,
            lesson.topics.length,
            `Topic count mismatch for ${lesson.id} in ${lang}`
          );
          lesson.topics.forEach((tp, idx) => {
            const trTp = trLesson.topics[idx] || {};
            if (tp.name && !trTp.name) missingFields.push(`${lang}:${lesson.id}.topics[${idx}].name`);
            if (tp.desc && !trTp.desc) missingFields.push(`${lang}:${lesson.id}.topics[${idx}].desc`);
          });
        }

        for (const card of lesson.cards) {
          const trCard = bundle.cards[card.id];
          assert.ok(trCard, `Missing card ${card.id} in ${lang}`);
          for (const field of ['tag', 'title', 'text', 'tip', 'buttonLabel']) {
            if (card[field] && (!trCard[field] || !String(trCard[field]).trim())) {
              missingFields.push(`${lang}:${card.id}.${field}`);
            }
          }
          if (Array.isArray(card.items)) {
            assert.equal(
              trCard.items && trCard.items.length,
              card.items.length,
              `Item count mismatch on ${card.id} in ${lang}`
            );
            card.items.forEach((it, idx) => {
              const trIt = trCard.items[idx] || {};
              if (it.label && (!trIt.label || !String(trIt.label).trim())) {
                missingFields.push(`${lang}:${card.id}.items[${idx}].label`);
              }
              if (it.text && (!trIt.text || !String(trIt.text).trim())) {
                missingFields.push(`${lang}:${card.id}.items[${idx}].text`);
              }
            });
          }
        }
      }
    }
    assert.deepEqual(missingFields, [], `Missing lesson fields:\n${missingFields.join('\n')}`);
  });

  await runTest('8. TPT_GLOSSARY_I18N covers every term and category in pt, es, en', () => {
    const glossary = loaded.TPT_GLOSSARY;
    const glossaryI18n = loaded.TPT_GLOSSARY_I18N;
    assert.ok(Array.isArray(glossary) && glossary.length > 0, 'Glossary must not be empty');

    for (const lang of EXPECTED_LANGS) {
      for (const entry of glossary) {
        if (entry.category) {
          const key = `glossary.categories.${entry.category}`;
          assert.ok(key in flatDicts[lang], `Missing category key ${key} in ${lang}`);
        }
      }
    }

    for (const lang of ['es', 'en']) {
      const bundle = glossaryI18n[lang];
      assert.ok(bundle && typeof bundle === 'object', `Missing ${lang} glossary bundle`);
      for (const entry of glossary) {
        const tr = bundle[entry.term];
        assert.ok(tr, `Missing glossary term "${entry.term}" in ${lang}`);
        assert.ok(
          typeof tr.simple === 'string' && tr.simple.trim().length > 0,
          `Missing simple definition for "${entry.term}" in ${lang}`
        );
      }
    }
  });

  await runTest('9. Anti-XSS static check on js/i18n.js and js/issues.js', () => {
    for (const file of ['js/i18n.js', 'js/issues.js']) {
      const stripped = stripJsComments(readRepoFile(file));
      assert.equal(
        /(innerHTML|outerHTML|insertAdjacentHTML)/.test(stripped),
        false,
        `${file} must not use innerHTML/outerHTML/insertAdjacentHTML`
      );
    }
  });

  await runTest('10. Runtime js/i18n.js tests (detection, persistence, html[lang], DOM, fallback)', () => {
    const titleEl = createMockElement('span', { 'data-i18n': 'header.subtitle' });
    const brandEl = createMockElement('a', { 'data-i18n-aria-label': 'a11y.brandHomeLink' });
    const inputEl = createMockElement('input', { 'data-i18n-placeholder': 'glossary.searchPlaceholder' });
    const tipEl = createMockElement('button', { 'data-i18n-title': 'lessons.copyTitle' });
    const btnPt = createMockElement('button', { 'data-set-lang': 'pt' });
    const btnEs = createMockElement('button', { 'data-set-lang': 'es' });
    const btnEn = createMockElement('button', { 'data-set-lang': 'en' });

    const env = makeDomEnv({
      navLanguage: 'es-MX',
      i18nElements: [titleEl, brandEl, inputEl, tipEl],
      langButtons: [btnPt, btnEs, btnEn],
    });
    const ctx = vm.createContext({
      window: env.windowObj,
      globalThis: env.windowObj,
      self: env.windowObj,
      document: env.windowObj.document,
      localStorage: env.localStorage,
      navigator: env.windowObj.navigator,
      console,
    });

    vm.runInContext(readRepoFile('data/i18n/ui.js'), ctx);
    vm.runInContext(readRepoFile('js/i18n.js'), ctx);
    const i18n = env.windowObj.TPT.i18n;
    assert.deepEqual([...i18n.SUPPORTED_LANGS], EXPECTED_LANGS);

    i18n.init();
    assert.equal(i18n.getLang(), 'es');
    assert.equal(env.docEl.getAttribute('lang'), 'es');
    assert.equal(titleEl.textContent, flatDicts.es['header.subtitle']);
    assert.equal(brandEl.getAttribute('aria-label'), flatDicts.es['a11y.brandHomeLink']);
    assert.equal(inputEl.getAttribute('placeholder'), flatDicts.es['glossary.searchPlaceholder']);
    assert.equal(tipEl.getAttribute('title'), flatDicts.es['lessons.copyTitle']);
    assert.equal(btnEs.getAttribute('aria-pressed'), 'true');
    assert.equal(btnPt.getAttribute('aria-pressed'), 'false');

    const changes = [];
    i18n.onChange((next, prev) => changes.push(`${prev}->${next}`));
    btnEn.dispatchEvent({ type: 'click' });
    assert.equal(i18n.getLang(), 'en');
    assert.equal(env.localStorage.getItem('tpt_lang'), 'en');
    assert.equal(env.docEl.getAttribute('lang'), 'en');
    assert.equal(env.windowObj.document.title, flatDicts.en['meta.title']);
    assert.equal(env.metaDesc.getAttribute('content'), flatDicts.en['meta.description']);
    assert.deepEqual(changes, ['es->en']);

    i18n.setLang('pt');
    assert.equal(env.docEl.getAttribute('lang'), 'pt-BR');

    // Verify fallback from missing es key to pt
    delete env.windowObj.TPT_TRANSLATIONS.es.header.subtitle;
    i18n.setLang('es');
    assert.equal(i18n.t('header.subtitle'), flatDicts.pt['header.subtitle']);
    assert.equal(i18n.t('lessons.lessonLabel', { n: 3 }), 'Clase 3');

    // Unsupported browser language defaults to pt
    const envFr = makeDomEnv({ navLanguage: 'fr-FR' });
    const ctxFr = vm.createContext({
      window: envFr.windowObj,
      globalThis: envFr.windowObj,
      self: envFr.windowObj,
      document: envFr.windowObj.document,
      localStorage: envFr.localStorage,
      navigator: envFr.windowObj.navigator,
      console,
    });
    vm.runInContext(readRepoFile('data/i18n/ui.js'), ctxFr);
    vm.runInContext(readRepoFile('js/i18n.js'), ctxFr);
    envFr.windowObj.TPT.i18n.init();
    assert.equal(envFr.windowObj.TPT.i18n.getLang(), 'pt');
    assert.equal(envFr.docEl.getAttribute('lang'), 'pt-BR');
  });

  await runTest('11. Runtime js/theme.js tests + i18n label sync', () => {
    const env = makeDomEnv({ initialDark: true, navLanguage: 'pt-BR' });
    const ctx = vm.createContext({
      window: env.windowObj,
      globalThis: env.windowObj,
      self: env.windowObj,
      document: env.windowObj.document,
      localStorage: env.localStorage,
      navigator: env.windowObj.navigator,
      console,
    });

    vm.runInContext(readRepoFile('data/i18n/ui.js'), ctx);
    vm.runInContext(readRepoFile('js/i18n.js'), ctx);
    vm.runInContext(readRepoFile('js/theme.js'), ctx);

    env.windowObj.TPT.i18n.init();
    env.windowObj.TPT.theme.init();
    assert.equal(env.windowObj.TPT.theme.getTheme(), 'dark');
    assert.equal(env.toggleBtn.getAttribute('aria-label'), flatDicts.pt['a11y.toggleThemeToLight']);
    assert.equal(env.localStorage.getItem('tpt_theme'), null);

    env.windowObj.TPT.i18n.setLang('en');
    assert.equal(env.toggleBtn.getAttribute('aria-label'), flatDicts.en['a11y.toggleThemeToLight']);
    assert.equal(env.toggleBtn.title, flatDicts.en['a11y.toggleThemeToLight']);

    env.triggerSystemDark(false);
    assert.equal(env.windowObj.TPT.theme.getTheme(), 'light');
    assert.equal(env.toggleBtn.getAttribute('aria-label'), flatDicts.en['a11y.toggleThemeToDark']);

    env.toggleBtn.dispatchEvent({ type: 'click' });
    assert.equal(env.windowObj.TPT.theme.getTheme(), 'dark');
    assert.equal(env.localStorage.getItem('tpt_theme'), 'dark');
    env.triggerSystemDark(false);
    assert.equal(env.windowObj.TPT.theme.getTheme(), 'dark');
  });

  await runTest('12. Runtime js/tasks-api.js localized error messages (pt, es, en)', async () => {
    let mockMode = '429';
    const env = makeDomEnv({ navLanguage: 'pt-BR' });
    const fetchMock = async () => {
      if (mockMode === 'network') throw new Error('ECONNREFUSED');
      if (mockMode === '429') {
        return { ok: false, status: 429, async json() { return {}; } };
      }
      if (mockMode === '403') {
        return { ok: false, status: 403, async json() { return {}; } };
      }
      return { ok: true, status: 200, async json() { return []; } };
    };

    const ctx = vm.createContext({
      window: env.windowObj,
      globalThis: env.windowObj,
      self: env.windowObj,
      document: env.windowObj.document,
      localStorage: env.localStorage,
      navigator: env.windowObj.navigator,
      location: { hostname: 'localhost', protocol: 'http:' },
      fetch: fetchMock,
      URLSearchParams,
      console,
    });

    vm.runInContext(readRepoFile('data/i18n/ui.js'), ctx);
    vm.runInContext(readRepoFile('js/i18n.js'), ctx);
    vm.runInContext(readRepoFile('js/tasks-api.js'), ctx);

    const i18n = env.windowObj.TPT.i18n;
    const api = env.windowObj.TPT.tasksApi;
    i18n.init();

    for (const lang of EXPECTED_LANGS) {
      i18n.setLang(lang);

      mockMode = '429';
      const r429 = await api.createTask({ title: 'Teste erro 429', module: 'python' });
      assert.equal(r429.ok, false);
      assert.equal(r429.message, flatDicts[lang]['tasksApi.errors.rateLimit']);

      mockMode = '403';
      const rPatch403 = await api.updateTask('id-1', { title: 'Outro titulo' });
      assert.equal(rPatch403.message, flatDicts[lang]['tasksApi.errors.editForbidden']);

      const rDel403 = await api.deleteTask('id-1');
      assert.equal(rDel403.message, flatDicts[lang]['tasksApi.errors.deleteForbidden']);

      mockMode = 'network';
      const rNet = await api.updateTask('id-1', { title: 'Outro titulo' });
      assert.equal(rNet.networkError, true);
      assert.equal(rNet.message, flatDicts[lang]['tasksApi.errors.network']);
    }
  });

  await runTest('13. Runtime js/playground.js translateError() coverage across pt, es, en', () => {
    const env = makeDomEnv({ navLanguage: 'pt-BR' });
    const ctx = vm.createContext({
      window: env.windowObj,
      globalThis: env.windowObj,
      self: env.windowObj,
      document: env.windowObj.document,
      localStorage: env.localStorage,
      navigator: env.windowObj.navigator,
      console,
    });

    vm.runInContext(readRepoFile('js/highlight.js'), ctx);
    vm.runInContext(readRepoFile('data/i18n/ui.js'), ctx);
    vm.runInContext(readRepoFile('js/i18n.js'), ctx);
    vm.runInContext(readRepoFile('js/playground.js'), ctx);

    const i18n = env.windowObj.TPT.i18n;
    const pg = env.windowObj.TPT.playground;
    assert.equal(typeof pg.translateError, 'function');
    i18n.init();

    const samples = [
      { type: 'SyntaxError', message: "expected ':'", line: 1, codeLine: 'if True' },
      { type: 'NameError', message: "name 'Print' is not defined", line: 1, codeLine: 'Print("oi")' },
      { type: 'ModuleNotFoundError', message: "No module named 'pandas'", line: 1, codeLine: 'import pandas' },
      { type: 'IndexError', message: 'list index out of range', line: 2, codeLine: 'print(lista[5])' },
      { type: 'ZeroDivisionError', message: 'division by zero', line: 1, codeLine: 'print(10 / 0)' },
    ];

    for (const sample of samples) {
      const resultsByLang = {};
      for (const lang of EXPECTED_LANGS) {
        i18n.setLang(lang);
        const translated = pg.translateError(sample);
        assert.ok(translated.title && translated.title.trim().length > 0);
        assert.ok(translated.explanation && translated.explanation.trim().length > 0);
        assert.ok(translated.tip && translated.tip.trim().length > 0);
        if (sample.type === 'ModuleNotFoundError') {
          assert.ok(translated.explanation.includes('pandas'));
        }
        resultsByLang[lang] = `${translated.title}|${translated.explanation}|${translated.tip}`;
      }
      assert.notEqual(resultsByLang.pt, resultsByLang.es);
      assert.notEqual(resultsByLang.pt, resultsByLang.en);
      assert.notEqual(resultsByLang.es, resultsByLang.en);
    }
  });

  if (failures > 0) {
    console.error(`\nTotal test failures: ${failures}`);
    process.exit(1);
  }
  console.log('\nALL I18N & PLATFORM TESTS PASSED!');
}

main();
