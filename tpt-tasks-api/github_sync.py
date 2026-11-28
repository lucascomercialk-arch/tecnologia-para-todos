"""Integração assíncrona e segura com a API de Issues do GitHub."""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, Optional

import httpx

from config import Settings
from database import TaskDatabase
from logging_utils import redact_text

logger = logging.getLogger("tpt.github_sync")

GITHUB_API_BASE = "https://api.github.com"
_GITHUB_TIMEOUT = httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0)
_TITLE_CTRL_RE = re.compile(r"[\x00-\x1f\x7f]+")


def _github_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "tpt-tasks-api",
    }


def _sanitize_issue_title(raw_title: str) -> str:
    return _TITLE_CTRL_RE.sub(" ", str(raw_title or "")).strip()


def _is_valid_github_url(raw_url: Any) -> bool:
    return isinstance(raw_url, str) and raw_url.startswith("https://github.com/")


async def _send_github_request(
    method: str,
    url: str,
    *,
    payload: dict[str, Any],
    settings: Settings,
) -> Optional[httpx.Response]:
    """Executa requisição HTTP para o GitHub com retry único em falha transitória de transporte."""
    secrets_to_mask = (settings.github_token, settings.admin_key)
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=_GITHUB_TIMEOUT) as client:
                if method == "POST":
                    return await client.post(
                        url, json=payload, headers=_github_headers(settings.github_token)
                    )
                return await client.patch(
                    url, json=payload, headers=_github_headers(settings.github_token)
                )
        except httpx.TransportError as exc:
            if attempt == 0:
                await asyncio.sleep(0.2)
                continue
            logger.error(
                "Erro de transporte ao comunicar com GitHub API (%s): %s",
                method,
                redact_text(str(exc), secrets_to_mask),
            )
            return None
        except Exception as exc:  # pragma: no cover - proteção adicional contra erro inesperado
            logger.error(
                "Erro inesperado ao comunicar com GitHub API (%s): %s",
                method,
                redact_text(str(exc), secrets_to_mask),
            )
            return None
    return None


async def create_github_issue_for_task(
    task: dict[str, Any],
    settings: Settings,
    db: TaskDatabase,
) -> None:
    """Abre uma Issue no GitHub para a task recém-criada e salva número/URL no SQLite."""
    if not settings.github_token or not settings.github_repo:
        logger.debug("Sincronização com GitHub desativada (GITHUB_TOKEN ou GITHUB_REPO ausente).")
        return

    secrets_to_mask = (settings.github_token, settings.admin_key)
    module = task["module"]
    description = task.get("description") or "_Sem descrição informada._"
    safe_title = _sanitize_issue_title(task["title"])
    issue_title = f"[Task - {module}] {safe_title}"
    issue_body = (
        f"{description}\n\n"
        "---\n"
        f"- **Módulo:** `{module}`\n"
        f"- **Prioridade:** `{task['priority']}`\n"
        f"- **ID da Task:** `{task['id']}`\n"
        f"- **Criada em:** `{task['created_at']}`\n"
    )
    payload = {
        "title": issue_title,
        "body": issue_body,
        "labels": ["platform-task", module],
    }
    url = f"{GITHUB_API_BASE}/repos/{settings.github_repo}/issues"

    resp = await _send_github_request("POST", url, payload=payload, settings=settings)
    if resp is None:
        return

    if resp.status_code == 201:
        data = resp.json()
        issue_number = data.get("number")
        issue_url = data.get("html_url")
        if issue_number and _is_valid_github_url(issue_url):
            db.set_github_issue(task["id"], int(issue_number), str(issue_url))
            logger.info("Issue #%s criada no GitHub para task %s", issue_number, task["id"])
        else:
            logger.error("Resposta 201 do GitHub sem number/html_url válido para task %s", task["id"])
    else:
        logger.error(
            "Falha ao criar Issue no GitHub para task %s: status=%s body=%s",
            task["id"],
            resp.status_code,
            redact_text(resp.text[:400], secrets_to_mask),
        )


async def close_github_issue(issue_number: int, settings: Settings) -> None:
    """Fecha no GitHub a Issue vinculada quando a task é marcada como 'done'."""
    if not settings.github_token or not settings.github_repo or not issue_number:
        return

    secrets_to_mask = (settings.github_token, settings.admin_key)
    url = f"{GITHUB_API_BASE}/repos/{settings.github_repo}/issues/{int(issue_number)}"
    resp = await _send_github_request("PATCH", url, payload={"state": "closed"}, settings=settings)
    if resp is None:
        return

    if resp.status_code in (200, 201):
        logger.info("Issue #%s fechada no GitHub.", issue_number)
    else:
        logger.warning(
            "Não foi possível fechar Issue #%s no GitHub: status=%s body=%s",
            issue_number,
            resp.status_code,
            redact_text(resp.text[:300], secrets_to_mask),
        )
