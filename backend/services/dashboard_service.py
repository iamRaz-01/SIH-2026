"""
backend/services/dashboard_service.py

InfraGuard AI — Dashboard Analytics & Alerts Service

Computes portfolio-level summary metrics, distributions, and prioritized alerts
directly from the loaded dataset. No dummy data.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _safe_float(val, decimals: int = 2) -> Optional[float]:
    try:
        if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
            return None
        return round(float(val), decimals)
    except Exception:
        return None


def get_summary(df: pd.DataFrame) -> dict:
    """
    Portfolio-level KPIs for the administrative dashboard.
    Strictly excludes removed cards (avg cost overrun, medium risk, low risk, total revised cost)
    and prioritizes clean percentage-based metrics and high-risk/anomaly counts.
    """
    total = len(df)

    overrun_count = int(df["is_overrun"].sum()) if "is_overrun" in df.columns else 0
    avg_progress = _safe_float(
        df["physical_progress"].mean() if "physical_progress" in df.columns else None, 1
    )

    # High-risk count: cost_overrun_ratio > 30%
    high_risk = int(
        (df["cost_overrun_ratio"] > 0.30).sum()
        if "cost_overrun_ratio" in df.columns else 0
    )

    # Anomalous projects count from Isolation Forest detector
    anomalous_count = 0
    try:
        from services.anomaly_service import anomaly_status
        anom_stat = anomaly_status()
        anomalous_count = int(anom_stat.get("flagged_count") or anom_stat.get("anomalies_flagged") or 0)
    except Exception:
        if "is_anomaly" in df.columns:
            anomalous_count = int((df["is_anomaly"] == 1).sum())

    # Average Time Overrun %: ((revised_comp - doa) - (target - doa)) / (target - doa) * 100
    # or (time_overrun_months / planned_duration_months) * 100
    avg_time_overrun_pct = None
    if "time_overrun_months" in df.columns and "planned_duration_months" in df.columns:
        valid_time = df[
            (df["time_overrun_months"].notna())
            & (df["planned_duration_months"].notna())
            & (df["planned_duration_months"] > 0)
        ]
        if not valid_time.empty:
            time_pcts = (
                valid_time["time_overrun_months"] / valid_time["planned_duration_months"]
            ) * 100
            # Clean outliers/negatives for portfolio average delay
            time_pcts_clean = time_pcts[time_pcts >= 0]
            if not time_pcts_clean.empty:
                avg_time_overrun_pct = _safe_float(time_pcts_clean.mean(), 1)

    avg_time_overrun_months = _safe_float(
        df["time_overrun_months"][df["time_overrun_months"] > 0].mean()
        if "time_overrun_months" in df.columns else None, 1
    )

    # ── Latest Edition (e.g. July 2026 snapshot) metrics ──
    latest_edition_projects = total
    latest_edition_label = "Latest Edition"
    latest_edition_agencies = df["agency"].nunique() if "agency" in df.columns else 0
    latest_edition_states = df["state"].nunique() if "state" in df.columns else 0

    if "edition_dt" in df.columns and df["edition_dt"].notna().any():
        max_dt = df["edition_dt"].max()
        latest_df = df[df["edition_dt"] == max_dt]
        latest_edition_projects = len(latest_df)
        try:
            latest_edition_label = max_dt.strftime("%B %Y Edition")
        except Exception:
            latest_edition_label = f"{str(latest_df['edition'].iloc[0])} Edition"
        latest_edition_agencies = latest_df["agency"].nunique() if "agency" in latest_df.columns else 0
        latest_edition_states = latest_df["state"].nunique() if "state" in latest_df.columns else 0

    return {
        "total_projects": total,
        "latest_edition_projects": latest_edition_projects,
        "latest_edition_label": latest_edition_label,
        "latest_edition_agencies": latest_edition_agencies,
        "latest_edition_states": latest_edition_states,
        "overrun_count": overrun_count,
        "overrun_percentage": round(overrun_count / max(total, 1) * 100, 1),
        "high_risk_projects": high_risk,
        "anomalous_projects": anomalous_count,
        "avg_physical_progress": avg_progress,
        "avg_time_overrun_pct": avg_time_overrun_pct,
        "avg_time_overrun_months": avg_time_overrun_months,
        "agencies_count": df["agency"].nunique() if "agency" in df.columns else 0,
        "states_count": df["state"].nunique() if "state" in df.columns else 0,
    }


def get_risk_distribution(df: pd.DataFrame) -> dict:
    """Risk class distribution for pie/bar charts."""
    if "cost_overrun_ratio" not in df.columns:
        return {"distribution": [], "total": 0, "error": "cost_overrun_ratio not available"}

    bins = [
        ("High Risk (>30%)", df["cost_overrun_ratio"] > 0.30),
        ("Medium Risk (10-30%)", (df["cost_overrun_ratio"] > 0.10) & (df["cost_overrun_ratio"] <= 0.30)),
        ("Low Risk (0-10%)", (df["cost_overrun_ratio"] >= 0) & (df["cost_overrun_ratio"] <= 0.10)),
        ("Under Budget (<0%)", df["cost_overrun_ratio"] < 0),
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
    """Per-state breakdown: project count, avg overrun %, total projects."""
    if "state" not in df.columns:
        return {"states": [], "total_states": 0, "error": "state column not available"}

    agg = (
        df.groupby("state", dropna=True)
        .agg(
            project_count=("project_name", "count"),
            avg_overrun=("cost_overrun_ratio", "mean"),
            high_risk_count=("is_overrun", "sum") if "is_overrun" in df.columns else ("project_name", "count"),
            avg_progress=("physical_progress", "mean"),
        )
        .reset_index()
        .sort_values("project_count", ascending=False)
    )

    states = []
    for _, row in agg.iterrows():
        overrun_r = row.get("avg_overrun")
        states.append({
            "state": str(row["state"]),
            "project_count": int(row["project_count"]),
            "avg_cost_overrun_ratio": _safe_float(overrun_r, 4),
            "avg_cost_overrun_pct": _safe_float(overrun_r * 100 if overrun_r is not None else None, 1),
            "high_risk_count": int(row.get("high_risk_count", 0)),
            "avg_physical_progress": _safe_float(row.get("avg_progress"), 1),
        })

    return {"states": states, "total_states": len(states)}


def get_agency_analysis(df: pd.DataFrame) -> dict:
    """Per-agency/ministry breakdown."""
    if "agency" not in df.columns:
        return {"agencies": [], "total_agencies": 0, "error": "agency column not available"}

    agg = (
        df.groupby("agency", dropna=True)
        .agg(
            project_count=("project_name", "count"),
            avg_overrun=("cost_overrun_ratio", "mean"),
            avg_progress=("physical_progress", "mean"),
        )
        .reset_index()
        .sort_values("project_count", ascending=False)
    )

    agencies = []
    for _, row in agg.iterrows():
        overrun_r = row.get("avg_overrun")
        agencies.append({
            "agency": str(row["agency"]),
            "project_count": int(row["project_count"]),
            "avg_cost_overrun_ratio": _safe_float(overrun_r, 4),
            "avg_cost_overrun_pct": _safe_float(overrun_r * 100 if overrun_r is not None else None, 1),
            "avg_physical_progress": _safe_float(row.get("avg_progress"), 1),
        })

    return {"agencies": agencies, "total_agencies": len(agencies)}


def get_alerts(df: pd.DataFrame, limit: int = 5) -> list[dict]:
    """
    Generate prioritized, data-driven alerts from real dataset conditions.
    Priorities:
      🔴 High (Severe cost overrun >50% or prolonged delay >36mo with low progress)
      🟡 Medium (Expenditure-progress divergence >30pp or moderate overrun 30-50%)
      🔵 Informational (Cluster risks / newly flagged state clusters)

    Returns MAXIMUM top 5 sorted alerts.
    """
    alerts = []

    # 1. 🔴 High Priority: Critical Cost Overrun (>50%)
    if "cost_overrun_pct" in df.columns:
        critical_cost = df[df["cost_overrun_pct"] > 50].sort_values("cost_overrun_pct", ascending=False)
        for _, row in critical_cost.head(4).iterrows():
            p_code = str(row.get("project_code", "")).replace(".0", "") or str(row.get("project_id", ""))
            p_name = str(row.get("project_name", "Infrastructure Project"))
            cov = _safe_float(row.get("cost_overrun_pct"), 1)
            alerts.append({
                "id": f"alert_cost_{row.get('project_id')}",
                "project_id": str(row.get("project_id", "")),
                "project_code": p_code,
                "project_name": p_name,
                "agency": str(row.get("agency", "")),
                "state": str(row.get("state", "")),
                "severity": "High",
                "severity_code": "high",
                "priority_rank": 1,
                "title": f"Critical Cost Overrun ({cov}%)",
                "message": f"Project has incurred a {cov}% cost overrun above original sanctioned budget.",
                "metric_responsible": "Cost Overrun",
                "metric_value": f"{cov}%",
                "date": str(row.get("edition", "")).split("T")[0] if row.get("edition") else None,
                "sort_val": float(row.get("cost_overrun_pct") or 0),
            })

    # 2. 🔴 High Priority: Stalled / Prolonged Delay with Low Progress
    if "time_overrun_months" in df.columns and "physical_progress" in df.columns:
        delayed = df[
            (df["time_overrun_months"] > 36) &
            (df["physical_progress"] < 60)
        ].sort_values("time_overrun_months", ascending=False)

        for _, row in delayed.head(3).iterrows():
            pid = str(row.get("project_id", ""))
            if any(a["project_id"] == pid for a in alerts):
                continue
            p_code = str(row.get("project_code", "")).replace(".0", "") or pid
            p_name = str(row.get("project_name", "Infrastructure Project"))
            t_over = _safe_float(row.get("time_overrun_months"), 1)
            prog = _safe_float(row.get("physical_progress"), 1)
            alerts.append({
                "id": f"alert_delay_{pid}",
                "project_id": pid,
                "project_code": p_code,
                "project_name": p_name,
                "agency": str(row.get("agency", "")),
                "state": str(row.get("state", "")),
                "severity": "High",
                "severity_code": "high",
                "priority_rank": 1,
                "title": f"Prolonged Delay ({t_over} Mo)",
                "message": f"Project delayed by {t_over} months with only {prog}% physical completion.",
                "metric_responsible": "Schedule Delay",
                "metric_value": f"{t_over} months",
                "date": str(row.get("edition", "")).split("T")[0] if row.get("edition") else None,
                "sort_val": float(row.get("time_overrun_months") or 0) * 1.5,
            })

    # 3. 🟡 Medium Priority: Expenditure-Progress Divergence (>30pp)
    if "exp_progress_divergence" in df.columns:
        divergent = df[df["exp_progress_divergence"] > 0.30].sort_values("exp_progress_divergence", ascending=False)
        for _, row in divergent.head(3).iterrows():
            pid = str(row.get("project_id", ""))
            if any(a["project_id"] == pid for a in alerts):
                continue
            p_code = str(row.get("project_code", "")).replace(".0", "") or pid
            p_name = str(row.get("project_name", "Infrastructure Project"))
            div_val = _safe_float(row["exp_progress_divergence"] * 100, 1)
            alerts.append({
                "id": f"alert_div_{pid}",
                "project_id": pid,
                "project_code": p_code,
                "project_name": p_name,
                "agency": str(row.get("agency", "")),
                "state": str(row.get("state", "")),
                "severity": "Medium",
                "severity_code": "medium",
                "priority_rank": 2,
                "title": f"Expenditure Divergence ({div_val}pp)",
                "message": f"Cumulative expenditure leads physical progress by {div_val} percentage points.",
                "metric_responsible": "Spend Discrepancy",
                "metric_value": f"+{div_val}pp",
                "date": str(row.get("edition", "")).split("T")[0] if row.get("edition") else None,
                "sort_val": float(row.get("exp_progress_divergence") or 0) * 100,
            })

    # 4. 🔵 Informational Priority: High-Impact Infrastructure Cluster
    top_agencies = df["agency"].value_counts().head(2)
    for ag_name, count in top_agencies.items():
        if len(alerts) >= 5:
            break
        alerts.append({
            "id": f"alert_info_{hash(ag_name)}",
            "project_id": "",
            "project_code": "PORTFOLIO",
            "project_name": f"{ag_name} Active Portfolio",
            "agency": str(ag_name),
            "state": "National",
            "severity": "Informational",
            "severity_code": "info",
            "priority_rank": 3,
            "title": f"Major Agency Cluster ({count} Projects)",
            "message": f"{ag_name} currently administers {count} active central infrastructure works.",
            "metric_responsible": "Portfolio Density",
            "metric_value": f"{count} projects",
            "date": None,
            "sort_val": float(count),
        })

    # Sort strictly by priority_rank (1=High, 2=Medium, 3=Info), then by sort_val descending
    sorted_alerts = sorted(alerts, key=lambda a: (a["priority_rank"], -a["sort_val"]))
    return sorted_alerts[:limit]
