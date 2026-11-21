"""Testes automatizados da API de Tasks (FastAPI + SQLite WAL + GitHub Sync)."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

API_DIR = Path(__file__).resolve().parent.parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

# Evita efeitos colaterais no .env/db padrão ao importar main
os.environ.setdefault("AUTO_WRITE_ENV", "false")
os.environ.setdefault("DB_PATH", ":memory:")

from config import Settings, load_settings  # noqa: E402
from main import create_app  # noqa: E402


class FakeResponse:
    """Resposta HTTP fake para simular a API do GitHub."""

    def __init__(self, status_code: int, json_data: dict[str, Any] | None = None, text: str = "") -> None:
        self.status_code = status_code
        self._json = json_data or {}
        self.text = text

    def json(self) -> dict[str, Any]:
        return self._json


def make_client(
    tmp_path: Path,
    *,
    github_token: str = "",
    github_repo: str = "lucascomercialk-arch/tecnologia-para-todos",
    max_open_tasks_for_github: int = 200,
    rate_limit_max: int = 5,
) -> TestClient:
    settings = Settings(
        port=3050,
        db_path=str(tmp_path / "test_tasks.db"),
        admin_key="super-secret-admin-key",
        github_token=github_token,
        github_repo=github_repo,
        max_open_tasks_for_github=max_open_tasks_for_github,
        rate_limit_max=rate_limit_max,
        rate_limit_window_seconds=3600,
    )
    app = create_app(settings)
    return TestClient(app)


def test_health_and_wal_mode(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["db_journal_mode"] == "wal"
    assert body["github_sync_configured"] is False


def test_auto_generate_admin_key_writes_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ADMIN_KEY", raising=False)
    monkeypatch.delenv("AUTO_WRITE_ENV", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text("PORT=3050\nADMIN_KEY=\n", encoding="utf-8")

    cfg = load_settings(env_path=env_file, auto_write_env=True)
    assert len(cfg.admin_key) >= 20
    saved = env_file.read_text(encoding="utf-8")
    assert f"ADMIN_KEY={cfg.admin_key}" in saved


def test_create_task_requires_client_id(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    payload = {"title": "Melhorar explicação do for", "module": "python", "priority": "normal"}

    r1 = client.post("/api/tasks", json=payload)
    assert r1.status_code == 400

    r2 = client.post("/api/tasks", json=payload, headers={"X-Client-Id": "   "})
    assert r2.status_code == 400


def test_create_task_validations(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    headers = {"X-Client-Id": "client-1"}

    # Título curto (< 5) e longo (> 120)
    assert (
        client.post("/api/tasks", json={"title": "oi", "module": "python"}, headers=headers).status_code
        == 422
    )
    assert (
        client.post("/api/tasks", json={"title": "a" * 121, "module": "python"}, headers=headers).status_code
        == 422
    )

    # Descrição com 1-9 chars ou > 1000 chars falha
    assert (
        client.post(
            "/api/tasks",
            json={"title": "Título válido", "module": "python", "description": "curta"},
            headers=headers,
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/tasks",
            json={"title": "Título válido", "module": "python", "description": "x" * 1001},
            headers=headers,
        ).status_code
        == 422
    )

    # Módulo ou prioridade inválidos
    assert (
        client.post(
            "/api/tasks",
            json={"title": "Título válido", "module": "cobol"},
            headers=headers,
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/tasks",
            json={"title": "Título válido", "module": "python", "priority": "urgente"},
            headers=headers,
        ).status_code
        == 422
    )

    # Descrição omitida ou vazia é permitida
    ok_empty = client.post(
        "/api/tasks",
        json={"title": "Adicionar exercício de listas", "module": "python", "description": ""},
        headers=headers,
    )
    assert ok_empty.status_code == 201
    assert ok_empty.json()["description"] == ""


def test_list_tasks_filters_and_hides_owner_id(tmp_path: Path) -> None:
    client = make_client(tmp_path, rate_limit_max=10)
    c1 = {"X-Client-Id": "browser-a"}

    t1 = client.post(
        "/api/tasks",
        json={"title": "Card extra sobre while", "module": "python", "priority": "alta"},
        headers=c1,
    )
    assert t1.status_code == 201
    assert "owner_id" not in t1.json()

    t2 = client.post(
        "/api/tasks",
        json={"title": "Trilha inicial de HTML", "module": "html", "priority": "normal"},
        headers=c1,
    )
    assert t2.status_code == 201

    # Atualiza t1 para done (somente admin pode alterar status)
    patch_resp = client.patch(
        f"/api/tasks/{t1.json()['id']}",
        json={"status": "done"},
        headers={"X-Admin-Key": "super-secret-admin-key"},
    )
    assert patch_resp.status_code == 200
    assert "owner_id" not in patch_resp.json()

    all_tasks = client.get("/api/tasks").json()
    assert len(all_tasks) == 2
    for item in all_tasks:
        assert "owner_id" not in item

    only_html = client.get("/api/tasks?module=html").json()
    assert len(only_html) == 1
    assert only_html[0]["module"] == "html"

    only_done = client.get("/api/tasks?status=done").json()
    assert len(only_done) == 1
    assert only_done[0]["id"] == t1.json()["id"]


def test_ownership_and_admin_authorization(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    owner_headers = {"X-Client-Id": "owner-uuid"}
    other_headers = {"X-Client-Id": "other-uuid"}
    admin_headers = {"X-Admin-Key": "super-secret-admin-key"}

    created = client.post(
        "/api/tasks",
        json={"title": "Corrigir contraste no botão", "module": "melhorias"},
        headers=owner_headers,
    ).json()
    task_id = created["id"]

    # Outro usuário sem ADMIN_KEY recebe 403
    assert client.patch(f"/api/tasks/{task_id}", json={"status": "in_progress"}, headers=other_headers).status_code == 403
    assert client.delete(f"/api/tasks/{task_id}", headers=other_headers).status_code == 403

    # Sem headers recebe 403
    assert client.patch(f"/api/tasks/{task_id}", json={"status": "in_progress"}).status_code == 403
    assert client.delete(f"/api/tasks/{task_id}").status_code == 403

    # Criador não pode alterar status (exclusivo do Admin), mas pode editar título/prioridade
    r_owner_status = client.patch(
        f"/api/tasks/{task_id}",
        json={"status": "in_progress"},
        headers=owner_headers,
    )
    assert r_owner_status.status_code == 403

    r_owner_edit = client.patch(
        f"/api/tasks/{task_id}",
        json={"title": "Corrigir contraste no botão do topo", "priority": "alta"},
        headers=owner_headers,
    )
    assert r_owner_edit.status_code == 200
    assert r_owner_edit.json()["title"] == "Corrigir contraste no botão do topo"
    assert r_owner_edit.json()["priority"] == "alta"

    # Admin consegue alterar status, editar e deletar task de qualquer criador
    r_admin = client.patch(
        f"/api/tasks/{task_id}",
        json={"status": "in_progress", "title": "Corrigir contraste no botão principal"},
        headers=admin_headers,
    )
    assert r_admin.status_code == 200
    assert r_admin.json()["status"] == "in_progress"
    assert r_admin.json()["title"] == "Corrigir contraste no botão principal"

    assert client.delete(f"/api/tasks/{task_id}", headers=admin_headers).status_code == 200
    assert client.patch(f"/api/tasks/{task_id}", json={"status": "done"}, headers=admin_headers).status_code == 404
    assert client.delete(f"/api/tasks/{task_id}", headers=admin_headers).status_code == 404


def test_rate_limit_5_per_hour(tmp_path: Path) -> None:
    client = make_client(tmp_path, rate_limit_max=5)
    headers = {"X-Client-Id": "spammer-client"}

    for idx in range(5):
        resp = client.post(
            "/api/tasks",
            json={"title": f"Sugestão válida número {idx + 1}", "module": "geral"},
            headers=headers,
        )
        assert resp.status_code == 201

    blocked = client.post(
        "/api/tasks",
        json={"title": "Sexta sugestão bloqueada", "module": "geral"},
        headers=headers,
    )
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers


def test_github_issue_sync_create_and_close(tmp_path: Path) -> None:
    calls: list[dict[str, Any]] = []

    class FakeAsyncClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
            return None

        async def post(self, url: str, json: dict[str, Any], headers: dict[str, str]) -> FakeResponse:
            calls.append({"method": "POST", "url": url, "json": json, "headers": headers})
            return FakeResponse(
                201,
                {"number": 42, "html_url": "https://github.com/lucascomercialk-arch/tecnologia-para-todos/issues/42"},
            )

        async def patch(self, url: str, json: dict[str, Any], headers: dict[str, str]) -> FakeResponse:
            calls.append({"method": "PATCH", "url": url, "json": json, "headers": headers})
            return FakeResponse(200, {"state": "closed"})

    client = make_client(tmp_path, github_token="ghp_fake_token")
    owner_headers = {"X-Client-Id": "creator-1"}

    with patch("github_sync.httpx.AsyncClient", FakeAsyncClient):
        resp = client.post(
            "/api/tasks",
            json={
                "title": "Adicionar exemplos de dicionários",
                "module": "python",
                "description": "Incluir exemplos passo a passo com chave e valor.",
                "priority": "alta",
            },
            headers=owner_headers,
        )
        assert resp.status_code == 201
        task_id = resp.json()["id"]

        # BackgroundTasks rodou ao fim da resposta no TestClient; busca atualizada deve ter número e URL
        listed = client.get("/api/tasks").json()
        assert len(listed) == 1
        assert listed[0]["github_issue_number"] == 42
        assert listed[0]["github_issue_url"].endswith("/issues/42")

        assert len(calls) == 1
        assert calls[0]["method"] == "POST"
        assert calls[0]["json"]["title"] == "[Task - python] Adicionar exemplos de dicionários"
        assert calls[0]["json"]["labels"] == ["platform-task", "python"]

        # Criador não pode marcar como done (não fecha a Issue no GitHub)
        owner_done = client.patch(f"/api/tasks/{task_id}", json={"status": "done"}, headers=owner_headers)
        assert owner_done.status_code == 403
        assert len(calls) == 1

        # Somente Admin pode marcar como done e fechar a Issue no GitHub
        admin_headers = {"X-Admin-Key": "super-secret-admin-key"}
        done_resp = client.patch(f"/api/tasks/{task_id}", json={"status": "done"}, headers=admin_headers)
        assert done_resp.status_code == 200
        assert len(calls) == 2
        assert calls[1]["method"] == "PATCH"
        assert calls[1]["url"].endswith("/issues/42")
        assert calls[1]["json"] == {"state": "closed"}


def test_github_failure_does_not_break_local_creation_and_respects_open_limit(tmp_path: Path) -> None:
    calls: list[str] = []

    class FailingAsyncClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        async def __aenter__(self) -> "FailingAsyncClient":
            return self

        async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
            return None

        async def post(self, url: str, json: dict[str, Any], headers: dict[str, str]) -> FakeResponse:
            calls.append(url)
            return FakeResponse(500, text="GitHub Internal Error")

    # Limite baixo (2) para testar a trava de >= max_open_tasks_for_github
    client = make_client(tmp_path, github_token="ghp_fake_token", max_open_tasks_for_github=2)
    headers = {"X-Client-Id": "creator-2"}

    with patch("github_sync.httpx.AsyncClient", FailingAsyncClient):
        r1 = client.post("/api/tasks", json={"title": "Primeira task local", "module": "geral"}, headers=headers)
        r2 = client.post("/api/tasks", json={"title": "Segunda task local", "module": "geral"}, headers=headers)
        r3 = client.post("/api/tasks", json={"title": "Terceira task acima do limite", "module": "geral"}, headers=headers)

    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r3.status_code == 201
    # Chamou GitHub apenas para as 2 primeiras (quando open_before < 2); a 3ª não chamou
    assert len(calls) == 2


def test_cors_allows_expected_origins(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    for origin in (
        "https://lucascomercialk-arch.github.io",
        "http://localhost:5500",
        "http://localhost:3000",
    ):
        resp = client.options(
            "/api/tasks",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type,X-Client-Id,X-Admin-Key",
            },
        )
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == origin
