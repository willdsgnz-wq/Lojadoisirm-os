from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path
from typing import Any

import psycopg

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.db import get_database_url, initialize_database


BASE_DIR = PROJECT_ROOT
DEFAULT_SQLITE_PATH = BASE_DIR / "database" / "store.db"
TABLES = [
    "users",
    "products",
    "customers",
    "sales",
    "sale_items",
    "quotes",
    "quote_items",
    "expenses",
    "checks",
]


def _quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def _reset_sequence(cursor: psycopg.Cursor[Any], table: str) -> None:
    cursor.execute(
        f"""
        SELECT setval(
            pg_get_serial_sequence(%s, 'id'),
            COALESCE((SELECT MAX(id) FROM {_quote_identifier(table)}), 1),
            EXISTS(SELECT 1 FROM {_quote_identifier(table)})
        )
        """,
        (table,),
    )


def _truncate_tables(cursor: psycopg.Cursor[Any]) -> None:
    joined = ", ".join(_quote_identifier(table) for table in reversed(TABLES))
    cursor.execute(f"TRUNCATE TABLE {joined} RESTART IDENTITY CASCADE")


def _copy_table(
    sqlite_connection: sqlite3.Connection,
    postgres_cursor: psycopg.Cursor[Any],
    table: str,
) -> int:
    sqlite_connection.row_factory = sqlite3.Row
    rows = sqlite_connection.execute(f"SELECT * FROM {table}").fetchall()
    if not rows:
        return 0

    columns = list(rows[0].keys())
    column_list = ", ".join(_quote_identifier(column) for column in columns)
    placeholders = ", ".join(["%s"] * len(columns))
    sql = f"INSERT INTO {_quote_identifier(table)} ({column_list}) VALUES ({placeholders})"

    values = [tuple(row[column] for column in columns) for row in rows]
    postgres_cursor.executemany(sql, values)
    _reset_sequence(postgres_cursor, table)
    return len(values)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migra dados do antigo SQLite local para o Postgres/Supabase."
    )
    parser.add_argument(
        "--sqlite-path",
        default=str(DEFAULT_SQLITE_PATH),
        help="Caminho do arquivo SQLite antigo.",
    )
    parser.add_argument(
        "--reset-target",
        action="store_true",
        help="Apaga os dados atuais do Postgres antes de importar.",
    )
    args = parser.parse_args()

    sqlite_path = Path(args.sqlite_path).resolve()
    if not sqlite_path.exists():
        raise SystemExit(f"Arquivo SQLite nao encontrado: {sqlite_path}")

    initialize_database()

    sqlite_connection = sqlite3.connect(sqlite_path)
    postgres_connection = psycopg.connect(get_database_url(), autocommit=False, prepare_threshold=None)

    try:
        with postgres_connection.cursor() as cursor:
            if args.reset_target:
                _truncate_tables(cursor)

            migrated_counts: dict[str, int] = {}
            for table in TABLES:
                migrated_counts[table] = _copy_table(sqlite_connection, cursor, table)

        postgres_connection.commit()
    except Exception:
        postgres_connection.rollback()
        raise
    finally:
        sqlite_connection.close()
        postgres_connection.close()

    print("Migracao concluida com sucesso.")
    for table in TABLES:
        print(f"- {table}: {migrated_counts.get(table, 0)} registro(s)")


if __name__ == "__main__":
    main()
