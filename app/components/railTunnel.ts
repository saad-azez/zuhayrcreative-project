"use client";

/**
 * Edge tunnel for the works rail — the services section's WebGL distortion,
 * transposed onto the horizontal axis and fed images instead of a text strip.
 *
 * WHY THIS IS GL AND NOT A TRANSFORM
 * The distortion wanted here stretches each picture vertically while
 * compressing it horizontally, by an amount that varies ACROSS the picture's
 * own width. That is a per-vertex warp of a subdivided mesh. A CSS transform
 * applies one matrix to a whole element, so the best it can manage is fanning a
 * slat uniformly — and the gradient across the slat is precisely the part that
 * reads as depth rather than as a resize.
 *
 * WHAT IT DRAWS
 * Only the slats inside the edge bands. The middle of the rail stays DOM and is
 * untouched: this canvas is transparent there and draws nothing, so the row you
 * hover and click is still the real one. A slat crossing into a band fades out
 * in the DOM as its GL copy fades in — that crossfade is the seam.
 *
 * THE TRANSPOSITION
 * WebGLTextTunnel builds its mask off `vUv.y - 0.5`, pinching at the top and
 * bottom of the screen:
 *
 *     float mask    = pow(abs(relY) * 2.0, expo);   // 0 centre, 1 at edges
 *     float xExpand = 1.0 + mask * stretchX;        // widen ACROSS travel
 *     float depth   = mask * stretchY;              // squash ALONG travel
 *
 * The rail travels horizontally, so the mask is built off screen X and the two
 * axes swap: pictures stretch VERTICALLY (across travel) and compress
 * HORIZONTALLY (along travel) as they near a side. Same relationship, same
 * curve, rotated a quarter turn.
 */

/**
 * A texture source. A canvas is accepted alongside an image so a caller can
 * hand over a COMPOSED plate — picture plus caption baked together — and have
 * the whole thing warp as one: anything living only in the DOM (a caption, a
 * scrim) is otherwise sliced off at the clip seam, because the tail redraws
 * from the texture alone.
 */
export type TunnelSource = HTMLImageElement | HTMLCanvasElement;

const sourceSize = (s: TunnelSource): { w: number; h: number } =>
  s instanceof HTMLImageElement
    ? { w: s.naturalWidth, h: s.naturalHeight }
    : { w: s.width, h: s.height };

const sourceReady = (s: TunnelSource): boolean =>
  s instanceof HTMLImageElement
    ? s.complete && s.naturalWidth > 0
    : s.width > 0 && s.height > 0;

export interface TunnelSlat {
  /** Screen rect of the slat, css px, y-down. */
  x: number;
  y: number;
  w: number;
  h: number;
  img: TunnelSource;
}

export interface RailTunnel {
  render(
    slats: TunnelSlat[],
    vw: number,
    vh: number,
    centerY: number,
    halfH: number,
    dpr: number,
    /**
     * 0 where the strip has run out on that side, 1 where it continues. Default
     * 1/1 keeps the flare on both edges for callers that do not track it.
     */
    leftGate?: number,
    rightGate?: number,
    /**
     * Row-wide concave arc: extra Y-scale at the window edge, quadratic from
     * the centre (see uArcBow in the vertex shader). Callers passing a
     * non-zero bow must hand over untransformed rects and mirror the curve's
     * tangent on their DOM copies. Default 0 — no arc.
     */
    arcBow?: number,
  ): void;
  dispose(): void;
}

/* ── Feel ── */
/**
 * uEdgeZone — the flare's reach, as a fraction of window width.
 *
 * 0.13, measured off the client's recording of the reference (their lens
 * spans ~150px of a 1164px window). The lens is a FIXED region of the screen
 * that content slides through — the layout itself is never touched, so the
 * zone must stay narrow: everything outside it is the plain layout, and all
 * of the turn's drama lives in the last few percent before the rim.
 */
export const BAND = 0.13;
/**
 * How tightly the warp hugs the very edge — and, just as importantly, how
 * CURVED it is. This exponent is what makes the lens invisible where it
 * begins and dramatic at the rim: pow(t, 2.6) enters at ZERO SLOPE (tangent
 * to the flat middle — no kink, no start-line) and accelerates hard in the
 * final few percent, which is what reads as the surface wrapping 90° around
 * a rounded corner. 2.6 is the reference's own value, read off their shader;
 * an intermediate pass eased it to 2.2 and the turn lost exactly that
 * character.
 */
export const EXPO = 2.6;
/**
 * uFan — how far the sheet flares at the very edge.
 *
 * There is no horizontal term, and that is the point. Their vertex shader ends
 * `float nx = sx * 2.0 - 1.0;` — X passes through completely untouched, and
 * ONLY Y is scaled. An earlier version here compressed X toward the screen edge
 * as well, which is not in their shader at all: it dragged each picture into a
 * thin sliver against the edge instead of letting the sheet bow, and because it
 * moved pictures sideways it was also what made them ride over their
 * neighbours. With X left alone, adjacent slats stay adjacent by construction
 * and cannot collide.
 *
 * 0.32, not the reference's 0.6: the flare now sits ON TOP of the row-wide
 * arc (uArcBow), which already lifts a rim bar to ~1.2x. Compounding 1.6
 * onto that reached ~1.92x — visibly harder than the reference's 1.6 cap —
 * so the flare's own share is trimmed to land the COMBINED stretch at
 * 1.2 x 1.32 ≈ 1.58, the reference's total. (Also what keeps the deepest bow
 * inside the works strip's 140% canvas headroom.)
 */
const STRETCH_Y = 0.32;
/** Spectral fan width, in texture units. */
const CHROMA = 0.075;
/** Luminance-keyed red bleed on top of the fan — the services tunnel's 0.85. */
const BLEED = 0.85;

/**
 * The DOM → GL handoff, as a function of a slat's centre.
 *
 * The ramp is a HAIRLINE, and deliberately so. It was a broad crossfade over
 * the outer half of the band, which meant that for the whole of that ramp a
 * warped GL copy and an unwarped DOM copy of the same slat were both on screen
 * at once — two different geometries of one picture, overlapping. That is the
 * collision.
 *
 * The reference hands over with `smoothstep(2e-4, 3e-4, edge)`: a swap so tight
 * it completes while the warp is still worth ~0.0002 of a pixel, i.e. while the
 * GL copy is still pixel-identical to the DOM one. Nothing visibly crosses
 * because there is nothing yet to see. Same idea here — by the time the warp is
 * legible, the DOM copy is long gone and only the sheet remains.
 */
export function handoff(centreX: number, vw: number): number {
  return handoffAt(Math.min(centreX, vw - centreX), vw);
}

/**
 * The same curve, driven by a distance in px from the nearer window edge.
 *
 * Prefer this for wide plates. Keying the handoff off a plate's CENTRE means a
 * 660px plate does not qualify until it is about 80% off-screen, so the flare
 * never fires on it at all — the band is only 10% of the window. What matters
 * is whether ANY part of the plate has entered the band, because the warp
 * itself is per-vertex and will simply be zero across the parts that have not.
 */
/**
 * Where the DOM stops and the GL tail begins, as a fraction of window width.
 *
 * Solved rather than guessed, exactly as they solve it: walk in from the edge
 * of the zone until `seam` — smoothstep(2e-4, 3e-4, edge) — reaches 0.99, i.e.
 * the first point at which the GL tail is fully opaque. Clipping the DOM there
 * means the two meet with neither a gap nor an overlap. Works out at 0.0874 of
 * the width, ~126px on a 1440 window.
 */
export const CLIP = (() => {
  const ss = (a: number, b: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let n = BAND; n > 0; n -= 1e-5) {
    if (ss(0.0002, 0.0003, Math.pow(ss(BAND, 0, n), EXPO)) >= 0.99) return n;
  }
  return BAND * 0.996;
})();

export function handoffAt(distPx: number, vw: number): number {
  const dist = distPx / vw;
  const t = Math.max(0, Math.min(1, 1 - dist / BAND));
  const mask = Math.pow(t, EXPO);
  const a = 0.0002;
  const b = 0.0003;
  const s = Math.max(0, Math.min(1, (mask - a) / (b - a)));
  return s * s * (3 - 2 * s);
}

const VERT = [
  "attribute vec2 aUv;",
  "uniform vec4 uRect;",     // x, y, w, h (css px, y-down)
  "uniform vec2 uRes;",
  "uniform float uCenterY;", // shared by every slat, so the row fans as one sheet
  "uniform float uBand;",
  "uniform float uExpo;",
  "uniform float uStretchY;",
  "uniform float uLeftGate;",  // 0 when there is no strip left of the window
  "uniform float uRightGate;", // 0 when there is no strip right of it
  // Full-width concave arc — the curved-screen bow ACROSS the whole row, not
  // just the edge bands. 0 for callers that don't use it. A caller that does
  // must hand over UNTRANSFORMED rects and apply the same parabola's tangent
  // (skewY + scaleY) to its DOM copies, so the two sides of the handoff seam
  // agree; the shader's per-vertex version is the exact curve, the DOM's
  // per-plate version its linearisation, and across one slat's width the two
  // differ by well under a pixel.
  "uniform float uArcBow;",
  "varying vec2 vUv;",
  "varying float vMask;",
  "varying float vY;",
  "void main() {",
  "  vUv = aUv;",
  // Where this VERTEX sits on screen — not the slat's centre. Computing the
  // mask per-vertex is the whole point: the two sides of one picture get
  // different amounts, and that gradient is what reads as depth.
  "  vec2 screen = uRect.xy + aUv * uRect.zw;",
  "  float sx = screen.x / uRes.x;",
  "  float dist = min(sx, 1.0 - sx);",
  "  float m = clamp(1.0 - dist / uBand, 0.0, 1.0);",
  "  float mask = pow(m, uExpo);",
  // ── End gates ──
  // At either scroll limit there is nothing beyond the outermost plate, so a
  // bow there has no neighbour to bend away from: the plate flares against bare
  // canvas and its own silhouette reads as a hard dark edge down the side. That
  // is the black line. Their shader gates it with exactly this line, killing
  // the warp on whichever side has run out of strip so the last plate sits
  // flat.
  "  mask *= mix(uLeftGate, uRightGate, step(0.5, sx));",
  // Ramp the warp with the same curve as the handoff, so the flat DOM copy and
  // the warped GL one stay aligned through the seam — their comment for this
  // line notes that a hard step here leaves white gaps and vertical tears.
  "  float blend = smoothstep(0.0002, 0.0003, mask);",
  // The row-wide arc: quadratic in the vertex's distance from screen centre,
  // flat at the apex — computed per-VERTEX, so a slat's top and bottom edges
  // genuinely curve along it instead of stepping.
  "  float dxc = (sx - 0.5) * 2.0;",
  "  float arc = 1.0 + uArcBow * dxc * dxc;",
  // Across travel: the arc first, then the edge flare's stretch away from the
  // shared centreline on top of it.
  "  float y = uCenterY + (screen.y - uCenterY) * arc * (1.0 + uStretchY * mask * blend);",
  // X passes through untouched — see the note on STRETCH_Y.
  "  gl_Position = vec4(sx * 2.0 - 1.0, 1.0 - (y / uRes.y) * 2.0, 0.0, 1.0);",
  "  vMask = mask;",
  "  vY = y;",
  "}",
].join("\n");

const FRAG = [
  "precision highp float;",
  "varying vec2 vUv;",
  "varying float vMask;",
  "varying float vY;",
  "uniform sampler2D uTex;",
  "uniform float uChroma;",
  "uniform float uBleed;",
  "uniform float uFade;",
  "uniform float uCenterY;",
  "uniform float uHalfH;",
  "uniform vec2 uUvScale;",   // object-fit: cover crop
  "uniform vec2 uUvOffset;",
  // The services tunnel's own ramp: ember -> hot red -> scarlet -> brand red
  // -> crimson -> deep maroon. It spans a WIDE spread of reds on purpose; a
  // ramp sitting entirely in the dark half averages back to a muddy near-grey
  // across eight samples and the dispersion stops registering at all.
  "vec3 brandChroma(float t) {",
  "  vec3 c0 = vec3(1.0000, 0.4118, 0.1176);", // #FF691E ember
  "  vec3 c1 = vec3(1.0000, 0.1373, 0.0588);", // #FF230F hot red
  "  vec3 c2 = vec3(0.9412, 0.0196, 0.0706);", // #F00512 scarlet
  "  vec3 c3 = vec3(0.7686, 0.0039, 0.0510);", // #C4010D brand red
  "  vec3 c4 = vec3(0.6039, 0.0000, 0.1216);", // #9A001F crimson
  "  vec3 c5 = vec3(0.3765, 0.0000, 0.1490);", // #600026 deep maroon
  "  float x = clamp(t, 0.0, 1.0) * 5.0;",
  "  if (x < 1.0) return mix(c0, c1, x);",
  "  if (x < 2.0) return mix(c1, c2, x - 1.0);",
  "  if (x < 3.0) return mix(c2, c3, x - 2.0);",
  "  if (x < 4.0) return mix(c3, c4, x - 3.0);",
  "  return mix(c4, c5, x - 4.0);",
  "}",
  "void main() {",
  // object-fit: cover, in the shader. Without it the GL copy samples the raw
  // image 0..1 while its DOM twin is cover-cropped, so the two show DIFFERENT
  // crops of the same photo and the picture visibly jumps at the handoff. That
  // jump is the tearing seen while dragging.
  "  vec2 uv = uUvOffset + vUv * uUvScale;",
  "  vec4 base = texture2D(uTex, uv);",
  // Their two gates. `seam` carries alpha across the DOM handoff; `fx` holds
  // the chroma off until the warp is genuinely bending, so brightness at the
  // seam still matches the DOM copy exactly.
  "  float seam = smoothstep(0.0002, 0.0003, vMask);",
  "  float fx = smoothstep(0.0003, 0.012, vMask);",
  // ── Dispersion, in the brand's colours ──
  // Their split is two samples on the R and B channels, which fans out to cyan
  // and red — an RGB rainbow. This site's services tunnel disperses through a
  // brand ramp instead, and that is the treatment wanted here, so the structure
  // is theirs and the palette is ours: eight samples fanned along the same Y
  // axis at the same widening offset, each tinted with a stop from the ramp.
  //
  // Kept identical to WebGLTextTunnel's ramp, stop for stop, so the two
  // sections disperse through the same colours.
  "  float ca = uChroma * fx * (0.4 + vMask);",
  "  vec3 acc = vec3(0.0);",
  "  for (int i = 0; i < 8; i++) {",
  "    float t = float(i) / 7.0;",
  "    float off = (t - 0.5) * ca * 2.0;",
  "    acc += texture2D(uTex, vec2(uv.x, uv.y + off)).rgb * brandChroma(t);",
  "  }",
  // The ramp averages ~0.78 red against ~0.10 green/blue, so a plain /8 would
  // also dim the fringe by a fifth. Renormalising against that mean keeps the
  // plate's brightness and spends it on saturation instead — without it the
  // dispersion just reads as the picture going dark at the edges.
  "  vec3 fringe = acc / 8.0 * 1.28;",
  // The services tunnel mixes on `pow(mask, 0.55)`, NOT on the fx gate — a
  // gradual climb rather than a slam to full red.
  "  float tint = pow(vMask, 0.55);",
  "  vec3 rgb = mix(base.rgb, fringe, tint);",
  // The same luminance-keyed bleed the services tunnel adds on top. Keyed to
  // the picture's own brightness so it lights what is there rather than
  // flooding the whole plate, and green/blue stay near zero so it deepens the
  // red instead of washing out to white.
  "  float lum = dot(base.rgb, vec3(0.299, 0.587, 0.114));",
  "  rgb += vec3(0.95, 0.05, 0.12) * lum * tint * uBleed;",
  // NO vertical mask. There was one here, feathering the tail away past the
  // row's band to stop it running over the masthead — and it was the single
  // reason the effect never read as depth. The geometry bows correctly, but
  // masking it back inside a horizontal band cuts the bow off and leaves a
  // straight-edged rectangle: the picture's CONTENT curved while the picture
  // itself stayed square. The plates are given headroom in the layout instead
  // (see .cstrip__plate), so the flare has room to bow inside the canvas.
  // PREMULTIPLIED, as theirs is. A non-premultiplied canvas resolved with
  // MSAA leaves partially-covered edge pixels whose colour the compositor
  // then divides by a small alpha — which fringes them dark. Every quad edge
  // is such a boundary, so the wrap seam showed a black hairline. Emitting
  // premultiplied colour (and blending ONE / ONE_MINUS_SRC_ALPHA) leaves
  // nothing to divide and the fringe cannot occur.
  "  float a = base.a * uFade * seam;",
  "  gl_FragColor = vec4(rgb * a, a);",
  "}",
].join("\n");

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn("[railTunnel]", gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

export function createRailTunnel(canvas: HTMLCanvasElement): RailTunnel | null {
  // WebGL2 first: WebGL1 cannot mipmap a non-power-of-two texture, and every
  // photo here is NPOT. Without mipmaps the minified plate aliases, and while
  // dragging that alias crawls — which reads as the picture tearing. Falls back
  // to WebGL1 (unmipmapped, still correct) where 2 is unavailable.
  const gl2 = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
  }) as WebGL2RenderingContext | null;
  const gl = (gl2 ??
    canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    })) as WebGLRenderingContext | null;
  if (!gl) return null;
  const canMipmap = !!gl2;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("[railTunnel]", gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  // ── Subdivided quad ──
  // COLS is what buys the gradient across a picture's width. At 1 column the
  // warp collapses to a single matrix per slat — i.e. back to what a CSS
  // transform could already do on its own.
  // The bow is a curve in X and a straight line in Y: for a fixed column,
  // y maps linearly, so rows buy nothing beyond the two the quad needs. Columns
  // are the entire smoothness budget — at 24 the curve was 27px of flat chord
  // per segment across a 660px plate, which is visible faceting along the
  // bowed edge. 128 puts a vertex every ~5px.
  const COLS = 128;
  const ROWS = 2;
  const verts: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c <= COLS; c++) verts.push(c / COLS, r / ROWS);
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = r * (COLS + 1) + c;
      const b = a + 1;
      const d = a + (COLS + 1);
      const e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
  }
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);

  const aUv = gl.getAttribLocation(prog, "aUv");
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

  const u = {
    rect: gl.getUniformLocation(prog, "uRect"),
    res: gl.getUniformLocation(prog, "uRes"),
    centerY: gl.getUniformLocation(prog, "uCenterY"),
    band: gl.getUniformLocation(prog, "uBand"),
    expo: gl.getUniformLocation(prog, "uExpo"),
    stretchY: gl.getUniformLocation(prog, "uStretchY"),
    chroma: gl.getUniformLocation(prog, "uChroma"),
    bleed: gl.getUniformLocation(prog, "uBleed"),
    fade: gl.getUniformLocation(prog, "uFade"),
    halfH: gl.getUniformLocation(prog, "uHalfH"),
    uvScale: gl.getUniformLocation(prog, "uUvScale"),
    uvOffset: gl.getUniformLocation(prog, "uUvOffset"),
    leftGate: gl.getUniformLocation(prog, "uLeftGate"),
    rightGate: gl.getUniformLocation(prog, "uRightGate"),
    arcBow: gl.getUniformLocation(prog, "uArcBow"),
    tex: gl.getUniformLocation(prog, "uTex"),
  };
  gl.uniform1i(u.tex, 0);
  gl.uniform1f(u.band, BAND);
  gl.uniform1f(u.expo, EXPO);
  gl.uniform1f(u.stretchY, STRETCH_Y);
  gl.uniform1f(u.chroma, CHROMA);
  gl.uniform1f(u.bleed, BLEED);

  gl.enable(gl.BLEND);
  // Premultiplied blending, to match the shader's premultiplied output.
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // One texture per source, uploaded the first time it is needed and kept —
  // the rail cycles the same handful of pictures forever. A caller that
  // REDRAWS a composed canvas must hand over a fresh canvas element, not
  // repaint the old one: the upload is keyed on the element and never re-read.
  const texes = new WeakMap<TunnelSource, WebGLTexture>();
  const textureFor = (img: TunnelSource) => {
    const cached = texes.get(img);
    if (cached) return cached;
    if (!sourceReady(img)) return null;
    const t = gl.createTexture();
    if (!t) return null;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      canMipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Anisotropic filtering if the driver offers it. The plate is stretched
    // hard along Y while staying put along X, so the sampling footprint is very
    // elongated — exactly the case trilinear alone blurs and shimmers on.
    const aniso =
      gl.getExtension("EXT_texture_filter_anisotropic") ||
      gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
    if (aniso) {
      const max = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      gl.texParameterf(
        gl.TEXTURE_2D,
        aniso.TEXTURE_MAX_ANISOTROPY_EXT,
        Math.min(8, max),
      );
    }
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      if (canMipmap) gl.generateMipmap(gl.TEXTURE_2D);
    } catch {
      // A cross-origin image without CORS taints the upload; skip it rather
      // than throwing every frame. The rail's own pictures are same-origin.
      gl.deleteTexture(t);
      return null;
    }
    texes.set(img, t);
    return t;
  };

  return {
    render(slats, vw, vh, centerY, halfH, dpr, leftGate = 1, rightGate = 1, arcBow = 0) {
      const bw = Math.max(1, Math.round(vw * dpr));
      const bh = Math.max(1, Math.round(vh * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, bw, bh);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!slats.length) return;

      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.uniform2f(u.res, vw, vh);
      gl.uniform1f(u.centerY, centerY);
      gl.uniform1f(u.halfH, halfH);
      gl.uniform1f(u.leftGate, leftGate);
      gl.uniform1f(u.rightGate, rightGate);
      gl.uniform1f(u.arcBow, arcBow);

      // No scissor. It was here to stop a warped copy riding over its
      // neighbours, but that was only possible while X was being compressed
      // sideways. With X passing through untouched a tile cannot move into its
      // neighbour's column at all, and the scissor's only remaining effect was
      // to slice the sheet off at the band's inner lip.

      for (const s of slats) {
        const t = textureFor(s.img);
        if (!t) continue;
        // Seam: ramp in over the outer half of the band, so the handoff from
        // the DOM copy is a crossfade rather than a swap.
        // 1, always. The tail's visibility is the `seam` mask in the
        // fragment shader — it is 0 across the part of the tile the DOM still
        // owns and 1 across the tail, which is precisely complementary to the
        // DOM's clip. A per-tile fade on top of that would dim the join.
        gl.uniform1f(u.fade, 1);
        // object-fit: cover, computed the way the DOM does it — crop the
        // long axis, centre what is left. The GL copy has to frame the photo
        // identically to its DOM twin or the picture jumps at the handoff.
        // (A composed canvas is built at the plate's own aspect, so for it
        // this works out to no crop at all.)
        const size = sourceSize(s.img);
        const ia = size.w / Math.max(1, size.h);
        const ba = s.w / Math.max(1, s.h);
        let sx = 1;
        let sy = 1;
        if (ia > ba) sx = ba / ia;
        else sy = ia / ba;
        gl.uniform2f(u.uvScale, sx, sy);
        gl.uniform2f(u.uvOffset, (1 - sx) / 2, (1 - sy) / 2);
        gl.uniform4f(u.rect, s.x, s.y, s.w, s.h);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
      }
    },
    dispose() {
      gl.deleteBuffer(vbo);
      gl.deleteBuffer(ibo);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}
