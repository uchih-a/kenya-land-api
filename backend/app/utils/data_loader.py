import os
import pandas as pd
import numpy as np
from app.database import SessionLocal
from app.models.parcel import Parcel

def load_parquet_to_db():
    db = SessionLocal()
    try:
        # 1. Check if data already exists to prevent duplicates
        existing_count = db.query(Parcel).count()
        if existing_count > 0:
            print(f"✅ Database already contains {existing_count} parcels. Skipping ingestion.")
            return

        # 2. Locate the parquet file inside the Docker container
        parquet_path = "/app/data/kenya_land_engineered_final.parquet"
        if not os.path.exists(parquet_path):
            print(f"❌ Error: Could not find dataset at {parquet_path}")
            print("Did you copy the file into the backend/data/ directory?")
            return

        print("🔄 Loading Parquet file into pandas...")
        df = pd.read_parquet(parquet_path)

        # 3. Create the PostGIS WKT (Well-Known Text) Point geometry
        print("🗺️ Generating spatial geometry points...")
        df['geom'] = df.apply(lambda row: f"SRID=4326;POINT({row['longitude']} {row['latitude']})", axis=1)

        # 4. Filter DataFrame to only include columns that exist in our Parcel model
        # All columns that exist in the Parcel model
        wanted_columns = [
            'price_per_acre', 'log_price_per_acre', 'amenities_score',
            'accessibility_score', 'infrastructure_score', 'log_size_acres',
            'dist_to_nairobi_km', 'geocode_confidence', 'latitude', 'longitude', 'geom',
            'county', 'zoning_type', 'dist_to_county_town_km', 'dist_to_water_body_km',
            'price_ksh', 'size_acres'
        ]
        # Only keep columns that actually exist in the parquet file
        model_columns = [c for c in wanted_columns if c in df.columns]
        missing = set(wanted_columns) - set(model_columns)
        if missing:
            print(f"⚠️  Columns not found in parquet (will be NULL): {missing}")
        
        # Keep only the columns we actually need and drop any rows with missing spatial data
        df = df[model_columns].dropna(subset=['latitude', 'longitude'])

        # Convert Pandas NaN values to Python None so PostgreSQL inserts NULL correctly
        df = df.replace({np.nan: None})

        # 5. Convert to dictionaries and bulk insert
        print(f"📦 Preparing to insert {len(df)} records into the database...")
        records = df.to_dict(orient='records')
        
        # Create SQLAlchemy objects
        db_parcels = [Parcel(**record) for record in records]
        
        # Use bulk_save_objects for massive speed improvement on large datasets
        db.bulk_save_objects(db_parcels)
        db.commit()
        
        print(f"✅ Success! Inserted {len(db_parcels)} parcels into the PostGIS database.")

    except Exception as e:
        db.rollback()
        print(f"❌ An error occurred during database insertion: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Starting Data Ingestion Script...")
    load_parquet_to_db()