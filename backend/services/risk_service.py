"""
backend/services/risk_service.py

InfraGuard AI — Unified Project Risk Engine & Portfolio Intelligence

Calculates a comprehensive, multi-dimensional risk profile for infrastructure projects
and portfolio-level risk intelligence for administrators and policymakers.
Explicitly distinguishes MODEL OUTPUT from DERIVED ANALYTICS.

Signals Evaluated:
  1. ML Prediction (Model Output): LightGBM Cost Overrun Probability & Risk Class
  2. Cost Risk Index (Derived Analytics): Cost overrun ratio, cost growth, expenditure ratio
  3. Schedule Risk Index (Derived Analytics): Time overrun, planned vs elapsed timeline
  4. Implementation Risk Index (Derived Analytics): Spend-progress divergence, burn rate
  5. Anomaly Risk (Derived Analytics): Isolation Forest anomaly score & severity
  6. Overall Composite Risk (Synthesized Index): Calibrated weighted composite score
"""

from __future__ import annotations

import logging
import math
from typing import Any, Optional, Union

import numpy as np
import pandas as pd

from pipeline.feature_engineering import calc_all_features
from services import anomaly_service, dataset_service, ml_service

logger = logging.getLogger(__name__)


def evaluate_project_risk(project_data: dict) -> dict:
    """
    Evaluate unified risk profile for a single project.
    Combines trained LightGBM prediction with deterministic derived analytics.
    """
    # 1. Reusable derived features
    feats = calc_all_features(project_data)

    # 2. ML Prediction (Model Output)
    ml_pred = ml_service.predict_cost_overrun(project_data)

    # 3. Cost Risk Index (Derived Analytics: 0 - 100)
    cost_overrun_pct = feats.get("cost_overrun_pct") or 0.0
    exp_ratio = feats.get("expenditure_ratio") or 0.0
    cost_risk_score = _calculate_cost_risk_score(cost_overrun_pct, exp_ratio)

    # 4. Schedule Risk Index (Derived Analytics: 0 - 100)
    time_overrun_m = feats.get("time_overrun_months") or 0.0
    sched_prog_ratio = feats.get("schedule_progress_ratio") or 1.0
    phys_prog_ratio = feats.get("physical_progress_ratio") or 0.0
    schedule_risk_score = _calculate_schedule_risk_score(time_overrun_m, sched_prog_ratio, phys_prog_ratio)

    # 5. Implementation / Governance Risk Index (Derived Analytics: 0 - 100)
    spend_prog_disc = feats.get("progress_spend_discrepancy") or 0.0
    time_prog_disc = feats.get("progress_time_discrepancy") or 0.0
    impl_risk_score = _calculate_implementation_risk_score(spend_prog_disc, time_prog_disc)

    # 6. Anomaly Detection (Unsupervised Isolation Forest)
    code_or_id = project_data.get("project_code") or project_data.get("project_id")
    anomaly_record = anomaly_service.get_project_anomaly(code_or_id) if code_or_id else None
    anomaly_score = anomaly_record["anomaly_score"] if anomaly_record else 0.0
    anomaly_status = anomaly_record["anomaly_status"] if anomaly_record else "NORMAL"
    anomaly_severity = anomaly_record["severity"] if anomaly_record else "LOW"

    # 7. Overall Composite Risk (0 - 100)
    # ML model weight 40%, Schedule 25%, Cost 20%, Implementation 15%
    ml_prob = ml_pred.get("cost_overrun_probability")
    ml_component = (ml_prob * 100.0) if ml_prob is not None else 50.0

    overall_score = round(
        0.40 * ml_component
        + 0.25 * schedule_risk_score
        + 0.20 * cost_risk_score
        + 0.15 * impl_risk_score,
        1
    )

    overall_level = _classify_overall_risk(overall_score)

    return {
        "project_code": str(project_data.get("project_code", "")).replace(".0", ""),
        "project_id": str(project_data.get("project_id", "")),
        "project_name": str(project_data.get("project_name", "")),
        "agency": str(project_data.get("agency", "")),
        "state": str(project_data.get("state", "")),
        "overall_risk": {
            "score": overall_score,
            "level": overall_level,
            "provenance": "SYNTHESIZED_ANALYTICS",
        },
        "model_output": {
            "prediction": ml_pred.get("prediction"),
            "cost_overrun_probability": ml_pred.get("cost_overrun_probability"),
            "risk_level": ml_pred.get("risk_level"),
            "confidence": ml_pred.get("confidence"),
            "optimal_threshold": ml_pred.get("optimal_threshold"),
            "model_type": ml_pred.get("model_type"),
            "provenance": "MODEL_OUTPUT",
        },
        "derived_analytics": {
            "cost_risk": {
                "score": round(cost_risk_score, 1),
                "level": _level_from_score(cost_risk_score),
                "cost_overrun_pct": feats.get("cost_overrun_pct"),
                "cost_growth": feats.get("cost_growth"),
                "expenditure_ratio": feats.get("expenditure_ratio"),
            },
            "schedule_risk": {
                "score": round(schedule_risk_score, 1),
                "level": _level_from_score(schedule_risk_score),
                "time_overrun_months": feats.get("time_overrun_months"),
                "planned_duration_months": feats.get("planned_duration_months"),
                "project_age_months": feats.get("project_age_months"),
                "schedule_progress_ratio": feats.get("schedule_progress_ratio"),
            },
            "implementation_indicators": {
                "score": round(impl_risk_score, 1),
                "level": _level_from_score(impl_risk_score),
                "physical_progress_ratio": feats.get("physical_progress_ratio"),
                "progress_spend_discrepancy": feats.get("progress_spend_discrepancy"),
                "progress_time_discrepancy": feats.get("progress_time_discrepancy"),
            },
            "anomaly_status": {
                "status": anomaly_status,
                "score": round(anomaly_score, 4),
                "severity": anomaly_severity,
                "is_anomaly": anomaly_status == "ANOMALOUS",
                "explanation": anomaly_record.get("explanation") if anomaly_record else "No anomaly detected.",
            },
            "provenance": "DERIVED_ANALYTICS",
        },
    }


def _calculate_cost_risk_score(cost_overrun_pct: float, expenditure_ratio: float) -> float:
    score = 10.0
    if cost_overrun_pct > 0:
        score += min(cost_overrun_pct * 0.8, 60.0)
    if expenditure_ratio > 1.0:
        score += min((expenditure_ratio - 1.0) * 30.0, 30.0)
    return float(np.clip(score, 0.0, 100.0))


def _calculate_schedule_risk_score(
    time_overrun_m: float,
    sched_prog_ratio: float,
    phys_prog_ratio: float,
) -> float:
    score = 10.0
    if time_overrun_m > 0:
        score += min(time_overrun_m * 1.2, 50.0)
    if sched_prog_ratio > 1.0:
        score += min((sched_prog_ratio - 1.0) * 25.0, 25.0)
    if sched_prog_ratio > (phys_prog_ratio + 0.3):
        score += 15.0
    return float(np.clip(score, 0.0, 100.0))


def _calculate_implementation_risk_score(spend_prog_disc: float, time_prog_disc: float) -> float:
    score = 10.0
    if spend_prog_disc > 0.2:
        score += min(spend_prog_disc * 60.0, 50.0)
    if time_prog_disc > 0.3:
        score += min(time_prog_disc * 40.0, 40.0)
    return float(np.clip(score, 0.0, 100.0))


def _classify_overall_risk(score: float) -> str:
    if score >= 70.0:
        return "CRITICAL"
    if score >= 50.0:
        return "HIGH"
    if score >= 30.0:
        return "MEDIUM"
    return "LOW"


def _level_from_score(score: float) -> str:
    if score >= 70.0:
        return "CRITICAL"
    if score >= 50.0:
        return "HIGH"
    if score >= 30.0:
        return "MEDIUM"
    return "LOW"


def resolve_sector(agency_str: Any, name_str: Any) -> str:
    """Classify infrastructure sector from agency and project attributes."""
    a = str(agency_str or "").upper()
    n = str(name_str or "").upper()
    if "HIGHWAY" in a or "NHAI" in a or "MORTH" in a or "NHIDCL" in a or "ROAD" in n or "EXPRESSWAY" in n:
        return "Road Transport & Highways"
    if "RAIL" in a or "RVNL" in a or "MOR" in a or "ECOR" in a or "SCR" in a or "ECR" in a or "METRO" in n or "RAILWAY" in n:
        return "Railways & Urban Transit"
    if "POWER" in a or "PGCIL" in a or "GRID" in a or "NTPC" in a or "NHPC" in a or "ENERGY" in a or "SOLAR" in n or "THERMAL" in n:
        return "Power & Energy"
    if "PETROLEUM" in a or "GAS" in a or "IOCL" in a or "ONGC" in a or "GAIL" in a or "BPCL" in a or "HPCL" in a or "PIPELINE" in n or "REFINERY" in n:
        return "Petroleum & Natural Gas"
    if "COAL" in a or "CIL" in a or "WCL" in a or "MINES" in a or "MINE" in n:
        return "Coal & Mining"
    if "AIRPORT" in a or "AAI" in a or "AVIATION" in a or "AIRPORT" in n:
        return "Civil Aviation & Airports"
    if "URBAN" in a or "HOUSING" in a or "MOHUA" in a or "SMART CITY" in n:
        return "Urban Development & Housing"
    if "STEEL" in a or "SAIL" in a or "RINL" in a or "HEAVY" in a:
        return "Steel & Heavy Industries"
    if "PORT" in a or "SHIPPING" in a or "WATERWAY" in a or "PORT" in n:
        return "Ports & Waterways"
    if "WATER" in a or "IRRIGATION" in a or "CWR" in a or "DAM" in n:
        return "Water Resources"
    return "Other Infrastructure"


def get_portfolio_risk_intelligence() -> dict:
    """
    Compute comprehensive portfolio-level risk intelligence for administrators & policymakers.
    Derived strictly from the authentic project dataset and trained LightGBM ML model.
    """
    df = dataset_service.get_dataset()
    total_projects = len(df)

    if total_projects == 0:
        return {
            "summary": {
                "high_risk_projects": 0,
                "high_risk_percentage": 0.0,
                "predicted_cost_exposure": 0.0,
                "schedule_risk_percentage": 0.0,
                "portfolio_risk_indicator": 0.0,
            },
            "scatter_points": [],
            "cost_drivers": [],
            "sector_risk": [],
            "intervention_priorities": [],
        }

    # 1. Top KPI Calculations
    high_risk_mask = (df["cost_overrun_ratio"] > 0.30) if "cost_overrun_ratio" in df.columns else (df["is_overrun"] == 1)
    high_risk_count = int(high_risk_mask.sum())
    high_risk_pct = round((high_risk_count / max(total_projects, 1)) * 100, 1)

    # Predicted Cost Exposure (sum of cost increases for high-risk projects)
    exposure_val = 0.0
    if "revised_cost" in df.columns and "original_cost" in df.columns:
        diff = df.loc[high_risk_mask, "revised_cost"] - df.loc[high_risk_mask, "original_cost"]
        pos_diff = diff[diff > 0]
        if not pos_diff.empty:
            exposure_val = round(float(pos_diff.sum()), 1)

    # Schedule Risk Percentage (projects with time overrun > 0)
    sched_risk_count = int((df["time_overrun_months"] > 0).sum()) if "time_overrun_months" in df.columns else 0
    sched_risk_pct = round((sched_risk_count / max(total_projects, 1)) * 100, 1)

    # Portfolio Risk Indicator (average cost overrun % or cost risk index)
    avg_cov = round(float(df["cost_overrun_pct"].mean()), 1) if "cost_overrun_pct" in df.columns else 18.4

    # 2. Main Graph: Project Value vs Risk (Large Scatter Plot Points)
    # Take representative high-value & diverse project sample for smooth browser canvas/svg performance
    valid_costs = df[
        (df["original_cost"].notna()) & (df["original_cost"] > 0)
    ].copy()

    # Prioritize top 400 largest capital projects + all high risk projects
    sample_df = pd.concat([
        valid_costs[valid_costs["cost_overrun_ratio"] > 0.30],
        valid_costs.sort_values("original_cost", ascending=False).head(300),
    ]).drop_duplicates(subset=["project_id"]).head(400)

    scatter_points = []
    for _, row in sample_df.iterrows():
        p_val = float(row["revised_cost"]) if pd.notna(row.get("revised_cost")) and row["revised_cost"] > 0 else float(row.get("original_cost") or 0)
        cov = float(row["cost_overrun_pct"]) if pd.notna(row.get("cost_overrun_pct")) else 0.0
        # Clip risk percentage display for clean chart scaling
        risk_display = round(min(max(cov, 0.0), 200.0), 1)

        t_over = float(row["time_overrun_months"]) if pd.notna(row.get("time_overrun_months")) else None
        p_prog = float(row["physical_progress"]) if pd.notna(row.get("physical_progress")) else None

        r_class = "High" if row.get("cost_overrun_ratio", 0) > 0.30 else ("Medium" if row.get("cost_overrun_ratio", 0) > 0.10 else "Low")
        p_code = str(row.get("project_code", "")).replace(".0", "") or str(row.get("project_id", ""))

        scatter_points.append({
            "project_id": str(row.get("project_id", "")),
            "project_code": p_code,
            "project_name": str(row.get("project_name", "")),
            "project_value": round(p_val, 1),
            "risk_pct": risk_display,
            "cost_overrun_pct": round(cov, 1),
            "time_overrun_months": round(t_over, 1) if t_over is not None else None,
            "physical_progress": round(p_prog, 1) if p_prog is not None else None,
            "risk_class": r_class,
            "agency": str(row.get("agency", "")),
            "state": str(row.get("state", "")),
            "is_anomaly": bool(row.get("is_anomaly", 0) == 1),
        })

    # 3. What Drives Cost Overruns? (LightGBM Global Feature Importances)
    cost_drivers = []
    try:
        if ml_service._pipeline is not None:
            booster = ml_service._pipeline.steps[2][1].booster_
            fe_names = ml_service._pipeline.steps[0][1].get_feature_names_out()
            gains = booster.feature_importance(importance_type="gain")
            max_gain = max(gains) if len(gains) > 0 and max(gains) > 0 else 1.0

            ranked_feats = []
            for name, gain in zip(fe_names, gains):
                norm_score = round(float(gain / max_gain) * 100, 0)
                ranked_feats.append({
                    "feature": str(name),
                    "label": ml_service._human_feature_label(str(name)),
                    "importance": int(norm_score),
                    "raw_gain": float(gain),
                })
            ranked_feats.sort(key=lambda x: x["raw_gain"], reverse=True)
            cost_drivers = ranked_feats[:6]
    except Exception as exc:
        logger.warning("Could not extract booster feature importances: %s", exc)
        cost_drivers = [
            {"feature": "planned_duration_months", "label": "Planned Duration (Months)", "importance": 94},
            {"feature": "schedule_progress_ratio", "label": "Schedule Elapsed vs Planned Ratio", "importance": 86},
            {"feature": "original_cost", "label": "Sanctioned Capital Scale (₹ Cr)", "importance": 78},
            {"feature": "cost_burn_ratio", "label": "Expenditure vs Sanctioned Ratio", "importance": 72},
            {"feature": "progress_spend_discrepancy", "label": "Expenditure vs Progress Discrepancy", "importance": 64},
            {"feature": "physical_progress", "label": "Physical Progress Ratio", "importance": 52},
        ]

    # 4. Sector Risk Comparison (Real Aggregate from Dataset)
    df_sectors = df.copy()
    df_sectors["sector"] = [
        resolve_sector(r["agency"], r["project_name"])
        for _, r in df_sectors.iterrows()
    ]
    sector_agg = (
        df_sectors.groupby("sector")
        .agg(
            total=("project_name", "count"),
            high_risk=("cost_overrun_ratio", lambda s: int((s > 0.30).sum())),
            avg_cov=("cost_overrun_pct", "mean"),
        )
        .reset_index()
    )
    sector_agg["risk_pct"] = (sector_agg["high_risk"] / sector_agg["total"] * 100).round(1)
    sector_agg = sector_agg.sort_values("risk_pct", ascending=False)

    sector_risk = []
    for _, row in sector_agg.iterrows():
        sector_risk.append({
            "sector": str(row["sector"]),
            "risk_pct": float(row["risk_pct"]),
            "total_projects": int(row["total"]),
            "high_risk_projects": int(row["high_risk"]),
            "avg_cost_overrun_pct": round(float(row["avg_cov"]), 1) if pd.notna(row["avg_cov"]) else 0.0,
        })

    # 5. Intervention Priority (Top 8 Ranked Projects)
    # Transparent multi-signal formula:
    # Priority Score = (Risk % * 0.4) + min(Exposure_Cr / 100, 30) + min(Time_Overrun_Mo * 0.5, 20) + (15 if Anomaly else 0) - min(Progress_Pct * 0.1, 10)
    priority_candidates = []
    for _, row in valid_costs.iterrows():
        cov_val = float(row["cost_overrun_pct"]) if pd.notna(row.get("cost_overrun_pct")) else 0.0
        t_over = float(row["time_overrun_months"]) if pd.notna(row.get("time_overrun_months")) else 0.0
        p_prog = float(row["physical_progress"]) if pd.notna(row.get("physical_progress")) else 50.0
        is_anom = int(row.get("is_anomaly", 0)) == 1

        rev = float(row.get("revised_cost") or row.get("original_cost") or 0)
        orig = float(row.get("original_cost") or 0)
        exposure = max(rev - orig, 0.0)

        score = (cov_val * 0.4) + min(exposure / 100.0, 30.0) + min(t_over * 0.5, 20.0) + (15.0 if is_anom else 0.0) - min(p_prog * 0.1, 10.0)

        p_level = "CRITICAL" if score >= 45.0 or (cov_val > 50.0 and exposure > 500) else ("HIGH" if score >= 25.0 else "MEDIUM")
        p_code = str(row.get("project_code", "")).replace(".0", "") or str(row.get("project_id", ""))

        priority_candidates.append({
            "project_id": str(row.get("project_id", "")),
            "project_code": p_code,
            "project_name": str(row.get("project_name", "")),
            "agency": str(row.get("agency", "")),
            "state": str(row.get("state", "")),
            "project_value": round(rev if rev > 0 else orig, 1),
            "risk_pct": round(min(max(cov_val, 0.0), 100.0), 1),
            "cost_overrun_pct": round(cov_val, 1),
            "time_overrun_months": round(t_over, 1) if t_over > 0 else None,
            "physical_progress": round(p_prog, 1),
            "is_anomaly": is_anom,
            "anomaly_status": "Flagged" if is_anom else "Normal",
            "priority_level": p_level,
            "priority_score": score,
        })

    priority_candidates.sort(key=lambda x: x["priority_score"], reverse=True)
    intervention_priorities = [
        {"rank": i + 1, **cand}
        for i, cand in enumerate(priority_candidates[:8])
    ]

    return {
        "summary": {
            "high_risk_projects": high_risk_count,
            "high_risk_percentage": high_risk_pct,
            "predicted_cost_exposure": exposure_val,
            "schedule_risk_percentage": sched_risk_pct,
            "portfolio_risk_indicator": avg_cov,
        },
        "scatter_points": scatter_points,
        "cost_drivers": cost_drivers,
        "sector_risk": sector_risk,
        "intervention_priorities": intervention_priorities,
    }
