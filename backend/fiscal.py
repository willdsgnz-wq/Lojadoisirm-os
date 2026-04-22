from __future__ import annotations

import hashlib
import html
import io
import random
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

from reportlab.graphics.barcode import code128
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle

from backend.utils import round_money


BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_ROOT = BASE_DIR / "storage" / "nfe"
LOGO_CANDIDATES = (
    BASE_DIR / "frontend" / "static" / "brand" / "logo_dois_irmaos_final.png",
    BASE_DIR / "frontend" / "static" / "brand" / "logo_dois_irmaos.png",
    BASE_DIR / "frontend" / "static" / "brand" / "logo_dois_irmaos_cropped.png",
)


@dataclass(slots=True)
class FiscalEmissionResult:
    provider_name: str
    number: int
    series: int
    access_key: str
    authorization_protocol: str
    status: str
    authorization_date: str
    xml_content: str
    provider_message: str


class FiscalProvider(ABC):
    name = "base"

    @abstractmethod
    def emit_nfe(self, settings: dict[str, Any], payload: dict[str, Any]) -> FiscalEmissionResult:
        raise NotImplementedError


class MockFiscalProvider(FiscalProvider):
    name = "mock"

    def emit_nfe(self, settings: dict[str, Any], payload: dict[str, Any]) -> FiscalEmissionResult:
        number = int(payload["number"])
        series = int(payload["series"])
        emitted_at = datetime.now().isoformat(timespec="seconds")
        cnpj_digits = _digits_only(settings.get("cnpj") or "00000000000000").ljust(14, "0")[:14]
        access_key = _build_access_key(cnpj_digits, number, series, emitted_at)
        protocol = f"MOCK{random.randint(100000000000, 999999999999)}"
        environment = settings.get("environment") or "homologation"
        xml_content = _build_nfe_xml(settings, payload, access_key, protocol, emitted_at, environment)

        return FiscalEmissionResult(
            provider_name=self.name,
            number=number,
            series=series,
            access_key=access_key,
            authorization_protocol=protocol,
            status="AUTORIZADA",
            authorization_date=emitted_at,
            xml_content=xml_content,
            provider_message="NF-e emitida em provider mock/homologacao. Estrutura pronta para conexao fiscal real.",
        )


class XmlStorageService:
    def save_xml(self, *, access_key: str, authorization_date: str, xml_content: str) -> str:
        folder = self._get_folder("xml", authorization_date)
        folder.mkdir(parents=True, exist_ok=True)
        file_path = folder / f"{access_key}.xml"
        file_path.write_text(xml_content, encoding="utf-8")
        return str(file_path)

    def _get_folder(self, document_type: str, authorization_date: str) -> Path:
        timestamp = datetime.fromisoformat(authorization_date)
        return STORAGE_ROOT / document_type / f"{timestamp:%Y}" / f"{timestamp:%m}"


class DanfeService:
    page_size = A4
    margin = 4 * mm
    inner_pad = 1.15 * mm
    border_width = 0.42
    label_font = 4.7
    value_font = 6.3
    mono_font = "Helvetica"
    bold_font = "Helvetica-Bold"
    section_title_height = 3.6 * mm
    operation_nature_default = "VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS"

    def save_pdf(
        self,
        *,
        authorization_date: str,
        access_key: str,
        nfe_record: dict[str, Any],
        sale: dict[str, Any],
        settings: dict[str, Any],
    ) -> str:
        folder = self._get_folder("pdf", authorization_date)
        folder.mkdir(parents=True, exist_ok=True)
        file_path = folder / f"{access_key}.pdf"
        file_path.write_bytes(self._build_pdf_bytes(nfe_record=nfe_record, sale=sale, settings=settings))
        return str(file_path)

    def _get_folder(self, document_type: str, authorization_date: str) -> Path:
        timestamp = datetime.fromisoformat(authorization_date)
        return STORAGE_ROOT / document_type / f"{timestamp:%Y}" / f"{timestamp:%m}"

    def _build_pdf_bytes(self, *, nfe_record: dict[str, Any], sale: dict[str, Any], settings: dict[str, Any]) -> bytes:
        buffer = io.BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=self.page_size)
        pdf.setTitle("DANFE")
        pdf.setAuthor(str(settings.get("company_name") or settings.get("trade_name") or "Emitente"))
        pdf.setSubject("Documento Auxiliar da Nota Fiscal Eletronica")
        pdf.setLineWidth(self.border_width)
        pdf.setStrokeColor(colors.black)
        pdf.setFillColor(colors.white)

        page_width, page_height = self.page_size
        content_x = self.margin
        content_top = page_height - self.margin
        content_width = page_width - (2 * self.margin)

        context = self._build_context(nfe_record=nfe_record, sale=sale, settings=settings)

        receipt_height = 22 * mm
        self._draw_receipt_stub(pdf, context=context, x=content_x, top=content_top, width=content_width, height=receipt_height)

        dashed_y = content_top - receipt_height - 1.3 * mm
        pdf.setDash(3, 2)
        pdf.line(content_x, dashed_y, content_x + content_width, dashed_y)
        pdf.setDash()

        current_top = dashed_y - 2 * mm

        header_height = 31 * mm
        self._draw_main_header(pdf, context=context, x=content_x, top=current_top, width=content_width, height=header_height)
        current_top -= header_height

        operation_height = 8.5 * mm
        self._draw_operation_row(pdf, context=context, x=content_x, top=current_top, width=content_width, height=operation_height)
        current_top -= operation_height

        registration_height = 7.6 * mm
        self._draw_registration_row(pdf, context=context, x=content_x, top=current_top, width=content_width, height=registration_height)
        current_top -= registration_height

        recipient_height = 23.5 * mm
        self._draw_recipient_block(pdf, context=context, x=content_x, top=current_top, width=content_width, height=recipient_height)
        current_top -= recipient_height

        duplicates_height = 8.8 * mm
        self._draw_duplicates_block(pdf, context=context, x=content_x, top=current_top, width=content_width, height=duplicates_height)
        current_top -= duplicates_height

        tax_height = 13.8 * mm
        self._draw_tax_block(pdf, context=context, x=content_x, top=current_top, width=content_width, height=tax_height)
        current_top -= tax_height

        transport_height = 15.2 * mm
        self._draw_transport_block(pdf, context=context, x=content_x, top=current_top, width=content_width, height=transport_height)
        current_top -= transport_height

        additional_height = 26 * mm
        products_height = max(92 * mm, current_top - self.margin - additional_height)
        self._draw_products_block(pdf, context=context, x=content_x, top=current_top, width=content_width, height=products_height)
        current_top -= products_height

        additional_height = max(additional_height, current_top - self.margin)
        self._draw_additional_block(pdf, context=context, x=content_x, top=current_top, width=content_width, height=additional_height)

        footer_text = f"DATA E HORA DA IMPRESSAO: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}"
        pdf.setFont(self.mono_font, 5.6)
        pdf.drawRightString(page_width - self.margin, 2.8 * mm, footer_text)

        pdf.showPage()
        pdf.save()
        return buffer.getvalue()

    def _build_context(
        self,
        *,
        nfe_record: dict[str, Any],
        sale: dict[str, Any],
        settings: dict[str, Any],
    ) -> dict[str, Any]:
        issue_dt = _parse_datetime(nfe_record.get("authorization_date")) or _parse_datetime(
            f"{sale.get('sale_date') or ''}T{sale.get('sale_time') or ''}"
        ) or datetime.now()
        exit_dt = _parse_datetime(f"{sale.get('sale_date') or ''}T{sale.get('sale_time') or ''}") or issue_dt

        customer = sale.get("customer") or {}
        customer_name = str(sale.get("customer_name") or customer.get("name") or "CONSUMIDOR FINAL").strip()
        customer_document = customer.get("document") or ""
        customer_address = customer.get("address") or ""
        customer_phone = customer.get("phone") or ""
        customer_parts = _split_address_fields(customer_address)

        number_text = _format_nfe_number(nfe_record.get("number_nfe"))
        series_text = _format_series(nfe_record.get("series_nfe"))
        access_key = _digits_only(nfe_record.get("access_key") or "").ljust(44, "0")[:44]

        items: list[dict[str, Any]] = []
        total_products = 0.0
        for raw_item in sale.get("items") or []:
            quantity = round_money(raw_item.get("quantity") or 0)
            unit_price = round_money(raw_item.get("unit_price") or 0)
            subtotal = round_money(raw_item.get("total_price") or raw_item.get("subtotal") or quantity * unit_price)
            discount = round_money(raw_item.get("discount") or 0)
            liquid_total = round_money(subtotal - discount)
            total_products += liquid_total
            items.append(
                {
                    "sku": str(raw_item.get("sku") or raw_item.get("product_code") or "-"),
                    "description": str(raw_item.get("description") or raw_item.get("product_name") or "-"),
                    "ncm": str(raw_item.get("ncm") or "-"),
                    "csosn": str(raw_item.get("csosn") or raw_item.get("cst") or "-"),
                    "cfop": str(raw_item.get("cfop") or "-"),
                    "unit": str(raw_item.get("unit") or "UN"),
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "discount": discount,
                    "liquid_total": liquid_total,
                    "icms_base": round_money(raw_item.get("icms_base") or 0),
                    "icms_value": round_money(raw_item.get("icms_value") or 0),
                    "ipi_value": round_money(raw_item.get("ipi_value") or 0),
                    "icms_rate": round_money(raw_item.get("icms_rate") or 0),
                    "ipi_rate": round_money(raw_item.get("ipi_rate") or 0),
                }
            )

        total_amount = round_money(sale.get("total_amount") or total_products)
        payment_method = str(sale.get("payment_method") or "").strip() or "Nao informado"

        receipt_line = (
            f"Emissao: {issue_dt.strftime('%d/%m/%Y %H:%M')}  "
            f"Dest/Reme: {_truncate_text(_upper_text(customer_name), 44)}  "
            f"Valor Total: {_format_currency(total_amount)}"
        )

        duplicate_due_days = 30 if payment_method.lower() in {"boleto", "cheque", "prazo", "a prazo", "à prazo"} else 0
        duplicate_due = issue_dt + timedelta(days=duplicate_due_days)

        additional_lines = []
        additional_lines.append(f"Pagamento(s): ({payment_method} R${_format_currency(total_amount)})")
        if sale.get("notes"):
            additional_lines.append(str(sale.get("notes")))
        additional_lines.append(f"Cliente: {_upper_text(customer_name)}")
        additional_lines.append(f"Ambiente: {'HOMOLOGACAO' if str(settings.get('environment') or 'homologation') == 'homologation' else 'PRODUCAO'}")

        return {
            "settings": settings,
            "sale": sale,
            "nfe_record": nfe_record,
            "issue_dt": issue_dt,
            "exit_dt": exit_dt,
            "customer_name": customer_name,
            "customer_document": _format_document(customer_document),
            "customer_phone": customer_phone,
            "customer_parts": customer_parts,
            "items": items,
            "total_products": total_products,
            "total_amount": total_amount,
            "payment_method": payment_method,
            "number_text": number_text,
            "series_text": series_text,
            "access_key": access_key,
            "receipt_text": (
                f"Recebemos de {_upper_text(settings.get('company_name') or settings.get('trade_name') or 'EMITENTE')} "
                "os produtos e/ou servicos constantes da Nota Fiscal Eletronica indicada ao lado."
            ),
            "receipt_line": receipt_line,
            "operation_nature": str(settings.get("operation_nature") or self.operation_nature_default),
            "protocol_text": f"{nfe_record.get('authorization_protocol') or '-'}  {issue_dt.strftime('%d/%m/%Y %H:%M:%S')}",
            "duplicate": {
                "number": "001",
                "due_date": duplicate_due.strftime("%d/%m/%Y"),
                "value": total_amount,
            },
            "additional_lines": additional_lines,
        }

    def _draw_receipt_stub(
        self,
        pdf: canvas.Canvas,
        *,
        context: dict[str, Any],
        x: float,
        top: float,
        width: float,
        height: float,
    ) -> None:
        y = top - height
        right_width = 38 * mm
        left_width = width - right_width

        self._box(pdf, x, y, left_width, height)
        self._box(pdf, x + left_width, y, right_width, height)

        text_height = 10 * mm
        lower_height = height - text_height
        pdf.line(x, y + lower_height, x + left_width, y + lower_height)
        pdf.line(x + (left_width * 0.48), y, x + (left_width * 0.48), y + lower_height)

        self._draw_wrapped_paragraph(
            pdf,
            context["receipt_text"],
            x + self.inner_pad,
            y + height - text_height + 1.1 * mm,
            left_width - (2 * self.inner_pad),
            text_height - 2.2 * mm,
            font_name=self.mono_font,
            font_size=6.6,
            leading=7.0,
            max_lines=2,
        )
        self._draw_wrapped_paragraph(
            pdf,
            context["receipt_line"],
            x + self.inner_pad,
            y + lower_height + 0.6 * mm,
            left_width - (2 * self.inner_pad),
            4.3 * mm,
            font_name=self.mono_font,
            font_size=5.7,
            leading=6.0,
            max_lines=1,
        )

        self._draw_label(pdf, x + self.inner_pad, y + 1.7 * mm, "DATA DO RECEBIMENTO")
        self._draw_label(pdf, x + (left_width * 0.48) + self.inner_pad, y + 1.7 * mm, "IDENTIFICACAO E ASSINATURA DO RECEBEDOR")

        center_x = x + left_width + (right_width / 2)
        pdf.setFont(self.bold_font, 10.5)
        pdf.drawCentredString(center_x, y + height - 5.2 * mm, "NF-e")
        pdf.setFont(self.bold_font, 9.4)
        pdf.drawCentredString(center_x, y + height - 10.5 * mm, f"Nº {context['number_text']}")
        pdf.drawCentredString(center_x, y + height - 15.6 * mm, f"Série {context['series_text']}")

    def _draw_main_header(
        self,
        pdf: canvas.Canvas,
        *,
        context: dict[str, Any],
        x: float,
        top: float,
        width: float,
        height: float,
    ) -> None:
        y = top - height
        emitter_width = 86 * mm
        danfe_width = 31 * mm
        access_width = width - emitter_width - danfe_width

        self._draw_emitter_panel(pdf, context=context, x=x, y=y, width=emitter_width, height=height)
        self._draw_danfe_panel(pdf, context=context, x=x + emitter_width, y=y, width=danfe_width, height=height)
        self._draw_access_key_panel(pdf, context=context, x=x + emitter_width + danfe_width, y=y, width=access_width, height=height)

    def _draw_emitter_panel(
        self,
        pdf: canvas.Canvas,
        *,
        context: dict[str, Any],
        x: float,
        y: float,
        width: float,
        height: float,
    ) -> None:
        settings = context["settings"]
        self._box(pdf, x, y, width, height)

        logo_path = self._get_logo_path()
        logo_width = 0.0
        if logo_path:
            image = ImageReader(str(logo_path))
            image_width, image_height = image.getSize()
            logo_width = 15 * mm
            logo_height = min(13 * mm, logo_width * image_height / max(image_width, 1))
            pdf.drawImage(
                image,
                x + self.inner_pad,
                y + height - logo_height - 1.8 * mm,
                width=logo_width,
                height=logo_height,
                preserveAspectRatio=True,
                mask="auto",
            )

        name_x = x + self.inner_pad + (logo_width + 1.6 * mm if logo_width else 0)
        name_width = width - (name_x - x) - self.inner_pad
        emitter_name = _upper_text(settings.get("company_name") or settings.get("trade_name") or "EMITENTE")
        self._draw_wrapped_paragraph(
            pdf,
            emitter_name,
            name_x,
            y + height - 11.4 * mm,
            name_width,
            8.8 * mm,
            font_name=self.bold_font,
            font_size=8.2,
            leading=8.6,
            max_lines=2,
        )

        address_lines = self._build_emitter_lines(settings)
        self._draw_wrapped_paragraph(
            pdf,
            "\n".join(address_lines),
            x + self.inner_pad,
            y + 2.2 * mm,
            width - (2 * self.inner_pad),
            height - 14.2 * mm,
            font_name=self.mono_font,
            font_size=5.9,
            leading=6.2,
            max_lines=6,
        )

    def _draw_danfe_panel(
        self,
        pdf: canvas.Canvas,
        *,
        context: dict[str, Any],
        x: float,
        y: float,
        width: float,
        height: float,
    ) -> None:
        self._box(pdf, x, y, width, height)

        title_top = y + height
        pdf.setFont(self.bold_font, 15.5)
        pdf.drawCentredString(x + (width / 2), title_top - 5.6 * mm, "DANFE")

        self._draw_wrapped_paragraph(
            pdf,
            "Documento Auxiliar da\nNota Fiscal Eletronica",
            x + 1 * mm,
            y + height - 14.5 * mm,
            width - 2 * mm,
            8 * mm,
            font_name=self.mono_font,
            font_size=5.8,
            leading=6.1,
            max_lines=2,
            align="center",
        )

        lower_height = 14.2 * mm
        lower_y = y
        pdf.line(x, lower_y + lower_height, x + width, lower_y + lower_height)

        flow_width = 11 * mm
        self._box(pdf, x, lower_y, flow_width, lower_height)
        self._draw_label(pdf, x + 1 * mm, lower_y + lower_height - 3.2 * mm, "0 - ENTRADA")
        self._draw_label(pdf, x + 1 * mm, lower_y + lower_height - 6.3 * mm, "1 - SAIDA")
        pdf.setFont(self.bold_font, 11)
        pdf.drawCentredString(x + (flow_width / 2), lower_y + 2.5 * mm, "1")

        info_x = x + flow_width
        info_width = width - flow_width
        info_row_height = lower_height / 3
        for index, (label, value) in enumerate((
            ("NÚMERO", context["number_text"]),
            ("SÉRIE", context["series_text"]),
            ("FOLHA", "1/1"),
        )):
            row_y = lower_y + lower_height - ((index + 1) * info_row_height)
            self._box(pdf, info_x, row_y, info_width, info_row_height)
            self._draw_label(pdf, info_x + self.inner_pad, row_y + info_row_height - 2.4 * mm, label)
            self._draw_fitted_lines(
                pdf,
                [value],
                info_x + self.inner_pad,
                row_y + 1.2 * mm,
                info_width - (2 * self.inner_pad),
                info_row_height - 3.1 * mm,
                font_name=self.bold_font,
                font_size=7.0,
                align="left",
            )

    def _draw_access_key_panel(
        self,
        pdf: canvas.Canvas,
        *,
        context: dict[str, Any],
        x: float,
        y: float,
        width: float,
        height: float,
    ) -> None:
        self._box(pdf, x, y, width, height)
        self._draw_label(pdf, x + self.inner_pad, y + height - 3.4 * mm, "CHAVE DE ACESSO")

        self._draw_wrapped_paragraph(
            pdf,
            _format_access_key(context["access_key"]),
            x + self.inner_pad,
            y + height - 9.2 * mm,
            width - (2 * self.inner_pad),
            4.6 * mm,
            font_name=self.bold_font,
            font_size=6.7,
            leading=6.8,
            max_lines=1,
            align="center",
        )

        barcode = code128.Code128(context["access_key"], barWidth=0.22 * mm, barHeight=8.6 * mm, humanReadable=False)
        barcode_width, _barcode_height = barcode.wrap(width - 6 * mm, 8.6 * mm)
        barcode.drawOn(pdf, x + ((width - barcode_width) / 2), y + 12 * mm)

        self._draw_wrapped_paragraph(
            pdf,
            "Consulta de autenticidade no portal nacional da NF-e\nwww.nfe.fazenda.gov.br/portal ou no site da Sefaz autorizadora",
            x + self.inner_pad,
            y + 2.2 * mm,
            width - (2 * self.inner_pad),
            8.6 * mm,
            font_name=self.mono_font,
            font_size=5.0,
            leading=5.2,
            max_lines=2,
            align="center",
        )

    def _draw_operation_row(
        self,
        pdf: canvas.Canvas,
        *,
        context: dict[str, Any],
        x: float,
        top: float,
        width: float,
        height: float,
    ) -> None:
        y = top - height
        nature_width = 118 * mm
        self._cell(pdf, x=x, y=y, width=nature_width, height=height, label="NATUREZA DA OPERACAO", value=context["operation_nature"])
        self._cell(
            pdf,
            x=x + nature_width,
            y=y,
            width=width - nature_width,
            height=height,
            label="PROTOCOLO DE AUTORIZACAO DE USO",
            value=context["protocol_text"],
        )

    def _draw_registration_row(
        self,
        pdf: canvas.Canvas,
        *,
        context: dict[str, Any],
        x: float,
        top: float,
        width: float,
        height: float,
    ) -> None:
        y = top - height
        settings = context["settings"]
        first = 62 * mm
        second = 63 * mm
        self._cell(
            pdf,
            x=x,
            y=y,
            width=first,
            height=height,
            label="INSCRICAO ESTADUAL",
            value=settings.get("state_registration") or "-",
        )
        self._cell(
            pdf,
            x=x + first,
            y=y,
            width=second,
            height=height,
            label="INSCRICAO ESTADUAL DO SUBST. TRIBUTARIO",
            value=settings.get("substitute_registration") or "",
        )
        self._cell(
            pdf,
            x=x + first + second,
            y=y,
            width=width - first - second,
            height=height,
            label="CNPJ",
            value=_format_document(settings.get("cnpj")),
        )

    def _draw_recipient_block(
        self,
        pdf: canvas.Canvas,
        *,
        context: dict[str, Any],
        x: float,
        top: float,
        width: float,
        height: float,
    ) -> None:
        y = top - height
        self._box(pdf, x, y, width, height)
        self._section_caption(pdf, x, y, width, height, "DESTINATARIO / REMETENTE")

        body_height = height - self.section_title_height
        row_height = body_height / 3
        body_y = y
        parts = context["customer_parts"]

        row1_y = body_y + (row_height * 2)
        self._cell(pdf, x=x, y=row1_y, width=120 * mm, height=row_height, label="NOME / RAZAO SOCIAL", value=context["customer_name"], max_lines=2)
        self._cell(pdf, x=x + 120 * mm, y=row1_y, width=42 * mm, height=row_height, label="CNPJ / CPF", value=context["customer_document"])
        self._cell(pdf, x=x + 162 * mm, y=row1_y, width=width - 162 * mm, height=row_height, label="DATA DA EMISSAO", value=context["issue_dt"].strftime("%d/%m/%Y"))

        row2_y = body_y + row_height
        self._cell(pdf, x=x, y=row2_y, width=93 * mm, height=row_height, label="ENDERECO", value=parts["address"] or "-")
        self._cell(pdf, x=x + 93 * mm, y=row2_y, width=39 * mm, height=row_height, label="BAIRRO / DISTRITO", value=parts["district"] or "-")
        self._cell(pdf, x=x + 132 * mm, y=row2_y, width=26 * mm, height=row_height, label="CEP", value=parts["cep"] or "-")
        self._cell(pdf, x=x + 158 * mm, y=row2_y, width=width - 158 * mm, height=row_height, label="DATA DA SAIDA", value=context["exit_dt"].strftime("%d/%m/%Y"))

        row3_y = body_y
        self._cell(pdf, x=x, y=row3_y, width=70 * mm, height=row_height, label="MUNICIPIO", value=parts["city"] or "-")
        self._cell(pdf, x=x + 70 * mm, y=row3_y, width=42 * mm, height=row_height, label="TELEFONE / FAX", value=context["customer_phone"] or "-")
        self._cell(pdf, x=x + 112 * mm, y=row3_y, width=14 * mm, height=row_height, label="UF", value=parts["state"] or "-")
        self._cell(pdf, x=x + 126 * mm, y=row3_y, width=42 * mm, height=row_height, label="INSCRICAO ESTADUAL", value=parts["state_registration"] or "")
        self._cell(pdf, x=x + 168 * mm, y=row3_y, width=width - 168 * mm, height=row_height, label="HORA DA SAIDA", value=context["exit_dt"].strftime("%H:%M:%S"))

    def _draw_duplicates_block(
        self,
        pdf: canvas.Canvas,
        *,
        context: dict[str, Any],
        x: float,
        top: float,
        width: float,
        height: float,
    ) -> None:
        y = top - height
        self._box(pdf, x, y, width, height)
        self._section_caption(pdf, x, y, width, height, "DUPLICATAS")

        body_height = height - self.section_title_height
        dup = context["duplicate"]
        self._cell(pdf, x=x, y=y, width=28 * mm, height=body_height, label="Numero", value=dup["number"])
        self._cell(pdf, x=x + 28 * mm, y=y, width=34 * mm, height=body_height, label="Vencimento", value=dup["due_date"])
        self._cell(pdf, x=x + 62 * mm, y=y, width=34 * mm, height=body_height, label="Valor", value=f"R$ {_format_currency(dup['value'])}")
        self._cell(pdf, x=x + 96 * mm, y=y, width=width - 96 * mm, height=body_height, label="Pagamento", value=context["payment_method"])

    def _draw_tax_block(
        self,
        pdf: canvas.Canvas,
        *,
        context: dict[str, Any],
        x: float,
        top: float,
        width: float,
        height: float,
    ) -> None:
        y = top - height
        self._box(pdf, x, y, width, height)
        self._section_caption(pdf, x, y, width, height, "CALCULO DO IMPOSTO")

        body_height = height - self.section_title_height
        columns = [
            ("BASE DE CALCULO DO ICMS", "0,00", 26 * mm),
            ("VALOR DO ICMS", "0,00", 18 * mm),
            ("BASE DE CALCULO DO ICMS SUBST.", "0,00", 27 * mm),
            ("VALOR DO ICMS SUBST.", "0,00", 18 * mm),
            ("VALOR TOTAL DOS PRODUTOS", _format_currency(context["total_products"]), 21 * mm),
            ("VALOR DO FRETE", "0,00", 14 * mm),
            ("VALOR DO SEGURO", "0,00", 14 * mm),
            ("DESCONTO", "0,00", 13 * mm),
            ("OUTRAS DESPESAS ACESSORIAS", "0,00", 20 * mm),
            ("VALOR DO IPI", "0,00", 14 * mm),
            ("VALOR TOTAL DA NOTA", _format_currency(context["total_amount"]), width - (185 * mm)),
        ]

        cursor_x = x
        for label, value, cell_width in columns:
            self._cell(
                pdf,
                x=cursor_x,
                y=y,
                width=cell_width,
                height=body_height,
                label=label,
                value=value,
                font_size=5.9,
            )
            cursor_x += cell_width

    def _draw_transport_block(
        self,
        pdf: canvas.Canvas,
        *,
        context: dict[str, Any],
        x: float,
        top: float,
        width: float,
        height: float,
    ) -> None:
        y = top - height
        self._box(pdf, x, y, width, height)
        self._section_caption(pdf, x, y, width, height, "TRANSPORTADOR / VOLUMES TRANSPORTADOS")

        body_height = height - self.section_title_height
        upper_height = body_height * 0.52
        lower_height = body_height - upper_height

        upper_y = y + lower_height
        self._cell(pdf, x=x, y=upper_y, width=65 * mm, height=upper_height, label="NOME / RAZAO SOCIAL", value="")
        self._cell(pdf, x=x + 65 * mm, y=upper_y, width=21 * mm, height=upper_height, label="FRETE POR CONTA", value="9 - SEM FRETE", font_size=5.5)
        self._cell(pdf, x=x + 86 * mm, y=upper_y, width=18 * mm, height=upper_height, label="CODIGO ANTT", value="")
        self._cell(pdf, x=x + 104 * mm, y=upper_y, width=22 * mm, height=upper_height, label="PLACA DO VEICULO", value="")
        self._cell(pdf, x=x + 126 * mm, y=upper_y, width=10 * mm, height=upper_height, label="UF", value="")
        self._cell(pdf, x=x + 136 * mm, y=upper_y, width=width - 136 * mm, height=upper_height, label="CNPJ / CPF", value="")

        self._cell(pdf, x=x, y=y, width=50 * mm, height=lower_height, label="ENDERECO", value="")
        self._cell(pdf, x=x + 50 * mm, y=y, width=30 * mm, height=lower_height, label="MUNICIPIO", value="")
        self._cell(pdf, x=x + 80 * mm, y=y, width=8 * mm, height=lower_height, label="UF", value="")
        self._cell(pdf, x=x + 88 * mm, y=y, width=28 * mm, height=lower_height, label="INSCRICAO ESTADUAL", value="")
        self._cell(pdf, x=x + 116 * mm, y=y, width=12 * mm, height=lower_height, label="QUANTIDADE", value="0")
        self._cell(pdf, x=x + 128 * mm, y=y, width=12 * mm, height=lower_height, label="ESPECIE", value="")
        self._cell(pdf, x=x + 140 * mm, y=y, width=12 * mm, height=lower_height, label="MARCA", value="")
        self._cell(pdf, x=x + 152 * mm, y=y, width=12 * mm, height=lower_height, label="NUMERACAO", value="")
        self._cell(pdf, x=x + 164 * mm, y=y, width=18 * mm, height=lower_height, label="PESO BRUTO", value="0,000")
        self._cell(pdf, x=x + 182 * mm, y=y, width=width - 182 * mm, height=lower_height, label="PESO LIQUIDO", value="0,000")

    def _draw_products_block(
        self,
        pdf: canvas.Canvas,
        *,
        context: dict[str, Any],
        x: float,
        top: float,
        width: float,
        height: float,
    ) -> None:
        y = top - height
        self._box(pdf, x, y, width, height)
        self._section_caption(pdf, x, y, width, height, "DADOS DOS PRODUTOS / SERVICOS")

        inner_x = x + 0.5 * mm
        inner_y = y + 0.5 * mm
        inner_width = width - 1.0 * mm
        inner_height = height - self.section_title_height - 1.0 * mm

        header_height = 8.8 * mm
        row_height = 6.1 * mm
        visible_rows = max(1, int((inner_height - header_height) // row_height))

        rows = self._build_product_rows(context["items"])
        if len(rows) > visible_rows:
            remaining = len(rows) - visible_rows
            rows = rows[:visible_rows]
            rows[-1][1] = _truncate_text(f"{rows[-1][1]} (+{remaining} itens adicionais)", 54)
        while len(rows) < visible_rows:
            rows.append([""] * 15)

        table = self._make_products_table(inner_width, rows, header_height=header_height, row_height=row_height)
        table.wrapOn(pdf, inner_width, inner_height)
        table.drawOn(pdf, inner_x, inner_y)

    def _draw_additional_block(
        self,
        pdf: canvas.Canvas,
        *,
        context: dict[str, Any],
        x: float,
        top: float,
        width: float,
        height: float,
    ) -> None:
        y = top - height
        left_width = width * 0.76
        right_width = width - left_width

        self._box(pdf, x, y, left_width, height)
        self._box(pdf, x + left_width, y, right_width, height)
        self._section_caption(pdf, x, y, left_width, height, "DADOS ADICIONAIS")
        self._section_caption(pdf, x + left_width, y, right_width, height, "RESERVADO AO FISCO")

        self._draw_label(pdf, x + self.inner_pad, y + height - 6.8 * mm, "INFORMACOES COMPLEMENTARES")
        self._draw_wrapped_paragraph(
            pdf,
            "\n".join(context["additional_lines"]),
            x + self.inner_pad,
            y + 2.0 * mm,
            left_width - (2 * self.inner_pad),
            height - 9.0 * mm,
            font_name=self.mono_font,
            font_size=5.7,
            leading=6.1,
            max_lines=5,
        )

    def _build_emitter_lines(self, settings: dict[str, Any]) -> list[str]:
        line1_parts = [settings.get("street"), settings.get("number")]
        line1 = ", ".join(str(part).strip() for part in line1_parts if part)
        if settings.get("complement"):
            line1 = f"{line1} - {settings.get('complement')}" if line1 else str(settings.get("complement"))

        line2_parts = [settings.get("district"), settings.get("city"), settings.get("state")]
        line2 = " - ".join(str(part).strip() for part in line2_parts if part)
        zip_code = _format_zip(settings.get("zip_code"))
        if zip_code:
            line2 = f"{line2} - CEP: {zip_code}" if line2 else f"CEP: {zip_code}"

        contact_parts = []
        if settings.get("phone"):
            contact_parts.append(f"Fone: {settings.get('phone')}")
        if settings.get("email"):
            contact_parts.append(str(settings.get("email")))

        lines = []
        if line1:
            lines.append(line1)
        if line2:
            lines.append(line2)
        if contact_parts:
            lines.append("  ".join(contact_parts))
        return lines or ["Dados do emitente nao informados."]

    def _build_product_rows(self, items: list[dict[str, Any]]) -> list[list[str]]:
        rows: list[list[str]] = []
        for item in items:
            rows.append(
                [
                    _truncate_text(item["sku"], 12),
                    _truncate_text(item["description"], 56),
                    _truncate_text(item["ncm"], 10),
                    _truncate_text(item["csosn"], 9),
                    _truncate_text(item["cfop"], 6),
                    _truncate_text(item["unit"], 4),
                    _format_decimal(item["quantity"]),
                    _format_currency(item["unit_price"]),
                    _format_currency(item["discount"]),
                    _format_currency(item["liquid_total"]),
                    _format_currency(item["icms_base"]),
                    _format_currency(item["icms_value"]),
                    _format_currency(item["ipi_value"]),
                    _format_decimal(item["icms_rate"]),
                    _format_decimal(item["ipi_rate"]),
                ]
            )
        return rows or [[""] * 15]

    def _make_products_table(self, width: float, rows: list[list[str]], *, header_height: float, row_height: float) -> Table:
        col_widths = [
            12 * mm,
            59 * mm,
            13 * mm,
            10 * mm,
            9 * mm,
            8 * mm,
            10 * mm,
            13 * mm,
            11 * mm,
            13 * mm,
            12 * mm,
            10 * mm,
            9 * mm,
            6 * mm,
            7 * mm,
        ]

        header = [
            "CODIGO\nPRODUTO",
            "DESCRICAO DO PRODUTO / SERVICO",
            "NCM/SH",
            "CSOSN /\nCST",
            "CFOP",
            "UNID.",
            "QTDE.",
            "VALOR\nUNITARIO",
            "VALOR\nDESCONTO",
            "VALOR\nLIQUIDO",
            "BASE DE\nCALC. ICMS",
            "VALOR\nICMS",
            "VALOR\nIPI",
            "ALIQ.\nICMS",
            "ALIQ.\nIPI",
        ]

        table = Table(
            [header, *rows],
            colWidths=col_widths,
            rowHeights=[header_height] + [row_height] * len(rows),
            repeatRows=1,
        )
        table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.black),
                    ("FONTNAME", (0, 0), (-1, 0), self.bold_font),
                    ("FONTNAME", (0, 1), (-1, -1), self.mono_font),
                    ("FONTSIZE", (0, 0), (-1, 0), 4.35),
                    ("FONTSIZE", (0, 1), (-1, -1), 5.0),
                    ("LEADING", (0, 0), (-1, 0), 4.7),
                    ("LEADING", (0, 1), (-1, -1), 5.2),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                    ("ALIGN", (0, 1), (0, -1), "CENTER"),
                    ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
                    ("ALIGN", (1, 1), (1, -1), "LEFT"),
                    ("TOPPADDING", (0, 0), (-1, -1), 1.2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1.1),
                    ("LEFTPADDING", (0, 0), (-1, -1), 1.6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 1.6),
                ]
            )
        )
        return table

    def _cell(
        self,
        pdf: canvas.Canvas,
        *,
        x: float,
        y: float,
        width: float,
        height: float,
        label: str,
        value: Any,
        font_size: float | None = None,
        align: str = "left",
        max_lines: int = 2,
    ) -> None:
        self._box(pdf, x, y, width, height)
        self._draw_label(pdf, x + self.inner_pad, y + height - 2.6 * mm, label)
        lines = self._fit_text_lines(
            str(value or ""),
            width - (2 * self.inner_pad),
            self.mono_font,
            font_size or self.value_font,
            max_lines=max_lines,
        )
        self._draw_fitted_lines(
            pdf,
            lines,
            x + self.inner_pad,
            y + 1.1 * mm,
            width - (2 * self.inner_pad),
            height - 4.4 * mm,
            font_name=self.mono_font,
            font_size=font_size or self.value_font,
            align=align,
        )

    def _box(self, pdf: canvas.Canvas, x: float, y: float, width: float, height: float) -> None:
        pdf.setLineWidth(self.border_width)
        pdf.rect(x, y, width, height, stroke=1, fill=0)

    def _section_caption(self, pdf: canvas.Canvas, x: float, y: float, width: float, height: float, text: str) -> None:
        caption_text = _upper_text(text)
        caption_width = min(width - 8 * mm, max(28 * mm, stringWidth(caption_text, self.bold_font, 5.0) + 4 * mm))
        caption_x = x + 3.4 * mm
        caption_y = y + height - 1.9 * mm
        pdf.setFillColor(colors.white)
        pdf.rect(caption_x - 1 * mm, caption_y - 1.4 * mm, caption_width, 3.0 * mm, stroke=0, fill=1)
        pdf.setFillColor(colors.black)
        self._draw_label(pdf, caption_x, caption_y, caption_text)

    def _draw_label(self, pdf: canvas.Canvas, x: float, y: float, text: str) -> None:
        safe_text = self._truncate_to_width(_upper_text(text), 72 * mm, self.bold_font, self.label_font)
        pdf.setFont(self.bold_font, self.label_font)
        pdf.drawString(x, y, safe_text)

    def _draw_fitted_lines(
        self,
        pdf: canvas.Canvas,
        lines: list[str],
        x: float,
        y: float,
        width: float,
        height: float,
        *,
        font_name: str,
        font_size: float,
        align: str = "left",
    ) -> None:
        if not lines:
            return
        leading = font_size + 0.7
        max_visible = max(1, int(height // leading) + 1)
        lines = lines[:max_visible]
        start_y = y + height - font_size
        pdf.setFont(font_name, font_size)
        for index, line in enumerate(lines):
            draw_y = start_y - (index * leading)
            if draw_y < y - 0.2 * mm:
                break
            if align == "right":
                pdf.drawRightString(x + width, draw_y, line)
            elif align == "center":
                pdf.drawCentredString(x + (width / 2), draw_y, line)
            else:
                pdf.drawString(x, draw_y, line)

    def _draw_wrapped_paragraph(
        self,
        pdf: canvas.Canvas,
        text: str,
        x: float,
        y: float,
        width: float,
        height: float,
        *,
        font_name: str,
        font_size: float,
        leading: float,
        max_lines: int,
        align: str = "left",
    ) -> None:
        lines = self._fit_text_lines(text, width, font_name, font_size, max_lines=max_lines)
        safe_html = "<br/>".join(_escape_text(line) for line in lines)
        style = ParagraphStyle(
            f"wrap-{font_name}-{font_size}-{leading}-{align}",
            fontName=font_name,
            fontSize=font_size,
            leading=leading,
            alignment={"left": 0, "center": 1, "right": 2}.get(align, 0),
            textColor=colors.black,
        )
        paragraph = Paragraph(safe_html, style)
        _wrapped_width, wrapped_height = paragraph.wrap(width, height)
        paragraph.drawOn(pdf, x, y + max(0, height - wrapped_height))

    def _fit_text_lines(
        self,
        text: str,
        width: float,
        font_name: str,
        font_size: float,
        *,
        max_lines: int,
    ) -> list[str]:
        raw_text = " ".join(str(text or "").replace("\r", "\n").split()) if "\n" not in str(text or "") else str(text or "")
        paragraphs = [part.strip() for part in raw_text.split("\n")]
        paragraphs = [part for part in paragraphs if part] or [""]

        result: list[str] = []
        for part in paragraphs:
            words = part.split()
            if not words:
                result.append("")
                continue

            current_line = words[0]
            for word in words[1:]:
                candidate = f"{current_line} {word}".strip()
                if stringWidth(candidate, font_name, font_size) <= width:
                    current_line = candidate
                    continue
                result.append(self._truncate_to_width(current_line, width, font_name, font_size))
                current_line = word
                if len(result) >= max_lines:
                    result[-1] = self._truncate_to_width(result[-1], width, font_name, font_size)
                    return result[:max_lines]

            result.append(self._truncate_to_width(current_line, width, font_name, font_size))
            if len(result) >= max_lines:
                return result[:max_lines]

        if len(result) > max_lines:
            result = result[:max_lines]
        return result

    def _truncate_to_width(self, text: str, width: float, font_name: str, font_size: float) -> str:
        safe_text = str(text or "").strip()
        if not safe_text:
            return ""
        if stringWidth(safe_text, font_name, font_size) <= width:
            return safe_text

        ellipsis = "..."
        while safe_text and stringWidth(f"{safe_text}{ellipsis}", font_name, font_size) > width:
            safe_text = safe_text[:-1].rstrip()
        return f"{safe_text}{ellipsis}" if safe_text else ellipsis

    def _get_logo_path(self) -> Path | None:
        for candidate in LOGO_CANDIDATES:
            if candidate.exists():
                return candidate
        return None


def get_fiscal_provider(provider_name: str | None) -> FiscalProvider:
    name = str(provider_name or "mock").strip().lower()
    if name in {"", "mock"}:
        return MockFiscalProvider()
    raise ValueError(f"Provider fiscal '{provider_name}' ainda nao esta implementado nesta versao.")


def _build_access_key(cnpj: str, number: int, series: int, emitted_at: str) -> str:
    reference = datetime.fromisoformat(emitted_at)
    base = f"35{reference:%y%m}{cnpj}{55}{series:03d}{number:09d}{random.randint(0, 99999999):08d}"
    digest = hashlib.sha1(base.encode("utf-8")).hexdigest()
    numeric_digest = "".join(str(int(char, 16) % 10) for char in digest)
    return f"{base}{numeric_digest[:4]}"[:44]


def _build_nfe_xml(
    settings: dict[str, Any],
    payload: dict[str, Any],
    access_key: str,
    protocol: str,
    emitted_at: str,
    environment: str,
) -> str:
    root = ET.Element("NFeMock")
    identification = ET.SubElement(root, "identificacao")
    identification.set("chaveAcesso", access_key)
    identification.set("numero", str(payload["number"]))
    identification.set("serie", str(payload["series"]))
    identification.set("ambiente", environment)
    identification.set("emitidaEm", emitted_at)
    identification.set("protocolo", protocol)

    emitter = ET.SubElement(root, "emitente")
    for key in ("company_name", "trade_name", "cnpj", "state_registration", "tax_regime", "email", "phone"):
        ET.SubElement(emitter, key).text = str(settings.get(key) or "")

    customer = ET.SubElement(root, "destinatario")
    customer_payload = payload.get("customer") or {}
    ET.SubElement(customer, "nome").text = str(payload.get("customer_name") or customer_payload.get("name") or "Consumidor final")
    ET.SubElement(customer, "documento").text = str(customer_payload.get("document") or "")
    ET.SubElement(customer, "endereco").text = str(customer_payload.get("address") or "")

    sale = ET.SubElement(root, "venda")
    ET.SubElement(sale, "data").text = str(payload.get("sale_date") or "")
    ET.SubElement(sale, "hora").text = str(payload.get("sale_time") or "")
    ET.SubElement(sale, "pagamento").text = str(payload.get("payment_method") or "")
    ET.SubElement(sale, "observacoes").text = str(payload.get("notes") or "")

    items_node = ET.SubElement(root, "itens")
    total_amount = 0.0
    for index, item in enumerate(payload.get("items") or [], start=1):
        item_node = ET.SubElement(items_node, "item")
        item_node.set("numero", str(index))
        for key in ("sku", "description", "unit", "ncm", "cfop", "origin", "csosn"):
            ET.SubElement(item_node, key).text = str(item.get(key) or "")
        ET.SubElement(item_node, "quantity").text = str(round_money(item.get("quantity") or 0))
        ET.SubElement(item_node, "unit_price").text = f"{round_money(item.get('unit_price') or 0):.2f}"
        subtotal = round_money(item.get("total_price") or 0)
        ET.SubElement(item_node, "total_price").text = f"{subtotal:.2f}"
        total_amount += subtotal

    totals = ET.SubElement(root, "totais")
    ET.SubElement(totals, "valorProdutos").text = f"{round_money(total_amount):.2f}"
    ET.SubElement(totals, "valorNota").text = f"{round_money(total_amount):.2f}"

    return ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8")


def _digits_only(value: Any) -> str:
    return "".join(char for char in str(value or "") if char.isdigit())


def _escape_text(value: Any) -> str:
    return html.escape(str(value or "")).replace("\n", "<br/>")


def _upper_text(value: Any) -> str:
    return str(value or "").strip().upper()


def _format_currency(value: Any) -> str:
    numeric = round_money(value or 0)
    formatted = f"{numeric:,.2f}"
    return formatted.replace(",", "X").replace(".", ",").replace("X", ".")


def _format_decimal(value: Any) -> str:
    numeric = round_money(value or 0)
    if float(numeric).is_integer():
        return str(int(numeric))
    return f"{numeric:.2f}".replace(".", ",")


def _format_access_key(value: Any) -> str:
    digits = _digits_only(value)
    return " ".join(digits[index : index + 4] for index in range(0, len(digits), 4))


def _format_document(value: Any) -> str:
    digits = _digits_only(value)
    if len(digits) == 11:
        return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"
    if len(digits) == 14:
        return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"
    return str(value or "")


def _format_zip(value: Any) -> str:
    digits = _digits_only(value)
    if len(digits) == 8:
        return f"{digits[:5]}-{digits[5:]}"
    return str(value or "")


def _format_nfe_number(value: Any) -> str:
    digits = _digits_only(value).zfill(9)[-9:]
    return f"{digits[:3]}.{digits[3:6]}.{digits[6:]}"


def _format_series(value: Any) -> str:
    digits = _digits_only(value) or "1"
    return digits.zfill(3)[-3:]


def _parse_datetime(value: Any) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None

    for candidate in (text, text.replace(" ", "T")):
        try:
            return datetime.fromisoformat(candidate)
        except ValueError:
            continue

    for pattern in ("%Y-%m-%d", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, pattern)
        except ValueError:
            continue
    return None


def _split_address_fields(address: Any) -> dict[str, str]:
    raw = str(address or "").strip()
    normalized = re.sub(r"\s+", " ", raw)

    cep_match = re.search(r"(\d{5})-?(\d{3})", normalized)
    cep = f"{cep_match.group(1)}-{cep_match.group(2)}" if cep_match else ""
    if cep_match:
        normalized = normalized.replace(cep_match.group(0), "").replace("CEP", "").replace("cep", "").strip(" -")

    parts = [part.strip(" ,") for part in normalized.split(" - ") if part.strip(" ,")]
    address_line = parts[0] if parts else raw
    district = parts[1] if len(parts) > 1 else ""
    city = ""
    state = ""

    city_state = parts[2] if len(parts) > 2 else ""
    if "/" in city_state:
        city, state = [piece.strip() for piece in city_state.rsplit("/", 1)]
    else:
        city = city_state

    return {
        "address": address_line,
        "district": district,
        "city": city,
        "state": state.upper(),
        "cep": cep,
        "state_registration": "",
    }


def _truncate_text(value: Any, max_length: int) -> str:
    text = str(value or "").strip()
    if len(text) <= max_length:
        return text
    return f"{text[: max_length - 3].rstrip()}..."
