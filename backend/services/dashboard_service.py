"""
InfraGuard AI — Dashboard Analytics Service

Computes all dashboard summary metrics, distributions, and breakdowns
directly from the loaded dataset. No fake data.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _safe_float(val) -> Optional[float]:
    try:
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return None
        return round(float(val), 2)
    except Exception:
        return None


def get_summary(df: pd.DataFrame) -> dict:
    """Portfolio-level KPIs for the dashboard header cards."""
    total = len(df)

    overrun_count = int(df["is_overrun"].sum()) if "is_overrun" in df.columns else 0
    avg_overrun = _safe_float(
        df["cost_overrun_ratio"].mean() if "cost_overrun_ratio" in df.columns else None
    )
    avg_progress = _safe_float(
        df["physical_progress"].mean() if "physical_progress" in df.columns else None
    )

    # Total portfolio value (revised cost)
    total_revised = _safe_float(
        df["revised_cost"].sum() if "revised_cost" in df.columns else None
    )
    total_original = _safe_float(
        df["original_cost"].sum() if "original_cost" in df.columns else None
    )

    # High-risk count: cost_overrun_ratio > 30%
    high_risk = int(
        (df["cost_overrun_ratio"] > 0.30).sum()
        if "cost_overrun_ratio" in df.columns else 0
    )
    medium_risk = int(
        ((df["cost_overrun_ratio"] > 0.10) & (df["cost_overrun_ratio"] <= 0.30)).sum()
        if "cost_overrun_ratio" in df.columns else 0
    )
    low_risk = total - high_risk - medium_risk

    return {
        "total_projects": total,
        "overrun_count": overrun_count,
        "overrun_percentage": round(overrun_count / max(total, 1) * 100, 1),
        "avg_cost_overrun_ratio": avg_overrun,
        "avg_physical_progress": avg_progress,
        "total_revised_cost_crore": total_revised,
        "total_original_cost_crore": total_original,
        "high_risk_projects": high_risk,
        "medium_risk_projects": medium_risk,
        "low_risk_projects": max(0, low_risk),
        "agencies_count": df["agency"].nunique() if "agency" in df.columns else 0,
        "states_count": df["state"].nunique() if "state" in df.columns else 0,
    }


def get_risk_distribution(df: pd.DataFrame) -> dict:
    """Risk class distribution for pie/bar charts."""
    if "cost_overrun_ratio" not in df.columns:
        return {"distribution": [], "error": "cost_overrun_ratio not available"}

    bins = [
        ("Low (0-10%)", df["cost_overrun_ratio"] <= 0.10),
        ("Medium (10-30%)", (df["cost_overrun_ratio"] > 0.10) & (df["cost_overrun_ratio"] <= 0.30)),
        ("High (>30%)", df["cost_overrun_ratio"] > 0.30),
        ("Under Budget", df["cost_overrun_ratio"] < 0),
    ]

    distribution = []
    for label, mask in bins:
        count = int(mask.sum())
        distribution.append({
            "label": label,
            "count": count,
            "percentage": round(count / max(len(df), 1) * 100, 1),
        })

    return {
        "distribution": distribution,
        "total": len(df),
    }


def get_state_analysis(df: pd.DataFrame) -> dict:
    """Per-state breakdown: project count, avg overrun, total portfolio value."""
    if "state" not in df.columns:
        return {"states": [], "error": "state column not available"}

    agg = (
        df.groupby("state", dropna=True)
        .agg(
            project_count=("project_id", "count") if "project_id" in df.columns else ("project_name", "count"),
            avg_overrun=("cost_overrun_ratio", "mean"),
            total_revised_cost=("revised_cost", "sum"),
            high_risk_count=("is_overrun", "sum") if "is_overrun" in df.columns else ("project_name", "count"),
            avg_progress=("physical_progress", "mean"),
        )
        .reset_index()
        .sort_values("project_count", ascending=False)
    )

    states = []
    for _, row in agg.iterrows():
        states.append({
            "state": str(row["state"]),
            "project_count": int(row["project_count"]),
            "avg_cost_overrun_ratio": _safe_float(row.get("avg_overrun")),
            "total_revised_cost_crore": _safe_float(row.get("total_revised_cost")),
            "high_risk_count": int(row.get("high_risk_count", 0)),
            "avg_physical_progress": _safe_float(row.get("avg_progress")),
        })

    return {"states": states, "total_states": len(states)}


def get_agency_analysis(df: pd.DataFrame) -> dict:
    """Per-agency/ministry breakdown."""
    if "agency" not in df.columns:
        return {"agencies": [], "error": "agency column not available"}

    agg = (
        df.groupby("agency", dropna=True)
        .agg(
            project_count=("project_name", "count") if "project_name" in df.columns else ("state", "count"),
            avg_overrun=("cost_overrun_ratio", "mean"),
            total_revised_cost=("revised_cost", "sum"),
            avg_progress=("physical_progress", "mean"),
        )
        .reset_index()
        .sort_values("project_count", ascending=False)
    )

    agencies = []
    for _, row in agg.iterrows():
        agencies.append({
            "agency": str(row["agency"]),
            "project_count": int(row["project_count"]),
            "avg_cost_overrun_ratio": _safe_float(row.get("avg_overrun")),
            "total_revised_cost_crore": _safe_float(row.get("total_revised_cost")),
            "avg_physical_progress": _safe_float(row.get("avg_progress")),
        })

    return {"agencies": agencies, "total_agencies": len(agencies)}


def get_alerts(df: pd.DataFrame, limit: int = 20) -> list[dict]:
    """
    Early-warning alerts: projects that meet any high-priority risk criteria.
    These are rule-based triggers (not ML predictions).
    """
    alerts = []

    if "cost_overrun_ratio" in df.columns and "project_name" in df.columns:
        # Severe cost overrun (>50%)
        severe = df[df["cost_overrun_ratio"] > 0.50].copy()
        for _, row in severe.head(limit // 2).iterrows():
            alerts.append({
                "project_id": str(row.get("project_id", "")),
                "project_name": str(row.get("project_name", "Unknown")),
                "agency": str(row.get("agency", "")),
                "state": str(row.get("state", "")),
                "alert_type": "SEVERE_COST_OVERRUN",
                "severity": "Critical",
                "message": f"Cost overrun of {row['cost_overrun_ratio']*100:.1f}% detected",
                "cost_overrun_ratio": _safe_float(row["cost_overrun_ratio"]),
                "physical_progress": _safe_float(row.get("physical_progress")),
            })

    # Expenditure-progress mismatch (spending far ahead of physical work)
    if "exp_progress_divergence" in df.columns and "project_name" in df.columns:
        divergent = df[df["exp_progress_divergence"] > 0.30].copy()
        for _, row in divergent.head(limit // 2).iterrows():
            if not any(a["project_id"] == str(row.get("project_id", "")) for a in alerts):
                alerts.append({
                    "project_id": str(row.get("project_id", "")),
                    "project_name": str(row.get("project_name", "Unknown")),
                    "agency": str(row.get("agency", "")),
                    "state": str(row.get("state", "")),
                    "alert_type": "EXPENDITURE_PROGRESS_MISMATCH",
                    "severity": "High",
                    "message": (
                        f"Expenditure is {row['exp_progress_divergence']*100:.1f}pp ahead "
                        f"of physical progress — possible cost efficiency concern"
                    ),
                    "cost_overrun_ratio": _safe_float(row.get("cost_overrun_ratio")),
                    "physical_progress": _safe_float(row.get("physical_progress")),
                })

    return sorted(alerts, key=lambda x: x.get("cost_overrun_ratio") or 0, reverse=True)[:limit]
