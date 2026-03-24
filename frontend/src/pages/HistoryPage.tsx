import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { getHistory } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { fmtKsh } from '../lib/utils'
import type { PredictionResponse } from '../types/api'

function HistoryRow({ pred }: { pred: PredictionResponse }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        display: 'grid', gridTemplateColumns: '1fr 160px 160px 120px 40px',
        padding: '16px 24px', alignItems: 'center', color: 'var(--text-primary)',
        transition: 'background 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
            {new Date(pred.timestamp).toLocaleString()}
          </div>
          <div style={{ fontSize: 14 }}>{pred.county} · {pred.input_features?.latitude?.toFixed(3)}, {pred.input_features?.longitude?.toFixed(3)}</div>
        </div>
        <span className="price-display" style={{ fontSize: 15, textAlign: 'right' }}>{fmtKsh(pred.price_per_acre_ksh)}/ac</span>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>{fmtKsh(pred.total_price_ksh)} total</span>
        <span className={`badge badge-${pred.confidence_label.toLowerCase()}`} style={{ justifySelf: 'center' }}>{pred.confidence_label}</span>
        <span style={{ color: 'var(--text-tertiary)', justifySelf: 'center' }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 24px 20px', animation: 'fade-up 0.2s ease' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            {/* Model breakdown */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Space Mono, monospace', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>Model Breakdown</div>
              {pred.model_breakdown?.map(m => {
                const display = m.model_name === 'SNN' ? 'Model B' : m.model_name === 'TabNet' ? 'Model C' : m.model_name
                return (
                  <div key={m.model_name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace' }}>{display}</span>
                    <span style={{ color: 'var(--gold)', fontFamily: 'Space Mono, monospace' }}>{fmtKsh(m.price_per_acre_ksh)}</span>
                  </div>
                )
              })}
            </div>
            {/* Input features */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Space Mono, monospace', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>Input Features</div>
              {[['Size', `${pred.input_features?.size_acres ?? '—'} ac`], ['Zoning', pred.input_features?.zoning_type ?? '—'], ['Amenities', `${pred.input_features?.amenities_score ?? '—'}/100`], ['Accessibility', `${pred.input_features?.accessibility_score ?? '—'}/100`], ['Infrastructure', `${pred.input_features?.infrastructure_score ?? '—'}/100`]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                  <span style={{ fontFamily: 'Space Mono, monospace' }}>{v}</span>
                </div>
              ))}
            </div>
            {/* ID */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Space Mono, monospace', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>Prediction ID</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{pred.prediction_id}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HistoryPage() {
  const { user } = useAuth()
  const [history, setHistory] = useState<PredictionResponse[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const LIMIT = 10

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getHistory(LIMIT, offset)
      .then(r => { setHistory(r.results); setTotal(r.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, offset])

  if (!user) {
    return (
      <div style={{ padding: '120px 24px', textAlign: 'center' }}>
        <Clock size={48} style={{ color: 'var(--text-tertiary)', margin: '0 auto 20px' }} />
        <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: 20, marginBottom: 12 }}>Sign in to view history</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Your prediction history is saved to your account.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '60px 24px', maxWidth: 1280, margin: '0 auto' }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Account</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ fontFamily: 'Space Mono, monospace', fontSize: 32, fontWeight: 700 }}>Prediction History</h1>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--text-tertiary)' }}>{total} total predictions</span>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ color: 'var(--text-tertiary)', fontFamily: 'Space Mono, monospace', fontSize: 12 }}>Loading...</div>
        </div>
      ) : history.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 80 }}>
          <Clock size={48} style={{ color: 'var(--text-tertiary)', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-tertiary)', fontFamily: 'Space Mono, monospace', fontSize: 12 }}>No predictions yet — run your first valuation</p>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px 120px 40px', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              {['Location & Time', 'Price/Acre', 'Total Value', 'Confidence', ''].map(h => (
                <span key={h} style={{ fontSize: 10, fontFamily: 'Space Mono, monospace', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px' }}>{h}</span>
              ))}
            </div>
            {history.map(pred => <HistoryRow key={pred.prediction_id} pred={pred} />)}
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 32 }}>
              <button className="btn-outline" onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0} style={{ fontSize: 12 }}>← Previous</button>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                {Math.floor(offset / LIMIT) + 1} / {Math.ceil(total / LIMIT)}
              </span>
              <button className="btn-outline" onClick={() => setOffset(offset + LIMIT)} disabled={offset + LIMIT >= total} style={{ fontSize: 12 }}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
