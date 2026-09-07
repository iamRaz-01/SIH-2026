"""
backend/services/coordinator_service.py

InfraGuard AI — Coordinator Agent Service
Unified natural language question-answering and analysis coordinator across:
1. Portfolio Analytics & Ranking (highest risk, anomalies, budget variance, sector breakdown)
2. Single Project Deep Analysis (ML prediction, risk factors, schedule, anomalies, historical trend)
3. Web Intelligence Evidence Search (news, disputes, external factors)

Supports:
- Intent classification (keyword-based fallback + optional Groq LLM)
- Project identity resolution (fuzzy token matching on names and direct code/id matching)
- Synthesis with deterministic facts & optional LLM narrative
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional
import pandas as pd

from config import get_settings
from services import dataset_service, risk_service, anomaly_service
from services.llm.groq_client import generate_text

logger = logging.getLogger(__name__)

# Stopwords to filter generic infrastructure terms from project titles
_STOPWORDS = {
    "the", "of", "and", "for", "in", "at", "to", "is", "this", "that", "what",
    "who", "when", "where", "why", "how", "on", "with", "by", "an", "a",
    "power", "project", "projects", "system", "systems", "transmission",
    "integration", "limited", "scheme", "name", "spv", "augmentation",
    "development", "station", "generating", "capacity", "phase", "part",
    "strengthening", "evacuation", "corporation", "india", "grid", "line",
    "package", "construction", "works", "work", "section", "corridor", "stage",
}
_TOKEN_RE = re.compile(r"[a-z0-9]+")

def _distinctive_tokens(text: str) -> set[str]:
    return {t for t in _TOKEN_RE.findall(text.lower()) if len(t) > 2 and t not in _STOPWORDS}

def resolve_project(query: str, explicit_project_id: Optional[str] = None) -> Optional[dict]:
    """Resolve a project row from explicit ID or by matching names in the query."""
    if explicit_project_id:
        row = dataset_service.get_project_by_id(explicit_project_id)
        if row is None:
            row = dataset_service.get_project_by_code(explicit_project_id)
        if row is not None:
            return row.to_dict()

    # Direct match with code or project_id in text
    words = query.strip().split()
    for w in words:
        clean_w = w.strip("#,.;:()[]")
        row = dataset_service.get_project_by_code(clean_w)
        if row is not None:
            return row.to_dict()
        row = dataset_service.get_project_by_id(clean_w)
        if row is not None:
            return row.to_dict()

    # Search by token overlap with project names in dataset
    query_tokens = _distinctive_tokens(query)
    if len(query_tokens) < 1:
        return None

    df = dataset_service.get_dataset()
    best_match = None
    best_score = 0.0

    # Test top candidates
    for _, r in df[["project_id", "project_name", "project_code_str"]].drop_duplicates("project_id").iterrows():
        p_name = str(r["project_name"])
        name_tokens = _distinctive_tokens(p_name)
        if not name_tokens:
            continue
        overlap = len(query_tokens & name_tokens)
        if overlap > 0:
            score = overlap / (len(name_tokens) ** 0.6)
            if score > best_score and score >= 0.5:
                best_score = score
                best_match = r["project_id"]

    if best_match:
        matched_row = dataset_service.get_project_by_id(best_match)
        if matched_row is not None:
            return matched_row.to_dict()

    return None

def answer_portfolio_query(query: str) -> str:
    """Answer questions regarding portfolio risk, high-risk projects, anomalies, or KPIs."""
    df = dataset_service.get_dataset()
    total_projects = len(df)
    unique_projects = df["project_id"].nunique() if "project_id" in df.columns else total_projects

    # Get High-Risk Projects
    high_risk_df = df[df["cost_overrun_ratio"] > 0.30].copy() if "cost_overrun_ratio" in df.columns else pd.DataFrame()
    high_risk_count = len(high_risk_df)
    high_risk_pct = round((high_risk_count / max(total_projects, 1)) * 100, 1)

    # Anomalies
    anom_status = anomaly_service.anomaly_status()
    flagged_anomalies = anom_status.get("flagged_count", 0)

    q_lower = query.lower()

    # If asking for high risk list or ranking
    if any(k in q_lower for k in ["highest risk", "top risk", "high risk projects", "which projects", "critical projects"]):
        # Rank by cost_overrun_ratio descending + time overrun
        ranked = df.sort_values(by=["cost_overrun_ratio", "time_overrun_months"], ascending=[False, False])
        top_items = ranked.drop_duplicates("project_id").head(5)

        lines = [
            f"Here are the highest-risk projects across the portfolio (out of **{unique_projects:,}** monitored projects):\n"
        ]
        for idx, (_, row) in enumerate(top_items.iterrows(), start=1):
            name = row.get("project_name", "Unknown")
            code = str(row.get("project_code", "")).replace(".0", "")
            cov = row.get("cost_overrun_pct", 0) or 0
            time_o = row.get("time_overrun_months", 0) or 0
            agency = row.get("agency", "")
            cost_r = row.get("revised_cost") or row.get("original_cost") or 0

            lines.append(
                f"**{idx}. {name}** (`{code}`)\n"
                f"• Implementing Agency: {agency}\n"
                f"• Cost Overrun: **+{cov:.1f}%** (Capital: ₹{cost_r:,.1f} Cr)\n"
                f"• Time Overrun: **{time_o:.0f} months**\n"
            )

        lines.append(
            f"**Portfolio Summary Insight:**\n"
            f"• Total High-Risk Projects (>30% overrun): **{high_risk_count:,} ({high_risk_pct}%)**\n"
            f"• Statistically Anomalous Projects: **{flagged_anomalies:,}**\n\n"
            f"💡 *Tip: Click on any project or ask me about a specific project name to see root-cause diagnostics and web intelligence.*"
        )
        return "\n".join(lines)

    # If asking about anomalies specifically
    if "anomal" in q_lower:
        anom_res = anomaly_service.get_anomalies(page_size=5, severity="CRITICAL")
        projects_list = anom_res.get("projects", [])
        lines = [
            f"**Portfolio Anomaly Intelligence:**\n"
            f"Isolation Forest has detected **{flagged_anomalies}** projects with abnormal telemetry (severe expenditure/progress divergence or irregular revision cycles).\n\n"
            f"**Top Critical Anomalies:**\n"
        ]
        for p in projects_list[:5]:
            lines.append(
                f"• **{p.get('project_name')}** (Score: {p.get('anomaly_score', 0):.3f})\n"
                f"  Reason: {p.get('anomaly_explanation', 'Unusual expenditure progress pattern')}"
            )
        return "\n".join(lines)

    # General overview or summary
    return (
        f"**Portfolio Telemetry Briefing:**\n\n"
        f"• **Total Tracked Projects:** {total_projects:,} ({unique_projects:,} unique projects)\n"
        f"• **High-Risk Projects:** {high_risk_count:,} ({high_risk_pct}% exceeding 30% cost growth)\n"
        f"• **Anomalous Projects Detected:** {flagged_anomalies:,} flagged by Isolation Forest\n\n"
        f"You can ask me to:\n"
        f"1. *'Which projects are at highest risk?'*\n"
        f"2. *'Show anomalous projects in Maharashtra or Railways'*\n"
        f"3. Ask about any specific project (e.g. *'Analyze Mumbai BRTS'* or *'Status of Project 701107'*)"
    )

def answer_project_query(project_data: dict, query: str) -> str:
    """Perform single-project deep risk diagnosis, ML prediction, and narrative response."""
    p_name = project_data.get("project_name", "Unknown")
    p_code = str(project_data.get("project_code", "")).replace(".0", "") or project_data.get("project_id", "")
    agency = project_data.get("agency", "Unknown")
    state = project_data.get("state", "India")
    orig_cost = project_data.get("original_cost") or 0.0
    rev_cost = project_data.get("revised_cost") or orig_cost
    phys_prog = project_data.get("physical_progress") or 0.0

    # Risk evaluation
    risk_eval = risk_service.evaluate_project_risk(project_data)
    ml_output = risk_eval.get("model_output", {})
    overall_risk = risk_eval.get("overall_risk", {})
    derived = risk_eval.get("derived_analytics", {})

    ml_prob = ml_output.get("cost_overrun_probability")
    ml_prob_pct = f"{ml_prob * 100:.1f}%" if ml_prob is not None else "N/A"
    risk_level = ml_output.get("risk_level", "NORMAL")

    cost_cov = derived.get("cost_risk", {}).get("cost_overrun_pct", 0) or 0
    time_over = derived.get("schedule_risk", {}).get("time_overrun_months", 0) or 0
    anomaly_status = derived.get("anomaly_status", {})
    is_anom = anomaly_status.get("is_anomaly", False)

    # Optional LLM enhancement if Groq API key is present
    settings = get_settings()
    if settings.groq_api_key:
        try:
            sys_inst = (
                "You are ARIA (AI Risk & Intelligence Assistant) for MoSPI/PAIMANA infrastructure monitoring. "
                "Answer the user's question directly, factually, and concisely using the provided telemetry. "
                "Highlight risk level, cost & schedule overrun, and key recommendations."
            )
            context_data = f"""
Project: {p_name} (Code: {p_code})
Agency: {agency}, State: {state}
Original Sanction: ₹{orig_cost:.1f} Cr, Revised Cost: ₹{rev_cost:.1f} Cr (+{cost_cov:.1f}% overrun)
Physical Progress: {phys_prog:.1f}%
Time Overrun: {time_over:.1f} months
ML Model Overrun Probability: {ml_prob_pct} (Classification: {risk_level})
Overall Composite Score: {overall_risk.get('score', 'N/A')}/100 ({overall_risk.get('level', 'NORMAL')})
Anomaly Detected: {'YES - ' + anomaly_status.get('explanation', '') if is_anom else 'NO'}
User Question: {query}
"""
            llm_text = generate_text(
                api_key=settings.groq_api_key,
                model=settings.groq_model,
                system_instruction=sys_inst,
                contents=context_data,
                temperature=0.2,
            )
            if llm_text:
                return llm_text
        except Exception as exc:
            logger.warning("Groq generation failed, using structured response: %s", exc)

    # Structured deterministic response
    lines = [
        f"**Project Intelligence: {p_name}** (`{p_code}`)\n",
        f"• **Executing Agency:** {agency} ({state})",
        f"• **Overall Risk Assessment:** **{overall_risk.get('level', 'NORMAL')}** (Composite Score: {overall_risk.get('score', 0)}/100)",
        f"• **ML Cost Overrun Probability:** **{ml_prob_pct}** (Model Tier: {risk_level})",
        f"• **Cost Telemetry:** ₹{orig_cost:.1f} Cr original → ₹{rev_cost:.1f} Cr revised (**+{cost_cov:.1f}%** variance)",
        f"• **Schedule Outlook:** Physical progress is at **{phys_prog:.1f}%** with **{time_over:.1f} months** time delay.",
    ]

    if is_anom:
        lines.append(f"• ⚠️ **Anomaly Flagged:** {anomaly_status.get('explanation', 'Irregular physical progress relative to expenditure.')}")

    lines.append("\n**Recommended Monitoring Directives:**")
    if risk_level in ["HIGH", "CRITICAL"] or cost_cov > 20:
        lines.append("• Prioritize quarterly milestone audit with executing agency.")
        lines.append("• Review land acquisition or contractor dispute bottlenecks.")
    else:
        lines.append("• Maintain standard monthly telemetry review.")

    return "\n".join(lines)

def coordinate_analysis(query: str, project_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Main entry point for ARIA query analysis.
    Resolves whether the query is portfolio-wide or targeting a specific project,
    and returns a structured response matching AnalysisResponse.
    """
    query_clean = query.strip()

    # 1. Resolve project if provided or referenced in query
    project_row = resolve_project(query_clean, explicit_project_id=project_id)

    # If no project resolved, or query is explicitly portfolio-oriented:
    is_portfolio_intent = any(
        term in query_clean.lower()
        for term in ["portfolio", "highest risk", "all projects", "which projects", "overall", "top concerns", "anomalies in"]
    )

    if project_row is None or (is_portfolio_intent and not project_id):
        answer_text = answer_portfolio_query(query_clean)
        return {
            "query": query_clean,
            "project_id": None,
            "project_name": None,
            "intent": "PORTFOLIO_ANALYSIS",
            "text": answer_text,
            "report": {
                "executive_summary": answer_text,
                "top_risk_drivers": [],
                "recommended_monitoring_actions": [],
            },
            "evidence": [],
            "status": "success",
        }

    # 2. Answer for the resolved project
    p_id = str(project_row.get("project_id", ""))
    p_name = str(project_row.get("project_name", ""))
    answer_text = answer_project_query(project_row, query_clean)

    return {
        "query": query_clean,
        "project_id": p_id,
        "project_name": p_name,
        "intent": "PROJECT_ANALYSIS",
        "text": answer_text,
        "report": {
            "executive_summary": answer_text,
            "top_risk_drivers": [],
            "recommended_monitoring_actions": [],
        },
        "evidence": [],
        "status": "success",
    }
