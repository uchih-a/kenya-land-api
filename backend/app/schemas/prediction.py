from pydantic import BaseModel, Field, ConfigDict, computed_field
from typing import Literal, Optional
from datetime import datetime
import numpy as np


# === PredictionRequest ===
class PredictionRequest(BaseModel):
    # Raw user inputs
    latitude:             float = Field(ge=-4.7,   le=4.6,    description="Kenya lat bounds")
    longitude:            float = Field(ge=33.9,   le=41.9,   description="Kenya lon bounds")
    size_acres:           float = Field(gt=0.001,  le=500000, description="Plot size in acres")
    zoning_type:          Literal["residential", "commercial", "agricultural", "industrial"]

    # Engineered scores — 0 to 100
    amenities_score:      float = Field(ge=0.0, le=100.0)
    accessibility_score:  float = Field(ge=0.0, le=100.0)
    infrastructure_score: float = Field(ge=0.0, le=100.0)

    # Optional fields
    geocode_confidence:   float         = Field(default=1.0, ge=0.0, le=1.0)
    county:               Optional[str] = None
    # dist_to_nairobi_km injected by geo_service if not provided
    dist_to_nairobi_km:   Optional[float] = None

    @computed_field
    @property
    def log_size_acres(self) -> float:
        """log1p transform — matches training notebook."""
        return float(np.log1p(self.size_acres))

    model_config = ConfigDict(str_strip_whitespace=True)


# === IndividualModelPrediction ===
class IndividualModelPrediction(BaseModel):
    model_name:         str
    log_pred:           float
    price_per_acre_ksh: float


# === EnsemblePredictionResponse ===
class EnsemblePredictionResponse(BaseModel):
    prediction_id:       str        # str not UUID — service returns str(uuid4())
    county: Optional[str] = 'Unknown'
    ensemble_log_pred:   float
    price_per_acre_ksh:  float
    total_price_ksh:     float
    model_breakdown:     list[IndividualModelPrediction]
    meta_weights:        dict[str, float]
    input_features:      dict[str, float]
    log_size_acres_used: float
    confidence_score:    float
    confidence_label:    str
    model_versions:      dict[str, str]
    timestamp:           str        # ISO string — avoids datetime serialisation issues


# === Batch ===
class BatchPredictionRequest(BaseModel):
    items: list[PredictionRequest]


class BatchSummaryStats(BaseModel):
    count:                 int
    mean_price_per_acre:   float
    median_price_per_acre: float
    min_price:             float
    max_price:             float
    total_portfolio_value: float


class BatchPredictionResponse(BaseModel):
    predictions:           list[EnsemblePredictionResponse]
    summary:               BatchSummaryStats
    processed_in_seconds:  float