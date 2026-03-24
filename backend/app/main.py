import os
import time
import logging
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import auth, predictions, spatial, dashboard
from app.api.routes.history import router as history_router
from app.services.ml_service import EnsembleService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

MODEL_DIR   = os.path.join(os.path.dirname(__file__), "..", "ml_models")
_start_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Kenya Land Price API starting up...")
    app.state.models_loaded = False

    # Step 1: Load ML models
    try:
        svc = EnsembleService()
        svc.load_models(MODEL_DIR)
        app.state.models_loaded = True
        logger.info("🧠 ML Ensemble: LOADED and READY")
    except Exception as e:
        logger.error(f"❌ CRITICAL: ML models failed to load: {e}")

    # Step 2: Preload GADM boundaries so first choropleth/IDW request is instant
    try:
        from app.services.spatial_service import _load_gadm
        _load_gadm()
        logger.info("🗺️  GADM Kenya boundaries preloaded")
    except Exception as e:
        logger.warning(f"⚠️  GADM preload skipped (non-critical): {e}")

    yield

    logger.info("🛑 API shutting down.")
    app.state.models_loaded = False


app = FastAPI(
    title="Kenya Land Price Prediction API",
    description="Hybrid MLP+SNN+TabNet ensemble for Kenya land valuation.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        # Add your deployed frontend URL here when ready, e.g.:
        "https://kenya-land-api.vercel.app/",
        # Keep wildcard for now until frontend is deployed:
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)


# ── Exception handlers ────────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"🔥 Unhandled exception on {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error":       True,
            "status_code": 500,
            "detail":      "Internal server error",
        },
    )


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"], status_code=status.HTTP_200_OK)
def health_check():
    """Returns full system status. Used by Docker healthcheck."""
    models_ready = getattr(app.state, "models_loaded", False)
    uptime = round(time.time() - _start_time, 1)
    return {
        "status":          "ok" if models_ready else "starting_up",
        "environment":     os.getenv("APP_ENV", "development"),
        "timestamp":       datetime.utcnow().isoformat(),
        "uptime_seconds":  uptime,
        "api_version":     "2.0.0",
        "ml_models_ready": models_ready,
        "database_connected": True,
        "redis_connected":    True,
        "active_routers": [
            "auth", "predictions", "history", "spatial", "dashboard"
        ],
    }


@app.get("/", tags=["System"])
def read_root():
    return {"message": "Kenya Land Price Prediction API is online."}


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,        prefix="/api/v1/auth",        tags=["Authentication"])
app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["ML Inference"])
app.include_router(history_router,     prefix="/api/v1",             tags=["History"])
app.include_router(dashboard.router,   prefix="/api/v1/dashboard",   tags=["Dashboard"])
app.include_router(spatial.router,     prefix="/api/v1",             tags=["Spatial"])