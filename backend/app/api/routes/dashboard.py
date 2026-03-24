import json
import logging
import redis
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Callable, Any

from app.api.dependencies import get_db
from app.services.dashboard_service import DashboardService
from app.schemas.dashboard import (
    NationalKPIResponse,
    BestAreasResponse,
    ProximityEffectResponse,
    LandPriceRelationshipResponse,
    ScoreRelationshipsResponse
)
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize Redis client from REDIS_URL env var (works locally and on Render)
def _make_redis_client():
    try:
        client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        client.ping()
        return client
    except Exception:
        logger.warning("⚠️ Redis unavailable at startup — cache disabled.")
        return None

redis_client = _make_redis_client()
CACHE_TTL = 3600  # Cache data for 1 hour (3600 seconds)

def get_cached_or_compute(cache_key: str, compute_func: Callable, response_model: Any):
    if redis_client:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                return response_model.model_validate_json(cached_data)
        except Exception as e:
            logger.warning(f"Redis read error: {e}")

    result = compute_func()

    if redis_client:
        try:
            redis_client.setex(cache_key, CACHE_TTL, result.model_dump_json())
        except Exception as e:
            logger.warning(f"Redis write error: {e}")

    return result


@router.get("/kpi", response_model=NationalKPIResponse)
def get_kpis(db: Session = Depends(get_db)):
    """Get high-level national statistics."""
    return get_cached_or_compute(
        cache_key="dashboard:kpi",
        compute_func=lambda: DashboardService.get_national_kpis(db),
        response_model=NationalKPIResponse
    )

@router.get("/best-areas", response_model=BestAreasResponse)
def get_best_areas(top_n: int = 20, db: Session = Depends(get_db)):
    """Get ranked investment counties based on ML scores and affordability."""
    return get_cached_or_compute(
        cache_key=f"dashboard:best_areas:{top_n}",
        compute_func=lambda: DashboardService.get_best_areas(db, top_n),
        response_model=BestAreasResponse
    )

@router.get("/proximity-effect", response_model=ProximityEffectResponse)
def get_proximity_effect(db: Session = Depends(get_db)):
    """Analyze how distance from Nairobi and County Towns affects price."""
    return get_cached_or_compute(
        cache_key="dashboard:proximity",
        compute_func=lambda: DashboardService.get_proximity_effect(db),
        response_model=ProximityEffectResponse
    )

@router.get("/land-price-relationship", response_model=LandPriceRelationshipResponse)
def get_land_price_relationship(db: Session = Depends(get_db)):
    """Analyze size buckets, zoning, and broad feature correlations."""
    return get_cached_or_compute(
        cache_key="dashboard:relationships",
        compute_func=lambda: DashboardService.get_land_price_relationship(db),
        response_model=LandPriceRelationshipResponse
    )

@router.get("/score-relationships", response_model=ScoreRelationshipsResponse)
def get_score_relationships(db: Session = Depends(get_db)):
    """Analyze how engineered ML scores directly impact pricing."""
    return get_cached_or_compute(
        cache_key="dashboard:scores",
        compute_func=lambda: DashboardService.get_score_relationships(db),
        response_model=ScoreRelationshipsResponse
    )
