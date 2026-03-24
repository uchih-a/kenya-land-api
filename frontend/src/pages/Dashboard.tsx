import { useEffect, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getKPI, getBestAreas, getProximityEffect, getScoreRelationships } from '../api/client'
import { useLazyReveal } from '../hooks/useLazyReveal'
import { fmtKsh } from '../lib/utils'
import type { NationalKPI, BestAreaItem, ProximityEffectResponse, ScoreRelationshipsResponse } from '../types/api'

const TT_STYLE = { background: '#111827', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, fontFamily: 'Space Mono, monospace', fontSize: 11 }

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>
      <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: 22, fontWeight: 700 }}>{title}</h2>
    </div>
  )
}

export default function Dashboard() {
  const [kpi, setKpi] = useState<NationalKPI | null>(null)
  const [areas, setAreas] = useState<BestAreaItem[]>([])
  const [proximity, setProximity] = useState<ProximityEffectResponse | null>(null)
  const [scores, setScores] = useState<ScoreRelationshipsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const kpiRef = useLazyReveal()
  const areasRef = useLazyReveal()
  const proxRef = useLazyReveal()
  const scoreRef = useLazyReveal()

  useEffect(() => {
    Promise.all([getKPI(), getBestAreas(20), getProximityEffect(), getScoreRelationships()])
      .then(([k, a, p, s]) => { setKpi(k); setAreas(a.items); setProximity(p); setScores(s) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const nairobiData = proximity?.nairobi_rings.map(b => ({ name: b.band_label, price: Math.round(b.median_price_per_acre / 1e6 * 10) / 10 })) ?? []
  const townData = proximity?.county_town_bands.map(b => ({ name: b.band_label, price: Math.round(b.median_price_per_acre / 1e6 * 10) / 10 })) ?? []
  const amenData = scores?.amenities.bands.map(b => ({ name: b.band_label, price: Math.round(b.median_price / 1e6 * 10) / 10 })) ?? []
  const accData  = scores?.accessibility.bands.map(b => ({ name: b.band_label, price: Math.round(b.median_price / 1e6 * 10) / 10 })) ?? []
  const infData  = scores?.infrastructure.bands.map(b => ({ name: b.band_label, price: Math.round(b.median_price / 1e6 * 10) / 10 })) ?? []

  return (
    <div style={{ padding: '60px 24px', maxWidth: 1280, margin: '0 auto' }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Analytics</div>
      <h1 style={{ fontFamily: 'Space Mono, monospace', fontSize: 32, fontWeight: 700, marginBottom: 48 }}>Market Dashboard</h1>

      {/* KPI Cards */}
      <div ref={kpiRef} className="lazy-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 64 }}>
        {[
          { label: 'Mean Price/Acre',    val: kpi ? fmtKsh(kpi.mean_price_per_acre) : '—',   sub: 'p99-capped national avg' },
          { label: 'Median Price/Acre',  val: kpi ? fmtKsh(kpi.median_price_per_acre) : '—', sub: 'national median' },
          { label: 'Records',            val: kpi?.total_records_analysed ?? '—',              sub: 'verified listings' },
          { label: 'Counties',           val: kpi?.counties_covered ?? '—',                    sub: 'with data' },
          { label: 'Top County',         val: kpi?.top_county_by_price ?? '—',                sub: 'by mean price' },
          { label: 'Most Affordable',    val: kpi?.most_affordable_county ?? '—',             sub: 'by mean price' },
        ].map(({ label, val, sub }) => (
          <div key={label} className="card card-hover" style={{ animation: loading ? undefined : 'fade-up 0.4s ease forwards', opacity: loading ? 0.4 : undefined }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'Space Mono, monospace', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>{label}</div>
            <div className="price-display" style={{ fontSize: 22, marginBottom: 4 }}>{String(val)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Best Areas */}
      <div ref={areasRef} className="lazy-section" style={{ marginBottom: 64 }}>
        <SectionTitle eyebrow="Section 01" title="Investment Rankings" />
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 180px 140px 120px 110px', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
            {['#', 'County', 'Score', 'Median Price', 'Records', 'Affordability'].map(h => (
              <span key={h} style={{ fontSize: 10, fontFamily: 'Space Mono, monospace', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px' }}>{h}</span>
            ))}
          </div>
          {areas.map(area => (
            <div key={area.county} className="card-hover" style={{ display: 'grid', gridTemplateColumns: '40px 1fr 180px 140px 120px 110px', padding: '14px 24px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--gold)' }}>{String(area.rank).padStart(2,'0')}</span>
              <span style={{ fontWeight: 600 }}>{area.county}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${area.investment_score * 100}%`, background: 'var(--gold)', borderRadius: 2 }} />
                </div>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--gold)', minWidth: 28 }}>{(area.investment_score * 100).toFixed(0)}</span>
              </div>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12 }}>{fmtKsh(area.median_price_per_acre)}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{area.record_count}</span>
              <span className={`badge badge-${area.affordability_label.toLowerCase()}`}>{area.affordability_label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Proximity */}
      <div ref={proxRef} className="lazy-section" style={{ marginBottom: 64 }}>
        <SectionTitle eyebrow="Section 02" title="Proximity Effects" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {[{ title: 'Distance from Nairobi CBD', sub: 'Median price/acre by distance band (KSh M)', data: nairobiData, color: '#D4AF37' },
            { title: 'Distance from County Town', sub: 'Median price/acre by distance to county HQ', data: townData, color: '#14B8A6' }].map(({ title, sub, data, color }) => (
            <div key={title} className="card">
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>{sub}</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Space Mono, monospace', fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'Space Mono, monospace', fill: '#475569' }} unit="M" />
                  <Tooltip contentStyle={TT_STYLE} formatter={(v: any) => [`KSh ${v}M`, 'Median Price']} />
                  <Line type="monotone" dataKey="price" stroke={color} strokeWidth={2} dot={{ fill: color, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </div>

      {/* Score Relationships */}
      <div ref={scoreRef} className="lazy-section" style={{ marginBottom: 64 }}>
        <SectionTitle eyebrow="Section 03" title="Score Breakdown" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            { title: 'Amenities vs Price', data: amenData, color: 'rgba(212,175,55,0.75)', r: scores?.amenities.pearson_r },
            { title: 'Accessibility vs Price', data: accData, color: 'rgba(20,184,166,0.75)', r: scores?.accessibility.pearson_r },
            { title: 'Infrastructure vs Price', data: infData, color: 'rgba(236,91,19,0.75)', r: scores?.infrastructure.pearson_r },
          ].map(({ title, data, color, r }) => (
            <div key={title} className="card">
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{title}</div>
              {r !== undefined && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16, fontFamily: 'Space Mono, monospace' }}>r = {r.toFixed(2)}</div>}
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'Space Mono, monospace', fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 9, fontFamily: 'Space Mono, monospace', fill: '#475569' }} unit="M" />
                  <Tooltip contentStyle={TT_STYLE} formatter={(v: any) => [`KSh ${v}M`, 'Median Price']} />
                  <Bar dataKey="price" fill={color} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
