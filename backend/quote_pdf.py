from __future__ import annotations

import io
import re
import unicodedata
from datetime import datetime
from html import escape as html_escape
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_BRAND_NAME = "MATERIAL DE CONSTRUÇÃO DOIS IRMÃOS ONDE HABITA BENÇÃOS"
LOGO_CANDIDATES = (
    BASE_DIR / "frontend" / "static" / "brand" / "logo_dois_irmaos_final.png",
    BASE_DIR / "frontend" / "static" / "brand" / "logo_dois_irmaos.png",
    BASE_DIR / "frontend" / "static" / "brand" / "logo_dois_irmaos_cropped.png",
)


def build_quote_pdf_bytes(quote: dict[str, Any], settings: dict[str, Any] | None = None) -> bytes:
    """Build a real A4 PDF for a quote without relying on browser print preview."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
        title="Orçamento",
        author=_company_name(settings),
    )

    styles = _build_styles()
    elements: list[Any] = []
    items = quote.get("items") or []
    subtotal = _to_money(quote.get("subtotal_amount") or sum(_to_money(item.get("total_price")) for item in items))
    discount = _to_money(quote.get("discount_amount"))
    total = _to_money(quote.get("total_amount") if quote.get("total_amount") is not None else max(subtotal - discount, 0))

    elements.append(_build_header_table(quote, settings, styles, doc.width))
    elements.append(Spacer(1, 6 * mm))
    elements.append(_build_customer_table(quote, styles, doc.width))
    elements.append(Spacer(1, 5 * mm))
    elements.append(_build_items_table(items, styles, doc.width))
    elements.append(Spacer(1, 5 * mm))
    elements.append(_build_totals_and_notes_table(quote, styles, doc.width, subtotal, discount, total))
    elements.append(Spacer(1, 4 * mm))
    elements.append(_build_footer(styles))

    doc.build(elements)
    return buffer.getvalue()


def quote_pdf_filename(quote: dict[str, Any]) -> str:
    customer_name = str(quote.get("customer_name") or quote.get("customer_name_manual") or "").strip()
    slug = slugify_filename(customer_name or "cliente-nao-informado")
    return f"{slug}.pdf"


def slugify_filename(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()
    return (slug or "orcamento")[:90]


def _build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "brand": ParagraphStyle(
            "QuoteBrand",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=colors.HexColor("#1E3A8A"),
            spaceAfter=2,
        ),
        "title": ParagraphStyle(
            "QuoteTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=19,
            leading=22,
            textColor=colors.HexColor("#1F2937"),
        ),
        "subtitle": ParagraphStyle(
            "QuoteSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.7,
            leading=11,
            textColor=colors.HexColor("#6B7280"),
        ),
        "label": ParagraphStyle(
            "QuoteLabel",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=8,
            textColor=colors.HexColor("#6B7280"),
        ),
        "value": ParagraphStyle(
            "QuoteValue",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#1F2937"),
        ),
        "value_bold": ParagraphStyle(
            "QuoteValueBold",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#1F2937"),
        ),
        "table_cell": ParagraphStyle(
            "QuoteTableCell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.7,
            leading=9.2,
            textColor=colors.HexColor("#1F2937"),
        ),
        "table_head": ParagraphStyle(
            "QuoteTableHead",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=8,
            textColor=colors.white,
        ),
        "money": ParagraphStyle(
            "QuoteMoney",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#1F2937"),
        ),
        "total": ParagraphStyle(
            "QuoteTotal",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=14,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#1E3A8A"),
        ),
        "footer": ParagraphStyle(
            "QuoteFooter",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.2,
            leading=9,
            textColor=colors.HexColor("#6B7280"),
        ),
    }


def _build_header_table(
    quote: dict[str, Any],
    settings: dict[str, Any] | None,
    styles: dict[str, ParagraphStyle],
    width: float,
) -> Table:
    logo = _build_logo()
    brand_name = _company_name(settings)
    trade_name = _clean(settings.get("trade_name") if settings else "") or "Material de Construção Dois Irmãos"
    meta_rows = [
        [_field("Data", _format_date(quote.get("quote_date")), styles), _field("Validade", _format_date(quote.get("validity_date") or quote.get("quote_date")), styles)],
        [_field("Status", _clean(quote.get("status")) or "Pendente", styles), _field("Itens", str(len(quote.get("items") or [])), styles)],
    ]

    brand_block = [
        logo or Paragraph(_safe(brand_name), styles["brand"]),
        Paragraph(_safe(brand_name), styles["brand"]),
        Paragraph(_safe(trade_name), styles["subtitle"]),
    ]

    title_block = [
        Paragraph("ORÇAMENTO", styles["title"]),
        Paragraph("Proposta comercial para materiais de construção", styles["subtitle"]),
        Paragraph(_safe(f"Nº {quote.get('id') or 'Prévia'}"), styles["value_bold"]),
    ]

    meta_table = Table(meta_rows, colWidths=[37 * mm, 37 * mm])
    meta_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#DBEAFE")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))

    table = Table([[brand_block, title_block, meta_table]], colWidths=[67 * mm, width - 67 * mm - 78 * mm, 78 * mm])
    table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.65, colors.HexColor("#DBEAFE")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def _build_customer_table(quote: dict[str, Any], styles: dict[str, ParagraphStyle], width: float) -> Table:
    customer_name = _clean(quote.get("customer_name") or quote.get("customer_name_manual")) or "Cliente não informado"
    rows = [
        [Paragraph("DADOS DO CLIENTE", styles["table_head"])],
        [_field("Cliente", customer_name, styles)],
    ]
    table = Table(rows, colWidths=[width])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#1E3A8A")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#DBEAFE")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def _build_items_table(items: list[dict[str, Any]], styles: dict[str, ParagraphStyle], width: float) -> Table:
    header = [
        Paragraph("ITEM", styles["table_head"]),
        Paragraph("UN", styles["table_head"]),
        Paragraph("QTD", styles["table_head"]),
        Paragraph("VALOR UNIT.", styles["table_head"]),
        Paragraph("TOTAL", styles["table_head"]),
    ]
    rows: list[list[Any]] = [header]
    for item in items:
        rows.append([
            Paragraph(_safe(_clean(item.get("item_name") or item.get("product_name")) or "-"), styles["table_cell"]),
            Paragraph(_safe(_clean(item.get("unit")) or "UN"), styles["table_cell"]),
            Paragraph(_safe(_format_number(item.get("quantity"))), styles["table_cell"]),
            Paragraph(_safe(_format_currency(item.get("unit_price"))), styles["money"]),
            Paragraph(_safe(_format_currency(item.get("total_price"))), styles["money"]),
        ])

    if len(rows) == 1:
        rows.append([
            Paragraph("Nenhum item informado", styles["table_cell"]),
            "",
            "",
            "",
            "",
        ])

    table = Table(
        rows,
        colWidths=[width - 25 * mm - 24 * mm - 34 * mm - 34 * mm, 25 * mm, 24 * mm, 34 * mm, 34 * mm],
        repeatRows=1,
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("ALIGN", (1, 1), (2, -1), "CENTER"),
        ("ALIGN", (3, 1), (4, -1), "RIGHT"),
    ]))
    return table


def _build_totals_and_notes_table(
    quote: dict[str, Any],
    styles: dict[str, ParagraphStyle],
    width: float,
    subtotal: float,
    discount: float,
    total: float,
) -> Table:
    notes = _clean(quote.get("notes")) or "Sem observações."
    notes_block = [
        Paragraph("OBSERVAÇÕES", styles["label"]),
        Paragraph(_safe(notes), styles["value"]),
    ]
    totals = Table([
        [Paragraph("Subtotal", styles["value"]), Paragraph(_safe(_format_currency(subtotal)), styles["money"])],
        [Paragraph("Desconto", styles["value"]), Paragraph(_safe(_format_currency(discount)), styles["money"])],
        [Paragraph("Total final", styles["value_bold"]), Paragraph(_safe(_format_currency(total)), styles["total"])],
    ], colWidths=[38 * mm, 38 * mm])
    totals.setStyle(TableStyle([
        ("LINEABOVE", (0, 2), (-1, 2), 0.7, colors.HexColor("#1E3A8A")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))

    table = Table([[notes_block, totals]], colWidths=[width - 82 * mm, 82 * mm])
    table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.55, colors.HexColor("#DBEAFE")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def _build_footer(styles: dict[str, ParagraphStyle]) -> Paragraph:
    return Paragraph(
        "Documento gerado automaticamente pelo sistema Material de Construção Dois Irmãos.",
        styles["footer"],
    )


def _build_logo() -> Image | None:
    for logo_path in LOGO_CANDIDATES:
        if not logo_path.exists():
            continue
        try:
            logo = Image(str(logo_path), width=30 * mm, height=15 * mm)
            logo.hAlign = "LEFT"
            return logo
        except Exception:
            continue
    return None


def _field(label: str, value: str, styles: dict[str, ParagraphStyle]) -> list[Paragraph]:
    return [
        Paragraph(_safe(label.upper()), styles["label"]),
        Paragraph(_safe(_clean(value) or "-"), styles["value_bold"]),
    ]


def _company_name(settings: dict[str, Any] | None) -> str:
    if settings:
        return _clean(settings.get("trade_name") or settings.get("company_name")) or DEFAULT_BRAND_NAME
    return DEFAULT_BRAND_NAME


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _safe(value: Any) -> str:
    return html_escape(_clean(value), quote=False)


def _to_money(value: Any) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _format_date(value: Any) -> str:
    raw_value = _clean(value)
    if not raw_value:
        return "-"
    try:
        return datetime.fromisoformat(raw_value[:10]).strftime("%d/%m/%Y")
    except ValueError:
        return raw_value


def _format_number(value: Any) -> str:
    number = _to_money(value)
    if number.is_integer():
        return f"{int(number):,}".replace(",", ".")
    formatted = f"{number:,.2f}"
    return formatted.replace(",", "X").replace(".", ",").replace("X", ".")


def _format_currency(value: Any) -> str:
    formatted = f"{_to_money(value):,.2f}"
    return f"R$ {formatted.replace(',', 'X').replace('.', ',').replace('X', '.')}"
