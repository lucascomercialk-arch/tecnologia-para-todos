"""Testes de segurança, validação estrita, resiliência e higiene para tpt-tasks-api."""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

API_DIR = Path(__file__).resolve().parent.parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

os.environ.setdefault("AUTO_WRITE_ENV", "false")
os.environ.setdefault("DB_PATH", ":memory:")

from config import ConfigurationError, PROD_CORS_ORIGINS, Settings, load_settings  # noqa: E402
from logging_utils import StructuredJsonFormatter, redact_text, sanitize_log_data  # noqa: E402
from main import create_app  # noqa: E402


def make_sec_app(
    tmp_path: Path,
    *,
    app_env: str = "development",
    admin_key: str = "super-secret-admin-key-very-strong-1234",
    cors_origins: tuple[str, ...] = PROD_CORS_ORIGINS + ("http://localhost:5500",),
    trust_proxy_headers: bool = False,
    max_request_body_bytes: int = 16384,
    rate_limit_max: int = 5,
    mutation_rate_limit_max: int = 30,
    admin_fail_limit_max: int = 5,
):
    settings = Settings(
        app_env=app_env,
        port=3050,
        db_path=str(tmp_path / "sec_tasks.db"),
        admin_key=admin_key,
        github_token="",
        cors_origins=cors_origins,
        trust_proxy_headers=trust_proxy_headers,
        max_request_body_bytes=max_request_body_bytes,
        rate_limit_max=rate_limit_max,
        mutation_rate_limit_max=mutation_rate_limit_max,
        admin_fail_limit_max=admin_fail_limit_max,
        admin_fail_window_seconds=900,
    )
    return create_app(settings)


def test_startup_fail_fast_rejects_invalid_configurations(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    empty_env = tmp_path / ".env"

    # Produção exige ADMIN_KEY forte (>= 24 chars) e nunca auto-gera
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("ADMIN_KEY", raising=False)
    monkeypatch.setenv("DB_PATH", str(tmp_path / "prod.db"))
    with pytest.raises(ConfigurationError, match="ADMIN_KEY"):
        load_settings(env_path=empty_env)

    monkeypatch.setenv("ADMIN_KEY", "changeme")
    with pytest.raises(ConfigurationError, match="ADMIN_KEY"):
        load_settings(env_path=empty_env)

    # Origem HTTP simples ou wildcard CORS proibida em produção
    monkeypatch.setenv("ADMIN_KEY", "x" * 32)
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5500")
    with pytest.raises(ConfigurationError, match="https://"):
        load_settings(env_path=empty_env)

    monkeypatch.setenv("CORS_ORIGINS", "*")
    with pytest.raises(ConfigurationError, match="curinga"):
        load_settings(env_path=empty_env)

    # Porta, APP_ENV, GITHUB_REPO e rate limit inválidos falham
    monkeypatch.setenv("CORS_ORIGINS", "https://lucascomercialk-arch.github.io")
    monkeypatch.setenv("PORT", "99999")
    with pytest.raises(ConfigurationError, match="PORT"):
        load_settings(env_path=empty_env)

    monkeypatch.setenv("PORT", "3050")
    monkeypatch.setenv("APP_ENV", "staging-unknown")
    with pytest.raises(ConfigurationError, match="APP_ENV"):
        load_settings(env_path=empty_env)

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("GITHUB_REPO", "invalid-repo-without-slash")
    with pytest.raises(ConfigurationError, match="GITHUB_REPO"):
        load_settings(env_path=empty_env)

    monkeypatch.setenv("GITHUB_REPO", "lucascomercialk-arch/tecnologia-para-todos")
    monkeypatch.setenv("RATE_LIMIT_MAX", "0")
    with pytest.raises(ConfigurationError, match="RATE_LIMIT_MAX"):
        load_settings(env_path=empty_env)


def test_production_cors_and_disabled_openapi_docs(tmp_path: Path) -> None:
    app = make_sec_app(
        tmp_path,
        app_env="production",
        admin_key="prod-secret-key-at-least-32-characters-ok",
        cors_origins=PROD_CORS_ORIGINS,
    )
    client = TestClient(app)

    # Docs e schema desabilitados em produção
    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
    assert client.get("/openapi.json").status_code == 404

    # Origem de produção permitida
    ok_cors = client.options(
        "/api/tasks",
        headers={
            "Origin": "https://lucascomercialk-arch.github.io",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert ok_cors.status_code == 200
    assert (
        ok_cors.headers.get("access-control-allow-origin")
        == "https://lucascomercialk-arch.github.io"
    )

    # Localhost e origem desconhecida bloqueados no CORS de produção
    for blocked_origin in ("http://localhost:5500", "https://evil.example.com"):
        blocked = client.options(
            "/api/tasks",
            headers={
                "Origin": blocked_origin,
                "Access-Control-Request-Method": "GET",
            },
        )
        assert blocked.headers.get("access-control-allow-origin") is None


def test_security_headers_and_request_id(tmp_path: Path) -> None:
    client = TestClient(make_sec_app(tmp_path))
    resp = client.get("/api/health", headers={"X-Request-Id": "req-check-123"})
    assert resp.status_code == 200
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["X-Frame-Options"] == "DENY"
    assert resp.headers["Referrer-Policy"] == "no-referrer"
    assert resp.headers["Cache-Control"] == "no-store"
    assert resp.headers["X-Request-Id"] == "req-check-123"

    # X-Request-Id malformado é substituído por UUID seguro
    bad_req = client.get("/api/health", headers={"X-Request-Id": "bad\nid/../../"})
    assert bad_req.headers["X-Request-Id"] != "bad\nid/../../"
    assert len(bad_req.headers["X-Request-Id"]) == 32


def test_strict_validation_anti_injection_and_error_format(tmp_path: Path) -> None:
    client = TestClient(make_sec_app(tmp_path))
    headers = {"X-Client-Id": "client-sec-123"}

    # Campos extras rejeitados (extra="forbid")
    extra_resp = client.post(
        "/api/tasks",
        json={"title": "Sugestão com campo extra", "module": "python", "is_admin": True},
        headers=headers,
    )
    assert extra_resp.status_code == 422
    extra_body = extra_resp.json()
    assert extra_body["error"]["code"] == "validation_error"
    assert extra_body["error"]["request_id"]
    assert isinstance(extra_body["detail"], str)

    # Caracteres de controle / quebra de linha no título rejeitados
    ctrl_resp = client.post(
        "/api/tasks",
        json={"title": "Título com\nquebra de linha", "module": "python"},
        headers=headers,
    )
    assert ctrl_resp.status_code == 422

    # X-Client-Id malformado rejeitado com erro padronizado 400
    bad_cid = client.post(
        "/api/tasks",
        json={"title": "Título válido normal", "module": "python"},
        headers={"X-Client-Id": "ab<script>"},
    )
    assert bad_cid.status_code == 400
    assert bad_cid.json()["error"]["code"] == "bad_request"

    # Task ID inválido rejeitado com 400
    bad_id = client.patch(
        "/api/tasks/id invalid!$$",
        json={"title": "Novo titulo valido"},
        headers=headers,
    )
    assert bad_id.status_code == 400
    assert bad_id.json()["error"]["code"] == "bad_request"

    # SQL injection no filtro de query rejeitado
    sqli_filter = client.get("/api/tasks?module=' OR 1=1;--")
    assert sqli_filter.status_code == 400

    # SQL injection em dados é armazenado literalmente sem alterar tabela
    sqli_payload = "'; DROP TABLE tasks; --"
    created = client.post(
        "/api/tasks",
        json={"title": f"Teste SQLi {sqli_payload}", "module": "python"},
        headers=headers,
    )
    assert created.status_code == 201
    listed = client.get("/api/tasks").json()
    assert len(listed) == 1
    assert sqli_payload in listed[0]["title"]


def test_oversized_payload_returns_413(tmp_path: Path) -> None:
    client = TestClient(make_sec_app(tmp_path, max_request_body_bytes=1024))
    oversized_body = {
        "title": "Payload grande",
        "module": "python",
        "description": "A" * 2000,
    }
    resp = client.post(
        "/api/tasks",
        json=oversized_body,
        headers={"X-Client-Id": "client-size-1"},
    )
    assert resp.status_code == 413
    body = resp.json()
    assert body["error"]["code"] == "payload_too_large"
    assert body["error"]["request_id"]
    assert body["detail"] == body["error"]["message"]


def test_rate_limit_prevents_ip_spoofing_when_untrusted_and_honors_trusted_proxy(
    tmp_path: Path,
) -> None:
    # 1. trust_proxy_headers=False: cabeçalhos forjados não burlam limite por IP
    app_untrusted = make_sec_app(tmp_path / "untrusted", rate_limit_max=2, trust_proxy_headers=False)
    client_untrusted = TestClient(app_untrusted, client=("198.51.100.10", 50000))

    for i in range(2):
        ok_resp = client_untrusted.post(
            "/api/tasks",
            json={"title": f"Task valida spoofing {i + 1}", "module": "geral"},
            headers={"X-Client-Id": f"unique-client-{i}", "X-Forwarded-For": f"10.0.0.{i + 1}"},
        )
        assert ok_resp.status_code == 201

    blocked = client_untrusted.post(
        "/api/tasks",
        json={"title": "Terceira tentativa com IP falso", "module": "geral"},
        headers={"X-Client-Id": "unique-client-99", "CF-Connecting-IP": "203.0.113.99"},
    )
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "rate_limit_exceeded"
    assert "Retry-After" in blocked.headers

    # 2. trust_proxy_headers=True vindo de loopback: respeita IPs reais distintos do proxy
    app_trusted = make_sec_app(tmp_path / "trusted", rate_limit_max=1, trust_proxy_headers=True)
    client_trusted = TestClient(app_trusted, client=("127.0.0.1", 50000))

    r1 = client_trusted.post(
        "/api/tasks",
        json={"title": "Usuario A via Cloudflare", "module": "geral"},
        headers={"X-Client-Id": "client-a-1", "CF-Connecting-IP": "203.0.113.10"},
    )
    r2 = client_trusted.post(
        "/api/tasks",
        json={"title": "Usuario B via Cloudflare", "module": "geral"},
        headers={"X-Client-Id": "client-b-1", "CF-Connecting-IP": "203.0.113.11"},
    )
    assert r1.status_code == 201
    assert r2.status_code == 201


def test_admin_bruteforce_lockout_returns_429(tmp_path: Path) -> None:
    app = make_sec_app(tmp_path, admin_fail_limit_max=3, mutation_rate_limit_max=50)
    client = TestClient(app, client=("198.51.100.77", 50000))

    created = client.post(
        "/api/tasks",
        json={"title": "Task alvo de brute force", "module": "python"},
        headers={"X-Client-Id": "owner-bf-1"},
    ).json()

    for idx in range(3):
        attempt = client.patch(
            f"/api/tasks/{created['id']}",
            json={"status": "done"},
            headers={"X-Admin-Key": f"wrong-key-{idx}"},
        )
        assert attempt.status_code == 403

    locked = client.patch(
        f"/api/tasks/{created['id']}",
        json={"status": "done"},
        headers={"X-Admin-Key": "super-secret-admin-key-very-strong-1234"},
    )
    assert locked.status_code == 429
    assert "Retry-After" in locked.headers


def test_health_and_error_handlers_for_db_failure_and_unexpected_exception(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    app = make_sec_app(tmp_path)
    client = TestClient(app, raise_server_exceptions=False)

    # DB health check retornando 503 padronizado sem vazar detalhes
    monkeypatch.setattr(app.state.db, "check_health", lambda: (False, "error"))
    bad_health = client.get("/api/health")
    assert bad_health.status_code == 503
    assert bad_health.json()["error"]["code"] == "service_unavailable"

    # Falha SQLite em list_tasks retorna 503 seguro
    def broken_list(*args: Any, **kwargs: Any):
        raise sqlite3.OperationalError("database disk image is malformed /secret/path.db")

    monkeypatch.setattr(app.state.db, "list_tasks", broken_list)
    db_err = client.get("/api/tasks")
    assert db_err.status_code == 503
    assert db_err.json()["error"]["code"] == "service_unavailable"
    assert "/secret/path.db" not in db_err.text

    # Exceção inesperada retorna 500 padronizado sem stacktrace nem mensagem interna
    def boom(*args: Any, **kwargs: Any):
        raise RuntimeError("TOKEN_SENSIVEL_NAO_DEVE_VAZAR")

    monkeypatch.setattr(app.state.db, "list_tasks", boom)
    unhandled = client.get("/api/tasks")
    assert unhandled.status_code == 500
    assert unhandled.json()["error"]["code"] == "internal_error"
    assert "TOKEN_SENSIVEL_NAO_DEVE_VAZAR" not in unhandled.text
    assert "Traceback" not in unhandled.text


def test_list_tasks_pagination_bounds(tmp_path: Path) -> None:
    app = make_sec_app(tmp_path, rate_limit_max=20)
    client = TestClient(app)
    headers = {"X-Client-Id": "client-page-1"}
    for idx in range(3):
        resp = client.post(
            "/api/tasks",
            json={"title": f"Task paginada {idx + 1}", "module": "geral"},
            headers=headers,
        )
        assert resp.status_code == 201

    page_1 = client.get("/api/tasks?limit=2&offset=0").json()
    page_2 = client.get("/api/tasks?limit=2&offset=2").json()
    assert len(page_1) == 2
    assert len(page_2) == 1
    assert client.get("/api/tasks?limit=500").status_code == 422


def test_structured_logging_redacts_secrets_and_env_example_is_complete() -> None:
    secret_admin = "admin_super_secret_value_xyz"
    secret_gh = "ghp_ExampleSecretToken1234567890"
    fmt = StructuredJsonFormatter(secrets_to_mask=(secret_admin, secret_gh))

    record = logging.LogRecord(
        name="tpt.test",
        level=logging.ERROR,
        pathname=__file__,
        lineno=10,
        msg="Falha com Authorization Bearer %s e chave %s",
        args=(secret_gh, secret_admin),
        exc_info=None,
    )
    record.request_id = "req-abc"
    record.extra_fields = {
        "headers": {"X-Admin-Key": secret_admin, "Content-Type": "application/json"},
        "token_raw": secret_gh,
    }

    formatted = fmt.format(record)
    assert secret_admin not in formatted
    assert secret_gh not in formatted
    parsed = json.loads(formatted)
    assert parsed["request_id"] == "req-abc"
    assert parsed["extra"]["headers"]["X-Admin-Key"] == "[REDACTED]"
    assert parsed["extra"]["token_raw"] == "[REDACTED]"
    assert redact_text("Bearer my_secret_token_99") == "Bearer [REDACTED]"
    assert sanitize_log_data({"authorization": "Bearer abc"})["authorization"] == "[REDACTED]"

    # Verifica que .env.example documenta todas as variáveis necessárias e não possui segredos reais
    env_example = (API_DIR / ".env.example").read_text(encoding="utf-8")
    for var_name in (
        "APP_ENV=",
        "PORT=",
        "DB_PATH=",
        "ADMIN_KEY=",
        "AUTO_WRITE_ENV=",
        "GITHUB_TOKEN=",
        "GITHUB_REPO=",
        "CORS_ORIGINS=",
        "EXTRA_CORS_ORIGINS=",
        "TRUST_PROXY_HEADERS=",
        "RATE_LIMIT_MAX=",
        "RATE_LIMIT_WINDOW_SECONDS=",
        "MUTATION_RATE_LIMIT_MAX=",
        "ADMIN_FAIL_LIMIT_MAX=",
        "ADMIN_FAIL_WINDOW_SECONDS=",
        "MAX_OPEN_TASKS_FOR_GITHUB=",
        "MAX_REQUEST_BODY_BYTES=",
        "LOG_LEVEL=",
    ):
        assert var_name in env_example
    assert "ghp_" not in env_example
    assert "github_pat_" not in env_example
