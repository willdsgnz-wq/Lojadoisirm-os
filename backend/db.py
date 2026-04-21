from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import psycopg
from psycopg import errors as pg_errors
from psycopg.rows import dict_row

from backend.config import load_environment


load_environment()


BASE_DIR = Path(__file__).resolve().parent.parent
SCHEMA_PATH = BASE_DIR / "database" / "schema.sql"

IntegrityError = pg_errors.IntegrityError
UniqueViolation = pg_errors.UniqueViolation
ForeignKeyViolation = pg_errors.ForeignKeyViolation


def _truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def get_database_url() -> str:
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if database_url:
        return database_url

    app_env = os.environ.get("APP_ENV", "development").strip().lower()
    if app_env == "production":
        raise RuntimeError("A variável de ambiente DATABASE_URL é obrigatória em produção.")

    raise RuntimeError(
        "DATABASE_URL não configurada. Defina a connection string do Postgres/Supabase para rodar o projeto."
    )


def _translate_query_placeholders(query: str) -> str:
    return query.replace("?", "%s")


def _should_append_returning_id(query: str) -> bool:
    compact = " ".join(query.strip().upper().split())
    return compact.startswith("INSERT INTO") and " RETURNING " not in compact


def _split_sql_script(script: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    in_single_quote = False
    in_double_quote = False

    for char in script:
        if char == "'" and not in_double_quote:
            in_single_quote = not in_single_quote
        elif char == '"' and not in_single_quote:
            in_double_quote = not in_double_quote

        if char == ";" and not in_single_quote and not in_double_quote:
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
            continue

        current.append(char)

    trailing = "".join(current).strip()
    if trailing:
        statements.append(trailing)
    return statements


class CursorAdapter:
    def __init__(
        self,
        cursor: psycopg.Cursor[dict[str, Any]],
        *,
        buffered_rows: list[dict[str, Any]] | None = None,
        lastrowid: int | None = None,
    ) -> None:
        self._cursor = cursor
        self._buffered_rows = list(buffered_rows or [])
        self.lastrowid = lastrowid

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    def fetchone(self) -> dict[str, Any] | None:
        if self._buffered_rows:
            return self._buffered_rows.pop(0)
        return self._cursor.fetchone()

    def fetchall(self) -> list[dict[str, Any]]:
        rows = list(self._buffered_rows)
        self._buffered_rows.clear()
        rows.extend(self._cursor.fetchall())
        return rows


class ConnectionAdapter:
    def __init__(self, connection: psycopg.Connection[dict[str, Any]]) -> None:
        self._connection = connection

    def __enter__(self) -> ConnectionAdapter:
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        try:
            if exc_type is None:
                self._connection.commit()
            else:
                self._connection.rollback()
        finally:
            self._connection.close()

    def execute(self, query: str, params: tuple[Any, ...] | list[Any] | None = None) -> CursorAdapter:
        sql = _translate_query_placeholders(query)
        append_returning_id = _should_append_returning_id(sql)
        if append_returning_id:
            sql = f"{sql.rstrip().rstrip(';')} RETURNING id"

        cursor = self._connection.execute(sql, params or ())
        buffered_rows: list[dict[str, Any]] = []
        lastrowid: int | None = None

        if append_returning_id:
            row = cursor.fetchone()
            if row:
                buffered_rows.append(row)
                lastrowid = int(row["id"])

        return CursorAdapter(cursor, buffered_rows=buffered_rows, lastrowid=lastrowid)

    def executescript(self, script: str) -> None:
        for statement in _split_sql_script(script):
            self._connection.execute(statement)

    def close(self) -> None:
        self._connection.close()


def get_connection() -> ConnectionAdapter:
    connection = psycopg.connect(
        get_database_url(),
        autocommit=False,
        row_factory=dict_row,
        prepare_threshold=None,
    )
    return ConnectionAdapter(connection)


def initialize_database() -> None:
    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    with get_connection() as connection:
        connection.executescript(schema)


def should_auto_initialize() -> bool:
    return _truthy(os.environ.get("AUTO_INIT_DATABASE"))
