from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any

from backend.auth import hash_password, verify_password
from backend.db import ForeignKeyViolation, UniqueViolation, get_connection
from backend.utils import ensure_date, parse_iso_date, round_money, today_iso


PAYMENT_METHODS = ["Dinheiro", "Pix", "Débito", "Crédito", "Cheque", "Boleto", "Prazo", "Outro", "Outros"]
PRODUCT_UNITS = ["un", "kg", "m", "m2", "m3", "cx", "sc", "lt"]
QUOTE_ITEM_UNITS = ["UN", "MT", "M²", "M³", "KG", "SC", "CX", "PCT", "LT", "Outro"]
QUOTE_STATUSES = ["Pendente", "Aprovado", "Nao aprovado"]
CHECK_STATUSES = ["Pendente", "Compensado", "Atrasado", "Cancelado"]

SALES_PAYMENT_METHODS = ["Dinheiro", "Pix", "Débito", "Crédito", "Boleto", "Prazo", "Outro"]


class ServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _require_text(value: Any, label: str) -> str:
    cleaned = _clean_text(value)
    if not cleaned:
        raise ServiceError(f"O campo '{label}' é obrigatório.")
    return cleaned


def _parse_amount(value: Any, label: str, *, min_value: float = 0, allow_zero: bool = True) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise ServiceError(f"Informe um valor válido para '{label}'.") from exc

    if numeric < min_value or (not allow_zero and numeric == 0):
        raise ServiceError(f"Informe um valor válido para '{label}'.")
    return round_money(numeric)


def _current_sale_date() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _current_sale_time() -> str:
    return datetime.now().strftime("%H:%M")


def _normalize_sale_time(value: Any) -> str:
    time_value = _clean_text(value) or _current_sale_time()
    try:
        parsed = datetime.strptime(time_value, "%H:%M")
    except ValueError as exc:
        raise ServiceError("Informe um horário de venda válido no formato HH:MM.") from exc
    return parsed.strftime("%H:%M")


def _infer_period(time_value: str) -> str:
    return "Manhã" if time_value <= "12:00" else "Tarde"


def _serialize_user(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "username": row["username"],
        "full_name": row["full_name"],
    }


def ensure_demo_user() -> None:
    with get_connection() as connection:
        existing = connection.execute("SELECT id FROM users WHERE username = ?", ("admin",)).fetchone()
        if existing:
            return
        connection.execute(
            """
            INSERT INTO users (username, full_name, password_hash)
            VALUES (?, ?, ?)
            """,
            ("admin", "Administrador da Loja", hash_password("123456")),
        )


def authenticate_user(username: str, password: str) -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM users WHERE username = ?", (username.strip(),)).fetchone()

    if not row or not verify_password(password, row["password_hash"]):
        raise ServiceError("Usuário ou senha inválidos.", 401)
    return _serialize_user(row)


def get_user_by_id(user_id: int | str | None) -> dict[str, Any] | None:
    if not user_id:
        return None
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM users WHERE id = ?", (int(user_id),)).fetchone()
    if not row:
        return None
    return _serialize_user(row)


def _rows_to_dicts(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def list_products() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM products
            ORDER BY LOWER(name)
            """
        ).fetchall()
    products = _rows_to_dicts(rows)
    for product in products:
        product["low_stock"] = product["stock_quantity"] <= product["min_stock"]
    return products


def create_product(payload: dict[str, Any]) -> dict[str, Any]:
    name = _require_text(payload.get("name"), "name")
    code = _require_text(payload.get("code"), "code")
    category = _require_text(payload.get("category"), "category")
    unit = _require_text(payload.get("unit"), "unit")
    cost_price = _parse_amount(payload.get("cost_price"), "cost_price", min_value=0)
    sale_price = _parse_amount(payload.get("sale_price"), "sale_price", min_value=0)
    stock_quantity = _parse_amount(payload.get("stock_quantity", 0), "stock_quantity", min_value=0)
    min_stock = _parse_amount(payload.get("min_stock", 0), "min_stock", min_value=0)

    now = today_iso()
    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO products (
                    name, code, category, unit, cost_price, sale_price,
                    stock_quantity, min_stock, description, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    name,
                    code,
                    category,
                    unit,
                    cost_price,
                    sale_price,
                    stock_quantity,
                    min_stock,
                    _clean_text(payload.get("description")),
                    now,
                ),
            )
            product_id = cursor.lastrowid
    except UniqueViolation as exc:
        raise ServiceError("Já existe um produto com esse código.") from exc

    return get_product(product_id)


def get_product(product_id: int) -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not row:
        raise ServiceError("Produto não encontrado.", 404)
    product = dict(row)
    product["low_stock"] = product["stock_quantity"] <= product["min_stock"]
    return product


def update_product(product_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    current = get_product(product_id)
    values = {
        "name": _require_text(payload.get("name", current["name"]), "name"),
        "code": _require_text(payload.get("code", current["code"]), "code"),
        "category": _require_text(payload.get("category", current["category"]), "category"),
        "unit": _require_text(payload.get("unit", current["unit"]), "unit"),
        "cost_price": _parse_amount(payload.get("cost_price", current["cost_price"]), "cost_price", min_value=0),
        "sale_price": _parse_amount(payload.get("sale_price", current["sale_price"]), "sale_price", min_value=0),
        "stock_quantity": _parse_amount(payload.get("stock_quantity", current["stock_quantity"]), "stock_quantity", min_value=0),
        "min_stock": _parse_amount(payload.get("min_stock", current["min_stock"]), "min_stock", min_value=0),
        "description": _clean_text(payload.get("description") if payload.get("description") is not None else current["description"]),
        "updated_at": today_iso(),
    }

    try:
        with get_connection() as connection:
            connection.execute(
                """
                UPDATE products
                SET name = ?, code = ?, category = ?, unit = ?, cost_price = ?,
                    sale_price = ?, stock_quantity = ?, min_stock = ?,
                    description = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    values["name"],
                    values["code"],
                    values["category"],
                    values["unit"],
                    values["cost_price"],
                    values["sale_price"],
                    values["stock_quantity"],
                    values["min_stock"],
                    values["description"],
                    values["updated_at"],
                    product_id,
                ),
            )
    except UniqueViolation as exc:
        raise ServiceError("Já existe outro produto com esse código.") from exc
    return get_product(product_id)


def delete_product(product_id: int) -> None:
    try:
        with get_connection() as connection:
            deleted = connection.execute("DELETE FROM products WHERE id = ?", (product_id,)).rowcount
    except ForeignKeyViolation as exc:
        raise ServiceError("Esse produto já foi usado em vendas ou orçamentos e não pode ser excluído.", 409) from exc

    if not deleted:
        raise ServiceError("Produto não encontrado.", 404)


def list_customers() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM customers
            ORDER BY LOWER(name)
            """
        ).fetchall()
    return _rows_to_dicts(rows)


def create_customer(payload: dict[str, Any]) -> dict[str, Any]:
    name = _require_text(payload.get("name"), "name")

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO customers (name, phone, document, address, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                _clean_text(payload.get("phone")),
                _clean_text(payload.get("document")),
                _clean_text(payload.get("address")),
                _clean_text(payload.get("notes")),
                today_iso(),
            ),
        )
        customer_id = cursor.lastrowid
    return get_customer(customer_id)


def get_customer(customer_id: int) -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    if not row:
        raise ServiceError("Cliente não encontrado.", 404)
    return dict(row)


def update_customer(customer_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    current = get_customer(customer_id)
    values = {
        "name": _require_text(payload.get("name", current["name"]), "name"),
        "phone": _clean_text(payload.get("phone") if payload.get("phone") is not None else current["phone"]),
        "document": _clean_text(payload.get("document") if payload.get("document") is not None else current["document"]),
        "address": _clean_text(payload.get("address") if payload.get("address") is not None else current["address"]),
        "notes": _clean_text(payload.get("notes") if payload.get("notes") is not None else current["notes"]),
        "updated_at": today_iso(),
    }
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE customers
            SET name = ?, phone = ?, document = ?, address = ?, notes = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                values["name"],
                values["phone"],
                values["document"],
                values["address"],
                values["notes"],
                values["updated_at"],
                customer_id,
            ),
        )
    return get_customer(customer_id)


def delete_customer(customer_id: int) -> None:
    try:
        with get_connection() as connection:
            deleted = connection.execute("DELETE FROM customers WHERE id = ?", (customer_id,)).rowcount
    except ForeignKeyViolation as exc:
        raise ServiceError("Esse cliente já foi usado em vendas ou orçamentos e não pode ser excluído.", 409) from exc
    if not deleted:
        raise ServiceError("Cliente não encontrado.", 404)


def _load_products_map(connection: Any, product_ids: list[int]) -> dict[int, dict[str, Any]]:
    if not product_ids:
        return {}
    placeholders = ",".join("?" for _ in product_ids)
    rows = connection.execute(
        f"SELECT * FROM products WHERE id IN ({placeholders})",
        tuple(product_ids),
    ).fetchall()
    return {row["id"]: dict(row) for row in rows}


def _prepare_quote_items(raw_items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], float]:
    if not raw_items:
        raise ServiceError("Adicione pelo menos um item manual ao orçamento.")

    items: list[dict[str, Any]] = []
    for index, item in enumerate(raw_items, start=1):
        name = _clean_text(item.get("item_name"))
        if not name:
            raise ServiceError(f"Informe o nome do item {index}.")
        unit = _clean_text(item.get("unit")) or "UN"
        if unit not in QUOTE_ITEM_UNITS:
            raise ServiceError(f"Selecione uma unidade válida no item {index}.")

        try:
            quantity = float(item.get("quantity") or 0)
        except (TypeError, ValueError) as exc:
            raise ServiceError(f"Informe uma quantidade válida no item {index}.") from exc

        if quantity <= 0:
            raise ServiceError(f"A quantidade do item {index} deve ser maior que zero.")

        unit_price = _parse_amount(item.get("unit_price"), f"unit_price_{index}", min_value=0, allow_zero=True)
        total_price = round_money(quantity * unit_price)
        items.append(
            {
                "item_name": name,
                "unit": unit,
                "quantity": quantity,
                "unit_price": unit_price,
                "total_price": total_price,
            }
        )

    subtotal_amount = round_money(sum(item["total_price"] for item in items))
    return items, subtotal_amount


def _validate_stock(connection: Any, items: list[dict[str, Any]]) -> None:
    product_ids = [item["product_id"] for item in items]
    products_map = _load_products_map(connection, product_ids)
    for item in items:
        product = products_map[item["product_id"]]
        if float(product["stock_quantity"]) < item["quantity"]:
            raise ServiceError(
                f"Estoque insuficiente para o produto '{product['name']}'. Disponível: {product['stock_quantity']}.",
                409,
            )


def _serialize_sale_rows(rows: list[dict[str, Any]], items_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    items_by_sale: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in items_rows:
        items_by_sale[row["sale_id"]].append(
            {
                "id": row["id"],
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "product_code": row["product_code"],
                "quantity": row["quantity"],
                "unit_price": row["unit_price"],
                "total_price": row["total_price"],
            }
        )

    sales: list[dict[str, Any]] = []
    for row in rows:
        sale = dict(row)
        sale["amount"] = round_money(sale.get("amount", sale.get("total_amount", 0)))
        sale["total_amount"] = sale["amount"]
        sale["sale_time"] = sale.get("sale_time") or "08:00"
        sale["period"] = sale.get("period") or _infer_period(sale["sale_time"])
        sale["customer_name"] = sale["customer_name"] or "Balcão"
        sale["items"] = items_by_sale.get(row["id"], [])
        sales.append(sale)
    return sales


def list_sales() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                sales.*,
                COALESCE(sales.amount, sales.total_amount) AS amount,
                customers.name AS customer_name
            FROM sales
            LEFT JOIN customers ON customers.id = sales.customer_id
            ORDER BY sales.sale_date DESC, sales.sale_time DESC, sales.id DESC
            """
        ).fetchall()
        sale_ids = [row["id"] for row in rows]
        if sale_ids:
            placeholders = ",".join("?" for _ in sale_ids)
            items_rows = connection.execute(
                f"""
                SELECT sale_items.*, products.name AS product_name, products.code AS product_code
                FROM sale_items
                JOIN products ON products.id = sale_items.product_id
                WHERE sale_items.sale_id IN ({placeholders})
                ORDER BY sale_items.id
                """,
                tuple(sale_ids),
            ).fetchall()
        else:
            items_rows = []
    return _serialize_sale_rows(rows, items_rows)


def create_sale(payload: dict[str, Any]) -> dict[str, Any]:
    sale_date = ensure_date(payload.get("sale_date"), _current_sale_date())
    sale_time = _normalize_sale_time(payload.get("sale_time"))
    payment_method = _clean_text(payload.get("payment_method"))
    if payment_method not in PAYMENT_METHODS:
        raise ServiceError("Escolha uma forma de pagamento válida.")

    amount = _parse_amount(payload.get("amount", payload.get("total_amount")), "amount", min_value=0.01, allow_zero=False)
    period = _infer_period(sale_time)
    customer_id = payload.get("customer_id") or None

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO sales (sale_date, sale_time, period, amount, customer_id, total_amount, payment_method, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                sale_date,
                sale_time,
                period,
                amount,
                int(customer_id) if customer_id else None,
                amount,
                payment_method,
                _clean_text(payload.get("notes")),
            ),
        )
        sale_id = cursor.lastrowid

    return next(sale for sale in list_sales() if sale["id"] == sale_id)


def update_sale(sale_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        existing = connection.execute("SELECT * FROM sales WHERE id = ?", (sale_id,)).fetchone()
        if not existing:
            raise ServiceError("Venda não encontrada.", 404)

        sale_time = _normalize_sale_time(payload.get("sale_time", existing["sale_time"]))
        payment_method = _clean_text(payload.get("payment_method", existing["payment_method"]))
        if payment_method not in PAYMENT_METHODS:
            raise ServiceError("Escolha uma forma de pagamento válida.")
        amount = _parse_amount(
            payload.get("amount", payload.get("total_amount", existing["total_amount"])),
            "amount",
            min_value=0.01,
            allow_zero=False,
        )
        period = _infer_period(sale_time)

        connection.execute(
            """
            UPDATE sales
            SET sale_date = ?, sale_time = ?, period = ?, amount = ?, customer_id = ?, total_amount = ?, payment_method = ?, notes = ?
            WHERE id = ?
            """,
            (
                ensure_date(payload.get("sale_date"), existing["sale_date"]),
                sale_time,
                period,
                amount,
                int(payload["customer_id"]) if payload.get("customer_id") else None,
                amount,
                payment_method,
                _clean_text(payload.get("notes") if payload.get("notes") is not None else existing["notes"]),
                sale_id,
            ),
        )

    return next(sale for sale in list_sales() if sale["id"] == sale_id)


def delete_sale(sale_id: int) -> None:
    with get_connection() as connection:
        sale = connection.execute("SELECT id FROM sales WHERE id = ?", (sale_id,)).fetchone()
        if not sale:
            raise ServiceError("Venda não encontrada.", 404)

        old_items = connection.execute(
            "SELECT product_id, quantity FROM sale_items WHERE sale_id = ?",
            (sale_id,),
        ).fetchall()
        for item in old_items:
            connection.execute(
                "UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?",
                (item["quantity"], today_iso(), item["product_id"]),
            )
        connection.execute("DELETE FROM sales WHERE id = ?", (sale_id,))


def _serialize_quote_rows(rows: list[dict[str, Any]], items_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    items_by_quote: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in items_rows:
        items_by_quote[row["quote_id"]].append(
            {
                "id": row["id"],
                "product_id": row["product_id"],
                "item_name": row["item_name"],
                "product_name": row["item_name"],
                "unit": row["unit"],
                "quantity": row["quantity"],
                "unit_price": row["unit_price"],
                "total_price": row["total_price"],
            }
        )

    quotes: list[dict[str, Any]] = []
    for row in rows:
        quote = dict(row)
        quote["customer_name_manual"] = _clean_text(quote.get("customer_name_manual"))
        quote["customer_name"] = quote["customer_name"] or "Cliente não informado"
        quote["validity_date"] = quote.get("validity_date") or quote["quote_date"]
        quote["subtotal_amount"] = round_money(quote.get("subtotal_amount", quote["total_amount"]))
        quote["discount_amount"] = round_money(quote.get("discount_amount", 0))
        quote["items"] = items_by_quote.get(row["id"], [])
        quotes.append(quote)
    return quotes


def list_quotes() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                quotes.*,
                COALESCE(NULLIF(TRIM(quotes.customer_name_manual), ''), customers.name) AS customer_name
            FROM quotes
            LEFT JOIN customers ON customers.id = quotes.customer_id
            ORDER BY quotes.quote_date DESC, quotes.id DESC
            """
        ).fetchall()
        quote_ids = [row["id"] for row in rows]
        if quote_ids:
            placeholders = ",".join("?" for _ in quote_ids)
            items_rows = connection.execute(
                f"""
                SELECT quote_items.*
                FROM quote_items
                WHERE quote_items.quote_id IN ({placeholders})
                ORDER BY quote_items.id
                """,
                tuple(quote_ids),
            ).fetchall()
        else:
            items_rows = []
    return _serialize_quote_rows(rows, items_rows)


def create_quote(payload: dict[str, Any]) -> dict[str, Any]:
    quote_date = ensure_date(payload.get("quote_date"))
    validity_date = ensure_date(payload.get("validity_date"), quote_date)
    status = payload.get("status") or "Pendente"
    if status not in QUOTE_STATUSES:
        raise ServiceError("Escolha um status de orçamento válido.")

    customer_id = payload.get("customer_id") or None
    customer_name_manual = _clean_text(payload.get("customer_name_manual"))
    items, subtotal_amount = _prepare_quote_items(payload.get("items") or [])
    discount_amount = _parse_amount(payload.get("discount_amount", 0), "discount_amount", min_value=0, allow_zero=True)
    if discount_amount > subtotal_amount:
        raise ServiceError("O desconto não pode ser maior que o subtotal do orçamento.")
    total_amount = round_money(subtotal_amount - discount_amount)

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO quotes (
                quote_date, validity_date, customer_id, customer_name_manual, subtotal_amount,
                discount_amount, total_amount, status, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                quote_date,
                validity_date,
                int(customer_id) if customer_id else None,
                customer_name_manual or None,
                subtotal_amount,
                discount_amount,
                total_amount,
                status,
                _clean_text(payload.get("notes")),
            ),
        )
        quote_id = cursor.lastrowid
        for item in items:
            connection.execute(
                """
                INSERT INTO quote_items (quote_id, product_id, item_name, unit, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    quote_id,
                    None,
                    item["item_name"],
                    item["unit"],
                    item["quantity"],
                    item["unit_price"],
                    item["total_price"],
                ),
            )
    return next(quote for quote in list_quotes() if quote["id"] == quote_id)


def update_quote(quote_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    with get_connection() as connection:
        existing = connection.execute("SELECT * FROM quotes WHERE id = ?", (quote_id,)).fetchone()
        if not existing:
            raise ServiceError("Orçamento não encontrado.", 404)

        items, subtotal_amount = _prepare_quote_items(payload.get("items") or [])
        status = payload.get("status") or existing["status"]
        if status not in QUOTE_STATUSES:
            raise ServiceError("Escolha um status de orçamento válido.")
        customer_name_manual = _clean_text(
            payload.get("customer_name_manual")
            if payload.get("customer_name_manual") is not None
            else existing.get("customer_name_manual")
        )
        discount_amount = _parse_amount(
            payload.get("discount_amount", existing["discount_amount"]),
            "discount_amount",
            min_value=0,
            allow_zero=True,
        )
        if discount_amount > subtotal_amount:
            raise ServiceError("O desconto não pode ser maior que o subtotal do orçamento.")
        total_amount = round_money(subtotal_amount - discount_amount)

        connection.execute(
            """
            UPDATE quotes
            SET quote_date = ?, validity_date = ?, customer_id = ?, customer_name_manual = ?,
                subtotal_amount = ?, discount_amount = ?, total_amount = ?, status = ?, notes = ?
            WHERE id = ?
            """,
            (
                ensure_date(payload.get("quote_date"), existing["quote_date"]),
                ensure_date(payload.get("validity_date"), existing["validity_date"] or existing["quote_date"]),
                int(payload["customer_id"]) if payload.get("customer_id") else None,
                customer_name_manual or None,
                subtotal_amount,
                discount_amount,
                total_amount,
                status,
                _clean_text(payload.get("notes") if payload.get("notes") is not None else existing["notes"]),
                quote_id,
            ),
        )
        connection.execute("DELETE FROM quote_items WHERE quote_id = ?", (quote_id,))
        for item in items:
            connection.execute(
                """
                INSERT INTO quote_items (quote_id, product_id, item_name, unit, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    quote_id,
                    None,
                    item["item_name"],
                    item["unit"],
                    item["quantity"],
                    item["unit_price"],
                    item["total_price"],
                ),
            )
    return next(quote for quote in list_quotes() if quote["id"] == quote_id)


def delete_quote(quote_id: int) -> None:
    with get_connection() as connection:
        deleted = connection.execute("DELETE FROM quotes WHERE id = ?", (quote_id,)).rowcount
    if not deleted:
        raise ServiceError("Orçamento não encontrado.", 404)


def list_expenses() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM expenses
            ORDER BY payment_date DESC, id DESC
            """
        ).fetchall()
    return _rows_to_dicts(rows)


def create_expense(payload: dict[str, Any]) -> dict[str, Any]:
    payment_date = ensure_date(payload.get("payment_date"))
    description = _require_text(payload.get("description"), "description")
    category = _require_text(payload.get("category"), "category")
    amount = _parse_amount(payload.get("amount"), "amount", min_value=0.01, allow_zero=False)
    payment_method = _require_text(payload.get("payment_method"), "payment_method")

    if payment_method not in PAYMENT_METHODS:
        raise ServiceError("Escolha uma forma de pagamento válida.")

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO expenses (payment_date, description, category, amount, payment_method, supplier, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payment_date,
                description,
                category,
                amount,
                payment_method,
                _clean_text(payload.get("supplier")),
                _clean_text(payload.get("notes")),
            ),
        )
        expense_id = cursor.lastrowid
    return get_expense(expense_id)


def get_expense(expense_id: int) -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM expenses WHERE id = ?", (expense_id,)).fetchone()
    if not row:
        raise ServiceError("Conta paga não encontrada.", 404)
    return dict(row)


def update_expense(expense_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    current = get_expense(expense_id)
    payment_method = _require_text(payload.get("payment_method", current["payment_method"]), "payment_method")
    if payment_method not in PAYMENT_METHODS:
        raise ServiceError("Escolha uma forma de pagamento válida.")

    with get_connection() as connection:
        connection.execute(
            """
            UPDATE expenses
            SET payment_date = ?, description = ?, category = ?, amount = ?,
                payment_method = ?, supplier = ?, notes = ?
            WHERE id = ?
            """,
            (
                ensure_date(payload.get("payment_date"), current["payment_date"]),
                _require_text(payload.get("description", current["description"]), "description"),
                _require_text(payload.get("category", current["category"]), "category"),
                _parse_amount(payload.get("amount", current["amount"]), "amount", min_value=0.01, allow_zero=False),
                payment_method,
                _clean_text(payload.get("supplier") if payload.get("supplier") is not None else current["supplier"]),
                _clean_text(payload.get("notes") if payload.get("notes") is not None else current["notes"]),
                expense_id,
            ),
        )
    return get_expense(expense_id)


def delete_expense(expense_id: int) -> None:
    with get_connection() as connection:
        deleted = connection.execute("DELETE FROM expenses WHERE id = ?", (expense_id,)).rowcount
    if not deleted:
        raise ServiceError("Conta paga não encontrada.", 404)


def _serialize_check(row: dict[str, Any]) -> dict[str, Any]:
    item = dict(row)
    status = item["status"]
    today = date.today()
    issue_date = parse_iso_date(item["issue_date"])
    due_date = parse_iso_date(item["due_date"])

    days_pending = (today - issue_date).days if issue_date else 0
    days_pending = max(days_pending, 0)

    days_overdue = 0
    effective_status = status
    if status not in {"Compensado", "Cancelado"} and due_date and today > due_date:
        effective_status = "Atrasado"
        days_overdue = (today - due_date).days

    item["effective_status"] = effective_status
    item["days_pending"] = days_pending
    item["days_overdue"] = days_overdue
    item["is_overdue"] = effective_status == "Atrasado"
    return item


def list_checks() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM checks
            ORDER BY due_date ASC, id DESC
            """
        ).fetchall()
    return [_serialize_check(row) for row in rows]


def create_check(payload: dict[str, Any]) -> dict[str, Any]:
    check_number = _require_text(payload.get("check_number"), "check_number")
    beneficiary = _require_text(payload.get("beneficiary"), "beneficiary")
    amount = _parse_amount(payload.get("amount"), "amount", min_value=0.01, allow_zero=False)
    issue_date = ensure_date(payload.get("issue_date"))
    due_date = ensure_date(payload.get("due_date"))
    status = _require_text(payload.get("status"), "status")
    if status not in CHECK_STATUSES:
        raise ServiceError("Escolha um status de cheque válido.")
    if due_date < issue_date:
        raise ServiceError("A data prevista do cheque não pode ser anterior à data de emissão.")

    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO checks (check_number, beneficiary, amount, issue_date, due_date, status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    check_number,
                    beneficiary,
                    amount,
                    issue_date,
                    due_date,
                    status,
                    _clean_text(payload.get("notes")),
                ),
            )
            check_id = cursor.lastrowid
    except UniqueViolation as exc:
        raise ServiceError("Já existe um cheque com esse número.") from exc
    return next(check for check in list_checks() if check["id"] == check_id)


def get_check(check_id: int) -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM checks WHERE id = ?", (check_id,)).fetchone()
    if not row:
        raise ServiceError("Cheque não encontrado.", 404)
    return _serialize_check(row)


def update_check(check_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    current = get_check(check_id)
    status = _require_text(payload.get("status", current["status"]), "status")
    if status not in CHECK_STATUSES:
        raise ServiceError("Escolha um status de cheque válido.")
    issue_date = ensure_date(payload.get("issue_date"), current["issue_date"])
    due_date = ensure_date(payload.get("due_date"), current["due_date"])
    if due_date < issue_date:
        raise ServiceError("A data prevista do cheque não pode ser anterior à data de emissão.")

    try:
        with get_connection() as connection:
            connection.execute(
                """
                UPDATE checks
                SET check_number = ?, beneficiary = ?, amount = ?, issue_date = ?,
                    due_date = ?, status = ?, notes = ?
                WHERE id = ?
                """,
                (
                    _require_text(payload.get("check_number", current["check_number"]), "check_number"),
                    _require_text(payload.get("beneficiary", current["beneficiary"]), "beneficiary"),
                    _parse_amount(payload.get("amount", current["amount"]), "amount", min_value=0.01, allow_zero=False),
                    issue_date,
                    due_date,
                    status,
                    _clean_text(payload.get("notes") if payload.get("notes") is not None else current["notes"]),
                    check_id,
                ),
            )
    except UniqueViolation as exc:
        raise ServiceError("Já existe outro cheque com esse número.") from exc
    return get_check(check_id)


def delete_check(check_id: int) -> None:
    with get_connection() as connection:
        deleted = connection.execute("DELETE FROM checks WHERE id = ?", (check_id,)).rowcount
    if not deleted:
        raise ServiceError("Cheque não encontrado.", 404)


def get_bootstrap_data() -> dict[str, Any]:
    return {
        "products": list_products(),
        "customers": list_customers(),
        "sales": list_sales(),
        "quotes": list_quotes(),
        "expenses": list_expenses(),
        "checks": list_checks(),
        "options": {
            "payment_methods": PAYMENT_METHODS,
            "sales_payment_methods": SALES_PAYMENT_METHODS,
            "product_units": PRODUCT_UNITS,
            "quote_item_units": QUOTE_ITEM_UNITS,
            "quote_statuses": QUOTE_STATUSES,
            "check_statuses": CHECK_STATUSES,
        },
    }
def create_user(data: dict[str, Any]) -> dict[str, Any]:
    username = _require_text(data.get("username"), "username")
    full_name = _clean_text(data.get("full_name"))
    password = _require_text(data.get("password"), "password")

    password_hash = hash_password(password)

    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (username, full_name, password_hash)
                VALUES (?, ?, ?)
                """,
                (username, full_name, password_hash),
            )
            user_id = cursor.lastrowid
    except UniqueViolation as exc:
        raise ServiceError("Usuário já existe.") from exc

    return get_user_by_id(user_id)
