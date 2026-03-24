import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtKsh(value: number): string {
  if (value >= 1_000_000) return `KSh ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `KSh ${(value / 1_000).toFixed(0)}K`
  return `KSh ${value.toFixed(0)}`
}

export function fmtKshFull(value: number): string {
  return `KSh ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`
}

export function confidenceColor(label: string): string {
  if (label === 'High') return 'text-teal border-teal/30 bg-teal/10'
  if (label === 'Low') return 'text-orange border-orange/30 bg-orange/10'
  return 'text-gold border-gold/30 bg-gold/10'
}

export function priceClassColor(cls: number | null): string {
  const map: Record<number, string> = {
    1: 'rgba(20,184,166,0.15)',
    2: 'rgba(20,184,166,0.35)',
    3: 'rgba(212,175,55,0.25)',
    4: 'rgba(212,175,55,0.50)',
    5: 'rgba(212,175,55,0.80)',
  }
  return map[cls ?? 0] ?? 'rgba(255,255,255,0.04)'
}

export function idwColor(value: number, min: number, max: number): string {
  const t = (value - min) / (max - min || 1)
  if (t < 0.33) return '#14B8A6'
  if (t < 0.66) return '#D4AF37'
  return '#EC5B13'
}
