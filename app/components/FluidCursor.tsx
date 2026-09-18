"use client";

import { useEffect } from "react";
import { createClickDisplace, type ClickDisplace } from "./clickDisplace";

/**
 * Fluid water cursor. A transparent, fixed, full-viewport WebGL layer runs a
 * wave simulation (pressure / velocity ping-ponged between two half-float
 * render targets) and lights it like a water surface. The pointer drags a
 * ripple wake, stopping short or turning sharply sends a shockwave, a click
 * drops a splash, and an `app:splash` CustomEvent (detail {x, y}) fires the
 * bigger brand splash the gallery expands use. Mounted once from the template.
 * No-ops under reduced-motion and where float render targets are missing.
 *
 * HOW it stays smooth — every choice below is a frame-budget decision:
 *  - three.js is imported lazily at idle time as its own chunk, so it never
 *    blocks hydration or the loader; both shader programs are warmed with one
 *    blank frame at setup so the first ripple pays no compile hitch.
 *  - The simulation steps at most once per rendered frame and never faster
 *    than ~80 steps/s (a 120 Hz panel steps every other frame). Wave speed is
 *    scaled to the real step so the water feels the same on any refresh rate.
 *  - Cost lives almost entirely in the simulation pass, which runs once per
 *    texel per step, so both of its terms are kept small: it solves at a
 *    fraction of the viewport (0.42 fine pointers / 0.3 coarse, capped at
 *    MAX_SIM_TEXELS) with a five-tap stencil. The display pass is one
 *    fullscreen quad with a single texture read, never above 1x DPR.
 *  - The lighting deliberately stays broad. A sharp specular on a field
 *    solved below display resolution resolves the solver's own texel grid as
 *    white pinpoints; see the note in the display shader.
 *  - Sleep: SLEEP_AFTER_MS after the last disturbance the water is calm, the
 *    targets and canvas are cleared and the loop STOPS. A still page is free.
 *  - Watchdog: a sustained run of dropped frames steps the sim resolution
 *    down (never below MIN_SIM_SCALE).
 *  - Output is premultiplied and blend-free; no depth/stencil buffers, no
 *    per-frame scene-graph churn, passive listeners, no work off-screen.
 */

type Three = typeof import("three");

/** Surface physics and look. */
const WATER = {
  waveSpeed: 1,
  /** Per-step pressure retention — how long ripples linger.
   *  0.965, down from the reference's 0.98: this layer covers the WHOLE page
   *  rather than one hero, and at 0.98 a disturbance outlived the pointer for
   *  long enough that ordinary mouse movement kept the entire viewport lit. */
  damping: 0.965,
  /** Ripple radius under the pointer, CSS px (independent of sim scale). */
  rippleRadius: 34,
  /** Tint added in proportion to wave height (brand crimson). */
  glow: [0.86, 0.14, 0.28],
} as const;

/**
 * Shockwave presets: ring amplitude, radius multiplier, sim steps applied.
 *
 * These inject a single ring into the simulation, which propagates outward as
 * one expanding circle. That is right for the reference's own gesture trigger
 * and wrong for a click: a click wants the ripple the expanded images carry,
 * which is a tight TRAIN of rings that bends the picture's pixels and barely
 * travels. That is what clickDisplace does, so `click` and `splash` here are
 * only the fallback for where a displacement filter cannot run.
 */
const SHOCK = {
  /** Pointer stopped short or turned sharply — the reference's own trigger. */
  gesture: { amp: 0.4, radius: 1, steps: 1 },
  /** Primary-button press. Always fires, alongside the displacement. */
  click: { amp: 1.15, radius: 1, steps: 2 },
  /** `app:splash` — gallery expands. Always fires. */
  splash: { amp: 1.4, radius: 1.6, steps: 3 },
  /**
   * `app:splash` with kind "corner" — the corner dock's beacon. The client
   * wants the dock's ripple to BE this layer's click ripple, "with emphasis
   * so the user notices there is a ripple water effect coming from the
   * corner": the widest train the sim is given, at the amplitude it clamps
   * to, fed for a step longer than the gallery splash. Water only — no displacement — because it repeats every few seconds
   * while the corner is clear, and a section-sized displacement filter
   * costs a rasterisation per frame each time.
   */
  corner: { amp: 1.5, radius: 2.4, steps: 4 },
} as const;
type ShockPreset = (typeof SHOCK)[keyof typeof SHOCK];

/** Gesture thresholds in CSS px per step (the reference's 2 / 1 sim px). */
const GESTURE = { fast: 3.3, slow: 1.7, turn: Math.PI / 3 } as const;

const SIM_STEP_MS = 1000 / 60;
/** Never step more often than this — 120 Hz panels step every other frame. */
const MIN_STEP_MS = 12.5;
const SLEEP_AFTER_MS = 3000;
const SIM_SCALE_FINE = 0.42;
const SIM_SCALE_COARSE = 0.3;
const MIN_SIM_SCALE = 0.22;
const MAX_SIM_TEXELS = 420_000;
const MAX_DISPLAY_PIXELS = 2_400_000;
/** Under navbar (100) and the custom cursor, over page content. */
const Z_INDEX = 95;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/**
 * One simulation step. State texture: x = pressure, y = velocity,
 * zw = pressure gradient (kept so the display pass needs a single tap).
 */
const SIM_FRAG = /* glsl */ `
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec3 uMouse;      // xy: sim px, z: 1 while the pointer lays a wake
uniform vec2 uMousePrev;  // where the pointer was last step
uniform float uDelta;
uniform float uDamping;
uniform float uRippleSize;
uniform vec3 uShock;      // xy: sim px, z: radius multiplier
uniform float uShockAmp;
varying vec2 vUv;

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  vec2 ap = p - a;
  float t = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  return length(ap - ab * t);
}

void main() {
  vec2 texel = 1.0 / uResolution;
  vec2 coord = vUv;
  vec4 data = texture2D(uTexture, coord);
  float pressure = data.x;
  float velocity = data.y;

  // Five taps, not nine. The reference's nine-point stencil weights the four
  // diagonals 0.05 each against 0.2 for the axial neighbours — a fifth of the
  // total for nearly half the texture fetches. This is the standard five-point
  // Laplacian carrying the same total weight, so the wave speed is unchanged
  // and it is the single largest saving in the whole effect: the simulation
  // pass runs once per texel per step and was, by a wide margin, its cost.
  float pR = texture2D(uTexture, coord + vec2( texel.x, 0.0)).x;
  float pL = texture2D(uTexture, coord + vec2(-texel.x, 0.0)).x;
  float pU = texture2D(uTexture, coord + vec2(0.0,  texel.y)).x;
  float pD = texture2D(uTexture, coord + vec2(0.0, -texel.y)).x;

  // Mirror the rim so waves reflect instead of draining off the edge.
  if (coord.x < texel.x)       pL = pR;
  if (coord.x > 1.0 - texel.x) pR = pL;
  if (coord.y < texel.y)       pD = pU;
  if (coord.y > 1.0 - texel.y) pU = pD;

  float laplacian = (pR + pL + pU + pD) * 0.25 - pressure;

  // ── Why this coefficient is 1.3 and not the reference's 2.0 ──
  // This is a leapfrog integration of the wave equation, and it is stable
  // only while omega*dt < 2, where omega = sqrt(2 * k) for the sharpest
  // pattern the grid can hold: the checkerboard, every texel the opposite
  // sign of its neighbours. At k = 2.0 that works out to exactly omega*dt = 2
  // on a 60Hz display — the stability boundary itself. A mode sitting on the
  // boundary neither grows nor decays: once the pointer seeds it, it stays
  // for good. Drop a frame and dt rises, it crosses the boundary and GROWS
  // until the clamp below saturates it.
  //
  // Saturated checkerboard at texel scale is precisely a fine dot grid, and
  // it is what was speckling the page — not the lighting. The lighting only
  // decided how white the dots came out. k = 1.3 puts omega*dt at about 1.6,
  // safely inside the boundary, so the mode decays instead of persisting.
  // Wave speed goes as sqrt(k), so this is ~20% slower and nothing else.
  velocity += uDelta * laplacian * 1.3;
  pressure += uDelta * velocity;

  // Viscosity — and the second line of defence against that same mode.
  // The neighbour term is a true average (0.25, not the reference's 0.3,
  // which summed to 1.2x and quietly amplified every smooth wave by 1% a
  // step). Being an average makes it neutral on smooth content and strongly
  // damping on the checkerboard, which is exactly where the damping is
  // wanted: it takes ~18% off that mode every step.
  pressure = mix(pressure, (pR + pL + pU + pD) * 0.25, 0.09);

  velocity -= 0.002 * uDelta * pressure;
  velocity *= 1.0 - 0.01 * uDelta;
  pressure *= uDamping;

  vec2 p = coord * uResolution;

  // Pointer wake: distance to the pointer's PATH this step, so a fast sweep
  // leaves a continuous wake instead of a dotted one.
  if (uMouse.z > 0.5) {
    float dist = segmentDistance(p, uMousePrev, uMouse.xy);
    // 0.45, not 1.0. The wake injects EVERY step the pointer moves, and the
    // rim reflects rather than drains, so at full strength a few seconds of
    // continuous movement filled the entire viewport with standing waves
    // instead of leaving a trail behind the cursor.
    pressure += exp(-dist * dist / (uRippleSize * uRippleSize * 0.5)) * 0.45;
  }

  // ── The click's ripple, as a TRAIN ──
  // This used to inject ONE ring at a fixed radius, which propagated out as a
  // single expanding circle — the "very round perfect water drop". The ripple
  // on the expanded images is not that: it is a tight train of concentric
  // rings hugging the point, sin(dist * freq) under an exp(-dist)
  // envelope. Those are its numbers, converted from its UV space into this
  // simulation's: one wavelength is ~2.97 ripple radii, and the envelope is
  // down to 7% at about six of them.
  if (uShockAmp > 0.0) {
    float dist = distance(p, uShock.xy);
    float size = uRippleSize * uShock.z;
    float k = 6.2831853 / (2.97 * size);
    float env = exp(-dist * 0.421 / size);
    pressure += sin(dist * k) * env * uShockAmp;
  }

  // Keeps the integration from ever running away.
  pressure = clamp(pressure, -1.5, 1.5);
  velocity = clamp(velocity, -1.5, 1.5);

  gl_FragColor = vec4(pressure, velocity, (pR - pL) * 0.5, (pU - pD) * 0.5);
}`;

/**
 * Lights the surface as a transparent overlay: white specular, a soft sheen,
 * brand glow on the wave body, caustic tint on crests. There is no content
 * texture to refract (the page beneath is live DOM), so the refraction term
 * only feeds the alpha. Output is premultiplied; calm water is exactly
 * transparent, which is what lets the sleeping layer vanish without a pop.
 */
const DRAW_FRAG = /* glsl */ `
uniform sampler2D uTexture;
uniform vec3 uGlow;
varying vec2 vUv;

void main() {
  vec4 data = texture2D(uTexture, vUv);
  float height = data.x;
  vec2 distortion = data.zw * 0.3;

  // THE WHITE SPECKS. The gradient in data.zw is stored at the simulation's
  // resolution and read back at the viewport's with linear filtering, so the
  // reconstructed field is continuous but its SLOPE is not: it kinks on a
  // regular lattice at the texel boundaries. Multiplying the gradient by 4
  // swung the normal hard for a tiny change in slope, and a high specular
  // exponent then turned each of those kinks into a white pinpoint — a grid
  // of them, appearing the moment the pointer disturbed the field.
  //
  // Both multipliers are the amplifier, so both come down: a gentler normal
  // and a broad highlight cannot resolve the lattice at all. Nothing is
  // sampled or smoothed to achieve it, so this costs nothing — it is the
  // amplification that was wrong, not the resolution.
  vec3 normal = normalize(vec3(-data.z * 1.8, 0.5, -data.w * 1.8));
  vec3 lightDir = normalize(vec3(-2.0, 5.0, 3.0));
  float ndl = max(0.0, dot(normal, lightDir));

  // The exponent here used to be 800, copied from the reference. That was a
  // mistake in THIS setting: the reference refracts a full-resolution content
  // texture, while the normal here is built from the pressure gradient of a
  // texture running at a FRACTION of the viewport and read with linear
  // filtering. Such a field is continuous but its derivative is not — it
  // kinks at every texel boundary — and an 800th power turns each of those
  // kinks into a bright speck, i.e. a regular dot lattice across the whole
  // screen at the simulation's texel pitch. A broad highlight cannot
  // resolve the texel grid at all, so it is the fix rather than a softening.
  float spec = pow(ndl, 26.0);
  vec3 color = vec3(1.0, 0.98, 0.98) * spec * 0.55;
  // Brand tint on the wave body. Kept low: this term is proportional to
  // |height| everywhere the field is disturbed, so at the old 0.8 a viewport
  // full of ripples became a viewport full of crimson.
  color += uGlow * abs(height) * 0.32;

  float alpha = abs(height) * 0.3 + spec * 0.6 + length(distortion) * 0.4;
  alpha = clamp(alpha, 0.0, 0.6);
  gl_FragColor = vec4(color * alpha, alpha);
}`;

export default function FluidCursor() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let teardown: (() => void) | null = null;

    // Start at idle time: the loader and the page's own scenes get the main
    // thread first, and three.js arrives as its own chunk in the background.
    const cancelIdle = whenIdle(async () => {
      const THREE = await import("three");
      if (disposed) return;
      teardown = mount(THREE);
    });

    return () => {
      disposed = true;
      cancelIdle();
      teardown?.();
    };
  }, []);

  return null;
}

function whenIdle(cb: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(cb, { timeout: 2500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, 800);
  return () => window.clearTimeout(id);
}

/** Builds the layer and returns its teardown, or null if WebGL can't do it. */
function mount(THREE: Three): (() => void) | null {
  const canvas = document.createElement("canvas");
  let renderer: import("three").WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  // The state lives in half-float targets (pressure goes negative); without
  // a float-renderable extension there is no simulation to run.
  const gl = renderer.getContext();
  if (
    !gl.getExtension("EXT_color_buffer_float") &&
    !gl.getExtension("EXT_color_buffer_half_float")
  ) {
    renderer.dispose();
    return null;
  }

  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  canvas.setAttribute("aria-hidden", "true");
  // The corner dock fires its splash into this layer and draws its own rings
  // where the water is not running: the marker is for a dock that mounts
  // after the water, the event for one that mounted before.
  canvas.dataset.fluidCursor = "";
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    zIndex: String(Z_INDEX),
    pointerEvents: "none",
  });
  document.body.appendChild(canvas);
  window.dispatchEvent(new Event("app:water-ready"));

  const coarse = !window.matchMedia("(hover: hover) and (pointer: fine)")
    .matches;

  // The click ripple. Null where a displacement filter cannot run (non-
  // Chromium, touch); the water's own ring covers those.
  const displace: ClickDisplace | null = createClickDisplace();

  // Linear filtering is exact for the sim (it samples texel centres) and
  // smooths the display pass, which reads at a higher resolution.
  const rtOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  };
  let readRT = new THREE.WebGLRenderTarget(1, 1, rtOptions);
  let writeRT = new THREE.WebGLRenderTarget(1, 1, rtOptions);

  const simUniforms = {
    uTexture: { value: null as import("three").Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector3(-1, -1, 0) },
    uMousePrev: { value: new THREE.Vector2(-1, -1) },
    uDelta: { value: WATER.waveSpeed as number },
    uDamping: { value: WATER.damping },
    uRippleSize: { value: WATER.rippleRadius as number },
    uShock: { value: new THREE.Vector3(0, 0, 1) },
    uShockAmp: { value: 0 },
  };
  const drawUniforms = {
    uTexture: { value: null as import("three").Texture | null },
    uGlow: { value: new THREE.Vector3(...WATER.glow) },
  };

  const geometry = new THREE.PlaneGeometry(2, 2);
  const simMaterial = new THREE.ShaderMaterial({
    uniforms: simUniforms,
    vertexShader: VERT,
    fragmentShader: SIM_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const drawMaterial = new THREE.ShaderMaterial({
    uniforms: drawUniforms,
    vertexShader: VERT,
    fragmentShader: DRAW_FRAG,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const simScene = new THREE.Scene();
  const drawScene = new THREE.Scene();
  for (const [scene, material] of [
    [simScene, simMaterial],
    [drawScene, drawMaterial],
  ] as const) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  // ── State ──
  let width = 1;
  let height = 1;
  let simScale = 1;
  const baseQuality = coarse ? SIM_SCALE_COARSE : SIM_SCALE_FINE;
  let quality = baseQuality;
  // Pointer in CSS px, y up (the simulation's frame). `teleport` means the
  // history is stale (re-entry, wake, resize) and must not read as a sweep.
  const pointer = { x: -1e4, y: -1e4, active: false, teleport: true };
  const last = { x: -1e4, y: -1e4 };
  const before = { x: -1e4, y: -1e4 };
  let shock: {
    x: number;
    y: number;
    amp: number;
    radius: number;
    steps: number;
  } | null = null;
  let running = false;
  let lost = false;
  let raf = 0;
  let lastFrame = 0;
  let acc = 0;
  let slowFrames = 0;
  let goodFrames = 0;
  let lastDisturb = 0;

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    const area = Math.max(1, width * height);
    simScale = Math.max(
      MIN_SIM_SCALE,
      Math.min(quality, Math.sqrt(MAX_SIM_TEXELS / area)),
    );
    const sw = Math.max(1, Math.floor(width * simScale));
    const sh = Math.max(1, Math.floor(height * simScale));
    readRT.setSize(sw, sh);
    writeRT.setSize(sw, sh);
    simUniforms.uResolution.value.set(sw, sh);
    simUniforms.uRippleSize.value = WATER.rippleRadius * simScale;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 1, Math.sqrt(MAX_DISPLAY_PIXELS / area)),
    );
    renderer.setSize(width, height, false);
    pointer.teleport = true;
    shock = null;
  };

  const clear = () => {
    renderer.setRenderTarget(readRT);
    renderer.clear(true, false, false);
    renderer.setRenderTarget(writeRT);
    renderer.clear(true, false, false);
    renderer.setRenderTarget(null);
    renderer.clear(true, false, false);
  };

  const sleep = () => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    shock = null;
    pointer.teleport = true;
    if (!lost) clear();
  };

  const wake = () => {
    lastDisturb = performance.now();
    if (running || lost || document.hidden) return;
    running = true;
    lastFrame = lastDisturb;
    acc = MIN_STEP_MS; // step on the very first frame
    slowFrames = 0;
    raf = requestAnimationFrame(frame);
  };

  const fire = (x: number, y: number, preset: ShockPreset) => {
    if (!shock || preset.amp >= shock.amp) shock = { x, y, ...preset };
    wake();
  };

  const step = (delta: number) => {
    if (pointer.teleport) {
      last.x = before.x = pointer.x;
      last.y = before.y = pointer.y;
      pointer.teleport = false;
    }
    const dx = pointer.x - last.x;
    const dy = pointer.y - last.y;
    const moved = Math.hypot(dx, dy);

    // The reference's gesture read: a stop after speed, or a sharp turn,
    // throws a shockwave from the pointer.
    if (pointer.active) {
      const pdx = last.x - before.x;
      const pdy = last.y - before.y;
      const prevMoved = Math.hypot(pdx, pdy);
      if (prevMoved > GESTURE.fast && moved < GESTURE.slow) {
        fire(pointer.x, pointer.y, SHOCK.gesture);
      } else if (moved > GESTURE.slow && prevMoved > GESTURE.slow) {
        const cos = (dx * pdx + dy * pdy) / (moved * prevMoved);
        if (Math.acos(Math.min(1, Math.max(-1, cos))) > GESTURE.turn) {
          fire(pointer.x, pointer.y, SHOCK.gesture);
        }
      }
    }

    const u = simUniforms;
    u.uTexture.value = readRT.texture;
    u.uDelta.value = delta;
    u.uMouse.value.set(
      pointer.x * simScale,
      pointer.y * simScale,
      pointer.active && moved > 0.5 ? 1 : 0,
    );
    u.uMousePrev.value.set(last.x * simScale, last.y * simScale);
    if (shock) {
      u.uShock.value.set(shock.x * simScale, shock.y * simScale, shock.radius);
      u.uShockAmp.value = shock.amp;
      if (--shock.steps <= 0) shock = null;
    } else {
      u.uShockAmp.value = 0;
    }

    renderer.setRenderTarget(writeRT);
    renderer.render(simScene, camera);
    [readRT, writeRT] = [writeRT, readRT];

    before.x = last.x;
    before.y = last.y;
    last.x = pointer.x;
    last.y = pointer.y;
  };

  const draw = () => {
    drawUniforms.uTexture.value = readRT.texture;
    renderer.setRenderTarget(null);
    renderer.render(drawScene, camera);
  };

  const frame = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    let dt = now - lastFrame;
    lastFrame = now;
    if (dt > 250) dt = SIM_STEP_MS; // back from a stall — don't lurch

    // Watchdog: sustained dropped frames → cheaper simulation.
    if (dt > 33) {
      slowFrames++;
      goodFrames = 0;
    } else {
      slowFrames = Math.max(0, slowFrames - 0.5);
      goodFrames++;
    }
    if (slowFrames > 20) {
      slowFrames = 0;
      if (quality > MIN_SIM_SCALE + 0.001) {
        quality = Math.max(MIN_SIM_SCALE, quality - 0.1);
        resize();
      }
    } else if (goodFrames > 600 && quality < baseQuality - 0.001) {
      // Climb back. Without this the watchdog was a ratchet: one bad stretch
      // — a heavy section scrolling past, a background tab waking up — pinned
      // the simulation at its coarsest for the rest of the page's life, and a
      // coarse simulation is exactly what makes its texel grid visible.
      goodFrames = 0;
      quality = Math.min(baseQuality, quality + 0.1);
      resize();
    }

    // At most one step per frame; the step length scales the wave speed so
    // 60 Hz, 120 Hz and a struggling 30 fps all move the water alike.
    acc += dt;
    if (acc >= MIN_STEP_MS) {
      // Capped at 1, not 1.25. dt is the other half of the stability bound
      // above — letting it stretch on a slow frame is what pushed the solver
      // over the edge exactly when the page was already struggling.
      const delta = Math.min(1, Math.max(0.75, acc / SIM_STEP_MS));
      acc = 0;
      step(delta * WATER.waveSpeed);
      draw();
    }

    if (!shock && now - lastDisturb > SLEEP_AFTER_MS) sleep();
  };

  // ── Input ──
  /**
   * Sections that own their own pointer effect and do not want this one on
   * top of them, published as a body class by whichever section is under the
   * cursor (see HeroBanner: its glass logo lens is already a cursor).
   *
   * Read here rather than hit-tested: this canvas is fixed and full-page, and
   * every full-screen layer on the site is pointer-events-none, so
   * `elementFromPoint` would answer with whatever happens to be beneath them
   * rather than with the section. The section itself knows, and a class check
   * costs no layout — which matters when the alternative is a
   * getBoundingClientRect on every pointermove.
   */
  //
  // `menu-open` is in here for the same reason as the hero, plus a second one:
  // the nav menu's veil is a backdrop-filter, so a ripple wake spreading
  // behind it forces the browser to re-blur the whole viewport for something
  // no one can even see through 22-40px of frost.
  const quiet = () => {
    const c = document.body.classList;
    return c.contains("fluid-quiet") || c.contains("menu-open");
  };

  const onMove = (e: PointerEvent) => {
    // A finger leaves no wake: it covers exactly the water it would stir,
    // and following it ran the whole simulation through every scroll on a
    // phone. Taps and the app's splashes still land (onDown, onSplash).
    if (e.pointerType === "touch") return;
    // Deactivate rather than merely skip. `pointer.active` gates the gesture
    // shockwave too (a sharp turn or a stop-after-speed), so leaving it true
    // would keep throwing rings from a pointer this layer is meant to have
    // let go of. It also means the exit is clean: the next move outside takes
    // the `!active` branch below and teleports, so no ripple is dragged out
    // across the section on the way from the hero to whatever is under it.
    if (quiet()) {
      pointer.active = false;
      return;
    }
    pointer.x = e.clientX;
    pointer.y = window.innerHeight - e.clientY;
    if (!pointer.active) {
      pointer.active = true;
      pointer.teleport = true;
    }
    wake();
  };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    // Both halves of the click go — the splash and the displacement. Leaving
    // the displacement in would be the worse half to keep: it bends the real
    // pixels under the cursor, which over the hero means bending the mask's
    // own edge.
    if (quiet()) return;
    pointer.x = e.clientX;
    pointer.y = window.innerHeight - e.clientY;
    // BOTH, not one or the other. The displacement bends the section's real
    // pixels the way the expanded images do, but it can only show where there
    // is detail to bend — over a smooth gradient it is invisible, which is
    // why a click on open background looked like nothing happened at all. The
    // water carries the click everywhere; the displacement gives it the
    // refraction. Where the filter cannot run at all, the water is the whole
    // effect on its own.
    fire(pointer.x, pointer.y, SHOCK.click);
    displace?.fire(e.clientX, e.clientY);
  };
  // A lifted finger leaves no pointer to trail; a mouse is still there.
  const onRelease = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") pointer.active = false;
  };
  // Leaving the window: `relatedTarget` is null only at the document edge.
  const onOut = (e: PointerEvent) => {
    if (!e.relatedTarget) pointer.active = false;
  };
  const onBlur = () => {
    pointer.active = false;
  };
  const onSplash = (e: Event) => {
    const d = (e as CustomEvent<{ x?: number; y?: number; kind?: string }>)
      .detail;
    if (!d || d.x == null || d.y == null) return;
    if (d.kind === "corner") {
      fire(d.x, window.innerHeight - d.y, SHOCK.corner);
      return;
    }
    fire(d.x, window.innerHeight - d.y, SHOCK.splash);
    displace?.fire(d.x, d.y, 1.5);
  };
  const onVisibility = () => {
    if (document.hidden) sleep();
  };
  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 120);
  };
  const onContextLost = (e: Event) => {
    e.preventDefault(); // ask for a restore
    lost = true;
    running = false;
    cancelAnimationFrame(raf);
    // The canvas keeps whatever was last drawn into it, and `sleep()` cannot
    // clear a dead context — so without this the final frame stayed painted
    // over the entire page with nothing able to remove it.
    canvas.style.visibility = "hidden";
    // Tell the corner dock: it fires its beacon into this layer, and a dead
    // layer swallowed every splash while the dock still thought it was up.
    delete canvas.dataset.fluidCursor;
    window.dispatchEvent(new Event("app:water-lost"));
  };
  const onContextRestored = () => {
    lost = false;
    canvas.style.visibility = "";
    canvas.dataset.fluidCursor = "";
    window.dispatchEvent(new Event("app:water-ready"));
  };

  // Warm-up: sizes the targets and compiles both programs on a blank frame.
  resize();
  step(WATER.waveSpeed);
  draw();

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onRelease, { passive: true });
  window.addEventListener("pointercancel", onRelease, { passive: true });
  document.addEventListener("pointerout", onOut, { passive: true });
  window.addEventListener("blur", onBlur);
  window.addEventListener("app:splash", onSplash);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", onResize);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.clearTimeout(resizeTimer);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onRelease);
    window.removeEventListener("pointercancel", onRelease);
    document.removeEventListener("pointerout", onOut);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("app:splash", onSplash);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onResize);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    readRT.dispose();
    writeRT.dispose();
    geometry.dispose();
    simMaterial.dispose();
    drawMaterial.dispose();
    displace?.dispose();
    renderer.dispose();
    // The template remounts on every navigation; give the context back now
    // rather than waiting on GC, or the browser's context cap fills up.
    renderer.forceContextLoss();
    canvas.remove();
  };
}
