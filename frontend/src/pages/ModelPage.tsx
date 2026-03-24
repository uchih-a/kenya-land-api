import { AlertTriangle, Info, AlertCircle, Clock, MapPin, Star } from 'lucide-react'
import { useLazyReveal } from '../hooks/useLazyReveal'

const FEATURES = [
  { name: 'dist_to_nairobi_km', pct: 45, color: 'var(--gold)' },
  { name: 'amenities_score',    pct: 28, color: 'var(--teal)' },
  { name: 'infrastructure_score', pct: 15, color: 'var(--orange)' },
  { name: 'log_size_acres',     pct: 7,  color: 'var(--gold)' },
  { name: 'accessibility_score', pct: 4, color: 'var(--teal)' },
  { name: 'geocode_confidence', pct: 1,  color: 'var(--text-secondary)' },
]

const LIMITATIONS = [
  { icon: AlertTriangle, color: '#FBBF24', title: 'Data Coverage', badge: 'MEDIUM', badgeColor: '#FBBF24', body: 'Dataset limited to 813 high-quality records. Rural counties like Turkana, Marsabit and Mandera are under-represented, reducing prediction accuracy in those regions.' },
  { icon: Info, color: 'var(--teal)', title: 'County Classification', badge: 'RESOLVED', badgeColor: 'var(--teal)', body: 'Historical misclassification of Nairobi sub-regions corrected via reverse geocoding on coordinate pairs.' },
  { icon: AlertCircle, color: 'var(--orange)', title: 'Price Type', badge: 'NOTE', badgeColor: 'var(--orange)', body: 'Model predicts Asking Price. Final transaction prices may vary 5–12% due to negotiation gaps not captured in training data.' },
  { icon: Clock, color: '#A855F7', title: 'Temporal Drift', badge: 'ONGOING', badgeColor: '#A855F7', body: 'Training data collected in 2024. Land prices shift with economic conditions — model accuracy may degrade without periodic retraining on fresh listings.' },
  { icon: MapPin, color: '#EF4444', title: 'Urban Bias', badge: 'KNOWN', badgeColor: '#EF4444', body: 'Urban and peri-urban properties make up 60% of training data. The model performs best in Nairobi, Kiambu, Mombasa, and Nakuru. Accuracy drops in arid northern counties.' },
  { icon: Star, color: 'var(--gold)', title: 'Score Subjectivity', badge: 'REVIEW', badgeColor: 'var(--gold)', body: 'Amenities, accessibility and infrastructure scores are computed from spatial data and may not reflect ground-truth conditions for recently developed areas.' },
]

export default function ModelPage() {
  const archRef = useLazyReveal()
  const perfRef = useLazyReveal()
  const featRef = useLazyReveal()
  const limitRef = useLazyReveal()

  return (
    <div style={{ padding: '60px 24px', maxWidth: 1280, margin: '0 auto' }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Model Overview</div>
      <h1 style={{ fontFamily: 'Space Mono, monospace', fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Thamani AI Ensemble</h1>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 56, maxWidth: 600 }}>
        A multi-model ensemble trained on Kenya land listings. MLP base model fused with supporting models via Ridge meta-learner.
      </p>

      {/* Architecture */}
      <div ref={archRef} className="lazy-section card" style={{ marginBottom: 48 }}>
        <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: 20, fontWeight: 700, marginBottom: 28 }}>Architecture</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          {/* Input */}
          <div style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)', borderRadius: 8, padding: '16px 24px', width: '100%', maxWidth: 600 }}>
            <div style={{ fontSize: 11, color: 'var(--teal)', fontFamily: 'Space Mono, monospace', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 12 }}>Input Features</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['amenities_score','accessibility_score','infrastructure_score','log_size_acres','dist_to_nairobi_km','geocode_confidence','latitude','longitude'].map(f => (
                <span key={f} style={{ background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.2)', borderRadius: 4, padding: '4px 10px', fontSize: 11, fontFamily: 'Space Mono, monospace', color: 'var(--teal)' }}>{f}</span>
              ))}
            </div>
          </div>
          <div style={{ width: 2, height: 24, background: 'var(--border)' }} />
          {/* MLP */}
          <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid var(--gold-border)', borderRadius: 8, padding: '16px 24px', width: '100%', maxWidth: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>MLP (Primary)</span>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)' }}>weight: 0.73</span>
            </div>
            {['Dense 128 · BatchNorm', 'ReLU + Dropout 0.3', 'Dense 64 · BatchNorm', 'Dense 32 → Output'].map(l => (
              <div key={l} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{l}</div>
            ))}
          </div>
          <div style={{ width: 2, height: 24, background: 'var(--border)' }} />
          {/* Meta */}
          <div style={{ background: 'rgba(236,91,19,0.08)', border: '1px solid rgba(236,91,19,0.25)', borderRadius: 8, padding: '16px 24px', width: '100%', maxWidth: 600 }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: 'var(--orange)', fontWeight: 700, marginBottom: 8 }}>Ridge Meta-Learner</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Fuses MLP + supporting model outputs → final log price → expm1 → KSh/acre</div>
          </div>
        </div>
      </div>

      {/* Performance */}
      <div ref={perfRef} className="lazy-section card" style={{ marginBottom: 48 }}>
        <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Performance Metrics</h2>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                {['Model', 'RMSE (log)', 'MAE (log)', 'R²'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontFamily: 'Space Mono, monospace', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { model: 'OLS Baseline', rmse: '0.98', mae: '0.72', r2: '0.41', highlight: false },
                { model: 'MLP',         rmse: '0.71', mae: '0.52', r2: '0.68', highlight: false },
                { model: 'Thamani AI Ensemble', rmse: '0.61', mae: '0.44', r2: '0.78', highlight: true },
              ].map(({ model, rmse, mae, r2, highlight }) => (
                <tr key={model} style={{ background: highlight ? 'rgba(212,175,55,0.05)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 16px', fontWeight: highlight ? 700 : 400, color: highlight ? 'var(--gold)' : 'var(--text-primary)', fontFamily: highlight ? 'Space Mono, monospace' : undefined }}>{model}</td>
                  <td style={{ padding: '14px 16px', fontFamily: 'Space Mono, monospace', fontSize: 13 }}>{rmse}</td>
                  <td style={{ padding: '14px 16px', fontFamily: 'Space Mono, monospace', fontSize: 13 }}>{mae}</td>
                  <td style={{ padding: '14px 16px', fontFamily: 'Space Mono, monospace', fontSize: 13, color: highlight ? 'var(--teal)' : undefined }}>{r2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feature Importance */}
      <div ref={featRef} className="lazy-section card" style={{ marginBottom: 48 }}>
        <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Feature Importance</h2>
        {FEATURES.map(({ name, pct, color }) => (
          <div key={name} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{name}</span>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color, fontWeight: 700 }}>{pct}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 1s ease' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Limitations */}
      <div ref={limitRef} className="lazy-section">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Known Issues</div>
        <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: 20, fontWeight: 700, marginBottom: 28 }}>Model Limitations</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {LIMITATIONS.map(({ icon: Icon, color, title, badge, badgeColor, body }) => (
            <div key={title} className="card" style={{ borderLeft: `4px solid ${color}` }}>
              <Icon size={22} style={{ color, marginBottom: 12 }} />
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{title}</div>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontFamily: 'Space Mono, monospace', fontWeight: 700, letterSpacing: '1px', background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}44`, marginBottom: 12 }}>{badge}</span>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
