from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime


class NationalKPIResponse(BaseModel):
    mean_price_per_acre:    float
    median_price_per_acre:  float
    total_records_analysed: int
    counties_covered:       int
    mean_size_acres:        float
    price_range:            Dict[str, float]   # min, max, p25, p75, p95
    top_county_by_price:    str
    most_affordable_county: str
    data_last_updated:      datetime


class BestAreaItem(BaseModel):
    county:                  str
    investment_score:        float
    rank:                    int
    median_price_per_acre:   float
    mean_price_per_acre:     float
    record_count:            int
    avg_amenities_score:     float
    avg_accessibility_score: float
    avg_infrastructure_score:float
    avg_dist_to_nairobi_km:  float
    affordability_label:     str


class BestAreasResponse(BaseModel):
    items:                   List[BestAreaItem]
    total_counties_analysed: int
    score_formula:           str = "amenities*0.3 + accessibility*0.2 + infrastructure*0.2 + affordability*0.3"


class ProximityBand(BaseModel):
    band_label:           str
    distance_from_km:     float
    distance_to_km:       float
    median_price_per_acre:float
    mean_price_per_acre:  float
    record_count:         int
    price_index:          float


class ProximityEffectResponse(BaseModel):
    nairobi_rings:           List[ProximityBand]
    county_town_bands:       List[ProximityBand]
    nairobi_correlation:     float
    county_town_correlation: float
    interpretation:          str


class SizeBucket(BaseModel):
    bucket_label: str
    size_from:    float
    size_to:      float
    median_price: float
    mean_price:   float
    count:        int


class ZoningStats(BaseModel):
    zoning_type:  str
    mean_price:   float
    median_price: float
    count:        int
    pct_of_total: float


class CorrelationPair(BaseModel):
    feature_a:     str
    feature_b:     str
    pearson_r:     float
    interpretation:str


class LandPriceRelationshipResponse(BaseModel):
    size_buckets:     List[SizeBucket]
    zoning_breakdown: List[ZoningStats]
    correlations:     List[CorrelationPair]
    water_body_bands: List[ProximityBand]


class ScoreBand(BaseModel):
    band_label:  str
    score_from:  float
    score_to:    float
    median_price:float
    mean_price:  float
    count:       int
    price_index: float


class SingleScoreRelationship(BaseModel):
    score_name:       str
    bands:            List[ScoreBand]
    pearson_r:        float
    interpretation:   str
    top_band_premium: float


class ScoreRelationshipsResponse(BaseModel):
    amenities:      SingleScoreRelationship
    accessibility:  SingleScoreRelationship
    infrastructure: SingleScoreRelationship
    # shap_alignment removed — SHAP is not part of this project