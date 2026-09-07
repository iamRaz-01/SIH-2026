"""Date Verification stage for the Web Intelligence Agent.

Parses whatever publish-date string the search provider returned.
A date that cannot be parsed is stored as null with date_confidence="UNVERIFIED"
rather than silently dropping the evidence or inventing a date.
"""

from __future__ import annotations

from datetime import date, datetime

VERIFIED = "VERIFIED"
UNVERIFIED = "UNVERIFIED"

_KNOWN_FORMATS = ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%a, %d %b %Y %H:%M:%S %Z")


def verify_date(published_date_raw: str | None) -> tuple[date | None, str]:
    if not published_date_raw:
        return None, UNVERIFIED

    raw = published_date_raw.strip()
    for fmt in _KNOWN_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date(), VERIFIED
        except ValueError:
            continue

    try:
        return date.fromisoformat(raw[:10]), VERIFIED
    except ValueError:
        return None, UNVERIFIED
