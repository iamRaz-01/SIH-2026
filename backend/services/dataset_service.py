"""
InfraGuard AI — Dataset Loading & Preprocessing Service

Responsibilities:
  - Load the Excel dataset once on startup (singleton via module-level cache)
  - Normalise messy/misspelled column names → clean internal names
  - Type-coerce all numeric columns safely
  - Derive engineered features used by the ML model and API responses
  - Expose a clean DataFrame and project-lookup helpers to the rest of the app

Original column name → normalised internal name mapping:
  project name               → project_name
  agency                     → agency
  prooject code / project code → project_code
  state                      → state
  doa                        → date_of_approval
  original/target doc        → original_target_completion
  revised doc                → revised_completion
  orginal cost / original cost → original_cost
  revised cost               → revised_cost
  cumulative expenditure     → cumulative_expenditure
  physical progess / progress  → physical_progress
  edition                    → edition
"""

from __future__ import annotations

import logging
import hashlib
from pathlib import Path
from functools import lru_cache
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── Column name normalisation map ──────────────────────────────────────────────
# Keys are lowercase-stripped variants of what might appear in the real file.
# Values are the clean internal names used everywhere in this application.
_COLUMN_MAP: dict[str, str] = {
    # project name
    "project name": "project_name",
    "projectname": "project_name",
    "name of project": "project_name",
    # agency / ministry
    "agency": "agency",
    "ministry": "agency",
    "ministry/agency": "agency",
    # project code
    "prooject code": "project_code",   # original typo preserved
    "project code": "project_code",
    "projectcode": "project_code",
    "code": "project_code",
    # state
    "state": "state",
    # date of approval — kept as 'doa' to match model's raw_feature_cols exactly
    "doa": "doa",
    "date of approval": "doa",
    "date of sanction": "doa",
    "sanctioned date": "doa",
    # original target completion — 'original_target_doa' matches model raw_feature_cols
    "original/target doc": "original_target_doa",
    "original target doc": "original_target_doa",
    "target doc": "original_target_doa",
    "original doc": "original_target_doa",
    "target date of completion": "original_target_doa",
    "original completion": "original_target_doa",
    # revised completion (not used by model but kept for dashboard)
    "revised doc": "revised_completion",
    "revised date of completion": "revised_completion",
    "revised completion": "revised_completion",
    # original cost (used by model as 'original_cost')
    "orginal cost": "original_cost",   # typo in original Excel
    "original cost": "original_cost",
    "sanctioned cost": "original_cost",
    "approved cost": "original_cost",
    # revised cost (used by dashboard, not model)
    "revised cost": "revised_cost",
    # cumulative expenditure (used by model as 'cumulative_expenditure')
    "cumulative expenditure": "cumulative_expenditure",
    "cum. expenditure": "cumulative_expenditure",
    "expenditure": "cumulative_expenditure",
    # physical progress (used by model as 'physical_progress')
    "physical progess": "physical_progress",  # typo in original Excel
    "physical progress": "physical_progress",
    "progress": "physical_progress",
    "% progress": "physical_progress",
    # edition (used by model as 'edition')
    "edition": "edition",
}

# ── Numeric columns that should be float ──────────────────────────────────────
_NUMERIC_COLS = [
    "original_cost",
    "revised_cost",
    "cumulative_expenditure",
    "physical_progress",
]

# ── Global dataset state ───────────────────────────────────────────────────────
_df_cache: Optional[pd.DataFrame] = None
_load_error: Optional[str] = None


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename raw column headers to clean internal names."""
    rename_map: dict[str, str] = {}
    for col in df.columns:
        key = col.strip().lower()
        if key in _COLUMN_MAP:
            rename_map[col] = _COLUMN_MAP[key]
        else:
            # keep as-is but snake_case it so it's predictable
            rename_map[col] = key.replace(" ", "_").replace("/", "_").replace(".", "")
    df = df.rename(columns=rename_map)
    return df


def _coerce_numeric(df: pd.DataFrame) -> pd.DataFrame:
    """Safely coerce numeric columns; non-parseable values → NaN."""
    for col in _NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def _derive_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute derived/engineered columns used by the ML model and API.
    These are computed from the raw data — no external inputs.
    """
    eps = 1e-9  # avoid division by zero

    # Cost overrun ratio: (revised - original) / original
    if "revised_cost" in df.columns and "original_cost" in df.columns:
        df["cost_overrun_ratio"] = (
            (df["revised_cost"] - df["original_cost"])
            / (df["original_cost"].abs() + eps)
        )

    # Expenditure efficiency: expenditure / revised cost
    if "cumulative_expenditure" in df.columns and "revised_cost" in df.columns:
        df["expenditure_ratio"] = df["cumulative_expenditure"] / (
            df["revised_cost"].abs() + eps
        )

    # Physical progress as a 0-1 ratio (input may be 0-100 or 0-1)
    if "physical_progress" in df.columns:
        prog = df["physical_progress"].copy()
        # If median > 1, assume 0-100 scale and normalise
        if prog.median(skipna=True) > 1:
            df["physical_progress_ratio"] = prog / 100.0
        else:
            df["physical_progress_ratio"] = prog

    # Expenditure-vs-progress divergence (red flag: spending ahead of work)
    if "expenditure_ratio" in df.columns and "physical_progress_ratio" in df.columns:
        df["exp_progress_divergence"] = (
            df["expenditure_ratio"] - df["physical_progress_ratio"]
        )

    # Cost revision magnitude (how many times has cost increased?)
    if "cost_overrun_ratio" in df.columns:
        df["cost_revision_magnitude"] = df["cost_overrun_ratio"].clip(lower=0)

    # Binary overrun label (used for anomaly baseline)
    if "cost_overrun_ratio" in df.columns:
        df["is_overrun"] = (df["cost_overrun_ratio"] > 0.10).astype(int)

    # Synthetic project_id: stable hash of project_name + project_code
    id_base = (
        df.get("project_name", pd.Series([""] * len(df))).fillna("").astype(str)
        + "|"
        + df.get("project_code", pd.Series([""] * len(df))).fillna("").astype(str)
    )
    df["project_id"] = id_base.apply(
        lambda s: hashlib.md5(s.encode()).hexdigest()[:12]
    )

    return df


def load_dataset(path: Path) -> pd.DataFrame:
    """
    Load the Excel dataset, normalise columns, coerce types, derive features.
    Returns a clean DataFrame. Raises on failure (caller decides how to handle).
    """
    global _df_cache, _load_error

    if _df_cache is not None:
        return _df_cache

    logger.info("Loading dataset from: %s", path)
    try:
        raw = pd.read_excel(path, engine="openpyxl")
    except Exception as exc:
        _load_error = str(exc)
        logger.error("Failed to load dataset: %s", exc)
        raise

    df = _normalise_columns(raw)
    df = _coerce_numeric(df)
    df = _derive_features(df)

    # Reset index for stable row references
    df = df.reset_index(drop=True)
    df.index.name = "row_index"

    _df_cache = df
    _load_error = None
    logger.info(
        "Dataset loaded: %d projects, %d columns", len(df), len(df.columns)
    )
    return df


def get_dataset() -> pd.DataFrame:
    """Return the cached dataset. Must call load_dataset() first."""
    if _df_cache is None:
        raise RuntimeError("Dataset not yet loaded. Call load_dataset() first.")
    return _df_cache


def dataset_status() -> dict:
    return {
        "loaded": _df_cache is not None,
        "rows": len(_df_cache) if _df_cache is not None else 0,
        "columns": list(_df_cache.columns) if _df_cache is not None else [],
        "error": _load_error,
    }


def get_project_by_id(project_id: str) -> Optional[pd.Series]:
    """Return a single project row by its synthetic project_id."""
    df = get_dataset()
    matches = df[df["project_id"] == project_id]
    if matches.empty:
        return None
    return matches.iloc[0]
