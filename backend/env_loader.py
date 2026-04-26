"""
Minimal .env loader for local development.

Loads key=value pairs into process environment without overriding variables that
are already set by the parent process.
"""

from __future__ import annotations

import os
from pathlib import Path


def load_dotenv_file(dotenv_path: str | Path = ".env") -> bool:
    path = Path(dotenv_path)
    if not path.exists() or not path.is_file():
        return False

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if not key or key in os.environ:
            continue

        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]

        os.environ[key] = value

    return True
