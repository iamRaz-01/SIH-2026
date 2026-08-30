"""
InfraGuard AI — Projects API Router
Endpoints:
  GET  /api/projects          — paginated list with filters
  GET  /api/projects/{id}     — single project detail
"""

from __future__ import annotations

import math
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from services.dataset_service import get_dataset, get_project_by_id

router = APIRouter(prefix="/api/projects", tags=["Projects"])


def _project_to_dict(row) -> dict:
    """Convert a pandas Series row to a JSON-serialisable dict."""
    d = {}
    for k, v in row.items():
        if hasattr(v, "item"):        # numpy scalar → Python scalar
            v = v.item()
        if v != v:                    # NaN check (nan != nan)
            v = None
        d[k] = v
    return d


@router.get("")
def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    state: Optional[str] = Query(None),
    agency: Optional[str] = Query(None),
    risk: Optional[str] = Query(None, description="low | medium | high"),
    search: Optional[str] = Query(None, description="Project name search"),
):
    """
    Return a paginated list of projects with optional filters.
    All data comes from the real dataset.
    """
    df = get_dataset()

    # ── Apply filters ──────────────────────────────────────────────────────────
    if state:
        df = df[df["state"].str.upper() == state.upper()]
    if agency:
        df = df[df["agency"].str.upper() == agency.upper()]
    if search:
        mask = df["project_name"].str.contains(search, case=False, na=False)
        df = df[mask]
    if risk and "cost_overrun_ratio" in df.columns:
        if risk.lower() == "high":
            df = df[df["cost_overrun_ratio"] > 0.30]
        elif risk.lower() == "medium":
            df = df[(df["cost_overrun_ratio"] > 0.10) & (df["cost_overrun_ratio"] <= 0.30)]
        elif risk.lower() == "low":
            df = df[df["cost_overrun_ratio"] <= 0.10]

    total = len(df)
    total_pages = math.ceil(total / page_size)
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
    """Return a single project by its synthetic project_id."""
    row = get_project_by_id(project_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Project {project_id!r} not found")
    return _project_to_dict(row)
