"""
backend/services/risk_service.py

InfraGuard AI — Unified Project Risk Engine

Calculates a comprehensive, multi-dimensional risk profile for infrastructure projects.
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
