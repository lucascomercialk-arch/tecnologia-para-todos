"""Esquemas Pydantic e regras de validação para a API de Tasks."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, field_validator

ALLOWED_MODULES = (
    "python",
    "html",
    "melhorias",
    "geral",
    "bug",
    "glossario",
    "playground",
)
ALLOWED_PRIORITIES = ("baixa", "normal", "alta")
ALLOWED_STATUSES = ("pending", "in_progress", "done")


def _validate_title_value(value: str) -> str:
    cleaned = value.strip()
    if len(cleaned) < 5 or len(cleaned) > 120:
        raise ValueError("O título deve ter entre 5 e 120 caracteres.")
    return cleaned


def _validate_module_value(value: str) -> str:
    cleaned = value.strip().lower()
    if cleaned not in ALLOWED_MODULES:
        allowed = ", ".join(ALLOWED_MODULES)
        raise ValueError(f"Módulo inválido. Valores permitidos: {allowed}.")
    return cleaned


def _validate_description_value(value: Optional[str]) -> str:
    if value is None:
        return ""
    cleaned = value.strip()
    if not cleaned:
        return ""
    if len(cleaned) < 10 or len(cleaned) > 1000:
        raise ValueError("A descrição (quando informada) deve ter entre 10 e 1000 caracteres.")
    return cleaned


def _validate_priority_value(value: str) -> str:
    cleaned = value.strip().lower()
    if cleaned not in ALLOWED_PRIORITIES:
        allowed = ", ".join(ALLOWED_PRIORITIES)
        raise ValueError(f"Prioridade inválida. Valores permitidos: {allowed}.")
    return cleaned


class TaskCreate(BaseModel):
    """Payload de criação de task (POST /api/tasks)."""

    title: str
    module: str = "melhorias"
    description: Optional[str] = ""
    priority: str = "normal"

    @field_validator("title")
    @classmethod
    def check_title(cls, value: str) -> str:
        return _validate_title_value(value)

    @field_validator("module")
    @classmethod
    def check_module(cls, value: str) -> str:
        return _validate_module_value(value)

    @field_validator("description")
    @classmethod
    def check_description(cls, value: Optional[str]) -> str:
        return _validate_description_value(value)

    @field_validator("priority")
    @classmethod
    def check_priority(cls, value: str) -> str:
        return _validate_priority_value(value)


class TaskUpdate(BaseModel):
    """Payload de atualização parcial de task (PATCH /api/tasks/{id})."""

    title: Optional[str] = None
    module: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None

    @field_validator("title")
    @classmethod
    def check_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _validate_title_value(value)

    @field_validator("module")
    @classmethod
    def check_module(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _validate_module_value(value)

    @field_validator("description")
    @classmethod
    def check_description(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _validate_description_value(value)

    @field_validator("priority")
    @classmethod
    def check_priority(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _validate_priority_value(value)

    @field_validator("status")
    @classmethod
    def check_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip().lower()
        if cleaned not in ALLOWED_STATUSES:
            allowed = ", ".join(ALLOWED_STATUSES)
            raise ValueError(f"Status inválido. Valores permitidos: {allowed}.")
        return cleaned


class TaskPublic(BaseModel):
    """Representação pública de uma task (sem owner_id)."""

    id: str
    title: str
    module: str
    description: str
    priority: str
    status: str
    github_issue_number: Optional[int] = None
    github_issue_url: Optional[str] = None
    created_at: str
    updated_at: str
