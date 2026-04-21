from __future__ import annotations

import json
import mimetypes
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

NO_CACHE_SUFFIXES = {".html", ".js", ".css", ".json", ".webmanifest"}
NO_CACHE_NAMES = {"service-worker.js"}


def iso_now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def today_iso() -> str:
    return date.today().isoformat()


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d").date()


def ensure_date(value: str | None, fallback: str | None = None) -> str:
    if value:
        parse_iso_date(value)
        return value
    if fallback:
        return fallback
    return today_iso()


def round_money(value: float) -> float:
    return round(float(value or 0), 2)


def parse_json_body(handler: Any) -> dict[str, Any]:
    content_length = int(handler.headers.get("Content-Length", "0"))
    if content_length <= 0:
        return {}
    raw = handler.rfile.read(content_length)
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def send_json(handler: Any, status: int, payload: Any, extra_headers: dict[str, str] | None = None) -> None:
    response = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(response)))
    if extra_headers:
        for key, value in extra_headers.items():
            handler.send_header(key, value)
    handler.end_headers()
    handler.wfile.write(response)


def send_text(handler: Any, status: int, body: str, content_type: str = "text/plain; charset=utf-8") -> None:
    response = body.encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(response)))
    handler.end_headers()
    handler.wfile.write(response)


def serve_file(handler: Any, file_path: Path) -> None:
    content = file_path.read_bytes()
    mime_type, _ = mimetypes.guess_type(file_path.name)
    suffix = file_path.suffix.lower()
    content_type = mime_type or "application/octet-stream"

    if suffix == ".webmanifest":
        content_type = "application/manifest+json; charset=utf-8"
    elif suffix in {".html", ".css", ".js", ".json"}:
        content_type = f"{content_type}; charset=utf-8"

    handler.send_response(200)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(content)))
    if suffix in NO_CACHE_SUFFIXES or file_path.name in NO_CACHE_NAMES:
        handler.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        handler.send_header("Pragma", "no-cache")
        handler.send_header("Expires", "0")
    if file_path.name == "service-worker.js":
        handler.send_header("Service-Worker-Allowed", "/")
    handler.end_headers()
    handler.wfile.write(content)


def read_cookies(cookie_header: str | None) -> dict[str, str]:
    cookies: dict[str, str] = {}
    if not cookie_header:
        return cookies
    for part in cookie_header.split(";"):
        if "=" not in part:
            continue
        name, value = part.strip().split("=", 1)
        cookies[name] = value
    return cookies


def parse_request_path(path: str) -> tuple[str, dict[str, list[str]]]:
    parsed = urlparse(path)
    return parsed.path, parse_qs(parsed.query)


def week_bounds(reference: date | None = None) -> tuple[date, date]:
    reference = reference or date.today()
    start = reference - timedelta(days=reference.weekday())
    end = start + timedelta(days=6)
    return start, end
