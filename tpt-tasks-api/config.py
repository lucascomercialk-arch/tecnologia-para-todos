"""Configurações e carregamento de variáveis de ambiente para a API de Tasks."""

from __future__ import annotations

import logging
import os
import re
import secrets
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

logger = logging.getLogger("tpt.config")

BASE_DIR = Path(__file__).resolve().parent

DEFAULT_CORS_ORIGINS = [
    "https://lucascomercialk-arch.github.io",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]


@dataclass
class Settings:
    """Configuração da aplicação carregada do ambiente/.env."""

    port: int = 3050
    db_path: str = str(BASE_DIR / "tpt_tasks.db")
    admin_key: str = ""
    github_token: str = ""
    github_repo: str = "lucascomercialk-arch/tecnologia-para-todos"
    max_open_tasks_for_github: int = 200
    rate_limit_max: int = 5
    rate_limit_window_seconds: int = 3600
    cors_origins: tuple[str, ...] = tuple(DEFAULT_CORS_ORIGINS)


def _resolve_db_path(raw_path: str) -> str:
    cleaned = (raw_path or "").strip() or "tpt_tasks.db"
    if cleaned == ":memory:":
        return cleaned
    path = Path(cleaned)
    if not path.is_absolute():
        path = BASE_DIR / path
    return str(path.resolve())


def _persist_admin_key(env_path: Path, admin_key: str) -> None:
    """Salva ADMIN_KEY gerada automaticamente no arquivo .env local."""
    if env_path.exists():
        content = env_path.read_text(encoding="utf-8")
        if re.search(r"^ADMIN_KEY=.*$", content, flags=re.MULTILINE):
            updated = re.sub(
                r"^ADMIN_KEY=.*$",
                f"ADMIN_KEY={admin_key}",
                content,
                count=1,
                flags=re.MULTILINE,
            )
        else:
            sep = "" if (not content or content.endswith("\n")) else "\n"
            updated = f"{content}{sep}ADMIN_KEY={admin_key}\n"
    else:
        updated = f"ADMIN_KEY={admin_key}\n"

    env_path.write_text(updated, encoding="utf-8")
    if os.name == "posix":
        try:
            os.chmod(env_path, 0o600)
        except OSError:
            pass


def _build_cors_origins(extra_raw: str) -> tuple[str, ...]:
    origins = list(DEFAULT_CORS_ORIGINS)
    for item in (extra_raw or "").split(","):
        cleaned = item.strip().rstrip("/")
        if cleaned and cleaned not in origins:
            origins.append(cleaned)
    return tuple(origins)


def load_settings(env_path: Optional[Path] = None, auto_write_env: Optional[bool] = None) -> Settings:
    """Carrega configurações do .env e variáveis de ambiente."""
    target_env = env_path or (BASE_DIR / ".env")
    if target_env.exists():
        load_dotenv(dotenv_path=target_env, override=False)

    should_write = (
        auto_write_env
        if auto_write_env is not None
        else os.getenv("AUTO_WRITE_ENV", "true").strip().lower() != "false"
    )

    admin_key = os.getenv("ADMIN_KEY", "").strip()
    if not admin_key:
        admin_key = secrets.token_urlsafe(32)
        if should_write:
            _persist_admin_key(target_env, admin_key)
            logger.info("ADMIN_KEY gerada automaticamente e salva em %s", target_env)
        else:
            logger.info("ADMIN_KEY gerada em memória (AUTO_WRITE_ENV=false)")

    return Settings(
        port=int(os.getenv("PORT", "3050")),
        db_path=_resolve_db_path(os.getenv("DB_PATH", "tpt_tasks.db")),
        admin_key=admin_key,
        github_token=os.getenv("GITHUB_TOKEN", "").strip(),
        github_repo=os.getenv("GITHUB_REPO", "lucascomercialk-arch/tecnologia-para-todos").strip(),
        max_open_tasks_for_github=int(os.getenv("MAX_OPEN_TASKS_FOR_GITHUB", "200")),
        rate_limit_max=int(os.getenv("RATE_LIMIT_MAX", "5")),
        rate_limit_window_seconds=int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "3600")),
        cors_origins=_build_cors_origins(os.getenv("EXTRA_CORS_ORIGINS", "")),
    )
