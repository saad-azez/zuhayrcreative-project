import { Environment, Lightformer } from '@react-three/drei'
import { LOOK } from '../look'
import { a } from '../lib/assets'

/** Studio HDRI at low intensity plus art-directed lightformers so the chrome carries crisp product-photo highlights. */
export function Env() {
  return (
    <Environment files={a(LOOK.env.hdri)} environmentIntensity={LOOK.env.intensity} resolution={512} frames={1} background={false}>
      <Lightformer form="rect" intensity={LOOK.env.softbox} color="#fff1e2" scale={[6, 3, 1]} position={[0, 3.5, 4]} target={[0, 1.2, -1]} />
      <Lightformer form="rect" intensity={LOOK.env.stripWhite} color="#ffffff" scale={[0.4, 5, 1]} position={[-5, 1.5, 1]} target={[0, 1.3, -1]} />
      <Lightformer form="rect" intensity={LOOK.env.stripCrimson} color="#ff2a45" scale={[0.4, 5, 1]} position={[5, 1.5, 1]} target={[0, 1.3, -1]} />
    </Environment>
  )
}
