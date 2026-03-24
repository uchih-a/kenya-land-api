import logging
import asyncio
import time
import numpy as np
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.prediction import (
    PredictionRequest, EnsemblePredictionResponse,
    BatchPredictionRequest, BatchPredictionResponse, BatchSummaryStats
)
from app.services.ml_service import EnsembleService
from app.services.geo_service import compute_dist_to_nairobi
from app.api.dependencies import get_db, get_current_user
from app.models.prediction_log import PredictionLog

logger = logging.getLogger(__name__)
router = APIRouter()
ml_service = EnsembleService()


def _inject_features(request: PredictionRequest) -> dict:
    """
    Convert PredictionRequest to a flat dict ready for the ML pipeline.
    Injects dist_to_nairobi_km via Haversine if the user did not supply it.
    """
    data = request.model_dump()
    if data.get("dist_to_nairobi_km") is None:
        data["dist_to_nairobi_km"] = compute_dist_to_nairobi(
            request.latitude, request.longitude
        )
    return data


@router.post(
    "/predict",
    response_model=EnsemblePredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Predict Land Price (Single)",
)
async def predict_single_price(
    request: PredictionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Any:
    """
    Run a single land parcel through the 4-model ensemble and log to DB.
    Requires a valid JWT token.
    dist_to_nairobi_km is auto-computed from lat/lon if not provided.
    """
    if not ml_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML models are currently loading or unavailable.",
        )
    try:
        features = _inject_features(request)
        result = await asyncio.to_thread(ml_service.predict, features)

        db_log = PredictionLog(
            id=result["prediction_id"],
            user_id=current_user.id,
            latitude=request.latitude,
            longitude=request.longitude,
            size_acres=request.size_acres,
            zoning_type=request.zoning_type,
            county=result.get("county", "Unknown"),
            predicted_price_ksh=result["price_per_acre_ksh"],
            confidence_label=result["confidence_label"],
            full_response=result,
        )
        db.add(db_log)
        db.commit()

        return result

    except ValueError as ve:
        logger.error(f"Validation error: {ve}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve),
        )
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Prediction engine failed.",
        )


@router.post(
    "/predict/batch",
    response_model=BatchPredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Predict Land Prices (Batch)",
)
async def predict_batch_prices(
    batch: BatchPredictionRequest,
    current_user=Depends(get_current_user),
) -> Any:
    """
    Run up to 50 predictions concurrently.
    Results are not logged to DB — use single /predict for logging.
    """
    if len(batch.items) > 50:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Batch prediction limit is 50 items per request.",
        )
    if not ml_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML models are currently loading or unavailable.",
        )
    try:
        t_start = time.time()
        tasks = [
            asyncio.to_thread(ml_service.predict, _inject_features(req))
            for req in batch.items
        ]
        results = list(await asyncio.gather(*tasks))
        elapsed = round(time.time() - t_start, 3)

        prices = [r["price_per_acre_ksh"] for r in results]
        return BatchPredictionResponse(
            predictions=results,
            summary=BatchSummaryStats(
                count=len(results),
                mean_price_per_acre=float(np.mean(prices)),
                median_price_per_acre=float(np.median(prices)),
                min_price=float(np.min(prices)),
                max_price=float(np.max(prices)),
                total_portfolio_value=float(
                    sum(r["total_price_ksh"] for r in results)
                ),
            ),
            processed_in_seconds=elapsed,
        )

    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Batch prediction engine failed.",
        )