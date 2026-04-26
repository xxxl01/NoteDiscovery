"""
AI helpers for NoteDiscovery.

Keeps AI request models and provider-specific chat logic separate from the main
FastAPI application so AI features can evolve independently.
"""

from __future__ import annotations

import json
from typing import Callable, List, Optional
from urllib import error as urllib_error
from urllib import request as urllib_request

from fastapi import HTTPException
from pydantic import BaseModel


class AIChatMessage(BaseModel):
    role: str
    content: str


class AIChatRequest(BaseModel):
    message: str
    messages: List[AIChatMessage] = []
    note_path: Optional[str] = None
    note_content: Optional[str] = None
    note_paths: List[str] = []
    selected_notes: List[dict] = []


class InboxCaptureRequest(BaseModel):
    content: str


def ai_enabled(config: dict) -> bool:
    return config.get("ai", {}).get("enabled", False)


def build_ai_messages(config: dict, payload: AIChatRequest) -> List[dict]:
    ai_config = config.get("ai", {})
    system_prompt = ai_config.get(
        "system_prompt",
        "You are a helpful note-taking assistant. Be concise and practical.",
    )
    include_current_note = ai_config.get("include_current_note", True)
    max_context_chars = int(ai_config.get("max_context_chars", 12000) or 12000)

    messages = [{"role": "system", "content": system_prompt}]

    note_content = (payload.note_content or "").strip()
    if include_current_note and note_content:
        if len(note_content) > max_context_chars:
            note_content = note_content[:max_context_chars]
        note_label = payload.note_path or "current note"
        messages.append(
            {
                "role": "system",
                "content": f"Current note path: {note_label}\n\nCurrent note content:\n{note_content}",
            }
        )

    selected_notes = payload.selected_notes or []
    if selected_notes:
        selected_context_parts = []
        for item in selected_notes[:20]:
            path = str(item.get("path", "")).strip()
            content = str(item.get("content", "")).strip()
            if not path or not content:
                continue
            if len(content) > max_context_chars:
                content = content[:max_context_chars]
            selected_context_parts.append(f"Selected note path: {path}\n\nSelected note content:\n{content}")

        if selected_context_parts:
            messages.append(
                {
                    "role": "system",
                    "content": "\n\n---\n\n".join(selected_context_parts),
                }
            )

    for item in payload.messages[-10:]:
        role = item.role if item.role in {"user", "assistant", "system"} else "user"
        content = (item.content or "").strip()
        if content:
            messages.append({"role": role, "content": content[:4000]})

    user_message = (payload.message or "").strip()
    if user_message:
        messages.append({"role": "user", "content": user_message[:4000]})

    return messages


def call_openai_compatible_chat(
    config: dict,
    payload: AIChatRequest,
    safe_error_message: Callable[[Exception, str], str],
) -> str:
    ai_config = config.get("ai", {})
    api_key = ai_config.get("api_key", "").strip()
    base_url = ai_config.get("base_url", "https://api.openai.com/v1").rstrip("/")
    model = ai_config.get("model", "gpt-4.1-mini").strip()

    if not api_key:
        raise HTTPException(status_code=503, detail="AI API key is not configured")

    request_payload = json.dumps(
        {
            "model": model,
            "messages": build_ai_messages(config, payload),
            "temperature": 0.7,
        }
    ).encode("utf-8")

    req = urllib_request.Request(
        url=f"{base_url}/chat/completions",
        data=request_payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib_request.urlopen(req, timeout=60) as response:
            raw_body = response.read().decode("utf-8")
    except urllib_error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        try:
            error_json = json.loads(error_body)
            detail = error_json.get("error", {}).get("message") or error_body
        except json.JSONDecodeError:
            detail = error_body or f"AI provider returned HTTP {e.code}"
        raise HTTPException(status_code=502, detail=detail[:500])
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=safe_error_message(e, "Failed to contact AI provider"),
        )

    try:
        response_json = json.loads(raw_body)
        content = response_json["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
        raise HTTPException(
            status_code=502,
            detail=safe_error_message(e, "Invalid AI response"),
        )

    if isinstance(content, list):
        text_parts = [part.get("text", "") for part in content if isinstance(part, dict)]
        return "".join(text_parts).strip()

    return str(content).strip()
