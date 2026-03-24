from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.services.spatial_service import spatial_service
from app.schemas.spatial import (
    SpatialDistributionResponse,
    NearbySearchResponse,
    HeatmapResponse,
    ChoroplethResponse,
    IDWResponse,
    CountyStatsResponse,
)

router = APIRouter(prefix="/spatial", tags=["Spatial Data"])


@router.get("/distribution", response_model=SpatialDistributionResponse)
def get_parcel_distribution(
    limit: int = Query(default=5000, ge=1, le=10000),
    db: Session = Depends(get_db),
):
    """Return all parcel coordinates for scatter map rendering."""
    return spatial_service.get_distribution(db, limit)


@router.get("/nearby", response_model=NearbySearchResponse)
def get_nearby(
    lat:       float = Query(...,   ge=-4.7, le=4.6,  description="Latitude (Kenya bounds)"),
    lon:       float = Query(...,   ge=33.9, le=41.9, description="Longitude (Kenya bounds)"),
    radius_km: float = Query(10.0,  ge=0.1,  le=50.0, description="Search radius in km"),
    limit:     int   = Query(50,    ge=1,    le=100),
    db: Session = Depends(get_db),
):
    """Find parcels within radius_km using accurate PostGIS geography distance."""
    return spatial_service.get_nearby_parcels(db, lat, lon, radius_km, limit)


@router.get("/heatmap", response_model=HeatmapResponse)
def get_heatmap(db: Session = Depends(get_db)):
    """Price-weighted heatmap points. Client renders KDE overlay."""
    return spatial_service.get_heatmap(db)


@router.get("/choropleth", response_model=ChoroplethResponse)
def get_choropleth(db: Session = Depends(get_db)):
    """County boundaries with mean/median price. Fisher-Jenks k=5 classes."""
    return spatial_service.get_choropleth(db)


@router.get("/idw-gradient", response_model=IDWResponse)
def get_idw_gradient(
    grid_size: int = Query(
        default=100, ge=10, le=150,
        description="Grid resolution. Max 150 for performance."
    ),
    db: Session = Depends(get_db),
):
    """Continuous price surface via IDW interpolation."""
    return spatial_service.get_idw_gradient(db, grid_size=grid_size)


@router.get("/county-stats", response_model=CountyStatsResponse)
def get_county_stats(db: Session = Depends(get_db)):
    """Full price statistics per county. Sorted by median DESC."""
    return spatial_service.get_county_stats(db)