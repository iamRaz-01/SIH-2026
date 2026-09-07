"""
backend/config.py

InfraGuard AI — Application Configuration
Loads and validates environment variables using python-dotenv.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

_HERE = Path(__file__).resolve().parent  # backend/
_ENV_FILE = _HERE / ".env"

load_dotenv(dotenv_path=_ENV_FILE, override=False)


class Settings:
    """Central settings object — read once, reused everywhere."""

    # ── Identity ───────────────────────────────────────────────────────────────
    app_name: str = os.getenv("APP_NAME", "InfraGuard AI")
    app_version: str = os.getenv("APP_VERSION", "1.0.0")
    debug: bool = os.getenv("DEBUG", "true").lower() == "true"

    # ── Paths ──────────────────────────────────────────────────────────────────
    _repo_root: Path = _HERE.parent

    # Dataset candidate resolution
    _ds_env = os.getenv("DATASET_PATH", "ongoing_project_25_26.xlsx").lstrip("../")
    dataset_path: Path = _repo_root / _ds_env

    # Model candidate resolution (checks both names)
    _model_env = os.getenv("MODEL_PATH", "lightgbm_cost_overrun_model.pkl").lstrip("../")
    model_path: Path = _repo_root / _model_env

    # If default model name doesn't exist, check for '(1)' variant or cwd
    if not model_path.exists():
        if (_repo_root / "lightgbm_cost_overrun_model (1).pkl").exists():
            model_path = _repo_root / "lightgbm_cost_overrun_model (1).pkl"
        elif Path("lightgbm_cost_overrun_model.pkl").exists():
            model_path = Path("lightgbm_cost_overrun_model.pkl")

    # If default dataset doesn't exist, check cwd
    if not dataset_path.exists():
        if Path("ongoing_project_25_26.xlsx").exists():
            dataset_path = Path("ongoing_project_25_26.xlsx")

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

    # ── ARIA / LLM / Web Intelligence Keys (all optional) ─────────────────────
    groq_api_key: str | None = os.getenv("GROQ_API_KEY") or None
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    gemini_api_key: str | None = os.getenv("GEMINI_API_KEY") or None
    tavily_api_key: str | None = os.getenv("TAVILY_API_KEY") or None


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
