import type {
  TokenResponse, UserResponse, PasswordStrengthResponse,
  PredictionRequest, PredictionResponse, BatchPredictionResponse,
  HistoryResponse, NationalKPI, BestAreasResponse,
  ProximityEffectResponse, ScoreRelationshipsResponse,
  SpatialDistributionResponse, NearbySearchResponse,
  HeatmapResponse, ChoroplethResponse, IDWResponse, CountyStatsResponse,
} from '../types/api'

const BASE = 'https://kenya-land-api.onrender.com'

// ─── Token store (never localStorage) ────────────────────────────────────────
let _token: string | null = null
export const setToken = (t: string | null) => { _token = t }
export const getToken = () => _token
export const isLoggedIn = () => _token !== null

function authHeaders(json = true): HeadersInit {
  const h: Record<string, string> = {}
  if (json) h['Content-Type'] = 'application/json'
  if (_token) h['Authorization'] = `Bearer ${_token}`
  return h
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function register(username: string, email: string, password: string): Promise<UserResponse> {
  const res = await fetch(`${BASE}/api/v1/auth/register`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ username, email, password }),
  })
  return handleResponse(res)
}

export async function login(username: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams()
  body.append('username', username)
  body.append('password', password)
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  return handleResponse(res)
}

export async function getMe(): Promise<UserResponse> {
  const res = await fetch(`${BASE}/api/v1/auth/me`, { headers: authHeaders() })
  return handleResponse(res)
}

export async function checkPasswordStrength(password: string): Promise<PasswordStrengthResponse> {
  const res = await fetch(`${BASE}/api/v1/auth/password-strength?password=${encodeURIComponent(password)}`, {
    method: 'POST',
  })
  return handleResponse(res)
}

// ─── Predictions ──────────────────────────────────────────────────────────────
export async function predict(payload: PredictionRequest): Promise<PredictionResponse> {
  const res = await fetch(`${BASE}/api/v1/predictions/predict`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function predictBatch(items: PredictionRequest[]): Promise<BatchPredictionResponse> {
  const res = await fetch(`${BASE}/api/v1/predictions/predict/batch`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  })
  return handleResponse(res)
}

// ─── History ──────────────────────────────────────────────────────────────────
export async function getHistory(limit = 10, offset = 0): Promise<HistoryResponse> {
  const res = await fetch(`${BASE}/api/v1/predictions/history?limit=${limit}&offset=${offset}`, {
    headers: authHeaders(),
  })
  return handleResponse(res)
}

export async function getPredictionById(id: string): Promise<PredictionResponse> {
  const res = await fetch(`${BASE}/api/v1/predictions/${id}`, { headers: authHeaders() })
  return handleResponse(res)
}

// ─── Dashboard (public) ───────────────────────────────────────────────────────
export async function getKPI(): Promise<NationalKPI> {
  const res = await fetch(`${BASE}/api/v1/dashboard/kpi`)
  return handleResponse(res)
}

export async function getBestAreas(topN = 20): Promise<BestAreasResponse> {
  const res = await fetch(`${BASE}/api/v1/dashboard/best-areas?top_n=${topN}`)
  return handleResponse(res)
}

export async function getProximityEffect(): Promise<ProximityEffectResponse> {
  const res = await fetch(`${BASE}/api/v1/dashboard/proximity-effect`)
  return handleResponse(res)
}

export async function getScoreRelationships(): Promise<ScoreRelationshipsResponse> {
  const res = await fetch(`${BASE}/api/v1/dashboard/score-relationships`)
  return handleResponse(res)
}

// ─── Spatial (public) ─────────────────────────────────────────────────────────
export async function getDistribution(limit = 5000): Promise<SpatialDistributionResponse> {
  const res = await fetch(`${BASE}/api/v1/spatial/distribution?limit=${limit}`)
  return handleResponse(res)
}

export async function getNearby(lat: number, lon: number, radiusKm = 10, limit = 50): Promise<NearbySearchResponse> {
  const res = await fetch(`${BASE}/api/v1/spatial/nearby?lat=${lat}&lon=${lon}&radius_km=${radiusKm}&limit=${limit}`)
  return handleResponse(res)
}

export async function getHeatmap(): Promise<HeatmapResponse> {
  const res = await fetch(`${BASE}/api/v1/spatial/heatmap`)
  return handleResponse(res)
}

export async function getChoropleth(): Promise<ChoroplethResponse> {
  const res = await fetch(`${BASE}/api/v1/spatial/choropleth`)
  return handleResponse(res)
}

export async function getIDWGradient(gridSize = 80): Promise<IDWResponse> {
  const res = await fetch(`${BASE}/api/v1/spatial/idw-gradient?grid_size=${gridSize}`)
  return handleResponse(res)
}

export async function getCountyStats(): Promise<CountyStatsResponse> {
  const res = await fetch(`${BASE}/api/v1/spatial/county-stats`)
  return handleResponse(res)
}
