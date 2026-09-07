"""
backend/api/web_intelligence.py

InfraGuard AI — Web Intelligence API Router (ARIA Feature)
Exposes the Tavily-backed Web Intelligence Agent via REST.

Endpoints:
  GET /api/projects/{project_id}/web-evidence   — Run the Web Intelligence Agent
"""

from __future__ import annotations

import math
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from services.web.service import get_web_intelligence

router = APIRouter(prefix="/api/projects", tags=["Web Intelligence"])


def _clean_value(v: Any) -> Any:
    """Convert non-JSON-serializable values to safe types."""
    if hasattr(v, "item"):
        v = v.item()
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


@router.get(
    "/{project_id}/web-evidence",
    summary="Web Intelligence Agent",
    description=(
        "Runs the Web Intelligence Agent for the specified project. "
        "Searches Tavily for external signals (news, government notices, "
        "contractor/court disputes), scores each source by trust tier, "
        "and extracts grounded findings. "
        "Only triggers for HIGH/CRITICAL risk projects unless force=true. "
        "Degrades gracefully when TAVILY_API_KEY is not configured."
    ),
)
def web_evidence(
    project_id: str,
    force: bool = Query(False, description="Force web search regardless of risk level"),
):
    """
    Run the Web Intelligence Agent for a project.

    - **project_id**: Synthetic project_id or project_code from the dataset.
    - **force**: Set to true to run search regardless of risk level.
    """
    try:
        result = get_web_intelligence(project_id=project_id, force=force)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Serialize evidence items
    evidence_list = []
    for item in result.evidence:
        evidence_list.append({
            "evidence_id": item.evidence_id,
            "topic": item.topic,
            "source": item.source,
            "url": item.url,
            "title": item.title,
            "publication_date": item.publication_date,
            "date_confidence": item.date_confidence,
            "finding": item.finding,
            "project_relevance": _clean_value(item.project_relevance),
            "trust_tier": item.trust_tier,
            "source_quality": item.source_quality,
        })

    return {
        "project_id": result.project_id,
        "project_name": result.project_name,
        "triggered": result.triggered,
        "trigger_reason": result.trigger_reason,
        "topics_searched": result.topics_searched,
        "evidence_count": len(evidence_list),
        "evidence": evidence_list,
        "warnings": result.warnings,
        "searched_at": result.searched_at,
    }
