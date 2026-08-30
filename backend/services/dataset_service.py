"""
backend/services/dataset_service.py

InfraGuard AI — Dataset Loading & Preprocessing Service
Loads the Ministry of Statistics & Programme Implementation (MoSPI) / PAIMANA
ongoing projects dataset and calculates clean normalized features.

Responsibilities:
  - Load Excel dataset once at startup (singleton cache).
  - Normalize header variants into predictable internal names.
  - Coerce numeric and date columns safely without dropping valid projects.
  - Compute derived features using pipeline.feature_engineering.
  - Provide fast lookups by project_code (integer/string) and synthetic project_id.
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Any, Optional, Union

import numpy as np
import pandas as pd

from pipeline.feature_engineering import (
    calc_cost_growth,
    calc_cost_overrun_percentage,
    calc_expenditure_ratio,
    calc_physical_progress_ratio,
    calc_planned_duration_months,
    calc_project_age_months,
    calc_time_overrun_months,
)

logger = logging.getLogger(__name__)

# ── Column name normalisation map ──────────────────────────────────────────────
_COLUMN_MAP: dict[str, str] = {
    # Project name
    "project name": "project_name",
    "projectname": "project_name",
    "name of project": "project_name",
    # Agency / Ministry
    "agency": "agency",
    "ministry": "agency",
    "ministry/agency": "agency",
    # Project code
    "prooject code": "project_code",
    "project code": "project_code",
    "projectcode": "project_code",
    "code": "project_code",
    # State
    "state": "state",
    # Date of approval
    "doa": "doa",
    "date of approval": "doa",
    "date of sanction": "doa",
    "sanctioned date": "doa",
    # Original target completion
    "original/target doc": "original_target_doa",
    "original target doc": "original_target_doa",
    "target doc": "original_target_doa",
    "original doc": "original_target_doa",
    "target date of completion": "original_target_doa",
    "original completion": "original_target_doa",
    "original_target_completion": "original_target_doa",
    # Revised completion
    "revised doc": "revised_completion",
    "revised date of completion": "revised_completion",
    "revised completion": "revised_completion",
    # Original cost
    "orginal cost": "original_cost",
    "original cost": "original_cost",
    "sanctioned cost": "original_cost",
    "approved cost": "original_cost",
    # Revised cost
    "revised cost": "revised_cost",
    # Cumulative expenditure
    "cumulative expenditure": "cumulative_expenditure",
    "cum. expenditure": "cumulative_expenditure",
    "expenditure": "cumulative_expenditure",
    # Physical progress
    "physical progess": "physical_progress",
    "physical progress": "physical_progress",
    "progress": "physical_progress",
    "% progress": "physical_progress",
    # Edition
    "edition": "edition",
}

_NUMERIC_COLS = [
    "original_cost",
    "revised_cost",
    "cumulative_expenditure",
    "physical_progress",
]

_df_cache: Optional[pd.DataFrame] = None
_latest_df_cache: Optional[pd.DataFrame] = None
_load_error: Optional[str] = None
_dataset_path_used: Optional[str] = None


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename raw column headers to clean internal names."""
    rename_map: dict[str, str] = {}
    for col in df.columns:
        key = str(col).strip().lower()
        if key in _COLUMN_MAP:
            rename_map[col] = _COLUMN_MAP[key]
        else:
            clean_key = key.replace(" ", "_").replace("/", "_").replace(".", "").replace("-", "_")
            rename_map[col] = clean_key
    return df.rename(columns=rename_map)


def _coerce_numeric(df: pd.DataFrame) -> pd.DataFrame:
    """Safely coerce numeric columns; invalid values become NaN."""
    for col in _NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def _derive_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute domain-specific derived features used across ML, Anomaly, Risk, and Benchmarking.
    """
    eps = 1e-9

    # Cost overrun ratio & percentage
    if "revised_cost" in df.columns and "original_cost" in df.columns:
        df["cost_growth"] = df["revised_cost"] - df["original_cost"]
        df["cost_overrun_ratio"] = (
            (df["revised_cost"] - df["original_cost"])
            / (df["original_cost"].abs() + eps)
        )
        df["cost_overrun_pct"] = df["cost_overrun_ratio"] * 100.0
    else:
        df["cost_growth"] = 0.0
        df["cost_overrun_ratio"] = 0.0
        df["cost_overrun_pct"] = 0.0

    # Expenditure ratios
    if "cumulative_expenditure" in df.columns and "original_cost" in df.columns:
        df["expenditure_ratio"] = df["cumulative_expenditure"] / (
            df["original_cost"].abs() + eps
        )
    else:
        df["expenditure_ratio"] = 0.0

    if "cumulative_expenditure" in df.columns and "revised_cost" in df.columns:
        df["expenditure_ratio_revised"] = df["cumulative_expenditure"] / (
            df["revised_cost"].abs() + eps
        )
    else:
        df["expenditure_ratio_revised"] = df["expenditure_ratio"]

    # Physical progress ratio (0.0 to 1.0)
    if "physical_progress" in df.columns:
        prog = df["physical_progress"].copy()
        is_pct_scale = prog.median(skipna=True) > 1.0 if not prog.dropna().empty else True
        if is_pct_scale:
            df["physical_progress_ratio"] = (prog / 100.0).clip(0.0, 1.5)
        else:
            df["physical_progress_ratio"] = prog.clip(0.0, 1.5)
    else:
        df["physical_progress_ratio"] = np.nan

    # Divergences & discrepancies
    df["exp_progress_divergence"] = df["expenditure_ratio"] - df["physical_progress_ratio"]
    df["cost_revision_magnitude"] = df["cost_overrun_ratio"].clip(lower=0.0)
    df["is_overrun"] = (df["cost_overrun_ratio"] > 0.10).astype(int)

    # Date calculations
    if "doa" in df.columns:
        df["doa_dt"] = pd.to_datetime(df["doa"], errors="coerce", dayfirst=True)
    if "original_target_doa" in df.columns:
        df["target_dt"] = pd.to_datetime(df["original_target_doa"], errors="coerce", dayfirst=True)
    if "revised_completion" in df.columns:
        df["revised_dt"] = pd.to_datetime(df["revised_completion"], errors="coerce", dayfirst=True)

    if "doa_dt" in df.columns and "target_dt" in df.columns:
        df["planned_duration_months"] = (df["target_dt"] - df["doa_dt"]).dt.days / 30.4375
    else:
        df["planned_duration_months"] = np.nan

    if "revised_dt" in df.columns and "target_dt" in df.columns:
        df["time_overrun_months"] = (df["revised_dt"] - df["target_dt"]).dt.days / 30.4375
    else:
        df["time_overrun_months"] = np.nan

    # Project Age in months
    if "doa_dt" in df.columns:
        if "edition" in df.columns:
            edition_dt = pd.to_datetime(df["edition"], errors="coerce", dayfirst=True)
            df["project_age_months"] = (edition_dt - df["doa_dt"]).dt.days / 30.4375
        else:
            df["project_age_months"] = (pd.Timestamp.now() - df["doa_dt"]).dt.days / 30.4375
    else:
        df["project_age_months"] = np.nan

    # Synthetic unique project_id (hash of project_name + project_code)
    id_base = (
        df.get("project_name", pd.Series([""] * len(df))).fillna("").astype(str)
        + "|"
        + df.get("project_code", pd.Series([""] * len(df))).fillna("").astype(str)
    )
    df["project_id"] = id_base.apply(
        lambda s: hashlib.md5(s.encode()).hexdigest()[:12]
    )

    # Clean project_code as string for reliable string queries
    if "project_code" in df.columns:
        df["project_code_str"] = df["project_code"].fillna("").astype(str).str.replace(r"\.0$", "", regex=True)
    else:
        df["project_code_str"] = df["project_id"]

    return df


def load_dataset(path: Union[Path, str]) -> pd.DataFrame:
    """
    Load dataset from Excel or CSV with path fallback support.
    """
    global _df_cache, _load_error, _dataset_path_used

    if _df_cache is not None:
        return _df_cache

    dataset_path = Path(path)
    if not dataset_path.exists():
        candidates = [
            dataset_path,
            dataset_path.parent / "ongoing_project_25_26.xlsx",
            Path("ongoing_project_25_26.xlsx"),
            Path("../ongoing_project_25_26.xlsx"),
            Path("cost_overrun_model_ready.csv"),
        ]
        for cand in candidates:
            if cand.exists():
                dataset_path = cand
                break

    logger.info("Loading dataset from: %s", dataset_path)
    try:
        if str(dataset_path).endswith(".csv"):
            raw = pd.read_csv(dataset_path)
        else:
            raw = pd.read_excel(dataset_path, engine="openpyxl")
    except Exception as exc:
        _load_error = str(exc)
        logger.error("Failed to load dataset from %s: %s", dataset_path, exc)
        raise

    df = _normalise_columns(raw)
    df = _coerce_numeric(df)
    df = _derive_features(df)

    if "edition" in df.columns:
        df["edition_dt"] = pd.to_datetime(df["edition"], errors="coerce")
        df = df.sort_values("edition_dt", ascending=False).reset_index(drop=True)
    else:
        df = df.reset_index(drop=True)
    df.index.name = "row_index"

    _df_cache = df
    if "edition_dt" in df.columns:
        _latest_df_cache = (
            df.sort_values("edition_dt")
            .groupby("project_code_str", as_index=False)
            .last()
            .reset_index(drop=True)
        )
    else:
        _latest_df_cache = df.groupby("project_code_str", as_index=False).last().reset_index(drop=True)

    _load_error = None
    _dataset_path_used = str(dataset_path)
    logger.info(
        "Dataset loaded successfully: %d records, %d columns from %s (unique projects: %d)",
        len(df), len(df.columns), dataset_path, len(_latest_df_cache)
    )
    return df


def get_dataset() -> pd.DataFrame:
    """Return the cached multi-edition dataset. Raises RuntimeError if not loaded."""
    if _df_cache is None:
        raise RuntimeError("Dataset not yet loaded. Call load_dataset() first.")
    return _df_cache


def get_latest_dataset() -> pd.DataFrame:
    """
    Return the deduplicated dataset containing the latest/most recent monitoring edition
    snapshot for every unique project in the registry.
    """
    if _latest_df_cache is not None:
        return _latest_df_cache
    if _df_cache is not None:
        if "edition_dt" in _df_cache.columns:
            return (
                _df_cache.sort_values("edition_dt")
                .groupby("project_code_str", as_index=False)
                .last()
                .reset_index(drop=True)
            )
        return _df_cache.groupby("project_code_str", as_index=False).last().reset_index(drop=True)
    raise RuntimeError("Dataset not yet loaded. Call load_dataset() first.")


def dataset_status() -> dict:
    """Return dataset availability status."""
    return {
        "loaded": _df_cache is not None,
        "rows": len(_df_cache) if _df_cache is not None else 0,
        "columns": list(_df_cache.columns) if _df_cache is not None else [],
        "file": _dataset_path_used,
        "unique_projects": int(_df_cache["project_code_str"].nunique()) if _df_cache is not None else 0,
        "error": _load_error,
    }


def get_project_by_id(project_id: str) -> Optional[pd.Series]:
    """
    Look up the latest active record for a project row by synthetic project_id or project_code.
    """
    if _df_cache is None:
        return None
    matches = _df_cache[_df_cache["project_id"] == project_id]
    if matches.empty:
        # Fallback to project_code lookup
        return get_project_by_code(project_id)
    if "edition_dt" in matches.columns:
        matches = matches.sort_values("edition_dt")
    return matches.iloc[-1]


def get_project_by_code(project_code: Union[str, int]) -> Optional[pd.Series]:
    """
    Look up the latest record for a project by its MoSPI project_code.
    """
    if _df_cache is None:
        return None
    code_str = str(project_code).strip().replace(".0", "")
    matches = _df_cache[_df_cache["project_code_str"] == code_str]
    if matches.empty:
        # Fallback: check if project_id was passed
        id_matches = _df_cache[_df_cache["project_id"] == str(project_code)]
        if not id_matches.empty:
            if "edition_dt" in id_matches.columns:
                id_matches = id_matches.sort_values("edition_dt")
            return id_matches.iloc[-1]
        return None
    if "edition_dt" in matches.columns:
        matches = matches.sort_values("edition_dt")
    # Return the latest edition row for this project code
    return matches.iloc[-1]


def get_project_history(project_code: Union[str, int]) -> list[dict]:
    """
    Return historical timeline of all edition records for a project_code.
    """
    if _df_cache is None:
        return []
    code_str = str(project_code).strip().replace(".0", "")
    matches = _df_cache[_df_cache["project_code_str"] == code_str]
    if matches.empty:
        return []
    if "edition_dt" in matches.columns:
        matches = matches.sort_values("edition_dt")
    return matches.to_dict(orient="records")
