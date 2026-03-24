import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.schemas.dashboard import (
    NationalKPIResponse, 
    BestAreasResponse, 
    BestAreaItem,
    ProximityEffectResponse, # NEW
    ProximityBand,
    LandPriceRelationshipResponse, 
    SizeBucket, 
    ZoningStats, 
    CorrelationPair,
    ScoreRelationshipsResponse, 
    SingleScoreRelationship, 
    ScoreBand   
)
from scipy.stats import pearsonr

class DashboardService:
    
    # We define the p99 filter here so we can reuse it across all methods
    P99_CTE = """
        WITH p99_val AS (
            SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY price_per_acre) AS p99
            FROM parcels WHERE price_per_acre IS NOT NULL AND price_per_acre > 0
        ),
        filtered AS (
            SELECT lp.* FROM parcels lp, p99_val
            WHERE lp.price_per_acre > 0 AND lp.price_per_acre <= p99_val.p99
        )
    """

    @staticmethod
    def get_national_kpis(db: Session) -> NationalKPIResponse:
        """Calculates national headline numbers for the dashboard."""
        
        # 1. Main Aggregation
        main_query = text(DashboardService.P99_CTE + """
            SELECT
                COUNT(*)                                             AS total_records,
                AVG(price_per_acre)                                  AS mean_price,
                PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY price_per_acre) AS median_price,
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price_per_acre) AS p25,
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price_per_acre) AS p75,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY price_per_acre) AS p95,
                MIN(price_per_acre)                                  AS min_price,
                MAX(price_per_acre)                                  AS max_price,
                AVG(size_acres)                                      AS mean_size,
                COUNT(DISTINCT county)                               AS counties_covered
            FROM filtered
        """)
        stats = db.execute(main_query).mappings().first()

        # 2. Top and Cheapest Counties
        top_county_query = text("""
            SELECT county FROM parcels 
            WHERE price_per_acre > 0 AND county IS NOT NULL 
            GROUP BY county ORDER BY AVG(price_per_acre) DESC LIMIT 1
        """)
        top_county = db.execute(top_county_query).scalar() or "Unknown"

        cheap_county_query = text("""
            SELECT county FROM parcels 
            WHERE price_per_acre > 0 AND county IS NOT NULL 
            GROUP BY county ORDER BY AVG(price_per_acre) ASC LIMIT 1
        """)
        cheap_county = db.execute(cheap_county_query).scalar() or "Unknown"

        return NationalKPIResponse(
            mean_price_per_acre=float(stats["mean_price"] or 0),
            median_price_per_acre=float(stats["median_price"] or 0),
            total_records_analysed=int(stats["total_records"] or 0),
            counties_covered=int(stats["counties_covered"] or 0),
            mean_size_acres=float(stats["mean_size"] or 0),
            price_range={
                "min": float(stats["min_price"] or 0),
                "max": float(stats["max_price"] or 0),
                "p25": float(stats["p25"] or 0),
                "p75": float(stats["p75"] or 0),
                "p95": float(stats["p95"] or 0),
            },
            top_county_by_price=top_county,
            most_affordable_county=cheap_county,
            data_last_updated=datetime.now() # Fallback if no list_date exists
        )

    @staticmethod
    def get_best_areas(db: Session, top_n: int = 20) -> BestAreasResponse:
        """Calculates normalized investment scores for each county."""
        
        query = text(DashboardService.P99_CTE + """
            SELECT county,
                COUNT(*)  AS record_count,
                AVG(price_per_acre)   AS mean_price,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_acre) AS median_price,
                AVG(amenities_score)      AS avg_amenities,
                AVG(accessibility_score)  AS avg_accessibility,
                AVG(infrastructure_score) AS avg_infrastructure,
                AVG(dist_to_nairobi_km)   AS avg_dist_nairobi
            FROM filtered
            WHERE county IS NOT NULL
              AND amenities_score IS NOT NULL
              AND accessibility_score IS NOT NULL
              AND infrastructure_score IS NOT NULL
            GROUP BY county
            HAVING COUNT(*) >= 3
        """)
        
        rows = db.execute(query).mappings().fetchall()
        
        if not rows:
            return BestAreasResponse(items=[], total_counties_analysed=0)

        # Convert to Pandas to do the complex normalizations (matching Notebook Cell 42)
        df = pd.DataFrame([dict(row) for row in rows])
        
        # Calculate National Median for Affordability Labels
        national_median = df['median_price'].median()

        # Normalize metrics between 0 and 1
        for col in ['avg_amenities', 'avg_accessibility', 'avg_infrastructure', 'mean_price']:
            mn, mx = df[col].min(), df[col].max()
            # Prevent divide by zero if all counties have the exact same value
            df[f'norm_{col}'] = 0.5 if mn == mx else (df[col] - mn) / (mx - mn)
            
        # Cheaper is better for investors (inverse normalization)
        df['norm_affordability'] = 1 - df['norm_mean_price']
        
        # Apply weighting formula
        df['investment_score'] = (
            df['norm_avg_amenities'] * 0.3 +
            df['norm_avg_accessibility'] * 0.2 +
            df['norm_avg_infrastructure'] * 0.2 +
            df['norm_affordability'] * 0.3
        )
        
        # Sort and rank
        df = df.sort_values('investment_score', ascending=False).head(top_n)
        df['rank'] = range(1, len(df) + 1)

        def get_affordability_label(median_val):
            if median_val < (national_median * 0.8):
                return 'High'
            elif median_val > (national_median * 1.2):
                return 'Low'
            return 'Medium'

        items = []
        for _, row in df.iterrows():
            items.append(BestAreaItem(
                county=row['county'],
                investment_score=float(row['investment_score']),
                rank=int(row['rank']),
                median_price_per_acre=float(row['median_price']),
                mean_price_per_acre=float(row['mean_price']),
                record_count=int(row['record_count']),
                avg_amenities_score=float(row['avg_amenities']),
                avg_accessibility_score=float(row['avg_accessibility']),
                avg_infrastructure_score=float(row['avg_infrastructure']),
                avg_dist_to_nairobi_km=float(row['avg_dist_nairobi']),
                affordability_label=get_affordability_label(row['median_price'])
            ))

        return BestAreasResponse(items=items, total_counties_analysed=len(df))
    
    @staticmethod
    def get_proximity_effect(db: Session) -> ProximityEffectResponse:
        """Analyzes price decay based on distance from major hubs."""
        
        # 1. Get National Median for the Price Index calculation
        national_median_query = text(DashboardService.P99_CTE + """
            SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_acre) 
            FROM filtered
        """)
        national_median = float(db.execute(national_median_query).scalar() or 1.0)
        # Prevent division by zero if DB is empty
        if national_median == 0: national_median = 1.0 

        # 2. Nairobi Rings
        nairobi_query = text(DashboardService.P99_CTE + """
            , banded AS (
                SELECT price_per_acre,
                    CASE 
                        WHEN dist_to_nairobi_km < 20 THEN '0-20 km'
                        WHEN dist_to_nairobi_km < 50 THEN '20-50 km'
                        WHEN dist_to_nairobi_km < 100 THEN '50-100 km'
                        WHEN dist_to_nairobi_km < 200 THEN '100-200 km'
                        ELSE '>200 km' 
                    END AS band_label,
                    CASE 
                        WHEN dist_to_nairobi_km < 20 THEN 1
                        WHEN dist_to_nairobi_km < 50 THEN 2
                        WHEN dist_to_nairobi_km < 100 THEN 3
                        WHEN dist_to_nairobi_km < 200 THEN 4
                        ELSE 5 
                    END AS band_order,
                    CASE WHEN dist_to_nairobi_km < 20 THEN 0
                         WHEN dist_to_nairobi_km < 50 THEN 20
                         WHEN dist_to_nairobi_km < 100 THEN 50
                         WHEN dist_to_nairobi_km < 200 THEN 100
                         ELSE 200 END AS dist_from,
                    CASE WHEN dist_to_nairobi_km < 20 THEN 20
                         WHEN dist_to_nairobi_km < 50 THEN 50
                         WHEN dist_to_nairobi_km < 100 THEN 100
                         WHEN dist_to_nairobi_km < 200 THEN 200
                         ELSE 9999 END AS dist_to
                FROM filtered
                WHERE dist_to_nairobi_km IS NOT NULL
            )
            SELECT band_label, dist_from, dist_to, band_order,
                   COUNT(*) AS count, 
                   AVG(price_per_acre) AS mean_price, 
                   PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_acre) AS median_price
            FROM banded 
            GROUP BY band_label, dist_from, dist_to, band_order 
            ORDER BY band_order
        """)
        nairobi_rows = db.execute(nairobi_query).mappings().fetchall()

        # 3. County Town Bands
        county_town_query = text(DashboardService.P99_CTE + """
            , banded AS (
                SELECT price_per_acre,
                    CASE 
                        WHEN dist_to_county_town_km < 5 THEN '0-5 km'
                        WHEN dist_to_county_town_km < 10 THEN '5-10 km'
                        WHEN dist_to_county_town_km < 20 THEN '10-20 km'
                        WHEN dist_to_county_town_km < 30 THEN '20-30 km'
                        WHEN dist_to_county_town_km < 50 THEN '30-50 km'
                        WHEN dist_to_county_town_km < 75 THEN '50-75 km'
                        WHEN dist_to_county_town_km < 100 THEN '75-100 km'
                        ELSE '>100 km' 
                    END AS band_label,
                    CASE 
                        WHEN dist_to_county_town_km < 5 THEN 1
                        WHEN dist_to_county_town_km < 10 THEN 2
                        WHEN dist_to_county_town_km < 20 THEN 3
                        WHEN dist_to_county_town_km < 30 THEN 4
                        WHEN dist_to_county_town_km < 50 THEN 5
                        WHEN dist_to_county_town_km < 75 THEN 6
                        WHEN dist_to_county_town_km < 100 THEN 7
                        ELSE 8 
                    END AS band_order,
                    CASE WHEN dist_to_county_town_km < 5 THEN 0
                         WHEN dist_to_county_town_km < 10 THEN 5
                         WHEN dist_to_county_town_km < 20 THEN 10
                         WHEN dist_to_county_town_km < 30 THEN 20
                         WHEN dist_to_county_town_km < 50 THEN 30
                         WHEN dist_to_county_town_km < 75 THEN 50
                         WHEN dist_to_county_town_km < 100 THEN 75
                         ELSE 100 END AS dist_from,
                    CASE WHEN dist_to_county_town_km < 5 THEN 5
                         WHEN dist_to_county_town_km < 10 THEN 10
                         WHEN dist_to_county_town_km < 20 THEN 20
                         WHEN dist_to_county_town_km < 30 THEN 30
                         WHEN dist_to_county_town_km < 50 THEN 50
                         WHEN dist_to_county_town_km < 75 THEN 75
                         WHEN dist_to_county_town_km < 100 THEN 100
                         ELSE 9999 END AS dist_to
                FROM filtered
                WHERE dist_to_county_town_km IS NOT NULL
            )
            SELECT band_label, dist_from, dist_to, band_order,
                   COUNT(*) AS count, 
                   AVG(price_per_acre) AS mean_price, 
                   PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_acre) AS median_price
            FROM banded 
            GROUP BY band_label, dist_from, dist_to, band_order 
            ORDER BY band_order
        """)
        county_town_rows = db.execute(county_town_query).mappings().fetchall()

        # 4. Pearson Correlations
        raw_data_query = text(DashboardService.P99_CTE + """
            SELECT price_per_acre, dist_to_nairobi_km, dist_to_county_town_km 
            FROM filtered
        """)
        raw_data = db.execute(raw_data_query).mappings().fetchall()

        nairobi_pairs = [(r['dist_to_nairobi_km'], r['price_per_acre']) for r in raw_data if r['dist_to_nairobi_km'] is not None]
        r_nairobi = 0.0
        if len(nairobi_pairs) > 1:
            r_nairobi, _ = pearsonr([x[0] for x in nairobi_pairs], [x[1] for x in nairobi_pairs])

        county_pairs = [(r['dist_to_county_town_km'], r['price_per_acre']) for r in raw_data if r['dist_to_county_town_km'] is not None]
        r_county = 0.0
        if len(county_pairs) > 1:
            r_county, _ = pearsonr([x[0] for x in county_pairs], [x[1] for x in county_pairs])

        # 5. Determine Interpretation
        if r_nairobi < -0.5:
            interpretation = 'Strong negative — price decays sharply with distance from Nairobi'
        elif r_nairobi < -0.2:
            interpretation = 'Moderate negative — distance has measurable price effect'
        elif r_nairobi > 0.2:
            interpretation = 'Positive — unusual, check data distribution'
        else:
            interpretation = 'Weak — distance alone does not explain price variation'

        # 6. Format Response
        n_bands = [ProximityBand(
            band_label=r['band_label'],
            distance_from_km=float(r['dist_from']),
            distance_to_km=float(r['dist_to']),
            median_price_per_acre=float(r['median_price']),
            mean_price_per_acre=float(r['mean_price']),
            record_count=int(r['count']),
            price_index=float(r['median_price']) / national_median
        ) for r in nairobi_rows]

        c_bands = [ProximityBand(
            band_label=r['band_label'],
            distance_from_km=float(r['dist_from']),
            distance_to_km=float(r['dist_to']),
            median_price_per_acre=float(r['median_price']),
            mean_price_per_acre=float(r['mean_price']),
            record_count=int(r['count']),
            price_index=float(r['median_price']) / national_median
        ) for r in county_town_rows]

        return ProximityEffectResponse(
            nairobi_rings=n_bands,
            county_town_bands=c_bands,
            nairobi_correlation=float(r_nairobi),
            county_town_correlation=float(r_county),
            interpretation=interpretation
        )
    
    @staticmethod
    def get_land_price_relationship(db: Session) -> LandPriceRelationshipResponse:
        """Analyzes size buckets, zoning distributions, and a 7-feature correlation matrix."""
        
        # A. SIZE VS PRICE (log-quantile buckets via pandas)
        raw_size_query = text(DashboardService.P99_CTE + """
            SELECT size_acres, price_per_acre FROM filtered WHERE size_acres IS NOT NULL
        """)
        raw_size_data = db.execute(raw_size_query).mappings().fetchall()
        
        size_buckets = []
        if raw_size_data:
            df_size = pd.DataFrame([dict(r) for r in raw_size_data])
            # qcut drops duplicate bin edges if data is heavily skewed
            df_size['size_bucket'] = pd.qcut(df_size['size_acres'], q=6, duplicates='drop')
            
            for bucket, group in df_size.groupby('size_bucket', observed=False):
                if len(group) == 0: continue
                size_buckets.append(SizeBucket(
                    bucket_label=f"{bucket.left:.1f} - {bucket.right:.1f} acres",
                    size_from=float(bucket.left),
                    size_to=float(bucket.right),
                    median_price=float(group['price_per_acre'].median()),
                    mean_price=float(group['price_per_acre'].mean()),
                    count=len(group)
                ))

        # B. ZONING VS PRICE
        zoning_query = text(DashboardService.P99_CTE + """
            , totals AS (SELECT COUNT(*) AS total FROM filtered WHERE zoning_type IS NOT NULL)
            SELECT zoning_type,
                   COUNT(*) AS count,
                   AVG(price_per_acre) AS mean_price,
                   PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_acre) AS median_price,
                   ROUND(COUNT(*) * 100.0 / (SELECT total FROM totals), 1) AS pct_of_total
            FROM filtered 
            WHERE zoning_type IS NOT NULL
            GROUP BY zoning_type 
            ORDER BY median_price DESC
        """)
        zoning_rows = db.execute(zoning_query).mappings().fetchall()
        zoning_breakdown = [ZoningStats(**r) for r in zoning_rows]

        # C. CORRELATION MATRIX
        corr_query = text(DashboardService.P99_CTE + """
            SELECT size_acres, dist_to_nairobi_km, dist_to_county_town_km, dist_to_water_body_km,
                   amenities_score, accessibility_score, infrastructure_score, price_per_acre
            FROM filtered
        """)
        corr_data = db.execute(corr_query).mappings().fetchall()
        df_corr = pd.DataFrame([dict(r) for r in corr_data])
        
        correlations = []
        features = [
            'size_acres', 'dist_to_nairobi_km', 'dist_to_county_town_km', 
            'dist_to_water_body_km', 'amenities_score', 'accessibility_score', 'infrastructure_score'
        ]
        
        for feat in features:
            valid_df = df_corr.dropna(subset=[feat, 'price_per_acre'])
            if len(valid_df) > 1:
                r_val, _ = pearsonr(valid_df[feat], valid_df['price_per_acre'])
                
                if r_val < -0.5: interp = 'Strong negative'
                elif r_val < -0.2: interp = 'Moderate negative'
                elif r_val > 0.5: interp = 'Strong positive'
                elif r_val > 0.2: interp = 'Moderate positive'
                else: interp = 'Weak'
                
                correlations.append(CorrelationPair(
                    feature_a=feat, feature_b='price_per_acre', 
                    pearson_r=float(r_val), interpretation=interp
                ))

        # D. WATER BODY BANDS
        water_query = text(DashboardService.P99_CTE + """
            , banded AS (
                SELECT price_per_acre,
                    CASE 
                        WHEN dist_to_water_body_km < 1 THEN '<1 km'
                        WHEN dist_to_water_body_km < 2 THEN '1-2 km'
                        WHEN dist_to_water_body_km < 5 THEN '2-5 km'
                        WHEN dist_to_water_body_km < 10 THEN '5-10 km'
                        WHEN dist_to_water_body_km < 20 THEN '10-20 km'
                        ELSE '>20 km' 
                    END AS band_label,
                    CASE 
                        WHEN dist_to_water_body_km < 1 THEN 1
                        WHEN dist_to_water_body_km < 2 THEN 2
                        WHEN dist_to_water_body_km < 5 THEN 3
                        WHEN dist_to_water_body_km < 10 THEN 4
                        WHEN dist_to_water_body_km < 20 THEN 5
                        ELSE 6 
                    END AS band_order,
                    CASE WHEN dist_to_water_body_km < 1 THEN 0
                         WHEN dist_to_water_body_km < 2 THEN 1
                         WHEN dist_to_water_body_km < 5 THEN 2
                         WHEN dist_to_water_body_km < 10 THEN 5
                         WHEN dist_to_water_body_km < 20 THEN 10
                         ELSE 20 END AS dist_from,
                    CASE WHEN dist_to_water_body_km < 1 THEN 1
                         WHEN dist_to_water_body_km < 2 THEN 2
                         WHEN dist_to_water_body_km < 5 THEN 5
                         WHEN dist_to_water_body_km < 10 THEN 10
                         WHEN dist_to_water_body_km < 20 THEN 20
                         ELSE 9999 END AS dist_to
                FROM filtered
                WHERE dist_to_water_body_km IS NOT NULL
            )
            SELECT band_label, dist_from, dist_to, band_order,
                   COUNT(*) AS count, 
                   AVG(price_per_acre) AS mean_price, 
                   PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_acre) AS median_price
            FROM banded 
            GROUP BY band_label, dist_from, dist_to, band_order 
            ORDER BY band_order
        """)
        water_rows = db.execute(water_query).mappings().fetchall()
        
        # Calculate national median for the price index calculation
        nat_median_q = text(DashboardService.P99_CTE + "SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_acre) FROM filtered")
        nat_median = float(db.execute(nat_median_q).scalar() or 1.0)
        if nat_median == 0: nat_median = 1.0
        
        water_bands = [ProximityBand(
            band_label=r['band_label'],
            distance_from_km=float(r['dist_from']),
            distance_to_km=float(r['dist_to']),
            median_price_per_acre=float(r['median_price']),
            mean_price_per_acre=float(r['mean_price']),
            record_count=int(r['count']),
            price_index=float(r['median_price']) / nat_median
        ) for r in water_rows]

        return LandPriceRelationshipResponse(
            size_buckets=size_buckets,
            zoning_breakdown=zoning_breakdown,
            correlations=correlations,
            water_body_bands=water_bands
        )

    @staticmethod
    def get_score_relationships(db: Session) -> ScoreRelationshipsResponse:
        """Buckets ML scores into bins (0-20, 20-40, etc.) and compares vs price."""
        
        nat_median_q = text(DashboardService.P99_CTE + "SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_acre) FROM filtered")
        nat_median = float(db.execute(nat_median_q).scalar() or 1.0)
        if nat_median == 0: nat_median = 1.0

        def process_score(score_name: str, db_conn: Session, df: pd.DataFrame) -> SingleScoreRelationship:
            query = text(DashboardService.P99_CTE + f"""
                , banded AS (
                    SELECT price_per_acre,
                        CASE WHEN {score_name} < 20 THEN '0-20'
                             WHEN {score_name} < 40 THEN '20-40'
                             WHEN {score_name} < 60 THEN '40-60'
                             WHEN {score_name} < 80 THEN '60-80'
                             ELSE '80-100' END AS band_label,
                        CASE WHEN {score_name} < 20 THEN 1
                             WHEN {score_name} < 40 THEN 2
                             WHEN {score_name} < 60 THEN 3
                             WHEN {score_name} < 80 THEN 4
                             ELSE 5 END AS band_order,
                        CASE WHEN {score_name} < 20 THEN 0
                             WHEN {score_name} < 40 THEN 20
                             WHEN {score_name} < 60 THEN 40
                             WHEN {score_name} < 80 THEN 60
                             ELSE 80 END AS score_from,
                        CASE WHEN {score_name} < 20 THEN 20
                             WHEN {score_name} < 40 THEN 40
                             WHEN {score_name} < 60 THEN 60
                             WHEN {score_name} < 80 THEN 80
                             ELSE 100 END AS score_to
                    FROM filtered
                    WHERE {score_name} IS NOT NULL
                )
                SELECT band_label, score_from, score_to, band_order,
                       COUNT(*) AS count, 
                       AVG(price_per_acre) AS mean_price, 
                       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_acre) AS median_price
                FROM banded 
                GROUP BY band_label, score_from, score_to, band_order 
                ORDER BY band_order
            """)
            rows = db_conn.execute(query).mappings().fetchall()
            
            bands = []
            median_0_20 = 0.0
            median_80_100 = 0.0
            for r in rows:
                if r['band_label'] == '0-20': median_0_20 = float(r['median_price'])
                if r['band_label'] == '80-100': median_80_100 = float(r['median_price'])
                
                bands.append(ScoreBand(
                    band_label=r['band_label'],
                    score_from=float(r['score_from']),
                    score_to=float(r['score_to']),
                    median_price=float(r['median_price']),
                    mean_price=float(r['mean_price']),
                    count=int(r['count']),
                    price_index=float(r['median_price']) / nat_median
                ))
            
            valid_df = df.dropna(subset=[score_name, 'price_per_acre'])
            r_val = 0.0
            if len(valid_df) > 1:
                r_val, _ = pearsonr(valid_df[score_name], valid_df['price_per_acre'])
            
            if r_val < -0.5: interp = 'Strong negative'
            elif r_val < -0.2: interp = 'Moderate negative'
            elif r_val > 0.5: interp = 'Strong positive'
            elif r_val > 0.2: interp = 'Moderate positive'
            else: interp = 'Weak'
            
            premium = 0.0
            if median_0_20 > 0:
                premium = ((median_80_100 - median_0_20) / median_0_20) * 100
                
            return SingleScoreRelationship(
                score_name=score_name,
                bands=bands,
                pearson_r=float(r_val),
                interpretation=interp,
                top_band_premium=float(premium)
            )

        # Fetch raw score data for python correlations
        raw_query = text(DashboardService.P99_CTE + """
            SELECT amenities_score, accessibility_score, infrastructure_score, price_per_acre 
            FROM filtered
        """)
        df_scores = pd.DataFrame([dict(r) for r in db.execute(raw_query).mappings().fetchall()])

        return ScoreRelationshipsResponse(
            amenities=process_score('amenities_score', db, df_scores),
            accessibility=process_score('accessibility_score', db, df_scores),
            infrastructure=process_score('infrastructure_score', db, df_scores),
        )
        