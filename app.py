from __future__ import annotations

import os
from io import BytesIO
from pathlib import Path
from typing import Any, Callable

from flask import Flask, Response, abort, jsonify, make_response, request, send_file, send_from_directory

from backend import services
from backend.auth import SESSION_COOKIE, create_session_token, verify_session_token
from backend.config import load_environment
from backend.db import initialize_database, run_runtime_migrations, should_auto_initialize
from database.seed import seed_database


load_environment()


BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
ASSETS_DIR = FRONTEND_DIR / "assets"
ICONS_DIR = FRONTEND_DIR / "static" / "icons"
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8000"))
NO_CACHE_SUFFIXES = {".html", ".js", ".css", ".json", ".webmanifest"}
NO_CACHE_NAMES = {"service-worker.js", "favicon.ico"}
ICON_VERSION_FILES = (
    ICONS_DIR / "favicon.ico",
    ICONS_DIR / "favicon-16x16.png",
    ICONS_DIR / "favicon-32x32.png",
    ICONS_DIR / "apple-touch-icon.png",
    ICONS_DIR / "icon-192.png",
    ICONS_DIR / "icon-512.png",
)
DYNAMIC_TEXT_FILES = {
    (FRONTEND_DIR / "index.html").resolve(),
    (FRONTEND_DIR / "nfe-nova.html").resolve(),
    (FRONTEND_DIR / "manifest.webmanifest").resolve(),
    (FRONTEND_DIR / "service-worker.js").resolve(),
}


CollectionGetter = Callable[[], list[dict[str, Any]]]
CollectionCreator = Callable[[dict[str, Any]], dict[str, Any]]
ItemUpdater = Callable[[int, dict[str, Any]], dict[str, Any]]
ItemDeleter = Callable[[int], None]


ENTITY_HANDLERS: dict[str, tuple[CollectionGetter, CollectionCreator, ItemUpdater, ItemDeleter]] = {
    "products": (services.list_products, services.create_product, services.update_product, services.delete_product),
    "customers": (services.list_customers, services.create_customer, services.update_customer, services.delete_customer),
    "sales": (services.list_sales, services.create_sale, services.update_sale, services.delete_sale),
    "quotes": (services.list_quotes, services.create_quote, services.update_quote, services.delete_quote),
    "expenses": (services.list_expenses, services.create_expense, services.update_expense, services.delete_expense),
    "bills": (services.list_bills, services.create_bill, services.update_bill, services.delete_bill),
    "checks": (services.list_checks, services.create_check, services.update_check, services.delete_check),
}


app = Flask(__name__, static_folder=None)
app.json.ensure_ascii = False


def _truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _should_use_secure_cookie() -> bool:
    configured = os.environ.get("COOKIE_SECURE")
    if configured is not None:
        return _truthy(configured)
    return request.is_secure or request.headers.get("X-Forwarded-Proto", "").lower() == "https"


def _bootstrap_database_if_enabled() -> None:
    if not should_auto_initialize():
        return

    initialize_database()

    if _truthy(os.environ.get("SEED_DEMO_DATA")):
        seed_database()


def _icon_asset_version() -> str:
    latest_mtime = max((file_path.stat().st_mtime_ns for file_path in ICON_VERSION_FILES if file_path.exists()), default=0)
    return str(latest_mtime or 1)


def _render_dynamic_file(file_path: Path) -> Response:
    content = file_path.read_text(encoding="utf-8").replace("__ICON_VERSION__", _icon_asset_version())
    response = make_response(content)

    if file_path.suffix.lower() == ".html":
        response.headers["Content-Type"] = "text/html; charset=utf-8"
    elif file_path.suffix.lower() == ".js":
        response.headers["Content-Type"] = "application/javascript; charset=utf-8"
    elif file_path.suffix.lower() == ".webmanifest":
        response.headers["Content-Type"] = "application/manifest+json; charset=utf-8"

    return _set_static_headers(response, file_path)


def _set_static_headers(response: Response, file_path: Path) -> Response:
    if file_path.suffix.lower() in NO_CACHE_SUFFIXES or file_path.name in NO_CACHE_NAMES:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    if file_path.name == "service-worker.js":
        response.headers["Service-Worker-Allowed"] = "/"
    if file_path.suffix.lower() == ".webmanifest":
        response.headers["Content-Type"] = "application/manifest+json; charset=utf-8"
    return response


def _serve_frontend_file(file_path: Path) -> Response:
    if not file_path.is_file():
        abort(404)

    resolved = file_path.resolve()
    if FRONTEND_DIR not in resolved.parents and resolved != FRONTEND_DIR:
        abort(403)

    if resolved in DYNAMIC_TEXT_FILES:
        return _render_dynamic_file(resolved)

    relative_path = resolved.relative_to(FRONTEND_DIR).as_posix()
    response = make_response(send_from_directory(FRONTEND_DIR, relative_path))
    return _set_static_headers(response, resolved)


def _serve_frontend(path: str) -> Response:
    if not path:
        return _serve_frontend_file(FRONTEND_DIR / "index.html")

    requested = (FRONTEND_DIR / path).resolve()
    if FRONTEND_DIR not in requested.parents and requested != FRONTEND_DIR:
        abort(403)

    if requested.is_file():
        return _serve_frontend_file(requested)

    return _serve_frontend_file(FRONTEND_DIR / "index.html")


def _current_user() -> dict[str, Any] | None:
    token = request.cookies.get(SESSION_COOKIE)
    payload = verify_session_token(token)
    if not payload:
        return None
    return services.get_user_by_id(payload.get("user_id"))


def _require_user() -> dict[str, Any]:
    user = _current_user()
    if not user:
        raise services.ServiceError("Sua sessão expirou. Faça login novamente.", 401)
    return user


def _json_response(payload: Any, status: int = 200) -> Response:
    return make_response(jsonify(payload), status)


@app.errorhandler(services.ServiceError)
def handle_service_error(exc: services.ServiceError) -> Response:
    return _json_response({"error": exc.message}, exc.status_code)


@app.errorhandler(ValueError)
def handle_value_error(exc: ValueError) -> Response:
    return _json_response({"error": str(exc)}, 400)


@app.errorhandler(403)
def handle_forbidden(_exc: Exception) -> Response:
    return _json_response({"error": "Acesso negado."}, 403)


@app.errorhandler(404)
def handle_not_found(_exc: Exception) -> Response:
    return _json_response({"error": "Rota não encontrada."}, 404)


@app.errorhandler(Exception)
def handle_unexpected_error(exc: Exception) -> Response:
    return _json_response({"error": f"Ocorreu um erro interno: {exc}"}, 500)


@app.get("/api/health")
def api_health() -> Response:
    return _json_response({"status": "ok"})


@app.post("/api/login")
def api_login() -> Response:
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    user = services.authenticate_user(username, password)
    token = create_session_token({"user_id": user["id"], "username": user["username"]})

    response = _json_response({"message": "Login realizado com sucesso.", "user": user})
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=28800,
        httponly=True,
        samesite="Lax",
        secure=_should_use_secure_cookie(),
        path="/",
    )
    return response


@app.post("/api/logout")
def api_logout() -> Response:
    response = _json_response({"message": "Sessão encerrada."})
    response.delete_cookie(
        SESSION_COOKIE,
        path="/",
        samesite="Lax",
        secure=_should_use_secure_cookie(),
    )
    return response


@app.get("/api/auth/me")
def api_me() -> Response:
    user = _require_user()
    return _json_response({"user": user})


@app.get("/api/bootstrap")
def api_bootstrap() -> Response:
    user = _require_user()
    return _json_response({"user": user, **services.get_bootstrap_data()})


@app.post("/api/products/import")
def api_products_import() -> Response:
    _require_user()
    uploaded_file = request.files.get("file")
    if not uploaded_file or not uploaded_file.filename:
        raise services.ServiceError("Selecione uma planilha Excel ou CSV para importar.")

    report = services.import_products_from_spreadsheet(uploaded_file.filename, uploaded_file.read())
    return _json_response({"report": report, "message": "Importação de produtos concluída."})


@app.get("/api/products/export")
def api_products_export() -> Response:
    _require_user()
    export_format = request.args.get("format", "csv").strip().lower() or "csv"
    dataset = services.export_products_dataset(export_format)
    return send_file(
        BytesIO(dataset["content"]),
        mimetype=dataset["content_type"],
        as_attachment=True,
        download_name=dataset["filename"],
        max_age=0,
    )


@app.post("/api/stock/entries")
def api_stock_entries() -> Response:
    user = _require_user()
    payload = request.get_json(silent=True) or {}
    payload["_user_id"] = user["id"]
    item = services.create_stock_movement(payload)
    return _json_response({"item": item, "message": "Movimentação de estoque registrada com sucesso."}, 201)


@app.get("/api/stock/overview")
def api_stock_overview() -> Response:
    _require_user()
    return _json_response({"overview": services.get_stock_overview()})


@app.route("/api/fiscal-settings", methods=["GET", "PUT"])
def api_fiscal_settings() -> Response:
    _require_user()
    if request.method == "GET":
        return _json_response({"item": services.get_fiscal_settings()})

    payload = request.get_json(silent=True) or {}
    item = services.update_fiscal_settings(payload)
    return _json_response({"item": item, "message": "Configurações fiscais atualizadas com sucesso."})


@app.get("/api/nfe")
def api_nfe_list() -> Response:
    _require_user()
    return _json_response({"items": services.list_nfe_issued()})


@app.get("/api/nfe/validate/<int:sale_id>")
def api_nfe_validate(sale_id: int) -> Response:
    _require_user()
    return _json_response({"result": services.validate_sale_for_nfe(sale_id)})


@app.post("/api/nfe/emit")
def api_nfe_emit() -> Response:
    _require_user()
    payload = request.get_json(silent=True) or {}
    item = services.emit_nfe(payload)
    return _json_response({"item": item, "message": "NF-e emitida com sucesso."}, 201)


@app.get("/api/nfe/<int:nfe_id>/<string:file_type>")
def api_nfe_download(nfe_id: int, file_type: str) -> Response:
    _require_user()
    file_info = services.get_nfe_file_info(nfe_id, file_type)
    return send_file(
        file_info["path"],
        as_attachment=True,
        download_name=file_info["filename"],
        max_age=0,
    )


@app.get("/nfe/nova")
def nfe_new_page() -> Response:
    if not _current_user():
        return _serve_frontend("")
    return _serve_frontend_file(FRONTEND_DIR / "nfe-nova.html")


@app.route("/api/<entity>", methods=["GET", "POST"])
def api_collection(entity: str) -> Response:
    user = _require_user()
    handlers = ENTITY_HANDLERS.get(entity)
    if not handlers:
        raise services.ServiceError("Rota não encontrada.", 404)

    list_handler, create_handler, _update_handler, _delete_handler = handlers

    if request.method == "GET":
        return _json_response({"items": list_handler()})

    payload = request.get_json(silent=True) or {}
    payload["_user_id"] = user["id"]
    item = create_handler(payload)
    return _json_response({"item": item, "message": "Registro criado com sucesso."}, 201)


@app.route("/api/<entity>/<int:item_id>", methods=["PUT", "DELETE"])
def api_item(entity: str, item_id: int) -> Response:
    user = _require_user()
    handlers = ENTITY_HANDLERS.get(entity)
    if not handlers:
        raise services.ServiceError("Rota não encontrada.", 404)

    _list_handler, _create_handler, update_handler, delete_handler = handlers

    if request.method == "PUT":
        payload = request.get_json(silent=True) or {}
        payload["_user_id"] = user["id"]
        item = update_handler(item_id, payload)
        return _json_response({"item": item, "message": "Registro atualizado com sucesso."})

    delete_handler(item_id)
    return _json_response({"message": "Registro excluído com sucesso."})


@app.route("/assets/<path:filename>")
def serve_assets(filename: str) -> Response:
    requested = (ASSETS_DIR / filename).resolve()
    if ASSETS_DIR not in requested.parents and requested != ASSETS_DIR:
        abort(403)
    if not requested.is_file():
        abort(404)

    response = make_response(send_from_directory(ASSETS_DIR, filename))
    return _set_static_headers(response, requested)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def frontend(path: str) -> Response:
    if path.startswith("api/"):
        raise services.ServiceError("Rota não encontrada.", 404)
    if path.startswith("assets/"):
        filename = path[len("assets/") :]
        return serve_assets(filename)
    if path == "favicon.ico":
        return _serve_frontend_file(ICONS_DIR / "favicon.ico")
    return _serve_frontend(path)


_bootstrap_database_if_enabled()
run_runtime_migrations()


if __name__ == "__main__":
    debug = _truthy(os.environ.get("FLASK_DEBUG"))
    app.run(host=HOST, port=PORT, debug=debug)
