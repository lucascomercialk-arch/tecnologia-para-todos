# 💻 Tecnologia para Todos — Plataforma Interativa de Ensino

> **Aprenda programação do zero, sem complicação e direto no navegador.**

🔗 **Acesse a plataforma online:** [lucascomercialk-arch.github.io/tecnologia-para-todos](https://lucascomercialk-arch.github.io/tecnologia-para-todos/#inicio)

Uma plataforma educacional gratuita, aberta e sem atritos técnicos, criada para tornar o ensino de lógica e programação acessível para iniciantes — sem a necessidade de instalar editores pesados, configurar ambientes ou lidar com telas complexas.

---

## 💡 A História e Motivação

Este é um **projeto pessoal desenvolvido em paralelo** por mim, **Lucas Rafael Kammer**, mas que nasceu de uma experiência real em sala de aula.

Durante a minha atuação como voluntário no projeto **"Tecnologia para Todos"** (iniciativa da Católica SC em Jaraguá do Sul), tive a oportunidade de ministrar aulas de **Python básico** para pessoas migrantes da nossa cidade. Preparando os materiais e acompanhando os alunos na prática, percebi duas grandes barreiras para quem está começando:
1. O excesso de termos técnicos em inglês sem tradução conceitual clara.
2. A dificuldade de configurar ambientes de desenvolvimento (VS Code, interpretadores, terminal) antes mesmo de entender o que é uma variável ou um laço de repetição.

A partir dessa vivência, decidi construir esta plataforma web: um espaço visual, acolhedor e interativo onde os alunos (e qualquer pessoa curiosa por tecnologia) possam revisar os conteúdos das aulas, consultar um glossário simplificado e executar códigos reais direto do navegador.

---

## ✨ Funcionalidades Principais

* **🏠 Início & Propósito:** Apresentação da iniciativa, da motivação educacional e da proposta aberta da plataforma.
* **📘 Trilha de Aulas (Cards Didáticos):** Conteúdos divididos em blocos curtos e visuais (inspirados nos slides reais das aulas), com exemplos práticos e botão rápido para testar o código na hora.
* **📖 Glossário de Palavras:** Dicionário descomplicado que traduz termos como `print()`, `variável`, `input()`, `lista`, `for` e `while` para a linguagem do dia a dia.
* **🌍 Suporte Multilíngue (PT / ES / EN):** Toda a interface, aulas, glossário e mensagens de erro do Python disponíveis em Português, Español e English, com detecção automática e troca instantânea no cabeçalho (documentação de manutenção em [docs/I18N.md](docs/I18N.md)).
* **🌙 Modo Claro e Modo Escuro:** Alternância acessível entre tema claro e escuro com preservação em `localStorage` (`tpt_theme`) e detecção automática de `prefers-color-scheme`.
* **⚡ Playground Interativo (Estilo VS Code):**
  * Editor de código completo no navegador com destaque de sintaxe e numeração de linhas (**Monaco Editor**).
  * Execução real de Python 100% no navegador via WebAssembly (**Pyodide**), dispensando servidores backend.
  * **Suporte interativo a `input()`:** Permite que o aluno digite respostas diretamente no console da página, possibilitando exercícios dinâmicos (como listas de compras, calculadoras e jogos de adivinhação).
* **💡 Melhorias & Bugs (Tasks sincronizadas):** Aba para alunos e visitantes enviarem sugestões ou relatarem bugs com fila offline (`localStorage`), cache de leitura e integração com um backend leve em FastAPI + SQLite (`tpt-tasks-api/`) que abre automaticamente Issues no GitHub.

---

## 🛠️ Tecnologias Utilizadas

* **Frontend:** HTML5, Tailwind CSS e JavaScript (Vanilla Modular)
* **Editor de Código:** [Monaco Editor](https://microsoft.github.io/monaco-editor/)
* **Interpretador Python Client-Side:** [Pyodide (WebAssembly)](https://pyodide.org/)
* **Backend opcional de Tasks (`tpt-tasks-api/`):** Python 3, FastAPI, Uvicorn, SQLite (`WAL`) e integração com GitHub Issues — veja [tpt-tasks-api/README.md](tpt-tasks-api/README.md) para deploy no servidor Linux.
* **Testes automatizados e CI:** suíte de internacionalização ([tests/i18n.test.cjs](tests/i18n.test.cjs)), testes unitários com **Vitest** ([tests/unit/](tests/unit/)) e testes E2E cross-browser/mobile com **Playwright** ([tests/e2e/](tests/e2e/)), integrados ao GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)).
* **Hospedagem:** GitHub Pages

---

## 🧪 Testes Automatizados

Com **Node.js 20+** instalado:

```bash
npm ci
npm run check:syntax
npm test
npx playwright install chromium firefox webkit
npm run test:e2e
```

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para a lista completa de scripts (`test:i18n`, `test:unit`, `test:e2e:chromium`, `test:all`) e [docs/I18N.md](docs/I18N.md) para o guia de internacionalização.

---

## 🗺️ Próximos Passos (Roadmap)

- [x] Estrutura base com identidade visual acolhedora e acessível
- [x] Playground Python integrado com suporte a `input()`
- [x] Conteúdos iniciais: Aula 1 (Fundamentos) e Aula 2 (Listas e Repetições)
- [x] Modo bilíngue/multilíngue (PT, ES e EN) em toda a plataforma
- [x] Modo escuro completo com persistência e respeito a `prefers-color-scheme`
- [ ] Expansão da trilha de Python (Funções e Dicionários)
- [ ] Suporte modular para novas linguagens (HTML/CSS e JavaScript)

---

## 👨‍💻 Autor

Desenvolvido com propósito por **Lucas Rafael Kammer**  
Estudante de Desenvolvimento de Software • Jaraguá do Sul, SC

---

*Projeto aberto para fins educacionais. Acesse [lucascomercialk-arch.github.io/tecnologia-para-todos](https://lucascomercialk-arch.github.io/tecnologia-para-todos/#inicio), explore e compartilhe com quem está dando os primeiros passos na programação!*
