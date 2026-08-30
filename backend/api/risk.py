"""
backend/api/risk.py

InfraGuard AI — Risk Engine API Router
Endpoints:
  GET  /api/risk/portfolio-intelligence — Portfolio-wide risk analytics, scatter data & drivers
  GET  /api/risk/{project_code} — Evaluates unified risk for a project in dataset
  POST /api/risk/evaluate       — Evaluates unified risk for arbitrary project payload
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services import dataset_service, risk_service

router = APIRouter(prefix="/api/risk", tags=["Risk Engine"])


class RiskEvaluateRequest(BaseModel):
    project_code: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    agency: Optional[str] = None
    state: Optional[str] = None
    edition: Optional[Any] = None
    doa: Optional[Any] = None
    original_target_doa: Optional[Any] = None
    revised_completion: Optional[Any] = None
    original_cost: Optional[float] = None
    revised_cost: Optional[float] = None
    cumulative_expenditure: Optional[float] = None
    physical_progress: Optional[float] = None


@router.get("/portfolio-intelligence")
def get_portfolio_risk_intelligence():
    """
    Get comprehensive portfolio-level risk intelligence:
    - High-risk KPIs & predicted financial cost exposure
    - Project Value vs Risk scatter plot data points
    - Trained LightGBM model global cost drivers (feature importance)
    - Sector risk comparison breakdown
    - Top Intervention priority projects
    """
    return risk_service.get_portfolio_risk_intelligence()


@router.get("/{project_code}")
def get_project_risk(project_code: str):
    """
    Get unified risk evaluation for a project by project_code or project_id.
    Clearly separates ML Model Output from Derived Analytics.
    """
    row = dataset_service.get_project_by_code(project_code)
    if row is None:
        row = dataset_service.get_project_by_id(project_code)
    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"Project '{project_code}' not found in dataset"
        )
    return risk_service.evaluate_project_risk(row.to_dict())


@router.post("/evaluate")
def evaluate_custom_risk(req: RiskEvaluateRequest):
    """
    Evaluate unified risk profile for a custom or submitted project payload.
    """
    payload = req.model_dump()
    # If project_code is provided and rest are empty, try resolving from dataset
    if req.project_code and req.original_cost is None:
        row = dataset_service.get_project_by_code(req.project_code)
        if row is not None:
            payload = row.to_dict()

    return risk_service.evaluate_project_risk(payload)
