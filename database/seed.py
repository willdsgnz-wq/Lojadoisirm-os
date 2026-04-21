from __future__ import annotations

from datetime import date, timedelta

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
)
from backend.db import get_connection


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
            "name": "Cimento CP-II 50kg",
            "code": "MAT-001",
            "category": "Cimento",
            "unit": "sc",
            "cost_price": 29.5,
            "sale_price": 39.9,
            "stock_quantity": 120,
            "min_stock": 25,
            "description": "Saco de cimento para uso geral.",
        },
        {
            "name": "Areia Média",
            "code": "MAT-002",
            "category": "Agregados",
            "unit": "m3",
            "cost_price": 88.0,
            "sale_price": 125.0,
            "stock_quantity": 22,
            "min_stock": 8,
            "description": "Areia média lavada.",
        },
        {
            "name": "Brita 1",
            "code": "MAT-003",
            "category": "Agregados",
            "unit": "m3",
            "cost_price": 92.0,
            "sale_price": 137.5,
            "stock_quantity": 18,
            "min_stock": 10,
            "description": "Brita para concreto e fundação.",
        },
        {
            "name": "Tijolo Baiano 8 Furos",
            "code": "MAT-004",
            "category": "Alvenaria",
            "unit": "un",
            "cost_price": 0.85,
            "sale_price": 1.35,
            "stock_quantity": 2400,
            "min_stock": 500,
            "description": "Tijolo cerâmico 8 furos.",
        },
        {
            "name": "Vergalhão 3/8",
            "code": "MAT-005",
            "category": "Ferragens",
            "unit": "un",
            "cost_price": 34.0,
            "sale_price": 49.9,
            "stock_quantity": 95,
            "min_stock": 20,
            "description": "Barra de aço CA-50.",
        },
        {
            "name": "Tinta Acrílica Branca 18L",
            "code": "MAT-006",
            "category": "Tintas",
            "unit": "lt",
            "cost_price": 158.0,
            "sale_price": 229.9,
            "stock_quantity": 14,
            "min_stock": 6,
            "description": "Tinta premium para parede.",
        },
        {
            "name": "Piso Cerâmico 60x60",
            "code": "MAT-007",
            "category": "Revestimentos",
            "unit": "m2",
            "cost_price": 34.5,
            "sale_price": 54.9,
            "stock_quantity": 175,
            "min_stock": 40,
            "description": "Piso interno acetinado.",
        },
        {
            "name": "Argamassa AC-II 20kg",
            "code": "MAT-008",
            "category": "Acabamento",
            "unit": "sc",
            "cost_price": 17.0,
            "sale_price": 27.9,
            "stock_quantity": 55,
            "min_stock": 15,
            "description": "Argamassa para pisos e revestimentos.",
        },
        {
            "name": "Caixa d'Água 1000L",
            "code": "MAT-009",
            "category": "Hidráulica",
            "unit": "un",
            "cost_price": 419.0,
            "sale_price": 599.0,
            "stock_quantity": 7,
            "min_stock": 3,
            "description": "Caixa d'água em polietileno.",
        },
        {
            "name": "Torneira Metal Lavatorio",
            "code": "MAT-010",
            "category": "Hidráulica",
            "unit": "un",
            "cost_price": 46.0,
            "sale_price": 79.9,
            "stock_quantity": 21,
            "min_stock": 5,
            "description": "Torneira cromada de bancada.",
        },
    ]

    for product in products:
        create_product(product)

    customers = [
        {
            "name": "Ana Paula Silva",
            "phone": "(11) 99888-1001",
            "document": "123.456.789-01",
            "address": "Rua das Palmeiras, 210",
            "notes": "Cliente frequente de acabamento.",
        },
        {
            "name": "Construtora Horizonte",
            "phone": "(11) 4002-9000",
            "document": "12.345.678/0001-90",
            "address": "Av. Central, 1500",
            "notes": "Compra volumes altos de cimento e ferragem.",
        },
        {
            "name": "Carlos Mendes",
            "phone": "(11) 97777-2222",
            "document": "321.654.987-44",
            "address": "Rua do Sol, 99",
            "notes": "Prefere pagamento em Pix.",
        },
        {
            "name": "Mariana Costa",
            "phone": "(11) 96666-3333",
            "document": "222.333.444-55",
            "address": "Rua dos Ipês, 88",
            "notes": "Solicita orçamento antes da compra.",
        },
        {
            "name": "Obras Santa Clara",
            "phone": "(11) 95555-4444",
            "document": "44.555.666/0001-77",
            "address": "Rodovia SP, km 12",
            "notes": "Cliente corporativo.",
        },
        {
            "name": "José Ferreira",
            "phone": "(11) 94444-5555",
            "document": "654.987.321-10",
            "address": "Travessa Brasil, 40",
            "notes": "Compra hidráulica e elétrica.",
        },
    ]

    for customer in customers:
        create_customer(customer)

    customer_map = {customer["name"]: customer for customer in list_customers()}

    sales = [
        {
            "sale_date": iso(0),
            "sale_time": "09:10",
            "customer_id": customer_map["Ana Paula Silva"]["id"],
            "payment_method": "Pix",
            "amount": 1098.60,
            "notes": "Venda rápida de balcão.",
        },
        {
            "sale_date": iso(0),
            "sale_time": "15:42",
            "customer_id": customer_map["Carlos Mendes"]["id"],
            "payment_method": "Dinheiro",
            "amount": 444.20,
            "notes": "Retirada imediata no balcão.",
        },
        {
            "sale_date": iso(1),
            "sale_time": "11:25",
            "customer_id": customer_map["Construtora Horizonte"]["id"],
            "payment_method": "Prazo",
            "amount": 1598.80,
            "notes": "Entrega programada para obra.",
        },
        {
            "sale_date": iso(3),
            "sale_time": "16:05",
            "customer_id": customer_map["Mariana Costa"]["id"],
            "payment_method": "Crédito",
            "amount": 699.50,
            "notes": "Compra de acabamento.",
        },
        {
            "sale_date": iso(5),
            "sale_time": "10:35",
            "customer_id": customer_map["Obras Santa Clara"]["id"],
            "payment_method": "Débito",
            "amount": 885.00,
            "notes": "Reforço de estoque da obra.",
        },
        {
            "sale_date": iso(8),
            "sale_time": "13:15",
            "customer_id": customer_map["José Ferreira"]["id"],
            "payment_method": "Pix",
            "amount": 758.80,
            "notes": "Itens hidráulicos.",
        },
        {
            "sale_date": iso(12),
            "sale_time": "09:45",
            "customer_id": customer_map["Ana Paula Silva"]["id"],
            "payment_method": "Crédito",
            "amount": 2035.80,
            "notes": "Compra para reforma completa.",
        },
        {
            "sale_date": iso(18),
            "sale_time": "14:20",
            "customer_id": customer_map["Construtora Horizonte"]["id"],
            "payment_method": "Pix",
            "amount": 1298.20,
            "notes": "Compra de ferragem.",
        },
        {
            "sale_date": iso(27),
            "sale_time": "11:50",
            "customer_id": customer_map["Obras Santa Clara"]["id"],
            "payment_method": "Boleto",
            "amount": 1408.50,
            "notes": "Grande pedido de alvenaria.",
        },
        {
            "sale_date": iso(39),
            "sale_time": "17:10",
            "customer_id": customer_map["Carlos Mendes"]["id"],
            "payment_method": "Dinheiro",
            "amount": 387.50,
            "notes": "Compra antiga para teste do histórico.",
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
            "notes": "Aguardando decisão do cliente.",
            "items": [
                {"item_name": "Tinta acrílica premium branca", "unit": "LT", "quantity": 1, "unit_price": 289.9},
                {"item_name": "Piso cerâmico acetinado", "unit": "M²", "quantity": 24, "unit_price": 39.8},
            ],
        },
        {
            "quote_date": iso(2),
            "validity_date": iso(12),
            "customer_id": customer_map["Construtora Horizonte"]["id"],
            "status": "Aprovado",
            "discount_amount": 120.0,
            "notes": "Orçamento aprovado pela engenharia.",
            "items": [
                {"item_name": "Cimento CP-II 50kg", "unit": "SC", "quantity": 20, "unit_price": 42.9},
                {"item_name": "Vergalhão 10 mm", "unit": "UN", "quantity": 8, "unit_price": 118.5},
            ],
        },
        {
            "quote_date": iso(7),
            "validity_date": iso(15),
            "customer_id": customer_map["Ana Paula Silva"]["id"],
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
            "payment_method": "Débito",
            "supplier": "Concessionária",
            "notes": "Pagamento do mês atual.",
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
            "payment_date": iso(3),
            "description": "Internet da loja",
            "category": "Utilidades",
            "amount": 149.9,
            "payment_method": "Crédito",
            "supplier": "FibraNet",
            "notes": "",
        },
        {
            "payment_date": iso(6),
            "description": "Frete fornecedor cimento",
            "category": "Logística",
            "amount": 540.0,
            "payment_method": "Cheque",
            "supplier": "Transportes Vale",
            "notes": "Referente à carga do início da semana.",
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
        {
            "payment_date": iso(22),
            "description": "Manutenção da empilhadeira",
            "category": "Manutenção",
            "amount": 620.0,
            "payment_method": "Débito",
            "supplier": "Oficina Central",
            "notes": "",
        },
        {
            "payment_date": iso(35),
            "description": "Aluguel do galpão",
            "category": "Fixo",
            "amount": 3500.0,
            "payment_method": "Pix",
            "supplier": "Imobiliária Sul",
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
            "notes": "Compra de reposição de ferragens.",
        },
        {
            "check_number": "000125",
            "beneficiary": "Madeireira Campos",
            "amount": 2350.0,
            "issue_date": iso(2),
            "due_date": (today + timedelta(days=5)).isoformat(),
            "status": "Pendente",
            "notes": "Cheque ainda aguardando compensação.",
        },
        {
            "check_number": "000126",
            "beneficiary": "Pinturas Brasil",
            "amount": 980.0,
            "issue_date": iso(20),
            "due_date": iso(10),
            "status": "Cancelado",
            "notes": "Substituído por Pix.",
        },
        {
            "check_number": "000127",
            "beneficiary": "Oficina Central",
            "amount": 620.0,
            "issue_date": iso(22),
            "due_date": iso(5),
            "status": "Pendente",
            "notes": "Cheque atrasado para teste do alerta.",
        },
    ]

    for check in checks:
        create_check(check)
