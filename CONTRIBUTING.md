# 🤝 Guia de Contribuição — Tecnologia para Todos

Obrigado pelo interesse em contribuir com o **Tecnologia para Todos**! Este documento reúne a estrutura do projeto e os comandos para rodar e validar os testes automatizados localmente.

---

## 1. Estrutura Principal do Frontend

| Caminho | Descrição |
| :--- | :--- |
| `index.html` | Estrutura principal em abas (`Início`, `Trilha de Aulas`, `Glossário`, `Playground`, `Melhorias & Bugs`) |
| `css/styles.css` | Estilos customizados e paleta completa para modo claro/escuro (`html[data-theme="dark"]`) |
| `data/lessons.js` | Conteúdo base (Português) das aulas e cards da trilha |
| `data/glossary.js` | Termos base e exemplos do glossário |
| `data/i18n/` | Catálogo central `ui.js` e traduções `ES`/`EN` de aulas e glossário (`docs/I18N.md`) |
| `js/app.js` | Navegação entre abas, renderização das aulas e glossário |
| `js/i18n.js` e `js/theme.js` | Motor de idiomas (`tpt_lang`) e gerenciador de tema claro/escuro (`tpt_theme`) |
| `js/playground.js` e `js/pyodide-worker.js` | Editor Monaco/fallback, Web Worker Pyodide (`input()` e `time.sleep()` assíncronos) e tradutor de erros |
| `js/issues.js` e `js/tasks-api.js` | Aba Melhorias & Bugs, fila offline (`tpt_pending_sync`), cache e integração com `tpt-tasks-api/` |
| `tests/` | Suíte de internacionalização (`tests/i18n.test.cjs`), testes unitários (`tests/unit/`) e E2E (`tests/e2e/`) |

---

## 2. Pré-requisitos e Instalação

- **Node.js 20+** e **npm**
- **Python 3** (opcional para o subconjunto Python de `tests/unit/pyodide-worker.test.js` e para o backend `tpt-tasks-api/`)

Na raiz do repositório:

```bash
npm ci
npx playwright install chromium firefox webkit
```

*(No Windows com PowerShell restrito por `ExecutionPolicy`, use `npm.cmd` e `npx.cmd`.)*

---

## 3. Comandos de Teste

| Comando | O que executa |
| :--- | :--- |
| `npm run check:syntax` | Valida a sintaxe JavaScript (`node --check`) de todos os módulos e do servidor estático de teste |
| `npm run test:i18n` | Valida paridade `pt`/`es`/`en`, placeholders `{var}`, atributos HTML, aulas, glossário, Anti-XSS e runtime de i18n/tema (`tests/i18n.test.cjs`) |
| `npm run test:unit` | Executa os testes unitários isolados com **Vitest** (`tests/unit/`: `tasks-api`, `playground-errors`, `highlightPython` e protocolo/`RUNNER_SOURCE` do `pyodide-worker`) |
| `npm test` | Executa `test:i18n` + `test:unit` em sequência |
| `npm run test:e2e` | Sobe o servidor estático local (`tests/e2e/static-server.cjs`) e roda a suíte **Playwright** em Desktop Chrome, Desktop Firefox, Desktop Safari (WebKit) e Mobile Chrome |
| `npm run test:e2e:chromium` | Atalho rápido para rodar os fluxos E2E apenas em Chromium Desktop + Mobile Chrome |
| `npm run test:all` | Executa sintaxe, i18n, unitários e E2E completos |

### O que a suíte E2E cobre (`tests/e2e/`)
- Carregamento inicial sem erros JavaScript nem overflow horizontal (desktop e mobile).
- Alternância entre tema claro/escuro (`#theme-toggle`), persistência em `localStorage` e detecção via `prefers-color-scheme`.
- Troca dinâmica de idiomas (`PT`, `ES`, `EN`), atualização de `<html lang="...">` e detecção por `navigator.language`.
- Navegação entre Aulas 1, 2 e 3, marcação de progresso, carregamento no Playground e filtros/busca no Glossário.
- Execução de código no Playground, prompt interativo de `input()`, tradução de erros ao vivo, botão `Parar`, ajuste de fonte e download `.py` localizado.
- Aba de Melhorias & Bugs: criação/edição/exclusão segura (Anti-XSS), erros da API (`429`, `403`, `500` com fallback em cache), enfileiramento offline em `localStorage` e sincronização ao reconectar.

> **Observação sobre mocks no E2E:** os testes em `tests/e2e/` interceptam CDNs externos (Tailwind, Google Fonts, Monaco Editor), a API `/api/tasks` e o worker do Pyodide para rodar de forma determinística, rápida e offline em ambiente limpo/CI.

---

## 4. Diretrizes ao Enviar um Pull Request

1. Sempre adicione ou atualize os testes unitários/E2E correspondentes à sua alteração.
2. Para qualquer mudança em textos visíveis, aulas ou glossário, siga o fluxo em [docs/I18N.md](docs/I18N.md).
3. Nunca utilize `innerHTML` para inserir conteúdo de usuários ou da API (mantenha `textContent` e `createElement`).
4. Garanta que `npm run check:syntax`, `npm test` e `npm run test:e2e` estejam passando antes de abrir o PR.
