import { use, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { MeshStandardMaterial, PlaneGeometry, Vector2 } from 'three'
import { LOOK } from '../../look'
import { usePBR } from '../../lib/assets'
import { canvasFonts } from './canvasFonts'
import { DECK, makeDeckTexture } from './printTextures'
import { ui } from '../../ui/uiStore'
import { sharedMaterial } from '../../lib/sharedMaterial'

// All ten strips are the same card: one material between them (lib/sharedMaterial.ts).
const STRIP_CARD = sharedMaterial('standard', { color: '#f6f4ef', roughness: 0.6 })

// A colour fan deck of the brand's reds, silvers and greys, fanned open like a peacock's tail and stood on its rivet, leaning
// back against the brush tin so the street sees every strip: ten printed strips, each a seven-step ramp with its codes. Desk-prop scale 2.2x (a 4.5 x 20 cm strip is 0.1 x 0.44 m).

const S = 2.2
const STRIP = { w: 0.045 * S, l: 0.2 * S, t: 0.0005 * S } as const
const PIVOT = { x: 1.4, y: 0.03, z: -0.78, lean: 0.36, yaw: -0.28 } as const
/** Fan angles in the deck's own plane (radians, 0 = straight up). */
const FAN = { from: -0.95, to: 0.95 } as const

export function FanDeck() {
  const gl = useThree((s) => s.gl)
  use(canvasFonts())
  const paper = usePBR('Paper001')
  const atlas = useMemo(() => makeDeckTexture(gl), [gl])
  const strips = useMemo(
    () =>
      DECK.map((_, k) => {
        // Each strip's printed face samples its own column of the atlas.
        const g = new PlaneGeometry(STRIP.w, STRIP.l)
        const uv = g.getAttribute('uv')
        for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / DECK.length)
        g.rotateX(-Math.PI / 2) // lying flat, face up
        g.rotateY(Math.PI) // its v = 1 end (the rivet end, the atlas top) toward +z, where the rivet is
        return g
      }),
    [],
  )
  const face = useMemo(
    () =>
      new MeshStandardMaterial({
        map: atlas,
        normalMap: paper.normalMap,
        normalScale: new Vector2(0.15, 0.15),
        roughness: 0.48,
        envMapIntensity: 0.7,
      }),
    [atlas, paper],
  )
  return (
    // Built lying flat (strips running toward -z, printed faces up), then stood up facing the street and leaned back.
    <group
      position={[PIVOT.x, PIVOT.y, PIVOT.z]}
      rotation={[0, PIVOT.yaw, 0]}
      onClick={(e) => { e.stopPropagation(); ui.set({ swatches: true }) }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = '' }}
    >
    <group rotation-x={Math.PI / 2 - PIVOT.lean}>
      {DECK.map((_, k) => {
        const ang = FAN.from + ((FAN.to - FAN.from) * k) / (DECK.length - 1)
        const y = 0.0006 + k * (STRIP.t + 0.0002)
        return (
          // Each strip turns about the rivet (near its +z end) and runs back from it.
          <group key={k} rotation-y={ang} position={[0, y, 0]}>
            <group position={[0, 0, -STRIP.l / 2 + 0.025]}>
              <RoundedBox args={[STRIP.w, STRIP.t, STRIP.l]} radius={STRIP.t / 2.2} smoothness={2} castShadow receiveShadow>
                <primitive object={STRIP_CARD} attach="material" />
              </RoundedBox>
              <mesh geometry={strips[k]} material={face} position={[0, STRIP.t / 2 + 0.00015, 0]} receiveShadow />
            </group>
          </group>
        )
      })}
      {/* The chrome rivet through all ten. */}
      <mesh position={[0, 0.0006 + (DECK.length * (STRIP.t + 0.0002)) / 2, 0.0]}>
        <cylinderGeometry args={[0.009, 0.009, DECK.length * (STRIP.t + 0.0002) + 0.004, 32]} />
        <meshPhysicalMaterial metalness={1} color={LOOK.chrome.color} roughness={0.1} envMapIntensity={LOOK.chrome.envMapIntensity} />
      </mesh>
      <mesh position={[0, 0.0006 + DECK.length * (STRIP.t + 0.0002) + 0.002, 0]}>
        <sphereGeometry args={[0.013, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial metalness={1} color={LOOK.chrome.color} roughness={0.1} envMapIntensity={LOOK.chrome.envMapIntensity} />
      </mesh>
    </group>
    </group>
  )
}
