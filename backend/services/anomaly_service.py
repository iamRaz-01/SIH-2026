"""
InfraGuard AI — Anomaly Detection Service

USP #1: Intelligent Anomaly Detection

Detects projects with statistically unusual expenditure, progress,
or cost-revision patterns using Isolation Forest (sklearn).

The model is fit on the live dataset at startup — NOT a pre-trained artifact.
Returns per-project anomaly scores and binary flags.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# ── Features used for anomaly detection ───────────────────────────────────────
ANOMALY_FEATURES = [
    "cost_overrun_ratio",
    "expenditure_ratio",
    "exp_progress_divergence",
    "cost_revision_magnitude",
    "physical_progress_ratio",
]

_anomaly_model: Optional[IsolationForest] = None
_scaler: Optional[StandardScaler] = None
_anomaly_df: Optional[pd.DataFrame] = None
_fit_error: Optional[str] = None


def fit_anomaly_model(df: pd.DataFrame, contamination: float = 0.05) -> None:
    """
    Fit Isolation Forest on the engineered features.
    Call once after the dataset is loaded.
    """
    global _anomaly_model, _scaler, _anomaly_df, _fit_error

    available = [f for f in ANOMALY_FEATURES if f in df.columns]
    if len(available) < 2:
        _fit_error = f"Insufficient feature columns for anomaly detection: {available}"
        logger.error(_fit_error)
        return

    feature_df = df[available].copy()
    # Drop rows with all NaN in anomaly features
    feature_df = feature_df.dropna(how="all")
    valid_idx = feature_df.index

    # Fill remaining NaN with column median (robust imputation)
    feature_df = feature_df.fillna(feature_df.median())

    try:
        scaler = StandardScaler()
        X = scaler.fit_transform(feature_df)

        iso = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100,
        )
        iso.fit(X)

        # Compute anomaly scores for all fitted rows
        # score_samples returns negative anomaly score: more negative = more anomalous
        raw_scores = iso.score_samples(X)
        predictions = iso.predict(X)   # -1 = anomaly, 1 = normal

        result = df.loc[valid_idx, ["project_id", "project_name", "agency", "state"]].copy()
        result["anomaly_score"] = raw_scores                           # raw (negative = worse)
        result["anomaly_score_norm"] = _normalise_score(raw_scores)   # 0-1, higher = more anomalous
        result["is_anomaly"] = (predictions == -1).astype(int)
        result["anomaly_reason"] = _compute_anomaly_reasons(
            df.loc[valid_idx, available]
        )

        _anomaly_model = iso
        _scaler = scaler
        _anomaly_df = result.reset_index(drop=True)
        _fit_error = None
        logger.info(
            "Anomaly model fitted. Flagged %d/%d projects as anomalous.",
            result["is_anomaly"].sum(), len(result)
        )
    except Exception as exc:
        _fit_error = str(exc)
        logger.error("Anomaly model fitting failed: %s", exc)


def _normalise_score(scores: np.ndarray) -> np.ndarray:
    """Normalise raw Isolation Forest scores to [0, 1] where 1 = most anomalous."""
    # scores are negative; flip so higher = more anomalous, then min-max scale
    flipped = -scores
    mn, mx = flipped.min(), flipped.max()
    if mx == mn:
        return np.zeros_like(flipped)
    return (flipped - mn) / (mx - mn)


def _compute_anomaly_reasons(feature_df: pd.DataFrame) -> pd.Series:
    """
    Heuristic: identify which feature most deviated from the median for each row.
    Returns a series of human-readable strings.
    """
    reasons = []
    medians = feature_df.median()
    stds = feature_df.std().replace(0, 1)

    for _, row in feature_df.iterrows():
        deviations = ((row - medians) / stds).abs()
        worst_feat = deviations.idxmax() if not deviations.isna().all() else None
        if worst_feat:
            direction = "above" if row[worst_feat] > medians[worst_feat] else "below"
            reasons.append(
                f"{worst_feat.replace('_', ' ').title()} is "
                f"{abs(deviations[worst_feat]):.1f}σ {direction} median"
            )
        else:
            reasons.append("Unusual pattern detected")
    return pd.Series(reasons, index=feature_df.index)


def get_anomalies(limit: int = 100, only_flagged: bool = False) -> list[dict]:
    """Return anomaly results as a list of dicts, sorted by anomaly score."""
    if _anomaly_df is None:
        return []

    df = _anomaly_df
    if only_flagged:
        df = df[df["is_anomaly"] == 1]

    df = df.sort_values("anomaly_score_norm", ascending=False).head(limit)
    return df.to_dict(orient="records")


def anomaly_status() -> dict:
    return {
        "fitted": _anomaly_model is not None,
        "total_projects": len(_anomaly_df) if _anomaly_df is not None else 0,
        "flagged_count": int(_anomaly_df["is_anomaly"].sum()) if _anomaly_df is not None else 0,
        "error": _fit_error,
    }
