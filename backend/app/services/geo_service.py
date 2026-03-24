"""
geo_service.py — Computes derived geographic features from lat/lon.

dist_to_nairobi_km is a required ML feature and must be injected
before inference if the user does not supply it.
"""
import math

# Nairobi CBD coordinates (matches training notebook)
NAIROBI_LAT = -1.2921
NAIROBI_LON = 36.8219


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Great-circle distance between two points in km.
    Uses the Haversine formula — accurate for Kenya distances.
    """
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi    = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compute_dist_to_nairobi(lat: float, lon: float) -> float:
    """Return distance in km from the given coordinates to Nairobi CBD."""
    return round(haversine_km(lat, lon, NAIROBI_LAT, NAIROBI_LON), 3)