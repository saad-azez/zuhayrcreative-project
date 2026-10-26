import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PAINTS } from '../layout'
import { a } from '../lib/assets'
import { DECK } from '../scene/props/printTextures'
import { ui, useUI } from './uiStore'

// The studio's colour card: opened by clicking the paint swatches on the floor (the fan deck) or on the wall. Every brand
// colour as a chip; a tap copies its hex.

let fontsAdded = false

type Chip = { label: string; hex: string }

// The official palette (Zuhayr Creative Brand Guideline, p. 10).
const GUIDELINE: Chip[] = [
  { label: 'DARK MAROON', hex: '#470015' },
  { label: 'SHADOW MAROON', hex: '#5C0020' },
  { label: 'LIGHT MAROON', hex: '#800020' },
  { label: 'CRIMSON RED', hex: '#DC143C' },
  { label: 'DEEP FOOTER', hex: '#38000E' },
  { label: 'PURE WHITE', hex: '#FFFFFF' },
]
// The current Zuhayr Creative Z is chrome over crimson (its colours are the paints and the guideline); the old pink logo's colours are gone.
const MARKS: Chip[] = [
  { label: 'ZH Z · 1', hex: '#D5143C' },
  { label: 'ZH Z · 2', hex: '#800020' },
  { label: 'BOX FRAME', hex: '#7D0E1F' },
  { label: 'BOX WALL', hex: '#6A0B1A' },
  { label: 'BOX CEILING', hex: '#3A0710' },
]
const PAINT_CHIPS: Chip[] = Object.values(PAINTS).map((p) => ({ label: p.name, hex: '#' + p.hex }))

const reset: CSSProperties = { border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }
const title: CSSProperties = { fontSize: 10, color: '#77777d', textTransform: 'uppercase', marginTop: 14, marginBottom: 8 }
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 8 }

export function BrandSwatches() {
  const { swatches } = useUI()
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (fontsAdded) return
    fontsAdded = true
    for (const [family, file] of [['ZC Anton', 'fonts/Anton-Regular.ttf'], ['ZC Geist Mono', 'fonts/GeistMono.ttf']]) {
      const f = new FontFace(family, `url(${a(file)})`)
      void f.load().then(() => document.fonts.add(f)).catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    if (!swatches) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') ui.set({ swatches: false }) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [swatches])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (!swatches) return null

  const chip = (c: Chip) => (
    <button
      key={c.label + c.hex}
      type="button"
      style={reset}
      onClick={() => {
        navigator.clipboard?.writeText(c.hex).catch(() => {})
        setCopied(c.hex)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setCopied(null), 1200)
      }}
    >
      <div style={{ width: '100%', height: 34, borderRadius: 4, background: c.hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }} />
      <div style={{ fontSize: 9, color: '#55555a', marginTop: 4 }}>{c.label}</div>
      <div style={{ fontSize: 11, color: '#1a1a1a' }}>{copied === c.hex ? 'COPIED' : c.hex.toUpperCase()}</div>
    </button>
  )

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: 'min(440px, calc(100% - 32px))',
        maxHeight: 'calc(100% - 32px)',
        overflowY: 'auto',
        background: '#fbfaf7',
        color: '#1a1a1a',
        borderRadius: 10,
        boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
        padding: '18px 18px 14px',
        fontFamily: "'ZC Geist Mono', ui-monospace, monospace",
        fontSize: 11,
        letterSpacing: '0.08em',
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: "'ZC Anton', sans-serif", fontSize: 22, letterSpacing: '0.06em' }}>ZUHAYR CREATIVE</div>
          <div style={{ fontSize: 10, color: '#77777d' }}>BRAND COLOUR — TAP A CHIP TO COPY ITS HEX</div>
        </div>
        <button type="button" aria-label="Close" onClick={() => ui.set({ swatches: false })} style={{ ...reset, fontSize: 22, lineHeight: 1 }}>
          ×
        </button>
      </div>

      <div style={title}>THE BRAND GUIDELINE</div>
      <div style={grid}>{GUIDELINE.map(chip)}</div>
      <div style={title}>THE MARKS</div>
      <div style={grid}>{MARKS.map(chip)}</div>

      <div style={title}>THE PAINTS</div>
      <div style={grid}>{PAINT_CHIPS.map(chip)}</div>

      <div style={title}>THE FAN DECK</div>
      {DECK.map((s) => (
        <div key={s.code} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: '#1a1a1a', marginBottom: 6 }}>{`${s.code} ${s.name}`}</div>
          <div style={grid}>{s.ramp.map((hex, i) => chip({ label: `${s.code}-${i + 1}`, hex }))}</div>
        </div>
      ))}
    </div>
  )
}
