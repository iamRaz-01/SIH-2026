"""
InfraGuard AI — ML Service (Updated)
Handles the actual pkl model format: a dict with key 'pipeline'.

Model structure (confirmed via pickle inspection):
  {
    'pipeline': sklearn.Pipeline(
      steps=[
        ('fe', pipeline.feature_engineering.FeatureEngineer),
        ('impute', sklearn.impute.SimpleImputer),
        ('clf', lightgbm.sklearn.LGBMClassifier),
      ]
    ),
    'model_type': 'lightgbm',
    'raw_feature_cols': ['edition', 'project_name', 'agency', 'state',
                         'doa', 'original_target_doa', 'original_cost',
                         'cumulative_expenditure', 'physical_progress'],
    'best_params': {...},
    'optimal_threshold': 0.387,
    'oof_metrics': {'roc_auc': 0.797, 'pr_auc': 0.435, ...},
    'trained_at': '2026-08-30T16:59:28',
    'n_training_rows': 48894,
    'random_state': 42,
  }

IMPORTANT: The pipeline.feature_engineering.FeatureEngineer class MUST be
importable when this module loads. It is reconstructed in:
  backend/pipeline/feature_engineering.py
"""

from __future__ import annotations

import logging
import traceback
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── Module-level state ─────────────────────────────────────────────────────────
_model_bundle: Optional[dict] = None
_pipeline: Any = None
_raw_feature_cols: list[str] = []
_optimal_threshold: float = 0.5
_oof_metrics: dict = {}
_model_type: str = "unknown"
_load_error: Optional[str] = None
_model_loaded: bool = False


class ModelNotReadyError(RuntimeError):
    """Raised when a prediction is attempted before the model is available."""
    pass


def load_model(path: Path) -> None:
    """
    Load the model bundle from disk.
    Sets module-level state; captures errors for health endpoint.
    """
    global _model_bundle, _pipeline, _raw_feature_cols, _optimal_threshold
    global _oof_metrics, _model_type, _load_error, _model_loaded

    logger.info("Loading ML model from: %s", path)

    if not path.exists():
        _load_error = f"Model file not found: {path}"
        logger.error(_load_error)
        return

    try:
        import joblib
        bundle = joblib.load(path)

        if not isinstance(bundle, dict):
            raise TypeError(
                f"Expected model bundle to be a dict, got {type(bundle).__name__}"
            )

        _model_bundle = bundle
        _pipeline = bundle["pipeline"]
        _raw_feature_cols = bundle.get("raw_feature_cols", [])
        _optimal_threshold = float(bundle.get("optimal_threshold", 0.5))
        _oof_metrics = bundle.get("oof_metrics", {})
        _model_type = bundle.get("model_type", "unknown")
        _model_loaded = True
        _load_error = None

        logger.info(
            "ML model loaded: type=%s, threshold=%.4f, ROC-AUC=%.3f, "
            "trained_at=%s, n_rows=%d",
            _model_type,
            _optimal_threshold,
            _oof_metrics.get("roc_auc", 0),
            bundle.get("trained_at", "unknown"),
            bundle.get("n_training_rows", 0),
        )

    except Exception as exc:
        _load_error = f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
        logger.error("Failed to load ML model:\n%s", _load_error)
        _model_loaded = False


def model_status() -> dict:
    return {
        "loaded": _model_loaded,
        "type": _model_type if _model_loaded else None,
        "raw_feature_cols": _raw_feature_cols,
        "optimal_threshold": _optimal_threshold if _model_loaded else None,
        "oof_metrics": _oof_metrics if _model_loaded else {},
        "trained_at": _model_bundle.get("trained_at") if _model_bundle else None,
        "n_training_rows": _model_bundle.get("n_training_rows") if _model_bundle else None,
        "error": _load_error,
    }


def predict_cost_overrun(project_data: dict) -> dict:
    """
    Run cost-overrun prediction for a single project.

    Args:
        project_data: dict with fields from raw_feature_cols:
          edition, project_name, agency, state, doa, original_target_doa,
          original_cost, cumulative_expenditure, physical_progress

    Returns a structured prediction result.
    """
    if not _model_loaded or _pipeline is None:
        raise ModelNotReadyError(
            f"ML model is not available. Error: {_load_error}"
        )

    # ── Insufficient data guard ────────────────────────────────────────────────
    critical_fields = ["original_cost", "cumulative_expenditure", "physical_progress"]
    missing_critical = [
        f for f in critical_fields
        if project_data.get(f) is None or _is_nan(project_data.get(f))
    ]
    if missing_critical:
        return {
            "risk_class": "Unknown",
            "probability": None,
            "confidence": "Low",
            "status": "Insufficient Data",
            "top_features": [],
            "model_type": _model_type,
            "missing_fields": missing_critical,
            "optimal_threshold": _optimal_threshold,
        }

    # Build input DataFrame
    input_df = _build_input(project_data)

    try:
        proba_all = _pipeline.predict_proba(input_df)
        prob = float(proba_all[0][1])  # probability of class 1 (overrun)

        # Use the model's stored optimal threshold
        predicted_class = int(prob >= _optimal_threshold)

        # ── Risk class from probability ────────────────────────────────────────
        risk_class, confidence = _classify_risk(prob)

        # ── Top contributing features ──────────────────────────────────────────
        top_features = _rank_top_features(project_data)

        return {
            "risk_class": risk_class,
            "probability": round(prob, 4),
            "predicted_overrun": bool(predicted_class),
            "confidence": confidence,
            "status": "Scored",
            "top_features": top_features,
            "model_type": _model_type,
            "optimal_threshold": _optimal_threshold,
            "model_metrics": {
                "roc_auc": _oof_metrics.get("roc_auc"),
                "pr_auc": _oof_metrics.get("pr_auc"),
            },
        }

    except Exception as exc:
        logger.error("Prediction failed: %s\n%s", exc, traceback.format_exc())
        raise ModelNotReadyError(f"Prediction pipeline failed: {exc}") from exc


def _build_input(project_data: dict) -> pd.DataFrame:
    """
    Build the input DataFrame from project_data using raw_feature_cols order.
    The DataFrame columns must exactly match what the FeatureEngineer expects.
    """
    cols = _raw_feature_cols if _raw_feature_cols else [
        "edition", "project_name", "agency", "state",
        "doa", "original_target_doa", "original_cost",
        "cumulative_expenditure", "physical_progress",
    ]
    row = {col: project_data.get(col) for col in cols}
    df = pd.DataFrame([row], columns=cols)
    return df


def _classify_risk(prob: float) -> tuple[str, str]:
    """Map probability to (risk_class, confidence)."""
    if prob >= 0.70:
        return "High", "High"
    if prob >= _optimal_threshold:
        return "High", "Medium"
    if prob >= 0.20:
        return "Medium", "Medium"
    return "Low", "High"


def _rank_top_features(project_data: dict, top_n: int = 5) -> list[dict]:
    """
    Rank input features by their likely contribution to the prediction.
    Uses a simple heuristic (absolute value) as a proxy when SHAP is unavailable.
    """
    ranked = []
    for feat in _raw_feature_cols:
        val = project_data.get(feat)
        if val is not None and not _is_nan(val):
            try:
                num_val = float(val)
                ranked.append({
                    "feature": feat,
                    "value": val,
                    "label": _human_label(feat),
                    "numeric_value": round(num_val, 4),
                })
            except (ValueError, TypeError):
                ranked.append({
                    "feature": feat,
                    "value": val,
                    "label": _human_label(feat),
                    "numeric_value": None,
                })

    # Sort numeric features by magnitude
    ranked.sort(key=lambda x: abs(x["numeric_value"] or 0), reverse=True)
    return ranked[:top_n]


def _is_nan(val) -> bool:
    try:
        return val != val  # NaN check
    except Exception:
        return False


def _human_label(feature_name: str) -> str:
    labels = {
        "edition": "Report Edition",
        "project_name": "Project Name",
        "agency": "Implementing Agency",
        "state": "State",
        "doa": "Date of Approval",
        "original_target_doa": "Original Target Completion",
        "original_cost": "Sanctioned Cost (₹ Cr)",
        "cumulative_expenditure": "Cumulative Expenditure (₹ Cr)",
        "physical_progress": "Physical Progress (%)",
    }
    return labels.get(feature_name, feature_name.replace("_", " ").title())
