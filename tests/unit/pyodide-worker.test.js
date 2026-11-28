import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { readRepoFile } from './vm-env.js';

function findPythonBinary() {
  for (const cmd of ['python3', 'python']) {
    const check = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (!check.error && check.status === 0) return cmd;
  }
  return null;
}

describe('pyodide-worker protocolo JS', () => {
  it('gerencia init, status, ready, fatal pre-ready, stdout, input(), sleep() e done', async () => {
    const source = readRepoFile('js/pyodide-worker.js');
    const posted = [];
    let stdoutWriter = null;
    let stderrWriter = null;
    let bridgeModule = null;

    const fakePyodide = {
      version: '0.27.3',
      setStdout(w) {
        stdoutWriter = w;
      },
      setStderr(w) {
        stderrWriter = w;
      },
      registerJsModule(name, mod) {
        if (name === 'tpt_bridge') bridgeModule = mod;
      },
      runPython() {},
      globals: {
        get() {
          return async (code) => {
            stdoutWriter.write(new TextEncoder().encode(`run:${code}`));
            stderrWriter.write(new TextEncoder().encode('warn'));
            return JSON.stringify({ ok: true });
          };
        },
      },
      async loadPackagesFromImports() {},
    };

    let resolveInit = null;
    const initDone = new Promise((r) => {
      resolveInit = r;
    });

    const selfMock = {
      postMessage(msg) {
        posted.push(msg);
        if (msg.type === 'ready') resolveInit();
      },
      onmessage: null,
    };

    const ctx = vm.createContext({
      self: selfMock,
      importScripts() {},
      loadPyodide: async () => fakePyodide,
      performance: { now: () => 100 },
      TextDecoder,
      setTimeout,
      clearTimeout,
      console,
    });

    vm.runInContext(`${source}\nTPT_pyWorkerMain('https://example.test/');`, ctx);

    // Antes do ready, rodar retorna fatal com messageKey
    selfMock.onmessage({ data: { type: 'run', code: 'print(1)' } });
    expect(posted.some((m) => m.type === 'fatal' && m.messageKey === 'playground.workerNotReady')).toBe(true);

    await initDone;
    expect(posted[0]).toMatchObject({
      type: 'status',
      state: 'loading',
      messageKey: 'playground.statusWorkerDownloading',
    });
    expect(posted.some((m) => m.type === 'ready' && m.version === '0.27.3')).toBe(true);

    // Bridge de input()
    const inputPromise = bridgeModule.request_input('Nome? ');
    const inputReq = posted.find((m) => m.type === 'input-request');
    expect(inputReq).toEqual({ type: 'input-request', prompt: 'Nome? ' });
    selfMock.onmessage({ data: { type: 'input', value: 'Lucas' } });
    await expect(inputPromise).resolves.toBe('Lucas');

    // Bridge de sleep()
    await expect(bridgeModule.sleep(0.01)).resolves.toBeUndefined();

    // Execução via run
    selfMock.onmessage({ data: { type: 'run', code: 'print(42)' } });
    await new Promise((r) => setTimeout(r, 20));
    expect(posted).toContainEqual({ type: 'stdout', text: 'run:print(42)' });
    expect(posted).toContainEqual({ type: 'stderr', text: 'warn' });
    expect(posted.some((m) => m.type === 'done' && m.ok === true)).toBe(true);
  });
});

describe('RUNNER_SOURCE AST e execução Python (time.sleep, input, bibliotecas)', () => {
  const pythonCmd = findPythonBinary();
  const maybeIt = pythonCmd ? it : it.skip;

  maybeIt('executa transformações AST de sleep/input e bibliotecas básicas no Python', () => {
    const js = readRepoFile('js/pyodide-worker.js');
    const match = js.match(/const RUNNER_SOURCE = String\.raw`([\s\S]*?)`;/);
    expect(match).not.toBeNull();
    const runnerSource = match[1];

    const pythonTestHarness = `
import asyncio, io, json, sys, types

sleep_calls = []
mock_bridge = types.ModuleType("tpt_bridge")

async def mock_sleep(secs):
    sleep_calls.append(secs)
    await asyncio.sleep(0)

async def mock_input(prompt):
    return "Maria"

mock_bridge.sleep = mock_sleep
mock_bridge.request_input = mock_input
sys.modules["tpt_bridge"] = mock_bridge

ns = {}
exec(${JSON.stringify(runnerSource)}, ns)
tpt_run = ns["tpt_run"]

async def check():
    out = io.StringIO()
    old_out = sys.stdout
    sys.stdout = out
    try:
        # 1. import time + time.sleep
        sleep_calls.clear()
        r1 = json.loads(await tpt_run("import time\\ntime.sleep(0.2)"))
        assert r1["ok"] is True and sleep_calls == [0.2], (r1, sleep_calls)

        # 2. from time import sleep inside def
        sleep_calls.clear()
        r2 = json.loads(await tpt_run("from time import sleep\\ndef f():\\n    sleep(0.3)\\nf()"))
        assert r2["ok"] is True and sleep_calls == [0.3], (r2, sleep_calls)

        # 3. user-defined sleep without importing time stays synchronous
        sleep_calls.clear()
        r3 = json.loads(await tpt_run("def sleep():\\n    return 99\\nassert sleep() == 99"))
        assert r3["ok"] is True and sleep_calls == [], (r3, sleep_calls)

        # 4. random + math + datetime + input()
        r4 = json.loads(await tpt_run(
            "import random, math, datetime\\n"
            "nome = input('Nome: ')\\n"
            "print(nome, random.randint(1, 6), int(math.sqrt(16)), datetime.datetime.now().year >= 2026)"
        ))
        assert r4["ok"] is True, r4
        assert "Maria" in out.getvalue()

        # 5. negative sleep raises ValueError
        r5 = json.loads(await tpt_run("import time\\ntime.sleep(-1)"))
        assert r5["ok"] is False and r5["error"]["type"] == "ValueError", r5

        # 6. ModuleNotFoundError reported with line number
        r6 = json.loads(await tpt_run("import modulo_inexistente_xyz"))
        assert r6["ok"] is False and r6["error"]["type"] == "ModuleNotFoundError", r6
        assert r6["error"]["line"] == 1
    finally:
        sys.stdout = old_out

asyncio.run(check())
print("PYTHON_RUNNER_OK")
`;

    const res = spawnSync(pythonCmd, ['-c', pythonTestHarness], { encoding: 'utf8' });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('PYTHON_RUNNER_OK');
  });
});
