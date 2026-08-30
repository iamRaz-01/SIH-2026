"""
backend/api/projects.py

InfraGuard AI — Projects API Router
Endpoints:
  GET /api/projects        — Paginated project list with filters
  GET /api/projects/{id}   — Single project detail (by project_code or project_id)
  GET /api/projects/{id}/history — Historical edition timeline & evolution metrics
"""

from __future__ import annotations

import math
from typing import Any, Optional

import pandas as pd
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
    Return paginated list of unique projects from the real dataset with latest live progress.
    """
    df = dataset_service.get_latest_dataset()

    if state:
        df = df[df["state"].astype(str).str.contains(state.strip(), case=False, regex=False, na=False)]
    if agency:
        df = df[df["agency"].astype(str).str.contains(agency.strip(), case=False, regex=False, na=False)]
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
    Return all historical edition records for a given project with calculated trend metrics.
    """
    df = dataset_service.get_dataset()
    code_str = str(project_id).strip().replace(".0", "")
    matches = df[(df["project_code_str"] == code_str) | (df["project_id"] == code_str)]

    if matches.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Project '{project_id}' not found in dataset."
        )

    # If queried by project_id and single row returned, find all snapshots with matching project_code_str
    if len(matches) == 1 and matches.iloc[0]["project_code_str"]:
        real_code = matches.iloc[0]["project_code_str"]
        all_code_matches = df[df["project_code_str"] == real_code]
        if not all_code_matches.empty:
            matches = all_code_matches

    matches = matches.copy()
    matches["edition_dt"] = pd.to_datetime(matches["edition"], errors="coerce")
    matches = matches.sort_values("edition_dt").drop_duplicates(subset=["edition_dt"])

    history_records = []
    milestones = []

    prev_row = None
    for _, row in matches.iterrows():
        rec = _project_to_dict(row)

        # Format edition date string
        ed_dt = row.get("edition_dt")
        if pd.notna(ed_dt):
            rec["edition_date"] = ed_dt.strftime("%Y-%m-%d")
            rec["edition_label"] = ed_dt.strftime("%b %Y")
        else:
            rec["edition_date"] = str(row.get("edition") or "")
            rec["edition_label"] = rec["edition_date"]

        # Detect milestone shifts between cycles
        if prev_row is not None:
            prev_cost = float(prev_row.get("revised_cost") or prev_row.get("original_cost") or 0)
            curr_cost = float(row.get("revised_cost") or row.get("original_cost") or 0)
            if prev_cost > 0 and abs(curr_cost - prev_cost) > 1.0:
                cost_diff = curr_cost - prev_cost
                milestones.append({
                    "date": rec["edition_label"],
                    "type": "COST_REVISION",
                    "title": f"Cost revised by ₹{abs(cost_diff):.1f} Cr ({'+' if cost_diff > 0 else '-'}{abs(cost_diff/prev_cost*100):.1f}%)",
                    "detail": f"Project cost updated from ₹{prev_cost:.1f} Cr to ₹{curr_cost:.1f} Cr.",
                })

            prev_target = str(prev_row.get("revised_completion") or prev_row.get("original_target_doa") or "")
            curr_target = str(row.get("revised_completion") or row.get("original_target_doa") or "")
            if prev_target and curr_target and prev_target != curr_target and prev_target != "(-)" and curr_target != "(-)":
                milestones.append({
                    "date": rec["edition_label"],
                    "type": "TARGET_EXTENSION",
                    "title": "Target completion date adjusted",
                    "detail": f"Target shifted from {prev_target[:10]} to {curr_target[:10]}.",
                })

            prev_prog = float(prev_row.get("physical_progress") or 0)
            curr_prog = float(row.get("physical_progress") or 0)
            if (curr_prog - prev_prog) >= 5.0:
                milestones.append({
                    "date": rec["edition_label"],
                    "type": "PROGRESS_SURGE",
                    "title": f"Progress accelerated (+{curr_prog - prev_prog:.1f} pp)",
                    "detail": f"Physical progress jumped from {prev_prog:.1f}% to {curr_prog:.1f}%.",
                })

        prev_row = row
        history_records.append(rec)

    first_rec = matches.iloc[0]
    latest_rec = matches.iloc[-1]

    init_cost = float(first_rec.get("original_cost") or 0)
    latest_cost = float(latest_rec.get("revised_cost") or latest_rec.get("original_cost") or init_cost)
    cost_growth_pct = ((latest_cost - init_cost) / init_cost * 100) if init_cost > 0 else 0.0

    init_prog = float(first_rec.get("physical_progress") or 0)
    latest_prog = float(latest_rec.get("physical_progress") or 0)
    prog_gain_pp = latest_prog - init_prog

    init_exp = float(first_rec.get("cumulative_expenditure") or 0)
    latest_exp = float(latest_rec.get("cumulative_expenditure") or 0)
    exp_growth_cr = latest_exp - init_exp

    months_elapsed = max(1, len(matches) - 1)
    velocity = (prog_gain_pp / months_elapsed) if months_elapsed > 0 else 0.0

    return {
        "project_code": str(first_rec.get("project_code_str") or project_id),
        "project_id": str(first_rec.get("project_id") or project_id),
        "project_name": first_rec.get("project_name"),
        "agency": first_rec.get("agency"),
        "state": first_rec.get("state"),
        "timeline_count": len(history_records),
        "has_history": len(history_records) > 1,
        "summary": {
            "first_edition": history_records[0]["edition_label"] if history_records else None,
            "latest_edition": history_records[-1]["edition_label"] if history_records else None,
            "initial_cost": init_cost,
            "latest_cost": latest_cost,
            "cost_growth_cr": round(latest_cost - init_cost, 2),
            "cost_growth_pct": round(cost_growth_pct, 1),
            "initial_progress": init_prog,
            "latest_progress": latest_prog,
            "progress_gain_pp": round(prog_gain_pp, 1),
            "initial_expenditure": init_exp,
            "latest_expenditure": latest_exp,
            "expenditure_growth_cr": round(exp_growth_cr, 2),
            "progress_velocity_monthly_pp": round(velocity, 2),
        },
        "milestones": milestones,
        "history": history_records,
    }
