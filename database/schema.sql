CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    cost_price DOUBLE PRECISION NOT NULL,
    sale_price DOUBLE PRECISION NOT NULL,
    stock_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    min_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    document TEXT,
    address TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS sales (
    id BIGSERIAL PRIMARY KEY,
    sale_date TEXT NOT NULL,
    sale_time TEXT NOT NULL DEFAULT '08:00',
    period TEXT NOT NULL DEFAULT 'Manhã',
    amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    customer_id BIGINT REFERENCES customers (id) ON DELETE SET NULL,
    total_amount DOUBLE PRECISION NOT NULL,
    payment_method TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS sale_items (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products (id),
    quantity DOUBLE PRECISION NOT NULL,
    unit_price DOUBLE PRECISION NOT NULL,
    total_price DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS quotes (
    id BIGSERIAL PRIMARY KEY,
    quote_date TEXT NOT NULL,
    validity_date TEXT,
    customer_id BIGINT REFERENCES customers (id) ON DELETE SET NULL,
    subtotal_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    discount_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_amount DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendente',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS quote_items (
    id BIGSERIAL PRIMARY KEY,
    quote_id BIGINT NOT NULL REFERENCES quotes (id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products (id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'UN',
    quantity DOUBLE PRECISION NOT NULL,
    unit_price DOUBLE PRECISION NOT NULL,
    total_price DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
    id BIGSERIAL PRIMARY KEY,
    payment_date TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    payment_method TEXT NOT NULL,
    supplier TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE TABLE IF NOT EXISTS checks (
    id BIGSERIAL PRIMARY KEY,
    check_number TEXT NOT NULL UNIQUE,
    beneficiary TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendente',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales (sale_date);
CREATE INDEX IF NOT EXISTS idx_quotes_date ON quotes (quote_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (payment_date);
CREATE INDEX IF NOT EXISTS idx_checks_due_date ON checks (due_date);
