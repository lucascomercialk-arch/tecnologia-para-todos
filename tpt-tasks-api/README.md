# 🛠️ Tecnologia para Todos — Tasks API (`tpt-tasks-api`)

Backend leve em **FastAPI + SQLite (WAL)** para centralizar as tasks e melhorias da plataforma **Tecnologia para Todos** e abrir/fechar automaticamente as Issues correspondentes no GitHub (`lucascomercialk-arch/tecnologia-para-todos`).

---

## 📋 Funcionalidades

- **Persistência resiliente:** SQLite nativo com `PRAGMA journal_mode=WAL;`.
- **Privacidade:** `owner_id` nunca é exposto no `GET /api/tasks` nem nos retornos de `POST`/`PATCH`.
- **Controle de propriedade:** apenas o navegador criador (`X-Client-Id`) ou o administrador (`X-Admin-Key`) pode editar (`PATCH`) ou excluir (`DELETE`) uma task.
- **Anti-abuso:** validações de tamanho + Rate Limit em memória de `5` criações/hora por IP e por `X-Client-Id` (`429 Too Many Requests`).
- **Automação com GitHub Issues (`BackgroundTasks`):** ao criar uma task (com até 200 abertas no banco), abre automaticamente uma Issue `[Task - {module}] {title}` e grava `github_issue_number` + `github_issue_url`. Se a task for marcada como `done`, fecha a Issue vinculada no GitHub.

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

Edite `~/tpt-tasks-api/.env`:

```env
PORT=3050
DB_PATH=tpt_tasks.db
ADMIN_KEY=
GITHUB_TOKEN=github_pat_SEU_TOKEN_AQUI
GITHUB_REPO=lucascomercialk-arch/tecnologia-para-todos
```

> **Dica de segurança (`GITHUB_TOKEN`):** crie no GitHub um *Fine-grained Personal Access Token* restrito ao repositório `lucascomercialk-arch/tecnologia-para-todos` com permissão apenas em **Issues: Read and write**.  
> **Sobre a `ADMIN_KEY`:** se ficar em branco, uma chave aleatória segura é gerada e salva automaticamente no `.env` na primeira inicialização da API. Guarde essa chave para ativar o modo **🔐 Admin** no frontend.

### 3. Subir o serviço na porta `3050`

#### Opção A — Com PM2 (recomendado se já utiliza PM2 no Atlas)

```bash
cd ~/tpt-tasks-api
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

#### Opção B — Com systemd

Ajuste `User`, `Group` e os caminhos em `tpt-tasks-api.service` se o usuário não for `ubuntu`:

```bash
sudo cp tpt-tasks-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tpt-tasks-api
sudo systemctl status tpt-tasks-api
```

### 4. Verificar saúde local

```bash
curl http://127.0.0.1:3050/api/health
```

Retorno esperado:

```json
{
  "status": "ok",
  "service": "tpt-tasks-api",
  "db_journal_mode": "wal",
  "github_sync_configured": true
}
```

### 5. Expor com HTTPS (Cloudflare Tunnel ou Nginx)

Como o frontend publicado no GitHub Pages usa HTTPS (`https://lucascomercialk-arch.github.io`), o navegador exige que a API também seja servida via **HTTPS**:

- **Cloudflare Tunnel (`cloudflared`):** aponte o subdomínio desejado (ex.: `https://tpt-api.SEU-DOMINIO.com`) para `http://127.0.0.1:3050`.
- **Nginx + Certbot:** faça `proxy_pass http://127.0.0.1:3050;` repassando `X-Forwarded-For` e `X-Real-IP`.

Depois, atualize a constante `PRODUCTION_API_BASE_URL` no topo de `js/tasks-api.js` com a URL HTTPS pública.

---

## 🧪 Rodar testes localmente

```bash
cd tpt-tasks-api
python -m venv .venv
# Windows: .venv\Scripts\pip install -r requirements.txt
# Linux:   .venv/bin/pip install -r requirements.txt
.venv/bin/pytest -v tests/test_api.py
```
