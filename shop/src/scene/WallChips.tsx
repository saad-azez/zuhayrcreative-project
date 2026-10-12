import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { ui } from '../ui/uiStore'
import { sharedMaterial } from '../lib/sharedMaterial'

// The same card stock, pin head and needle on every chip: one material each (lib/sharedMaterial.ts).
const CARD = sharedMaterial('standard', { color: '#f7f5f0', roughness: 0.7 })
const PIN_HEAD = sharedMaterial('physical', { color: '#c4010d', roughness: 0.15, clearcoat: 1 })
const PIN_NEEDLE = sharedMaterial('standard', { color: '#cfd2d6', metalness: 1, roughness: 0.3 })

// Four colour chips pinned to the paper wall like a paint-shop swatch card: real 3D cards (so they cast a soft shadow on the
// paper) whose front face is a printed swatch with the name, hex and studio line.

const WALL_Z = -1.8565
const CW = 0.15
const CH = 0.21

type Chip = { name: string; hex: string; color: string; x: number; y: number; rz: number }

const CHIPS: readonly Chip[] = [
  { name: 'PEARL WHITE', hex: 'F4EFE3', color: '#f4efe3', x: 1.45, y: 2.18, rz: 0.04 },
  { name: 'ZUHAYR CRIMSON', hex: 'C4010D', color: '#c4010d', x: 1.42, y: 1.94, rz: -0.05 },
  { name: 'OXBLOOD', hex: '5A0614', color: '#5a0614', x: 1.36, y: 1.7, rz: 0.03 },
  { name: 'LIQUID CHROME', hex: 'C9CCD1', color: '#c9ccd1', x: 1.28, y: 1.46, rz: -0.06 },
]

/** Paints one chip's front face: a white card with the swatch, the name, the hex and the studio line. */
function chipCanvas(chip: Chip): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 716
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fbfaf7'
  ctx.fillRect(0, 0, 512, 716)
  if (chip.hex === 'C9CCD1') {
    // Liquid chrome reads as metal: a bright-to-dark-to-bright vertical sweep.
    const grad = ctx.createLinearGradient(0, 24, 0, 500)
    grad.addColorStop(0, '#eef0f3')
    grad.addColorStop(0.5, '#9a9ea6')
    grad.addColorStop(1, '#d9dce0')
    ctx.fillStyle = grad
  } else {
    ctx.fillStyle = chip.color
  }
  ctx.fillRect(24, 24, 464, 476)
  if (chip.hex === 'F4EFE3') {
    // Pearl is nearly the card's own white, so it gets a hairline edge.
    ctx.strokeStyle = '#d8d2c4'
    ctx.lineWidth = 2
    ctx.strokeRect(24, 24, 464, 476)
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#111111'
  ctx.font = "bold 44px 'Arial Narrow', Arial, sans-serif"
  ctx.fillText(chip.name, 28, 572)
  ctx.fillStyle = '#555555'
  ctx.font = '30px monospace'
  ctx.fillText(chip.hex, 28, 616)
  ctx.fillStyle = '#888888'
  ctx.font = '22px monospace'
  ctx.fillText('ZUHAYR CREATIVE', 28, 676)
  return c
}

export function WallChips() {
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const textures = useMemo(
    () =>
      CHIPS.map((chip) => {
        const tex = new CanvasTexture(chipCanvas(chip))
        tex.colorSpace = SRGBColorSpace
        tex.anisotropy = maxAniso
        return tex
      }),
    [maxAniso],
  )

  return (
    <group
      onClick={(e) => { e.stopPropagation(); ui.set({ swatches: true }) }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = '' }}
    >
      {CHIPS.map((chip, n) => (
        <group key={chip.hex} position={[chip.x, chip.y, WALL_Z]} rotation={[0, 0, chip.rz]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[CW, CH, 0.003]} />
            {/* Box groups run +x, -x, +y, -y, +z, -z; only the +z face carries the printed swatch. */}
            <primitive object={CARD} attach="material-0" />
            <primitive object={CARD} attach="material-1" />
            <primitive object={CARD} attach="material-2" />
            <primitive object={CARD} attach="material-3" />
            <meshStandardMaterial attach="material-4" map={textures[n]} roughness={0.55} />
            <primitive object={CARD} attach="material-5" />
          </mesh>
          {/* The pin: a glossy crimson head over a steel needle, at the card's top centre. */}
          <group position={[0, 0.085, 0.0015]}>
            <mesh position={[0, 0, 0.011]} castShadow>
              <sphereGeometry args={[0.009, 20, 14]} />
              <primitive object={PIN_HEAD} attach="material" />
            </mesh>
            <mesh position={[0, 0, 0.004]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.0012, 0.0012, 0.012, 8]} />
              <primitive object={PIN_NEEDLE} attach="material" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}
