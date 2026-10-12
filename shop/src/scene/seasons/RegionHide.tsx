import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { regionActive } from './regionStore'

/** Hides the Z's own loop (its pixels, ropes, mark, scan, puffs) while a region logo is being painted in its place. */
export function RegionHide({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null)
  useFrame(() => { if (ref.current) ref.current.visible = !regionActive() })
  return <group ref={ref}>{children}</group>
}
