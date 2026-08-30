"""
backend/api/predict.py

InfraGuard AI — Prediction & Explainability API Router
Endpoints:
  POST /api/predict/cost-overrun — Predict cost-overrun probability and risk level
  POST /api/predict/explain     — Exact Tree SHAP explainability for model prediction
  POST /api/predict/batch       — Batch prediction on multiple projects
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services import dataset_service, ml_service
from services.ml_service import ModelNotReadyError

router = APIRouter(prefix="/api/predict", tags=["Prediction & ML"])


class PredictRequest(BaseModel):
    """
    Input schema for cost-overrun prediction.
    Accepts project_code / project_id OR raw field values.
    """
    project_code: Optional[str] = Field(None, description="MoSPI project code (e.g. '701107')")
    project_id: Optional[str] = Field(None, description="Synthetic project ID")
    edition: Optional[Any] = Field(None, description="Report Edition e.g. '2025-07-01'")
    project_name: Optional[str] = Field(None, description="Project Name")
    agency: Optional[str] = Field(None, description="Implementing Agency / Ministry")
    state: Optional[str] = Field(None, description="State / Union Territory")
    doa: Optional[Any] = Field(None, description="Date of Approval (DOA)")
    original_target_doa: Optional[Any] = Field(None, description="Original Target Completion Date")
    original_cost: Optional[float] = Field(None, description="Sanctioned Capital Cost (₹ Crore)")
    cumulative_expenditure: Optional[float] = Field(None, description="Cumulative Expenditure to date (₹ Crore)")
    physical_progress: Optional[float] = Field(None, description="Physical Progress (0-100 or 0-1)")


def _resolve_project_payload(req: PredictRequest) -> dict:
    """Resolve project data from dataset if code/id provided, else use raw fields."""
    if req.project_code:
        row = dataset_service.get_project_by_code(req.project_code)
        if row is not None:
            # Merge any user overrides with dataset row
            d = row.to_dict()
            overrides = req.model_dump(exclude_unset=True)
            d.update({k: v for k, v in overrides.items() if v is not None})
            return d

    if req.project_id:
        row = dataset_service.get_project_by_id(req.project_id)
        if row is not None:
            d = row.to_dict()
            overrides = req.model_dump(exclude_unset=True)
            d.update({k: v for k, v in overrides.items() if v is not None})
            return d

    # If code was given but not found in dataset, and no numeric data given, error
    if (req.project_code or req.project_id) and req.original_cost is None:
        ident = req.project_code or req.project_id
        raise HTTPException(
            status_code=404,
            detail=f"Project '{ident}' not found in dataset and no feature values supplied."
        )

    return req.model_dump()


@router.post("/cost-overrun")
@router.post("")
def predict_cost_overrun(req: PredictRequest):
    """
    Predict cost-overrun risk using the real trained LightGBM model.

    Provide either:
      - project_code or project_id (fetches features from real dataset)
      - Explicit feature values in JSON payload

    Returns real model output:
      {
        "project_code": "701107",
        "cost_overrun_probability": 0.0337,
        "risk_level": "LOW",
        "prediction": "NORMAL"
      }
    """
    project_data = _resolve_project_payload(req)

    try:
        res = ml_service.predict_cost_overrun(project_data)
        return {
            "project_code": res.get("project_code") or req.project_code,
            "project_id": res.get("project_id") or req.project_id,
            "project_name": project_data.get("project_name"),
            "agency": project_data.get("agency"),
            "state": project_data.get("state"),
            "cost_overrun_probability": res.get("cost_overrun_probability"),
            "risk_level": res.get("risk_level"),
            "prediction": res.get("prediction"),
            "confidence": res.get("confidence"),
            "optimal_threshold": res.get("optimal_threshold"),
            "model_type": res.get("model_type"),
            "status": res.get("status"),
            "provenance": res.get("provenance", "MODEL_OUTPUT"),
        }
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction error: {exc}")


@router.post("/explain")
def explain_cost_overrun_prediction(req: PredictRequest, top_n: int = Query(6, ge=1, le=25)):
    """
    Explain a LightGBM cost-overrun prediction using exact Tree SHAP feature contributions.
    Shows the positive and negative drivers influencing the risk calculation.
    """
    project_data = _resolve_project_payload(req)

    try:
        explanation = ml_service.explain_prediction(project_data, top_n=top_n)
        return explanation
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Explainability error: {exc}")


@router.post("/batch")
def batch_predict(limit: int = Query(50, ge=1, le=500)):
    """
    Run predictions on the first N unique projects from the real dataset.
    """
    df = dataset_service.get_latest_dataset()
    results = []
    errors = []

    for _, row in df.head(limit).iterrows():
        try:
            pred = ml_service.predict_cost_overrun(row.to_dict())
            results.append({
                "project_code": str(row.get("project_code", "")).replace(".0", ""),
                "project_id": str(row.get("project_id", "")),
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
