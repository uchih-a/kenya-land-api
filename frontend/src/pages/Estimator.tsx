import { useState } from 'react'
import { Zap, MapPin, ChevronDown } from 'lucide-react'
import { predict } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { fmtKsh } from '../lib/utils'
import type { PredictionRequest, PredictionResponse } from '../types/api'

const ZONES = ['residential', 'commercial', 'agricultural', 'industrial'] as const
const COUNTIES = ['Nairobi','Kiambu','Mombasa','Nakuru','Machakos','Kajiado','Kisumu','Nyeri','Meru','Kilifi','Uasin Gishu','Murang\'a','Kakamega','Laikipia','Nyandarua','Kirinyaga','Embu','Tharaka-Nithi','Isiolo','Marsabit','Turkana','West Pokot','Samburu','Trans Nzoia','Elgeyo-Marakwet','Nandi','Baringo','Siaya','Kisii','Nyamira','Migori','Homa Bay','Bungoma','Busia','Vihiga','Kwale','Taita-Taveta','Tana River','Lamu','Garissa','Wajir','Mandera','Makueni','Kitui','Machakos']

function Slider({ label, value, min = 0, max = 100, step = 1, onChange, unit = '' }: {
  label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; unit?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  const color = value >= 70 ? '#14B8A6' : value >= 40 ? '#D4AF37' : '#EC5B13'
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</label>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color, fontWeight: 700 }}>
          {value}{unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color, cursor: 'pointer' }}
      />
    </div>
  )
}

function ModelBar({ name, price, maxPrice }: { name: string; price: number; maxPrice: number }) {
  const pct = maxPrice > 0 ? (price / maxPrice) * 100 : 0
  const colors = { MLP: 'var(--gold)', 'Model B': 'var(--teal)', 'Model C': 'var(--orange)' }
  const displayName = name === 'SNN' ? 'Model B' : name === 'TabNet' ? 'Model C' : name
  const color = colors[displayName as keyof typeof colors] ?? 'var(--gold)'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: 'Space Mono, monospace', color: 'var(--text-secondary)' }}>{displayName}</span>
        <span style={{ fontSize: 12, fontFamily: 'Space Mono, monospace', color }}>{fmtKsh(price)}/ac</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

export default function Estimator() {
  const { user } = useAuth()
  const [lat, setLat] = useState(-1.2921)
  const [lon, setLon] = useState(36.8219)
  const [sizeAcres, setSizeAcres] = useState(0.5)
  const [zone, setZone] = useState<typeof ZONES[number]>('residential')
  const [county, setCounty] = useState('')
  const [amenities, setAmenities] = useState(60)
  const [accessibility, setAccessibility] = useState(55)
  const [infrastructure, setInfrastructure] = useState(50)
  const [confidence, setConfidence] = useState(1.0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PredictionResponse | null>(null)
  const [error, setError] = useState('')

  async function handlePredict() {
    if (!user) { setError('Please sign in to run predictions.'); return }
    setLoading(true); setError('')
    const payload: PredictionRequest = {
      latitude: lat, longitude: lon, size_acres: sizeAcres,
      zoning_type: zone, amenities_score: amenities,
      accessibility_score: accessibility, infrastructure_score: infrastructure,
      geocode_confidence: confidence, county: county || undefined,
    }
    try {
      const data = await predict(payload)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Prediction failed.')
    } finally {
      setLoading(false)
    }
  }

  const maxModelPrice = result ? Math.max(...result.model_breakdown.map(m => m.price_per_acre_ksh)) : 0

  return (
    <div style={{ padding: '60px 24px', maxWidth: 1280, margin: '0 auto' }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>AI Valuation</div>
      <h1 style={{ fontFamily: 'Space Mono, monospace', fontSize: 32, fontWeight: 700, marginBottom: 48 }}>Land Price Estimator</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>

        {/* ── Left: Form ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Location */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <MapPin size={16} style={{ color: 'var(--teal)' }} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>Location</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Latitude</label>
                <input type="number" step="0.0001" value={lat} onChange={e => setLat(Number(e.target.value))} className="input-field" placeholder="-1.2921" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Longitude</label>
                <input type="number" step="0.0001" value={lon} onChange={e => setLon(Number(e.target.value))} className="input-field" placeholder="36.8219" />
              </div>
            </div>
            <div style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', color: 'var(--text-tertiary)', padding: '8px 12px', background: 'rgba(20,184,166,0.06)', borderRadius: 6, border: '1px solid rgba(20,184,166,0.15)' }}>
              {lat.toFixed(4)}, {lon.toFixed(4)} · Kenya bounds enforced
            </div>
          </div>

          {/* Plot details */}
          <div className="card">
            <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 20 }}>Plot Details</h3>
            <Slider label="Plot Size (acres)" value={sizeAcres} min={0.1} max={100} step={0.1} onChange={setSizeAcres} unit=" ac" />

            {/* County */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>County (optional)</label>
              <div style={{ position: 'relative' }}>
                <select value={county} onChange={e => setCounty(e.target.value)} className="input-field" style={{ appearance: 'none', cursor: 'pointer' }}>
                  <option value="">Select county...</option>
                  {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Zoning */}
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 10 }}>Zoning Type</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ZONES.map(z => (
                  <button key={z} onClick={() => setZone(z)} className={`zone-pill ${zone === z ? 'active' : ''}`}>
                    {z.charAt(0).toUpperCase() + z.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scores */}
          <div className="card">
            <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 20 }}>Locality Scores</h3>
            <Slider label="Amenities Score" value={amenities} onChange={setAmenities} />
            <Slider label="Accessibility Score" value={accessibility} onChange={setAccessibility} />
            <Slider label="Infrastructure Score" value={infrastructure} onChange={setInfrastructure} />
            <Slider label="Geocode Confidence" value={confidence} min={0} max={1} step={0.01} onChange={setConfidence} />
          </div>

          {error && (
            <div style={{ color: '#EF4444', fontSize: 13, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <button className="btn-primary" onClick={handlePredict} disabled={loading} style={{ width: '100%', justifyContent: 'center', height: 52, fontSize: 14 }}>
            <Zap size={18} /> {loading ? 'CALCULATING...' : 'RUN AI VALUATION'}
          </button>
        </div>

        {/* ── Right: Results ── */}
        <div>
          {!result ? (
            <div className="card" style={{ minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, border: '1px dashed var(--border)' }}>
              <Zap size={40} style={{ color: 'var(--text-tertiary)' }} />
              <p style={{ color: 'var(--text-tertiary)', fontFamily: 'Space Mono, monospace', fontSize: 12, textAlign: 'center' }}>
                Fill in the form and click<br />RUN AI VALUATION
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fade-up 0.4s ease forwards' }}>

              {/* Main price card */}
              <div className="card" style={{ border: '1px solid var(--gold-border)', textAlign: 'center' }}>
                <div className="eyebrow" style={{ marginBottom: 12 }}>Estimated Price · {result.county}</div>
                <div className="price-display" style={{ fontSize: 52, marginBottom: 6 }}>
                  {fmtKsh(result.price_per_acre_ksh)}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  per acre · Total: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fmtKsh(result.total_price_ksh)}</span> for {sizeAcres} ac
                </div>
                <span className={`badge badge-${result.confidence_label.toLowerCase()}`}>
                  {result.confidence_label} Confidence · {(result.confidence_score * 100).toFixed(0)}%
                </span>
              </div>

              {/* Model breakdown */}
              <div className="card">
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Thamani AI Ensemble Breakdown</div>
                {result.model_breakdown.map(m => (
                  <ModelBar key={m.model_name} name={m.model_name} price={m.price_per_acre_ksh} maxPrice={maxModelPrice} />
                ))}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, fontFamily: 'Space Mono, monospace' }}>META WEIGHTS</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {Object.entries(result.meta_weights).map(([k, v]) => {
                      const display = k === 'SNN' ? 'Model B' : k === 'TabNet' ? 'Model C' : k
                      return (
                        <span key={k} style={{ fontSize: 12, fontFamily: 'Space Mono, monospace', color: 'var(--text-secondary)' }}>
                          {display}: <span style={{ color: 'var(--gold)' }}>{(v * 100).toFixed(0)}%</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Input features */}
              <div className="card">
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Location Properties</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['Latitude', result.input_features.latitude?.toFixed(4)],
                    ['Longitude', result.input_features.longitude?.toFixed(4)],
                    ['Dist. to Nairobi', `${result.input_features.dist_to_nairobi_km?.toFixed(1)} km`],
                    ['Log Plot Size', result.log_size_acres_used?.toFixed(3)],
                    ['Amenities', `${result.input_features.amenities_score}/100`],
                    ['Accessibility', `${result.input_features.accessibility_score}/100`],
                    ['Infrastructure', `${result.input_features.infrastructure_score}/100`],
                    ['Geocode Conf.', result.input_features.geocode_confidence?.toFixed(2)],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
                      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Space Mono, monospace', textAlign: 'center' }}>
                ID: {result.prediction_id.slice(0, 8)}... · {new Date(result.timestamp).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
