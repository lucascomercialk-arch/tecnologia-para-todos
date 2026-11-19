#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

mkdir -p logs

if [ ! -f ".env" ]; then
  cp .env.example .env
  chmod 600 .env
  echo "Arquivo .env criado a partir de .env.example."
  echo "Edite o .env para informar o GITHUB_TOKEN (a ADMIN_KEY será gerada automaticamente no 1º start se deixada em branco)."
fi

echo ""
echo "Setup concluído! Para iniciar a API na porta 3050:"
echo "  • Com PM2:     pm2 start ecosystem.config.cjs && pm2 save"
echo "  • Com systemd: sudo cp tpt-tasks-api.service /etc/systemd/system/ && sudo systemctl enable --now tpt-tasks-api"
echo "  • Teste local: curl http://127.0.0.1:3050/api/health"
