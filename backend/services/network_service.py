"""
backend/services/network_service.py

InfraGuard AI — Project Network Graph Service

Constructs an interactive co-dependency graph where projects are nodes and edges
represent authentic shared dataset attributes (same agency, same state, similar scale).
No fabricated links.
"""

from __future__ import annotations

import logging
import math
from itertools import combinations
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

_network_data: Optional[dict] = None
_network_error: Optional[str] = None


def build_network(df: pd.DataFrame, sample_size: int = 400) -> None:
    """
    Build the project network graph from authentic dataset relationships.
    """
    global _network_data, _network_error

    try:
        if len(df) == 0:
            _network_error = "Empty dataset"
            return

        if "project_code_str" in df.columns and df["project_code_str"].duplicated().any():
            if "edition_dt" in df.columns:
                df = df.sort_values("edition_dt").groupby("project_code_str", as_index=False).last()
            else:
                df = df.groupby("project_code_str", as_index=False).last()

        # Choose diverse projects across states, agencies, and high-impact works
        # Sort by cost or take first N unique projects
        sample_df = df.head(sample_size).copy()

        nodes = _build_nodes(sample_df)
        edges = _build_edges(sample_df, max_edges=600)

        # Compute degree count
        degree: dict[str, int] = {}
        for edge in edges:
            degree[edge["source"]] = degree.get(edge["source"], 0) + 1
            degree[edge["target"]] = degree.get(edge["target"], 0) + 1

        for node in nodes:
            node["degree"] = degree.get(node["id"], 0)

        # Top hub projects (highest degree connectivity)
        hub_ids = sorted(degree, key=degree.get, reverse=True)[:10]

        _network_data = {
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "total_nodes": len(nodes),
                "total_edges": len(edges),
                "hub_projects": hub_ids,
                "avg_degree": round(
                    sum(degree.values()) / max(len(degree), 1), 2
                ),
            },
        }
        _network_error = None
        logger.info(
            "Project network built: %d nodes, %d edges", len(nodes), len(edges)
        )
    except Exception as exc:
        _network_error = str(exc)
        logger.error("Network build failed: %s", exc)


def _build_nodes(df: pd.DataFrame) -> list[dict]:
    nodes = []
    for _, row in df.iterrows():
        cov_pct = _safe_float(row.get("cost_overrun_pct"))
        if cov_pct is None and row.get("cost_overrun_ratio") is not None:
            cov_pct = _safe_float(row.get("cost_overrun_ratio") * 100)

        t_over_mo = _safe_float(row.get("time_overrun_months"))
        plan_dur = _safe_float(row.get("planned_duration_months"))
        time_overrun_pct = None
        if t_over_mo is not None and plan_dur is not None and plan_dur > 0:
            time_overrun_pct = _safe_float((t_over_mo / plan_dur) * 100, 1)

        p_name = str(row.get("project_name", "Unknown Project"))
        p_code = str(row.get("project_code", "")).replace(".0", "") or str(row.get("project_id", ""))
        is_anom = int(row.get("is_anomaly", 0))

        nodes.append({
            "id": str(row.get("project_id", "")),
            "project_code": p_code,
            "project_name": p_name,
            "label": p_name[:45] + ("…" if len(p_name) > 45 else ""),
            "agency": str(row.get("agency", "")),
            "state": str(row.get("state", "")),
            "original_cost": _safe_float(row.get("original_cost")),
            "revised_cost": _safe_float(row.get("revised_cost")),
            "cumulative_expenditure": _safe_float(row.get("cumulative_expenditure")),
            "physical_progress": _safe_float(row.get("physical_progress")),
            "cost_overrun_pct": cov_pct,
            "time_overrun_months": t_over_mo,
            "time_overrun_pct": time_overrun_pct,
            "is_anomaly": is_anom,
            "anomaly_status": "ANOMALOUS" if is_anom == 1 else "NORMAL",
            "risk_class": _cost_risk_class(row.get("cost_overrun_ratio")),
        })
    return nodes


def _build_edges(df: pd.DataFrame, max_edges: int = 600) -> list[dict]:
    """
    Construct genuine relationship edges based on shared dataset attributes:
      - Same Agency
      - Same State
      - Similar Capital Scale
    """
    edges = []
    ids = df["project_id"].tolist()
    agencies = df.set_index("project_id")["agency"].to_dict() if "agency" in df.columns else {}
    states = df.set_index("project_id")["state"].to_dict() if "state" in df.columns else {}
    costs = df.set_index("project_id")["original_cost"].to_dict() if "original_cost" in df.columns else {}

    for id_a, id_b in combinations(ids, 2):
        if len(edges) >= max_edges:
            break

        reasons = []
        weight = 0.0

        # Same agency
        a_agency = agencies.get(id_a)
        b_agency = agencies.get(id_b)
        if (
            a_agency and b_agency
            and a_agency == b_agency
            and str(a_agency).strip()
            and str(a_agency).upper() not in ("MISSING", "NAN", "NONE")
        ):
            reasons.append("Same Agency")
            weight += 1.0

        # Same state
        a_state = states.get(id_a)
        b_state = states.get(id_b)
        if (
            a_state and b_state
            and a_state == b_state
            and str(a_state).strip()
            and str(a_state).upper() not in ("MISSING", "NAN", "NONE")
        ):
            reasons.append("Same State")
            weight += 0.8

        # Similar sanctioned capital scale (within ±25%)
        a_cost = costs.get(id_a)
        b_cost = costs.get(id_b)
        if (
            a_cost is not None and b_cost is not None
            and not pd.isna(a_cost) and not pd.isna(b_cost)
            and a_cost > 0 and b_cost > 0
        ):
            ratio = min(a_cost, b_cost) / max(a_cost, b_cost)
            if ratio >= 0.75:
                reasons.append("Similar Project Scale")
                weight += 0.5

        # Only connect nodes that share at least 2 common operational factors or strong agency link
        if (len(reasons) >= 2) or ("Same Agency" in reasons and weight >= 1.0):
            edges.append({
                "source": str(id_a),
                "target": str(id_b),
                "weight": round(weight, 2),
                "reasons": reasons,
            })

    return edges


def _safe_float(val, decimals: int = 2) -> Optional[float]:
    try:
        if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
            return None
        return round(float(val), decimals)
    except Exception:
        return None


def _cost_risk_class(ratio) -> str:
    try:
        r = float(ratio)
        if r >= 0.30:
            return "High"
        if r >= 0.10:
            return "Medium"
        return "Low"
    except Exception:
        return "Low"


def get_network(max_nodes: int = 250) -> dict:
    """Return the network graph trimmed to top N connected nodes."""
    if _network_data is None:
        return {"nodes": [], "edges": [], "stats": {}, "error": _network_error}

    data = _network_data
    if len(data["nodes"]) > max_nodes:
        sorted_nodes = sorted(data["nodes"], key=lambda n: n.get("degree", 0), reverse=True)
        top_nodes = sorted_nodes[:max_nodes]
        top_node_ids = {n["id"] for n in top_nodes}
        filtered_edges = [
            e for e in data["edges"]
            if e["source"] in top_node_ids and e["target"] in top_node_ids
        ]
        return {
            "nodes": top_nodes,
            "edges": filtered_edges,
            "stats": data["stats"],
            "trimmed_to": max_nodes,
        }

    return data


def network_status() -> dict:
    return {
        "built": _network_data is not None,
        "total_nodes": _network_data["stats"]["total_nodes"] if _network_data else 0,
        "total_edges": _network_data["stats"]["total_edges"] if _network_data else 0,
        "error": _network_error,
    }
