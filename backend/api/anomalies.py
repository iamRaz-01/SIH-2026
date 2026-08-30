"""
InfraGuard AI — Anomalies API Router
Endpoints:
  GET /api/anomalies
"""

from fastapi import APIRouter, Query
from services import anomaly_service

router = APIRouter(prefix="/api", tags=["Anomalies"])


@router.get("/anomalies")
def get_anomalies(
    limit: int = Query(50, ge=1, le=500),
    only_flagged: bool = Query(False, description="Return only flagged anomalies"),
):
    """
    Return projects flagged by the Isolation Forest anomaly detector.
    Sorted by anomaly score (most anomalous first).
    Includes a human-readable reason for each flagged project.
    """
    results = anomaly_service.get_anomalies(limit=limit, only_flagged=only_flagged)
    status = anomaly_service.anomaly_status()

    return {
        "anomalies": results,
        "total_returned": len(results),
        "detector_status": status,
    }
