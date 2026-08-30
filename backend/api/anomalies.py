"""
backend/api/anomalies.py

InfraGuard AI — Anomalies API Router (USP #1)
Endpoints:
  GET /api/anomalies              — Filtered & paginated list of anomalous projects
  GET /api/anomalies/{project_code} — Diagnostic explanation of why a project was flagged
"""

from __future__ import annotations

from typing import Optional, Union

from fastapi import APIRouter, HTTPException, Query

from services import anomaly_service

router = APIRouter(prefix="/api/anomalies", tags=["Anomalies"])


@router.get("")
def list_anomalies(
    state: Optional[str] = Query(None, description="Filter by State name (e.g. Maharashtra)"),
    agency: Optional[str] = Query(None, description="Filter by Implementing Agency (e.g. NHAI, RVNL)"),
    severity: Optional[str] = Query(None, description="CRITICAL | HIGH | MEDIUM | LOW"),
    min_anomaly_score: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum normalized anomaly score [0.0 - 1.0]"),
    min_score: Optional[float] = Query(None, ge=0.0, le=1.0, description="Alias for min_anomaly_score"),
    quadrant: Optional[str] = Query(None, description="HIGH_RISK_ANOMALOUS | HIGH_RISK_NORMAL | LOW_RISK_ANOMALOUS | LOW_RISK_NORMAL"),
    only_flagged: bool = Query(False, description="Return only statistically flagged anomalies (is_anomaly == 1)"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=500, description="Items per page"),
    limit: Optional[int] = Query(None, ge=1, le=500, description="Optional override for limit"),
    offset: Optional[int] = Query(None, ge=0, description="Optional override for offset"),
):
    """
    Retrieve projects analyzed by the Isolation Forest anomaly detector.

    Supports filtering by state, agency, severity, minimum anomaly score,
    and 4-quadrant risk/anomaly classification.
    """
    effective_limit = limit if limit is not None else page_size
    effective_offset = offset if offset is not None else (page - 1) * page_size
    effective_min_score = min_anomaly_score if min_anomaly_score is not None else min_score

    res = anomaly_service.get_anomalies(
        state=state,
        agency=agency,
        severity=severity,
        min_anomaly_score=effective_min_score,
        quadrant=quadrant,
        only_flagged=only_flagged,
        limit=effective_limit,
        offset=effective_offset,
    )

    total = res["total"]
    total_pages = (total + effective_limit - 1) // effective_limit if effective_limit > 0 else 1

    return {
        "anomalies": res["anomalies"],
        "total": total,
        "page": page,
        "page_size": effective_limit,
        "total_pages": total_pages,
        "detector_status": res["detector_status"],
    }


@router.get("/{project_code}")
def get_project_anomaly(project_code: str):
    """
    Detailed anomaly explanation for a single project.
    Explains the exact statistical indicators that deviated from cohort medians.
    """
    anomaly_record = anomaly_service.get_project_anomaly(project_code)
    if anomaly_record is None:
        raise HTTPException(
            status_code=404,
            detail=f"Project with code or ID '{project_code}' not found in anomaly registry."
        )
    return anomaly_record
