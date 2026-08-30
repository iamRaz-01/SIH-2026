"""
InfraGuard AI — Dashboard API Router
Endpoints:
  GET /api/dashboard/summary
  GET /api/dashboard/risk-distribution
  GET /api/dashboard/state-analysis
  GET /api/dashboard/sector-or-agency-analysis
"""

from fastapi import APIRouter

from services.dataset_service import get_dataset
from services import dashboard_service as ds

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_summary():
    """Portfolio-level KPI summary for the dashboard header."""
    df = get_dataset()
    return ds.get_summary(df)


@router.get("/risk-distribution")
def get_risk_distribution():
    """Cost overrun risk distribution across all projects."""
    df = get_dataset()
    return ds.get_risk_distribution(df)


@router.get("/state-analysis")
def get_state_analysis():
    """Per-state project portfolio breakdown."""
    df = get_dataset()
    return ds.get_state_analysis(df)


@router.get("/sector-or-agency-analysis")
def get_agency_analysis():
    """Per-agency/ministry project portfolio breakdown."""
    df = get_dataset()
    return ds.get_agency_analysis(df)
