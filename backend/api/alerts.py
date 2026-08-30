"""
InfraGuard AI — Alerts API Router
Endpoints:
  GET /api/alerts
"""

from fastapi import APIRouter, Query
from services.dataset_service import get_dataset
from services import dashboard_service as ds

router = APIRouter(prefix="/api", tags=["Alerts"])


@router.get("/alerts")
def get_alerts(limit: int = Query(20, ge=1, le=200)):
    """
    Return early-warning alerts for projects meeting high-priority risk criteria.
    These are rule-based triggers (severe cost overrun, expenditure-progress mismatch).
    """
    df = get_dataset()
    alerts = ds.get_alerts(df, limit=limit)
    return {
        "alerts": alerts,
        "total": len(alerts),
    }
