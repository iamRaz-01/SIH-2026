"""
backend/main.py

InfraGuard AI — Main FastAPI Application

Startup sequence:
  1. Load dataset (Ministry of Statistics & Programme Implementation / PAIMANA)
  2. Load LightGBM ML model (once, singleton cache)
  3. Fit Isolation Forest anomaly detector on live dataset features
  4. Build project network graph
  5. Register all API routers: projects, dashboard, predict, anomalies, risk, benchmarks, network, alerts

Health endpoint (/api/health) reports all system states independently.
"""

from __future__ import annotations

import logging
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure 'backend' directory is on the Python path
_BACKEND_DIR = Path(__file__).resolve().parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from config import get_settings
from services import dataset_service, ml_service, anomaly_service, network_service, benchmark_service
from api import projects, dashboard, predict, anomalies, risk, benchmarks, network, alerts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("infraguard")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks before accepting requests."""
    logger.info("=== InfraGuard AI — Starting ML & Analytics Backend ===")
    logger.info("Settings: %s", settings.describe())

    # 1. Dataset Loading
    try:
        t0 = time.time()
        dataset_service.load_dataset(settings.dataset_path)
        logger.info("Dataset loaded successfully in %.2fs", time.time() - t0)
    except Exception as exc:
        logger.error("Dataset load failed: %s", exc)

    # 2. ML Model Loading (Real LightGBM Model)
    try:
        t0 = time.time()
        ml_service.load_model(settings.model_path)
        logger.info("ML model loaded successfully in %.2fs", time.time() - t0)
    except Exception as exc:
        logger.error("ML model load failed: %s", exc)

    # 3. Anomaly Detector Fitting (Isolation Forest on dataset)
    if dataset_service.dataset_status()["loaded"]:
        try:
            t0 = time.time()
            df = dataset_service.get_dataset()
            anomaly_service.fit_anomaly_model(
                df, contamination=settings.anomaly_contamination
            )
            logger.info("Anomaly detector fitted in %.2fs", time.time() - t0)
        except Exception as exc:
            logger.error("Anomaly detector fitting failed: %s", exc)

    # 4. Project Network Graph
    if dataset_service.dataset_status()["loaded"]:
        try:
            t0 = time.time()
            df = dataset_service.get_dataset()
            network_service.build_network(df)
            logger.info("Project network built in %.2fs", time.time() - t0)
        except Exception as exc:
            logger.error("Network build failed: %s", exc)

    logger.info("=== InfraGuard AI ML & Analytics Engine — Ready ===")

    yield

    logger.info("=== InfraGuard AI — Shutting down ===")


app = FastAPI(
    title="InfraGuard AI",
    description=(
        "Predictive risk monitoring and intelligence platform for India's "
        "Central Sector Infrastructure Projects (MoSPI / PAIMANA ecosystem). "
        "Powered by a calibrated LightGBM Cost-Overrun Model, Isolation Forest "
        "Anomaly Detection Engine, Tree SHAP Explainability, and Cohort Benchmarking."
    ),
    version=settings.app_version,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(projects.router)
app.include_router(dashboard.router)
app.include_router(predict.router)
app.include_router(anomalies.router)
app.include_router(risk.router)
app.include_router(benchmarks.router)
app.include_router(network.router)
app.include_router(alerts.router)


@app.get("/api/health", tags=["Health"])
def health():
    """
    Comprehensive system health check.
    Reports:
      - backend: 'running'
      - dataset: load state + rows + unique projects
      - ml_model: load state + type + metrics + threshold
      - anomaly_detector: fit state + total evaluated + anomalies flagged
      - project_network: node & edge counts
    """
    ds_status = dataset_service.dataset_status()
    ml_status = ml_service.model_status()
    an_status = anomaly_service.anomaly_status()
    net_status = network_service.network_status()

    overall_ok = (
        ds_status["loaded"]
        and ml_status["loaded"]
        and an_status["fitted"]
    )

    return {
        "status": "healthy" if overall_ok else "degraded",
        "backend": "running",
        "app_name": settings.app_name,
        "app_version": settings.app_version,
        "dataset": ds_status,
        "ml_model": ml_status,
        "anomaly_detector": an_status,
        "project_network": net_status,
    }


@app.get("/", include_in_schema=False)
def root():
    return {
        "message": "InfraGuard AI ML & Analytics Backend",
        "docs": "/docs",
        "health": "/api/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level="info",
    )
