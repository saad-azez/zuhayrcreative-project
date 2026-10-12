import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide, PlaneGeometry, ShaderMaterial, type Mesh } from 'three'
import { ZMARK } from '../../layout'
import { LOOK } from '../../look'
import { loopT } from '../../lib/time'
import { SCAN_M, scanY } from './schedule'
import { ZMARK_BOTTOM, ZMARK_TOP } from './voxelZ'

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float edgeX = 1.0 - smoothstep(0.38, 0.5, abs(vUv.x - 0.5));
  float edgeY = 1.0 - smoothstep(0.3, 0.5, abs(vUv.y - 0.5));
  float line = (1.0 - smoothstep(0.0, 0.012, abs(vUv.y - 0.93))) * edgeX;
  float a = uOpacity * edgeX * edgeY + 0.9 * line;
  gl_FragColor = vec4(uColor * 3.0 * a, a);
}`

// The faint laser sheet that slices the mark at the scan line: a flat plane with a bright leading edge toward the viewer.
export function ScanSheet() {
  const mesh = useRef<Mesh>(null)
  const kit = useMemo(() => {
    const geo = new PlaneGeometry(1.5, 0.5)
    geo.rotateX(-Math.PI / 2)
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
      uniforms: { uColor: { value: new Color(LOOK.scan.color) }, uOpacity: { value: LOOK.scan.sheetOpacity } },
      vertexShader: VERT,
      fragmentShader: FRAG,
    })
    return { geo, mat }
  }, [])

  useFrame(({ clock }) => {
    const t = loopT(clock.elapsedTime)
    const y = scanY(t)
    const m = mesh.current
    if (!m) return
    m.position.y = y
    m.visible = y > ZMARK_BOTTOM - SCAN_M + 1e-4 && y < ZMARK_TOP + SCAN_M - 1e-4
  })

  return <mesh ref={mesh} geometry={kit.geo} material={kit.mat} position={[ZMARK.pos[0], 0, ZMARK.pos[2]]} visible={false} />
}
