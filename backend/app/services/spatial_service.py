import json
import logging
import numpy as np
import geopandas as gpd
import mapclassify
from scipy.spatial import cKDTree
from shapely.geometry import Point
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.schemas.spatial import (
    ChoroplethFeature, ChoroplethResponse,
    CountyStatRow, CountyStatsResponse,
    HeatmapPoint, HeatmapResponse,
    IDWPoint, IDWResponse,
    SpatialDistributionResponse, PointCoordinates,
    NearbySearchResponse, NearbyParcel,
)

logger = logging.getLogger(__name__)

KENYA_BOUNDS = {'lon_min': 33.8, 'lon_max': 42.0, 'lat_min': -5.0, 'lat_max': 5.0}
GADM_PATH    = '/app/data/gadm41_KEN.gpkg'

# ── GADM module-level cache ───────────────────────────────────────────────────
# Load once when the module is first imported.
# All requests share this object — ~50MB loaded once, not per request.
_gadm_gdf    = None
_kenya_union = None


def _load_gadm():
    """Load GADM file once and cache at module level."""
    global _gadm_gdf, _kenya_union
    if _gadm_gdf is not None:
        return
    try:
        from shapely.ops import unary_union
        gdf = gpd.read_file(GADM_PATH, layer='ADM_ADM_1')
        gdf = gdf[['NAME_1', 'geometry']].rename(columns={'NAME_1': 'county'})
        gdf = gdf.to_crs('EPSG:4326')
        gdf['county_join'] = gdf['county'].str.strip().str.title()
        _gadm_gdf    = gdf
        _kenya_union = unary_union(gdf.geometry)
        logger.info(f'GADM loaded: {len(gdf)} counties cached in memory')
    except Exception as e:
        logger.error(f'GADM load failed: {e}')


class SpatialService:

    def get_distribution(self, db: Session, limit: int = 5000) -> SpatialDistributionResponse:
        """Return all parcel coordinates for scatter map rendering."""
        result = db.execute(text("""
            SELECT latitude, longitude
            FROM parcels
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            LIMIT :limit
        """), {"limit": limit}).fetchall()

        points = [PointCoordinates(lat=row.latitude, lon=row.longitude) for row in result]
        return SpatialDistributionResponse(
            total_count=len(points),
            bounds=KENYA_BOUNDS,
            points=points,
        )

    def get_nearby_parcels(
        self, db: Session, lat: float, lon: float,
        radius_km: float = 10.0, limit: int = 50
    ) -> NearbySearchResponse:
        """
        Find parcels within radius_km using PostGIS geography.
        Uses ::geography cast for accurate metre-based distance.
        """
        radius_m = radius_km * 1000.0

        result = db.execute(text("""
            SELECT
                id,
                price_per_acre,
                size_acres,
                county,
                ST_Distance(
                    geom::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                ) / 1000.0 AS distance_km
            FROM parcels
            WHERE geom IS NOT NULL
              AND ST_DWithin(
                    geom::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                    :radius_m
              )
            ORDER BY distance_km ASC
            LIMIT :limit
        """), {"lat": lat, "lon": lon, "radius_m": radius_m, "limit": limit}).fetchall()

        parcels = [
            NearbyParcel(
                id=row.id,
                price_per_acre=float(row.price_per_acre) if row.price_per_acre else None,
                size_acres=float(row.size_acres) if row.size_acres else None,
                distance_km=round(float(row.distance_km), 2),
                county=row.county,
            )
            for row in result
        ]

        return NearbySearchResponse(
            query_lat=lat,
            query_lon=lon,
            radius_km=radius_km,
            total_found=len(parcels),
            parcels=parcels,
        )

    def get_heatmap(self, db: Session) -> HeatmapResponse:
        """Price-weighted heatmap points. Replicates notebook Cell 43."""
        result = db.execute(text("""
            SELECT latitude, longitude, price_per_acre
            FROM parcels
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
              AND price_per_acre > 0 AND price_per_acre IS NOT NULL
        """)).fetchall()

        if not result:
            return HeatmapResponse(points=[], total_points=0)

        prices  = np.array([row.price_per_acre for row in result])
        p99     = np.percentile(prices, 99)
        weights = np.log1p(np.clip(prices, 0, p99))
        weights = weights / weights.sum()

        points = [
            HeatmapPoint(lat=row.latitude, lon=row.longitude, weight=float(w))
            for row, w in zip(result, weights)
        ]
        return HeatmapResponse(
            points=points,
            suggested_radius=0.15,
            total_points=len(points),
        )

    def get_choropleth(self, db: Session) -> ChoroplethResponse:
        """County choropleth with Fisher-Jenks k=5. Replicates Cell 42."""
        import pandas as pd

        # 1. SQL aggregation
        stats_records = db.execute(text("""
            WITH p99_val AS (
                SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY price_per_acre) AS p99
                FROM parcels WHERE price_per_acre > 0
            )
            SELECT county,
                COUNT(*) AS count,
                AVG(price_per_acre) AS mean_price,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_acre) AS median_price
            FROM parcels, p99_val
            WHERE county IS NOT NULL AND price_per_acre > 0
              AND price_per_acre <= p99_val.p99
            GROUP BY county
        """)).fetchall()
        county_stats_df = pd.DataFrame([dict(row._mapping) for row in stats_records])

        # 2. Use cached GADM — no disk read on every request
        _load_gadm()
        if _gadm_gdf is None:
            logger.error('GADM boundaries not available')
            return ChoroplethResponse(
                features=[], class_breaks=[],
                counties_with_data=0, counties_total=0,
            )
        counties_gdf = _gadm_gdf.copy()

        # 3. Merge stats onto GeoDataFrame
        if not county_stats_df.empty:
            county_stats_df['county_join'] = county_stats_df['county'].str.strip().str.title()
            merged = counties_gdf.merge(county_stats_df, on='county_join', how='left')
        else:
            merged = counties_gdf.copy()
            merged['mean_price']   = None
            merged['median_price'] = None
            merged['count']        = 0

        has_data = merged['mean_price'].notnull()

        # 4. Fisher-Jenks k=5
        if has_data.sum() >= 5:
            breaks      = mapclassify.FisherJenks(merged.loc[has_data, 'mean_price'], k=5)
            class_breaks = breaks.bins.tolist()
            merged.loc[has_data, 'price_class'] = breaks.yb + 1
        else:
            class_breaks = []
            merged['price_class'] = None

        # 5. Build GeoJSON features
        # Simplify geometries to reduce response size
        # tolerance=0.01 degrees ≈ 1km — enough detail for a web map
        features = []
        for _, row in merged.iterrows():
            try:
                simplified = row.geometry.simplify(
                    tolerance=0.01, preserve_topology=True
                ) if row.geometry else None
                geom = json.loads(
                    gpd.GeoSeries([simplified]).to_json()
                )['features'][0]['geometry'] if simplified else None
            except Exception:
                geom = None

            features.append(ChoroplethFeature(
                county=row.county_join,
                geojson={
                    'type': 'Feature',
                    'geometry': geom,
                    'properties': {
                        'county':       row.county_join,
                        'mean_price':   row.mean_price   if pd.notnull(row.mean_price)   else None,
                        'median_price': row.median_price if pd.notnull(row.median_price) else None,
                    },
                },
                mean_price=row.mean_price     if pd.notnull(row.mean_price)              else None,
                median_price=row.median_price if pd.notnull(row.median_price)            else None,
                count=int(row['count'])       if pd.notnull(row.get('count', None))      else 0,
                price_class=int(row.price_class) if pd.notnull(row.get('price_class', None)) else None,
                has_data=bool(pd.notnull(row.mean_price)),
            ))

        return ChoroplethResponse(
            features=features,
            class_breaks=class_breaks,
            counties_with_data=int(has_data.sum()),
            counties_total=len(merged),
        )

    def get_idw_gradient(self, db: Session, grid_size: int = 100) -> IDWResponse:
        """IDW price surface. Kenya bounds from Cell 39. GADM mask cached."""
        result = db.execute(text("""
            SELECT latitude, longitude, price_per_acre
            FROM parcels
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
              AND price_per_acre > 0 AND price_per_acre IS NOT NULL
        """)).fetchall()

        if not result:
            return IDWResponse(grid_size=grid_size, points=[])

        known_coords = np.array([[row.longitude, row.latitude] for row in result])
        known_prices = np.array([row.price_per_acre for row in result])

        # Build grid
        grid_lon = np.linspace(33.8, 42.0, grid_size)
        grid_lat = np.linspace(-5.0,  5.0, grid_size)
        mesh_lon, mesh_lat = np.meshgrid(grid_lon, grid_lat)
        grid_points = np.vstack((mesh_lon.ravel(), mesh_lat.ravel())).T

        # Mask to Kenya boundary using cached union — vectorised, not looped
        _load_gadm()
        if _kenya_union is not None:
            try:
                from shapely.vectorized import contains
                valid_mask = contains(_kenya_union, grid_points[:, 0], grid_points[:, 1])
            except ImportError:
                # Fallback if shapely.vectorized not available
                valid_mask = np.array([
                    _kenya_union.contains(Point(lon, lat))
                    for lon, lat in grid_points
                ])
        else:
            valid_mask = np.ones(len(grid_points), dtype=bool)

        valid_points = grid_points[valid_mask]

        # IDW via cKDTree
        tree = cKDTree(known_coords)
        distances, indices = tree.query(valid_points, k=min(10, len(known_coords)))
        distances       = np.maximum(distances, 1e-10)
        weights         = 1.0 / (distances ** 2)
        weighted_prices = np.sum(weights * known_prices[indices], axis=1) / np.sum(weights, axis=1)
        weighted_prices = np.nan_to_num(weighted_prices, nan=0.0, posinf=0.0, neginf=0.0)

        points_out = [
            IDWPoint(lon=float(pt[0]), lat=float(pt[1]), pred_price=float(price))
            for pt, price in zip(valid_points, weighted_prices)
            if float(price) > 0
        ]
        return IDWResponse(grid_size=grid_size, points=points_out)

    def get_county_stats(self, db: Session) -> CountyStatsResponse:
        """Per-county price statistics sorted by median DESC."""
        result = db.execute(text("""
            WITH p99_val AS (
                SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY price_per_acre) AS p99
                FROM parcels WHERE price_per_acre > 0
            ),
            filtered AS (
                SELECT * FROM parcels, p99_val
                WHERE price_per_acre > 0 AND price_per_acre <= p99_val.p99
                  AND county IS NOT NULL
            )
            SELECT county,
                COUNT(*)   AS count,
                AVG(price_per_acre)    AS mean,
                PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY price_per_acre) AS median,
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price_per_acre) AS p25,
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price_per_acre) AS p75,
                MIN(price_per_acre)    AS min,
                MAX(price_per_acre)    AS max,
                STDDEV(price_per_acre) AS std
            FROM filtered
            GROUP BY county
            ORDER BY median DESC
        """)).fetchall()

        if not result:
            return CountyStatsResponse(
                stats=[], national_median=0.0,
                national_mean=0.0, national_count=0,
            )

        stats_rows  = []
        total_price = 0.0
        total_count = 0
        all_medians = []

        for row in result:
            stats_rows.append(CountyStatRow(
                county=row.county,
                mean=float(row.mean),
                median=float(row.median),
                min=float(row.min),
                max=float(row.max),
                count=int(row.count),
                std=float(row.std) if row.std is not None else None,
                p25=float(row.p25),
                p75=float(row.p75),
            ))
            total_price += float(row.mean) * int(row.count)
            total_count += int(row.count)
            all_medians.append(float(row.median))

        return CountyStatsResponse(
            stats=stats_rows,
            national_median=sum(all_medians) / len(all_medians) if all_medians else 0.0,
            national_mean=total_price / total_count if total_count > 0 else 0.0,
            national_count=total_count,
        )


spatial_service = SpatialService()