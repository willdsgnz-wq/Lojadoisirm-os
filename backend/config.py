from __future__ import annotations

import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent


def resolve_runtime_path(environment_key: str, default_path: Path) -> Path:
    raw_value = str(os.environ.get(environment_key) or "").strip()
    if not raw_value:
        return default_path

    candidate = Path(raw_value).expanduser()
    if not candidate.is_absolute():
        candidate = (BASE_DIR / candidate).resolve()
    return candidate


ENV_PATH = resolve_runtime_path("DOISIRMAOS_ENV_FILE", BASE_DIR / ".env")


def get_storage_root() -> Path:
    return resolve_runtime_path("DOISIRMAOS_STORAGE_DIR", BASE_DIR / "storage")


def load_environment() -> None:
    if not ENV_PATH.exists():
        return

    for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)
