"""
InfraGuard AI — Main FastAPI Application

Startup sequence:
  1. Load dataset (fail → health shows error, API returns 503)
  2. Load ML model (fail → health shows error, prediction returns 503)
  3. Fit anomaly detector on loaded dataset
  4. Build project network graph
  5. Register all API routers

Health endpoint (/api/health) reports all four states independently.
"""

from __future__ import annotations

import logging
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Ensure 'backend' directory is on the Python path so imports resolve ────────
_BACKEND_DIR = Path(__file__).resolve().parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from config import get_settings
from services import dataset_service, ml_service, anomaly_service, network_service
from api import projects, dashboard, predict, anomalies, network, alerts

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("infraguard")

settings = get_settings()


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks before accepting requests."""
    logger.info("=== InfraGuard AI — Starting up ===")
    logger.info("Settings: %s", settings.describe())

    # 1. Dataset
    try:
        t0 = time.time()
        dataset_service.load_dataset(settings.dataset_path)
        logger.info("Dataset loaded in %.2fs", time.time() - t0)
    except Exception as exc:
        logger.error("Dataset load failed: %s", exc)

    # 2. ML Model
    try:
        t0 = time.time()
        ml_service.load_model(settings.model_path)
        logger.info("ML model loaded in %.2fs", time.time() - t0)
    except Exception as exc:
        logger.error("ML model load failed: %s", exc)

    # 3. Anomaly Detector (needs dataset)
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

    # 4. Network graph (needs dataset)
    if dataset_service.dataset_status()["loaded"]:
        try:
            t0 = time.time()
            df = dataset_service.get_dataset()
            network_service.build_network(df)
            logger.info("Project network built in %.2fs", time.time() - t0)
        except Exception as exc:
            logger.error("Network build failed: %s", exc)

    logger.info("=== InfraGuard AI — Ready ===")

    yield  # App runs here

    logger.info("=== InfraGuard AI — Shutting down ===")


# ── App Instance ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="InfraGuard AI",
    description=(
        "AI-powered predictive risk monitoring for India's Central Sector "
        "Infrastructure Projects (PAIMANA/OCMS ecosystem). "
        "Provides cost-overrun prediction, anomaly detection, and project network intelligence."
    ),
    version=settings.app_version,
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(projects.router)
app.include_router(dashboard.router)
app.include_router(predict.router)
app.include_router(anomalies.router)
app.include_router(network.router)
app.include_router(alerts.router)


# ── Health endpoint ────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
def health():
    """
    Application health check.
    Reports:
      - backend: always 'running' if this endpoint responds
      - dataset: loaded + row count
      - ml_model: loaded + type + metrics
      - anomaly_detector: fitted + flagged count
      - network: built + node/edge count
    """
    ds_status = dataset_service.dataset_status()
    ml_status = ml_service.model_status()
    an_status = anomaly_service.anomaly_status()
    net_status = network_service.network_status()

    overall_ok = (
        ds_status["loaded"]
        and ml_status["loaded"]
        and an_status["fitted"]
        and net_status["built"]
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
        "message": "InfraGuard AI Backend",
        "docs": "/docs",
        "health": "/api/health",
    }


# ── Dev runner ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level="info",
    )
