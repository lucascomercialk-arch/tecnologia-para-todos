'use strict';

const TAILWIND_SHIM_JS = `
window.tailwind = window.tailwind || {};
(function () {
  var style = document.createElement('style');
  style.setAttribute('data-tpt-test-shim', '1');
  style.textContent = [
    '*,*::before,*::after{box-sizing:border-box}',
    'html,body{margin:0;padding:0;max-width:100%;overflow-x:hidden}',
    '.hidden{display:none!important}',
    '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
    '.flex{display:flex}',
    '.inline-flex{display:inline-flex}',
    '.grid{display:grid}',
    '.block{display:block}',
    '.flex-col{flex-direction:column}',
    '.flex-wrap{flex-wrap:wrap}',
    '.items-center{align-items:center}',
    '.justify-between{justify-content:space-between}',
    '.w-full{width:100%}',
    '.max-w-7xl{max-width:80rem;margin-left:auto;margin-right:auto}',
    '.mx-auto{margin-left:auto;margin-right:auto}',
    '.overflow-x-auto{max-width:100%;overflow-x:auto}',
    '.relative{position:relative}',
    '.absolute{position:absolute}',
    '.inset-0{inset:0}',
    'img,svg,pre{max-width:100%}',
  ].join('\\n');
  (document.head || document.documentElement).appendChild(style);
})();
`;

const MOCK_PY_WORKER_JS = `
window.TPT_pyWorkerMain = function TPT_pyWorkerMain() {
  'use strict';
  var post = function (msg) { self.postMessage(msg); };
  var pendingInput = null;
  var aliveInterval = null;

  function stripQuotes(s) {
    var t = s.trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    return null;
  }

  function splitArgs(raw) {
    var args = [];
    var cur = '';
    var quote = null;
    for (var i = 0; i < raw.length; i += 1) {
      var ch = raw[i];
      if (quote) {
        cur += ch;
        if (ch === quote && raw[i - 1] !== '\\\\') quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
        cur += ch;
      } else if (ch === ',') {
        if (cur.trim()) args.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur.trim()) args.push(cur.trim());
    return args;
  }

  function evalExpr(expr, vars) {
    var trimmed = expr.trim();
    var q = stripQuotes(trimmed);
    if (q !== null) return q;
    if (Object.prototype.hasOwnProperty.call(vars, trimmed)) return String(vars[trimmed]);
    if (trimmed.indexOf('+') !== -1) {
      return trimmed.split('+').map(function (p) { return evalExpr(p, vars); }).join('');
    }
    return trimmed;
  }

  function requestInput(prompt) {
    return new Promise(function (resolve) {
      pendingInput = resolve;
      post({ type: 'input-request', prompt: String(prompt || '') });
    });
  }

  async function runCode(code) {
    var t0 = performance.now();
    var text = String(code || '');

    if (text.indexOf('import modulo_inexistente') !== -1) {
      post({
        type: 'done',
        ok: false,
        elapsed: (performance.now() - t0) / 1000,
        error: {
          type: 'ModuleNotFoundError',
          message: "No module named 'modulo_inexistente'",
          original: "ModuleNotFoundError: No module named 'modulo_inexistente'",
          line: 1,
          codeLine: 'import modulo_inexistente',
        },
      });
      return;
    }

    if (/^\\s*if\\s+True\\s*$/m.test(text) || text.indexOf('SYNTAX_ERR') !== -1) {
      post({
        type: 'done',
        ok: false,
        elapsed: (performance.now() - t0) / 1000,
        error: {
          type: 'SyntaxError',
          message: "expected ':'",
          original: "SyntaxError: expected ':'",
          line: 1,
          codeLine: 'if True',
        },
      });
      return;
    }

    if (text.indexOf('while True:') !== -1) {
      post({ type: 'stdout', text: 'Executando loop infinito...\\n' });
      aliveInterval = setInterval(function () {}, 5000);
      return;
    }

    var vars = {};
    var lines = text.split(/\\r?\\n/);
    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      var inputMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*input\\((.*)\\)$/);
      if (inputMatch) {
        var varName = inputMatch[1];
        var promptText = evalExpr(inputMatch[2], vars);
        if (promptText) post({ type: 'stdout', text: promptText });
        var answer = await requestInput(promptText);
        vars[varName] = answer;
        continue;
      }

      var printMatch = line.match(/^print\\((.*)\\)$/);
      if (printMatch) {
        var parts = splitArgs(printMatch[1]).map(function (arg) {
          return evalExpr(arg, vars);
        });
        post({ type: 'stdout', text: parts.join(' ') + '\\n' });
      }
    }

    post({ type: 'done', ok: true, elapsed: Math.max(0.05, (performance.now() - t0) / 1000) });
  }

  self.onmessage = function (event) {
    var msg = event.data || {};
    if (msg.type === 'run') {
      runCode(msg.code);
    } else if (msg.type === 'input') {
      if (pendingInput) {
        var resolve = pendingInput;
        pendingInput = null;
        resolve(String(msg.value == null ? '' : msg.value));
      }
    }
  };

  post({ type: 'status', state: 'loading', messageKey: 'playground.statusWorkerDownloading' });
  setTimeout(function () {
    post({ type: 'ready', version: '0.27.3-mock' });
  }, 15);
};
`;

async function setupOfflineSafeRoutes(page, { mockWorker = true } = {}) {
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
  await page.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/monaco-editor[@/]/, (route) => route.abort());
  await page.route(/^https:\/\/cdn\.tailwindcss\.com/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: TAILWIND_SHIM_JS,
    })
  );

  if (mockWorker) {
    await page.route('**/js/pyodide-worker.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: MOCK_PY_WORKER_JS,
      })
    );
  }
}

async function mockTasksApi(page, initialTasks = []) {
  const state = {
    getMode: 'online',
    createMode: 'online',
    updateMode: 'online',
    deleteMode: 'online',
    nextId: 100,
    tasks: initialTasks.map((t) => ({ ...t })),
    requests: [],
  };

  await page.route('**/api/tasks**', async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    const url = new URL(req.url());
    state.requests.push({ method, pathname: url.pathname, search: url.search });

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Client-Id,X-Admin-Key',
    };

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (method === 'GET') {
      if (state.getMode === 'offline') {
        await route.abort('failed');
        return;
      }
      if (state.getMode === 'http500') {
        await route.fulfill({
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ detail: 'Internal Server Error' }),
        });
        return;
      }

      const mod = (url.searchParams.get('module') || '').trim().toLowerCase();
      const st = (url.searchParams.get('status') || '').trim().toLowerCase();
      const filtered = state.tasks.filter((item) => {
        if (mod && String(item.module || '').toLowerCase() !== mod) return false;
        if (st && String(item.status || '').toLowerCase() !== st) return false;
        return true;
      });
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(filtered),
      });
      return;
    }

    if (method === 'POST') {
      if (state.createMode === 'offline') {
        await route.abort('failed');
        return;
      }
      if (state.createMode === 'http429') {
        await route.fulfill({
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        return;
      }
      if (state.createMode === 'http503') {
        await route.fulfill({
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ detail: 'Service Unavailable' }),
        });
        return;
      }

      const body = req.postDataJSON() || {};
      state.nextId += 1;
      const now = new Date().toISOString();
      const created = {
        id: `srv-${state.nextId}`,
        title: body.title || '',
        description: body.description || '',
        module: body.module || 'melhorias',
        priority: body.priority || 'normal',
        status: 'pending',
        github_issue_number: state.nextId,
        github_issue_url: `https://github.com/lucascomercialk-arch/tecnologia-para-todos/issues/${state.nextId}`,
        created_at: now,
        updated_at: now,
      };
      state.tasks.unshift(created);
      await route.fulfill({
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(created),
      });
      return;
    }

    const idMatch = url.pathname.match(/\/api\/tasks\/([^/]+)$/);
    const taskId = idMatch ? decodeURIComponent(idMatch[1]) : null;

    if (method === 'PATCH') {
      if (state.updateMode === 'offline') {
        await route.abort('failed');
        return;
      }
      if (state.updateMode === 'http403') {
        await route.fulfill({
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        return;
      }

      const body = req.postDataJSON() || {};
      const existing = state.tasks.find((t) => t.id === taskId);
      if (!existing) {
        await route.fulfill({ status: 404, headers: corsHeaders, body: '{}' });
        return;
      }
      Object.assign(existing, body, { updated_at: new Date().toISOString() });
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(existing),
      });
      return;
    }

    if (method === 'DELETE') {
      if (state.deleteMode === 'offline') {
        await route.abort('failed');
        return;
      }
      if (state.deleteMode === 'http403') {
        await route.fulfill({
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        return;
      }

      state.tasks = state.tasks.filter((t) => t.id !== taskId);
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.continue();
  });

  return state;
}

module.exports = {
  setupOfflineSafeRoutes,
  mockTasksApi,
};
