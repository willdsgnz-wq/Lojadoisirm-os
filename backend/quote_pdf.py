from __future__ import annotations

import io
import re
import unicodedata
from datetime import date, datetime, timedelta
from html import escape as html_escape
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


BASE_DIR = Path(__file__).resolve().parent.parent
DOCUMENT_TITLE = "ORÇAMENTO"
COMPANY_NAME = "DOIS IRMÃOS LTDA"
COMPANY_CNPJ = "38.276.833/0001-52"
COMPANY_PHONE = "(45) 92000-7674"
COMPANY_ADDRESS = "Rua Francisco Rissato, 233, Agro Cafeeira - Matelândia PR"
FOOTER_TEXT = "Documento comercial gerado automaticamente para impressão ou envio ao cliente."
PRIMARY_BLUE = colors.HexColor("#0F3B8C")
PRIMARY_BLUE_DARK = colors.HexColor("#0B2F73")
PRIMARY_BLUE_LIGHT = colors.HexColor("#EEF4FF")
PRIMARY_ORANGE = colors.HexColor("#FF6A00")
PRIMARY_ORANGE_DARK = colors.HexColor("#EA580C")
BORDER = colors.HexColor("#D7E2F1")
TEXT = colors.HexColor("#1E293B")
MUTED = colors.HexColor("#64748B")
LOGO_CANDIDATES = (
    BASE_DIR / "frontend" / "static" / "brand" / "logo_dois_irmaos_final.png",
    BASE_DIR / "frontend" / "static" / "brand" / "logo_dois_irmaos.png",
    BASE_DIR / "frontend" / "static" / "brand" / "logo_dois_irmaos_cropped.png",
)


def build_quote_pdf_bytes(quote: dict[str, Any], settings: dict[str, Any] | None = None) -> bytes:
    del settings

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=20 * mm,
        title=DOCUMENT_TITLE,
        author=COMPANY_NAME,
    )

    styles = _build_styles()
    items = _normalize_items(quote.get("items") or [])
    quote_dates = _document_dates()
    total_amount = _to_money(
        quote.get("total_amount")
        if quote.get("total_amount") is not None
        else sum(item["total_price"] for item in items)
    )

    story: list[Any] = [
        _build_top_bar(doc.width),
        Spacer(1, 7 * mm),
        _build_header_block(quote, quote_dates, styles, doc.width),
        Spacer(1, 8 * mm),
        _build_section_card(
            "DADOS DO ORÇAMENTO",
            _build_customer_content(quote, styles, doc.width),
            styles,
            doc.width,
        ),
        Spacer(1, 8 * mm),
        _build_items_table(items, styles, doc.width),
        Spacer(1, 8 * mm),
        _build_total_banner(total_amount, styles, doc.width),
        Spacer(1, 7 * mm),
        _build_center_footer(styles, doc.width),
        Spacer(1, 6 * mm),
    ]

    doc.build(story, onFirstPage=_draw_footer_band, onLaterPages=_draw_footer_band)
    return buffer.getvalue()


def quote_pdf_filename(quote: dict[str, Any]) -> str:
    customer_name = str(quote.get("customer_name") or quote.get("customer_name_manual") or "").strip()
    quote_number = str(quote.get("id") or "preview").strip()
    customer_slug = slugify_filename(customer_name or "cliente")
    return f"orcamento-{quote_number}-{customer_slug}.pdf"


def slugify_filename(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()
    return (slug or "orcamento")[:80]


def _build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "company_name": ParagraphStyle(
            "CompanyName",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=19,
            leading=22,
            textColor=PRIMARY_BLUE_DARK,
        ),
        "company_meta": ParagraphStyle(
            "CompanyMeta",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.9,
            leading=12,
            textColor=TEXT,
        ),
        "title": ParagraphStyle(
            "QuoteTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=31,
            leading=33,
            alignment=TA_CENTER,
            textColor=PRIMARY_BLUE_DARK,
        ),
        "subtitle": ParagraphStyle(
            "QuoteSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.8,
            leading=13,
            alignment=TA_CENTER,
            textColor=MUTED,
        ),
        "meta_label": ParagraphStyle(
            "MetaLabel",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.2,
            leading=10,
            textColor=PRIMARY_BLUE_DARK,
        ),
        "meta_value": ParagraphStyle(
            "MetaValue",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=15,
            textColor=TEXT,
        ),
        "meta_value_orange": ParagraphStyle(
            "MetaValueOrange",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=15,
            textColor=PRIMARY_ORANGE_DARK,
        ),
        "meta_hint": ParagraphStyle(
            "MetaHint",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=PRIMARY_ORANGE_DARK,
        ),
        "section_title": ParagraphStyle(
            "SectionTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=13,
            textColor=colors.white,
        ),
        "card_label": ParagraphStyle(
            "CardLabel",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.3,
            leading=10,
            textColor=PRIMARY_BLUE_DARK,
        ),
        "card_value": ParagraphStyle(
            "CardValue",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            textColor=TEXT,
        ),
        "table_head": ParagraphStyle(
            "TableHead",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.7,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.white,
        ),
        "table_cell": ParagraphStyle(
            "TableCell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.3,
            leading=12,
            textColor=TEXT,
        ),
        "table_cell_center": ParagraphStyle(
            "TableCellCenter",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.3,
            leading=12,
            alignment=TA_CENTER,
            textColor=TEXT,
        ),
        "table_cell_money": ParagraphStyle(
            "TableCellMoney",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9.3,
            leading=12,
            alignment=TA_RIGHT,
            textColor=TEXT,
        ),
        "total_label": ParagraphStyle(
            "TotalLabel",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=18,
            textColor=colors.white,
        ),
        "total_value": ParagraphStyle(
            "TotalValue",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=23,
            leading=26,
            alignment=TA_RIGHT,
            textColor=colors.white,
        ),
        "footer_center": ParagraphStyle(
            "FooterCenter",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            alignment=TA_CENTER,
            textColor=MUTED,
        ),
        "footer_band_title": ParagraphStyle(
            "FooterBandTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=colors.white,
        ),
        "footer_band_text": ParagraphStyle(
            "FooterBandText",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.7,
            leading=11.5,
            textColor=colors.white,
        ),
    }


def _build_top_bar(width: float) -> Table:
    table = Table([["", ""]], colWidths=[width * 0.58, width * 0.42], rowHeights=[5 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), PRIMARY_BLUE_DARK),
                ("BACKGROUND", (1, 0), (1, 0), PRIMARY_ORANGE),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def _build_header_block(
    quote: dict[str, Any],
    quote_dates: dict[str, str],
    styles: dict[str, ParagraphStyle],
    width: float,
) -> Table:
    table = Table(
        [[
            _build_brand_block(styles),
            _build_title_meta_block(quote, quote_dates, styles, width * 0.47),
        ]],
        colWidths=[width * 0.53, width * 0.47],
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("LINEAFTER", (0, 0), (0, 0), 0.8, BORDER),
            ]
        )
    )
    return table


def _build_brand_block(styles: dict[str, ParagraphStyle]) -> Table:
    logo = _build_logo()
    left = logo or Paragraph(COMPANY_NAME, styles["company_name"])
    right = [
        Paragraph(COMPANY_NAME, styles["company_name"]),
        Spacer(1, 4 * mm),
        Paragraph(f"CNPJ: {COMPANY_CNPJ}", styles["company_meta"]),
        Spacer(1, 2 * mm),
        Paragraph(COMPANY_PHONE, styles["company_meta"]),
        Spacer(1, 2 * mm),
        Paragraph(COMPANY_ADDRESS, styles["company_meta"]),
    ]
    table = Table([[left, right]], colWidths=[41 * mm, 82 * mm])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    return table


def _build_title_meta_block(
    quote: dict[str, Any],
    quote_dates: dict[str, str],
    styles: dict[str, ParagraphStyle],
    width: float,
) -> Table:
    title_block = [
        Paragraph(DOCUMENT_TITLE, styles["title"]),
        Spacer(1, 2 * mm),
        _build_title_underline(width * 0.55),
        Spacer(1, 3 * mm),
        Paragraph("Proposta comercial pronta para impressão ou envio ao cliente.", styles["subtitle"]),
        Spacer(1, 5 * mm),
        _build_meta_panel(quote, quote_dates, styles, width),
    ]
    table = Table([[title_block]], colWidths=[width])
    table.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def _build_title_underline(width: float) -> Table:
    table = Table([[""]], colWidths=[width], rowHeights=[1.4 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), PRIMARY_ORANGE),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def _build_meta_panel(
    quote: dict[str, Any],
    quote_dates: dict[str, str],
    styles: dict[str, ParagraphStyle],
    width: float,
) -> Table:
    quote_number = str(quote.get("id") or "---").strip()
    quote_date = _format_date(quote_dates["quote_date"])
    validity_date = _format_date(quote_dates["validity_date"])
    day_count = _days_between(quote_dates["quote_date"], quote_dates["validity_date"])

    rows = [
        [
            _meta_cell("NÚMERO", quote_number, styles),
            _meta_cell("DATA", quote_date, styles),
        ],
        [
            _meta_cell("VALIDADE", validity_date, styles, hint=f"({day_count} dias)", accent=True),
            _meta_cell("DOCUMENTO", DOCUMENT_TITLE, styles),
        ],
    ]
    table = Table(rows, colWidths=[width / 2, width / 2], rowHeights=[26 * mm, 26 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, BORDER),
                ("ROUNDEDCORNERS", [6, 6, 6, 6]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def _meta_cell(label: str, value: str, styles: dict[str, ParagraphStyle], hint: str = "", accent: bool = False) -> list[Any]:
    parts: list[Any] = [
        Paragraph(_safe(label), styles["meta_label"]),
        Spacer(1, 1.2 * mm),
        Paragraph(_safe(value), styles["meta_value_orange" if accent else "meta_value"]),
    ]
    if hint:
        parts.extend([Spacer(1, 0.5 * mm), Paragraph(_safe(hint), styles["meta_hint"])])
    return parts


def _build_section_card(title: str, body: Any, styles: dict[str, ParagraphStyle], width: float) -> Table:
    header = Table([[Paragraph(_safe(title), styles["section_title"])]], colWidths=[width], rowHeights=[14 * mm])
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_BLUE),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    table = Table([[header], [body]], colWidths=[width])
    table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("LEFTPADDING", (0, 1), (-1, -1), 14),
                ("RIGHTPADDING", (0, 1), (-1, -1), 14),
                ("TOPPADDING", (0, 1), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 12),
            ]
        )
    )
    return table


def _build_customer_content(quote: dict[str, Any], styles: dict[str, ParagraphStyle], width: float) -> Table:
    customer_name = _clean(quote.get("customer_name") or quote.get("customer_name_manual")) or "Cliente não informado"
    table = Table(
        [[
            Paragraph("CLIENTE", styles["card_label"]),
            Spacer(1, 1.5 * mm),
            Paragraph(_safe(customer_name), styles["card_value"]),
        ]],
        colWidths=[width - 28],
    )
    table.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def _build_items_table(items: list[dict[str, Any]], styles: dict[str, ParagraphStyle], width: float) -> Table:
    rows: list[list[Any]] = [[
        Paragraph("DESCRIÇÃO", styles["table_head"]),
        Paragraph("QNTD", styles["table_head"]),
        Paragraph("VALOR UNIT.", styles["table_head"]),
        Paragraph("VALOR TOTAL", styles["table_head"]),
    ]]

    display_items = items[:8]
    for item in display_items:
        rows.append(
            [
                Paragraph(_safe(item["item_name"] or "-"), styles["table_cell"]),
                Paragraph(_safe(_format_number(item["quantity"])), styles["table_cell_center"]),
                Paragraph(_safe(_format_currency(item["unit_price"])), styles["table_cell_money"]),
                Paragraph(_safe(_format_currency(item["total_price"])), styles["table_cell_money"]),
            ]
        )

    minimum_rows = max(4, len(display_items))
    while len(rows) - 1 < minimum_rows:
        rows.append(
            [
                Paragraph("&nbsp;", styles["table_cell"]),
                Paragraph("&nbsp;", styles["table_cell_center"]),
                Paragraph("&nbsp;", styles["table_cell_money"]),
                Paragraph("&nbsp;", styles["table_cell_money"]),
            ]
        )

    table = Table(
        rows,
        colWidths=[width * 0.38, width * 0.18, width * 0.21, width * 0.23],
        rowHeights=[15 * mm] + [15 * mm] * (len(rows) - 1),
        repeatRows=1,
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_BLUE),
                ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, BORDER),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PRIMARY_BLUE_LIGHT]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def _build_total_banner(total_amount: float, styles: dict[str, ParagraphStyle], width: float) -> Table:
    table = Table(
        [[
            Paragraph("TOTAL GERAL", styles["total_label"]),
            Paragraph("." * 54, styles["total_label"]),
            Paragraph(_safe(_format_currency(total_amount)), styles["total_value"]),
        ]],
        colWidths=[width * 0.25, width * 0.45, width * 0.30],
        rowHeights=[20 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_ORANGE),
                ("BOX", (0, 0), (-1, -1), 0.8, PRIMARY_ORANGE_DARK),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (1, 0), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def _build_center_footer(styles: dict[str, ParagraphStyle], width: float) -> Table:
    table = Table(
        [[
            Paragraph("....................................", styles["footer_center"]),
            Paragraph(_safe(FOOTER_TEXT), styles["footer_center"]),
            Paragraph("....................................", styles["footer_center"]),
        ]],
        colWidths=[width * 0.26, width * 0.48, width * 0.26],
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (0, 0), "CENTER"),
                ("ALIGN", (1, 0), (1, 0), "CENTER"),
                ("ALIGN", (2, 0), (2, 0), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def _draw_footer_band(canvas: Canvas, doc: SimpleDocTemplate) -> None:
    canvas.saveState()
    footer_height = 26 * mm
    y = 0
    canvas.setFillColor(PRIMARY_BLUE_DARK)
    canvas.rect(0, y, A4[0], footer_height, stroke=0, fill=1)
    canvas.setFillColor(PRIMARY_ORANGE)
    canvas.rect(0, footer_height - 2.5 * mm, A4[0], 2.5 * mm, stroke=0, fill=1)

    left = doc.leftMargin
    base_y = 9 * mm
    section_width = (A4[0] - doc.leftMargin - doc.rightMargin) / 3
    entries = [
        ("DOIS IRMÃOS LTDA", f"CNPJ: {COMPANY_CNPJ}"),
        ("Telefone", COMPANY_PHONE),
        ("Endereço", "Rua Francisco Rissato, 233,\nAgro Cafeeira - Matelândia PR"),
    ]

    for index, (title, text) in enumerate(entries):
        x = left + section_width * index
        canvas.setFont("Helvetica-Bold", 10)
        canvas.setFillColor(colors.white)
        canvas.drawString(x, base_y + 8 * mm, title)
        canvas.setFont("Helvetica", 8.7)
        for line_index, line in enumerate(text.split("\n")):
            canvas.drawString(x, base_y + (3.2 - line_index * 4.2) * mm, line)
        if index < len(entries) - 1:
            divider_x = x + section_width - 8 * mm
            canvas.setStrokeColor(colors.HexColor("#8FB0EA"))
            canvas.setLineWidth(0.6)
            canvas.line(divider_x, base_y, divider_x, base_y + 12 * mm)

    canvas.restoreState()


def _document_dates() -> dict[str, str]:
    quote_date = date.today()
    validity_date = quote_date + timedelta(days=7)
    return {
        "quote_date": quote_date.isoformat(),
        "validity_date": validity_date.isoformat(),
    }


def _build_logo() -> Image | None:
    for logo_path in LOGO_CANDIDATES:
        if not logo_path.exists():
            continue
        try:
            logo = Image(str(logo_path), width=36 * mm, height=30 * mm)
            logo.hAlign = "LEFT"
            return logo
        except Exception:
            continue
    return None


def _normalize_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized_items: list[dict[str, Any]] = []
    for item in items:
        quantity = _to_money(item.get("quantity"))
        unit_price = _to_money(item.get("unit_price"))
        total_price = _to_money(item.get("total_price") if item.get("total_price") is not None else quantity * unit_price)
        normalized_items.append(
            {
                "item_name": _clean(item.get("item_name") or item.get("product_name")),
                "quantity": quantity,
                "unit_price": unit_price,
                "total_price": total_price,
            }
        )
    return normalized_items


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
    if float(number).is_integer():
        return f"{int(number):,}".replace(",", ".")
    formatted = f"{number:,.2f}"
    return formatted.replace(",", "X").replace(".", ",").replace("X", ".")


def _format_currency(value: Any) -> str:
    formatted = f"{_to_money(value):,.2f}"
    return f"R$ {formatted.replace(',', 'X').replace('.', ',').replace('X', '.')}"


def _days_between(start_iso: str, end_iso: str) -> int:
    try:
        start = date.fromisoformat(start_iso[:10])
        end = date.fromisoformat(end_iso[:10])
        return max((end - start).days, 0)
    except ValueError:
        return 7
