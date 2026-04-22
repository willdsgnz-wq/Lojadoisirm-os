-- =========================
-- USERS
-- =========================
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

-- =========================
-- PRODUCTS
-- =========================
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    sku TEXT,
    code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL,
    cost_price DOUBLE PRECISION NOT NULL DEFAULT 0,
    sale_price DOUBLE PRECISION NOT NULL DEFAULT 0,
    stock_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    min_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
    ncm TEXT,
    cfop_default TEXT,
    origin TEXT,
    csosn TEXT,
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

-- =========================
-- CUSTOMERS
-- =========================
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

-- =========================
-- SALES
-- =========================
CREATE TABLE IF NOT EXISTS sales (
    id BIGSERIAL PRIMARY KEY,
    sale_date TEXT NOT NULL,
    sale_time TEXT NOT NULL DEFAULT '08:00',
    period TEXT NOT NULL DEFAULT 'Manhã',
    amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    customer_id BIGINT REFERENCES customers (id) ON DELETE SET NULL,
    total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

-- =========================
-- SALE ITEMS
-- =========================
CREATE TABLE IF NOT EXISTS sale_items (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products (id) ON DELETE SET NULL,
    sku TEXT,
    description TEXT,
    unit TEXT NOT NULL DEFAULT 'UN',
    quantity DOUBLE PRECISION NOT NULL,
    unit_price DOUBLE PRECISION NOT NULL,
    total_price DOUBLE PRECISION NOT NULL,
    ncm TEXT,
    cfop TEXT,
    origin TEXT,
    csosn TEXT
);

-- =========================
-- QUOTES
-- =========================
CREATE TABLE IF NOT EXISTS quotes (
    id BIGSERIAL PRIMARY KEY,
    quote_date TEXT NOT NULL,
    validity_date TEXT,
    customer_id BIGINT REFERENCES customers (id) ON DELETE SET NULL,
    customer_name_manual TEXT,
    subtotal_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    discount_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pendente',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);

-- =========================
-- QUOTE ITEMS
-- =========================
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

-- =========================
-- EXPENSES
-- =========================
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

-- =========================
-- CHECKS
-- =========================
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

-- =========================
-- STOCK MOVEMENTS
-- =========================
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
);

-- =========================
-- NFE
-- =========================
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
);

-- =========================
-- NFE ITEMS
-- =========================
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
);

-- =========================
-- FISCAL SETTINGS
-- =========================
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
);

-- =========================
-- FIX PARA BANCO ANTIGO
-- =========================
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS ncm TEXT;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS cfop_default TEXT;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS origin TEXT;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS csosn TEXT;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- =========================
-- INDEXES
-- =========================
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_ncm ON products (ncm);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales (sale_date);
CREATE INDEX IF NOT EXISTS idx_quotes_date ON quotes (quote_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (payment_date);
CREATE INDEX IF NOT EXISTS idx_checks_due_date ON checks (due_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements (created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_nfe_issued_sale_id ON nfe_issued (sale_id);
CREATE INDEX IF NOT EXISTS idx_nfe_items_nfe_id ON nfe_items (nfe_id);
