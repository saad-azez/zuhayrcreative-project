import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry, type Group } from 'three'
import { TURNTABLE, zYaw } from '../layout'
import { LOOK } from '../look'
import { usePBR } from '../lib/assets'
import { loopT } from '../lib/time'
import { worldBoxUV } from '../lib/worldUV'

/** The light cool-grey marble turntable under the Z (Marble003, ambientCG CC0 4K; 11 Oct, the user: lighter cool grey): a still shadow gap at the floor, and a top that turns with the mark. */
export function Turntable() {
  const pbr = usePBR('Marble003')
  const bodyH = TURNTABLE.h - 0.012 - 0.012
  const body = useMemo(() => {
    const g = new CylinderGeometry(TURNTABLE.r, TURNTABLE.r, bodyH, 128)
    g.translate(0, 0.012 + bodyH / 2, 0)
    return worldBoxUV(g, LOOK.marble.tile)
  }, [bodyH])
  const turning = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (turning.current) turning.current.rotation.y = zYaw(loopT(clock.elapsedTime))
  })

  const chrome = (
    <meshPhysicalMaterial metalness={1} color={LOOK.chrome.color} roughness={LOOK.chrome.roughness} envMapIntensity={LOOK.chrome.envMapIntensity} />
  )
  return (
    <>
      <mesh position={[TURNTABLE.x, 0.006, TURNTABLE.z]}>
        <cylinderGeometry args={[TURNTABLE.r - 0.04, TURNTABLE.r - 0.04, 0.012, 96]} />
        <meshStandardMaterial color="#080808" roughness={0.6} />
      </mesh>
      <group ref={turning} position={[TURNTABLE.x, 0, TURNTABLE.z]}>
        <mesh geometry={body} castShadow receiveShadow>
          <meshPhysicalMaterial {...pbr} roughness={1} clearcoat={1} clearcoatRoughness={0.06} envMapIntensity={0.8} />
        </mesh>
        <mesh position={[0, TURNTABLE.h - 0.006, 0]}>
          <cylinderGeometry args={[TURNTABLE.r + 0.004, TURNTABLE.r + 0.004, 0.012, 128, 1, true]} />
          {chrome}
        </mesh>
        <mesh position={[0, TURNTABLE.h + 0.0005, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[TURNTABLE.r - 0.012, TURNTABLE.r + 0.004, 128]} />
          {chrome}
        </mesh>
      </group>
    </>
  )
}
