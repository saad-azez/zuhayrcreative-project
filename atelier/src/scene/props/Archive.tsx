import { useMemo, useRef } from 'react'
import { useFrame, useLoader, type ThreeEvent } from '@react-three/fiber'
import { RoundedBox, Text } from '@react-three/drei'
import { Color, MeshPhysicalMaterial, SRGBColorSpace, TextureLoader, type Group, type MeshStandardMaterial } from 'three'
import { a } from '../../lib/assets'
import { FROZEN } from '../../lib/time'

// The Archive (17 Oct; the user, 11 Oct: "an interactable frosted-glass folder on the floor with drawers/trays/tabs (see-through
// contents, expandable; one tray = Careers → website careers page)"). A frosted-glass three-drawer file cabinet at desk-prop scale,
// standing on the black marble at the front right. Through the glass you see what's filed: hanging folders with index tabs and a
// hero piece per drawer. Click it: the drawers slide out in a cascade and the tabs come crisp; hover a drawer, it lifts and its
// label glows; click it, its page opens. Click the shell again (or leave it 12 s) and it closes. Frozen (poster): closed.

const W = 0.52 // outer width (local x)
const D = 0.34 // outer depth (local z; +z = the drawer fronts)
const H = 0.4 // outer height
const G = 0.008 // glass thickness
const FOOT = 0.012
const OPEN_H = (H - 2 * G) / 3 // each drawer's opening, 0.128
const IW = W - 2 * G // inner width
const FRONT_Z = D / 2 - 0.005 // a closed drawer front's centre
const IDLE_CLOSE_MS = 12000

const SITE = 'https://www.zuhayrcreative.org'
/** Bottom to top. `out` = how far the drawer slides when the cabinet opens. */
const DRAWERS = [
  { label: 'CONTACT', url: `${SITE}/contact`, out: 0.08 },
  { label: 'WORK', url: `${SITE}/#work`, out: 0.14 },
  { label: 'CAREERS', url: `${SITE}/career`, out: 0.2 },
] as const
const TAB_COLS = ['#f4efe3', '#c4010d', '#c9ccd1', '#5a0614', '#f4efe3']

function frost(thickness: number) {
  return new MeshPhysicalMaterial({
    color: '#eef2f4', metalness: 0, roughness: 0.38, transmission: 1, thickness, ior: 1.5,
    clearcoat: 1, clearcoatRoughness: 0.1, attenuationColor: new Color('#dce5ea'), attenuationDistance: 0.8, envMapIntensity: 1.0,
  })
}

function Chrome() {
  return <meshPhysicalMaterial metalness={1} color="#ffffff" roughness={0.06} envMapIntensity={2.2} />
}

const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }

export function Archive() {
  const shell = useMemo(() => frost(0.01), [])
  const pane = useMemo(() => frost(0.012), [])
  const thin = useMemo(() => frost(0.005), [])
  const photos = useLoader(TextureLoader, [1, 2, 3, 4].map((n) => a(`laptop/site-${n}-${['hero', 'ai', 'services', 'work'][n - 1]}.jpg`)))
  useMemo(() => photos.forEach((t) => { t.colorSpace = SRGBColorSpace }), [photos])

  const drawers = useRef<(Group | null)[]>([])
  const labels = useRef<(MeshStandardMaterial | null)[]>([])
  const st = useRef({ open: false, openedAt: 0, lastHover: 0, hover: -1, z: [0, 0, 0], glow: [0, 0, 0] })

  const setOpen = (v: boolean) => {
    const s = st.current
    s.open = v
    s.openedAt = performance.now()
    s.lastHover = performance.now()
  }

  useFrame((_, dt) => {
    if (FROZEN) return
    const s = st.current
    const now = performance.now()
    if (s.open && now - s.lastHover > IDLE_CLOSE_MS) s.open = false
    const since = (now - s.openedAt) / 1000
    for (let k = 0; k < 3; k++) {
      // The cascade: the top drawer first, each lower one 0.08 s later.
      const started = s.open && since > (2 - k) * 0.08
      const target = started ? DRAWERS[k].out + (s.hover === k ? 0.02 : 0) : 0
      s.z[k] += (target - s.z[k]) * (1 - Math.exp(-dt * 9))
      const g = drawers.current[k]
      if (g) g.position.z = FRONT_Z + s.z[k]
      const glowT = s.open && s.hover === k ? 0.6 : 0
      s.glow[k] += (glowT - s.glow[k]) * (1 - Math.exp(-dt * 10))
      const m = labels.current[k]
      if (m) m.emissiveIntensity = s.glow[k]
    }
  })

  const shellClick = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setOpen(!st.current.open) }

  return (
    <group position={[1.88, 0, -0.38]} rotation-y={-0.5}>
      {/* Chrome feet. */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (W / 2 - 0.04), FOOT / 2, sz * (D / 2 - 0.04)]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, FOOT, 24]} />
          <Chrome />
        </mesh>
      ))}

      {/* The frosted shell: bottom, top, sides, back. Click it to open / close. */}
      <group position={[0, FOOT, 0]} onClick={shellClick} onPointerOver={over} onPointerOut={() => { document.body.style.cursor = '' }}>
        <RoundedBox args={[W, G, D]} radius={0.003} smoothness={2} position={[0, G / 2, 0]} material={shell} castShadow receiveShadow />
        <RoundedBox args={[W, G, D]} radius={0.003} smoothness={2} position={[0, H - G / 2, 0]} material={shell} castShadow receiveShadow />
        <RoundedBox args={[G, H - 2 * G, D]} radius={0.002} smoothness={2} position={[-(W / 2 - G / 2), H / 2, 0]} material={shell} castShadow />
        <RoundedBox args={[G, H - 2 * G, D]} radius={0.002} smoothness={2} position={[W / 2 - G / 2, H / 2, 0]} material={shell} castShadow />
        <RoundedBox args={[W - 2 * G, H - 2 * G, G]} radius={0.002} smoothness={2} position={[0, H / 2, -D / 2 + G / 2]} material={shell} castShadow />
        {/* Etched on the lid, by the front edge. */}
        <Text font={a('fonts/GeistMono.ttf')} fontSize={0.012} letterSpacing={0.2} anchorX="center" anchorY="middle" position={[0, H + 0.0006, D / 2 - 0.03]} rotation-x={-Math.PI / 2}>
          ZUHAYR CREATIVE — ARCHIVE
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
        </Text>
      </group>

      {/* The three drawers (bottom to top). Each drawer group's origin is the centre of its front pane. */}
      {DRAWERS.map((dw, k) => {
        const y = FOOT + G + OPEN_H * k + OPEN_H / 2
        const bodyD = D - 0.03
        const bodyW = IW - 0.012
        const click = (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          if (!st.current.open) setOpen(true)
          else window.location.assign(dw.url)
        }
        const hoverIn = (e: ThreeEvent<PointerEvent>) => {
          over(e)
          st.current.hover = k
          st.current.lastHover = performance.now()
        }
        const hoverOut = () => {
          if (st.current.hover === k) st.current.hover = -1
          document.body.style.cursor = ''
        }
        return (
          <group key={dw.label} ref={(g) => { drawers.current[k] = g }} position={[0, y, FRONT_Z]} onClick={click} onPointerOver={hoverIn} onPointerOut={hoverOut}>
            {/* Front pane, chrome pull, chrome label holder with its printed card. */}
            <RoundedBox args={[IW - 0.004, OPEN_H - 0.006, 0.01]} radius={0.003} smoothness={2} material={pane} castShadow />
            <mesh position={[0, -0.02, 0.022]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.005, 0.005, 0.15, 20]} />
              <Chrome />
            </mesh>
            {[-0.06, 0.06].map((px) => (
              <mesh key={px} position={[px, -0.02, 0.0125]} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.003, 0.003, 0.015, 12]} />
                <Chrome />
              </mesh>
            ))}
            <RoundedBox args={[0.13, 0.04, 0.003]} radius={0.0012} smoothness={2} position={[0, 0.026, 0.0065]}>
              <Chrome />
            </RoundedBox>
            <mesh position={[0, 0.026, 0.0082]}>
              <planeGeometry args={[0.122, 0.032]} />
              <meshStandardMaterial ref={(m) => { labels.current[k] = m }} color="#fbfaf7" roughness={0.6} emissive="#c4010d" emissiveIntensity={0} />
            </mesh>
            <Text font={a('fonts/Anton-Regular.ttf')} fontSize={0.018} letterSpacing={0.08} anchorX="center" anchorY="middle" position={[0, 0.026, 0.0086]}>
              {dw.label}
              <meshBasicMaterial color="#c4010d" />
            </Text>

            {/* The drawer's body: a frosted tray behind the front. */}
            <group position={[0, 0, -0.005]}>
              <mesh position={[0, -0.055, -bodyD / 2]} material={thin}>
                <boxGeometry args={[bodyW, 0.004, bodyD]} />
              </mesh>
              <mesh position={[-bodyW / 2, -0.01, -bodyD / 2]} material={thin}>
                <boxGeometry args={[0.004, 0.09, bodyD]} />
              </mesh>
              <mesh position={[bodyW / 2, -0.01, -bodyD / 2]} material={thin}>
                <boxGeometry args={[0.004, 0.09, bodyD]} />
              </mesh>
              <mesh position={[0, -0.01, -bodyD]} material={thin}>
                <boxGeometry args={[bodyW, 0.09, 0.004]} />
              </mesh>

              {/* Hanging file folders with staggered index tabs. */}
              {[0, 1, 2, 3, 4].map((j) => (
                <group key={j} position={[0, -0.01, -0.06 - j * 0.05]}>
                  <mesh castShadow>
                    <boxGeometry args={[bodyW - 0.03, 0.085, 0.002]} />
                    <meshStandardMaterial color={j % 2 ? '#e9e4d8' : '#f4efe3'} roughness={0.85} />
                  </mesh>
                  <RoundedBox args={[0.07, 0.022, 0.002]} radius={0.004} smoothness={2} position={[-0.16 + j * 0.08, 0.05, 0]}>
                    <meshStandardMaterial color={TAB_COLS[j]} roughness={0.5} />
                  </RoundedBox>
                </group>
              ))}

              {/* The drawer's hero piece. */}
              {dw.label === 'CAREERS' && (
                <group position={[0, -0.005, -0.03]}>
                  <RoundedBox args={[0.2, 0.1, 0.002]} radius={0.004} smoothness={2} castShadow>
                    <meshPhysicalMaterial color="#c4010d" roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.2} />
                  </RoundedBox>
                  <Text font={a('fonts/Anton-Regular.ttf')} fontSize={0.022} letterSpacing={0.06} anchorX="center" anchorY="middle" position={[0, 0.012, 0.0012]}>
                    WE'RE HIRING
                    <meshBasicMaterial color="#ffffff" />
                  </Text>
                  <Text font={a('fonts/GeistMono.ttf')} fontSize={0.008} letterSpacing={0.16} anchorX="center" anchorY="middle" position={[0, -0.018, 0.0012]}>
                    CAREERS · ZUHAYR CREATIVE
                    <meshBasicMaterial color="#f4efe3" />
                  </Text>
                </group>
              )}
              {dw.label === 'WORK' &&
                photos.map((t, n) => (
                  <mesh key={n} position={[-0.12 + n * 0.08, -0.008, -0.035 - n * 0.045]} rotation-x={-0.15} castShadow>
                    <planeGeometry args={[0.14, 0.0875]} />
                    <meshStandardMaterial map={t} roughness={0.45} />
                  </mesh>
                ))}
              {dw.label === 'CONTACT' && (
                <>
                  <RoundedBox args={[0.17, 0.08, 0.02]} radius={0.003} smoothness={2} position={[-0.05, -0.013, -0.05]} castShadow>
                    <meshStandardMaterial color="#fbfaf7" roughness={0.7} />
                  </RoundedBox>
                  <Text font={a('fonts/Anton-Regular.ttf')} fontSize={0.014} letterSpacing={0.1} anchorX="center" anchorY="middle" position={[-0.05, -0.008, -0.0395]}>
                    ZUHAYR CREATIVE
                    <meshBasicMaterial color="#1a1a1a" />
                  </Text>
                  <RoundedBox args={[0.2, 0.08, 0.004]} radius={0.002} smoothness={2} position={[0.04, -0.013, -0.12]} castShadow>
                    <meshStandardMaterial color="#c4010d" roughness={0.55} />
                  </RoundedBox>
                </>
              )}
            </group>
          </group>
        )
      })}
    </group>
  )
}
