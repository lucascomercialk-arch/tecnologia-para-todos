"""Configurações, validação de inicialização e variáveis de ambiente da API de Tasks."""

from __future__ import annotations

import logging
import os
import re
import secrets
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from dotenv import load_dotenv

logger = logging.getLogger("tpt.config")

BASE_DIR = Path(__file__).resolve().parent

ALLOWED_APP_ENVS = ("development", "production", "test")
ALLOWED_LOG_LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")

PROD_CORS_ORIGINS: tuple[str, ...] = ("https://lucascomercialk-arch.github.io",)
DEV_CORS_ORIGINS: tuple[str, ...] = (
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
)
DEFAULT_CORS_ORIGINS: list[str] = list(PROD_CORS_ORIGINS + DEV_CORS_ORIGINS)

_GITHUB_REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
_WEAK_ADMIN_KEYS = {
    "changeme",
    "secret",
    "admin",
    "password",
    "your_admin_key",
    "replace-me",
    "123456",
    "123456789012",
}


class ConfigurationError(ValueError):
    """Erro lançado quando a configuração inicial da API é inválida ou insegura."""


@dataclass
class Settings:
    """Configuração validada da aplicação carregada do ambiente/.env."""

    port: int = 3050
    db_path: str = str(BASE_DIR / "tpt_tasks.db")
    admin_key: str = ""
    github_token: str = ""
    github_repo: str = "lucascomercialk-arch/tecnologia-para-todos"
    max_open_tasks_for_github: int = 200
    rate_limit_max: int = 5
    rate_limit_window_seconds: int = 3600
    cors_origins: tuple[str, ...] = PROD_CORS_ORIGINS + DEV_CORS_ORIGINS
    app_env: str = "development"
    trust_proxy_headers: bool = False
    max_request_body_bytes: int = 16384
    mutation_rate_limit_max: int = 30
    admin_fail_limit_max: int = 10
    admin_fail_window_seconds: int = 900
    log_level: str = "INFO"


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


def validate_cors_origin(origin: str, *, require_https: bool = False) -> str:
    """Valida e normaliza uma origem CORS explícita (rejeita curingas, paths e credenciais)."""
    cleaned = (origin or "").strip().rstrip("/")
    if not cleaned or cleaned == "*" or "*" in cleaned:
        raise ConfigurationError("CORS_ORIGINS não permite curinga '*' ou origem vazia.")
    if any(ch.isspace() for ch in cleaned):
        raise ConfigurationError(f"Origem CORS inválida (contém espaços): {cleaned}")

    parsed = urlparse(cleaned)
    scheme = parsed.scheme.lower()
    allowed_schemes = ("https",) if require_https else ("http", "https")
    if scheme not in allowed_schemes:
        expected = "https://" if require_https else "http:// ou https://"
        raise ConfigurationError(
            f"Origem CORS inválida ({cleaned}): esquema deve ser {expected}."
        )
    if not parsed.hostname or parsed.username is not None or parsed.password is not None:
        raise ConfigurationError(f"Origem CORS inválida (host ou credenciais): {cleaned}")
    if parsed.path not in ("", "/") or parsed.params or parsed.query or parsed.fragment:
        raise ConfigurationError(f"Origem CORS não pode conter path, query ou fragmento: {cleaned}")
    return cleaned


def _build_cors_origins(app_env: str, explicit_raw: str, extra_raw: str) -> tuple[str, ...]:
    origins: list[str] = []
    if explicit_raw and explicit_raw.strip():
        candidates = [item.strip().rstrip("/") for item in explicit_raw.split(",") if item.strip()]
    elif app_env == "production":
        candidates = list(PROD_CORS_ORIGINS)
    else:
        candidates = list(PROD_CORS_ORIGINS + DEV_CORS_ORIGINS)

    for item in candidates + [x.strip().rstrip("/") for x in (extra_raw or "").split(",") if x.strip()]:
        if item not in origins:
            origins.append(item)
    return tuple(origins)


def _parse_int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw.strip())
    except ValueError as exc:
        raise ConfigurationError(f"Variável {name} deve ser um número inteiro válido.") from exc


def _parse_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    val = raw.strip().lower()
    if val in ("1", "true", "yes", "on"):
        return True
    if val in ("0", "false", "no", "off"):
        return False
    raise ConfigurationError(f"Variável {name} deve ser booleana (true/false).")


def validate_settings(settings: Settings) -> Settings:
    """Valida todas as configurações e falha rapidamente (fail-fast) em caso de insegurança."""
    env = (settings.app_env or "").strip().lower()
    if env not in ALLOWED_APP_ENVS:
        raise ConfigurationError(
            f"APP_ENV inválido '{settings.app_env}'. Valores permitidos: {', '.join(ALLOWED_APP_ENVS)}."
        )
    settings.app_env = env

    if not (1 <= int(settings.port) <= 65535):
        raise ConfigurationError(f"PORT inválida ({settings.port}): deve estar entre 1 e 65535.")

    min_admin_len = 24 if env == "production" else 12
    admin_key = (settings.admin_key or "").strip()
    if not admin_key or len(admin_key) < min_admin_len or admin_key.lower() in _WEAK_ADMIN_KEYS:
        raise ConfigurationError(
            f"ADMIN_KEY ausente ou fraca para APP_ENV={env} (mínimo de {min_admin_len} caracteres)."
        )
    settings.admin_key = admin_key

    if settings.rate_limit_max < 1:
        raise ConfigurationError("RATE_LIMIT_MAX deve ser maior ou igual a 1.")
    if settings.rate_limit_window_seconds < 1:
        raise ConfigurationError("RATE_LIMIT_WINDOW_SECONDS deve ser maior ou igual a 1.")
    if settings.mutation_rate_limit_max < 1:
        raise ConfigurationError("MUTATION_rate_limit_max inválido: deve ser >= 1.".replace("rate_limit_max", "RATE_LIMIT_MAX"))
    if settings.admin_fail_limit_max < 1:
        raise ConfigurationError("ADMIN_FAIL_LIMIT_MAX deve ser maior ou igual a 1.")
    if settings.admin_fail_window_seconds < 1:
        raise ConfigurationError("ADMIN_FAIL_WINDOW_SECONDS deve ser maior ou igual a 1.")
    if settings.max_open_tasks_for_github < 0:
        raise ConfigurationError("MAX_OPEN_TASKS_FOR_GITHUB deve ser maior ou igual a 0.")
    if settings.max_request_body_bytes < 1024:
        raise ConfigurationError("MAX_REQUEST_BODY_BYTES deve ser maior ou igual a 1024.")

    repo = (settings.github_repo or "").strip()
    if repo and not _GITHUB_REPO_RE.match(repo):
        raise ConfigurationError(f"GITHUB_REPO inválido '{repo}': use o formato 'dono/repositorio'.")
    settings.github_repo = repo

    level = (settings.log_level or "INFO").strip().upper()
    if level not in ALLOWED_LOG_LEVELS:
        raise ConfigurationError(
            f"LOG_LEVEL inválido '{settings.log_level}'. Valores permitidos: {', '.join(ALLOWED_LOG_LEVELS)}."
        )
    settings.log_level = level

    if not settings.cors_origins:
        raise ConfigurationError("CORS_ORIGINS deve definir pelo menos uma origem permitida.")
    normalized_origins = tuple(
        validate_cors_origin(origin, require_https=(env == "production"))
        for origin in settings.cors_origins
    )
    settings.cors_origins = normalized_origins
    return settings


def load_settings(env_path: Optional[Path] = None, auto_write_env: Optional[bool] = None) -> Settings:
    """Carrega configurações do .env e variáveis de ambiente com validação estrita."""
    target_env = env_path or (BASE_DIR / ".env")
    if target_env.exists():
        load_dotenv(dotenv_path=target_env, override=False)

    app_env = os.getenv("APP_ENV", "development").strip().lower()
    if app_env not in ALLOWED_APP_ENVS:
        raise ConfigurationError(
            f"APP_ENV inválido '{app_env}'. Valores permitidos: {', '.join(ALLOWED_APP_ENVS)}."
        )

    should_write = (
        auto_write_env
        if auto_write_env is not None
        else _parse_bool_env("AUTO_WRITE_ENV", default=(app_env != "production"))
    )

    admin_key = os.getenv("ADMIN_KEY", "").strip()
    if not admin_key:
        if app_env == "production":
            raise ConfigurationError(
                "ADMIN_KEY é obrigatória em produção (APP_ENV=production) e não é gerada automaticamente."
            )
        admin_key = secrets.token_urlsafe(32)
        if should_write:
            _persist_admin_key(target_env, admin_key)
            logger.info("ADMIN_KEY gerada automaticamente e salva em %s", target_env)
        else:
            logger.info("ADMIN_KEY gerada em memória (AUTO_WRITE_ENV=false)")

    settings = Settings(
        app_env=app_env,
        port=_parse_int_env("PORT", 3050),
        db_path=_resolve_db_path(os.getenv("DB_PATH", "tpt_tasks.db")),
        admin_key=admin_key,
        github_token=os.getenv("GITHUB_TOKEN", "").strip(),
        github_repo=os.getenv("GITHUB_REPO", "lucascomercialk-arch/tecnologia-para-todos").strip(),
        max_open_tasks_for_github=_parse_int_env("MAX_OPEN_TASKS_FOR_GITHUB", 200),
        rate_limit_max=_parse_int_env("RATE_LIMIT_MAX", 5),
        rate_limit_window_seconds=_parse_int_env("RATE_LIMIT_WINDOW_SECONDS", 3600),
        mutation_rate_limit_max=_parse_int_env("MUTATION_RATE_LIMIT_MAX", 30),
        admin_fail_limit_max=_parse_int_env("ADMIN_FAIL_LIMIT_MAX", 10),
        admin_fail_window_seconds=_parse_int_env("ADMIN_FAIL_WINDOW_SECONDS", 900),
        trust_proxy_headers=_parse_bool_env("TRUST_PROXY_HEADERS", False),
        max_request_body_bytes=_parse_int_env("MAX_REQUEST_BODY_BYTES", 16384),
        log_level=os.getenv("LOG_LEVEL", "INFO").strip().upper(),
        cors_origins=_build_cors_origins(
            app_env,
            os.getenv("CORS_ORIGINS", ""),
            os.getenv("EXTRA_CORS_ORIGINS", ""),
        ),
    )
    return validate_settings(settings)
