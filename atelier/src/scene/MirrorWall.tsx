import { useEffect, useMemo } from 'react'
import { Text } from '@react-three/drei'
import { Color, PlaneGeometry } from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { BOX, SIDE } from '../layout'
import { LOOK } from '../look'
import { a } from '../lib/assets'
import { logoTexture } from '../lib/logoTexture'
import { renderFrame } from './RenderBudget'

// The whole left wall is a real planar mirror, so the viewer sees the tubes, the Z and the room folded back on themselves.
// The stock reflector shader overlay-blends its tint; this copy multiplies instead, which keeps the mirror's blacks black.
const MirrorShader = {
  name: 'MirrorShader',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4( position, 1.0 );
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec4 base = texture2DProj( tDiffuse, vUv );
      gl_FragColor = vec4( base.rgb * color, 1.0 );
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}

const MX = -(BOX.halfW + BOX.backHalfW) / 2 + 0.005 * Math.cos(SIDE.splay)
const MY = BOX.h / 2
const MZ = BOX.backZ / 2 + 0.005 * Math.sin(SIDE.splay)
const RY = Math.PI / 2 - SIDE.splay

export function MirrorWall() {
  const zc = useMemo(() => logoTexture('zc-wordmark', 1318), [])
  const zh = useMemo(() => logoTexture('zh-z', 256, { mono: '#e4e6ea' }), [])
  const mirror = useMemo(() => {
    const geo = new PlaneGeometry(SIDE.len - 0.02, BOX.h - 0.02)
    const m = new Reflector(geo, {
      shader: MirrorShader,
      color: new Color(...LOOK.mirror.tint),
      textureWidth: LOOK.mirror.resolution[0],
      textureHeight: LOOK.mirror.resolution[1],
      clipBias: LOOK.mirror.clipBias,
      multisample: 4,
    })
    m.position.set(MX, MY, MZ)
    m.rotation.y = RY
    // The reflector re-renders the whole scene on every onBeforeRender (the floor reflector, the transmission pre-passes, the main
    // pass); only two viewer cameras are distinct, so render at most once per (frame, camera): the texture would be identical.
    const renderOnce = m.onBeforeRender
    let at = -1
    const seen = new Set<string>()
    m.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
      if (at !== renderFrame) { at = renderFrame; seen.clear() }
      if (seen.has(camera.uuid)) return // already rendered for this viewer this frame: the texture is identical
      seen.add(camera.uuid)
      renderOnce.call(this, renderer, scene, camera, geometry, material, group)
    }
    return m
  }, [])
  useEffect(() => () => mirror.dispose(), [mirror])

  const chrome = (
    <meshPhysicalMaterial metalness={1} color={LOOK.chrome.color} roughness={LOOK.chrome.roughness} envMapIntensity={LOOK.chrome.envMapIntensity} />
  )
  return (
    <>
      <primitive object={mirror} />
      {/* Hairline chrome trims: the group shares the mirror's pose, so local x runs along the wall toward the back. */}
      <group position={[MX, MY, MZ]} rotation-y={RY}>
        <mesh position={[0, BOX.h / 2 - 0.006, 0.006]}>
          <boxGeometry args={[SIDE.len, 0.012, 0.012]} />
          {chrome}
        </mesh>
        <mesh position={[0, -BOX.h / 2 + 0.006, 0.006]}>
          <boxGeometry args={[SIDE.len, 0.012, 0.012]} />
          {chrome}
        </mesh>
        <mesh position={[SIDE.len / 2 - 0.006, 0, 0.006]}>
          <boxGeometry args={[0.012, BOX.h, 0.012]} />
          {chrome}
        </mesh>
        {/* ZUHAYR CREATIVE, the current full logo (chrome-and-crimson Z, UHAYR, the Creative script), printed on the glass near the top. */}
        <mesh position={[-0.12, BOX.h / 2 - 0.22, 0.004]}>
          <planeGeometry args={[0.62, 0.62 * 342 / 1318]} />
          <meshBasicMaterial map={zc} transparent depthWrite={false} />
        </mesh>
        {/* The Holdings tag, small and quiet, low toward the back corner. */}
        <group position={[SIDE.len / 2 - 0.62, -BOX.h / 2 + 0.2, 0.004]}>
          <mesh position={[0, 0.012, 0]}>
            <planeGeometry args={[0.07, 0.07]} />
            <meshBasicMaterial map={zh} transparent depthWrite={false} opacity={0.8} />
          </mesh>
          <Text font={a('fonts/GeistMono.ttf')} fontSize={0.022} letterSpacing={0.18} anchorX="left" anchorY="middle" position={[0.05, 0.012, 0]}>
            A CONCERN OF ZUHAYR HOLDINGS
            <meshBasicMaterial color="#e4e6ea" transparent opacity={0.8} />
          </Text>
        </group>
      </group>
    </>
  )
}
