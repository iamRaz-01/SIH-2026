"""Deterministic query planning for the Web Intelligence Agent.

Maps whichever risk driver categories are present for a project onto a
small, bounded subset of search topics (max 4), ordered by priority.
"""

from __future__ import annotations

from dataclasses import dataclass

MAX_TOPICS = 4

ALL_TOPICS = [
    "land acquisition",
    "environmental clearance",
    "forest clearance",
    "contractor dispute",
    "tender",
    "court case",
    "funding",
    "utility shifting",
    "construction delay",
    "approval",
    "local issue",
    "material shortage",
]

DRIVER_TOPIC_MAP: list[tuple[str, list[str]]] = [
    ("HIGH_ML_RISK", ["tender", "court case", "funding"]),
    ("SCHEDULE_BEHIND", ["construction delay", "land acquisition", "approval"]),
    ("EXPENDITURE_AHEAD", ["contractor dispute", "funding"]),
    ("DATA_QUALITY_CONCERN", ["material shortage", "contractor dispute"]),
    ("STAGNANT_TREND", ["utility shifting", "environmental clearance", "forest clearance"]),
]

DEFAULT_TOPICS = ["construction delay", "approval"]


@dataclass(frozen=True)
class PlannedQuery:
    topic: str
    query_text: str


def select_topics(driver_categories: list[str], max_topics: int = MAX_TOPICS) -> list[str]:
    seen: set[str] = set()
    topics: list[str] = []
    for category, category_topics in DRIVER_TOPIC_MAP:
        if category not in driver_categories:
            continue
        for topic in category_topics:
            if topic in seen:
                continue
            seen.add(topic)
            topics.append(topic)
            if len(topics) >= max_topics:
                return topics
    if not topics:
        topics = list(DEFAULT_TOPICS)[:max_topics]
    return topics


def plan_queries(
    *,
    project_name: str,
    agency: str | None,
    state: str | None,
    driver_categories: list[str],
    max_topics: int = MAX_TOPICS,
) -> list[PlannedQuery]:
    topics = select_topics(driver_categories, max_topics=max_topics)
    context = " ".join(filter(None, [project_name, agency, state]))
    return [PlannedQuery(topic=topic, query_text=f"{context} {topic}".strip()) for topic in topics]
