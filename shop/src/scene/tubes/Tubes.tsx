import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useKTX2 } from '@react-three/drei'
import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Quaternion,
  Vector3,
  type Group,
  type Texture,
} from 'three'
import { BOX, TL, TUBE, TUBES, pourOf, type TubeDef } from '../../layout'
import { LOOK } from '../../look'
import { a, TEX_VERSION, usePBR, texDir } from '../../lib/assets'
import { loopT } from '../../lib/time'
import { makeLabelTextures } from './labelTexture'
import { buildBody, buildNeck, buildRollBackings, buildRollEnds, buildRollShells } from './tubeGeometry'
import { ANCHOR, addSqueeze, squeeze, swingQuat } from './motion'
import { squirtSqueeze } from '../interact/squirtStore'

const R = TUBE.R
const Q = new Quaternion()
const V = new Vector3()
const PRINTS = ['toile', 'damask', 'egypt', 'durer', 'durer_mr'] as const

// Everything the four tubes share (materials, geometry) or own one of each (bodies, labels), built once.
function useTubeKit() {
  const gl = useThree((s) => s.gl)
  const foil = usePBR('Foil003', { color: false })
  const prints = useKTX2(PRINTS.map((n) => a(`${texDir()}print_${n}.ktx2?v=${TEX_VERSION}`)), a('basis/')) as Texture[]

  return useMemo(() => {
    const aniso = gl.capabilities.getMaxAnisotropy()
    foil.normalMap.repeat.set(...LOOK.tubeWrap.foilRepeat)
    foil.roughnessMap.repeat.set(...LOOK.tubeWrap.foilRepeat)
    prints.forEach((t, i) => {
      t.colorSpace = PRINTS[i] === 'durer_mr' ? NoColorSpace : SRGBColorSpace
      t.wrapS = t.wrapT = RepeatWrapping
      t.anisotropy = aniso
      t.needsUpdate = true
    })
    const [toile, damask, egypt, durer, durerMr] = prints
    const W = LOOK.tubeWrap
    const normalScale = new Vector2(W.normalScale, W.normalScale)
    const printed = (map: Texture) =>
      new MeshPhysicalMaterial({
        map,
        normalMap: foil.normalMap,
        roughnessMap: foil.roughnessMap,
        metalness: W.metalness,
        roughness: W.roughness,
        clearcoat: W.clearcoat,
        clearcoatRoughness: W.clearcoatRoughness,
        clearcoatNormalMap: foil.normalMap,
        clearcoatNormalScale: new Vector2(W.clearcoatNormalScale, W.clearcoatNormalScale),
        normalScale: normalScale.clone(),
        envMapIntensity: W.envMapIntensity,
      })
    const wrap = {
      toile: printed(toile),
      damask: printed(damask),
      egypt: printed(egypt),
      durer: new MeshPhysicalMaterial({
        map: durer,
        metalnessMap: durerMr,
        roughnessMap: durerMr,
        metalness: 1,
        roughness: 1,
        normalMap: foil.normalMap,
        normalScale: normalScale.clone(),
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.6,
      }),
    }
    const metal = new MeshPhysicalMaterial({
      color: LOOK.tubeMetal.color,
      metalness: 1,
      roughness: LOOK.tubeMetal.roughness,
      normalMap: foil.normalMap,
      normalScale: new Vector2(0.4, 0.4),
      envMapIntensity: LOOK.tubeMetal.envMapIntensity,
      side: DoubleSide,
    })
    const innerMetal = new MeshPhysicalMaterial({
      color: '#8d9095',
      metalness: 1,
      roughness: LOOK.tubeMetal.roughness,
      normalMap: foil.normalMap,
      normalScale: new Vector2(0.4, 0.4),
      envMapIntensity: LOOK.tubeMetal.envMapIntensity,
      side: DoubleSide,
    })
    const chrome = new MeshPhysicalMaterial({
      color: LOOK.chrome.color,
      metalness: 1,
      roughness: LOOK.chrome.roughness,
      envMapIntensity: LOOK.chrome.envMapIntensity,
    })
    const backing = new MeshStandardMaterial({ color: '#141414', roughness: 0.7 })
    const labels = TUBES.map((tube) => {
      const { map, mr } = makeLabelTextures(tube, aniso)
      return new MeshPhysicalMaterial({
        map,
        metalnessMap: mr,
        roughnessMap: mr,
        metalness: 1,
        roughness: 1,
        clearcoat: 0.25,
        clearcoatRoughness: 0.3,
        envMapIntensity: 1.2,
      })
    })

    // Each tube's squeeze drives its own wrap and label (every print belongs to exactly one tube).
    const squeezes = TUBES.map((tube) => [addSqueeze(wrap[tube.print], tube), addSqueeze(labels[tube.index], tube)])

    const bodies = TUBES.map((tube) => buildBody(0.11 + 0.37 * tube.index))
    const band = new CylinderGeometry(R + 0.0015, R + 0.0015, 0.22, 160, 1, true, Math.PI, 2 * Math.PI)
    band.translate(0, -0.69, 0)
    const bar = new CylinderGeometry(0.012, 0.012, 0.56, 24)
    bar.rotateZ(Math.PI / 2)
    const collar = new CylinderGeometry(0.018, 0.018, 0.02, 24)
    collar.rotateZ(Math.PI / 2)
    const crossbar = new CylinderGeometry(0.007, 0.007, 0.49, 16)
    crossbar.rotateZ(Math.PI / 2)

    return {
      wrap,
      squeezes,
      metal,
      innerMetal,
      chrome,
      backing,
      labels,
      bodies,
      neck: buildNeck(),
      shells: buildRollShells(),
      ends: buildRollEnds(),
      backings: buildRollBackings(),
      band,
      bar,
      collar,
      crossbar,
      wing: new SphereGeometry(1, 32, 16),
      arm: new CylinderGeometry(0.007, 0.007, 0.12, 16),
      joint: new SphereGeometry(0.011, 16, 12),
      disc: new CylinderGeometry(0.03, 0.03, 0.012, 32),
    }
  }, [gl, foil, prints])
}
type Kit = ReturnType<typeof useTubeKit>

function Tube({ tube, kit }: { tube: TubeDef; kit: Kit }) {
  const keyRef = useRef<Group>(null)
  const cos = Math.cos(tube.tilt)
  const Lrod = (BOX.h - (tube.key[1] + 0.12 * TUBE.k * cos)) / (cos * TUBE.k) // in the scaled group's units
  const rod = useMemo<BufferGeometry>(() => new CylinderGeometry(0.006, 0.006, Lrod, 12), [Lrod])

  // The key turns while its tube pours (and unwinds as the pixels fly back); the tube swings gently on its rod and is
  // squeezed (motion.ts). All pure functions of the loop time.
  const swingRef = useRef<Group>(null)
  useFrame(({ clock }) => {
    const t = loopT(clock.elapsedTime)
    const g = swingRef.current
    if (g) {
      swingQuat(tube, t, Q)
      g.quaternion.copy(Q)
      g.position.copy(ANCHOR[tube.index]).sub(V.copy(ANCHOR[tube.index]).applyQuaternion(Q))
    }
    const sq = squeeze(tube, t)
    const sqAll = Math.max(sq, squirtSqueeze(tube.index, performance.now()))
    for (const u of kit.squeezes[tube.index]) u.value = sqAll
    const [p0, p1] = pourOf(tube)
    const progress =
      t < p0 ? 0 : t < p1 ? (t - p0) / (p1 - p0) : t < TL.undo[0] ? 1 : t < TL.undo[1] ? 1 - (t - TL.undo[0]) / (TL.undo[1] - TL.undo[0]) : 0
    if (keyRef.current) keyRef.current.rotation.x = -Math.PI * 1.5 * progress
  })

  const h = tube.handle
  return (
    <>
      <group ref={swingRef}>
      <group position={[tube.key[0], tube.key[1], tube.key[2]]} rotation-z={tube.tilt} scale={TUBE.k}>
        <mesh geometry={kit.bodies[tube.index]} material={kit.wrap[tube.print]} castShadow receiveShadow />
        <mesh geometry={kit.neck} material={kit.metal} castShadow receiveShadow />
        <mesh geometry={kit.band} material={kit.labels[tube.index]} castShadow receiveShadow />
        {kit.shells.map((g, i) => (
          <mesh key={i} geometry={g} material={i === 0 ? kit.wrap[tube.print] : kit.innerMetal} castShadow receiveShadow />
        ))}
        {kit.ends.map((g, i) => (
          <mesh key={i} geometry={g} material={kit.metal} />
        ))}
        {kit.backings.map((g, i) => (
          <mesh key={i} geometry={g} material={kit.backing} />
        ))}

        <group ref={keyRef}>
          <mesh geometry={kit.bar} material={kit.chrome} position={[h * 0.03, 0, 0]} castShadow />
          <mesh geometry={kit.wing} material={kit.chrome} position={[h * 0.315, 0, 0]} scale={[0.008, 0.05, 0.035]} castShadow />
          <mesh geometry={kit.collar} material={kit.chrome} position={[h * 0.295, 0, 0]} castShadow />
        </group>

        <mesh geometry={kit.arm} material={kit.chrome} position={[-0.245, 0.06, 0]} castShadow />
        <mesh geometry={kit.arm} material={kit.chrome} position={[0.245, 0.06, 0]} castShadow />
        <mesh geometry={kit.crossbar} material={kit.chrome} position={[0, 0.12, 0]} castShadow />
        <mesh geometry={kit.joint} material={kit.chrome} position={[-0.245, 0, 0]} castShadow />
        <mesh geometry={kit.joint} material={kit.chrome} position={[0.245, 0, 0]} castShadow />
        <mesh geometry={kit.joint} material={kit.chrome} position={[-0.245, 0.12, 0]} castShadow />
        <mesh geometry={kit.joint} material={kit.chrome} position={[0.245, 0.12, 0]} castShadow />
        <mesh geometry={rod} material={kit.chrome} position={[0, 0.12 + Lrod / 2, 0]} castShadow />
      </group>
      </group>
      <mesh
        geometry={kit.disc}
        material={kit.chrome}
        position={[tube.key[0] - Math.sin(tube.tilt) * (0.12 + Lrod) * TUBE.k, BOX.h - 0.006, tube.key[2]]}
        castShadow
      />
    </>
  )
}

export function Tubes() {
  const kit = useTubeKit()
  return (
    <>
      {TUBES.map((t) => (
        <Tube key={t.id} tube={t} kit={kit} />
      ))}
    </>
  )
}
