/* =========================================================
   Tecnologia para Todos — Playground (Monaco + Pyodide)
   ---------------------------------------------------------
   • Editor Monaco com tema azul-marinho (#0A0F24) e cores dos
     slides (amarelo #FACC15 para print/input/len, menta #5EEAD4
     para strings, ciano #7DD3FC para variáveis).
   • Se o CDN do Monaco falhar, usa uma <textarea> automaticamente.
   • Executa o código Python no Web Worker (js/pyodide-worker.js).
   • Suporte nativo a input(): abre uma caixa dentro do Console.
   • Traduz erros do Python para português simples.
   ========================================================= */
(function () {
  'use strict';

  const TPT = (window.TPT = window.TPT || {});

  const MONACO_BASE = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs';
  const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.3/full/';
  const STORAGE_CODE_KEY = 'tpt.playground.code';
  const STORAGE_FONT_KEY = 'tpt.playground.fontSize';

  const FALLBACK_DEFAULT_CODE = `# 👋 Bem-vindo ao Playground de Python!
# Clique em "▶ Rodar Código" (ou aperte Ctrl + Enter) para testar.

nome = input("Qual é o seu nome? ")
pais = input("De qual país você é? ")

print("Olá,", nome, "de", pais + "! Que alegria ter você aqui! 🎉")
`;

  function t(key, vars) {
    return TPT.i18n && typeof TPT.i18n.t === 'function' ? TPT.i18n.t(key, vars) : key;
  }

  function getDefaultCode() {
    const val = t('playground.defaultCode');
    return val && val !== 'playground.defaultCode' ? val : FALLBACK_DEFAULT_CODE;
  }

  let monacoEditor = null;
  let fallbackTextarea = null;
  let monacoReadyPromise = null;
  let errorDecorations = [];
  let fontSize = Number(localStorage.getItem(STORAGE_FONT_KEY)) || 16;

  let worker = null;
  let workerReady = false;
  let workerReadyWaiters = [];
  let isRunning = false;
  let activeInputCleanup = null;
  let lastStatus = { state: 'loading', key: 'playground.statusNotLoaded', vars: null };
  let lastExampleLabel = { key: 'playground.defaultLabel', vars: null };

  const els = {};

  function cacheElements() {
    els.editorHost = document.getElementById('pg-editor');
    els.editorLoading = document.getElementById('pg-editor-loading');
    els.console = document.getElementById('pg-console');
    els.status = document.getElementById('pg-status');
    els.statusText = document.getElementById('pg-status-text');
    els.runBtn = document.getElementById('pg-run');
    els.stopBtn = document.getElementById('pg-stop');
    els.downloadCodeBtn = document.getElementById('pg-download-code');
    els.clearCodeBtn = document.getElementById('pg-clear-code');
    els.clearConsoleBtn = document.getElementById('pg-clear-console');
    els.fontUpBtn = document.getElementById('pg-font-up');
    els.fontDownBtn = document.getElementById('pg-font-down');
    els.exampleLabel = document.getElementById('pg-example-label');
  }

  /* =========================================================
     1. MONACO EDITOR (com tema dos slides + fallback)
     ========================================================= */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Falha ao carregar ' + src));
      document.head.appendChild(s);
    });
  }

  function configureMonacoTheme(monaco) {
    const { KEYWORDS, CONSTANTS, BUILTINS } = TPT.syntax;

    // Tokenizer Python customizado para destacar print/input/len em amarelo (#FACC15)
    monaco.languages.setMonarchTokensProvider('python', {
      defaultToken: '',
      tokenPostfix: '.python',
      keywords: KEYWORDS,
      constants: CONSTANTS,
      builtins: BUILTINS,
      brackets: [
        { open: '{', close: '}', token: 'delimiter.curly' },
        { open: '[', close: ']', token: 'delimiter.bracket' },
        { open: '(', close: ')', token: 'delimiter.parenthesis' },
      ],
      tokenizer: {
        root: [
          { include: '@whitespace' },
          [/@[a-zA-Z_]\w*/, 'tag'],
          [
            /[a-zA-Z_\u00C0-\u024F][\w\u00C0-\u024F]*/,
            {
              cases: {
                '@keywords': 'keyword',
                '@constants': 'constant',
                '@builtins': 'predefined',
                '@default': 'identifier',
              },
            },
          ],
          [/\b\d+\.\d+\b/, 'number.float'],
          [/\b\d+\b/, 'number'],
          [/[fFrRbBuU]{0,2}"""/, 'string', '@tripleDouble'],
          [/[fFrRbBuU]{0,2}'''/, 'string', '@tripleSingle'],
          [/[fFrRbBuU]{0,2}"([^"\\]|\\.)*$/, 'string.invalid'],
          [/[fFrRbBuU]{0,2}'([^'\\]|\\.)*$/, 'string.invalid'],
          [/[fFrRbBuU]{0,2}"/, 'string', '@doubleQuote'],
          [/[fFrRbBuU]{0,2}'/, 'string', '@singleQuote'],
          [/[{}()[\]]/, '@brackets'],
          [/==|!=|<=|>=|\+=|-=|\*=|\/=|\/\/|\*\*|[=+\-*/%<>:.,]/, 'operator'],
        ],
        whitespace: [
          [/\s+/, 'white'],
          [/#.*$/, 'comment'],
        ],
        doubleQuote: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, 'string', '@pop'],
        ],
        singleQuote: [
          [/[^\\']+/, 'string'],
          [/\\./, 'string.escape'],
          [/'/, 'string', '@pop'],
        ],
        tripleDouble: [
          [/[^"]+/, 'string'],
          [/"""/, 'string', '@pop'],
          [/"/, 'string'],
        ],
        tripleSingle: [
          [/[^']+/, 'string'],
          [/'''/, 'string', '@pop'],
          [/'/, 'string'],
        ],
      },
    });

    monaco.editor.defineTheme('tpt-navy', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'E2E8F0', background: '0A0F24' },
        { token: 'keyword', foreground: 'C084FC', fontStyle: 'bold' },
        { token: 'predefined', foreground: 'FACC15', fontStyle: 'bold' }, // print, input, len
        { token: 'constant', foreground: 'FDBA74', fontStyle: 'bold' },
        { token: 'identifier', foreground: '7DD3FC' }, // variáveis em ciano
        { token: 'string', foreground: '5EEAD4' }, // strings em verde-água
        { token: 'string.escape', foreground: 'FDE68A' },
        { token: 'number', foreground: 'FDBA74' },
        { token: 'number.float', foreground: 'FDBA74' },
        { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
        { token: 'operator', foreground: 'F9A8D4' },
        { token: 'delimiter', foreground: 'CBD5E1' },
      ],
      colors: {
        'editor.background': '#0A0F24',
        'editor.foreground': '#E2E8F0',
        'editor.lineHighlightBackground': '#131C42',
        'editor.selectionBackground': '#263875',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#FACC15',
        'editorCursor.foreground': '#FACC15',
        'editorIndentGuide.background1': '#1A2347',
        'editorIndentGuide.activeBackground1': '#334155',
        'editorGutter.background': '#0A0F24',
      },
    });
  }

  function ensureEditor(initialCode) {
    if (monacoReadyPromise) return monacoReadyPromise;

    const startCode = initialCode || localStorage.getItem(STORAGE_CODE_KEY) || getDefaultCode();

    monacoReadyPromise = (async () => {
      try {
        window.MonacoEnvironment = {
          getWorkerUrl: function () {
            const blob = new Blob(
              [`self.MonacoEnvironment = { baseUrl: '${MONACO_BASE}/' }; importScripts('${MONACO_BASE}/base/worker/workerMain.js');`],
              { type: 'text/javascript' }
            );
            return URL.createObjectURL(blob);
          },
        };

        if (!window.require) {
          await loadScript(MONACO_BASE + '/loader.js');
        }

        const monaco = await new Promise((resolve, reject) => {
          window.require.config({ paths: { vs: MONACO_BASE } });
          window.require(['vs/editor/editor.main'], resolve, reject);
        });

        configureMonacoTheme(monaco);
        if (els.editorLoading) els.editorLoading.remove();

        monacoEditor = monaco.editor.create(els.editorHost, {
          value: startCode,
          language: 'python',
          theme: 'tpt-navy',
          fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
          fontSize: fontSize,
          lineHeight: 26,
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 16, bottom: 16 },
          tabSize: 4,
          insertSpaces: true,
          roundedSelection: true,
          renderLineHighlight: 'all',
          glyphMargin: true,
          wordWrap: 'on',
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        });

        // Atalho Ctrl/Cmd + Enter para rodar
        monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
          runCode();
        });

        monacoEditor.onDidChangeModelContent(() => {
          clearErrorHighlight();
          try {
            localStorage.setItem(STORAGE_CODE_KEY, monacoEditor.getValue());
          } catch (_) {}
        });
      } catch (err) {
        // Fallback: se o CDN do Monaco falhar, usa uma textarea estilizada
        console.warn('Monaco não carregou, usando editor simples:', err);
        if (els.editorLoading) els.editorLoading.remove();
        fallbackTextarea = document.createElement('textarea');
        fallbackTextarea.className = 'fallback-editor';
        fallbackTextarea.spellcheck = false;
        fallbackTextarea.value = startCode;
        fallbackTextarea.style.fontSize = fontSize + 'px';
        fallbackTextarea.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runCode();
          } else if (e.key === 'Tab') {
            e.preventDefault();
            const start = fallbackTextarea.selectionStart;
            const end = fallbackTextarea.selectionEnd;
            fallbackTextarea.setRangeText('    ', start, end, 'end');
          }
        });
        fallbackTextarea.addEventListener('input', () => {
          try {
            localStorage.setItem(STORAGE_CODE_KEY, fallbackTextarea.value);
          } catch (_) {}
        });
        els.editorHost.appendChild(fallbackTextarea);
      }
    })();

    return monacoReadyPromise;
  }

  function getCode() {
    if (monacoEditor) return monacoEditor.getValue();
    if (fallbackTextarea) return fallbackTextarea.value;
    return localStorage.getItem(STORAGE_CODE_KEY) || getDefaultCode();
  }

  function setExampleLabel(key, vars) {
    lastExampleLabel = { key, vars: vars || null };
    if (els.exampleLabel) {
      els.exampleLabel.textContent = t(key, vars);
    }
  }

  async function setCode(code, title) {
    try {
      localStorage.setItem(STORAGE_CODE_KEY, code);
    } catch (_) {}
    await ensureEditor(code);
    clearErrorHighlight();
    if (monacoEditor) {
      monacoEditor.setValue(code);
      monacoEditor.setScrollTop(0);
      monacoEditor.focus();
    } else if (fallbackTextarea) {
      fallbackTextarea.value = code;
      fallbackTextarea.focus();
    }
    if (title) {
      setExampleLabel('playground.loadedExampleLabel', { title });
    } else {
      setExampleLabel('playground.defaultLabel');
    }
    if (els.runBtn) {
      els.runBtn.classList.add('pulse');
      setTimeout(() => els.runBtn && els.runBtn.classList.remove('pulse'), 3600);
    }
  }

  function highlightErrorLine(line) {
    if (!monacoEditor || !window.monaco || !line) return;
    errorDecorations = monacoEditor.deltaDecorations(errorDecorations, [
      {
        range: new window.monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'monaco-error-line',
          glyphMarginClassName: 'monaco-error-glyph',
        },
      },
    ]);
  }

  function clearErrorHighlight() {
    if (monacoEditor && errorDecorations.length) {
      errorDecorations = monacoEditor.deltaDecorations(errorDecorations, []);
    }
  }

  function changeFontSize(delta) {
    fontSize = Math.min(24, Math.max(12, fontSize + delta));
    try {
      localStorage.setItem(STORAGE_FONT_KEY, String(fontSize));
    } catch (_) {}
    if (monacoEditor) monacoEditor.updateOptions({ fontSize });
    if (fallbackTextarea) fallbackTextarea.style.fontSize = fontSize + 'px';
    if (els.console) els.console.style.fontSize = Math.max(13, fontSize - 1) + 'px';
  }

  async function downloadCode() {
    await ensureEditor();
    const code = getCode();
    const filename = 'meu_programa.py';
    const blob = new Blob([code], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setExampleLabel('playground.downloadedLabel', { filename });
    if (typeof TPT.showToast === 'function') {
      TPT.showToast(t('playground.downloadedToast', { filename }));
    }
  }

  /* =========================================================
     2. MOTOR PYTHON (Pyodide Worker)
     ========================================================= */
  function setStatus(state, keyOrText, vars) {
    if (!els.status || !els.statusText) return;
    lastStatus = { state, key: keyOrText, vars: vars || null };
    els.status.className = 'status-pill status-' + state;
    const translated = t(keyOrText, vars);
    els.statusText.textContent = translated;
  }

  function ensureWorker() {
    if (worker) return Promise.resolve();
    return new Promise((resolve) => {
      workerReadyWaiters.push(resolve);
      setStatus('loading', 'playground.statusLoading');

      const workerSource = `(${window.TPT_pyWorkerMain.toString()})(${JSON.stringify(PYODIDE_INDEX_URL)});`;
      const blob = new Blob([workerSource], { type: 'application/javascript' });
      worker = new Worker(URL.createObjectURL(blob));

      worker.onmessage = (event) => handleWorkerMessage(event.data || {});
      worker.onerror = (err) => {
        setStatus('error', 'playground.statusStartError');
        appendSystem(t('playground.loadPythonError'), 'warn');
        console.error(err);
      };
    });
  }

  function waitForWorkerReady() {
    if (workerReady) return Promise.resolve();
    ensureWorker();
    return new Promise((resolve) => workerReadyWaiters.push(resolve));
  }

  function handleWorkerMessage(msg) {
    switch (msg.type) {
      case 'status': {
        const key = msg.state === 'loading' ? 'playground.statusWorkerDownloading' : (msg.message || 'playground.statusLoading');
        setStatus(msg.state || 'loading', key);
        break;
      }
      case 'ready': {
        workerReady = true;
        setStatus('ready', 'playground.statusReady', { version: msg.version || '' });
        const waiters = workerReadyWaiters.splice(0);
        waiters.forEach((fn) => fn());
        break;
      }
      case 'fatal':
        setStatus('error', 'playground.statusFailed');
        appendSystem('⚠️ ' + (msg.message || t('playground.loadPythonError')), 'warn');
        setRunningUI(false);
        break;
      case 'stdout':
        appendStream(msg.text, 's-stdout');
        break;
      case 'stderr':
        appendStream(msg.text, 's-stderr');
        break;
      case 'system':
        appendSystem(msg.text);
        break;
      case 'input-request':
        showInlineInput();
        break;
      case 'done':
        finishRun(msg);
        break;
    }
  }

  /* =========================================================
     3. CONSOLE + INPUT() INTERATIVO
     ========================================================= */
  function clearConsole() {
    if (activeInputCleanup) activeInputCleanup();
    if (els.console) els.console.innerHTML = '';
  }

  function scrollConsoleToEnd() {
    if (!els.console) return;
    els.console.scrollTop = els.console.scrollHeight;
  }

  function appendStream(text, cls) {
    if (!els.console || !text) return;
    const last = els.console.lastElementChild;
    if (last && last.classList && last.classList.contains(cls)) {
      last.textContent += text;
    } else {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      els.console.appendChild(span);
    }
    scrollConsoleToEnd();
  }

  function appendSystem(text, variant) {
    if (!els.console) return;
    const div = document.createElement('div');
    div.className = 'console-sys' + (variant ? ' ' + variant : '');
    div.textContent = text;
    els.console.appendChild(div);
    scrollConsoleToEnd();
  }

  /** Abre uma caixa de texto dentro do console quando o Python chama input() */
  function showInlineInput() {
    if (!els.console) return;
    if (activeInputCleanup) activeInputCleanup();

    setStatus('input', 'playground.statusInput');

    const wrap = document.createElement('span');
    wrap.className = 'console-input-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'console-input';
    input.placeholder = t('playground.inputPlaceholder');
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', t('playground.inputAria'));

    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'console-input-send';
    sendBtn.textContent = t('playground.inputSendBtn');

    wrap.appendChild(input);
    wrap.appendChild(sendBtn);
    els.console.appendChild(wrap);
    scrollConsoleToEnd();
    setTimeout(() => input.focus(), 10);

    let submitted = false;
    const submit = () => {
      if (submitted) return;
      submitted = true;
      const value = input.value;
      const echo = document.createElement('span');
      echo.className = 'console-echo';
      echo.textContent = value + '\n';
      wrap.replaceWith(echo);
      activeInputCleanup = null;
      setStatus('running', 'playground.statusRunning');
      if (worker) worker.postMessage({ type: 'input', value });
      scrollConsoleToEnd();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
    sendBtn.addEventListener('click', submit);

    activeInputCleanup = () => {
      submitted = true;
      if (wrap.parentNode) wrap.remove();
      activeInputCleanup = null;
    };
  }

  /* =========================================================
     4. TRADUTOR DE ERROS DO PYTHON PARA LINGUAGEM SIMPLES
     ========================================================= */
  function translateError(err) {
    const type = (err && err.type) || 'Error';
    const msg = (err && err.message) || '';
    const line = err && err.line;
    const codeLine = (err && err.codeLine) || '';
    const trimmed = codeLine.trim();

    let title = t('playground.errors.defaultTitle');
    let explanation = t('playground.errors.defaultExplanation');
    let tip = t('playground.errors.defaultTip');

    if (type === 'SyntaxError') {
      title = t('playground.errors.syntaxTitle');
      if (/unterminated string|EOL while scanning string/i.test(msg)) {
        explanation = t('playground.errors.syntaxQuotes');
        tip = t('playground.errors.syntaxQuotesTip');
      } else if (/was never closed|\('\s*was never closed/i.test(msg) || /unexpected EOF/i.test(msg)) {
        explanation = t('playground.errors.syntaxParen');
        tip = t('playground.errors.syntaxParenTip');
      } else if (/expected ':'/i.test(msg) || (/^(if|elif|else|for|while|def)\b/.test(trimmed) && !trimmed.endsWith(':'))) {
        explanation = t('playground.errors.syntaxColon');
        tip = t('playground.errors.syntaxColonTip');
      } else if (/cannot assign to literal|cannot assign to/i.test(msg) || (/^if\b/.test(trimmed) && /[^=!<>]=[^=]/.test(trimmed))) {
        explanation = t('playground.errors.syntaxAssign');
        tip = t('playground.errors.syntaxAssignTip');
      } else {
        explanation = t('playground.errors.syntaxGeneric');
        tip = t('playground.errors.syntaxGenericTip');
      }
    } else if (type === 'IndentationError' || type === 'TabError') {
      title = t('playground.errors.indentTitle');
      explanation = t('playground.errors.indentExplanation');
      tip = t('playground.errors.indentTip');
    } else if (type === 'NameError') {
      const m = msg.match(/name '([^']+)' is not defined/);
      const name = m ? m[1] : '';
      title = t('playground.errors.nameTitle', { name: name ? `: "${name}"` : '' });
      if (name && ['Print', 'Input', 'If', 'Else', 'Elif', 'For', 'While', 'Len', 'Int', 'Float'].includes(name)) {
        explanation = t('playground.errors.nameCapitalExplanation', { name });
        tip = t('playground.errors.nameCapitalTip', { name, lower: name.toLowerCase() });
      } else if (name && ['true', 'false', 'none'].includes(name)) {
        const cap = name.charAt(0).toUpperCase() + name.slice(1);
        explanation = t('playground.errors.nameBoolExplanation', { cap });
        tip = t('playground.errors.nameBoolTip', { name, cap });
      } else {
        const displayName = name || t('playground.errors.nameFallback');
        explanation = t('playground.errors.nameUnknownExplanation', { name: displayName });
        tip = err.suggestion
          ? t('playground.errors.nameUnknownTipSuggest', { suggestion: err.suggestion, name })
          : t('playground.errors.nameUnknownTipGeneric', { name });
      }
    } else if (type === 'TypeError') {
      title = t('playground.errors.typeTitle');
      if (/can only concatenate str|unsupported operand type\(s\) for \+/i.test(msg)) {
        explanation = t('playground.errors.typeConcatExplanation');
        tip = t('playground.errors.typeConcatTip');
      } else if (/not callable/i.test(msg)) {
        explanation = t('playground.errors.typeCallableExplanation');
        tip = t('playground.errors.typeCallableTip');
      } else {
        explanation = t('playground.errors.typeGenericExplanation');
        tip = t('playground.errors.typeGenericTip');
      }
    } else if (type === 'ValueError') {
      title = t('playground.errors.valueTitle');
      if (/invalid literal for int/i.test(msg)) {
        explanation = t('playground.errors.valueIntExplanation');
        tip = t('playground.errors.valueIntTip');
      } else if (/could not convert string to float/i.test(msg)) {
        explanation = t('playground.errors.valueFloatExplanation');
        tip = t('playground.errors.valueFloatTip');
      } else if (/list\.remove\(x\): x not in list/i.test(msg)) {
        explanation = t('playground.errors.valueRemoveExplanation');
        tip = t('playground.errors.valueRemoveTip');
      } else {
        explanation = t('playground.errors.valueGenericExplanation');
      }
    } else if (type === 'IndexError') {
      title = t('playground.errors.indexTitle');
      explanation = t('playground.errors.indexExplanation');
      tip = t('playground.errors.indexTip');
    } else if (type === 'ZeroDivisionError') {
      title = t('playground.errors.zeroTitle');
      explanation = t('playground.errors.zeroExplanation');
      tip = t('playground.errors.zeroTip');
    } else if (type === 'AttributeError') {
      title = t('playground.errors.attrTitle');
      explanation = t('playground.errors.attrExplanation');
      tip = t('playground.errors.attrTip');
    } else if (type === 'ModuleNotFoundError' || type === 'ImportError') {
      const m = msg.match(/No module named '([^']+)'/);
      const mod = m ? m[1] : '';
      title = t('playground.errors.importTitle');
      explanation = mod
        ? t('playground.errors.importModuleExplanation', { mod })
        : t('playground.errors.importGenericExplanation');
      tip = t('playground.errors.importTip');
    }

    return { title, explanation, tip, line, codeLine, original: err.original || `${type}: ${msg}` };
  }

  function renderFriendlyError(err) {
    if (!els.console) return;
    const info = translateError(err);
    const { escapeHtml } = TPT.syntax;

    if (info.line) highlightErrorLine(info.line);

    const card = document.createElement('div');
    card.className = 'err-card';
    card.innerHTML = `
      <div class="err-card-head">
        <span aria-hidden="true">🐞</span>
        <span>${escapeHtml(info.title)}</span>
        ${info.line ? `<span class="err-line-badge">${escapeHtml(t('playground.errors.lineBadge', { line: info.line }))}</span>` : ''}
      </div>
      <div class="err-card-body">
        <p>${escapeHtml(info.explanation)}</p>
        ${info.codeLine ? `<div class="err-code"><span class="ln">${info.line || ''}</span>${escapeHtml(info.codeLine)}</div>` : ''}
        <div class="err-tip">💡 <strong>${escapeHtml(t('playground.errors.tipLabel'))}</strong> ${escapeHtml(info.tip)}</div>
        <div class="err-original">${escapeHtml(t('playground.errors.originalLabel'))} ${escapeHtml(info.original)}</div>
      </div>
    `;
    els.console.appendChild(card);
    scrollConsoleToEnd();
  }

  /* =========================================================
     5. RODAR E PARAR CÓDIGO
     ========================================================= */
  function setRunningUI(running) {
    isRunning = running;
    if (els.runBtn) els.runBtn.disabled = running;
    if (els.stopBtn) els.stopBtn.classList.toggle('hidden', !running);
  }

  async function runCode() {
    if (isRunning) return;
    await ensureEditor();
    const code = getCode();

    clearConsole();
    clearErrorHighlight();

    if (!code.trim()) {
      appendSystem(t('playground.emptyEditorWarn'), 'warn');
      return;
    }

    setRunningUI(true);
    const head = document.createElement('span');
    head.className = 'console-run-head';
    head.textContent = t('playground.runningHead');
    els.console.appendChild(head);

    if (!workerReady) {
      appendSystem(t('playground.preparingPython'));
    }
    await waitForWorkerReady();
    if (!isRunning) return; // caso o usuário tenha clicado em Parar enquanto carregava

    setStatus('running', 'playground.statusRunning');
    worker.postMessage({ type: 'run', code });
  }

  function finishRun(msg) {
    if (activeInputCleanup) activeInputCleanup();
    setRunningUI(false);

    const secs = typeof msg.elapsed === 'number' ? msg.elapsed.toFixed(2).replace('.', ',') : null;
    if (msg.ok) {
      setStatus('ready', 'playground.statusReadyShort');
      const timeSuffix = secs ? t('playground.finishedTime', { secs }) : '';
      appendSystem(t('playground.finishedOk', { time: timeSuffix }), 'ok');
    } else {
      setStatus('error', 'playground.statusCodeError');
      if (msg.error) renderFriendlyError(msg.error);
    }
  }

  function stopCode() {
    if (activeInputCleanup) activeInputCleanup();
    if (worker) {
      worker.terminate();
      worker = null;
      workerReady = false;
      workerReadyWaiters = [];
    }
    setRunningUI(false);
    setStatus('error', 'playground.statusStopped');
    appendSystem(t('playground.stoppedWarn'), 'warn');
    ensureWorker();
  }

  /* =========================================================
     6. INICIALIZAÇÃO DO PLAYGROUND
     ========================================================= */
  function init() {
    cacheElements();
    if (!els.editorHost) return;

    els.runBtn.addEventListener('click', runCode);
    els.stopBtn.addEventListener('click', stopCode);
    if (els.downloadCodeBtn) {
      els.downloadCodeBtn.addEventListener('click', downloadCode);
    }
    els.clearConsoleBtn.addEventListener('click', () => {
      clearConsole();
      appendSystem(t('playground.consoleCleared'));
    });
    els.clearCodeBtn.addEventListener('click', async () => {
      await ensureEditor();
      clearErrorHighlight();
      if (monacoEditor) {
        monacoEditor.setValue('');
        monacoEditor.focus();
      } else if (fallbackTextarea) {
        fallbackTextarea.value = '';
        fallbackTextarea.focus();
      }
      setExampleLabel('playground.editorClearedLabel');
    });
    els.fontUpBtn.addEventListener('click', () => changeFontSize(2));
    els.fontDownBtn.addEventListener('click', () => changeFontSize(-2));

    // Clicar na área vazia do console foca o input se houver um aberto
    els.console.addEventListener('click', () => {
      const inp = els.console.querySelector('.console-input');
      if (inp) inp.focus();
    });

    if (TPT.i18n && typeof TPT.i18n.onChange === 'function') {
      TPT.i18n.onChange(() => {
        setStatus(lastStatus.state, lastStatus.key, lastStatus.vars);
        setExampleLabel(lastExampleLabel.key, lastExampleLabel.vars);
      });
    }
  }

  /** Chamado quando a aba Playground é aberta */
  function onActivate() {
    ensureEditor();
    ensureWorker();
    setTimeout(() => {
      if (monacoEditor) monacoEditor.layout();
    }, 50);
  }

  TPT.playground = { init, onActivate, setCode, getCode, downloadCode, runCode, stopCode, ensureWorker };
})();
