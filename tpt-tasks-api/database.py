"""Camada de persistência SQLite (com WAL) para tasks da plataforma."""

from __future__ import annotations

import sqlite3
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

PUBLIC_COLUMNS = (
    "id",
    "title",
    "module",
    "description",
    "priority",
    "status",
    "github_issue_number",
    "github_issue_url",
    "created_at",
    "updated_at",
)

UPDATABLE_FIELDS = ("title", "module", "description", "priority", "status")


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def to_public_task(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    """Converte uma linha do banco para dicionário público, omitindo owner_id."""
    data = dict(row)
    return {col: data.get(col) for col in PUBLIC_COLUMNS}


class TaskDatabase:
    """Repositório SQLite com WAL habilitado para armazenamento das tasks."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        if db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA busy_timeout=5000;")
        return conn

    def init_db(self) -> None:
        """Cria a tabela tasks e índices caso ainda não existam."""
        with closing(self._connect()) as conn:
            with conn:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS tasks (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        module TEXT NOT NULL,
                        description TEXT NOT NULL DEFAULT '',
                        priority TEXT NOT NULL DEFAULT 'normal',
                        status TEXT NOT NULL DEFAULT 'pending',
                        owner_id TEXT NOT NULL,
                        github_issue_number INTEGER,
                        github_issue_url TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );
                    """
                )
                conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_module ON tasks(module);")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);")
                conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);"
                )

    def get_journal_mode(self) -> str:
        """Retorna o modo de journal ativo no SQLite (ex.: 'wal')."""
        with closing(self._connect()) as conn:
            row = conn.execute("PRAGMA journal_mode;").fetchone()
            return str(row[0]).lower() if row else "unknown"

    def list_tasks(
        self,
        module: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Lista tasks públicas com filtros opcionais por módulo e status."""
        clauses: list[str] = []
        params: list[Any] = []
        if module:
            clauses.append("module = ?")
            params.append(module.strip().lower())
        if status:
            clauses.append("status = ?")
            params.append(status.strip().lower())

        where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        cols_sql = ", ".join(PUBLIC_COLUMNS)
        sql = f"SELECT {cols_sql} FROM tasks {where_sql} ORDER BY created_at DESC;"

        with closing(self._connect()) as conn:
            rows = conn.execute(sql, params).fetchall()
            return [to_public_task(r) for r in rows]

    def get_task_raw(self, task_id: str) -> Optional[dict[str, Any]]:
        """Retorna o registro completo (incluindo owner_id) para checagem interna."""
        with closing(self._connect()) as conn:
            row = conn.execute("SELECT * FROM tasks WHERE id = ?;", (task_id,)).fetchone()
            return dict(row) if row else None

    def count_open_tasks(self) -> int:
        """Conta quantas tasks ainda não foram concluídas (status != 'done')."""
        with closing(self._connect()) as conn:
            row = conn.execute("SELECT COUNT(*) FROM tasks WHERE status != 'done';").fetchone()
            return int(row[0]) if row else 0

    def create_task(
        self,
        title: str,
        module: str,
        description: str,
        priority: str,
        owner_id: str,
    ) -> dict[str, Any]:
        """Insere uma nova task e retorna sua representação pública."""
        task_id = str(uuid.uuid4())
        now = _utc_now_iso()
        with closing(self._connect()) as conn:
            with conn:
                conn.execute(
                    """
                    INSERT INTO tasks (
                        id, title, module, description, priority, status,
                        owner_id, github_issue_number, github_issue_url,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, ?, ?);
                    """,
                    (task_id, title, module, description, priority, owner_id, now, now),
                )
            row = conn.execute(
                f"SELECT {', '.join(PUBLIC_COLUMNS)} FROM tasks WHERE id = ?;",
                (task_id,),
            ).fetchone()
            return to_public_task(row)

    def update_task(self, task_id: str, fields: dict[str, Any]) -> Optional[dict[str, Any]]:
        """Atualiza campos permitidos de uma task e retorna o registro público."""
        updates = {k: v for k, v in fields.items() if k in UPDATABLE_FIELDS}
        if not updates:
            raw = self.get_task_raw(task_id)
            return to_public_task(raw) if raw else None

        updates["updated_at"] = _utc_now_iso()
        assignments = ", ".join(f"{col} = ?" for col in updates)
        params = list(updates.values()) + [task_id]

        with closing(self._connect()) as conn:
            with conn:
                cursor = conn.execute(
                    f"UPDATE tasks SET {assignments} WHERE id = ?;",
                    params,
                )
                if cursor.rowcount == 0:
                    return None
            row = conn.execute(
                f"SELECT {', '.join(PUBLIC_COLUMNS)} FROM tasks WHERE id = ?;",
                (task_id,),
            ).fetchone()
            return to_public_task(row) if row else None

    def set_github_issue(self, task_id: str, issue_number: int, issue_url: str) -> None:
        """Grava o número e a URL da Issue criada no GitHub."""
        now = _utc_now_iso()
        with closing(self._connect()) as conn:
            with conn:
                conn.execute(
                    """
                    UPDATE tasks
                    SET github_issue_number = ?, github_issue_url = ?, updated_at = ?
                    WHERE id = ?;
                    """,
                    (issue_number, issue_url, now, task_id),
                )

    def delete_task(self, task_id: str) -> bool:
        """Remove uma task pelo ID. Retorna True se alguma linha foi apagada."""
        with closing(self._connect()) as conn:
            with conn:
                cursor = conn.execute("DELETE FROM tasks WHERE id = ?;", (task_id,))
                return cursor.rowcount > 0
