"""
backend/pipeline/feature_engineering.py

Reusable feature engineering suite and sklearn FeatureEngineer transformer
used for PAIMANA infrastructure project risk monitoring and LightGBM model inference.

Features engineered:
  1. Cost Overrun %: (revised_cost - original_cost) / original_cost * 100
  2. Cost Growth: revised_cost - original_cost
  3. Expenditure Ratio: cumulative_expenditure / original_cost
  4. Time Overrun: difference between revised completion date and original/target completion date (months/days)
  5. Project Age: elapsed time between Date of Approval (DOA) and report/snapshot date (months)
  6. Physical Progress: normalized ratio [0, 1] or percentage
  7. Progress-related indicators:
     - progress_spend_discrepancy: expenditure_ratio - physical_progress_ratio
     - progress_time_discrepancy: schedule_progress_ratio - physical_progress_ratio
     - cost_burn_ratio: cumulative_expenditure / original_cost

Handles:
  - Missing values
  - Zero / negative cost
  - Invalid / corrupt dates
  - NaN and infinite values
"""

from __future__ import annotations

import math
import re
from datetime import datetime
from typing import Any, Optional, Union

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin


# ── Reusable Standalone Feature Engineering Functions ─────────────────────────

def calc_cost_overrun_percentage(
    revised_cost: Optional[float],
    original_cost: Optional[float],
) -> Optional[float]:
    """
    Calculate Cost Overrun %: ((revised_cost - original_cost) / original_cost) * 100
    Returns None if inputs are invalid or original_cost <= 0.
    """
    rev = _safe_float(revised_cost)
    orig = _safe_float(original_cost)
    if rev is None or orig is None or orig <= 0:
        return None
    res = ((rev - orig) / orig) * 100.0
    return round(float(res), 4) if not math.isnan(res) and not math.isinf(res) else None


def calc_cost_growth(
    revised_cost: Optional[float],
    original_cost: Optional[float],
) -> Optional[float]:
    """
    Calculate absolute Cost Growth in ₹ Crore: revised_cost - original_cost
    """
    rev = _safe_float(revised_cost)
    orig = _safe_float(original_cost)
    if rev is None or orig is None:
        return None
    res = rev - orig
    return round(float(res), 4) if not math.isnan(res) and not math.isinf(res) else None


def calc_expenditure_ratio(
    cumulative_expenditure: Optional[float],
    cost_basis: Optional[float],
) -> Optional[float]:
    """
    Calculate Expenditure Ratio: cumulative_expenditure / cost_basis (original or revised cost).
    """
    exp = _safe_float(cumulative_expenditure)
    cost = _safe_float(cost_basis)
    if exp is None or cost is None or cost <= 0:
        return None
    res = exp / cost
    return round(float(res), 4) if not math.isnan(res) and not math.isinf(res) else None


def calc_time_overrun_months(
    revised_completion: Optional[Any],
    original_target_completion: Optional[Any],
) -> Optional[float]:
    """
    Calculate Time Overrun in fractional months:
      (revised_completion - original_target_completion) in months.
    Positive value indicates schedule delay/overrun.
    """
    rev_dt = _to_date(revised_completion)
    orig_dt = _to_date(original_target_completion)
    return _months_between(orig_dt, rev_dt)


def calc_project_age_months(
    date_of_approval: Optional[Any],
    snapshot_date: Optional[Any] = None,
) -> Optional[float]:
    """
    Calculate Project Age in elapsed months from Date of Approval (DOA) to snapshot date.
    If snapshot_date is None, current date is used.
    """
    doa_dt = _to_date(date_of_approval)
    if doa_dt is None:
        return None
    snap_dt = _to_date(snapshot_date) if snapshot_date is not None else pd.Timestamp.now()
    return _months_between(doa_dt, snap_dt)


def calc_planned_duration_months(
    date_of_approval: Optional[Any],
    original_target_completion: Optional[Any],
) -> Optional[float]:
    """
    Calculate Planned Duration in months:
      (original_target_completion - date_of_approval) in months.
    """
    doa_dt = _to_date(date_of_approval)
    orig_dt = _to_date(original_target_completion)
    return _months_between(doa_dt, orig_dt)


def calc_physical_progress_ratio(
    physical_progress: Optional[Union[float, int, str]],
) -> Optional[float]:
    """
    Normalize physical progress to a [0.0, 1.0] scale.
    Handles both 0-100 percentage input and 0-1 ratio input.
    """
    prog = _safe_float(physical_progress)
    if prog is None:
        return None
    # If progress > 1.0, assume 0-100 scale
    if prog > 1.0:
        ratio = prog / 100.0
    elif prog < 0:
        ratio = 0.0
    else:
        ratio = prog
    return round(float(np.clip(ratio, 0.0, 1.5)), 4)


def calc_progress_spend_discrepancy(
    expenditure_ratio: Optional[float],
    physical_progress_ratio: Optional[float],
) -> Optional[float]:
    """
    Calculate Progress-Spend Discrepancy: expenditure_ratio - physical_progress_ratio.
    Positive value indicates expenditure is racing ahead of physical completion.
    """
    exp_r = _safe_float(expenditure_ratio)
    prog_r = _safe_float(physical_progress_ratio)
    if exp_r is None or prog_r is None:
        return None
    res = exp_r - prog_r
    return round(float(res), 4) if not math.isnan(res) and not math.isinf(res) else None


def calc_progress_time_discrepancy(
    schedule_progress_ratio: Optional[float],
    physical_progress_ratio: Optional[float],
) -> Optional[float]:
    """
    Calculate Progress-Time Discrepancy: schedule_progress_ratio - physical_progress_ratio.
    Positive value indicates elapsed time is advancing faster than physical work.
    """
    sched_r = _safe_float(schedule_progress_ratio)
    prog_r = _safe_float(physical_progress_ratio)
    if sched_r is None or prog_r is None:
        return None
    res = sched_r - prog_r
    return round(float(res), 4) if not math.isnan(res) and not math.isinf(res) else None


def calc_all_features(data: dict) -> dict:
    """
    Calculate all reusable derived features for a single project record.
    Gracefully handles missing, NaN, zero, and infinite values.
    """
    orig_cost = _safe_float(data.get("original_cost"))
    rev_cost = _safe_float(data.get("revised_cost", orig_cost))
    cum_exp = _safe_float(data.get("cumulative_expenditure"))
    phys_prog = data.get("physical_progress")
    doa = data.get("doa", data.get("date_of_approval"))
    orig_comp = data.get("original_target_doa", data.get("original_target_completion"))
    rev_comp = data.get("revised_completion")
    edition = data.get("edition")

    # Core derivations
    cost_overrun_pct = calc_cost_overrun_percentage(rev_cost, orig_cost)
    cost_growth = calc_cost_growth(rev_cost, orig_cost)
    cost_overrun_ratio = (cost_overrun_pct / 100.0) if cost_overrun_pct is not None else None
    exp_ratio_orig = calc_expenditure_ratio(cum_exp, orig_cost)
    exp_ratio_rev = calc_expenditure_ratio(cum_exp, rev_cost) if rev_cost else exp_ratio_orig
    time_overrun_m = calc_time_overrun_months(rev_comp, orig_comp)
    planned_duration_m = calc_planned_duration_months(doa, orig_comp)
    project_age_m = calc_project_age_months(doa, edition)
    phys_prog_ratio = calc_physical_progress_ratio(phys_prog)

    # Schedule ratio: age / planned_duration
    sched_prog_ratio = None
    if project_age_m is not None and planned_duration_m is not None and planned_duration_m > 0:
        sched_prog_ratio = round(float(np.clip(project_age_m / planned_duration_m, -1.0, 3.0)), 4)

    prog_spend_disc = calc_progress_spend_discrepancy(exp_ratio_orig, phys_prog_ratio)
    prog_time_disc = calc_progress_time_discrepancy(sched_prog_ratio, phys_prog_ratio)

    return {
        "cost_overrun_pct": cost_overrun_pct,
        "cost_growth": cost_growth,
        "cost_overrun_ratio": cost_overrun_ratio,
        "expenditure_ratio": exp_ratio_orig,
        "expenditure_ratio_revised": exp_ratio_rev,
        "time_overrun_months": time_overrun_m,
        "planned_duration_months": planned_duration_m,
        "project_age_months": project_age_m,
        "physical_progress_ratio": phys_prog_ratio,
        "schedule_progress_ratio": sched_prog_ratio,
        "progress_spend_discrepancy": prog_spend_disc,
        "progress_time_discrepancy": prog_time_disc,
    }


# ── Transformer Implementation for LightGBM Pipeline Compatibility ────────────

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
    Custom sklearn-compatible transformer that converts raw project records
    into the 23-feature matrix expected by the downstream LightGBM model.
    """

    def __init__(
        self,
        rare_threshold: float = 0.01,
        schedule_ratio_clip: tuple = (-1.0, 3.0),
    ):
        self.rare_threshold = rare_threshold
        self.schedule_ratio_clip = schedule_ratio_clip

        self.agency_keep_: list = [
            "CPWD", "WR", "MORTH", "GAIL", "WCL", "ECR", "HPCL", "NHIDCL",
            "NFR", "NHAI", "NTPC", "RVNL", "AAI", "IOCL", "ONGC", "SECL",
            "MISSING", "PGCIL",
        ]
        self.agency_freq_map_: dict = {
            "OTHER": 0.2507260604573158, "MORTH": 0.21364584611608786,
            "NHAI": 0.18861209964412812, "NHIDCL": 0.10747740008999059,
            "IOCL": 0.041927434859082915, "MISSING": 0.02059557409907146,
            "PGCIL": 0.0196956681801448, "NTPC": 0.017036855237861498,
            "ECR": 0.01625966376242484, "RVNL": 0.01593242524645151,
            "SECL": 0.014766638033296519, "AAI": 0.013580398412893198,
            "WCL": 0.013519041191148199, "CPWD": 0.012128277498261545,
            "GAIL": 0.011596514909804885, "NFR": 0.010778418619871558,
            "WR": 0.010676156583629894, "ONGC": 0.010635251769133228,
            "HPCL": 0.010410275289401562
        }
        self.state_keep_: list = [
            "KERALA", "RAJASTHAN", "GUJARAT", "NAGALAND", "CHHATISGARH",
            "PUNJAB", "ASSAM", "MAHARASHTRA", "UTTAR PRADESH", "HIMACHAL PRADESH",
            "ODISHA", "MADHYA PRADESH", "JHARKHAND", "TAMIL NADU", "DELHI",
            "UTTARAKHAND", "HARYANA", "WEST BENGAL", "MANIPUR",
            "JAMMU AND KASHMIR", "TRIPURA", "ARUNACHAL PRADESH", "KARNATAKA",
            "ANDHRA PRADESH", "SIKKIM", "MIZORAM", "MISSING", "TELANGANA",
            "BIHAR", "MULTI STATE",
        ]
        self.state_freq_map_: dict = {
            "MAHARASHTRA": 0.134699554137522, "UTTAR PRADESH": 0.06462960690473268,
            "MULTI STATE": 0.05873931361721275, "BIHAR": 0.05444430809506279,
            "ODISHA": 0.04884034850901951, "MADHYA PRADESH": 0.04429991409988956,
            "ANDHRA PRADESH": 0.04102752894015626, "WEST BENGAL": 0.0399435513559946,
            "TAMIL NADU": 0.0396981224690146, "GUJARAT": 0.03777559618767129,
            "OTHER": 0.03489180676565632, "KARNATAKA": 0.03386918640323966,
            "RAJASTHAN": 0.033316971407534667, "ASSAM": 0.029901419397063034,
            "JHARKHAND": 0.028592465333169715, "TELANGANA": 0.027958440708471387,
            "ARUNACHAL PRADESH": 0.022968053339878104, "CHHATISGARH": 0.021536384832494784,
            "MISSING": 0.020841002986051457, "NAGALAND": 0.020534216877326462,
            "HARYANA": 0.020227430768601465, "JAMMU AND KASHMIR": 0.01740499856833149,
            "UTTARAKHAND": 0.01732318893933816, "DELHI": 0.017302736532089826,
            "PUNJAB": 0.015441567472491513, "MANIPUR": 0.014848447662289852,
            "MIZORAM": 0.013171350267926535, "KERALA": 0.01261913527222154,
            "HIMACHAL PRADESH": 0.011576062502556552, "SIKKIM": 0.011085204728596556,
            "TRIPURA": 0.010492084918394895
        }

    def fit(self, X: pd.DataFrame, y=None):
        return self

    def transform(self, X: Union[pd.DataFrame, pd.Series, dict]) -> np.ndarray:
        if isinstance(X, dict):
            X = pd.DataFrame([X])
        elif isinstance(X, pd.Series):
            X = X.to_frame().T

        rows = []
        for _, row in X.iterrows():
            rows.append(self._transform_row(row))

        result = pd.DataFrame(rows, columns=OUTPUT_FEATURE_NAMES)
        return result.values

    def get_feature_names_out(self, input_features=None):
        return np.array(OUTPUT_FEATURE_NAMES)

    def _transform_row(self, row: pd.Series) -> list:
        # Schedule features
        doa = _to_date(row.get("doa", row.get("date_of_approval")))
        orig_comp = _to_date(row.get("original_target_doa", row.get("original_target_completion")))
        edition = row.get("edition")
        snapshot_date = _parse_edition(edition)

        planned_duration_months = _months_between(doa, orig_comp)
        snapshot_elapsed_months = _months_between(doa, snapshot_date)
        schedule_progress_ratio = _safe_div(snapshot_elapsed_months, planned_duration_months)

        lo, hi = self.schedule_ratio_clip
        if schedule_progress_ratio is not None:
            schedule_progress_ratio = float(np.clip(schedule_progress_ratio, lo, hi))

        # Cost / expenditure features
        original_cost = _safe_float(row.get("original_cost"))
        cumulative_expenditure = _safe_float(row.get("cumulative_expenditure"))
        cost_burn_ratio = _safe_div(cumulative_expenditure, original_cost)

        # Physical progress
        physical_progress = _safe_float(row.get("physical_progress"))
        if physical_progress is not None and physical_progress > 1.0:
            physical_progress_01 = physical_progress / 100.0
        else:
            physical_progress_01 = physical_progress

        progress_spend_discrepancy = (
            cost_burn_ratio - physical_progress_01
            if cost_burn_ratio is not None and physical_progress_01 is not None
            else None
        )

        progress_time_discrepancy = (
            schedule_progress_ratio - physical_progress_01
            if schedule_progress_ratio is not None and physical_progress_01 is not None
            else None
        )

        # Edition year/month
        edition_year, edition_month = _parse_edition_ym(edition)

        # Project name features
        project_name = str(row.get("project_name", "") or "")
        project_name_length = len(project_name)
        project_name_word_count = len(project_name.split())

        # Keyword features
        name_lower = project_name.lower()
        kw_feats = [
            int(any(kw in name_lower for kw in keywords))
            for keywords in _KEYWORD_COLS.values()
        ]

        # Agency / state frequency encoding
        agency = _extract_agency_key(row.get("agency"))
        if agency not in self.agency_keep_:
            agency = "OTHER"
        agency_freq = self.agency_freq_map_.get(agency, self.agency_freq_map_.get("OTHER", 0.0))

        state = _extract_state_key(row.get("state"))
        if state not in self.state_keep_:
            state = "OTHER"
        state_freq = self.state_freq_map_.get(state, self.state_freq_map_.get("OTHER", 0.0))

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
            *kw_feats,
            agency_freq,
            state_freq,
        ]

    def __setstate__(self, state: dict):
        self.__dict__.update(state)

    def __getstate__(self) -> dict:
        return self.__dict__


# ── Internal Helper Utilities ──────────────────────────────────────────────────

def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
            return None
        res = float(val)
        return None if math.isnan(res) or math.isinf(res) else res
    except Exception:
        return None


def _to_date(val) -> Optional[pd.Timestamp]:
    """
    Robust date parser supporting ISO strings (YYYY-MM-DD), Date objects,
    and Indian standard date formats (DD-MM-YYYY).
    """
    if val is None:
        return None
    if isinstance(val, (pd.Timestamp, datetime)):
        return pd.Timestamp(val)
    try:
        text = str(val).strip()
        if not text:
            return None
        # If ISO format (e.g. 2022-07-01 or 2022/07/01), parse without dayfirst
        if re.match(r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}", text):
            dt = pd.to_datetime(text, errors="coerce", dayfirst=False)
        else:
            dt = pd.to_datetime(text, errors="coerce", dayfirst=True)
        return None if pd.isna(dt) else dt
    except Exception:
        return None


def _months_between(start: Optional[pd.Timestamp], end: Optional[pd.Timestamp]) -> Optional[float]:
    if start is None or end is None:
        return None
    try:
        if pd.isna(start) or pd.isna(end):
            return None
        delta = end - start
        months = delta.days / 30.4375
        return round(float(months), 2)
    except Exception:
        return None


def _safe_div(num: Optional[float], den: Optional[float]) -> Optional[float]:
    if num is None or den is None:
        return None
    try:
        if den == 0:
            return None
        res = float(num) / float(den)
        return None if math.isnan(res) or math.isinf(res) else round(res, 4)
    except Exception:
        return None


def _parse_edition(edition: Any) -> Optional[pd.Timestamp]:
    if edition is None:
        return None
    return _to_date(edition)


def _parse_edition_ym(edition: Any) -> tuple[Optional[int], Optional[int]]:
    dt = _parse_edition(edition)
    if dt is None or pd.isna(dt):
        return (None, None)
    try:
        return (int(dt.year), int(dt.month))
    except Exception:
        return (None, None)


def _extract_agency_key(raw_agency: Any) -> str:
    """Extract clean agency uppercase token (handles 'Airport Authority of India [AAI]' -> 'AAI')."""
    if raw_agency is None or pd.isna(raw_agency):
        return "MISSING"
    text = str(raw_agency).strip()
    match = re.search(r"\[([A-Za-z0-9_\-]+)\]", text)
    if match:
        return match.group(1).upper()
    cleaned = text.upper()
    return cleaned if cleaned else "MISSING"


def _extract_state_key(raw_state: Any) -> str:
    """Extract uppercase clean state name."""
    if raw_state is None or pd.isna(raw_state):
        return "MISSING"
    text = str(raw_state).strip().upper()
    return text if text else "MISSING"
