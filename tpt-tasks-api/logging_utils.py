"""Utilitários de logging estruturado em JSON com redação automática de segredos."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Iterable

REDACTED = "[REDACTED]"

SENSITIVE_KEY_TOKENS = (
    "token",
    "secret",
    "password",
    "passwd",
    "admin_key",
    "x-admin-key",
    "authorization",
    "cookie",
)

_BEARER_RE = re.compile(r"(Bearer\s+)[A-Za-z0-9._\-]+", re.IGNORECASE)
_GITHUB_TOKEN_RE = re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]+\b|\bgithub_pat_[A-Za-z0-9_]+\b")


def redact_text(text: str, secrets_to_mask: Iterable[str] = ()) -> str:
    """Mascara tokens, cabeçalhos Bearer e segredos configurados em uma string."""
    if not text:
        return ""
    masked = str(text)
    masked = _BEARER_RE.sub(rf"\1{REDACTED}", masked)
    masked = _GITHUB_TOKEN_RE.sub(REDACTED, masked)
    for secret in secrets_to_mask:
        cleaned = (secret or "").strip()
        if len(cleaned) >= 4 and cleaned in masked:
            masked = masked.replace(cleaned, REDACTED)
    return masked


def _is_sensitive_key(key: str) -> bool:
    low = str(key or "").strip().lower()
    return any(tok in low for tok in SENSITIVE_KEY_TOKENS)


def sanitize_log_data(value: Any, secrets_to_mask: Iterable[str] = ()) -> Any:
    """Sanitiza recursivamente dicts/listas mascarando chaves e valores sensíveis."""
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for k, v in value.items():
            key_str = str(k)
            if _is_sensitive_key(key_str):
                sanitized[key_str] = REDACTED
            else:
                sanitized[key_str] = sanitize_log_data(v, secrets_to_mask)
        return sanitized
    if isinstance(value, (list, tuple)):
        return [sanitize_log_data(item, secrets_to_mask) for item in value]
    if isinstance(value, str):
        return redact_text(value, secrets_to_mask)
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return redact_text(str(value), secrets_to_mask)


class StructuredJsonFormatter(logging.Formatter):
    """Formatter que serializa logs como JSON de uma linha sem expor segredos."""

    def __init__(self, secrets_to_mask: Iterable[str] = ()) -> None:
        super().__init__()
        self.secrets_to_mask = tuple(s for s in secrets_to_mask if s and len(s.strip()) >= 4)

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_text(record.getMessage(), self.secrets_to_mask),
        }
        request_id = getattr(record, "request_id", None)
        if request_id:
            payload["request_id"] = str(request_id)

        extra_fields = getattr(record, "extra_fields", None)
        if isinstance(extra_fields, dict) and extra_fields:
            payload["extra"] = sanitize_log_data(extra_fields, self.secrets_to_mask)

        if record.exc_info:
            exc_type = record.exc_info[0].__name__ if record.exc_info[0] else "Exception"
            exc_val = redact_text(str(record.exc_info[1] or ""), self.secrets_to_mask)
            payload["exception"] = {"type": exc_type, "message": exc_val}

        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level_name: str = "INFO", secrets_to_mask: Iterable[str] = ()) -> None:
    """Configura logging estruturado nos loggers 'tpt' preservando captura em testes."""
    level = getattr(logging, str(level_name or "INFO").upper(), logging.INFO)
    formatter = StructuredJsonFormatter(secrets_to_mask=secrets_to_mask)

    tpt_logger = logging.getLogger("tpt")
    tpt_logger.setLevel(level)

    # Atualiza formatter caso já exista um StreamHandler configurado pela aplicação
    app_handlers = [h for h in tpt_logger.handlers if getattr(h, "_tpt_structured", False)]
    if not app_handlers:
        handler = logging.StreamHandler()
        setattr(handler, "_tpt_structured", True)
        handler.setFormatter(formatter)
        tpt_logger.addHandler(handler)
    else:
        for handler in app_handlers:
            handler.setFormatter(formatter)
