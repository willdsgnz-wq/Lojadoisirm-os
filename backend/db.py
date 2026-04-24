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


def run_runtime_migrations() -> None:
    statements = [
        """
        ALTER TABLE IF EXISTS quotes
        ADD COLUMN IF NOT EXISTS customer_name_manual TEXT
        """,
        """
        ALTER TABLE IF EXISTS products
        ADD COLUMN IF NOT EXISTS sku TEXT
        """,
        """
        ALTER TABLE IF EXISTS products
        ADD COLUMN IF NOT EXISTS ncm TEXT
        """,
        """
        ALTER TABLE IF EXISTS products
        ADD COLUMN IF NOT EXISTS cfop_default TEXT
        """,
        """
        ALTER TABLE IF EXISTS products
        ADD COLUMN IF NOT EXISTS origin TEXT
        """,
        """
        ALTER TABLE IF EXISTS products
        ADD COLUMN IF NOT EXISTS csosn TEXT
        """,
        """
        ALTER TABLE IF EXISTS products
        ADD COLUMN IF NOT EXISTS notes TEXT
        """,
        """
        ALTER TABLE IF EXISTS products
        ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE
        """,
        """
        ALTER TABLE IF EXISTS expenses
        ADD COLUMN IF NOT EXISTS linked_bill_id BIGINT
        """,
        """
        ALTER TABLE IF EXISTS sale_items
        ADD COLUMN IF NOT EXISTS sku TEXT
        """,
        """
        ALTER TABLE IF EXISTS sale_items
        ADD COLUMN IF NOT EXISTS description TEXT
        """,
        """
        ALTER TABLE IF EXISTS sale_items
        ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'UN'
        """,
        """
        ALTER TABLE IF EXISTS sale_items
        ADD COLUMN IF NOT EXISTS ncm TEXT
        """,
        """
        ALTER TABLE IF EXISTS sale_items
        ADD COLUMN IF NOT EXISTS cfop TEXT
        """,
        """
        ALTER TABLE IF EXISTS sale_items
        ADD COLUMN IF NOT EXISTS origin TEXT
        """,
        """
        ALTER TABLE IF EXISTS sale_items
        ADD COLUMN IF NOT EXISTS csosn TEXT
        """,
        """
        ALTER TABLE IF EXISTS sales
        ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT CURRENT_TIMESTAMP::text
        """,
        """
        CREATE TABLE IF NOT EXISTS stock_movements (
            id BIGSERIAL PRIMARY KEY,
            product_id BIGINT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
            movement_type TEXT NOT NULL,
            quantity DOUBLE PRECISION NOT NULL,
            balance_before DOUBLE PRECISION NOT NULL DEFAULT 0,
            balance_after DOUBLE PRECISION NOT NULL DEFAULT 0,
            reason TEXT,
            document_reference TEXT,
            user_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS bills (
            id BIGSERIAL PRIMARY KEY,
            beneficiary TEXT NOT NULL,
            due_date TEXT NOT NULL,
            amount DOUBLE PRECISION NOT NULL,
            is_paid BOOLEAN NOT NULL DEFAULT FALSE,
            notes TEXT,
            paid_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS nfe_issued (
            id BIGSERIAL PRIMARY KEY,
            sale_id BIGINT REFERENCES sales (id) ON DELETE SET NULL,
            source_type TEXT NOT NULL DEFAULT 'sale',
            customer_name TEXT,
            customer_document TEXT,
            customer_address TEXT,
            customer_phone TEXT,
            customer_notes TEXT,
            payment_method TEXT,
            total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
            number_nfe INTEGER NOT NULL,
            series_nfe INTEGER NOT NULL,
            access_key TEXT NOT NULL UNIQUE,
            authorization_protocol TEXT,
            status_nfe TEXT NOT NULL,
            xml_path TEXT,
            pdf_path TEXT,
            authorization_date TEXT,
            sefaz_message TEXT,
            provider_name TEXT NOT NULL DEFAULT 'mock',
            environment TEXT NOT NULL DEFAULT 'homologation',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
        )
        """,
        """
        ALTER TABLE IF EXISTS nfe_issued
        ALTER COLUMN sale_id DROP NOT NULL
        """,
        """
        ALTER TABLE IF EXISTS nfe_issued
        ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'sale'
        """,
        """
        ALTER TABLE IF EXISTS nfe_issued
        ADD COLUMN IF NOT EXISTS customer_name TEXT
        """,
        """
        ALTER TABLE IF EXISTS nfe_issued
        ADD COLUMN IF NOT EXISTS customer_document TEXT
        """,
        """
        ALTER TABLE IF EXISTS nfe_issued
        ADD COLUMN IF NOT EXISTS customer_address TEXT
        """,
        """
        ALTER TABLE IF EXISTS nfe_issued
        ADD COLUMN IF NOT EXISTS customer_phone TEXT
        """,
        """
        ALTER TABLE IF EXISTS nfe_issued
        ADD COLUMN IF NOT EXISTS customer_notes TEXT
        """,
        """
        ALTER TABLE IF EXISTS nfe_issued
        ADD COLUMN IF NOT EXISTS payment_method TEXT
        """,
        """
        ALTER TABLE IF EXISTS nfe_issued
        ADD COLUMN IF NOT EXISTS total_amount DOUBLE PRECISION DEFAULT 0
        """,
        """
        CREATE TABLE IF NOT EXISTS nfe_items (
            id BIGSERIAL PRIMARY KEY,
            nfe_id BIGINT NOT NULL REFERENCES nfe_issued (id) ON DELETE CASCADE,
            product_id BIGINT REFERENCES products (id) ON DELETE SET NULL,
            sku TEXT,
            description TEXT NOT NULL,
            unit TEXT NOT NULL DEFAULT 'UN',
            quantity DOUBLE PRECISION NOT NULL,
            unit_price DOUBLE PRECISION NOT NULL,
            total_price DOUBLE PRECISION NOT NULL,
            ncm TEXT,
            cfop TEXT,
            origin TEXT,
            csosn TEXT
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS fiscal_settings (
            id BIGSERIAL PRIMARY KEY,
            company_name TEXT,
            trade_name TEXT,
            cnpj TEXT,
            state_registration TEXT,
            tax_regime TEXT,
            street TEXT,
            number TEXT,
            complement TEXT,
            district TEXT,
            city TEXT,
            state TEXT,
            zip_code TEXT,
            phone TEXT,
            email TEXT,
            default_series INTEGER NOT NULL DEFAULT 1,
            next_nfe_number INTEGER NOT NULL DEFAULT 1,
            environment TEXT NOT NULL DEFAULT 'homologation',
            provider_name TEXT NOT NULL DEFAULT 'mock',
            api_token TEXT,
            api_url TEXT,
            certificate_path TEXT,
            certificate_password TEXT,
            csc TEXT,
            allow_negative_stock BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku)",
        "CREATE INDEX IF NOT EXISTS idx_products_category ON products (category)",
        "CREATE INDEX IF NOT EXISTS idx_products_ncm ON products (ncm)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_linked_bill_id_unique ON expenses (linked_bill_id) WHERE linked_bill_id IS NOT NULL",
        "CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills (due_date)",
        "CREATE INDEX IF NOT EXISTS idx_bills_is_paid ON bills (is_paid)",
        "CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements (created_at)",
        "CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements (product_id)",
        "CREATE INDEX IF NOT EXISTS idx_nfe_issued_sale_id ON nfe_issued (sale_id)",
        "CREATE INDEX IF NOT EXISTS idx_nfe_items_nfe_id ON nfe_items (nfe_id)",
    ]

    with get_connection() as connection:
        row = connection.execute("SELECT to_regclass('public.users') AS table_name").fetchone()
        if not row or not row.get("table_name"):
            return

        for statement in statements:
            connection.execute(statement)

        connection.execute("UPDATE products SET sku = code WHERE sku IS NULL OR TRIM(sku) = ''")
        connection.execute("UPDATE products SET active = TRUE WHERE active IS NULL")
        connection.execute("UPDATE products SET notes = COALESCE(notes, '') WHERE notes IS NULL")
        connection.execute("UPDATE nfe_issued SET source_type = COALESCE(NULLIF(source_type, ''), 'sale') WHERE source_type IS NULL OR source_type = ''")
        connection.execute(
            """
            UPDATE nfe_issued
            SET total_amount = sales.total_amount
            FROM sales
            WHERE nfe_issued.sale_id = sales.id
              AND COALESCE(nfe_issued.total_amount, 0) = 0
            """
        )
        connection.execute("UPDATE sale_items SET description = COALESCE(description, '') WHERE description IS NULL")
        connection.execute("UPDATE sale_items SET unit = COALESCE(NULLIF(unit, ''), 'UN') WHERE unit IS NULL OR unit = ''")
        connection.execute("UPDATE sale_items SET sku = COALESCE(sku, '') WHERE sku IS NULL")
        connection.execute(
            """
            UPDATE sale_items
            SET description = products.name,
                sku = COALESCE(NULLIF(sale_items.sku, ''), products.sku, products.code),
                unit = COALESCE(NULLIF(sale_items.unit, ''), products.unit, 'UN'),
                ncm = COALESCE(sale_items.ncm, products.ncm),
                cfop = COALESCE(sale_items.cfop, products.cfop_default),
                origin = COALESCE(sale_items.origin, products.origin),
                csosn = COALESCE(sale_items.csosn, products.csosn)
            FROM products
            WHERE sale_items.product_id = products.id
              AND (sale_items.description = '' OR sale_items.description IS NULL)
            """
        )

        connection.execute(
            """
            INSERT INTO fiscal_settings (company_name, trade_name, environment, provider_name)
            SELECT NULL, NULL, 'homologation', 'mock'
            WHERE NOT EXISTS (SELECT 1 FROM fiscal_settings)
            """
        )


def should_auto_initialize() -> bool:
    return _truthy(os.environ.get("AUTO_INIT_DATABASE"))
