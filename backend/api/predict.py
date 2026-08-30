"""
InfraGuard AI — Prediction API Router
Endpoints:
  POST /api/predict/cost-overrun
"""

from __future__ import annotations

from typing import Optional, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services import ml_service
from services.ml_service import ModelNotReadyError
from services.dataset_service import get_dataset, get_project_by_id

router = APIRouter(prefix="/api/predict", tags=["Prediction"])


class PredictRequest(BaseModel):
    """
    Input schema for cost-overrun prediction.
    Accepts project_id (to look up from dataset) OR raw field values.
    """
    project_id: Optional[str] = Field(
        None, description="Synthetic project_id to predict from dataset"
    )
    # Raw field values (used when project_id is not provided)
    edition: Optional[Any] = Field(None, description="Edition date e.g. '2026-03-01'")
    project_name: Optional[str] = Field(None)
    agency: Optional[str] = Field(None)
    state: Optional[str] = Field(None)
    doa: Optional[Any] = Field(None, description="Date of approval")
    original_target_doa: Optional[Any] = Field(None, description="Original target completion date")
    original_cost: Optional[float] = Field(None, description="Sanctioned cost in ₹ Crore")
    cumulative_expenditure: Optional[float] = Field(None, description="Cumulative expenditure in ₹ Crore")
    physical_progress: Optional[float] = Field(None, description="Physical progress 0-100")


@router.post("/cost-overrun")
def predict_cost_overrun(req: PredictRequest):
    """
    Predict cost overrun risk using the trained LightGBM model.

    Provide either:
    - project_id: fetches data from the loaded dataset
    - Raw field values: uses them directly

    Returns risk_class (Low/Medium/High), probability, confidence, and top features.
    """
    # ── Resolve project data ───────────────────────────────────────────────────
    if req.project_id:
        row = get_project_by_id(req.project_id)
        if row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Project '{req.project_id}' not found in dataset"
            )
        project_data = row.to_dict()
    else:
        # Use raw fields from request
        project_data = req.model_dump(exclude={"project_id"})

    # ── Run prediction ─────────────────────────────────────────────────────────
    try:
        result = ml_service.predict_cost_overrun(project_data)
        return {
            "project_id": req.project_id,
            "project_name": project_data.get("project_name"),
            "agency": project_data.get("agency"),
            "state": project_data.get("state"),
            **result,
        }
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction error: {exc}")


@router.post("/batch")
def batch_predict(limit: int = 50):
    """
    Run predictions on the first N projects from the dataset.
    Useful for populating the dashboard risk scores.
    """
    df = get_dataset()
    results = []
    errors = []

    for _, row in df.head(limit).iterrows():
        try:
            project_data = row.to_dict()
            pred = ml_service.predict_cost_overrun(project_data)
            results.append({
                "project_id": row.get("project_id"),
                "project_name": row.get("project_name"),
                "agency": row.get("agency"),
                "state": row.get("state"),
                **pred,
            })
        except ModelNotReadyError:
            raise HTTPException(status_code=503, detail="ML model not loaded")
        except Exception as exc:
            errors.append({
                "project_id": str(row.get("project_id", "")),
                "error": str(exc),
            })

    return {
        "predictions": results,
        "errors": errors,
        "total_requested": limit,
        "total_scored": len(results),
    }
