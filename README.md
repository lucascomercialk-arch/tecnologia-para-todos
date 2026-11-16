# 🐍 Tecnologia para Todos

> 🚀 **Projeto Educacional Aberto • Feito para Iniciantes**  
> Aprenda programação do zero, sem complicação e direto no navegador.

Aplicação web estática, gratuita e 100% client-side criada por **Lucas Rafael Kammer** (Jaraguá do Sul — SC), inspirada na experiência em sala de aula no projeto voluntário *Tecnologia para Todos* (Católica SC). Pronta para publicação gratuita no **GitHub Pages**.

---

## ✨ O que a aplicação tem

1. **🏠 Página Inicial (Home)**
   - **Hero Section:** apresentação de impacto com prévia interativa de código e botões para a Trilha de Aulas e para o Playground.
   - **Por que esta plataforma existe?** + 3 Cards de Pilares (*Trilha Visual*, *Glossário Sem Mistério* e *Prática Instantânea*).
   - **Quem está por trás:** história de origem do projeto.
   - **Chamada final** para começar a programar.
2. **📘 Trilha de Aulas (Cards Didáticos)**
   - **Aula 1 — Primeiros Passos:** `print()`, comentários `#`, variáveis (`str`, `int`, `float`), `input()`, conversão com `int()`/`float()`, decisões (`if`, `elif`, `else`, `and`, `or`), Desafio 1 e Mini Projeto **Conversor de Moeda**.
   - **Aula 2 — Listas e Repetições:** listas `[ ]`, índices `[0]` e `[-1]`, `append()`, `remove()`, `len()`, `in`, laços `for` + `range()`, `while`, Desafio 2 e Mini Projeto **Lista de Compras** (versão passo a passo e versão turbo com menu interativo).
   - Cada card traz **bloco de código azul-marinho (`#0A0F24`)** com sintaxe destacada, **saída esperada**, **dica curta** e o botão **"▶ Testar no Playground"**.
3. **📖 Glossário de Palavras**
   - Busca instantânea e filtro por categoria (`Comandos`, `Variáveis`, `Decisões`, `Listas`, `Repetição`, `Geral`).
   - Explicação em português simples + tradução rápida dos termos em **espanhol 🇪🇸, inglês 🇬🇧 e francês 🇫🇷**.
4. **💻 Playground de Python (Split-Screen)**
   - **Esquerda:** **Monaco Editor** (o mesmo motor do VS Code) com tema escuro azul-marinho, numeração de linhas, ajuste de tamanho da fonte (`A−` / `A+`) e atalho `Ctrl + Enter`.
   - **Direita:** **Console interativo** executando Python real via **Pyodide (WebAssembly)** dentro de um *Web Worker*.
   - **Suporte nativo a `input()` sem travar a tela:** chamadas `input()` abrem uma caixa de texto diretamente dentro do Console para o aluno digitar em tempo real, e o botão **⏹ Parar** interrompe loops infinitos na hora.
   - **Erros traduzidos:** `SyntaxError`, `IndentationError`, `NameError`, `TypeError`, `ValueError`, `IndexError` e `ZeroDivisionError` são explicados em português acessível com dica de como corrigir.
5. **💡 Melhorias & Bugs (Issues numeradas `#1`, `#2`, `#3`…)**
   - Qualquer pessoa pode registrar uma sugestão de melhoria, nova aula ou relatar um bug de forma simples.
   - Cada task criada recebe automaticamente um número sequencial (`#1`, `#2`, `#3`…), pode receber apoios (`👍`), ser filtrada por status/tipo, marcada como resolvida e copiada em **Markdown (`.md`)** com 1 clique.

---

## 📁 Estrutura de Arquivos

```text
tecnologia-para-todos/
├── index.html              # Estrutura principal e configuração do Design System (Tailwind CDN)
├── css/
│   └── styles.css          # Tema dos blocos de código, console, input inline e animações
├── data/
│   ├── lessons.js          # Conteúdo completo das Aulas 1 e 2
│   └── glossary.js         # Termos do Glossário com exemplos e traduções
├── js/
│   ├── highlight.js        # Realce de sintaxe Python para os cards e tema do Monaco
│   ├── pyodide-worker.js   # Web Worker com Pyodide + suporte assíncrono a input()
│   ├── playground.js       # Integração Monaco Editor + Console + tradutor de erros
│   └── app.js              # Navegação por abas, renderização das aulas e busca do glossário
├── .nojekyll               # Garante que o GitHub Pages sirva todos os arquivos sem processamento Jekyll
└── README.md               # Este guia
```

---

## 🚀 Como publicar gratuitamente no GitHub Pages

### Opção 1 — Pelo site do GitHub (sem instalar nada)

1. Crie uma conta (ou entre) em [github.com](https://github.com).
2. Clique no botão **`+`** (canto superior direito) → **New repository**.
3. Em **Repository name**, digite `tecnologia-para-todos`.
4. Marque **Public** e clique em **Create repository**.
5. Na página criada, clique em **uploading an existing file** e arraste todos os arquivos e pastas deste projeto (`index.html`, `css/`, `data/`, `js/`, `README.md`, `.nojekyll`).
6. Clique em **Commit changes**.
7. No topo do repositório, abra **Settings** → no menu lateral esquerdo clique em **Pages**.
8. Em **Build and deployment → Source**, deixe **Deploy from a branch**.
9. Em **Branch**, selecione **`main`** e a pasta **`/ (root)`** → clique em **Save**.
10. Aguarde cerca de 1 minuto e recarregue a página: o link do seu site estará no topo, no formato:
    ```text
    https://SEU-USUARIO.github.io/tecnologia-para-todos/
    ```

### Opção 2 — Pelo terminal com Git

```bash
cd tecnologia-para-todos
git init
git branch -M main
git add .
git commit -m "Primeira versão - Tecnologia para Todos"
git remote add origin https://github.com/SEU-USUARIO/tecnologia-para-todos.git
git push -u origin main
```

Depois, ative o GitHub Pages em **Settings → Pages → Branch: `main` / `(root)`**.

---

## 💻 Como rodar no seu computador

Como os scripts são carregados de forma clássica (sem exigir empacotador), você pode:

- **Abrir direto:** dar dois cliques no arquivo `index.html`; ou
- **Usar um servidor local** (recomendado):
  ```bash
  python -m http.server 8000
  ```
  e acessar `http://localhost:8000` no navegador.

> **Nota:** É necessário estar conectado à internet na primeira abertura para baixar as fontes, o Tailwind CSS, o Monaco Editor e o Pyodide via CDN.

---

## ✏️ Como adicionar a Aula 3 (ou novos termos no Glossário)

- **Nova aula:** abra `data/lessons.js` e adicione um novo objeto ao array `window.TPT_LESSONS`. O seletor de aulas e a navegação "Próxima aula" aparecem automaticamente.
- **Nova palavra no glossário:** abra `data/glossary.js` e adicione um item ao array `window.TPT_GLOSSARY`.
