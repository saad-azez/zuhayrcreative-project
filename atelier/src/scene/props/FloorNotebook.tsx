import { useMemo } from 'react'
import { useLoader, useThree, type ThreeEvent } from '@react-three/fiber'
import { Box3, Vector3, type Mesh } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { a } from '../../lib/assets'
import { StaticBatch } from '../../lib/StaticBatch'

// The user's journal (the frozen red notebook from ZASHFIRE, closed and strapped, public/models/journal-closed.glb) lies on the
// paper floor at the front left, between the desk and the turntable, at desk-prop scale. Clicking it goes to the website's NOTES
// page (17 Oct, the user). Only placed and wired here: the model, its leather and its textures are never changed.

/** The website's NOTES page (24 Oct, the user: the link was meant to be here). */
const NOTES_URL = "/notes"

const S = 2.2 // desk-prop scale, like the laptop and the brushes
/** The journal's own units: its 210 mm length spans 2.23 of them. */
const UNIT = 0.21 / 2.23
const AT = { x: -0.84, y: 0.003, z: -0.5, yaw: 0.35 } as const

export function FloorNotebook() {
  const gl = useThree((s) => s.gl)
  // The shop's own build of it (scripts/pack-journal-shop.mjs): the same journal at the detail its ~107 px can show.
  const gltf = useLoader(GLTFLoader, a('models/journal-shop.glb'), (l) => {
    l.setKTX2Loader(new KTX2Loader().setTranscoderPath(a('basis/')).detectSupport(gl))
    l.setMeshoptDecoder(MeshoptDecoder)
  })
  const offset = useMemo(() => {
    gltf.scene.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true }
    })
    // Centre it on its spot and stand it on the paper.
    const box = new Box3().setFromObject(gltf.scene)
    const c = box.getCenter(new Vector3())
    return [-c.x, -box.min.y, -c.z] as [number, number, number]
  }, [gltf])

  const go = (e: ThreeEvent<MouseEvent>) => {
    if (!NOTES_URL) return
    e.stopPropagation()
    window.location.assign(NOTES_URL)
  }
  return (
    <group
      position={[AT.x, AT.y, AT.z]}
      rotation-y={AT.yaw}
      scale={S * UNIT}
      onClick={go}
      onPointerOver={(e) => { if (!NOTES_URL) return; e.stopPropagation(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { if (NOTES_URL) document.body.style.cursor = '' }}
    >
      {/* It never moves: its solid parts are drawn merged (same pixels, a fraction of the draw calls). */}
      <StaticBatch>
        <primitive object={gltf.scene} position={offset} />
      </StaticBatch>
    </group>
  )
}
