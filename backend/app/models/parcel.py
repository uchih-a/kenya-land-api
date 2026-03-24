from sqlalchemy import Column, Integer, Float, String
from geoalchemy2 import Geometry
from app.database import Base


class Parcel(Base):
    __tablename__ = "parcels"

    id = Column(Integer, primary_key=True, index=True)

    # Target variables
    price_per_acre     = Column(Float, nullable=True)
    log_price_per_acre = Column(Float, nullable=True)
    price_ksh          = Column(Float, nullable=True)
    size_acres         = Column(Float, nullable=True)

    # ML features
    amenities_score      = Column(Float, nullable=True)
    accessibility_score  = Column(Float, nullable=True)
    infrastructure_score = Column(Float, nullable=True)
    log_size_acres       = Column(Float, nullable=True)
    dist_to_nairobi_km   = Column(Float, nullable=True)
    geocode_confidence   = Column(Float, nullable=True)

    # Location metadata
    county                 = Column(String, nullable=True)
    zoning_type            = Column(String, nullable=True)   # was missing
    dist_to_county_town_km = Column(Float,  nullable=True)
    dist_to_water_body_km  = Column(Float,  nullable=True)

    # Coordinates
    latitude  = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # PostGIS spatial column
    geom = Column(Geometry(geometry_type='POINT', srid=4326, spatial_index=True))