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

  const DEFAULT_CODE = `# 👋 Bem-vindo ao Playground de Python!
# Clique em "▶ Rodar Código" (ou aperte Ctrl + Enter) para testar.

nome = input("Qual é o seu nome? ")
pais = input("De qual país você é? ")

print("Olá,", nome, "de", pais + "! Que alegria ter você aqui! 🎉")
`;

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

    const startCode = initialCode || localStorage.getItem(STORAGE_CODE_KEY) || DEFAULT_CODE;

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
    return localStorage.getItem(STORAGE_CODE_KEY) || DEFAULT_CODE;
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
    if (els.exampleLabel) {
      els.exampleLabel.textContent = title
        ? `Exemplo carregado: ${title} — clique em ▶ Rodar Código!`
        : 'Escreva seu código e clique em ▶ Rodar Código.';
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

    if (els.exampleLabel) {
      els.exampleLabel.textContent = `💾 Arquivo "${filename}" baixado com o código atual do editor!`;
    }
    if (typeof TPT.showToast === 'function') {
      TPT.showToast(`💾 Código baixado como ${filename}!`);
    }
  }

  /* =========================================================
     2. MOTOR PYTHON (Pyodide Worker)
     ========================================================= */
  function setStatus(state, text) {
    if (!els.status || !els.statusText) return;
    els.status.className = 'status-pill status-' + state;
    els.statusText.textContent = text;
  }

  function ensureWorker() {
    if (worker) return Promise.resolve();
    return new Promise((resolve) => {
      workerReadyWaiters.push(resolve);
      setStatus('loading', 'Carregando o Python…');

      const workerSource = `(${window.TPT_pyWorkerMain.toString()})(${JSON.stringify(PYODIDE_INDEX_URL)});`;
      const blob = new Blob([workerSource], { type: 'application/javascript' });
      worker = new Worker(URL.createObjectURL(blob));

      worker.onmessage = (event) => handleWorkerMessage(event.data || {});
      worker.onerror = (err) => {
        setStatus('error', 'Erro ao iniciar o Python');
        appendSystem('⚠️ Não foi possível carregar o Python. Verifique sua internet e recarregue a página.', 'warn');
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
      case 'status':
        setStatus(msg.state || 'loading', msg.message || 'Carregando…');
        break;
      case 'ready': {
        workerReady = true;
        setStatus('ready', `Python ${msg.version || ''} pronto ✓`.trim());
        const waiters = workerReadyWaiters.splice(0);
        waiters.forEach((fn) => fn());
        break;
      }
      case 'fatal':
        setStatus('error', 'Falha no Python');
        appendSystem('⚠️ ' + (msg.message || 'Erro ao carregar o Python.'), 'warn');
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

    setStatus('input', '⌨️ Digite no console e aperte Enter');

    const wrap = document.createElement('span');
    wrap.className = 'console-input-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'console-input';
    input.placeholder = 'digite aqui e aperte Enter…';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Digite a resposta para o programa e aperte Enter');

    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'console-input-send';
    sendBtn.textContent = 'Enviar ↵';

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
      setStatus('running', 'Executando…');
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
     4. TRADUTOR DE ERROS DO PYTHON PARA PORTUGUÊS SIMPLES
     ========================================================= */
  function translateError(err) {
    const type = (err && err.type) || 'Error';
    const msg = (err && err.message) || '';
    const line = err && err.line;
    const codeLine = (err && err.codeLine) || '';
    const trimmed = codeLine.trim();

    let title = 'Ops! O Python encontrou um problema';
    let explanation = 'Confira a linha indicada e tente novamente.';
    let tip = 'Compare o seu código com o exemplo da aula.';

    if (type === 'SyntaxError') {
      title = 'Erro de escrita (SyntaxError)';
      if (/unterminated string|EOL while scanning string/i.test(msg)) {
        explanation = 'Você abriu aspas, mas esqueceu de fechar no final do texto.';
        tip = 'Todo texto precisa começar e terminar com aspas: "assim".';
      } else if (/was never closed|\('\s*was never closed/i.test(msg) || /unexpected EOF/i.test(msg)) {
        explanation = 'Um parêntese ( ) ou colchete [ ] foi aberto, mas não foi fechado.';
        tip = 'Conte os parênteses: para cada ( precisa existir um ).';
      } else if (/expected ':'/i.test(msg) || (/^(if|elif|else|for|while|def)\b/.test(trimmed) && !trimmed.endsWith(':'))) {
        explanation = 'Faltaram os dois pontos ( : ) no final desta linha.';
        tip = 'Linhas com if, elif, else, for e while sempre terminam com :';
      } else if (/cannot assign to literal|cannot assign to/i.test(msg) || (/^if\b/.test(trimmed) && /[^=!<>]=[^=]/.test(trimmed))) {
        explanation = 'Você usou um sinal = só dentro de uma comparação, ou tentou guardar valor em algo que não é variável.';
        tip = 'Um = guarda valor. Para comparar dois valores no if/while, use dois: ==';
      } else {
        explanation = 'O Python não conseguiu ler esta linha porque falta ou sobra algum símbolo.';
        tip = 'Veja se há aspas, parênteses ( ), vírgulas ou dois pontos : faltando.';
      }
    } else if (type === 'IndentationError' || type === 'TabError') {
      title = 'Erro nos espaços do início da linha (IndentationError)';
      explanation = 'As linhas dentro de um if, else, for ou while precisam começar com 4 espaços.';
      tip = 'Use a tecla Tab (ou 4 espaços) nas linhas que ficam “dentro” do bloco.';
    } else if (type === 'NameError') {
      const m = msg.match(/name '([^']+)' is not defined/);
      const name = m ? m[1] : '';
      title = `Nome desconhecido${name ? `: "${name}"` : ''} (NameError)`;
      if (name && ['Print', 'Input', 'If', 'Else', 'Elif', 'For', 'While', 'Len', 'Int', 'Float'].includes(name)) {
        explanation = `Você escreveu "${name}" com letra maiúscula, mas os comandos do Python são em minúsculas.`;
        tip = `Troque "${name}" por "${name.toLowerCase()}".`;
      } else if (name && ['true', 'false', 'none'].includes(name)) {
        const cap = name.charAt(0).toUpperCase() + name.slice(1);
        explanation = `No Python, ${cap} começa com a primeira letra maiúscula.`;
        tip = `Troque "${name}" por "${cap}".`;
      } else {
        explanation = `O Python não conhece "${name || 'esse nome'}". Pode ser uma variável que ainda não foi criada, um erro de digitação ou um texto sem aspas.`;
        tip = err.suggestion
          ? `Você quis dizer "${err.suggestion}"? Se era um texto, coloque entre aspas: "${name}".`
          : `Se "${name}" for um texto, coloque entre aspas: "${name}". Se for variável, crie ela antes com =.`;
      }
    } else if (type === 'TypeError') {
      title = 'Tipos misturados (TypeError)';
      if (/can only concatenate str|unsupported operand type\(s\) for \+/i.test(msg)) {
        explanation = 'Você tentou somar/juntar um texto (str) com um número (int ou float).';
        tip = 'Para fazer conta com input(), use int(input(...)) ou float(input(...)). Para mostrar vários itens no print, separe com vírgula.';
      } else if (/not callable/i.test(msg)) {
        explanation = 'Você usou parênteses ( ) depois de algo que não é uma função (ou criou uma variável chamada print/input).';
        tip = 'Verifique se você não escreveu print = ... sem querer.';
      } else {
        explanation = 'Uma função ou conta recebeu um tipo de valor diferente do esperado.';
        tip = 'Confira se você não misturou textos com números.';
      }
    } else if (type === 'ValueError') {
      title = 'Valor inválido (ValueError)';
      if (/invalid literal for int/i.test(msg)) {
        explanation = 'O int() tentou transformar em número inteiro algo que não é inteiro (como letras, vazio ou número com ponto/vírgula).';
        tip = 'Digite apenas números inteiros (ex.: 25) ou use float() para números com ponto (ex.: 5.50).';
      } else if (/could not convert string to float/i.test(msg)) {
        explanation = 'O float() não conseguiu transformar o texto em número decimal.';
        tip = 'Em Python, números decimais usam ponto e não vírgula: escreva 5.50 em vez de 5,50.';
      } else if (/list\.remove\(x\): x not in list/i.test(msg)) {
        explanation = 'Você tentou remover um item com remove(), mas ele não está na lista.';
        tip = 'Antes de remover, confira com: if item in lista:';
      } else {
        explanation = 'O valor passado não serve para esta operação.';
      }
    } else if (type === 'IndexError') {
      title = 'Posição fora da lista (IndexError)';
      explanation = 'Você pediu um índice [posição] que não existe na lista.';
      tip = 'Lembre-se: a contagem começa no 0! Uma lista com 3 itens tem posições 0, 1 e 2.';
    } else if (type === 'ZeroDivisionError') {
      title = 'Divisão por zero (ZeroDivisionError)';
      explanation = 'Na matemática e no Python, não é possível dividir um número por 0.';
      tip = 'Confira se a variável depois da barra / não está valendo 0.';
    } else if (type === 'AttributeError') {
      title = 'Comando não existe para este tipo (AttributeError)';
      explanation = 'Você usou um comando com ponto (como .append) em algo que não tem esse comando.';
      tip = 'append() e remove() funcionam em listas [ ]. Confira o nome da variável e a grafia.';
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
        ${info.line ? `<span class="err-line-badge">Linha ${info.line}</span>` : ''}
      </div>
      <div class="err-card-body">
        <p>${escapeHtml(info.explanation)}</p>
        ${info.codeLine ? `<div class="err-code"><span class="ln">${info.line || ''}</span>${escapeHtml(info.codeLine)}</div>` : ''}
        <div class="err-tip">💡 <strong>Dica:</strong> ${escapeHtml(info.tip)}</div>
        <div class="err-original">Mensagem original do Python: ${escapeHtml(info.original)}</div>
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
      appendSystem('✏️ O editor está vazio. Escreva um comando, por exemplo: print("Olá!")', 'warn');
      return;
    }

    setRunningUI(true);
    const head = document.createElement('span');
    head.className = 'console-run-head';
    head.textContent = '▶ Executando main.py…';
    els.console.appendChild(head);

    if (!workerReady) {
      appendSystem('⏳ Preparando o Python no navegador (só na primeira vez)…');
    }
    await waitForWorkerReady();
    if (!isRunning) return; // caso o usuário tenha clicado em Parar enquanto carregava

    setStatus('running', 'Executando…');
    worker.postMessage({ type: 'run', code });
  }

  function finishRun(msg) {
    if (activeInputCleanup) activeInputCleanup();
    setRunningUI(false);

    const secs = typeof msg.elapsed === 'number' ? msg.elapsed.toFixed(2).replace('.', ',') : null;
    if (msg.ok) {
      setStatus('ready', 'Pronto ✓');
      appendSystem(`✓ Programa finalizado${secs ? ` em ${secs}s` : ''}.`, 'ok');
    } else {
      setStatus('error', 'Erro no código');
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
    setStatus('error', 'Interrompido');
    appendSystem('⏹ Execução interrompida pelo usuário. O Python será reiniciado na próxima execução.', 'warn');
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
      appendSystem('Console limpo. Clique em ▶ Rodar Código para executar novamente.');
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
      if (els.exampleLabel) {
        els.exampleLabel.textContent = 'Editor limpo. Escreva seu código e clique em ▶ Rodar Código.';
      }
    });
    els.fontUpBtn.addEventListener('click', () => changeFontSize(2));
    els.fontDownBtn.addEventListener('click', () => changeFontSize(-2));

    // Clicar na área vazia do console foca o input se houver um aberto
    els.console.addEventListener('click', () => {
      const inp = els.console.querySelector('.console-input');
      if (inp) inp.focus();
    });
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
