"""
pipeline/feature_engineering.py

Reconstructed implementation of the FeatureEngineer transformer that was used
when training the supplied LightGBM cost-overrun model.

This module MUST exist with exactly this module path ('pipeline.feature_engineering')
and class name ('FeatureEngineer') for the pickle to deserialise correctly.

Reconstruction basis:
  - pickle opcode scan of lightgbm_cost_overrun_model.pkl
  - Confirmed parameter names: rare_threshold, schedule_ratio_clip,
    agency_keep_, agency_freq_map_, state_keep_, state_freq_map_
  - Confirmed output feature names (from SimpleImputer's feature_names_in_):
      planned_duration_months, snapshot_elapsed_months, schedule_progress_ratio,
      original_cost, cumulative_expenditure, cost_burn_ratio,
      physical_progress, progress_spend_discrepancy, progress_time_discrepancy,
      edition_year, edition_month, project_name_length, project_name_word_count,
      kw_road, kw_bridge, kw_power_solar, kw_pipeline_oil_gas, kw_rail_metro,
      kw_port, kw_irrigation, kw_building, agency_freq, state_freq  (23 total)
  - Confirmed agency_keep_ agencies: CPWD, WR, MORTH, GAIL, WCL, ECR, HPCL,
    NHIDCL, NFR, NHAI, NTPC, RVNL, AAI, IOCL, ONGC, SECL, MISSING, PGCIL
  - Confirmed state_keep_ states: KERALA, RAJASTHAN, GUJARAT, NAGALAND,
    CHHATISGARH, PUNJAB, ASSAM, MAHARASHTRA, UTTAR PRADESH, HIMACHAL PRADESH,
    ODISHA, MADHYA PRADESH, JHARKHAND, TAMIL NADU, DELHI, UTTARAKHAND, HARYANA,
    WEST BENGAL, MANIPUR, JAMMU AND KASHMIR, TRIPURA, ARUNACHAL PRADESH,
    KARNATAKA, ANDHRA PRADESH, SIKKIM, MIZORAM, MISSING, TELANGANA, BIHAR,
    MULTI STATE

WARNING: This reconstruction is based on the stored state in the pickle (the
fitted attributes) and the visible parameter names. The transform() logic below
follows the feature names and is a faithful reconstruction of what a typical
FeatureEngineer for this domain would do. If the model loads but predictions
are incorrect, the transform() logic may need adjustment.

DO NOT modify __init__ parameters — those must match exactly what pickle stored.
"""

from __future__ import annotations

import re
from typing import Any, Optional

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin


# Keywords that map to binary indicator features
_KEYWORD_COLS = {
    "kw_road": ["road", "highway", "expressway", "nh-", "sh-", "byp"],
    "kw_bridge": ["bridge", "flyover", "overpass", "viaduct", "tunnel"],
    "kw_power_solar": ["power", "solar", "wind", "hydro", "thermal", "energy", "electricity"],
    "kw_pipeline_oil_gas": ["pipeline", "oil", "gas", "lpg", "lng", "refinery", "petroleum"],
    "kw_rail_metro": ["rail", "metro", "train", "station", "track", "railway"],
    "kw_port": ["port", "harbour", "jetty", "dock", "terminal", "waterway"],
    "kw_irrigation": ["irrigation", "canal", "dam", "reservoir", "water", "barrage"],
    "kw_building": ["building", "hospital", "school", "college", "office", "stadium"],
}

# The exact 23 output feature names (in order) matching what the model expects
OUTPUT_FEATURE_NAMES = [
    "planned_duration_months",
    "snapshot_elapsed_months",
    "schedule_progress_ratio",
    "original_cost",
    "cumulative_expenditure",
    "cost_burn_ratio",
    "physical_progress",
    "progress_spend_discrepancy",
    "progress_time_discrepancy",
    "edition_year",
    "edition_month",
    "project_name_length",
    "project_name_word_count",
    "kw_road",
    "kw_bridge",
    "kw_power_solar",
    "kw_pipeline_oil_gas",
    "kw_rail_metro",
    "kw_port",
    "kw_irrigation",
    "kw_building",
    "agency_freq",
    "state_freq",
]


class FeatureEngineer(BaseEstimator, TransformerMixin):
    """
    Custom sklearn-compatible transformer that converts raw PAIMANA project
    records into the 23-feature matrix expected by the downstream LightGBM model.

    Fitted state (restored from pickle):
      rare_threshold      : float — frequency below which an agency/state is 'OTHER'
      schedule_ratio_clip : tuple(float, float) — clip bounds for schedule_progress_ratio
      agency_keep_        : list[str] — agencies that get their own frequency bucket
      agency_freq_map_    : dict[str, float] — per-agency frequency values
      state_keep_         : list[str] — states that get their own frequency bucket
      state_freq_map_     : dict[str, float] — per-state frequency values
    """

    def __init__(
        self,
        rare_threshold: float = 0.02,
        schedule_ratio_clip: tuple = (-3.0, 3.0),
    ):
        self.rare_threshold = rare_threshold
        self.schedule_ratio_clip = schedule_ratio_clip

        # Fitted attributes — restored from pickle; also set here as defaults
        # so the transformer is usable even without unpickling.
        self.agency_keep_: list = [
            "CPWD", "WR", "MORTH", "GAIL", "WCL", "ECR", "HPCL", "NHIDCL",
            "NFR", "NHAI", "NTPC", "RVNL", "AAI", "IOCL", "ONGC", "SECL",
            "MISSING", "PGCIL",
        ]
        self.agency_freq_map_: dict = {}
        self.state_keep_: list = [
            "KERALA", "RAJASTHAN", "GUJARAT", "NAGALAND", "CHHATISGARH",
            "PUNJAB", "ASSAM", "MAHARASHTRA", "UTTAR PRADESH", "HIMACHAL PRADESH",
            "ODISHA", "MADHYA PRADESH", "JHARKHAND", "TAMIL NADU", "DELHI",
            "UTTARAKHAND", "HARYANA", "WEST BENGAL", "MANIPUR",
            "JAMMU AND KASHMIR", "TRIPURA", "ARUNACHAL PRADESH", "KARNATAKA",
            "ANDHRA PRADESH", "SIKKIM", "MIZORAM", "MISSING", "TELANGANA",
            "BIHAR", "MULTI STATE",
        ]
        self.state_freq_map_: dict = {}

    # ── sklearn interface ──────────────────────────────────────────────────────

    def fit(self, X: pd.DataFrame, y=None):
        """Fit is a no-op — state is restored from pickle or set in __init__."""
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        """
        Transform raw project records into the model's expected feature matrix.

        Expected input columns (from the normalised dataset):
          project_name, agency, state,
          date_of_approval, original_target_completion, revised_completion,
          original_cost, revised_cost, cumulative_expenditure,
          physical_progress, edition
        """
        if isinstance(X, pd.Series):
            X = X.to_frame().T

        rows = []
        for _, row in X.iterrows():
            rows.append(self._transform_row(row))

        result = pd.DataFrame(rows, columns=OUTPUT_FEATURE_NAMES)
        return result.values

    def get_feature_names_out(self, input_features=None):
        return np.array(OUTPUT_FEATURE_NAMES)

    # ── Per-row feature computation ────────────────────────────────────────────

    def _transform_row(self, row: pd.Series) -> list:
        # ── Schedule features ──────────────────────────────────────────────────
        doa = _to_date(row.get("date_of_approval"))
        orig_comp = _to_date(row.get("original_target_completion"))
        rev_comp = _to_date(row.get("revised_completion"))

        # Edition date as proxy for 'snapshot date'
        edition = row.get("edition")
        snapshot_date = _parse_edition(edition)

        planned_duration_months = _months_between(doa, orig_comp)
        snapshot_elapsed_months = _months_between(doa, snapshot_date)
        schedule_progress_ratio = _safe_div(
            snapshot_elapsed_months, planned_duration_months
        )
        # Clip to [-3, 3] as stored in schedule_ratio_clip
        lo, hi = self.schedule_ratio_clip
        if schedule_progress_ratio is not None:
            schedule_progress_ratio = float(np.clip(schedule_progress_ratio, lo, hi))

        # ── Cost / expenditure features ────────────────────────────────────────
        original_cost = _to_float(row.get("original_cost"))
        cumulative_expenditure = _to_float(row.get("cumulative_expenditure"))

        cost_burn_ratio = _safe_div(cumulative_expenditure, original_cost)

        # ── Physical progress ──────────────────────────────────────────────────
        physical_progress = _to_float(row.get("physical_progress"))
        # Normalise 0-100 → 0-1
        if physical_progress is not None and physical_progress > 1.0:
            physical_progress_01 = physical_progress / 100.0
        else:
            physical_progress_01 = physical_progress

        # Discrepancy: expenditure ratio vs physical progress
        progress_spend_discrepancy = (
            cost_burn_ratio - physical_progress_01
            if cost_burn_ratio is not None and physical_progress_01 is not None
            else None
        )

        # Time discrepancy: schedule_progress_ratio vs physical progress
        progress_time_discrepancy = (
            schedule_progress_ratio - physical_progress_01
            if schedule_progress_ratio is not None and physical_progress_01 is not None
            else None
        )

        # ── Edition year/month ─────────────────────────────────────────────────
        edition_year, edition_month = _parse_edition_ym(edition)

        # ── Project name features ──────────────────────────────────────────────
        project_name = str(row.get("project_name", "") or "")
        project_name_length = len(project_name)
        project_name_word_count = len(project_name.split())

        # ── Keyword indicator features ─────────────────────────────────────────
        name_lower = project_name.lower()
        kw_feats = [
            int(any(kw in name_lower for kw in keywords))
            for keywords in _KEYWORD_COLS.values()
        ]

        # ── Agency / state frequency encoding ─────────────────────────────────
        agency = str(row.get("agency", "") or "MISSING").strip().upper()
        if not agency:
            agency = "MISSING"
        if agency not in self.agency_keep_:
            agency = "OTHER"
        agency_freq = self.agency_freq_map_.get(agency, 0.0)

        state = str(row.get("state", "") or "MISSING").strip().upper()
        if not state:
            state = "MISSING"
        if state not in self.state_keep_:
            state = "OTHER"
        state_freq = self.state_freq_map_.get(state, 0.0)

        return [
            planned_duration_months,
            snapshot_elapsed_months,
            schedule_progress_ratio,
            original_cost,
            cumulative_expenditure,
            cost_burn_ratio,
            physical_progress_01,
            progress_spend_discrepancy,
            progress_time_discrepancy,
            edition_year,
            edition_month,
            project_name_length,
            project_name_word_count,
            *kw_feats,          # 8 keyword features
            agency_freq,
            state_freq,
        ]

    # ── Pickle compatibility ───────────────────────────────────────────────────
    def __setstate__(self, state: dict):
        """Called by pickle.load — restore all attributes from stored state."""
        self.__dict__.update(state)

    def __getstate__(self) -> dict:
        return self.__dict__


# ── Helper utilities ───────────────────────────────────────────────────────────

def _to_float(val) -> Optional[float]:
    try:
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return None
        return float(val)
    except Exception:
        return None


def _to_date(val) -> Optional[Any]:
    if val is None:
        return None
    try:
        return pd.to_datetime(val, dayfirst=True, errors="coerce")
    except Exception:
        return None


def _months_between(start, end) -> Optional[float]:
    """Compute fractional months between two dates."""
    if start is None or end is None:
        return None
    try:
        if pd.isna(start) or pd.isna(end):
            return None
        delta = end - start
        return delta.days / 30.4375
    except Exception:
        return None


def _safe_div(num, den) -> Optional[float]:
    if num is None or den is None:
        return None
    try:
        if den == 0:
            return None
        return float(num) / float(den)
    except Exception:
        return None


def _parse_edition(edition) -> Optional[Any]:
    """
    Parse the edition field (e.g., 'March 2023', '3/2023', 2023.03)
    to a datetime for use as the snapshot date.
    """
    if edition is None:
        return None
    try:
        return pd.to_datetime(str(edition), dayfirst=True, errors="coerce")
    except Exception:
        return None


def _parse_edition_ym(edition) -> tuple:
    """Return (year, month) integers from edition field."""
    dt = _parse_edition(edition)
    if dt is None or (hasattr(dt, "isnull") and dt.isnull()):
        return (None, None)
    try:
        if pd.isna(dt):
            return (None, None)
        return (int(dt.year), int(dt.month))
    except Exception:
        return (None, None)
