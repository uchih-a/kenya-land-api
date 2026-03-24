import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Any

from app.api.dependencies import get_db, get_current_user
from app.models.prediction_log import PredictionLog

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/predictions/history",
    status_code=status.HTTP_200_OK,
    summary="Get Prediction History",
    description="Fetch the authenticated user's past predictions, newest first.",
)
async def get_prediction_history(
    limit:  int     = Query(default=10, ge=1, le=100),
    offset: int     = Query(default=0,  ge=0),
    db:     Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Any:
    """Returns paginated prediction logs for the current user."""
    try:
        logs = (
            db.query(PredictionLog)
            .filter(PredictionLog.user_id == current_user.id)
            .order_by(PredictionLog.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        total = (
            db.query(PredictionLog)
            .filter(PredictionLog.user_id == current_user.id)
            .count()
        )
        return {
            "total":   total,
            "offset":  offset,
            "limit":   limit,
            "results": [log.full_response for log in logs],
        }
    except Exception as e:
        logger.error(f"History fetch error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not fetch history.",
        )


@router.get(
    "/predictions/{prediction_id}",
    status_code=status.HTTP_200_OK,
    summary="Get Single Prediction",
    description="Fetch a single prediction by ID. Must belong to the current user.",
)
async def get_single_prediction(
    prediction_id: str,
    db:            Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Any:
    """Returns the full response for a single prediction."""
    log = (
        db.query(PredictionLog)
        .filter(
            PredictionLog.id == prediction_id,
            PredictionLog.user_id == current_user.id,
        )
        .first()
    )
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction not found.",
        )
    return log.full_response