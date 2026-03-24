// ─── Auth ──────────────────────────────────────────────────────────────────
export interface UserResponse {
  id: number
  username: string
  email: string
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface PasswordStrengthResponse {
  score: number        // 0–4
  label: string        // Weak | Fair | Good | Strong | Very Strong
  color: string
  suggestions: string[]
}

// ─── Predictions ──────────────────────────────────────────────────────────
export interface PredictionRequest {
  latitude: number
  longitude: number
  size_acres: number
  zoning_type: 'residential' | 'commercial' | 'agricultural' | 'industrial'
  amenities_score: number
  accessibility_score: number
  infrastructure_score: number
  geocode_confidence?: number
  county?: string
  dist_to_nairobi_km?: number | null
}

export interface ModelBreakdown {
  model_name: string
  log_pred: number
  price_per_acre_ksh: number
}

export interface PredictionResponse {
  prediction_id: string
  county: string
  ensemble_log_pred: number
  price_per_acre_ksh: number
  total_price_ksh: number
  model_breakdown: ModelBreakdown[]
  meta_weights: Record<string, number>
  input_features: Record<string, number>
  log_size_acres_used: number
  confidence_score: number
  confidence_label: 'High' | 'Medium' | 'Low'
  model_versions: Record<string, string>
  timestamp: string
}

export interface BatchPredictionResponse {
  predictions: PredictionResponse[]
  summary: {
    count: number
    mean_price_per_acre: number
    median_price_per_acre: number
    min_price: number
    max_price: number
    total_portfolio_value: number
  }
  processed_in_seconds: number
}

// ─── History ──────────────────────────────────────────────────────────────
export interface HistoryResponse {
  total: number
  offset: number
  limit: number
  results: PredictionResponse[]
}

// ─── Dashboard ────────────────────────────────────────────────────────────
export interface NationalKPI {
  mean_price_per_acre: number
  median_price_per_acre: number
  total_records_analysed: number
  counties_covered: number
  mean_size_acres: number
  price_range: { min: number; max: number; p25: number; p75: number; p95: number }
  top_county_by_price: string
  most_affordable_county: string
  data_last_updated: string
}

export interface BestAreaItem {
  county: string
  investment_score: number
  rank: number
  median_price_per_acre: number
  mean_price_per_acre: number
  record_count: number
  avg_amenities_score: number
  avg_accessibility_score: number
  avg_infrastructure_score: number
  avg_dist_to_nairobi_km: number
  affordability_label: 'High' | 'Medium' | 'Low'
}

export interface BestAreasResponse {
  items: BestAreaItem[]
  total_counties_analysed: number
  score_formula: string
}

export interface ProximityBand {
  band_label: string
  distance_from_km: number
  distance_to_km: number
  median_price_per_acre: number
  mean_price_per_acre: number
  record_count: number
  price_index: number
}

export interface ProximityEffectResponse {
  nairobi_rings: ProximityBand[]
  county_town_bands: ProximityBand[]
  nairobi_correlation: number
  county_town_correlation: number
  interpretation: string
}

export interface ScoreBand {
  band_label: string
  score_from: number
  score_to: number
  median_price: number
  mean_price: number
  count: number
  price_index: number
}

export interface SingleScoreRelationship {
  score_name: string
  bands: ScoreBand[]
  pearson_r: number
  interpretation: string
  top_band_premium: number
}

export interface ScoreRelationshipsResponse {
  amenities: SingleScoreRelationship
  accessibility: SingleScoreRelationship
  infrastructure: SingleScoreRelationship
}

// ─── Spatial ──────────────────────────────────────────────────────────────
export interface SpatialPoint { lat: number; lon: number }

export interface SpatialDistributionResponse {
  total_count: number
  bounds: { lon_min: number; lon_max: number; lat_min: number; lat_max: number }
  points: SpatialPoint[]
}

export interface NearbyParcel {
  id: number
  price_per_acre: number | null
  size_acres: number | null
  distance_km: number
  county: string | null
}

export interface NearbySearchResponse {
  query_lat: number
  query_lon: number
  radius_km: number
  total_found: number
  parcels: NearbyParcel[]
}

export interface HeatmapPoint { lat: number; lon: number; weight: number }

export interface HeatmapResponse {
  points: HeatmapPoint[]
  suggested_radius: number
  total_points: number
}

export interface ChoroplethFeature {
  county: string
  geojson: object
  mean_price: number | null
  median_price: number | null
  count: number
  price_class: number | null
  has_data: boolean
}

export interface ChoroplethResponse {
  features: ChoroplethFeature[]
  class_breaks: number[]
  counties_with_data: number
  counties_total: number
}

export interface IDWPoint { lat: number; lon: number; pred_price: number }

export interface IDWResponse {
  grid_size: number
  points: IDWPoint[]
  note: string
}

export interface CountyStatRow {
  county: string
  mean: number
  median: number
  min: number
  max: number
  count: number
  std: number | null
  p25: number
  p75: number
}

export interface CountyStatsResponse {
  stats: CountyStatRow[]
  national_median: number
  national_mean: number
  national_count: number
}
