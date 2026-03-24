from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from app.database import Base

class PredictionLog(Base):
    __tablename__ = "prediction_logs"

    # Changed to String since ML prediction_ids are usually UUID strings
    id = Column(String, primary_key=True, index=True) 
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Geographic & Tabular Features
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    size_acres = Column(Float, nullable=False)
    zoning_type = Column(String, nullable=True)
    county = Column(String, nullable=True)
    
    # Prediction Outputs
    predicted_price_ksh = Column(Float, nullable=False)
    confidence_label = Column(String, nullable=True)
    full_response = Column(JSON, nullable=False) 
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())