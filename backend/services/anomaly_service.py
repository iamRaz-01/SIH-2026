"""
backend/services/anomaly_service.py

InfraGuard AI — Anomaly Detection Service (USP #1)

Core Principles:
  - Baseline unsupervised anomaly detector using Isolation Forest (sklearn).
  - Fits on meaningful project behavior features across cost, time, and progress.
  - Strictly preserves the distinction between PREDICTIVE RISK and ANOMALY STATUS:
      * High Predictive Risk + Normal Behavior (standard high-risk project pattern)
      * Low Predictive Risk + Anomalous Behavior (unexpected operational outlier)
      * High Predictive Risk + Anomalous Behavior (compound critical risk)
      * Low Predictive Risk + Normal Behavior (smooth, on-track project)
  - Data-backed explanations: compares feature z-scores against cohort medians.
"""

from __future__ import annotations

import logging
import math
from typing import Any, Optional, Union

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler

logger = logging.getLogger(__name__)

# Features used for Isolation Forest anomaly detection
ANOMALY_FEATURE_COLS = [
    "original_cost",
    "revised_cost",
    "cumulative_expenditure",
    "physical_progress_ratio",
    "expenditure_ratio",
    "cost_overrun_ratio",
    "time_overrun_months",
    "project_age_months",
    "exp_progress_divergence",
]

_anomaly_model: Optional[IsolationForest] = None
_scaler: Optional[RobustScaler] = None
_anomaly_df: Optional[pd.DataFrame] = None
_feature_medians: dict[str, float] = {}
_feature_stds: dict[str, float] = {}
_fit_error: Optional[str] = None


def fit_anomaly_model(df: pd.DataFrame, contamination: float = 0.05) -> None:
    """
    Fit Isolation Forest on all project records in the dataset.
    """
    global _anomaly_model, _scaler, _anomaly_df, _feature_medians, _feature_stds, _fit_error

    logger.info("Fitting Isolation Forest anomaly detector on %d records...", len(df))

    feat_df = pd.DataFrame(index=df.index)
    for col in ANOMALY_FEATURE_COLS:
        if col in df.columns:
            feat_df[col] = pd.to_numeric(df[col], errors="coerce")
        else:
            feat_df[col] = np.nan

    _feature_medians = {}
    _feature_stds = {}
    for col in ANOMALY_FEATURE_COLS:
        med = float(feat_df[col].median(skipna=True)) if not feat_df[col].dropna().empty else 0.0
        std = float(feat_df[col].std(skipna=True)) if not feat_df[col].dropna().empty else 1.0
        _feature_medians[col] = med if not math.isnan(med) else 0.0
        _feature_stds[col] = std if (not math.isnan(std) and std > 0) else 1.0
        feat_df[col] = feat_df[col].fillna(_feature_medians[col])

    try:
        scaler = RobustScaler()
        X_scaled = scaler.fit_transform(feat_df)

        iso = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=150,
            max_samples="auto",
        )
        iso.fit(X_scaled)

        raw_scores = iso.score_samples(X_scaled)
        preds = iso.predict(X_scaled)  # -1 = anomaly, 1 = normal
        norm_scores = _normalize_anomaly_scores(raw_scores)

        res = df.copy()
        res["raw_anomaly_score"] = raw_scores
        res["anomaly_score"] = norm_scores
        res["anomaly_score_norm"] = norm_scores
        res["is_anomaly"] = (preds == -1).astype(int)
        res["anomaly_status"] = np.where(preds == -1, "ANOMALOUS", "NORMAL")
        res["anomaly_severity"] = _assign_severity_series(norm_scores, preds)

        explanations, indicators = _generate_batch_explanations(feat_df, _feature_medians, _feature_stds)
        res["anomaly_explanation"] = explanations
        res["anomaly_reason"] = explanations
        res["explanation"] = explanations
        res["detected_indicators"] = indicators
        res["risk_quadrant"] = _compute_risk_quadrants(res)

        _anomaly_model = iso
        _scaler = scaler
        _anomaly_df = res.reset_index(drop=True)
        _fit_error = None

        flagged = int((res["is_anomaly"] == 1).sum())
        logger.info(
            "Anomaly detector fitted successfully. Flagged %d / %d projects as anomalous (contamination=%.2f)",
            flagged, len(res), contamination
        )

    except Exception as exc:
        _fit_error = str(exc)
        logger.error("Anomaly detector fitting failed: %s", exc)


def _normalize_anomaly_scores(raw_scores: np.ndarray) -> np.ndarray:
    flipped = -raw_scores
    min_v, max_v = float(flipped.min()), float(flipped.max())
    if max_v == min_v:
        return np.zeros_like(flipped)
    norm = (flipped - min_v) / (max_v - min_v)
    return np.round(norm, 4)


def _assign_severity_series(norm_scores: np.ndarray, preds: np.ndarray) -> list[str]:
    severities = []
    for score, pred in zip(norm_scores, preds):
        if pred == 1 and score < 0.60:
            severities.append("LOW")
        elif score >= 0.85:
            severities.append("CRITICAL")
        elif score >= 0.70:
            severities.append("HIGH")
        elif score >= 0.50:
            severities.append("MEDIUM")
        else:
            severities.append("LOW")
    return severities


def _generate_batch_explanations(
    feat_df: pd.DataFrame,
    medians: dict[str, float],
    stds: dict[str, float],
) -> tuple[list[str], list[list[dict]]]:
    explanations = []
    indicators_list = []

    for _, row in feat_df.iterrows():
        indics = []
        div = row.get("exp_progress_divergence", 0.0)
        exp_r = row.get("expenditure_ratio", 0.0)
        prog_r = row.get("physical_progress_ratio", 0.0)
        time_over = row.get("time_overrun_months", 0.0)
        cost_over = row.get("cost_overrun_ratio", 0.0)
        age = row.get("project_age_months", 0.0)

        if div is not None and not math.isnan(div) and div > 0.25:
            indics.append({
                "type": "PROGRESS_EXPENDITURE_MISMATCH",
                "severity": "HIGH" if div > 0.40 else "MEDIUM",
                "message": f"Expenditure ratio ({exp_r:.2f}) significantly exceeds physical progress ({prog_r*100:.1f}%).",
                "metric": "exp_progress_divergence",
                "value": round(float(div), 3),
            })

        if cost_over is not None and not math.isnan(cost_over) and cost_over > 0.50:
            indics.append({
                "type": "SEVERE_COST_OVERRUN",
                "severity": "CRITICAL" if cost_over > 1.0 else "HIGH",
                "message": f"Cost revised by {cost_over*100:.1f}% over sanctioned budget.",
                "metric": "cost_overrun_ratio",
                "value": round(float(cost_over), 3),
            })

        if time_over is not None and not math.isnan(time_over) and time_over > 24:
            indics.append({
                "type": "PROLONGED_SCHEDULE_DELAY",
                "severity": "HIGH" if time_over > 48 else "MEDIUM",
                "message": f"Schedule delayed by {time_over:.1f} months beyond target completion.",
                "metric": "time_overrun_months",
                "value": round(float(time_over), 1),
            })

        if exp_r is not None and not math.isnan(exp_r) and exp_r > 1.2:
            indics.append({
                "type": "EXCESS_EXPENDITURE_DRAIN",
                "severity": "HIGH",
                "message": f"Cumulative spend is {exp_r:.2f}x of sanctioned capital.",
                "metric": "expenditure_ratio",
                "value": round(float(exp_r), 3),
            })

        if age is not None and not math.isnan(age) and age > 120 and (prog_r or 0) < 0.50:
            indics.append({
                "type": "STALLED_LEGACY_PROJECT",
                "severity": "HIGH",
                "message": f"Project is {age/12:.1f} years old with only {(prog_r or 0)*100:.1f}% physical progress.",
                "metric": "project_age_months",
                "value": round(float(age), 1),
            })

        if indics:
            explanation = indics[0]["message"]
        else:
            explanation = "Project operational parameters fall within standard statistical distribution."

        indicators_list.append(indics)
        explanations.append(explanation)

    return explanations, indicators_list


def _compute_risk_quadrants(df: pd.DataFrame) -> pd.Series:
    is_overrun_risk = (df.get("cost_overrun_ratio", 0) > 0.15) | (df.get("is_overrun", 0) == 1)
    is_anom = df["is_anomaly"] == 1

    quads = []
    for over_risk, anom in zip(is_overrun_risk, is_anom):
        if over_risk and anom:
            quads.append("HIGH_RISK_ANOMALOUS")
        elif over_risk and not anom:
            quads.append("HIGH_RISK_NORMAL")
        elif not over_risk and anom:
            quads.append("LOW_RISK_ANOMALOUS")
        else:
            quads.append("LOW_RISK_NORMAL")
    return pd.Series(quads, index=df.index)


def get_anomalies(
    state: Optional[str] = None,
    agency: Optional[str] = None,
    severity: Optional[str] = None,
    min_anomaly_score: Optional[float] = None,
    quadrant: Optional[str] = None,
    only_flagged: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    if _anomaly_df is None:
        return {
            "anomalies": [],
            "total": 0,
            "total_returned": 0,
            "limit": limit,
            "offset": offset,
            "detector_status": anomaly_status(),
        }

    df = _anomaly_df.copy()

    if only_flagged:
        df = df[df["is_anomaly"] == 1]
    if state:
        df = df[df["state"].astype(str).str.upper() == state.strip().upper()]
    if agency:
        df = df[df["agency"].astype(str).str.upper().str.contains(agency.strip().upper(), na=False)]
    if severity:
        df = df[df["anomaly_severity"].astype(str).str.upper() == severity.strip().upper()]
    if min_anomaly_score is not None:
        df = df[df["anomaly_score"] >= min_anomaly_score]
    if quadrant:
        df = df[df["risk_quadrant"].astype(str).str.upper() == quadrant.strip().upper()]

    total = len(df)
    df = df.sort_values("anomaly_score", ascending=False)
    paged = df.iloc[offset : offset + limit]

    results = []
    for _, row in paged.iterrows():
        results.append(_format_anomaly_record(row))

    return {
        "anomalies": results,
        "total": total,
        "total_returned": len(results),
        "limit": limit,
        "offset": offset,
        "detector_status": anomaly_status(),
    }


def get_project_anomaly(project_code_or_id: Union[str, int]) -> Optional[dict]:
    if _anomaly_df is None:
        return None

    code_str = str(project_code_or_id).strip().replace(".0", "")
    matches = _anomaly_df[
        (_anomaly_df["project_code_str"] == code_str)
        | (_anomaly_df["project_id"] == code_str)
    ]

    if matches.empty:
        return None

    row = matches.iloc[-1]
    rec = _format_anomaly_record(row)

    deviations = []
    for col in ANOMALY_FEATURE_COLS:
        val = row.get(col)
        med = _feature_medians.get(col, 0.0)
        std = _feature_stds.get(col, 1.0)
        if val is not None and not pd.isna(val):
            z_score = round(float((val - med) / std), 2)
            deviations.append({
                "feature": col,
                "label": col.replace("_", " ").title(),
                "project_value": round(float(val), 3),
                "dataset_median": round(float(med), 3),
                "z_score": z_score,
                "is_deviant": abs(z_score) >= 1.5,
            })

    rec["feature_deviations"] = deviations
    return rec


def _format_anomaly_record(row: pd.Series) -> dict:
    explanation_text = str(row.get("anomaly_explanation", row.get("anomaly_reason", "")))
    score = float(row.get("anomaly_score", row.get("anomaly_score_norm", 0.0)))
    
    orig_c = _clean_num(row.get("original_cost"))
    rev_c = _clean_num(row.get("revised_cost"))
    spend = _clean_num(row.get("cumulative_expenditure"))
    prog = _clean_num(row.get("physical_progress"))
    cov_pct = _clean_num(row.get("cost_overrun_pct"))
    time_mo = _clean_num(row.get("time_overrun_months"))
    plan_dur = _clean_num(row.get("planned_duration_months"))
    
    time_pct = None
    if time_mo is not None and plan_dur is not None and plan_dur > 0:
        time_pct = round((time_mo / plan_dur) * 100, 1)

    cov_ratio = float(row.get("cost_overrun_ratio", 0) or 0)
    risk_st = "High Risk" if cov_ratio > 0.30 else ("Medium Risk" if cov_ratio > 0.10 else "Low Risk")

    return {
        "project_code": str(row.get("project_code", "")).replace(".0", ""),
        "project_id": str(row.get("project_id", "")),
        "project_name": str(row.get("project_name", "")),
        "agency": str(row.get("agency", "")),
        "state": str(row.get("state", "")),
        "original_cost": orig_c,
        "revised_cost": rev_c,
        "cumulative_expenditure": spend,
        "physical_progress": prog,
        "cost_overrun_pct": cov_pct,
        "time_overrun_months": time_mo,
        "time_overrun_pct": time_pct,
        "anomaly_score": score,
        "anomaly_score_norm": score,
        "raw_anomaly_score": float(row.get("raw_anomaly_score", 0.0)),
        "anomaly_status": str(row.get("anomaly_status", "NORMAL")),
        "is_anomaly": int(row.get("is_anomaly", 0)),
        "severity": str(row.get("anomaly_severity", "LOW")),
        "risk_quadrant": str(row.get("risk_quadrant", "LOW_RISK_NORMAL")),
        "risk_status": risk_st,
        "explanation": explanation_text,
        "anomaly_reason": explanation_text,
        "detected_indicators": row.get("detected_indicators", []),
        "relevant_project_metrics": {
            "original_cost": orig_c,
            "revised_cost": rev_c,
            "cumulative_expenditure": spend,
            "physical_progress": prog,
            "expenditure_ratio": _clean_num(row.get("expenditure_ratio")),
            "cost_overrun_pct": cov_pct,
            "time_overrun_months": time_mo,
            "time_overrun_pct": time_pct,
            "project_age_months": _clean_num(row.get("project_age_months")),
        },
        "provenance": "UNSUPERVISED_ISOLATION_FOREST",
    }


def _clean_num(val) -> Optional[float]:
    if val is None or pd.isna(val):
        return None
    try:
        res = float(val)
        return None if math.isnan(res) or math.isinf(res) else round(res, 2)
    except Exception:
        return None


def anomaly_status() -> dict:
    total = len(_anomaly_df) if _anomaly_df is not None else 0
    flagged = int((_anomaly_df["is_anomaly"] == 1).sum()) if _anomaly_df is not None else 0
    crit = int((_anomaly_df["anomaly_severity"] == "CRITICAL").sum()) if _anomaly_df is not None else 0
    high = int((_anomaly_df["anomaly_severity"] == "HIGH").sum()) if _anomaly_df is not None else 0

    return {
        "fitted": _anomaly_model is not None,
        "total_projects": total,
        "total_evaluated": total,
        "flagged_count": flagged,
        "anomalies_flagged": flagged,
        "critical_count": crit,
        "high_count": high,
        "features_used": ANOMALY_FEATURE_COLS,
        "algorithm": "Isolation Forest (Unsupervised)",
        "error": _fit_error,
    }
