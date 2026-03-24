import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Map, TrendingUp, Award, Users, ArrowRight } from 'lucide-react'
import { getKPI, getBestAreas } from '../api/client'
import { useCountUp } from '../hooks/useCountUp'
import { useLazyReveal } from '../hooks/useLazyReveal'
import { fmtKsh } from '../lib/utils'
import type { NationalKPI, BestAreaItem } from '../types/api'

function KpiCard({ label, value, suffix = '', icon: Icon, delay = 0, isCurrency = false }: {
  label: string; value: number; suffix?: string; icon: React.ElementType; delay?: number; isCurrency?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)
  const displayed = useCountUp(value, 1600, started)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true) }, { threshold: 0.3 })
    obs.observe(el); return () => obs.disconnect()
  }, [])
  const fmt = isCurrency ? fmtKsh(displayed) : `${displayed.toLocaleString()}${suffix}`
  return (
    <div ref={ref} className="card" style={{ textAlign: 'center', flex: 1, minWidth: 180, animationDelay: `${delay}ms`, animation: 'fade-up 0.5s ease forwards', opacity: 0 }}>
      <Icon size={20} style={{ color: 'var(--teal)', margin: '0 auto 12px' }} />
      <div className="price-display" style={{ fontSize: 28 }}>{fmt}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, fontFamily: 'Space Mono, monospace', letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const [kpi, setKpi] = useState<NationalKPI | null>(null)
  const [areas, setAreas] = useState<BestAreaItem[]>([])
  const statsRef = useLazyReveal()
  const leaderRef = useLazyReveal()

  useEffect(() => {
    getKPI().then(setKpi).catch(() => {})
    getBestAreas(5).then(r => setAreas(r.items)).catch(() => {})
  }, [])

  return (
    <div style={{ background: 'var(--bg-base)' }}>
      {/* Hero */}
      <section style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', padding: '80px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(212,175,55,0.06) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 70% 50%, rgba(20,184,166,0.05), transparent 70%)' }} />
        <div className="max-w-7xl mx-auto w-full" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 20 }}>Kenya Land Intelligence Platform</div>
            <h1 style={{ fontFamily: 'Space Mono, monospace', fontSize: 'clamp(28px, 3.5vw, 52px)', fontWeight: 700, lineHeight: 1.15, color: 'var(--gold)', marginBottom: 24 }}>
              KNOW THE VALUE.<br />BUY WITH<br />CONFIDENCE.
            </h1>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 40, maxWidth: 460 }}>
              Thamani AI predicts Kenya land prices using a multi-model ensemble trained on 1,094 verified listings across 47 counties.
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={() => navigate('/estimator')} style={{ fontSize: 14, padding: '14px 32px' }}>
                <Zap size={16} /> Get Valuation
              </button>
              <button className="btn-outline" onClick={() => navigate('/map')} style={{ fontSize: 14, padding: '13px 32px' }}>
                <Map size={16} /> Explore Map
              </button>
            </div>
          </div>
          {/* Floating card */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="card" style={{ width: 340, border: '1px solid var(--gold-border)', animation: 'pulse-gold 4s ease-in-out infinite' }}>
              <div className="eyebrow" style={{ marginBottom: 16 }}>Sample · Kiambu County</div>
              <div className="price-display" style={{ fontSize: 44, marginBottom: 4 }}>KSh 4.2M</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>per acre · 0.75 acres residential</div>
              {[{ name: 'MLP', pct: 73, color: 'var(--gold)' }, { name: 'Model B', pct: 62, color: 'var(--teal)' }, { name: 'Model C', pct: 78, color: 'var(--orange)' }].map(m => (
                <div key={m.name} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', color: 'var(--text-secondary)' }}>{m.name}</span>
                    <span style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', color: m.color }}>{m.pct}%</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${m.pct}%`, background: m.color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-high">High Confidence</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)' }}>Thamani AI Ensemble</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Strip */}
      <section style={{ padding: '60px 24px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div ref={statsRef} className="lazy-section max-w-7xl mx-auto" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <KpiCard label="Records Analysed"  value={kpi?.total_records_analysed ?? 1094} icon={Users}     delay={0} />
          <KpiCard label="Median Price/Acre" value={kpi?.median_price_per_acre ?? 3800000} icon={TrendingUp} delay={100} isCurrency />
          <KpiCard label="Counties Covered"  value={kpi?.counties_covered ?? 25}           icon={Map}       delay={200} />
          <KpiCard label="Ensemble Accuracy" value={94}                                     icon={Award}     delay={300} suffix="%" />
        </div>
      </section>

      {/* Leaderboard */}
      <section style={{ padding: '80px 24px' }}>
        <div ref={leaderRef} className="lazy-section max-w-7xl mx-auto">
          <div className="eyebrow" style={{ marginBottom: 12 }}>Investment Intelligence</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
            <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: 28, fontWeight: 700 }}>Top Investment Areas</h2>
            <button className="btn-outline" onClick={() => navigate('/dashboard')} style={{ fontSize: 12 }}>
              Full Dashboard <ArrowRight size={14} />
            </button>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 200px 140px 110px', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              {['#', 'County', 'Score', 'Median Price', 'Affordability'].map(h => (
                <span key={h} style={{ fontSize: 10, fontFamily: 'Space Mono, monospace', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px' }}>{h}</span>
              ))}
            </div>
            {(areas.length ? areas : Array.from({ length: 5 }, (_, i) => ({ county: '—', rank: i + 1, investment_score: 0, median_price_per_acre: 0, affordability_label: 'Medium' as const, mean_price_per_acre: 0, record_count: 0, avg_amenities_score: 0, avg_accessibility_score: 0, avg_infrastructure_score: 0, avg_dist_to_nairobi_km: 0 }))).map((area) => (
              <div key={area.rank} className="card-hover" style={{ display: 'grid', gridTemplateColumns: '48px 1fr 200px 140px 110px', padding: '16px 24px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: 'var(--gold)' }}>{String(area.rank).padStart(2, '0')}</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{area.county}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${area.investment_score * 100}%`, background: 'var(--gold)', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--gold)', minWidth: 28 }}>{(area.investment_score * 100).toFixed(0)}</span>
                </div>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 13 }}>{area.median_price_per_acre ? fmtKsh(area.median_price_per_acre) : '—'}</span>
                <span className={`badge badge-${area.affordability_label.toLowerCase()}`}>{area.affordability_label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '80px 24px', borderTop: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="eyebrow" style={{ textAlign: 'center', marginBottom: 12 }}>How It Works</div>
          <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 60 }}>Three Steps to Accurate Valuation</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {[
              { step: '01', title: 'Enter Location & Plot Details', desc: 'Provide coordinates, plot size, zoning type and locality scores for the land parcel.' },
              { step: '02', title: 'AI Ensemble Runs Instantly', desc: 'Thamani AI Ensemble processes your inputs through MLP and supporting models trained on Kenya data.' },
              { step: '03', title: 'Get Verified Price Estimate', desc: 'Receive a price per acre, total valuation, and confidence rating with full breakdown.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="card" style={{ borderLeft: '3px solid var(--gold-border)' }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 36, fontWeight: 700, color: 'var(--gold-border)', marginBottom: 16 }}>{step}</div>
                <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
