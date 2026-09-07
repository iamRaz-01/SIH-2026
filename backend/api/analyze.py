"""
backend/api/analyze.py

InfraGuard AI — ARIA Unified Analysis API Router
Endpoints:
  POST /api/analyze — Main conversational Q&A endpoint for ARIA chatbot
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from services import coordinator_service

router = APIRouter(prefix="/api/analyze", tags=["ARIA Intelligence"])


class AnalyzeRequest(BaseModel):
    query: str = Field(..., description="Natural language question or search query")
    project_id: Optional[str] = Field(None, description="Optional target project ID or code")


@router.post("")
def analyze_endpoint(req: AnalyzeRequest):
    """
    Unified entry point for ARIA AI Assistant.
    Coordinates answering portfolio questions, project inquiries, and risk diagnostics.
    """
    res = coordinator_service.coordinate_analysis(
        query=req.query,
        project_id=req.project_id
    )
    return res
