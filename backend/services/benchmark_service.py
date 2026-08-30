"""
backend/services/benchmark_service.py

InfraGuard AI — Cohort Benchmarking Service

Computes real, dataset-driven comparative benchmarks for infrastructure projects
against their relevant peer cohorts:
  1. State Cohort (projects executing within the same State/UT)
  2. Agency Cohort (projects managed by the same implementing Agency/Ministry)
  3. Scale Cohort (projects within the same capital investment bucket)
  4. National Portfolio Baseline (all tracked central sector projects)

Metrics Computed:
  - Average & Median Cost Overrun %
  - Average & Median Expenditure Ratio
  - Average & Median Physical Progress %
  - Average & Median Schedule Deviation (Months)
  - Percentile Rank of the project within each cohort
"""

from __future__ import annotations

import logging
import math
from typing import Any, Optional, Union

import numpy as np
import pandas as pd

from services import dataset_service

logger = logging.getLogger(__name__)


def get_scale_bucket(cost: Optional[float]) -> str:
    """Classify capital investment scale."""
    if cost is None or pd.isna(cost) or cost <= 0:
        return "Unknown Scale"
    if cost < 100.0:
        return "Small Scale (< ₹100 Cr)"
    if cost < 1000.0:
        return "Medium Scale (₹100 - ₹1,000 Cr)"
    if cost < 5000.0:
        return "Major Scale (₹1,000 - ₹5,000 Cr)"
    return "Mega Scale (> ₹5,000 Cr)"


def get_project_benchmarks(project_code_or_id: Union[str, int]) -> Optional[dict]:
    """
    Compute comparative benchmark statistics for a project against real dataset cohorts.
    """
    df = dataset_service.get_dataset()
    if df is None or df.empty:
        return None

    code_str = str(project_code_or_id).strip().replace(".0", "")
    matches = df[
        (df["project_code_str"] == code_str)
        | (df["project_id"] == code_str)
    ]
    if matches.empty:
        return None

    project = matches.iloc[-1]

    state = str(project.get("state", "Unknown"))
    agency = str(project.get("agency", "Unknown"))
    orig_cost = project.get("original_cost")
    scale_bucket = get_scale_bucket(orig_cost)

    proj_metrics = {
        "cost_overrun_pct": _clean_float(project.get("cost_overrun_pct")),
        "expenditure_ratio": _clean_float(project.get("expenditure_ratio")),
        "physical_progress": _clean_float(project.get("physical_progress")),
        "time_overrun_months": _clean_float(project.get("time_overrun_months")),
    }

    cohorts_data = {
        "state_cohort": {
            "name": f"State Peer Group ({state})",
            "filter_type": "state",
            "filter_value": state,
            "df": df[df["state"].astype(str).str.upper() == state.upper()],
        },
        "agency_cohort": {
            "name": f"Agency Peer Group ({agency})",
            "filter_type": "agency",
            "filter_value": agency,
            "df": df[df["agency"].astype(str).str.upper() == agency.upper()],
        },
        "scale_cohort": {
            "name": f"Scale Peer Group ({scale_bucket})",
            "filter_type": "scale",
            "filter_value": scale_bucket,
            "df": _filter_by_scale(df, scale_bucket),
        },
        "national_cohort": {
            "name": "National Portfolio (All Projects)",
            "filter_type": "national",
            "filter_value": "All",
            "df": df,
        },
    }

    cohort_results = {}
    for cohort_key, info in cohorts_data.items():
        cohort_df = info["df"]
        cohort_stats = _compute_cohort_statistics(cohort_df, proj_metrics)
        cohort_results[cohort_key] = {
            "name": info["name"],
            "filter_type": info["filter_type"],
            "filter_value": info["filter_value"],
            "cohort_size": len(cohort_df),
            "statistics": cohort_stats,
        }

    return {
        "project_code": str(project.get("project_code", "")).replace(".0", ""),
        "project_id": str(project.get("project_id", "")),
        "project_name": str(project.get("project_name", "")),
        "agency": agency,
        "state": state,
        "original_cost": _clean_float(orig_cost),
        "scale_bucket": scale_bucket,
        "project_metrics": proj_metrics,
        "benchmarks": cohort_results,
        "provenance": "REAL_DATASET_COHORT_ANALYSIS",
    }


def _filter_by_scale(df: pd.DataFrame, bucket: str) -> pd.DataFrame:
    if "original_cost" not in df.columns:
        return df
    costs = df["original_cost"]
    if "Small" in bucket:
        return df[costs < 100.0]
    if "Medium" in bucket:
        return df[(costs >= 100.0) & (costs < 1000.0)]
    if "Major" in bucket:
        return df[(costs >= 1000.0) & (costs < 5000.0)]
    if "Mega" in bucket:
        return df[costs >= 5000.0]
    return df


def _compute_cohort_statistics(cohort_df: pd.DataFrame, proj_metrics: dict) -> dict:
    if cohort_df.empty:
        return {}

    metrics = [
        ("cost_overrun_pct", "Cost Overrun (%)"),
        ("expenditure_ratio", "Expenditure Ratio"),
        ("physical_progress", "Physical Progress (%)"),
        ("time_overrun_months", "Schedule Delay (Months)"),
    ]

    stats_dict = {}
    for metric_col, label in metrics:
        if metric_col not in cohort_df.columns:
            continue

        series = cohort_df[metric_col].dropna()
        if series.empty:
            continue

        avg_val = float(series.mean())
        med_val = float(series.median())
        p25_val = float(series.quantile(0.25))
        p75_val = float(series.quantile(0.75))

        proj_val = proj_metrics.get(metric_col)
        percentile_rank = None
        if proj_val is not None and not math.isnan(proj_val):
            percentile_rank = round(
                float((series < proj_val).mean() * 100.0), 1
            )

        stats_dict[metric_col] = {
            "label": label,
            "average": _clean_float(avg_val),
            "median": _clean_float(med_val),
            "p25": _clean_float(p25_val),
            "p75": _clean_float(p75_val),
            "project_value": proj_val,
            "project_percentile": percentile_rank,
        }

    return stats_dict


def get_portfolio_cohort_summary() -> dict:
    """Get high-level summary benchmarks across all states, agencies, and scales."""
    df = dataset_service.get_dataset()
    if df is None:
        return {}

    # State benchmarks
    state_rows = []
    for state_name, group in df.groupby("state", dropna=True):
        state_rows.append({
            "state": str(state_name),
            "project_count": len(group),
            "avg_cost_overrun_pct": _clean_float(group["cost_overrun_pct"].mean()),
            "avg_expenditure_ratio": _clean_float(group["expenditure_ratio"].mean()),
            "avg_progress": _clean_float(group["physical_progress"].mean()),
            "avg_time_overrun": _clean_float(group["time_overrun_months"].mean()),
        })
    state_rows.sort(key=lambda x: x["project_count"], reverse=True)

    # Agency benchmarks
    agency_rows = []
    for agency_name, group in df.groupby("agency", dropna=True):
        agency_rows.append({
            "agency": str(agency_name),
            "project_count": len(group),
            "avg_cost_overrun_pct": _clean_float(group["cost_overrun_pct"].mean()),
            "avg_expenditure_ratio": _clean_float(group["expenditure_ratio"].mean()),
            "avg_progress": _clean_float(group["physical_progress"].mean()),
            "avg_time_overrun": _clean_float(group["time_overrun_months"].mean()),
        })
    agency_rows.sort(key=lambda x: x["project_count"], reverse=True)

    return {
        "total_projects": len(df),
        "national_avg_cost_overrun_pct": _clean_float(df["cost_overrun_pct"].mean()),
        "national_avg_expenditure_ratio": _clean_float(df["expenditure_ratio"].mean()),
        "national_avg_progress": _clean_float(df["physical_progress"].mean()),
        "national_avg_time_overrun_months": _clean_float(df["time_overrun_months"].mean()),
        "state_benchmarks": state_rows[:25],
        "agency_benchmarks": agency_rows[:25],
    }


def _clean_float(val) -> Optional[float]:
    if val is None or pd.isna(val):
        return None
    try:
        res = float(val)
        return None if math.isnan(res) or math.isinf(res) else round(res, 2)
    except Exception:
        return None
