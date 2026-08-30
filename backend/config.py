"""
InfraGuard AI — Application Configuration
Loads and validates environment variables using python-dotenv.
All configurable paths and settings live here; no hardcoded paths elsewhere.
"""

from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache

from dotenv import load_dotenv

# ── Locate and load .env relative to this file ─────────────────────────────────
_HERE = Path(__file__).resolve().parent          # backend/
_ENV_FILE = _HERE / ".env"

load_dotenv(dotenv_path=_ENV_FILE, override=False)


class Settings:
    """Central settings object — read once, reused everywhere."""

    # ── Identity ───────────────────────────────────────────────────────────────
    app_name: str = os.getenv("APP_NAME", "InfraGuard AI")
    app_version: str = os.getenv("APP_VERSION", "1.0.0")
    debug: bool = os.getenv("DEBUG", "true").lower() == "true"

    # ── Paths ──────────────────────────────────────────────────────────────────
    # Resolved relative to repo root (one level above backend/)
    _repo_root: Path = _HERE.parent

    dataset_path: Path = _repo_root / os.getenv(
        "DATASET_PATH", "ongoing_project_25_26.xlsx"
    ).lstrip("../")

    model_path: Path = _repo_root / os.getenv(
        "MODEL_PATH", "lightgbm_cost_overrun_model.pkl"
    ).lstrip("../")

    # ── Server ─────────────────────────────────────────────────────────────────
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    reload: bool = os.getenv("RELOAD", "true").lower() == "true"

    # ── CORS ───────────────────────────────────────────────────────────────────
    allowed_origins: list[str] = [
        o.strip()
        for o in os.getenv(
            "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
        ).split(",")
    ]

    # ── Risk thresholds ────────────────────────────────────────────────────────
    cost_overrun_threshold: float = float(
        os.getenv("COST_OVERRUN_THRESHOLD", "0.10")
    )
    anomaly_contamination: float = float(
        os.getenv("ANOMALY_CONTAMINATION", "0.05")
    )

    def describe(self) -> dict:
        return {
            "app_name": self.app_name,
            "app_version": self.app_version,
            "debug": self.debug,
            "dataset_path": str(self.dataset_path),
            "model_path": str(self.model_path),
            "dataset_exists": self.dataset_path.exists(),
            "model_exists": self.model_path.exists(),
            "host": self.host,
            "port": self.port,
            "allowed_origins": self.allowed_origins,
        }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
