"""
backend/api/benchmarks.py

InfraGuard AI — Benchmarking API Router
Endpoints:
  GET /api/benchmarks/{project_code} — Real cohort comparison benchmarks for a project
  GET /api/benchmarks/cohorts        — Aggregate cohort benchmarks (State, Agency, National)
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from services import benchmark_service

router = APIRouter(prefix="/api/benchmarks", tags=["Benchmarking"])


@router.get("/cohorts")
def get_cohort_summaries():
    """
    Return portfolio-wide aggregate cohort benchmarks across all States and Agencies.
    Computed directly from the real dataset.
    """
    return benchmark_service.get_portfolio_cohort_summary()


@router.get("/{project_code}")
def get_project_benchmarks(project_code: str):
    """
    Compare a single project against its state, agency, scale, and national cohorts.
    Returns averages, medians, quartiles, and exact percentile rank.
    """
    res = benchmark_service.get_project_benchmarks(project_code)
    if res is None:
        raise HTTPException(
            status_code=404,
            detail=f"Project '{project_code}' not found in benchmark dataset."
        )
    return res
