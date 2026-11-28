"""API FastAPI leve e endurecida para centralizar tasks e melhorias da plataforma."""

from __future__ import annotations

import ipaddress
import logging
import re
import secrets
import sqlite3
import sys
import threading
import time
import uuid
from collections import defaultdict, deque
from pathlib import Path
from typing import Any, Optional

_HERE = str(Path(__file__).resolve().parent)
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Query, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import ConfigurationError, Settings, load_settings, validate_settings
from database import TaskDatabase
from github_sync import close_github_issue, create_github_issue_for_task
from logging_utils import configure_logging, redact_text
from schemas import (
    ALLOWED_MODULES,
    ALLOWED_STATUSES,
    TaskCreate,
    TaskPublic,
    TaskUpdate,
    validate_client_id,
    validate_task_id,
)

logger = logging.getLogger("tpt.api")

_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

_ERROR_CODE_BY_STATUS = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    413: "payload_too_large",
    422: "validation_error",
    429: "rate_limit_exceeded",
    500: "internal_error",
    503: "service_unavailable",
}


class InMemoryRateLimiter:
    """Rate limiter em memória (sliding window) com poda automática e limite de chaves."""

    def __init__(
        self,
        max_requests: int = 5,
        window_seconds: int = 3600,
        max_tracked_keys: int = 10_000,
    ) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.max_tracked_keys = max(10, int(max_tracked_keys))
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune_bucket(self, bucket: deque[float], now: float) -> None:
        cutoff = now - self.window_seconds
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

    def _cleanup_locked(self, now: float) -> None:
        empty_keys = []
        for k, bucket in self._hits.items():
            self._prune_bucket(bucket, now)
            if not bucket:
                empty_keys.append(k)
        for k in empty_keys:
            self._hits.pop(k, None)

        while len(self._hits) >= self.max_tracked_keys:
            oldest_key = next(iter(self._hits))
            self._hits.pop(oldest_key, None)

    def check_and_record(self, ip: str, client_id: str) -> tuple[bool, int]:
        """Verifica se IP ou X-Client-Id excederam o limite; se livre, registra a tentativa."""
        keys = [f"ip:{ip}"]
        if client_id:
            keys.append(f"client:{client_id}")
        return self.check_and_record_keys(keys)

    def check_and_record_keys(self, keys: list[str]) -> tuple[bool, int]:
        """Verifica múltiplas chaves e registra um hit caso nenhuma esteja bloqueada."""
        now = time.monotonic()
        with self._lock:
            self._cleanup_locked(now)
            retry_after = 0
            for key in keys:
                bucket = self._hits.get(key)
                if not bucket:
                    continue
                self._prune_bucket(bucket, now)
                if len(bucket) >= self.max_requests:
                    oldest = bucket[0]
                    wait = max(1, int(self.window_seconds - (now - oldest)))
                    retry_after = max(retry_after, wait)
                elif not bucket:
                    self._hits.pop(key, None)
            if retry_after > 0:
                return False, retry_after

            for key in keys:
                self._hits[key].append(now)
            return True, 0

    def is_limited(self, key: str) -> tuple[bool, int]:
        """Consulta se uma chave já atingiu o limite sem consumir tentativa."""
        now = time.monotonic()
        with self._lock:
            bucket = self._hits.get(key)
            if not bucket:
                return False, 0
            self._prune_bucket(bucket, now)
            if not bucket:
                self._hits.pop(key, None)
                return False, 0
            if len(bucket) >= self.max_requests:
                oldest = bucket[0]
                wait = max(1, int(self.window_seconds - (now - oldest)))
                return True, wait
            return False, 0

    def record(self, key: str) -> None:
        """Registra uma tentativa para uma chave específica."""
        now = time.monotonic()
        with self._lock:
            self._cleanup_locked(now)
            self._hits[key].append(now)

    def reset(self) -> None:
        """Limpa contadores em memória (útil para testes)."""
        with self._lock:
            self._hits.clear()


def _is_trusted_proxy_peer(host: str) -> bool:
    if not host:
        return False
    try:
        addr = ipaddress.ip_address(host)
        return addr.is_loopback or addr.is_private
    except ValueError:
        return False


def _parse_valid_ip(raw: str) -> Optional[str]:
    cleaned = (raw or "").strip()
    if not cleaned:
        return None
    try:
        return str(ipaddress.ip_address(cleaned))
    except ValueError:
        return None


def extract_client_ip(request: Request, trust_proxy_headers: bool = False) -> str:
    """Extrai o IP do cliente; só confia em headers de proxy quando configurado e de peer local."""
    peer_host = request.client.host.strip() if request.client and request.client.host else ""
    if trust_proxy_headers and _is_trusted_proxy_peer(peer_host):
        cf_ip = _parse_valid_ip(request.headers.get("CF-Connecting-IP", ""))
        if cf_ip:
            return cf_ip
        xff = request.headers.get("X-Forwarded-For", "").strip()
        if xff:
            first_ip = _parse_valid_ip(xff.split(",")[0])
            if first_ip:
                return first_ip
    return peer_host or "unknown"


def is_admin_request(x_admin_key: Optional[str], admin_key: str) -> bool:
    """Verifica se a requisição possui a ADMIN_KEY válida usando comparação em tempo constante."""
    return bool(x_admin_key and admin_key and secrets.compare_digest(x_admin_key.strip(), admin_key))


def is_authorized(
    task_raw: dict[str, Any],
    x_client_id: Optional[str],
    x_admin_key: Optional[str],
    admin_key: str,
) -> bool:
    """Permite mutação somente ao navegador criador (owner_id) ou ao admin (ADMIN_KEY)."""
    if is_admin_request(x_admin_key, admin_key):
        return True
    if x_client_id and task_raw.get("owner_id"):
        return secrets.compare_digest(x_client_id.strip(), str(task_raw["owner_id"]))
    return False


def _resolve_request_id(request: Request) -> str:
    existing = getattr(request.state, "request_id", None)
    if isinstance(existing, str) and existing:
        return existing
    raw_header = (request.headers.get("X-Request-Id") or "").strip()
    req_id = raw_header if _REQUEST_ID_RE.match(raw_header) else uuid.uuid4().hex
    request.state.request_id = req_id
    return req_id


def _apply_security_headers(response: Response, request_id: str) -> Response:
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cache-Control", "no-store")
    response.headers["X-Request-Id"] = request_id
    return response


def make_error_response(
    status_code: int,
    code: str,
    message: str,
    request_id: str,
    *,
    headers: Optional[dict[str, str]] = None,
    fields: Optional[list[dict[str, str]]] = None,
) -> JSONResponse:
    """Constrói resposta de erro padronizada com compatibilidade para 'detail'."""
    error_body: dict[str, Any] = {
        "code": code,
        "message": message,
        "request_id": request_id,
    }
    if fields is not None:
        error_body["fields"] = fields

    resp = JSONResponse(
        status_code=status_code,
        content={"error": error_body, "detail": message},
        headers=headers,
    )
    return _apply_security_headers(resp, request_id)


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    """Cria e configura uma instância isolada e segura da aplicação FastAPI."""
    cfg = validate_settings(settings or load_settings())
    secrets_to_mask = (cfg.admin_key, cfg.github_token)
    configure_logging(cfg.log_level, secrets_to_mask=secrets_to_mask)

    db = TaskDatabase(cfg.db_path)
    db.init_db()

    rate_limiter = InMemoryRateLimiter(
        max_requests=cfg.rate_limit_max,
        window_seconds=cfg.rate_limit_window_seconds,
    )
    mutation_rate_limiter = InMemoryRateLimiter(
        max_requests=cfg.mutation_rate_limit_max,
        window_seconds=cfg.rate_limit_window_seconds,
    )
    admin_fail_limiter = InMemoryRateLimiter(
        max_requests=cfg.admin_fail_limit_max,
        window_seconds=cfg.admin_fail_window_seconds,
    )

    is_prod = cfg.app_env == "production"
    application = FastAPI(
        title="Tecnologia para Todos — Tasks API",
        version="1.1.0",
        description="Backend leve para persistência de tasks/melhorias e sincronização com GitHub Issues.",
        docs_url=None if is_prod else "/docs",
        redoc_url=None if is_prod else "/redoc",
        openapi_url=None if is_prod else "/openapi.json",
    )

    application.state.settings = cfg
    application.state.db = db
    application.state.rate_limiter = rate_limiter
    application.state.mutation_rate_limiter = mutation_rate_limiter
    application.state.admin_fail_limiter = admin_fail_limiter

    @application.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        request_id = _resolve_request_id(request)
        code = _ERROR_CODE_BY_STATUS.get(exc.status_code, "http_error")
        message = str(exc.detail) if exc.detail else "Erro na requisição."
        headers = dict(exc.headers) if exc.headers else None
        return make_error_response(exc.status_code, code, message, request_id, headers=headers)

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        request_id = _resolve_request_id(request)
        fields: list[dict[str, str]] = []
        for err in exc.errors():
            loc_parts = [str(part) for part in err.get("loc", ()) if part != "body"]
            field_name = ".".join(loc_parts) if loc_parts else "body"
            raw_msg = str(err.get("msg", "Valor inválido."))
            clean_msg = redact_text(raw_msg.replace("Value error, ", ""), secrets_to_mask)
            fields.append({"field": field_name, "message": clean_msg})
        summary = fields[0]["message"] if fields else "Dados da requisição inválidos."
        return make_error_response(
            422,
            "validation_error",
            summary,
            request_id,
            fields=fields,
        )

    @application.exception_handler(sqlite3.Error)
    async def sqlite_exception_handler(request: Request, exc: sqlite3.Error) -> JSONResponse:
        request_id = _resolve_request_id(request)
        logger.error(
            "Erro de persistência SQLite: %s",
            redact_text(str(exc), secrets_to_mask),
            extra={"request_id": request_id},
        )
        return make_error_response(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "service_unavailable",
            "Serviço de banco de dados temporariamente indisponível.",
            request_id,
        )

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = _resolve_request_id(request)
        logger.error(
            "Erro interno não tratado (%s): %s",
            type(exc).__name__,
            redact_text(str(exc), secrets_to_mask),
            extra={"request_id": request_id},
        )
        return make_error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "internal_error",
            "Erro interno ao processar a requisição.",
            request_id,
        )

    @application.middleware("http")
    async def security_and_audit_middleware(request: Request, call_next: Any) -> Response:
        request_id = _resolve_request_id(request)
        start = time.monotonic()

        raw_content_length = request.headers.get("content-length")
        if raw_content_length is not None:
            try:
                content_length = int(raw_content_length)
            except ValueError:
                return make_error_response(
                    status.HTTP_400_BAD_REQUEST,
                    "invalid_content_length",
                    "Header Content-Length inválido.",
                    request_id,
                )
            if content_length < 0:
                return make_error_response(
                    status.HTTP_400_BAD_REQUEST,
                    "invalid_content_length",
                    "Header Content-Length não pode ser negativo.",
                    request_id,
                )
            if content_length > cfg.max_request_body_bytes:
                return make_error_response(
                    413,
                    "payload_too_large",
                    f"Corpo da requisição excede o limite de {cfg.max_request_body_bytes} bytes.",
                    request_id,
                )

        if request.method.upper() in ("POST", "PATCH", "PUT"):
            body = await request.body()
            if len(body) > cfg.max_request_body_bytes:
                return make_error_response(
                    413,
                    "payload_too_large",
                    f"Corpo da requisição excede o limite de {cfg.max_request_body_bytes} bytes.",
                    request_id,
                )

        try:
            response = await call_next(request)
        except sqlite3.Error as exc:
            logger.error(
                "Erro de persistência SQLite no middleware: %s",
                redact_text(str(exc), secrets_to_mask),
                extra={"request_id": request_id},
            )
            response = make_error_response(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "service_unavailable",
                "Serviço de banco de dados temporariamente indisponível.",
                request_id,
            )
        except Exception as exc:
            logger.error(
                "Erro interno capturado no middleware (%s): %s",
                type(exc).__name__,
                redact_text(str(exc), secrets_to_mask),
                extra={"request_id": request_id},
            )
            response = make_error_response(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "internal_error",
                "Erro interno ao processar a requisição.",
                request_id,
            )

        elapsed_ms = round((time.monotonic() - start) * 1000, 2)
        _apply_security_headers(response, request_id)
        logger.info(
            "HTTP %s %s -> %s",
            request.method,
            request.url.path,
            response.status_code,
            extra={
                "request_id": request_id,
                "extra_fields": {
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": elapsed_ms,
                },
            },
        )
        return response

    # Registrado por último para envolver respostas de erro/413/429 com headers CORS apropriados
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(cfg.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Client-Id", "X-Admin-Key"],
    )

    @application.get("/api/health")
    def health_check(request: Request) -> Response:
        healthy, journal_mode = db.check_health()
        if not healthy:
            return make_error_response(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "service_unavailable",
                "Banco de dados indisponível no momento.",
                _resolve_request_id(request),
            )
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": "ok",
                "service": "tpt-tasks-api",
                "db_journal_mode": journal_mode,
                "github_sync_configured": bool(cfg.github_token and cfg.github_repo),
            },
        )

    @application.get("/api/tasks", response_model=list[TaskPublic])
    def list_tasks(
        module: Optional[str] = Query(default=None),
        task_status: Optional[str] = Query(default=None, alias="status"),
        limit: int = Query(default=100, ge=1, le=200),
        offset: int = Query(default=0, ge=0),
    ) -> list[dict[str, Any]]:
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
        return db.list_tasks(module=clean_module, status=clean_status, limit=limit, offset=offset)

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
        request_id = _resolve_request_id(request)
        try:
            client_id = validate_client_id(x_client_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        client_ip = extract_client_ip(request, cfg.trust_proxy_headers)
        allowed, retry_after = rate_limiter.check_and_record(client_ip, client_id)
        if not allowed:
            return make_error_response(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "rate_limit_exceeded",
                "Limite de criações atingido (máximo de 5 por hora). Tente novamente mais tarde.",
                request_id,
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
                extra={"request_id": request_id},
            )

        return created

    def _guard_mutation_request(
        request: Request,
        task_id: str,
        x_admin_key: Optional[str],
    ) -> tuple[str, str]:
        request_id = _resolve_request_id(request)
        try:
            clean_task_id = validate_task_id(task_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        client_ip = extract_client_ip(request, cfg.trust_proxy_headers)
        allowed, retry_after = mutation_rate_limiter.check_and_record_keys([f"mut:{client_ip}"])
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Muitas tentativas de alteração. Aguarde alguns instantes.",
                headers={"Retry-After": str(retry_after)},
            )

        if x_admin_key and x_admin_key.strip():
            limited, admin_retry = admin_fail_limiter.is_limited(f"admin_fail:{client_ip}")
            if limited:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Muitas tentativas inválidas de chave administrativa. Tente mais tarde.",
                    headers={"Retry-After": str(admin_retry)},
                )
            if not is_admin_request(x_admin_key, cfg.admin_key):
                admin_fail_limiter.record(f"admin_fail:{client_ip}")
                logger.warning(
                    "Tentativa com X-Admin-Key inválida bloqueada.",
                    extra={"request_id": request_id},
                )

        return clean_task_id, request_id

    @application.patch("/api/tasks/{task_id}", response_model=TaskPublic)
    def update_task(
        task_id: str,
        payload: TaskUpdate,
        request: Request,
        background_tasks: BackgroundTasks,
        x_client_id: Optional[str] = Header(default=None, alias="X-Client-Id"),
        x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
    ) -> dict[str, Any]:
        clean_task_id, _ = _guard_mutation_request(request, task_id, x_admin_key)

        existing = db.get_task_raw(clean_task_id)
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
                    status_code=422,
                    detail=f"O campo '{required_key}' não pode ser nulo.",
                )
        if "description" in updates and updates["description"] is None:
            updates["description"] = ""

        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nenhum campo válido informado para atualização.",
            )

        if "status" in updates and not is_admin_request(x_admin_key, cfg.admin_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas administradores podem alterar o status de uma task.",
            )

        updated = db.update_task(clean_task_id, updates)
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
        request: Request,
        x_client_id: Optional[str] = Header(default=None, alias="X-Client-Id"),
        x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
    ) -> dict[str, object]:
        clean_task_id, _ = _guard_mutation_request(request, task_id, x_admin_key)

        existing = db.get_task_raw(clean_task_id)
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

        db.delete_task(clean_task_id)
        return {"deleted": True, "id": clean_task_id}

    return application


if Path(_HERE).joinpath(".env").exists() or __name__ == "__main__":
    app = create_app()
elif not Path(_HERE).joinpath(".env").exists():
    # Permite importar app diretamente via Uvicorn (`uvicorn main:app`) respeitando env vars
    import os as _os

    if _os.getenv("TPT_SKIP_DEFAULT_APP", "false").lower() != "true":
        app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=app.state.settings.port,
        reload=False,
    )
