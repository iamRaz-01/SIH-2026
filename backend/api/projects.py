"""
backend/api/projects.py

InfraGuard AI — Projects API Router
Endpoints:
  GET /api/projects        — Paginated project list with filters
  GET /api/projects/{id}   — Single project detail (by project_code or project_id)
  GET /api/projects/{id}/history — Historical edition timeline for a project
"""

from __future__ import annotations

import math
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

from services import dataset_service

router = APIRouter(prefix="/api/projects", tags=["Projects"])


def _project_to_dict(row) -> dict:
    """Convert pandas Series row to clean JSON-serializable dictionary."""
    d = {}
    for k, v in row.items():
        if hasattr(v, "item"):
            v = v.item()
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            v = None
        elif v != v:
            v = None
        d[k] = v
    if "project_code" in d and d["project_code"] is not None:
        d["project_code"] = str(d["project_code"]).replace(".0", "")
    return d


@router.get("")
def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    state: Optional[str] = Query(None),
    agency: Optional[str] = Query(None),
    risk: Optional[str] = Query(None, description="low | medium | high | critical"),
    search: Optional[str] = Query(None, description="Project name search"),
):
    """
    Return paginated list of projects from the real dataset.
    """
    df = dataset_service.get_dataset()

    if state:
        df = df[df["state"].astype(str).str.upper() == state.strip().upper()]
    if agency:
        df = df[df["agency"].astype(str).str.upper().str.contains(agency.strip().upper(), na=False)]
    if search:
        mask = df["project_name"].astype(str).str.contains(search, case=False, na=False)
        df = df[mask]
    if risk and "cost_overrun_ratio" in df.columns:
        r = risk.lower()
        if r == "critical":
            df = df[df["cost_overrun_ratio"] > 0.50]
        elif r == "high":
            df = df[df["cost_overrun_ratio"] > 0.30]
        elif r == "medium":
            df = df[(df["cost_overrun_ratio"] > 0.10) & (df["cost_overrun_ratio"] <= 0.30)]
        elif r == "low":
            df = df[df["cost_overrun_ratio"] <= 0.10]

    total = len(df)
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    start = (page - 1) * page_size
    end = start + page_size

    projects = [_project_to_dict(row) for _, row in df.iloc[start:end].iterrows()]

    return {
        "projects": projects,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/{project_id}")
def get_project(project_id: str):
    """
    Return a single project record by project_code or project_id.
    """
    row = dataset_service.get_project_by_code(project_id)
    if row is None:
        row = dataset_service.get_project_by_id(project_id)
    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"Project with identifier '{project_id}' not found in dataset."
        )
    return _project_to_dict(row)


@router.get("/{project_id}/history")
def get_project_history(project_id: str):
    """
    Return all historical edition records for a given project.
    """
    history = dataset_service.get_project_history(project_id)
    if not history:
        # Check if project exists by id
        row = dataset_service.get_project_by_id(project_id)
        if row is not None:
            history = [row.to_dict()]
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Project '{project_id}' not found."
            )

    return {
        "project_code": project_id,
        "timeline_count": len(history),
        "history": [_project_to_dict(pd.Series(rec)) for rec in history],
    }
