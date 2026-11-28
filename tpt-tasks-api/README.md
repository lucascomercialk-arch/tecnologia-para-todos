# 🛠️ Tecnologia para Todos — Tasks API (`tpt-tasks-api`)

Backend leve e endurecido em **FastAPI + SQLite (WAL)** para centralizar as tasks e melhorias da plataforma **Tecnologia para Todos** e abrir/fechar automaticamente as Issues correspondentes no GitHub (`lucascomercialk-arch/tecnologia-para-todos`).

---

## 📋 Funcionalidades & Segurança

- **Persistência resiliente:** SQLite nativo com `PRAGMA journal_mode=WAL;`, `foreign_keys=ON`, `CHECK` constraints de domínio/tamanho e permissão `0600` em sistemas POSIX.
- **Privacidade:** `owner_id` nunca é exposto no `GET /api/tasks` nem nos retornos de `POST`/`PATCH`.
- **Validação na inicialização (*fail-fast*):** em `APP_ENV=production`, a API exige `ADMIN_KEY` forte (`>= 24` caracteres), proíbe curinga `*` e exige origens `https://` em `CORS_ORIGINS` (desativando `/docs`, `/redoc` e `/openapi.json`).
- **Controle de propriedade:** apenas o navegador criador (`X-Client-Id` validado) pode editar título/descrição/módulo/prioridade ou excluir sua própria task; alterações de `status` exigem `X-Admin-Key` (comparação em tempo constante via `secrets.compare_digest`).
- **Anti-abuso e limites:**
  - limite de tamanho de corpo da requisição (`MAX_REQUEST_BODY_BYTES`, HTTP `413`);
  - rate limit de criações (`RATE_LIMIT_MAX` por IP e `X-Client-Id`, HTTP `429` + `Retry-After`) com extração confiável de IP (cabeçalhos de proxy aceitos somente quando `TRUST_PROXY_HEADERS=true` e peer local/privado);
  - rate limit de mutações e bloqueio temporário contra força bruta em `X-Admin-Key` (`ADMIN_FAIL_LIMIT_MAX`);
  - schema estrito com Pydantic `extra="forbid"` e rejeição de caracteres de controle;
  - paginação em `GET /api/tasks` (`limit` 1..200 e `offset` >= 0).
- **Observabilidade e respostas seguras:** logs estruturados JSON (`logging_utils.py`) com redação automática de tokens/segredos (`[REDACTED]`), headers de segurança (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control`, `X-Request-Id`) e contrato uniforme de erros sem vazar tracebacks internos.
- **Automação com GitHub Issues (`BackgroundTasks`):** timeout de transporte e retry único em falhas transitórias de rede, sanitização do título e validação de `html_url` antes de salvar no SQLite.

---

## 🔧 Variáveis de Ambiente (`.env.example`)

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `APP_ENV` | `development` | Ambiente: `development`, `test` ou `production` |
| `PORT` | `3050` | Porta HTTP (`1` a `65535`) |
| `DB_PATH` | `tpt_tasks.db` | Caminho do arquivo SQLite (ou `:memory:` em testes) |
| `ADMIN_KEY` | *(auto em dev)* | Chave administrativa (`X-Admin-Key`); obrigatória (`>= 24` chars) em produção |
| `AUTO_WRITE_ENV` | `true` em dev / `false` em prod | Salva `ADMIN_KEY` gerada no `.env` em desenvolvimento |
| `GITHUB_TOKEN` | vazio | Personal Access Token fine-grained (Issues: Read and write) |
| `GITHUB_REPO` | `lucascomercialk-arch/tecnologia-para-todos` | Repositório alvo no formato `dono/repositorio` |
| `CORS_ORIGINS` | apenas GH Pages em prod | Origens permitidas separadas por vírgula (sem `*`; exige `https://` em produção) |
| `EXTRA_CORS_ORIGINS` | vazio | Origens extras adicionadas às origens padrão |
| `TRUST_PROXY_HEADERS` | `false` | Habilite (`true`) apenas atrás de proxy local/privado confiável |
| `RATE_LIMIT_MAX` | `5` | Máximo de criações por janela (`POST /api/tasks`) |
| `RATE_LIMIT_WINDOW_SECONDS` | `3600` | Janela em segundos dos limites |
| `MUTATION_RATE_LIMIT_MAX` | `30` | Máximo de `PATCH`/`DELETE` por IP por janela |
| `ADMIN_FAIL_LIMIT_MAX` | `10` | Tentativas inválidas de `X-Admin-Key` antes de bloquear (`429`) |
| `ADMIN_FAIL_WINDOW_SECONDS` | `900` | Janela do bloqueio contra força bruta admin |
| `MAX_OPEN_TASKS_FOR_GITHUB` | `200` | Travamento de abertura automática de Issues no GitHub |
| `MAX_REQUEST_BODY_BYTES` | `16384` | Tamanho máximo de payload aceito pela API |
| `LOG_LEVEL` | `INFO` | Nível dos logs JSON (`DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`) |

---

## ⚠️ Formato Padronizado de Erros

Todos os erros (`400`, `403`, `404`, `413`, `422`, `429`, `500`, `503`) retornam estrutura consistente mantendo compatibilidade com `detail` no frontend:

```json
{
  "error": {
    "code": "validation_error",
    "message": "O título deve ter entre 5 e 120 caracteres.",
    "request_id": "a1b2c3d4e5f6...",
    "fields": [
      { "field": "title", "message": "O título deve ter entre 5 e 120 caracteres." }
    ]
  },
  "detail": "O título deve ter entre 5 e 120 caracteres."
}
```

---

## 🚀 Deploy no servidor Linux (Atlas) em `~/tpt-tasks-api`

### 1. Copiar a pasta e preparar o ambiente

```bash
mkdir -p ~/tpt-tasks-api
# Copie o conteúdo de tpt-tasks-api/ do repositório para ~/tpt-tasks-api
cd ~/tpt-tasks-api
chmod +x deploy.sh
./deploy.sh
```

### 2. Configurar o `.env`

Copie `.env.example` para `.env` e defina os valores de produção (`APP_ENV=production`, `ADMIN_KEY` forte, `GITHUB_TOKEN`, e `TRUST_PROXY_HEADERS=true` se rodar atrás de Nginx/Tailscale local).

> **Dica de segurança (`GITHUB_TOKEN`):** crie no GitHub um *Fine-grained Personal Access Token* restrito ao repositório `lucascomercialk-arch/tecnologia-para-todos` com permissão apenas em **Issues: Read and write**.

### 3. Subir o serviço na porta `3050` e verificar saúde

```bash
curl http://127.0.0.1:3050/api/health
```

Retorno esperado (`200 OK`):

```json
{
  "status": "ok",
  "service": "tpt-tasks-api",
  "db_journal_mode": "wal",
  "github_sync_configured": true
}
```

Se o banco estiver inacessível, `/api/health` responde `503 Service Unavailable`.

---

## 🧪 Rodar testes localmente

```bash
cd tpt-tasks-api
python -m venv .venv
# Windows: .venv\Scripts\pip install -r requirements.txt
# Linux:   .venv/bin/pip install -r requirements.txt
pytest --rootdir=. -v tests/
```
