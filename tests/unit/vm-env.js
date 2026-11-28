import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '..', '..');

export function readRepoFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

export function createStorage() {
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

export function createBrowserContext(files, extraGlobals = {}) {
  const localStorage = createStorage();
  const docElAttrs = new Map();
  const docEl = {
    setAttribute(k, v) {
      docElAttrs.set(k, String(v));
    },
    getAttribute(k) {
      return docElAttrs.has(k) ? docElAttrs.get(k) : null;
    },
    classList: { toggle() {} },
  };
  const document = {
    documentElement: docEl,
    title: '',
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    getElementById() {
      return null;
    },
  };
  const windowObj = {
    TPT: {},
    localStorage,
    document,
    navigator: { language: 'pt-BR', languages: ['pt-BR'] },
    addEventListener() {},
  };
  windowObj.window = windowObj;
  windowObj.self = windowObj;
  windowObj.globalThis = windowObj;

  const ctx = vm.createContext({
    window: windowObj,
    globalThis: windowObj,
    self: windowObj,
    document,
    localStorage,
    navigator: windowObj.navigator,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
    ...extraGlobals,
  });

  for (const rel of files) {
    vm.runInContext(readRepoFile(rel), ctx, { filename: rel });
  }

  return { ctx, windowObj, localStorage, docEl };
}
