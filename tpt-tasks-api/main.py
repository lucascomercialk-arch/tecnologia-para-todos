"""API FastAPI leve para centralizar tasks e melhorias da plataforma Tecnologia para Todos."""

from __future__ import annotations

import logging
import secrets
import sys
import threading
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Optional

_HERE = str(Path(__file__).resolve().parent)
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import Settings, load_settings
from database import TaskDatabase
from github_sync import close_github_issue, create_github_issue_for_task
from schemas import (
    ALLOWED_MODULES,
    ALLOWED_STATUSES,
    TaskCreate,
    TaskPublic,
    TaskUpdate,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("tpt.api")


class InMemoryRateLimiter:
    """Rate limiter leve em memória (sliding window) por IP e por X-Client-Id."""

    def __init__(self, max_requests: int = 5, window_seconds: int = 3600) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, bucket: deque[float], now: float) -> None:
        cutoff = now - self.window_seconds
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

    def check_and_record(self, ip: str, client_id: str) -> tuple[bool, int]:
        """Verifica se IP ou X-Client-Id excederam o limite; se livre, registra a tentativa."""
        now = time.monotonic()
        keys = [f"ip:{ip}", f"client:{client_id}"]
        with self._lock:
            retry_after = 0
            for key in keys:
                bucket = self._hits[key]
                self._prune(bucket, now)
                if len(bucket) >= self.max_requests:
                    oldest = bucket[0]
                    wait = max(1, int(self.window_seconds - (now - oldest)))
                    retry_after = max(retry_after, wait)
            if retry_after > 0:
                return False, retry_after

            for key in keys:
                self._hits[key].append(now)
            return True, 0

    def reset(self) -> None:
        """Limpa contadores em memória (útil para testes)."""
        with self._lock:
            self._hits.clear()


def extract_client_ip(request: Request) -> str:
    """Extrai o IP real do cliente considerando proxies (Cloudflare / Nginx)."""
    cf_ip = request.headers.get("CF-Connecting-IP", "").strip()
    if cf_ip:
        return cf_ip
    xff = request.headers.get("X-Forwarded-For", "").strip()
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def is_authorized(
    task_raw: dict,
    x_client_id: Optional[str],
    x_admin_key: Optional[str],
    admin_key: str,
) -> bool:
    """Permite mutação somente ao navegador criador (owner_id) ou ao admin (ADMIN_KEY)."""
    if x_admin_key and admin_key and secrets.compare_digest(x_admin_key.strip(), admin_key):
        return True
    if x_client_id and task_raw.get("owner_id"):
        return secrets.compare_digest(x_client_id.strip(), str(task_raw["owner_id"]))
    return False


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    """Cria e configura uma instância isolada da aplicação FastAPI."""
    cfg = settings or load_settings()
    db = TaskDatabase(cfg.db_path)
    db.init_db()
    rate_limiter = InMemoryRateLimiter(
        max_requests=cfg.rate_limit_max,
        window_seconds=cfg.rate_limit_window_seconds,
    )

    application = FastAPI(
        title="Tecnologia para Todos — Tasks API",
        version="1.0.0",
        description="Backend leve para persistência de tasks/melhorias e sincronização com GitHub Issues.",
    )

    application.state.settings = cfg
    application.state.db = db
    application.state.rate_limiter = rate_limiter

    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(cfg.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Client-Id", "X-Admin-Key"],
    )

    @application.get("/api/health")
    def health_check() -> dict[str, object]:
        return {
            "status": "ok",
            "service": "tpt-tasks-api",
            "db_journal_mode": db.get_journal_mode(),
            "github_sync_configured": bool(cfg.github_token and cfg.github_repo),
        }

    @application.get("/api/tasks", response_model=list[TaskPublic])
    def list_tasks(
        module: Optional[str] = Query(default=None),
        task_status: Optional[str] = Query(default=None, alias="status"),
    ) -> list[dict]:
        clean_module = module.strip().lower() if module else None
        clean_status = task_status.strip().lower() if task_status else None

        if clean_module and clean_module not in ALLOWED_MODULES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Filtro 'module' inválido. Permitidos: {', '.join(ALLOWED_MODULES)}.",
            )
        if clean_status and clean_status not in ALLOWED_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Filtro 'status' inválido. Permitidos: {', '.join(ALLOWED_STATUSES)}.",
            )
        return db.list_tasks(module=clean_module, status=clean_status)

    @application.post(
        "/api/tasks",
        response_model=TaskPublic,
        status_code=status.HTTP_201_CREATED,
    )
    def create_task(
        payload: TaskCreate,
        request: Request,
        background_tasks: BackgroundTasks,
        x_client_id: Optional[str] = Header(default=None, alias="X-Client-Id"),
    ):
        client_id = (x_client_id or "").strip()
        if not client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Header X-Client-Id é obrigatório e não pode ser vazio.",
            )
        if len(client_id) > 128:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Header X-Client-Id excede o tamanho máximo permitido.",
            )

        client_ip = extract_client_ip(request)
        allowed, retry_after = rate_limiter.check_and_record(client_ip, client_id)
        if not allowed:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Limite de criações atingido (máximo de 5 por hora). Tente novamente mais tarde."
                },
                headers={"Retry-After": str(retry_after)},
            )

        open_before = db.count_open_tasks()
        created = db.create_task(
            title=payload.title,
            module=payload.module,
            description=payload.description or "",
            priority=payload.priority,
            owner_id=client_id,
        )

        if (
            cfg.github_token
            and cfg.github_repo
            and open_before < cfg.max_open_tasks_for_github
        ):
            background_tasks.add_task(create_github_issue_for_task, created, cfg, db)
        elif cfg.github_token and open_before >= cfg.max_open_tasks_for_github:
            logger.warning(
                "Limite de %s tasks abertas atingido; Issue no GitHub não criada para task %s.",
                cfg.max_open_tasks_for_github,
                created["id"],
            )

        return created

    @application.patch("/api/tasks/{task_id}", response_model=TaskPublic)
    def update_task(
        task_id: str,
        payload: TaskUpdate,
        background_tasks: BackgroundTasks,
        x_client_id: Optional[str] = Header(default=None, alias="X-Client-Id"),
        x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
    ) -> dict:
        existing = db.get_task_raw(task_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task não encontrada.",
            )

        if not is_authorized(existing, x_client_id, x_admin_key, cfg.admin_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para alterar esta task.",
            )

        updates = payload.model_dump(exclude_unset=True)
        for required_key in ("title", "module", "priority", "status"):
            if required_key in updates and updates[required_key] is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"O campo '{required_key}' não pode ser nulo.",
                )
        if "description" in updates and updates["description"] is None:
            updates["description"] = ""

        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nenhum campo válido informado para atualização.",
            )

        updated = db.update_task(task_id, updates)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task não encontrada.",
            )

        if (
            updates.get("status") == "done"
            and existing.get("status") != "done"
            and existing.get("github_issue_number")
        ):
            background_tasks.add_task(
                close_github_issue,
                int(existing["github_issue_number"]),
                cfg,
            )

        return updated

    @application.delete("/api/tasks/{task_id}")
    def delete_task(
        task_id: str,
        x_client_id: Optional[str] = Header(default=None, alias="X-Client-Id"),
        x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
    ) -> dict[str, object]:
        existing = db.get_task_raw(task_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task não encontrada.",
            )

        if not is_authorized(existing, x_client_id, x_admin_key, cfg.admin_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para excluir esta task.",
            )

        db.delete_task(task_id)
        return {"deleted": True, "id": task_id}

    return application


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=app.state.settings.port,
        reload=False,
    )
