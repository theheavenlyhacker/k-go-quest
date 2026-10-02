"""Service configuration. Fails closed: no token, no service."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    token: str
    database_url: str
    schema: str

    @property
    def has_database(self) -> bool:
        return bool(self.database_url)


def load() -> Settings:
    token = os.environ.get("KGO_ML_TOKEN", "").strip()
    if len(token) < 24:
        # Refusing to start beats starting wide open. These endpoints expose
        # practice data shape and can trigger a full refit.
        raise SystemExit(
            "KGO_ML_TOKEN must be set to at least 24 characters. "
            'Generate one with: python3 -c "import secrets; print(secrets.token_urlsafe(32))"'
        )
    return Settings(
        token=token,
        database_url=os.environ.get("DATABASE_URL", "").strip(),
        schema=os.environ.get("DATABASE_SCHEMA", "public").strip() or "public",
    )
