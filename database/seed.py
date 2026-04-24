from __future__ import annotations

from datetime import date, timedelta

from backend.db import get_connection
from backend.services import (
    create_check,
    create_customer,
    create_expense,
    create_product,
    create_quote,
    create_sale,
    ensure_demo_user,
    list_customers,
    list_products,
    update_fiscal_settings,
)


def seed_database() -> None:
    ensure_demo_user()

    with get_connection() as connection:
        products_count = connection.execute("SELECT COUNT(*) AS total FROM products").fetchone()["total"]
        customers_count = connection.execute("SELECT COUNT(*) AS total FROM customers").fetchone()["total"]
        sales_count = connection.execute("SELECT COUNT(*) AS total FROM sales").fetchone()["total"]
        expenses_count = connection.execute("SELECT COUNT(*) AS total FROM expenses").fetchone()["total"]
        checks_count = connection.execute("SELECT COUNT(*) AS total FROM checks").fetchone()["total"]

    if any([products_count, customers_count, sales_count, expenses_count, checks_count]):
        return

    today = date.today()

    def iso(days_ago: int = 0) -> str:
        return (today - timedelta(days=days_ago)).isoformat()

    products = [
        {
            "sku": "MAT-001",
            "code": "MAT-001",
            "category": "Cimento",
            "name": "Cimento CP-II 50kg",
            "unit": "SC",
            "cost_price": 29.5,
            "sale_price": 39.9,
            "stock_quantity": 120,
            "min_stock": 25,
            "description": "Saco de cimento para uso geral.",
            "ncm": "25232910",
            "cfop_default": "5102",
            "origin": "0",
            "csosn": "102",
        },
        {
            "sku": "MAT-002",
            "code": "MAT-002",
            "category": "Agregados",
            "name": "Areia MÃ©dia",
            "unit": "M3",
            "cost_price": 88.0,
            "sale_price": 125.0,
            "stock_quantity": 22,
            "min_stock": 8,
            "description": "Areia mÃ©dia lavada.",
            "ncm": "25059000",
            "cfop_default": "5102",
            "origin": "0",
            "csosn": "102",
        },
        {
            "sku": "MAT-003",
            "code": "MAT-003",
            "category": "Agregados",
            "name": "Brita 1",
            "unit": "M3",
            "cost_price": 92.0,
            "sale_price": 137.5,
            "stock_quantity": 18,
            "min_stock": 10,
            "description": "Brita para concreto e fundaÃ§Ã£o.",
            "ncm": "25171000",
            "cfop_default": "5102",
            "origin": "0",
            "csosn": "102",
        },
        {
            "sku": "MAT-004",
            "code": "MAT-004",
            "category": "Alvenaria",
            "name": "Tijolo Baiano 8 Furos",
            "unit": "UN",
            "cost_price": 0.85,
            "sale_price": 1.35,
            "stock_quantity": 2400,
            "min_stock": 500,
            "description": "Tijolo cerÃ¢mico 8 furos.",
            "ncm": "69041000",
            "cfop_default": "5102",
            "origin": "0",
            "csosn": "102",
        },
        {
            "sku": "MAT-005",
            "code": "MAT-005",
            "category": "Ferragens",
            "name": "VergalhÃ£o 3/8",
            "unit": "UN",
            "cost_price": 34.0,
            "sale_price": 49.9,
            "stock_quantity": 95,
            "min_stock": 20,
            "description": "Barra de aÃ§o CA-50.",
            "ncm": "72142000",
            "cfop_default": "5102",
            "origin": "0",
            "csosn": "102",
        },
        {
            "sku": "MAT-006",
            "code": "MAT-006",
            "category": "Tintas",
            "name": "Tinta AcrÃ­lica Branca 18L",
            "unit": "LT",
            "cost_price": 158.0,
            "sale_price": 229.9,
            "stock_quantity": 14,
            "min_stock": 6,
            "description": "Tinta premium para parede.",
            "ncm": "32091010",
            "cfop_default": "5102",
            "origin": "0",
            "csosn": "102",
        },
        {
            "sku": "MAT-007",
            "code": "MAT-007",
            "category": "Revestimentos",
            "name": "Piso CerÃ¢mico 60x60",
            "unit": "M2",
            "cost_price": 34.5,
            "sale_price": 54.9,
            "stock_quantity": 175,
            "min_stock": 40,
            "description": "Piso interno acetinado.",
            "ncm": "69072100",
            "cfop_default": "5102",
            "origin": "0",
            "csosn": "102",
        },
        {
            "sku": "MAT-008",
            "code": "MAT-008",
            "category": "Acabamento",
            "name": "Argamassa AC-II 20kg",
            "unit": "SC",
            "cost_price": 17.0,
            "sale_price": 27.9,
            "stock_quantity": 55,
            "min_stock": 15,
            "description": "Argamassa para pisos e revestimentos.",
            "ncm": "32149000",
            "cfop_default": "5102",
            "origin": "0",
            "csosn": "102",
        },
        {
            "sku": "MAT-009",
            "code": "MAT-009",
            "category": "HidrÃ¡ulica",
            "name": "Caixa d'Ãgua 1000L",
            "unit": "UN",
            "cost_price": 419.0,
            "sale_price": 599.0,
            "stock_quantity": 7,
            "min_stock": 3,
            "description": "Caixa d'Ã¡gua em polietileno.",
            "ncm": "39251000",
            "cfop_default": "5102",
            "origin": "0",
            "csosn": "102",
        },
        {
            "sku": "MAT-010",
            "code": "MAT-010",
            "category": "HidrÃ¡ulica",
            "name": "Torneira Metal LavatÃ³rio",
            "unit": "UN",
            "cost_price": 46.0,
            "sale_price": 79.9,
            "stock_quantity": 21,
            "min_stock": 5,
            "description": "Torneira cromada de bancada.",
            "ncm": "84818019",
            "cfop_default": "5102",
            "origin": "0",
            "csosn": "102",
        },
    ]

    for product in products:
        create_product(product)

    customers = [
        {
            "person_type": "PF",
            "name": "Ana Paula Silva",
            "cpf": "529.982.247-25",
            "phone": "(11) 99888-1001",
            "email": "ana.paula@example.com",
            "zip_code": "01310-100",
            "street": "Rua das Palmeiras",
            "number": "210",
            "district": "Bela Vista",
            "city": "Sao Paulo",
            "state": "SP",
            "city_ibge_code": "3550308",
            "ie_indicator": "Nao contribuinte",
            "notes": "Cliente frequente de acabamento.",
        },
        {
            "person_type": "PJ",
            "name": "Construtora Horizonte",
            "trade_name": "Horizonte Obras",
            "cnpj": "11.222.333/0001-81",
            "phone": "(11) 4002-9000",
            "email": "financeiro@horizonte.example.com",
            "zip_code": "04538-132",
            "street": "Avenida Central",
            "number": "1500",
            "district": "Vila Olimpia",
            "city": "Sao Paulo",
            "state": "SP",
            "city_ibge_code": "3550308",
            "ie_indicator": "Contribuinte",
            "state_registration": "110042490114",
            "notes": "Compra volumes altos de cimento e ferragem.",
        },
        {
            "person_type": "PF",
            "name": "Carlos Mendes",
            "cpf": "123.456.789-09",
            "phone": "(11) 97777-2222",
            "zip_code": "07095-000",
            "street": "Rua do Sol",
            "number": "99",
            "district": "Centro",
            "city": "Guarulhos",
            "state": "SP",
            "city_ibge_code": "3518800",
            "ie_indicator": "Nao contribuinte",
            "notes": "Prefere pagamento em Pix.",
        },
        {
            "person_type": "PF",
            "name": "Mariana Costa",
            "cpf": "111.444.777-35",
            "phone": "(11) 96666-3333",
            "zip_code": "06013-140",
            "street": "Rua dos Ipes",
            "number": "88",
            "district": "Centro",
            "city": "Osasco",
            "state": "SP",
            "city_ibge_code": "3534401",
            "ie_indicator": "Nao contribuinte",
            "notes": "Solicita orcamento antes da compra.",
        },
        {
            "person_type": "PJ",
            "name": "Obras Santa Clara",
            "trade_name": "Santa Clara Engenharia",
            "cnpj": "12.345.678/0001-95",
            "phone": "(11) 95555-4444",
            "email": "contato@santaclara.example.com",
            "zip_code": "13050-006",
            "street": "Rodovia SP",
            "number": "KM 12",
            "district": "Jardim do Lago",
            "city": "Campinas",
            "state": "SP",
            "city_ibge_code": "3509502",
            "ie_indicator": "Isento",
            "notes": "Cliente corporativo.",
        },
        {
            "person_type": "PF",
            "name": "JosÃ© Ferreira",
            "cpf": "987.654.321-00",
            "phone": "(11) 94444-5555",
            "zip_code": "09015-580",
            "street": "Travessa Brasil",
            "number": "40",
            "district": "Centro",
            "city": "Santo Andre",
            "state": "SP",
            "city_ibge_code": "3547809",
            "ie_indicator": "Nao contribuinte",
            "notes": "Compra hidraulica e eletrica.",
        },
    ]

    for customer in customers:
        create_customer(customer)

    customer_map = {customer["name"]: customer for customer in list_customers()}
    product_map = {product["sku"]: product for product in list_products()}

    sales = [
        {
            "sale_date": iso(0),
            "sale_time": "09:10",
            "customer_id": customer_map["Ana Paula Silva"]["id"],
            "payment_method": "Pix",
            "notes": "Venda rÃ¡pida de balcÃ£o.",
            "items": [
                {"product_id": product_map["MAT-001"]["id"], "quantity": 12, "unit_price": 39.9},
                {"product_id": product_map["MAT-008"]["id"], "quantity": 8, "unit_price": 27.9},
                {"product_id": product_map["MAT-005"]["id"], "quantity": 8, "unit_price": 49.9},
            ],
        },
        {
            "sale_date": iso(0),
            "sale_time": "15:42",
            "customer_id": customer_map["Carlos Mendes"]["id"],
            "payment_method": "Dinheiro",
            "notes": "Retirada imediata no balcÃ£o.",
            "items": [
                {"product_id": product_map["MAT-002"]["id"], "quantity": 1, "unit_price": 125},
                {"product_id": product_map["MAT-003"]["id"], "quantity": 1, "unit_price": 137.5},
                {"product_id": product_map["MAT-004"]["id"], "quantity": 135, "unit_price": 1.35},
            ],
        },
        {
            "sale_date": iso(1),
            "sale_time": "11:25",
            "customer_id": customer_map["Construtora Horizonte"]["id"],
            "payment_method": "Ã€ Prazo",
            "notes": "Entrega programada para obra.",
            "items": [
                {"product_id": product_map["MAT-001"]["id"], "quantity": 20, "unit_price": 39.9},
                {"product_id": product_map["MAT-005"]["id"], "quantity": 6, "unit_price": 49.9},
                {"product_id": product_map["MAT-003"]["id"], "quantity": 4, "unit_price": 125},
            ],
        },
        {
            "sale_date": iso(3),
            "sale_time": "16:05",
            "customer_id": customer_map["Mariana Costa"]["id"],
            "payment_method": "CrÃ©dito",
            "notes": "Compra de acabamento.",
            "items": [
                {"product_id": product_map["MAT-006"]["id"], "quantity": 2, "unit_price": 229.9},
                {"product_id": product_map["MAT-007"]["id"], "quantity": 8, "unit_price": 29.9},
            ],
        },
        {
            "sale_date": iso(5),
            "sale_time": "10:35",
            "customer_id": customer_map["Obras Santa Clara"]["id"],
            "payment_method": "DÃ©bito",
            "notes": "ReforÃ§o de estoque da obra.",
            "items": [
                {"product_id": product_map["MAT-004"]["id"], "quantity": 300, "unit_price": 1.35},
                {"product_id": product_map["MAT-008"]["id"], "quantity": 12, "unit_price": 27.9},
                {"product_id": product_map["MAT-010"]["id"], "quantity": 2, "unit_price": 79.9},
            ],
        },
        {
            "sale_date": iso(8),
            "sale_time": "13:15",
            "customer_id": customer_map["JosÃ© Ferreira"]["id"],
            "payment_method": "Boleto",
            "notes": "Itens hidrÃ¡ulicos.",
            "items": [
                {"product_id": product_map["MAT-009"]["id"], "quantity": 1, "unit_price": 599},
                {"product_id": product_map["MAT-010"]["id"], "quantity": 2, "unit_price": 79.9},
            ],
        },
    ]

    for sale in sales:
        create_sale(sale)

    quotes = [
        {
            "quote_date": iso(0),
            "validity_date": iso(7),
            "customer_id": customer_map["Mariana Costa"]["id"],
            "status": "Pendente",
            "discount_amount": 45.0,
            "notes": "Aguardando decisÃ£o do cliente.",
            "items": [
                {"item_name": "Tinta acrÃ­lica premium branca", "unit": "LT", "quantity": 1, "unit_price": 289.9},
                {"item_name": "Piso cerÃ¢mico acetinado", "unit": "MÂ²", "quantity": 24, "unit_price": 39.8},
            ],
        },
        {
            "quote_date": iso(2),
            "validity_date": iso(12),
            "customer_id": customer_map["Construtora Horizonte"]["id"],
            "status": "Aprovado",
            "discount_amount": 120.0,
            "notes": "OrÃ§amento aprovado pela engenharia.",
            "items": [
                {"item_name": "Cimento CP-II 50kg", "unit": "SC", "quantity": 20, "unit_price": 42.9},
                {"item_name": "VergalhÃ£o 10 mm", "unit": "UN", "quantity": 8, "unit_price": 118.5},
            ],
        },
        {
            "quote_date": iso(7),
            "validity_date": iso(15),
            "customer_name_manual": "Cliente de balcÃ£o",
            "status": "Nao aprovado",
            "notes": "Cliente achou o prazo alto.",
            "items": [
                {"item_name": "Torneira cromada de bancada", "unit": "UN", "quantity": 1, "unit_price": 79.9},
            ],
        },
    ]

    for quote in quotes:
        create_quote(quote)

    expenses = [
        {
            "payment_date": iso(0),
            "description": "Conta de energia",
            "category": "Utilidades",
            "amount": 842.5,
            "payment_method": "DÃ©bito",
            "supplier": "ConcessionÃ¡ria",
            "notes": "Pagamento do mÃªs atual.",
        },
        {
            "payment_date": iso(1),
            "description": "Compra de material de limpeza",
            "category": "Operacional",
            "amount": 188.9,
            "payment_method": "Pix",
            "supplier": "Casa do Limpeza",
            "notes": "",
        },
        {
            "payment_date": iso(6),
            "description": "Frete fornecedor cimento",
            "category": "LogÃ­stica",
            "amount": 540.0,
            "payment_method": "Cheque",
            "supplier": "Transportes Vale",
            "notes": "Referente Ã  carga do inÃ­cio da semana.",
        },
        {
            "payment_date": iso(10),
            "description": "Folha do ajudante",
            "category": "Pessoal",
            "amount": 1800.0,
            "payment_method": "Pix",
            "supplier": "Equipe interna",
            "notes": "",
        },
    ]

    for expense in expenses:
        create_expense(expense)

    checks = [
        {
            "check_number": "000123",
            "beneficiary": "Transportes Vale",
            "amount": 540.0,
            "issue_date": iso(6),
            "due_date": iso(1),
            "status": "Pendente",
            "notes": "Cheque do frete semanal.",
        },
        {
            "check_number": "000124",
            "beneficiary": "Fornecedor ABC",
            "amount": 1800.0,
            "issue_date": iso(12),
            "due_date": iso(4),
            "status": "Compensado",
            "notes": "Compra de reposiÃ§Ã£o de ferragens.",
        },
        {
            "check_number": "000125",
            "beneficiary": "Madeireira Campos",
            "amount": 2350.0,
            "issue_date": iso(2),
            "due_date": (today + timedelta(days=5)).isoformat(),
            "status": "Pendente",
            "notes": "Cheque ainda aguardando compensaÃ§Ã£o.",
        },
        {
            "check_number": "000126",
            "beneficiary": "Pinturas Brasil",
            "amount": 980.0,
            "issue_date": iso(20),
            "due_date": iso(10),
            "status": "Cancelado",
            "notes": "SubstituÃ­do por Pix.",
        },
    ]

    for check in checks:
        create_check(check)

    update_fiscal_settings(
        {
            "company_name": "Material de ConstruÃ§Ã£o Dois IrmÃ£os",
            "trade_name": "Dois IrmÃ£os",
            "cnpj": "12345678000195",
            "state_registration": "123456789",
            "tax_regime": "Simples Nacional",
            "street": "Avenida Central",
            "number": "1500",
            "district": "Centro",
            "city": "SÃ£o Paulo",
            "state": "SP",
            "zip_code": "01001000",
            "phone": "(11) 4002-9000",
            "email": "contato@doisirmaos.com.br",
            "environment": "homologation",
            "provider_name": "mock",
            "default_series": 1,
            "next_nfe_number": 1,
        }
    )
