// Everything the window would otherwise stop the page to do on its first frames, done ahead of them and in short slices.
//
// Left alone, a three.js scene pays for itself the first time each thing is drawn, inside the frame that draws it:
//  - every material's shader program is built on first use, and the renderer WAITS for the GPU to finish each one before
//    it goes on to the next. This scene has about ninety. Measured on a fast desktop that was one block of 12 to 14 seconds
//    with the page stopped: nothing scrolled, nothing answered a click, and it landed whenever the window first came near
//    the screen;
//  - a program's uniforms and attributes are looked up on first use, one synchronous call to the GPU process at a time,
//    some thirty thousand of them: another 1.3 seconds in the same frame;
//  - every texture is uploaded the first time a material that wears it is drawn, and every object's geometry the first
//    time the object is: another second and more, in the first frame.
//
// Here the programs are handed to the driver ahead of time, which builds them in parallel on its own threads
// (compileAsync, which only polls for them); then the lookups, the uploads and the first draws are done a few at a time with
// the page given its turn in between. The window holds its frame loop until this resolves, behind its poster, which is what was on
// screen during the freeze anyway.
//
// A program is not just a material: it is keyed by where it is drawn to, by the lights of the scene it is drawn in, by
// the object it is drawn on, and by how many clipping planes are in force. So each family is built under the conditions
// it will be asked for under, or the renderer would not recognise what was built and would build it again:
//  - the scene's materials, with a render target bound: every pass that draws the scene (the mirror, the composer's scene
//    pass) draws to a target, never straight to the screen;
//  - the shadow pass's depth materials, which belong to the renderer and are in no scene: the same depth materials are
//    made here and put on stand-ins for the casters. Programs are shared by what they are, not by which material asked;
//  - materials with clipping planes of their own (the Z mark's reveal), with that many planes in force;
//  - the post-processing passes' materials (ambient occlusion, depth of field, bloom, anti-aliasing: full-screen
//    shaders, and the slowest to build), found on the composer and built on a bare triangle in a scene with no lights,
//    which is how each pass draws its own. The last pass draws to the screen, so its materials are built for that too.
import {
  BackSide,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  Line,
  Mesh,
  MeshDepthMaterial,
  Plane,
  Points,
  RGBADepthPacking,
  Scene,
  WebGLRenderTarget,
  type Camera,
  type Material,
  type Object3D,
  type Side,
  type Texture,
  type WebGLRenderer,
} from 'three'
// Not on drei's front door: the blur that the floor's reflection runs through.
import { ConvolutionMaterial } from '@react-three/drei/materials/ConvolutionMaterial.js'
import type { EffectComposer } from 'postprocessing'
import { pageIsStill } from './hostScroll'

/** The longest the page is kept from its own work in one go, and how many objects' materials are started per turn. */
const SLICE_MS = 6
const PER_TURN = 8
/** How many objects are given their first draw per turn. */
const PER_DRAW = 10

const turn = (ms = 0) => new Promise<void>((r) => window.setTimeout(r, ms))

type Caster = Mesh & { customDepthMaterial?: Material }
type Mapped = Material & { map?: Texture | null; alphaMap?: Texture | null }
type Program = { isReady(): boolean; getUniforms(): unknown; getAttributes(): unknown; usedTimes: number }

const materialsOf = (o: Mesh): Mapped[] => (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean) as Mapped[]

/**
 * A throwaway object for a program to be built against in place of `of`: the same geometry, the given material, and the
 * few things about an object that decide which program it gets (whether it is instanced and coloured per instance,
 * whether it is points or a line).
 *
 * A NEW object, with those copied on to it. The obvious shortcut, an object that inherits from the real one
 * (Object.create), costs the scene its frame rate for good: an object that has been used as a prototype is one the engine
 * stops optimising, and with every mesh in the scene made one, the renderer's loops over them ran three times slower on
 * every frame afterwards (measured: 10.5 ms of script a frame became 22).
 */
function standIn(of: Object3D, material: Material): Object3D {
  const src = of as Mesh & { isPoints?: boolean; isLine?: boolean; isInstancedMesh?: boolean; instanceColor?: unknown; morphTexture?: unknown }
  const o: Object3D = src.isPoints ? new Points(src.geometry, material) : src.isLine ? new Line(src.geometry, material) : new Mesh(src.geometry, material)
  if (src.isInstancedMesh) Object.assign(o, { isInstancedMesh: true, instanceColor: src.instanceColor ?? null, morphTexture: src.morphTexture ?? null })
  return o
}
function sceneOf(objects: Object3D[]): Scene {
  const s = new Scene()
  s.children = objects
  return s
}

/** The side the shadow pass draws a caster's depth with, by the side of its own material (as WebGLShadowMap has it). */
const SHADOW_SIDE: Record<number, Side> = { [FrontSide]: BackSide, [BackSide]: FrontSide, [DoubleSide]: DoubleSide }

export type Prepared = {
  /** Frees what was made here. Not before the window is taken down: the depth materials keep their programs alive. */
  dispose: () => void
}

export async function prepare(o: {
  gl: WebGLRenderer
  scene: Scene
  camera: Camera
  /** The post-processing composer, once it exists; null until then. */
  composer: () => EffectComposer | null
  /** Whether there is post-processing to wait for. */
  post: boolean
  cancelled: () => boolean
}): Promise<Prepared> {
  const { gl, scene, camera } = o
  const target = new WebGLRenderTarget(1, 1)
  const triangle = new BufferGeometry()
  triangle.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
  triangle.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2))
  const depthMaterials = new Map<string, MeshDepthMaterial>()
  const extra: Material[] = []
  const prepared: Prepared = {
    dispose: () => {
      target.dispose()
      triangle.dispose()
      depthMaterials.forEach((d) => d.dispose())
      extra.forEach((m) => m.dispose())
    },
  }

  /** Starts a batch with `to` bound, lit as `litBy` is. The programs are created inside the call; what it returns only waits. */
  const waits: Promise<unknown>[] = []
  const start = (what: Scene, to: WebGLRenderTarget | null, litBy?: Scene) => {
    const before = gl.getRenderTarget()
    try {
      gl.setRenderTarget(to)
      waits.push(gl.compileAsync(what, camera, litBy).catch(() => undefined))
    } catch {
      // A driver that refuses is not a reason to leave the window dark: the first frame builds these the old way.
    } finally {
      gl.setRenderTarget(before)
    }
  }
  /** The depth material the shadow pass will draw `caster` with, given what it copies over from the caster's own. */
  const depthFor = (caster: Caster, m: Mapped): Material => {
    if (caster.customDepthMaterial) return caster.customDepthMaterial
    const side = m.shadowSide ?? SHADOW_SIDE[m.side]
    const key = [side, m.map ? m.map.channel : '-', m.alphaMap ? m.alphaMap.channel : '-', m.alphaTest > 0].join('|')
    let d = depthMaterials.get(key)
    if (!d) {
      d = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side, map: m.map ?? null, alphaMap: m.alphaMap ?? null, alphaTest: m.alphaTest })
      depthMaterials.set(key, d)
    }
    return d
  }

  // What there is to build, read off the scene once.
  const plain: Object3D[] = []
  const shadows: Object3D[] = []
  const clipped = new Map<number, Object3D[]>()
  scene.traverse((obj) => {
    const mesh = obj as Caster
    if (!mesh.geometry || !mesh.material) return
    for (const m of materialsOf(mesh)) {
      plain.push(standIn(mesh, m))
      if (mesh.castShadow) shadows.push(standIn(mesh, depthFor(mesh, m)))
      const planes = m.clippingPlanes ? m.clippingPlanes.length : 0
      // Intersection clipping counts its planes differently; nothing in the scene uses it.
      if (planes && !m.clipIntersection) {
        const list = clipped.get(planes) ?? []
        clipped.set(planes, list)
        list.push(standIn(mesh, m))
        if (mesh.castShadow && m.clipShadows) list.push(standIn(mesh, depthFor(mesh, m)))
      }
    }
  })

  // 1. The scene's materials and the shadow pass's, a few objects a turn: building a program's source is itself work.
  for (const list of [plain, shadows]) {
    for (let i = 0; i < list.length; i += PER_TURN) {
      start(sceneOf(list.slice(i, i + PER_TURN)), target, scene)
      await turn()
      if (o.cancelled()) return prepared
    }
  }

  // 2. Clipped materials. The number of planes in force is something the renderer only knows while it draws: an empty
  //    render with that many global planes leaves it set, the clipped meshes are built under it, and a second empty
  //    render puts it back. One piece, with no turn given in the middle of it.
  const nothing = new Scene()
  for (const [planes, list] of clipped) {
    const before = gl.getRenderTarget()
    const global = gl.clippingPlanes
    try {
      gl.setRenderTarget(target)
      gl.clippingPlanes = Array.from({ length: planes }, () => new Plane())
      gl.render(nothing, camera)
      start(sceneOf(list), target, scene)
    } catch {
      // As for any batch.
    } finally {
      gl.clippingPlanes = global
      try {
        gl.render(nothing, camera)
      } catch {
        // Nothing to put back.
      }
      gl.setRenderTarget(before)
    }
    await turn()
    if (o.cancelled()) return prepared
  }

  // 3. Post-processing. The composer is built a render or two after the scene mounts and its passes are added after
  //    that: wait until it is there and has stopped growing. (No frame is drawn meanwhile, so nothing has used a program.)
  if (o.post) {
    let composer: EffectComposer | null = null
    for (let tries = 0, count = -1; tries < 60; tries++) {
      const c = o.composer()
      const n = c ? c.passes.length : -1
      if (c && n > 1 && n === count) {
        composer = c
        break
      }
      count = n
      await turn(40)
      if (o.cancelled()) return prepared
    }
    if (composer) {
      const skip = new Set<unknown>([gl, scene, camera])
      const all = passMaterials(composer, skip)
      // The floor's reflection is blurred by a pass that drei keeps to itself, in no scene and on no composer. A program
      // is found by its source, so one more of the same material here builds it.
      const blur = new ConvolutionMaterial()
      extra.push(blur)
      all.push(blur)
      const bare = (materials: Material[]) => sceneOf(materials.map((m) => new Mesh(triangle, m)))
      for (let i = 0; i < all.length; i += PER_TURN) {
        start(bare(all.slice(i, i + PER_TURN)), target)
        await turn()
        if (o.cancelled()) return prepared
      }
      const last = passMaterials(composer.passes[composer.passes.length - 1], skip)
      if (last.length) start(bare(last), null)
    }
  }

  // 4. Wait for the driver. compileAsync answers for the last program each material was given; a material built in two
  //    forms has another, so ask every program directly as well.
  await Promise.all(waits)
  const programs = (gl.info.programs ?? []) as unknown as Program[]
  for (let waited = 0; waited < 15000 && programs.some((p) => !p.isReady()); waited += 30) {
    await turn(30)
    if (o.cancelled()) return prepared
  }

  // 5. Keep every program for the life of the renderer. It frees a program when the last material using it is disposed,
  //    and a component that swaps its material for an identical new one disposes the old one first: the same program was
  //    then being built again, on the main thread this time. Counted as in use once more, it is simply found again.
  for (const p of programs) p.usedTimes += 1

  // 6. Each program's uniforms and attributes, which the renderer otherwise looks up in the frame that first uses it.
  let since = performance.now()
  const spend = async () => {
    if (performance.now() - since < SLICE_MS) return
    await turn()
    since = performance.now()
  }
  for (const p of [...programs]) {
    try {
      p.getUniforms()
      p.getAttributes()
    } catch {
      // The frame that uses it will ask again.
    }
    await spend()
    if (o.cancelled()) return prepared
  }

  // 7. The textures, read off the scene now and not at the start: the tube labels and the logos are drawn into canvases
  //    while all of the above is going on, and put on their materials when they are done. Twice over, a moment apart, for
  //    whichever of them was finished in between (a texture already sent at its current version is skipped).
  const sent = new Map<Texture, number>()
  for (let pass = 0; pass < 2; pass++) {
    for (const t of texturesIn(scene)) {
      if (sent.get(t) === t.version) continue
      sent.set(t, t.version)
      // An upload can hold the page for a moment (a large picture, or a GPU still busy with the shaders): not mid-scroll.
      for (let waited = 0; waited < 2500 && !pageIsStill(); waited += 100) await turn(100)
      try {
        gl.initTexture(t)
      } catch {
        // Uploaded when it is drawn, as it would have been.
      }
      await spend()
      if (o.cancelled()) return prepared
    }
    if (pass === 0) await turn(400)
  }

  // 8. First draws. The first time an object is drawn its geometry is sent to the GPU, and the first time a light casts a
  //    shadow or the mirror reflects, its buffers are made: for the whole scene in one frame that was more than a second
  //    with the page stopped. Here the scene is drawn into the one-pixel target a handful of objects at a time, everything
  //    else hidden, so each draw only pays for its newcomers. Only the objects themselves are hidden, never a group: a
  //    hidden group would take its lights with it, and a scene with other lights is other programs.
  const drawn: Object3D[] = []
  scene.traverse((obj) => {
    const d = obj as Object3D & { isMesh?: boolean; isLine?: boolean; isPoints?: boolean }
    if ((d.isMesh || d.isLine || d.isPoints) && d.visible) drawn.push(d)
  })
  const before = gl.getRenderTarget()
  try {
    for (const d of drawn) d.visible = false
    for (let i = 0; i < drawn.length; i += PER_DRAW) {
      const few = drawn.slice(i, i + PER_DRAW)
      for (const d of few) d.visible = true
      try {
        gl.setRenderTarget(target)
        gl.render(scene, camera)
      } catch {
        // Whatever it could not draw here is drawn, and paid for, in the first frame, as before.
      }
      gl.setRenderTarget(before)
      for (const d of few) d.visible = false
      await turn()
      if (o.cancelled()) break
    }
  } finally {
    for (const d of drawn) d.visible = true
    gl.setRenderTarget(before)
  }
  return prepared
}

/** Every texture the scene's materials wear that has pixels to send. */
function texturesIn(scene: Scene): Set<Texture> {
  const found = new Set<Texture>()
  scene.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.material) return
    for (const m of materialsOf(mesh)) {
      for (const v of Object.values(m)) if (isUploadable(v)) found.add(v)
      const uniforms = (m as Material & { uniforms?: Record<string, { value: unknown }> }).uniforms
      if (uniforms) for (const u of Object.values(uniforms)) if (u && isUploadable(u.value)) found.add(u.value)
    }
  })
  return found
}

/** A texture with pixels to send: not one a pass renders into, and not one whose picture has not arrived yet. */
function isUploadable(v: unknown): v is Texture {
  const t = v as (Texture & { isRenderTargetTexture?: boolean; mipmaps?: unknown[] }) | null
  if (!t || typeof t !== 'object' || !t.isTexture || t.isRenderTargetTexture) return false
  return Boolean(t.image) || Boolean(t.mipmaps && t.mipmaps.length)
}

/**
 * The materials a composer (or one of its passes) draws with: its passes' own, those of the passes that effects keep
 * inside them (bloom's blur, depth of field's bokeh, the anti-aliasing's edge passes), and those on the full-screen
 * quads of passes that are not built on the library's Pass at all (the ambient occlusion). It follows only what looks
 * like a pass or an effect, and never what is in `skip`: followed blindly, these objects lead out to the whole scene.
 */
function passMaterials(root: unknown, skip: Set<unknown>): Material[] {
  const found = new Set<Material>()
  const seen = new Set<unknown>(skip)
  const passLike = (x: Record<string, unknown>) =>
    typeof x.render === 'function' || typeof x.setSize === 'function' || Array.isArray(x.effects) || typeof x.getFragmentShader === 'function'
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || seen.has(node) || depth > 5) return
    seen.add(node)
    for (const v of Object.values(node as object)) {
      if (!v || typeof v !== 'object') continue
      const x = v as Record<string, unknown>
      const worn = x.material as { isMaterial?: boolean } | undefined
      if (x.isMaterial) found.add(v as Material)
      else if (worn && worn.isMaterial) found.add(worn as Material) // a mesh, or a full-screen quad
      else if (Array.isArray(v)) {
        for (const item of v) {
          if (!item || typeof item !== 'object') continue
          if ((item as { isMaterial?: boolean }).isMaterial) found.add(item as Material)
          else if (passLike(item as Record<string, unknown>)) visit(item, depth + 1)
        }
      } else if (passLike(x)) visit(v, depth + 1)
    }
  }
  visit(root, 0)
  return [...found]
}
