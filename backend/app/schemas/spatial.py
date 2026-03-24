from pydantic import BaseModel
from typing import List, Dict, Optional


class PointCoordinates(BaseModel):
    lat: float
    lon: float


class SpatialDistributionResponse(BaseModel):
    total_count: int
    bounds:      Dict[str, float]
    points:      List[PointCoordinates]


class NearbyParcel(BaseModel):
    id:             int
    price_per_acre: Optional[float]
    size_acres:     Optional[float]
    distance_km:    float
    county:         Optional[str]


class NearbySearchResponse(BaseModel):
    # Fixed — was typed as PointCoordinates but service passed a plain dict
    query_lat:   float
    query_lon:   float
    radius_km:   float
    total_found: int
    parcels:     List[NearbyParcel]


class HeatmapPoint(BaseModel):
    lat:    float
    lon:    float
    weight: float   # normalised 0-1, weighted by log_price_per_acre


class HeatmapResponse(BaseModel):
    points:           List[HeatmapPoint]
    suggested_radius: float = 0.15
    total_points:     int


class ChoroplethFeature(BaseModel):
    county:      str
    geojson:     dict
    mean_price:  Optional[float]
    median_price:Optional[float]
    count:       int
    price_class: Optional[int]
    has_data:    bool


class ChoroplethResponse(BaseModel):
    features:           List[ChoroplethFeature]
    class_breaks:       List[float]
    counties_with_data: int
    counties_total:     int


class IDWPoint(BaseModel):
    lat:        float
    lon:        float
    pred_price: float


class IDWResponse(BaseModel):
    grid_size: int
    points:    List[IDWPoint]
    note:      str = "Grid masked to Kenya terrestrial boundaries"


class CountyStatRow(BaseModel):
    county: str
    mean:   float
    median: float
    min:    float
    max:    float
    count:  int
    std:    Optional[float]
    p25:    float
    p75:    float


class CountyStatsResponse(BaseModel):
    stats:          List[CountyStatRow]
    national_median:float
    national_mean:  float
    national_count: int