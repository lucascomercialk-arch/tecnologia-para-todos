/* =========================================================
   Tecnologia para Todos — Motor Python (Pyodide) em Web Worker
   ---------------------------------------------------------
   Esta função NÃO roda na página: o playground.js transforma
   ela em texto e cria um Web Worker (via Blob). Assim:
     • o Python roda em segundo plano e a tela nunca trava;
     • o botão "Parar" consegue interromper loops infinitos;
     • funciona no GitHub Pages sem cabeçalhos especiais.

   Como o input() funciona sem travar?
     Antes de executar, o código do aluno é analisado (módulo
     ast do Python). Toda chamada input(...) vira
     "await input(...)" e as funções que usam input viram
     "async def". Assim o Python PAUSA esperando a resposta,
     enquanto o worker continua livre para receber a mensagem
     com o texto digitado no console.

   Protocolo de mensagens
     página → worker: { type: 'run', code } | { type: 'input', value }
     worker → página: status | ready | fatal | stdout | stderr |
                      input-request | system | done
   ========================================================= */

// eslint-disable-next-line no-unused-vars
function TPT_pyWorkerMain(PYODIDE_INDEX_URL) {
  'use strict';

  let pyodide = null;
  let tptRun = null;
  let pendingInput = null;
  const post = (msg) => self.postMessage(msg);

  function makeWriter(type) {
    const decoder = new TextDecoder('utf-8');
    return {
      write(buffer) {
        const text = decoder.decode(buffer, { stream: true });
        if (text) post({ type, text });
        return buffer.length;
      },
    };
  }

  /* ---------- Código Python que prepara e executa o código do aluno ---------- */
  const RUNNER_SOURCE = String.raw`
import ast, sys, json, linecache, traceback, builtins, inspect
import tpt_bridge

FILENAME = "main.py"

try:
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)
except Exception:
    pass


async def _tpt_input(prompt=""):
    """Substitui o input(): mostra a pergunta e espera a resposta do console."""
    text = str(prompt)
    if text:
        sys.stdout.write(text)
    sys.stdout.flush()
    value = await tpt_bridge.request_input(text)
    return str(value)

_tpt_input.__name__ = "input"

_BARRIERS = (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)


def _direct_calls(fn):
    """Nomes chamados diretamente no corpo da função (sem entrar em funções internas)."""
    names = set()
    stack = list(fn.body)
    while stack:
        node = stack.pop()
        if isinstance(node, _BARRIERS):
            continue
        if isinstance(node, ast.Call):
            f = node.func
            if isinstance(f, ast.Name):
                names.add(f.id)
            elif isinstance(f, ast.Attribute):
                names.add(f.attr)
        stack.extend(ast.iter_child_nodes(node))
    return names


class _AsyncTransformer(ast.NodeTransformer):
    def __init__(self, async_names):
        self.async_names = async_names

    def _needs_await(self, call):
        f = call.func
        if isinstance(f, ast.Name):
            return f.id == "input" or f.id in self.async_names
        if isinstance(f, ast.Attribute):
            return f.attr in self.async_names
        return False

    def visit_Call(self, node):
        self.generic_visit(node)
        if self._needs_await(node):
            return ast.copy_location(ast.Await(value=node), node)
        return node

    def visit_FunctionDef(self, node):
        self.generic_visit(node)
        if node.name in self.async_names:
            fields = {f: getattr(node, f) for f in node._fields}
            return ast.copy_location(ast.AsyncFunctionDef(**fields), node)
        return node


def _make_async(tree):
    funcs = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]
    calls = {id(f): _direct_calls(f) for f in funcs}
    async_names = set()
    changed = True
    while changed:
        changed = False
        for f in funcs:
            if f.name in async_names:
                continue
            c = calls[id(f)]
            if "input" in c or (c & async_names):
                async_names.add(f.name)
                changed = True
    tree = _AsyncTransformer(async_names).visit(tree)
    return ast.fix_missing_locations(tree)


def _error_info(exc):
    etype = type(exc).__name__
    try:
        original = traceback.format_exception_only(type(exc), exc)[-1].strip()
    except Exception:
        original = etype + ": " + str(exc)
    line = None
    offset = None
    if isinstance(exc, SyntaxError):
        message = exc.msg or ""
        if exc.filename == FILENAME:
            line = exc.lineno
            offset = exc.offset
    else:
        message = str(exc)
        for fr in traceback.extract_tb(exc.__traceback__):
            if fr.filename == FILENAME:
                line = fr.lineno
    suggestion = None
    if "Did you mean:" in original:
        suggestion = original.split("Did you mean:")[-1].strip(" ?'\"")
    code_line = linecache.getline(FILENAME, line).rstrip("\n") if line else ""
    return {
        "type": etype,
        "message": message,
        "original": original,
        "line": line,
        "offset": offset,
        "codeLine": code_line,
        "suggestion": suggestion,
    }


async def tpt_run(source):
    linecache.cache[FILENAME] = (len(source), None, source.splitlines(True), FILENAME)
    ns = {"__name__": "__main__", "__builtins__": builtins, "input": _tpt_input}
    try:
        tree = ast.parse(source, FILENAME)
        tree = _make_async(tree)
        code = compile(tree, FILENAME, "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
        result = eval(code, ns)
        if inspect.iscoroutine(result):
            await result
        return json.dumps({"ok": True})
    except SystemExit:
        return json.dumps({"ok": True})
    except BaseException as exc:
        return json.dumps({"ok": False, "error": _error_info(exc)})
    finally:
        try:
            sys.stdout.flush()
            sys.stderr.flush()
        except Exception:
            pass
`;

  async function init() {
    try {
      post({ type: 'status', state: 'loading', message: 'Baixando o Python… (só demora na 1ª vez)' });
      importScripts(PYODIDE_INDEX_URL + 'pyodide.js');
      // eslint-disable-next-line no-undef
      pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });
      pyodide.setStdout(makeWriter('stdout'));
      pyodide.setStderr(makeWriter('stderr'));
      pyodide.registerJsModule('tpt_bridge', {
        request_input(prompt) {
          return new Promise((resolve) => {
            pendingInput = resolve;
            post({ type: 'input-request', prompt: String(prompt == null ? '' : prompt) });
          });
        },
      });
      pyodide.runPython(RUNNER_SOURCE);
      tptRun = pyodide.globals.get('tpt_run');
      post({ type: 'ready', version: pyodide.version });
    } catch (err) {
      post({ type: 'fatal', message: String((err && err.message) || err) });
    }
  }

  async function run(code) {
    const t0 = performance.now();
    try {
      // Carrega bibliotecas extras (ex.: numpy) se o código importar alguma.
      try {
        await pyodide.loadPackagesFromImports(code, {
          messageCallback: (m) => post({ type: 'system', text: m }),
          errorCallback: () => {},
        });
      } catch (_) { /* erros de sintaxe são tratados pelo tpt_run */ }

      const json = await tptRun(code);
      const result = JSON.parse(json);
      post({ type: 'done', ok: result.ok, error: result.error || null, elapsed: (performance.now() - t0) / 1000 });
    } catch (err) {
      post({
        type: 'done',
        ok: false,
        elapsed: (performance.now() - t0) / 1000,
        error: { type: 'InternalError', message: String((err && err.message) || err), original: String(err), line: null },
      });
    }
  }

  self.onmessage = (event) => {
    const msg = event.data || {};
    if (msg.type === 'run') {
      if (!tptRun) return post({ type: 'fatal', message: 'O Python ainda não terminou de carregar.' });
      run(String(msg.code || ''));
    } else if (msg.type === 'input') {
      if (pendingInput) {
        const resolve = pendingInput;
        pendingInput = null;
        resolve(String(msg.value == null ? '' : msg.value));
      }
    }
  };

  init();
}
