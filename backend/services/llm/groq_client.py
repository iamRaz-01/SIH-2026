"""Thin Groq chat-completions call used by the ARIA agents.

Groq exposes an OpenAI-compatible REST API, so this is a plain HTTP call via
`httpx` rather than a new SDK — one shared place for the request/response
shape so switching providers later only means editing this one file.

Raises on any failure (no key, network error, non-2xx, malformed response) —
every caller already wraps its own call in `except Exception: <deterministic
fallback>`, so the system degrades gracefully without fabricating output.
"""

from __future__ import annotations

import httpx

GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
REQUEST_TIMEOUT_SECONDS = 30.0


def generate_text(
    *,
    api_key: str,
    model: str,
    system_instruction: str,
    contents: str,
    temperature: float = 0.2,
) -> str:
    response = httpx.post(
        GROQ_CHAT_COMPLETIONS_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": contents},
            ],
            "temperature": temperature,
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    data = response.json()
    return (data["choices"][0]["message"]["content"] or "").strip()
