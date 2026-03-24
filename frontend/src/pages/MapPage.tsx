import { useEffect, useRef, useState } from 'react'
import { predict, getChoropleth, getHeatmap, getDistribution, getIDWGradient, getNearby } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { fmtKsh, priceClassColor, idwColor } from '../lib/utils'
import type { PredictionResponse } from '../types/api'
import 'leaflet/dist/leaflet.css'

type Layer = 'choropleth' | 'heatmap' | 'distribution' | 'idw'

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<any>(null)
  const currentLayerRef = useRef<any>(null)
  const { user } = useAuth()

  const [activeLayer, setActiveLayer] = useState<Layer>('choropleth')
  const [mapLat, setMapLat] = useState(-1.2921)
  const [mapLon, setMapLon] = useState(36.8219)
  const [am, setAm] = useState(70)
  const [rd, setRd] = useState(55)
  const [inf, setInf] = useState(60)
  const [plotSize, setPlotSize] = useState(0.5)
  const [predResult, setPredResult] = useState<PredictionResponse | null>(null)
  const [predLoading, setPredLoading] = useState(false)
  const [showResult, setShowResult] = useState(false)

  function clearLayer() {
    if (currentLayerRef.current && leafletRef.current) {
      leafletRef.current.removeLayer(currentLayerRef.current)
      currentLayerRef.current = null
    }
  }

  async function loadChoropleth() {
    if (!leafletRef.current) return
    clearLayer()
    try {
      const L = (await import('leaflet')).default
      const data = await getChoropleth()
      const colorMap: Record<number, string> = { 1: 'rgba(20,184,166,0.2)', 2: 'rgba(20,184,166,0.4)', 3: 'rgba(212,175,55,0.3)', 4: 'rgba(212,175,55,0.55)', 5: 'rgba(212,175,55,0.80)' }
      currentLayerRef.current = L.geoJSON(
        { type: 'FeatureCollection', features: data.features.map(f => f.geojson) } as any,
        {
          style: (f: any) => ({ fillColor: colorMap[f?.properties?.price_class] ?? 'rgba(255,255,255,0.04)', fillOpacity: 1, color: 'rgba(255,255,255,0.15)', weight: 0.8 }),
          onEachFeature: (f: any, layer: any) => layer.bindPopup(`<b>${f.properties?.county}</b><br/>Mean: ${f.properties?.mean_price ? fmtKsh(f.properties.mean_price) : 'No data'}`)
        }
      ).addTo(leafletRef.current)
    } catch (e) { console.warn('Choropleth failed', e) }
  }

  async function loadHeatmap() {
    if (!leafletRef.current) return
    clearLayer()
    try {
      const L = (await import('leaflet')).default
      await import('leaflet.heat')
      const data = await getHeatmap()
      const pts = data.points.map(p => [p.lat, p.lon, p.weight] as [number, number, number])
      currentLayerRef.current = (L as any).heatLayer(pts, { radius: 25, blur: 20, maxZoom: 10 }).addTo(leafletRef.current)
    } catch (e) { console.warn('Heatmap failed', e) }
  }

  async function loadDistribution() {
    if (!leafletRef.current) return
    clearLayer()
    try {
      const L = (await import('leaflet')).default
      const data = await getDistribution(3000)
      const group = L.layerGroup()
      data.points.forEach(p => L.circleMarker([p.lat, p.lon], { radius: 3, fillColor: '#D4AF37', fillOpacity: 0.6, stroke: false }).addTo(group))
      currentLayerRef.current = group.addTo(leafletRef.current)
    } catch (e) { console.warn('Distribution failed', e) }
  }

  async function loadIDW() {
    if (!leafletRef.current) return
    clearLayer()
    try {
      const L = (await import('leaflet')).default
      const data = await getIDWGradient(80)
      const prices = data.points.map(p => p.pred_price)
      const min = Math.min(...prices), max = Math.max(...prices)
      const group = L.layerGroup()
      data.points.forEach(p => L.circleMarker([p.lat, p.lon], { radius: 3, fillColor: idwColor(p.pred_price, min, max), fillOpacity: 0.65, stroke: false }).addTo(group))
      currentLayerRef.current = group.addTo(leafletRef.current)
    } catch (e) { console.warn('IDW failed', e) }
  }

  const LAYER_LOADERS: Record<Layer, () => void> = { choropleth: loadChoropleth, heatmap: loadHeatmap, distribution: loadDistribution, idw: loadIDW }

  async function switchLayer(l: Layer) {
    setActiveLayer(l)
    LAYER_LOADERS[l]()
  }

  useEffect(() => {
    let map: any
    ;(async () => {
      if (!mapRef.current || leafletRef.current) return
      const L = (await import('leaflet')).default
      // Fix default icon
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png' })

      map = L.map(mapRef.current, { center: [-0.0236, 37.9062], zoom: 6, minZoom: 5, maxZoom: 13 })
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CartoDB © OpenStreetMap' }).addTo(map)
      leafletRef.current = map

      map.on('click', (e: any) => {
        setMapLat(e.latlng.lat)
        setMapLon(e.latlng.lng)
      })

      loadChoropleth()
    })()
    return () => { if (map) map.remove(); leafletRef.current = null }
  }, [])

  async function handleMapPredict() {
    if (!user) { alert('Please sign in to run predictions.'); return }
    setPredLoading(true)
    try {
      const data = await predict({
        latitude: mapLat, longitude: mapLon, size_acres: plotSize,
        zoning_type: 'residential', amenities_score: am * 10,
        accessibility_score: rd * 10, infrastructure_score: inf * 10,
        geocode_confidence: 1.0,
      })
      setPredResult(data)
      setShowResult(true)
    } catch (e: any) { alert(e.message) }
    finally { setPredLoading(false) }
  }

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 64px - 61px)', overflow: 'hidden' }}>
      {/* Leaflet map */}
      <div ref={mapRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />

      {/* Layer toggle bar */}
      <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(10,15,30,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9999, display: 'flex', alignItems: 'center', padding: 6, gap: 4 }}>
        {([['choropleth', '🗺 Choropleth'], ['heatmap', '🔥 Heatmap'], ['distribution', '📍 Distribution'], ['idw', '〰 IDW']] as [Layer, string][]).map(([id, label]) => (
          <button key={id} onClick={() => switchLayer(id)} className={`map-layer-btn ${activeLayer === id ? 'active' : ''}`}>{label}</button>
        ))}
      </div>

      {/* Legend */}
      <div style={{ position: 'absolute', bottom: 20, right: 360, zIndex: 10, background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: '12px 16px', width: 180 }}>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Price Tier (KSh)</div>
        <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'linear-gradient(90deg, var(--teal), var(--gold), var(--orange))', marginBottom: 4 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--text-secondary)' }}>
          <span>&lt;1M</span><span>50M</span><span>&gt;200M</span>
        </div>
      </div>

      {/* Predict panel */}
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, zIndex: 10, background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(16px)', borderLeft: '1px solid rgba(255,255,255,0.08)', padding: 20, overflowY: 'auto' }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16 }}>Predict from Map</div>

        <div style={{ padding: '10px 12px', background: 'rgba(20,184,166,0.06)', borderRadius: 8, border: '1px solid rgba(20,184,166,0.15)', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Selected Location</div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12 }}>{mapLat.toFixed(4)}, {mapLon.toFixed(4)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Click map to change</div>
        </div>

        {/* Sliders */}
        {[{ label: 'Plot Size (ac)', val: plotSize, min: 0.1, max: 50, step: 0.1, set: setPlotSize },
          { label: 'Amenities (×10)', val: am, min: 1, max: 10, step: 1, set: setAm },
          { label: 'Accessibility (×10)', val: rd, min: 1, max: 10, step: 1, set: setRd },
          { label: 'Infrastructure (×10)', val: inf, min: 1, max: 10, step: 1, set: setInf }].map(({ label, val, min, max, step, set }) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'var(--gold)' }}>{val}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={val} onChange={e => set(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--gold)' }} />
          </div>
        ))}

        <button className="btn-primary" onClick={handleMapPredict} disabled={predLoading} style={{ width: '100%', justifyContent: 'center', marginTop: 8, fontSize: 13 }}>
          {predLoading ? 'PREDICTING...' : '⚡ PREDICT PRICE'}
        </button>

        {showResult && predResult && (
          <div style={{ marginTop: 20, padding: 16, background: 'rgba(212,175,55,0.06)', borderRadius: 8, border: '1px solid var(--gold-border)', animation: 'fade-up 0.3s ease' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>Estimated Price</div>
            <div className="price-display" style={{ fontSize: 28, marginBottom: 4 }}>{fmtKsh(predResult.price_per_acre_ksh)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>per acre</div>
            <span className={`badge badge-${predResult.confidence_label.toLowerCase()}`}>{predResult.confidence_label} Confidence</span>
          </div>
        )}
      </div>
    </div>
  )
}
