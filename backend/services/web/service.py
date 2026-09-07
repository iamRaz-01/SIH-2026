"""Web Intelligence Agent — adapted for InfraGuard AI's dataset-based backend.

Workflow:
    Project Data (from dataset_service) -> Risk Context -> Query Planner ->
    Search (Tavily) -> Claim Extraction -> Date Verification ->
    Project Relevance -> Web Evidence Results

Graceful degradation: if Tavily is unavailable or TAVILY_API_KEY is not set,
returns an empty evidence list with triggered=False rather than blocking.
If the LLM is unavailable, claim extraction falls back to a deterministic
keyword-overlap approach.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone

from config import get_settings
from services import dataset_service, ml_service
from services.web import query_planner, trust
from services.web.claim_extraction import extract_claims
from services.web.date_verification import verify_date
from services.web.query_planner import PlannedQuery
from services.web.search_client import SearchResult, WebSearchUnavailableError, search_web
from services.web.trigger import TriggerDecision, should_trigger

DQ_CONCERNING_FIELDS = {"cost_overrun_pct", "time_overrun_months"}
CONCERNING_HEALTH_LEVELS = {"WATCH", "ELEVATED", "HIGH", "CRITICAL"}
MAX_RESULTS_PER_QUERY = 5


@dataclass(frozen=True)
class WebEvidenceItem:
    evidence_id: str
    topic: str
    source: str
    url: str
    title: str | None
    publication_date: str | None
    date_confidence: str
    finding: str
    project_relevance: float
    trust_tier: str
    source_quality: str


@dataclass(frozen=True)
class WebIntelligenceResult:
    project_id: str
    project_name: str
    triggered: bool
    trigger_reason: str
    topics_searched: list[str]
    evidence: list[WebEvidenceItem]
    warnings: list[str]
    searched_at: str


def _evidence_id(project_id: str, url: str, topic: str) -> str:
    """Content-addressed evidence ID: same project+topic+url always resolves to the same ID."""
    digest = hashlib.sha256(f"{project_id}:{topic}:{url}".encode()).hexdigest()[:16]
    return f"ev-{digest}"


def _driver_categories(
    overall_health: str | None,
    ml_risk_level: str | None,
    cost_overrun_pct: float | None,
    time_overrun_months: float | None,
) -> list[str]:
    """Determine which risk driver categories apply, to guide query planning."""
    categories: list[str] = []
    if ml_risk_level in {"HIGH", "CRITICAL"}:
        categories.append("HIGH_ML_RISK")
    if overall_health in CONCERNING_HEALTH_LEVELS:
        if cost_overrun_pct and cost_overrun_pct > 0.1:
            categories.append("EXPENDITURE_AHEAD")
        if time_overrun_months and time_overrun_months > 0:
            categories.append("SCHEDULE_BEHIND")
    return categories


def _run_query(
    project_data: dict,
    planned: PlannedQuery,
    settings,
) -> tuple[list[WebEvidenceItem], list[str]]:
    project_id = str(project_data.get("project_id", ""))
    project_name = str(project_data.get("project_name", ""))
    agency = project_data.get("agency")
    state = project_data.get("state")

    try:
        results: list[SearchResult] = search_web(
            planned.query_text, api_key=settings.tavily_api_key, max_results=MAX_RESULTS_PER_QUERY
        )
    except WebSearchUnavailableError as exc:
        return [], [f'topic "{planned.topic}": {exc}']

    if not results:
        return [], []

    claims = extract_claims(
        api_key=settings.groq_api_key,
        model=settings.groq_model,
        project_name=project_name,
        agency=str(agency) if agency else None,
        state=str(state) if state else None,
        topic=planned.topic,
        results=results,
    )

    items: list[WebEvidenceItem] = []
    for claim in claims:
        result = claim.result
        trust_tier, source_quality = trust.classify_source(result.url, str(agency) if agency else None)
        published_date, date_confidence = verify_date(result.published_date_raw)
        domain = trust.extract_domain(result.url) or result.url
        items.append(
            WebEvidenceItem(
                evidence_id=_evidence_id(project_id, result.url, planned.topic),
                topic=planned.topic,
                source=domain,
                url=result.url,
                title=result.title,
                publication_date=str(published_date) if published_date else None,
                date_confidence=date_confidence,
                finding=claim.finding,
                project_relevance=claim.project_relevance,
                trust_tier=trust_tier,
                source_quality=source_quality,
            )
        )
    return items, []


def get_web_intelligence(
    project_id: str,
    force: bool = False,
    for_diagnosis: bool = False,
) -> WebIntelligenceResult:
    """
    Main entry point for the Web Intelligence Agent.

    Args:
        project_id: The synthetic project_id or project_code from the dataset.
        force: If True, run web search regardless of risk level.
        for_diagnosis: If True, run as part of the Risk Diagnosis agent.

    Returns:
        WebIntelligenceResult with evidence items and metadata.
    """
    searched_at = datetime.now(timezone.utc).isoformat()

    # Resolve project from the dataset
    project_data_series = dataset_service.get_project_by_id(project_id)
    if project_data_series is None:
        return WebIntelligenceResult(
            project_id=project_id,
            project_name="Unknown",
            triggered=False,
            trigger_reason="Project not found in dataset.",
            topics_searched=[],
            evidence=[],
            warnings=[f"Project '{project_id}' not found in dataset."],
            searched_at=searched_at,
        )

    project_data = project_data_series.to_dict() if hasattr(project_data_series, "to_dict") else dict(project_data_series)
    project_name = str(project_data.get("project_name", project_id))

    # Get risk context
    overall_health: str | None = None
    ml_risk_level: str | None = None
    cost_overrun_pct: float | None = None
    time_overrun_months: float | None = None

    try:
        from services.risk_service import evaluate_project_risk
        risk = evaluate_project_risk(project_data)
        overall_health = risk.get("risk_class") or risk.get("overall_health")
        ml_risk_level = risk.get("ml_prediction", {}).get("risk_class")
        cost_overrun_pct = project_data.get("cost_overrun_pct")
        time_overrun_months = project_data.get("time_overrun_months")
    except Exception:
        pass  # Risk unavailable — web agent should not block

    decision: TriggerDecision = should_trigger(
        overall_health=overall_health,
        ml_risk_level=ml_risk_level,
        force=force,
        for_diagnosis=for_diagnosis,
    )

    if not decision.triggered:
        return WebIntelligenceResult(
            project_id=project_id,
            project_name=project_name,
            triggered=False,
            trigger_reason=decision.reason,
            topics_searched=[],
            evidence=[],
            warnings=[],
            searched_at=searched_at,
        )

    driver_categories = _driver_categories(
        overall_health=overall_health,
        ml_risk_level=ml_risk_level,
        cost_overrun_pct=float(cost_overrun_pct) if cost_overrun_pct is not None else None,
        time_overrun_months=float(time_overrun_months) if time_overrun_months is not None else None,
    )

    settings = get_settings()
    planned_queries = query_planner.plan_queries(
        project_name=project_name,
        agency=str(project_data.get("agency", "")) or None,
        state=str(project_data.get("state", "")) or None,
        driver_categories=driver_categories,
    )

    all_items: list[WebEvidenceItem] = []
    seen_urls: set[str] = set()
    warnings: list[str] = []

    for planned in planned_queries:
        items, query_warnings = _run_query(project_data, planned, settings)
        warnings.extend(query_warnings)
        for item in items:
            if item.url in seen_urls:  # Deduplicate across topics
                continue
            seen_urls.add(item.url)
            all_items.append(item)

    return WebIntelligenceResult(
        project_id=project_id,
        project_name=project_name,
        triggered=True,
        trigger_reason=decision.reason,
        topics_searched=[p.topic for p in planned_queries],
        evidence=all_items,
        warnings=warnings,
        searched_at=searched_at,
    )
