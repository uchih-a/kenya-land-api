from pydantic import BaseModel

class PredictionRequest(BaseModel):
    amenities_score: float
    accessibility_score: float
    infrastructure_score: float
    log_size_acres: float
    dist_to_nairobi_km: float
    geocode_confidence: float
    latitude: float
    longitude: float

class PredictionResponse(BaseModel):
    base_predictions: dict
    final_prediction_log: float
    final_prediction_kes: float