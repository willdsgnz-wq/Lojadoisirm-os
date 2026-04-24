from __future__ import annotations

import ctypes
import os
import socket
import subprocess
import sys
import threading
import time
import traceback
import webbrowser
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen


BASE_DIR = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8000
URL = f"http://{HOST}:{PORT}/"
HEALTHCHECK_URL = f"{URL}api/health"
ERROR_LOG_PATH = BASE_DIR / "run_app_error.log"
ENV_PATH = BASE_DIR / ".env"
ENV_EXAMPLE_PATH = BASE_DIR / ".env.example"
EMBEDDED_PYTHON = Path.home() / ".cache" / "codex-runtimes" / "codex-primary-runtime" / "dependencies" / "python" / "python.exe"
EMBEDDED_PYTHONW = EMBEDDED_PYTHON.with_name("pythonw.exe")
DEVNULL_STREAM = None


def show_error(title: str, message: str) -> None:
    try:
        ERROR_LOG_PATH.write_text(message, encoding="utf-8")
    except OSError:
        pass

    try:
        ctypes.windll.user32.MessageBoxW(None, message, title, 0x10)
    except Exception:
        pass


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


def ensure_standard_streams() -> None:
    global DEVNULL_STREAM

    if DEVNULL_STREAM is None:
        DEVNULL_STREAM = open(os.devnull, "a", encoding="utf-8", buffering=1)

    if sys.stdout is None:
        sys.stdout = DEVNULL_STREAM
    if sys.stderr is None:
        sys.stderr = DEVNULL_STREAM


def resolve_server_python() -> Path:
    if EMBEDDED_PYTHON.exists():
        return EMBEDDED_PYTHON
    return Path(sys.executable).resolve()


def existing_server_is_healthy(timeout: float = 1.0) -> bool:
    try:
        with urlopen(HEALTHCHECK_URL, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="ignore")
            return response.status == 200 and '"status":"ok"' in body.replace(" ", "")
    except (OSError, URLError, TimeoutError, ValueError):
        return False


def open_browser() -> None:
    if os.environ.get("RUN_APP_SUPPRESS_BROWSER") == "1":
        return

    webbrowser.open(URL, new=2)


def reuse_existing_server_if_running() -> bool:
    if not existing_server_is_healthy():
        return False

    open_browser()
    return True


def launch_hidden_server_process_if_needed() -> None:
    if os.environ.get("RUN_APP_SERVER") == "1":
        return

    if reuse_existing_server_if_running():
        raise SystemExit(0)

    server_python = resolve_server_python()
    env = os.environ.copy()
    env["RUN_APP_SERVER"] = "1"

    subprocess.Popen(
        [str(server_python), str(Path(__file__).resolve())],
        cwd=str(BASE_DIR),
        env=env,
        close_fds=True,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    raise SystemExit(0)


def ensure_database_configured() -> None:
    load_env_file(ENV_PATH)

    if os.environ.get("DATABASE_URL"):
        return

    env_hint = (
        f"Crie o arquivo:\n{ENV_PATH}\n\n"
        f"Voce pode usar como base:\n{ENV_EXAMPLE_PATH}\n\n"
        "Preencha pelo menos a variavel DATABASE_URL com a conexao do seu Supabase/Postgres."
    )
    raise RuntimeError(
        "DATABASE_URL nao configurada.\n\n"
        "O servidor local nao consegue iniciar sem a conexao do banco.\n\n"
        f"{env_hint}"
    )


def ensure_port_available(host: str, port: int) -> None:
    try:
        with socket.create_connection((host, port), timeout=0.5):
            if existing_server_is_healthy():
                open_browser()
                raise SystemExit(0)

            raise RuntimeError(
                f"A porta {port} ja esta em uso por outro processo.\n\n"
                "Feche a outra instancia ou troque a porta antes de abrir o sistema novamente.\n\n"
                f"Endereco: {URL}"
            )
    except OSError:
        return


def open_browser_when_ready(host: str, port: int, url: str, timeout: float = 20.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if existing_server_is_healthy(timeout=0.5):
            open_browser()
            return
        time.sleep(0.25)


def main() -> None:
    os.chdir(BASE_DIR)
    if str(BASE_DIR) not in sys.path:
        sys.path.insert(0, str(BASE_DIR))

    ensure_standard_streams()
    launch_hidden_server_process_if_needed()
    ensure_database_configured()
    ensure_port_available(HOST, PORT)

    from app import app

    browser_thread = threading.Thread(
        target=open_browser_when_ready,
        args=(HOST, PORT, URL),
        daemon=True,
    )
    browser_thread.start()

    app.run(
        host=HOST,
        port=PORT,
        debug=False,
        use_reloader=False,
    )


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        show_error(
            "Erro ao abrir o sistema",
            "Nao foi possivel iniciar o aplicativo.\n\n"
            f"Arquivo de log: {ERROR_LOG_PATH}\n\n"
            f"{traceback.format_exc()}",
        )
