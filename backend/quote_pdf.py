from __future__ import annotations

import io
import re
import unicodedata
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas


BASE_DIR = Path(__file__).resolve().parent.parent
DOCUMENT_TITLE = "ORÇAMENTO"
COMPANY_NAME = "DOIS IRMÃOS LTDA"
COMPANY_CNPJ = "38.276.833/0001-52"
COMPANY_PHONE = "(45) 92000-7674"
COMPANY_ADDRESS = "Rua Francisco Rissato, 233, Agro Cafeeira - Matelândia PR"
FOOTER_TEXT = "Documento comercial gerado automaticamente para\nimpressão ou envio ao cliente."

PRIMARY_NAVY = colors.HexColor("#0B2F73")
PRIMARY_NAVY_TEXT = colors.HexColor("#123767")
PRIMARY_ORANGE = colors.HexColor("#FF6A00")
PRIMARY_ORANGE_DARK = colors.HexColor("#F05A00")
BORDER = colors.HexColor("#C8D3E2")
GRID = colors.HexColor("#D7DFEA")
STRIPE = colors.HexColor("#F8FAFD")
TEXT = colors.HexColor("#1F3A67")
MUTED = colors.HexColor("#5D7292")
WHITE = colors.white
FONT_REGULAR = "QuoteArial"
FONT_BOLD = "QuoteArialBold"
FONT_REGISTERED = False

PAGE_WIDTH, PAGE_HEIGHT = A4
PAGE_MARGIN_X = 10.2 * mm
CONTENT_WIDTH = PAGE_WIDTH - (PAGE_MARGIN_X * 2)
ROWS_PER_PAGE = 10

LOGO_CANDIDATES = (
    BASE_DIR / "frontend" / "static" / "brand" / "logo_dois_irmaos_final.png",
    BASE_DIR / "frontend" / "static" / "brand" / "logo_dois_irmaos.png",
    BASE_DIR / "frontend" / "static" / "brand" / "logo_dois_irmaos_cropped.png",
)


def _register_fonts() -> None:
    global FONT_BOLD, FONT_REGISTERED, FONT_REGULAR
    if FONT_REGISTERED:
        return

    regular_path = Path("C:/Windows/Fonts/arial.ttf")
    bold_path = Path("C:/Windows/Fonts/arialbd.ttf")
    if regular_path.exists() and bold_path.exists():
        pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(regular_path)))
        pdfmetrics.registerFont(TTFont(FONT_BOLD, str(bold_path)))
        FONT_REGISTERED = True
        return

    FONT_REGULAR = "Helvetica"
    FONT_BOLD = "Helvetica-Bold"
    FONT_REGISTERED = True


def build_quote_pdf_bytes(quote: dict[str, Any], settings: dict[str, Any] | None = None) -> bytes:
    del settings

    _register_fonts()
    buffer = io.BytesIO()
    pdf = Canvas(buffer, pagesize=A4)
    pdf.setTitle(DOCUMENT_TITLE)
    pdf.setAuthor(COMPANY_NAME)
    pdf.setSubject("Proposta comercial")

    items = _normalize_items(quote.get("items") or [])
    quote_date_iso = _clean(quote.get("quote_date")) or date.today().isoformat()
    validity_date_iso = _clean(quote.get("validity_date") or quote.get("quote_date")) or (date.today() + timedelta(days=7)).isoformat()
    total_amount = _to_money(
        quote.get("total_amount")
        if quote.get("total_amount") is not None
        else sum(item["total_price"] for item in items)
    )

    chunks = [items[index:index + ROWS_PER_PAGE] for index in range(0, len(items), ROWS_PER_PAGE)] or [[]]
    for page_index, chunk in enumerate(chunks):
        _draw_quote_page(
            pdf,
            quote=quote,
            items=chunk,
            total_amount=total_amount,
            quote_date_iso=quote_date_iso,
            validity_date_iso=validity_date_iso,
            is_last_page=(page_index == len(chunks) - 1),
            continuation=(page_index > 0),
        )
        pdf.showPage()

    pdf.save()
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


def _draw_quote_page(
    pdf: Canvas,
    *,
    quote: dict[str, Any],
    items: list[dict[str, Any]],
    total_amount: float,
    quote_date_iso: str,
    validity_date_iso: str,
    is_last_page: bool,
    continuation: bool,
) -> None:
    customer_name = _clean(quote.get("customer_name") or quote.get("customer_name_manual"))
    quote_number = str(quote.get("id") or "---").strip()
    quote_date = _format_date(quote_date_iso)
    validity_date = _format_date(validity_date_iso)
    validity_days = _days_between(quote_date_iso, validity_date_iso)

    _draw_page_border(pdf)
    _draw_header(pdf, continuation=continuation)
    _draw_meta_cards(pdf, quote_number=quote_number, quote_date=quote_date, validity_date=validity_date, validity_days=validity_days)
    _draw_customer_section(pdf, customer_name=customer_name)
    _draw_items_table(pdf, items=items)
    if is_last_page:
        _draw_total_banner(pdf, total_amount=total_amount)
        _draw_footer_note(pdf)


def _draw_page_border(pdf: Canvas) -> None:
    pdf.saveState()
    pdf.setStrokeColor(BORDER)
    pdf.setLineWidth(0.8)
    pdf.rect(0.7, 0.7, PAGE_WIDTH - 1.4, PAGE_HEIGHT - 1.4, stroke=1, fill=0)
    pdf.restoreState()


def _draw_header(pdf: Canvas, *, continuation: bool) -> None:
    left_x = PAGE_MARGIN_X
    top_y = PAGE_HEIGHT - (11.2 * mm)
    header_h = 34 * mm
    divider_x = left_x + (103 * mm)

    _draw_logo(pdf, left_x - (2.2 * mm), PAGE_HEIGHT - (38.5 * mm), 33 * mm, 31 * mm)

    info_x = left_x + (39.5 * mm)
    text_top = top_y - (1.3 * mm)
    pdf.setFillColor(PRIMARY_NAVY)
    pdf.setFont(FONT_BOLD, 16.5)
    pdf.drawString(info_x, text_top - 12, COMPANY_NAME)

    info_y = text_top - 24
    _draw_company_info_line(pdf, "document", info_x, info_y, f"CNPJ: {COMPANY_CNPJ}")
    _draw_company_info_line(pdf, "phone", info_x, info_y - 11.5, COMPANY_PHONE)
    _draw_company_info_line(pdf, "pin", info_x, info_y - 23, COMPANY_ADDRESS, wrap_width=58 * mm)

    pdf.setStrokeColor(BORDER)
    pdf.setLineWidth(1)
    pdf.line(divider_x, top_y - header_h + 1, divider_x, top_y - 1)

    title_x = divider_x + (11 * mm)
    title_y = top_y - (7.6 * mm)
    title_text = DOCUMENT_TITLE if not continuation else f"{DOCUMENT_TITLE} - CONTINUAÇÃO"
    pdf.setFillColor(PRIMARY_NAVY)
    pdf.setFont(FONT_BOLD, 29 if not continuation else 24)
    pdf.drawString(title_x, title_y - 22, title_text)

    pdf.setFillColor(PRIMARY_ORANGE)
    pdf.roundRect(title_x, title_y - 34, 14 * mm, 1.5 * mm, 0.7 * mm, stroke=0, fill=1)

    pdf.setFillColor(TEXT)
    pdf.setFont(FONT_REGULAR, 10.3)
    subtitle_y = title_y - 48
    pdf.drawString(title_x, subtitle_y, "Proposta comercial pronta para impressão")
    pdf.drawString(title_x, subtitle_y - 12, "ou envio ao cliente.")


def _draw_logo(pdf: Canvas, x: float, y: float, box_w: float, box_h: float) -> None:
    logo_path = next((path for path in LOGO_CANDIDATES if path.exists()), None)
    if not logo_path:
        pdf.setFillColor(PRIMARY_NAVY)
        pdf.setFont(FONT_BOLD, 22)
        pdf.drawString(x, y + (box_h * 0.6), "DOIS")
        pdf.setFillColor(PRIMARY_ORANGE)
        pdf.drawString(x, y + (box_h * 0.28), "IRMÃOS")
        return

    image = _build_logo_reader(logo_path)
    img_w, img_h = image.getSize()
    scale = min(box_w / img_w, box_h / img_h)
    draw_w = img_w * scale
    draw_h = img_h * scale
    draw_x = x + ((box_w - draw_w) / 2)
    draw_y = y + ((box_h - draw_h) / 2)
    pdf.drawImage(image, draw_x, draw_y, width=draw_w, height=draw_h, preserveAspectRatio=True, mask="auto")


def _build_logo_reader(logo_path: Path) -> ImageReader:
    try:
        from PIL import Image as PILImage

        image = PILImage.open(logo_path).convert("RGBA")
        pixels = image.load()
        width, height = image.size
        for y in range(height):
            for x in range(width):
                red, green, blue, alpha = pixels[x, y]
                is_flat_gray = abs(red - green) < 8 and abs(green - blue) < 8 and 120 <= red <= 205
                if is_flat_gray:
                    pixels[x, y] = (255, 255, 255, 0)
        output = io.BytesIO()
        image.save(output, format="PNG")
        output.seek(0)
        return ImageReader(output)
    except Exception:
        return ImageReader(str(logo_path))


def _draw_company_info_line(
    pdf: Canvas,
    kind: str,
    x: float,
    baseline_y: float,
    text: str,
    *,
    wrap_width: float | None = None,
) -> None:
    icon_size = 5.3 * mm
    _draw_inline_icon(pdf, kind, x, baseline_y - (3.5 * mm), icon_size)
    pdf.setFillColor(TEXT)
    pdf.setFont(FONT_REGULAR, 8.9)
    text_x = x + (8 * mm)
    if wrap_width:
        lines = _wrap_text(pdf, text, FONT_REGULAR, 8.9, wrap_width)
        for index, line in enumerate(lines[:2]):
            pdf.drawString(text_x, baseline_y - (index * 10.3), line)
    else:
        pdf.drawString(text_x, baseline_y, text)


def _draw_meta_cards(
    pdf: Canvas,
    *,
    quote_number: str,
    quote_date: str,
    validity_date: str,
    validity_days: int,
) -> None:
    card_y = PAGE_HEIGHT - (73.9 * mm)
    card_h = 22.2 * mm
    gap = 3.5 * mm
    card_w = (CONTENT_WIDTH - (gap * 3)) / 4

    specs = [
        ("doc_circle", PRIMARY_NAVY, "NÚMERO", quote_number, "", TEXT),
        ("calendar", PRIMARY_NAVY, "DATA", quote_date, "", TEXT),
        ("clock", PRIMARY_ORANGE, "VALIDADE", validity_date, f"({validity_days} dias)", PRIMARY_ORANGE_DARK),
        ("folder", PRIMARY_NAVY, "DOCUMENTO", DOCUMENT_TITLE, "", TEXT),
    ]

    current_x = PAGE_MARGIN_X
    for icon_kind, icon_color, label, value, hint, value_color in specs:
        _draw_meta_card(
            pdf,
            x=current_x,
            y=card_y,
            w=card_w,
            h=card_h,
            icon_kind=icon_kind,
            icon_color=icon_color,
            label=label,
            value=value,
            hint=hint,
            value_color=value_color,
            label_color=(PRIMARY_ORANGE_DARK if label == "VALIDADE" else PRIMARY_NAVY_TEXT),
        )
        current_x += card_w + gap


def _draw_meta_card(
    pdf: Canvas,
    *,
    x: float,
    y: float,
    w: float,
    h: float,
    icon_kind: str,
    icon_color: colors.Color,
    label: str,
    value: str,
    hint: str,
    value_color: colors.Color,
    label_color: colors.Color,
) -> None:
    pdf.saveState()
    pdf.setFillColor(WHITE)
    pdf.setStrokeColor(BORDER)
    pdf.setLineWidth(0.9)
    pdf.roundRect(x, y, w, h, 2.4 * mm, stroke=1, fill=1)

    circle_size = 11.5 * mm
    circle_x = x + (5.8 * mm)
    circle_y = y + ((h - circle_size) / 2)
    pdf.setFillColor(icon_color)
    pdf.circle(circle_x + (circle_size / 2), circle_y + (circle_size / 2), circle_size / 2, stroke=0, fill=1)
    _draw_circle_icon(pdf, icon_kind, circle_x, circle_y, circle_size)

    text_x = x + (22.2 * mm)
    pdf.setFillColor(label_color)
    pdf.setFont(FONT_BOLD, 7.8)
    pdf.drawString(text_x, y + h - (8.1 * mm), label)

    pdf.setFillColor(value_color)
    if label == "DOCUMENTO":
        pdf.setFont(FONT_BOLD, 10.3)
        pdf.drawString(text_x, y + (7.3 * mm), value)
    else:
        pdf.setFont(FONT_BOLD, 10.9)
        pdf.drawString(text_x, y + (7.2 * mm), value)
    if hint:
        pdf.setFont(FONT_REGULAR, 8.3)
        pdf.drawString(text_x + (0.6 * mm), y + (2.7 * mm), hint)
    pdf.restoreState()


def _draw_customer_section(pdf: Canvas, *, customer_name: str) -> None:
    section_x = PAGE_MARGIN_X
    section_w = CONTENT_WIDTH
    header_y = PAGE_HEIGHT - (88.2 * mm)
    header_h = 9.8 * mm
    body_h = 14.6 * mm

    pdf.saveState()
    pdf.setFillColor(PRIMARY_NAVY)
    pdf.setStrokeColor(PRIMARY_NAVY)
    pdf.roundRect(section_x, header_y, section_w, header_h, 2.4 * mm, stroke=1, fill=1)
    pdf.setFillColor(WHITE)
    pdf.setStrokeColor(WHITE)
    pdf.setLineWidth(1.1)
    pdf.circle(section_x + (7.7 * mm), header_y + (header_h / 2), 3.1 * mm, stroke=1, fill=0)
    _draw_small_document_icon(pdf, section_x + (6.35 * mm), header_y + (header_h / 2) - (1.75 * mm), 2.7 * mm)
    pdf.setFont(FONT_BOLD, 11.5)
    pdf.drawString(section_x + (14 * mm), header_y + (3.1 * mm), "DADOS DO ORÇAMENTO")

    body_y = header_y - body_h + 1
    pdf.setFillColor(WHITE)
    pdf.setStrokeColor(BORDER)
    pdf.setLineWidth(0.9)
    pdf.roundRect(section_x, body_y, section_w, body_h, 2.4 * mm, stroke=1, fill=1)
    pdf.setFillColor(PRIMARY_NAVY_TEXT)
    pdf.setFont(FONT_BOLD, 10.2)
    label_y = body_y + (6 * mm)
    pdf.drawString(section_x + (5.2 * mm), label_y, "CLIENTE")
    line_x1 = section_x + (20 * mm)
    line_x2 = section_x + section_w - (6 * mm)
    pdf.setStrokeColor(BORDER)
    pdf.setLineWidth(0.8)
    pdf.line(line_x1, body_y + (4.7 * mm), line_x2, body_y + (4.7 * mm))
    if customer_name:
        pdf.setFillColor(TEXT)
        pdf.setFont(FONT_REGULAR, 9.8)
        display_name = _truncate_text(pdf, customer_name, FONT_REGULAR, 9.8, line_x2 - line_x1 - (2 * mm))
        pdf.drawString(line_x1 + (1.8 * mm), body_y + (5.8 * mm), display_name)
    pdf.restoreState()


def _draw_items_table(pdf: Canvas, *, items: list[dict[str, Any]]) -> None:
    table_x = PAGE_MARGIN_X
    table_top = PAGE_HEIGHT - (107.8 * mm)
    table_w = CONTENT_WIDTH
    header_h = 11.8 * mm
    row_h = 12.4 * mm
    body_rows = max(ROWS_PER_PAGE, len(items))
    table_h = header_h + (row_h * body_rows)

    col_widths = [61 * mm, 26 * mm, 29 * mm, 35 * mm, table_w - (61 * mm) - (26 * mm) - (29 * mm) - (35 * mm)]
    col_x = [table_x]
    for width in col_widths[:-1]:
        col_x.append(col_x[-1] + width)

    table_y = table_top - table_h

    pdf.saveState()
    pdf.setFillColor(WHITE)
    pdf.setStrokeColor(BORDER)
    pdf.setLineWidth(0.9)
    pdf.roundRect(table_x, table_y, table_w, table_h, 2.4 * mm, stroke=1, fill=1)

    pdf.setFillColor(PRIMARY_NAVY)
    pdf.setStrokeColor(PRIMARY_NAVY)
    pdf.roundRect(table_x, table_top - header_h, table_w, header_h, 2.4 * mm, stroke=0, fill=1)
    pdf.rect(table_x, table_top - header_h, table_w, header_h - (2.4 * mm), stroke=0, fill=1)

    headers = ["DESCRIÇÃO", "QNTD", "UN", "VALOR UNIT.", "VALOR TOTAL"]
    for index, header in enumerate(headers):
        width = col_widths[index]
        x = col_x[index]
        pdf.setFillColor(WHITE)
        pdf.setFont(FONT_BOLD, 10.0)
        text_w = stringWidth(header, FONT_BOLD, 10.0)
        pdf.drawString(x + ((width - text_w) / 2), table_top - (7.5 * mm), header)
        if index > 0:
            pdf.setStrokeColor(colors.HexColor("#93A8C7"))
            pdf.setLineWidth(0.8)
            pdf.line(x, table_top - header_h, x, table_top)

    for row_index in range(body_rows):
        row_top = table_top - header_h - (row_index * row_h)
        row_bottom = row_top - row_h
        if row_index % 2 == 1:
            pdf.setFillColor(STRIPE)
            pdf.rect(table_x, row_bottom, table_w, row_h, stroke=0, fill=1)
        pdf.setStrokeColor(GRID)
        pdf.setLineWidth(0.7)
        pdf.line(table_x, row_bottom, table_x + table_w, row_bottom)

        for vertical_x in col_x[1:]:
            pdf.line(vertical_x, row_bottom, vertical_x, row_top)

        if row_index < len(items):
            item = items[row_index]
            _draw_table_row(pdf, row_bottom=row_bottom, row_h=row_h, col_x=col_x, col_widths=col_widths, item=item)

    pdf.restoreState()


def _draw_table_row(
    pdf: Canvas,
    *,
    row_bottom: float,
    row_h: float,
    col_x: list[float],
    col_widths: list[float],
    item: dict[str, Any],
) -> None:
    center_y = row_bottom + (row_h / 2)
    text_y = center_y - 3.2
    pdf.setFillColor(TEXT)

    pdf.setFont(FONT_REGULAR, 10.0)
    description = _truncate_text(pdf, item["item_name"] or "-", FONT_REGULAR, 10.0, col_widths[0] - (8 * mm))
    pdf.drawString(col_x[0] + (4.1 * mm), text_y, description)

    pdf.setFont(FONT_REGULAR, 9.8)
    quantity = _format_number(item["quantity"])
    q_w = stringWidth(quantity, FONT_REGULAR, 9.8)
    pdf.drawString(col_x[1] + ((col_widths[1] - q_w) / 2), text_y, quantity)

    unit = _truncate_text(pdf, item["unit"] or "Unidade", FONT_REGULAR, 9.8, col_widths[2] - (5 * mm))
    u_w = stringWidth(unit, FONT_REGULAR, 9.8)
    pdf.drawString(col_x[2] + ((col_widths[2] - u_w) / 2), text_y, unit)

    pdf.setFont(FONT_BOLD, 9.9)
    unit_price = _format_currency(item["unit_price"])
    total_price = _format_currency(item["total_price"])
    pdf.drawRightString(col_x[3] + col_widths[3] - (4.4 * mm), text_y, unit_price)
    pdf.drawRightString(col_x[4] + col_widths[4] - (4.4 * mm), text_y, total_price)


def _draw_total_banner(pdf: Canvas, *, total_amount: float) -> None:
    x = PAGE_MARGIN_X
    y = PAGE_HEIGHT - (268.7 * mm)
    w = CONTENT_WIDTH
    h = 20 * mm

    pdf.saveState()
    pdf.setFillColor(PRIMARY_ORANGE)
    pdf.setStrokeColor(PRIMARY_ORANGE_DARK)
    pdf.setLineWidth(1)
    pdf.roundRect(x, y, w, h, 2.6 * mm, stroke=1, fill=1)

    circle_size = 13 * mm
    circle_x = x + (5.9 * mm)
    circle_y = y + ((h - circle_size) / 2)
    pdf.setStrokeColor(WHITE)
    pdf.setLineWidth(1.6)
    pdf.circle(circle_x + (circle_size / 2), circle_y + (circle_size / 2), circle_size / 2, stroke=1, fill=0)
    _draw_calculator_icon(pdf, circle_x + (3.2 * mm), circle_y + (2.7 * mm), 6.7 * mm)

    pdf.setFillColor(WHITE)
    pdf.setFont(FONT_BOLD, 21.5)
    pdf.drawString(x + (29 * mm), y + (8.6 * mm), "TOTAL GERAL")

    divider_x = x + (90 * mm)
    pdf.setLineWidth(1.2)
    pdf.line(divider_x, y + (3.5 * mm), divider_x, y + h - (3.5 * mm))

    pdf.setFont(FONT_BOLD, 28.5)
    pdf.drawRightString(x + w - (6.2 * mm), y + (8.4 * mm), _format_currency(total_amount))
    pdf.restoreState()


def _draw_footer_note(pdf: Canvas) -> None:
    center_x = PAGE_WIDTH / 2
    text_y = PAGE_HEIGHT - (280.5 * mm)

    pdf.saveState()
    pdf.setStrokeColor(PRIMARY_NAVY)
    pdf.setLineWidth(1)
    pdf.setDash(1.2, 2.2)
    pdf.line(PAGE_MARGIN_X + (4 * mm), text_y + (2.8 * mm), PAGE_MARGIN_X + (45 * mm), text_y + (2.8 * mm))
    pdf.line(PAGE_WIDTH - PAGE_MARGIN_X - (45 * mm), text_y + (2.8 * mm), PAGE_WIDTH - PAGE_MARGIN_X - (4 * mm), text_y + (2.8 * mm))
    pdf.setDash()

    pdf.setFillColor(TEXT)
    pdf.setFont(FONT_REGULAR, 8.9)
    for index, line in enumerate(FOOTER_TEXT.split("\n")):
        text_w = stringWidth(line, FONT_REGULAR, 8.9)
        pdf.drawString(center_x - (text_w / 2), text_y + (8 - index * 9.6), line)
    pdf.restoreState()


def _draw_inline_icon(pdf: Canvas, kind: str, x: float, y: float, size: float) -> None:
    pdf.saveState()
    pdf.setStrokeColor(PRIMARY_NAVY)
    pdf.setFillColor(PRIMARY_NAVY)
    pdf.setLineWidth(1)

    if kind == "document":
        pdf.roundRect(x, y, size * 0.72, size * 0.82, 0.8, stroke=1, fill=0)
        pdf.line(x + (size * 0.17), y + (size * 0.55), x + (size * 0.54), y + (size * 0.55))
        pdf.line(x + (size * 0.17), y + (size * 0.36), x + (size * 0.54), y + (size * 0.36))
        pdf.line(x + (size * 0.5), y + (size * 0.82), x + (size * 0.72), y + (size * 0.6))
    elif kind == "phone":
        pdf.setLineWidth(1.5)
        pdf.line(x + (size * 0.18), y + (size * 0.2), x + (size * 0.45), y + (size * 0.46))
        pdf.line(x + (size * 0.45), y + (size * 0.46), x + (size * 0.63), y + (size * 0.29))
        pdf.line(x + (size * 0.22), y + (size * 0.15), x + (size * 0.1), y + (size * 0.32))
        pdf.line(x + (size * 0.58), y + (size * 0.2), x + (size * 0.72), y + (size * 0.37))
    else:
        pdf.circle(x + (size * 0.36), y + (size * 0.54), size * 0.17, stroke=1, fill=0)
        pdf.line(x + (size * 0.36), y + (size * 0.1), x + (size * 0.17), y + (size * 0.42))
        pdf.line(x + (size * 0.36), y + (size * 0.1), x + (size * 0.55), y + (size * 0.42))
    pdf.restoreState()


def _draw_circle_icon(pdf: Canvas, kind: str, x: float, y: float, size: float) -> None:
    pdf.saveState()
    pdf.setStrokeColor(WHITE)
    pdf.setFillColor(WHITE)
    pdf.setLineWidth(1.2)

    if kind == "calendar":
        pdf.roundRect(x + (size * 0.22), y + (size * 0.2), size * 0.56, size * 0.5, 1, stroke=1, fill=0)
        pdf.line(x + (size * 0.22), y + (size * 0.58), x + (size * 0.78), y + (size * 0.58))
        pdf.line(x + (size * 0.35), y + (size * 0.78), x + (size * 0.35), y + (size * 0.61))
        pdf.line(x + (size * 0.65), y + (size * 0.78), x + (size * 0.65), y + (size * 0.61))
    elif kind == "clock":
        pdf.circle(x + (size / 2), y + (size / 2), size * 0.26, stroke=1, fill=0)
        pdf.line(x + (size / 2), y + (size / 2), x + (size / 2), y + (size * 0.62))
        pdf.line(x + (size / 2), y + (size / 2), x + (size * 0.61), y + (size * 0.42))
    elif kind == "folder":
        pdf.roundRect(x + (size * 0.18), y + (size * 0.26), size * 0.62, size * 0.4, 1, stroke=1, fill=0)
        pdf.line(x + (size * 0.18), y + (size * 0.66), x + (size * 0.4), y + (size * 0.66))
        pdf.line(x + (size * 0.4), y + (size * 0.66), x + (size * 0.48), y + (size * 0.75))
        pdf.line(x + (size * 0.48), y + (size * 0.75), x + (size * 0.8), y + (size * 0.75))
    else:
        pdf.roundRect(x + (size * 0.24), y + (size * 0.18), size * 0.44, size * 0.58, 1, stroke=1, fill=0)
        pdf.line(x + (size * 0.35), y + (size * 0.55), x + (size * 0.58), y + (size * 0.55))
        pdf.line(x + (size * 0.35), y + (size * 0.42), x + (size * 0.58), y + (size * 0.42))
        pdf.line(x + (size * 0.5), y + (size * 0.76), x + (size * 0.68), y + (size * 0.58))
    pdf.restoreState()


def _draw_small_document_icon(pdf: Canvas, x: float, y: float, size: float) -> None:
    pdf.saveState()
    pdf.setStrokeColor(WHITE)
    pdf.setLineWidth(0.95)
    pdf.roundRect(x, y, size * 0.75, size, 0.7, stroke=1, fill=0)
    pdf.line(x + (size * 0.18), y + (size * 0.66), x + (size * 0.56), y + (size * 0.66))
    pdf.line(x + (size * 0.18), y + (size * 0.48), x + (size * 0.56), y + (size * 0.48))
    pdf.restoreState()


def _draw_calculator_icon(pdf: Canvas, x: float, y: float, size: float) -> None:
    pdf.saveState()
    pdf.setStrokeColor(WHITE)
    pdf.setLineWidth(1.15)
    pdf.roundRect(x, y, size, size * 1.18, 1.2, stroke=1, fill=0)
    pdf.rect(x + (size * 0.16), y + (size * 0.8), size * 0.68, size * 0.18, stroke=1, fill=0)
    key = size * 0.17
    gap = size * 0.09
    start_x = x + (size * 0.16)
    start_y = y + (size * 0.18)
    for row in range(2):
        for col in range(2):
            pdf.rect(start_x + col * (key + gap), start_y + row * (key + gap), key, key, stroke=1, fill=0)
    pdf.restoreState()


def _normalize_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized_items: list[dict[str, Any]] = []
    for item in items:
        quantity = _to_money(item.get("quantity"))
        unit_price = _to_money(item.get("unit_price"))
        total_price = _to_money(item.get("total_price") if item.get("total_price") is not None else quantity * unit_price)
        normalized_items.append(
            {
                "item_name": _clean(item.get("item_name") or item.get("product_name")),
                "unit": _clean(item.get("unit")) or "Unidade",
                "quantity": quantity,
                "unit_price": unit_price,
                "total_price": total_price,
            }
        )
    return normalized_items


def _clean(value: Any) -> str:
    return str(value or "").strip()


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
        return date.fromisoformat(raw_value[:10]).strftime("%d/%m/%Y")
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


def _wrap_text(pdf: Canvas, text: str, font_name: str, font_size: float, max_width: float) -> list[str]:
    words = text.split()
    if not words:
        return [""]
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _truncate_text(pdf: Canvas, text: str, font_name: str, font_size: float, max_width: float) -> str:
    value = _clean(text)
    if stringWidth(value, font_name, font_size) <= max_width:
        return value
    while value and stringWidth(f"{value}...", font_name, font_size) > max_width:
        value = value[:-1]
    return f"{value}..." if value else ""
