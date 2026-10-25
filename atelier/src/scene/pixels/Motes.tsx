import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial, Vector2, Vector3, type PerspectiveCamera, type Points } from 'three'
import { LOOK, type SpotCfg } from '../../look'
import { ambientT } from '../../lib/time'
import { rand } from './math'

const COLORS = ['#f4efe3', '#ff2a45', '#e6e8ec', '#c4010d']

const VERT = /* glsl */ `
attribute vec4 aSeed;
attribute vec3 aColor;
uniform float uTime;
uniform float uSize;
uniform float uScale;
uniform vec3 uKeyLPos;
uniform vec3 uKeyLDir;
uniform vec2 uKeyLCone;
uniform vec3 uKeyRPos;
uniform vec3 uKeyRDir;
uniform vec2 uKeyRCone;
varying vec3 vColor;
varying float vB;
float cone(vec3 p, vec3 sp, vec3 sd, vec2 c) {
  return smoothstep(c.x, c.y, dot(normalize(p - sp), sd));
}
void main() {
  vec3 p = position;
  p.y = 0.1 + mod(p.y - 0.1 + uTime * 0.010 * (0.5 + aSeed.x), 2.8);
  p += 0.08 * vec3(sin(0.21*uTime + aSeed.x*6.2832), 0.6*sin(0.17*uTime + aSeed.y*6.2832), sin(0.13*uTime + aSeed.z*6.2832));
  vB = cone(p, uKeyLPos, uKeyLDir, uKeyLCone) + cone(p, uKeyRPos, uKeyRDir, uKeyRCone) + 0.05;
  vB *= 0.6 + 0.4 * sin(uTime * (0.8 + aSeed.w) + aSeed.y * 6.2832);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.5, uSize * (0.6 + 0.8 * aSeed.w) * uScale / -mv.z);
  vColor = aColor;
}`

const FRAG = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vB;
void main() {
  vec2 q = abs(gl_PointCoord - 0.5);
  float a = (1.0 - smoothstep(0.36, 0.5, max(q.x, q.y))) * vB * uOpacity;
  if (a < 0.002) discard;
  gl_FragColor = vec4(vColor * a, a);
}`

/** A spot's unit direction and its cone uniform (cos angle, cos of the penumbra's inner angle). */
function spotUniforms(cfg: SpotCfg) {
  const pos = new Vector3(...cfg.pos)
  const dir = new Vector3(...cfg.target).sub(pos).normalize()
  return { pos, dir, cone: new Vector2(Math.cos(cfg.angle), Math.cos(cfg.angle * (1 - cfg.penumbra))) }
}

// Tiny square pixels drifting up through the key spots' beams; brightness comes from how deep inside a beam each one is.
export function Motes() {
  const points = useRef<Points>(null)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)

  const kit = useMemo(() => {
    const n = LOOK.motes.count
    const position = new Float32Array(n * 3)
    const seed = new Float32Array(n * 4)
    const color = new Float32Array(n * 3)
    const tmp = new Color()
    for (let i = 0; i < n; i++) {
      position[i * 3] = -1.4 + 2.8 * rand(i, 30)
      position[i * 3 + 1] = 0.1 + 2.8 * rand(i, 31)
      position[i * 3 + 2] = -1.7 + 1.6 * rand(i, 32)
      for (let q = 0; q < 4; q++) seed[i * 4 + q] = rand(i, 33 + q)
      tmp.set(COLORS[Math.floor(rand(i, 37) * 4)])
      color.set([tmp.r, tmp.g, tmp.b], i * 3)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(position, 3))
    geo.setAttribute('aSeed', new BufferAttribute(seed, 4))
    geo.setAttribute('aColor', new BufferAttribute(color, 3))
    const L = spotUniforms(LOOK.spots.keyL)
    const R = spotUniforms(LOOK.spots.keyR)
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: LOOK.motes.size },
        uScale: { value: 1 },
        uOpacity: { value: LOOK.motes.opacity },
        uKeyLPos: { value: L.pos }, uKeyLDir: { value: L.dir }, uKeyLCone: { value: L.cone },
        uKeyRPos: { value: R.pos }, uKeyRDir: { value: R.dir }, uKeyRCone: { value: R.cone },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    })
    return { geo, mat }
  }, [])

  const camRef = useRef<PerspectiveCamera | null>(null)
  useFrame(({ clock, camera }) => {
    camRef.current = camera as PerspectiveCamera
    const u = kit.mat.uniforms
    u.uTime.value = ambientT(clock.elapsedTime)
    const fov = (camRef.current.fov * Math.PI) / 180
    u.uScale.value = (size.height * dpr) / (2 * Math.tan(fov / 2))
    u.uSize.value = LOOK.motes.size
    u.uOpacity.value = LOOK.motes.opacity
  })

  return <points ref={points} geometry={kit.geo} material={kit.mat} frustumCulled={false} />
}
