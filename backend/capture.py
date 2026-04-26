"""
Inbox capture helpers.
"""

from __future__ import annotations

import re
from pathlib import Path


FORBIDDEN_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|]+')
WHITESPACE_RE = re.compile(r"\s+")


def derive_capture_title(content: str, max_length: int = 24) -> str:
    for line in (content or "").splitlines():
        stripped = line.strip()
        if stripped:
            title = stripped
            break
    else:
        title = "untitled"

    title = WHITESPACE_RE.sub(" ", title)
    title = FORBIDDEN_FILENAME_CHARS.sub(" ", title).strip(" .")
    if not title:
        title = "untitled"

    return title[:max_length].rstrip(" .") or "untitled"


def build_unique_inbox_note_path(notes_dir: str, content: str, inbox_folder: str = "inbox") -> str:
    notes_root = Path(notes_dir)
    inbox_path = notes_root / inbox_folder
    inbox_path.mkdir(parents=True, exist_ok=True)

    title = derive_capture_title(content)
    candidate_name = title
    counter = 2

    while True:
        relative_path = f"{inbox_folder}/{candidate_name}.md"
        if not (notes_root / relative_path).exists():
            return relative_path
        candidate_name = f"{title}-{counter}"
        counter += 1
