from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

from backend.config import load_environment


load_environment()


SESSION_COOKIE = "store_session"
SESSION_TTL_SECONDS = 60 * 60 * 8
SECRET_KEY = (
    os.environ.get("SESSION_SECRET")
    or os.environ.get("STORE_APP_SECRET")
    or "loja-materiais-secret-key-dev"
)


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    )
    return f"{salt}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, digest = password_hash.split("$", 1)
    except ValueError:
        return False
    candidate = hash_password(password, salt)
    return hmac.compare_digest(candidate, f"{salt}${digest}")


def _b64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_session_token(payload: dict[str, Any]) -> str:
    body = dict(payload)
    body["exp"] = int(time.time()) + SESSION_TTL_SECONDS
    message = _b64_encode(json.dumps(body, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(SECRET_KEY.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{message}.{signature}"


def verify_session_token(token: str | None) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None
    message, signature = token.rsplit(".", 1)
    expected = hmac.new(SECRET_KEY.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None

    try:
        payload = json.loads(_b64_decode(message).decode("utf-8"))
    except (ValueError, json.JSONDecodeError):
        return None

    if payload.get("exp", 0) < int(time.time()):
        return None
    return payload
