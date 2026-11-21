"""Integração assíncrona com a API de Issues do GitHub."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from config import Settings
from database import TaskDatabase

logger = logging.getLogger("tpt.github_sync")

GITHUB_API_BASE = "https://api.github.com"


def _github_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "tpt-tasks-api",
    }


async def create_github_issue_for_task(
    task: dict[str, Any],
    settings: Settings,
    db: TaskDatabase,
) -> None:
    """Abre uma Issue no GitHub para a task recém-criada e salva número/URL no SQLite."""
    if not settings.github_token or not settings.github_repo:
        logger.debug("Sincronização com GitHub desativada (GITHUB_TOKEN ou GITHUB_REPO ausente).")
        return

    module = task["module"]
    description = task.get("description") or "_Sem descrição informada._"
    issue_title = f"[Task - {module}] {task['title']}"
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

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers=_github_headers(settings.github_token))

        if resp.status_code == 201:
            data = resp.json()
            issue_number = data.get("number")
            issue_url = data.get("html_url")
            if issue_number and issue_url:
                db.set_github_issue(task["id"], int(issue_number), str(issue_url))
                logger.info("Issue #%s criada no GitHub para task %s", issue_number, task["id"])
            else:
                logger.error("Resposta 201 do GitHub sem number/html_url para task %s", task["id"])
        else:
            logger.error(
                "Falha ao criar Issue no GitHub para task %s: status=%s body=%s",
                task["id"],
                resp.status_code,
                resp.text[:400],
            )
    except Exception as exc:
        logger.exception("Erro ao comunicar com GitHub API para task %s: %s", task["id"], exc)


async def close_github_issue(issue_number: int, settings: Settings) -> None:
    """Fecha no GitHub a Issue vinculada quando a task é marcada como 'done'."""
    if not settings.github_token or not settings.github_repo or not issue_number:
        return

    url = f"{GITHUB_API_BASE}/repos/{settings.github_repo}/issues/{issue_number}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.patch(
                url,
                json={"state": "closed"},
                headers=_github_headers(settings.github_token),
            )
        if resp.status_code in (200, 201):
            logger.info("Issue #%s fechada no GitHub.", issue_number)
        else:
            logger.warning(
                "Não foi possível fechar Issue #%s no GitHub: status=%s body=%s",
                issue_number,
                resp.status_code,
                resp.text[:300],
            )
    except Exception as exc:
        logger.exception("Erro ao fechar Issue #%s no GitHub: %s", issue_number, exc)
