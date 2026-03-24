import os
import sys
from pathlib import Path
from logging.config import fileConfig
from sqlalchemy import pool, create_engine
from alembic import context

sys.path.append(str(Path(__file__).parent.parent))

from app.database import Base
from app.models.prediction_log import PredictionLog

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table" and reflected:
        POSTGIS_TABLES = {
            "spatial_ref_sys", "geography_columns", "geometry_columns",
            "raster_columns", "raster_overviews",
            "loader_lookuptables", "loader_platform", "loader_variables",
            "loader_platform_staging", "pagc_gaz", "pagc_lex", "pagc_rules",
            "geocode_settings", "geocode_settings_default",
            "county_lookup", "countysub_lookup", "direction_lookup",
            "place_lookup", "secondary_unit_lookup", "state_lookup",
            "street_type_lookup", "zip_lookup", "zip_lookup_all",
            "zip_lookup_base", "zip_state", "zip_state_loc",
            "faces", "edges", "addrfeat", "featnames", "addr",
            "cousub", "county", "state", "place", "tract",
            "tabblock", "tabblock20", "zcta5", "bg", "topology", "layer",
        }
        if name in POSTGIS_TABLES:
            return False
    return True

def run_migrations_online() -> None:
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set")
    connectable = create_engine(db_url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            include_schemas=False,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()

run_migrations_online()
