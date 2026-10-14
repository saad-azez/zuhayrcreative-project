"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { useGPU, useSceneLease } from "@/app/animations/hooks/useNearViewport";
import { isPhoneDevice } from "@/app/lib/device";
import { releaseCanvasContext } from "@/app/lib/webglContexts";
import { rasterise, type RasterTarget } from "./marbleRaster";

/**
 * The marble seam — the home page's section transitions, after scrolltide's
 * "Marble Scroll" (client's reference: Screen Recording 2026-10-10 220246).
 * Made for services → gallery, and at every join after it since the client
 * saw it there (15 Oct: "the marble scroll looks really cool, let's add it
 * across the site"). The other pages are a section each, with no join.
 *
 * ── What the reference does (read off the recording a frame at a time) ──
 * Two full-bleed pictures, one above the other, scrolling as any two
 * sections do. Nothing is held still and nothing is laid over them. The
 * effect is ON the pictures, where they meet: for about a third of a screen
 * either side of their shared edge, the picture is no longer drawn where it
 * is but where a field of displacement says, so the foot of the upper
 * picture and the head of the lower one are bent into each other. The field
 * is in blocks (uneven columns, cut across at uneven heights, each block
 * slipped whole) and, inside them, in marbled swirls; it is strongest on the
 * edge and gone a third of a screen from it. The edge itself is therefore
 * not a line any more: it is wherever the displacement carries it, a
 * coastline with pieces of each picture stranded in the other. It rides the
 * scroll with the sections, and stands still when the scroll does.
 *
 * ── What this is ──
 * The same thing on this page's own two sections (client, 14 Oct: "the
 * effect is applied on both the images, for the top image on the bottom and
 * for the bottom image on the top, so that it looks seamless … it is not
 * looking like a part of the section"). Two earlier builds missed it: the
 * first (12 Oct) laid a sheet of marbled colour along the join; the second
 * held both screens still under a canvas and swept a tear across them. Both
 * were something put over the sections, and looked it.
 *
 * ── Its room ──
 * The reference's pictures are photographs: there is nothing in them that
 * has to be read, so the bend can run a third of a screen into each. These
 * two sections are words to their edges (the services' description at the
 * foot of one, the headline at the head of the other), and the third build,
 * which bent them where they stood, made them unreadable and, where its
 * drawn copy of a word did not sit exactly on the page's own, showed the
 * word twice (client, 14 Oct: "the effect is making my text unable to read,
 * there isn't a room between the two sections for the transition to even
 * live in … why am I seeing two texts"). So it has room now: MarbleSeam is
 * a stretch of the page between the two sections (GAP_SVH tall, the join in
 * its middle) with nothing in it but the page's background, and the bend
 * lives there and only there. The band's reach is half the gap, measured
 * off the gap itself, so it ends exactly where each section begins: no
 * pixel of a section is ever under it. And it draws no words at all (see
 * marbleRaster's `text`), so there is nothing of a section it could show a
 * second time.
 *
 * What is bent, then: the page's background across the gap, and whatever of
 * the two sections' canvases, pictures and line work the displacement
 * reaches for past the gap's edges (the services tunnel's streaks, mostly),
 * drawn down or up into the gap and marbled there.
 *
 * ── How ──
 * A shader cannot bend live HTML, so the page is brought to it. While the
 * gap is on or near the screen, the screen-height of page either side of
 * the join is drawn into two pictures (marbleRaster.ts), a few times a
 * second so that what moves in them moves. A canvas fixed over the page
 * draws only the gap: each point of it looks up the page at that point PLUS
 * the displacement there, and shows what it finds, from whichever picture
 * that lands in. Toward the gap's edges the displacement goes to nothing
 * and then the canvas fades out, over background that is the same picture
 * under it. The page is never moved or held.
 *
 * The canvas is IN the page, the gap's own size and in the gap's place, so
 * it scrolls with the page as the page does. It was fixed over the screen
 * and drew the gap wherever it measured it to be, which is exact under the
 * site's own smooth scroll (the page moves when the script says) and is not
 * on a phone, whose scroll runs ahead of the script and whose height
 * changes as its browser's bars slide in and out: the band was drawn a
 * little off its room, and jumped as the bars moved (client, 15 Oct: "phone
 * version doesn't work properly"). Everything in it is laid out from the
 * gap, so nothing of it moves with the screen's height either: only the
 * background is read off the screen, and that is soft enough for a frame's
 * lag behind a fast flick not to show.
 *
 * The page's background scene is live in it: read from its own canvas every
 * frame, bent by the same displacement, with the two pictures' contents laid
 * over it in the shader. (A WebGL canvas only has a picture in it in a frame
 * it drew in, and that scene does not draw every frame, least of all on
 * phones: a frame that reads empty keeps the last one that did not. See the
 * store pass.)
 *
 * ── Cost ──
 * One WebGL context and four screen-sized bitmaps (the canvas itself is the
 * gap's size, and the background is kept at half its own), built on approach and
 * released when far (useSceneLease, GPU check included), handed back to the
 * page's budget on unmount. Nothing runs unless the gap is on the screen,
 * and only its rows are shaded. Reduced motion, and a machine with no GPU,
 * get neither the bend nor the gap: the two sections meet as they did, with
 * whatever the page gives as `fallback` (its old seam).
 */

/** The room the transition lives in, between the two sections, in small viewport heights. */
const GAP_SVH = 64;

/**
 * The bitmaps and the canvas are drawn at this many device pixels per CSS px,
 * at most, and at no more than PIXEL_BUDGET pixels each: the pictures are
 * seen bent and in motion, and do not need the screen's last pixel.
 */
const DPR_CAP = 1.5;
const PIXEL_BUDGET = 2_600_000;
/**
 * The two pictures are redrawn this often while the band is on screen, at
 * most; and no more often than leaves the drawing a tenth of the time, so a
 * slow phone spends its frames on the scroll, not on the pictures.
 */
const REDRAW_MS = 140;
const REDRAW_SHARE = 10;
/**
 * On a phone, less often: what is in the pictures is the sections' edges as
 * the bend reaches into them, which barely change in a third of a second,
 * and a slow phone at the impact section's join (all its counters, and the
 * globe's canvas just below) lost a frame in four to redrawing them.
 */
const REDRAW_MS_LITE = 340;
const REDRAW_SHARE_LITE = 16;
/**
 * How much of the gap's half the bend takes at rest; a fast scroll takes
 * the rest of it.
 */
const REACH_REST = 0.86;

/**
 * The work section's dark plane (works-strip.css, `.wstrip::before`): its
 * colour and opacity, and how far past the section it reaches as it fades
 * out, in large viewport heights. The rasteriser cannot see it (it is a
 * pseudo-element), so a seam next to that section is told it is there
 * (`veil`) and lays it into the gap itself, or the band would show the
 * page's ground undarkened against the plane either side of it.
 */
const VEIL = { rgb: [5, 5, 7], alpha: 0.7, reachVh: 25 };

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const frag = (lite: boolean) => `
precision highp float;
uniform vec2  u_res;      // the canvas (the gap), drawing-buffer px; the join is its middle row
uniform float u_vh;       // one small viewport height ("a screen" from here on), in buffer px
uniform float u_top;      // where the canvas's top is on the screen, buffer px
uniform vec2  u_scr;      // the screen, buffer px (for the background, which is on it)
uniform float u_phase;    // how far the join has travelled up the screen, in screens
uniform float u_time;
uniform float u_vel;      // scroll speed, 0..1, smoothed
uniform float u_dir;      // last direction of travel: 1 down, -1 up
uniform sampler2D u_bg;   // the page's background scene, live (the store pass's output)
uniform vec4  u_bgRect;   // where that scene is on the screen: x, y, w, h, as fractions of u_scr
uniform sampler2D u_a;    // the screen of page above the join: its contents, over nothing
uniform sampler2D u_ad;   // ...and the parts of it that are blended by difference
uniform sampler2D u_b;    // the screen of page below it
uniform sampler2D u_bd;

uniform float u_reach;    // half the gap, in screens: the band never goes past it
uniform float u_veilA;    // a dark plane the section above lays over the background, reaching
uniform float u_veilB;    // into the gap (and the one below's): its opacity, 0 for none
uniform float u_veilFade; // how far into the gap it reaches as it fades, in screens

#define OCT ${lite ? 3 : 5}
#define REACH_REST ${REACH_REST.toFixed(3)}
#define VEIL vec3(${VEIL.rgb.map((v) => (v / 255).toFixed(4)).join(", ")})

float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x),
             mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < OCT; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

// The page at a point. \`x\` is across the screen (0..1) and \`t\` is how far
// below the join, in screens (negative above it): above, the point is in
// the upper picture, which ends at the join; below, in the lower one, which
// starts there. \`at\` is where on the SCREEN that point is being drawn from,
// for the background, which does not scroll. Contents are premultiplied
// over the background, and whatever is set to "mix-blend-mode: difference"
// is taken as the difference from what is under it, as the page does.
vec3 page(float x, float t, vec2 at) {
  vec3 c = texture2D(u_bg, clamp((at - u_bgRect.xy) / u_bgRect.zw, 0.0, 1.0)).rgb;
  // A section's own dark plane, where it overhangs into the gap: full at the
  // section's edge, gone a fade's length out (the work section's, see
  // works-strip.css). It is part of the page here, so it is bent with it.
  c = mix(c, VEIL, u_veilA * clamp(1.0 - (t + u_reach) / u_veilFade, 0.0, 1.0));
  c = mix(c, VEIL, u_veilB * clamp(1.0 + (t - u_reach) / u_veilFade, 0.0, 1.0));
  vec4 o;
  vec4 d;
  if (t < 0.0) {
    vec2 uv = vec2(x, clamp(1.0 + t, 0.0, 1.0));
    o = texture2D(u_a, uv);
    d = texture2D(u_ad, uv);
  } else {
    vec2 uv = vec2(x, clamp(t, 0.0, 1.0));
    o = texture2D(u_b, uv);
    d = texture2D(u_bd, uv);
  }
  c = c * (1.0 - o.a) + o.rgb;
  if (d.a > 0.003) c = mix(c, abs(c - d.rgb / d.a), d.a);
  return c;
}

void main() {
  // In screens: xn across, t down from the join. "scr" is the point on the
  // screen, as a fraction of it, for the background.
  vec2 px = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  float xu = px.x / u_res.x;
  vec2 scr = (px + vec2(0.0, u_top)) / u_scr;
  float xn = px.x / u_vh;
  float t = (px.y - 0.5 * u_res.y) / u_vh;
  float v = u_vel;

  // ── The envelope: all of it on the join, none of it at the gap's edges ──
  // The bend is gone by four fifths of the way out; the last fifth is the
  // canvas fading into the page, over a picture that is by then unbent.
  float reach = u_reach * (REACH_REST + (1.0 - REACH_REST) * v);
  float far = abs(t) / reach;
  if (far >= 1.0) { gl_FragColor = vec4(0.0); return; }
  float w = 1.0 - smoothstep(0.0, 0.8, far);
  w = w * (0.85 + 0.45 * v);

  // ── The blocks: uneven columns, each cut across at its own spacing ──
  // Six to fourteen columns across the screen, as in the reference; a warp
  // in x makes the widths uneven. The rows are counted from the join, so the
  // blocks ride the scroll with the sections.
  float aspect = u_res.x / u_vh;
  float cols = clamp(aspect * 7.0, 6.0, 14.0) / aspect;
  float c = floor(xn * cols + 0.9 * noise(vec2(xn * 1.4, 3.1)));
  float hc = hash1(c + 1.0);
  float rowH = mix(0.06, 0.16, hash1(c + 3.0));
  float row = floor(t / rowH + hc * 7.0);
  // Most blocks are slipped whole, mostly up or down, by their own amount.
  vec2 slip = vec2(hash2(vec2(row, c + 2.0)), hash2(vec2(c + 5.0, row))) - 0.5;
  float slipped = step(0.3, hash2(vec2(c * 1.3 + 4.0, row)));

  // ── The marble: a domain-warped field, drawn out downward ──
  // It flows as the join travels (u_phase) and barely at all otherwise, so
  // it moves with the scroll and stands when the scroll does.
  vec2 q = vec2(xn * 1.6, t * 1.1) + slip * 0.35 * slipped + vec2(0.0, u_phase * 0.55 + u_time * 0.012);
  float w1 = fbm(q * 2.2);
  float w2 = fbm(q * 2.2 + 3.5 * vec2(w1, w1 * 0.7) + vec2(1.7, 9.2));
  float m = fbm(q * 1.8 + 3.8 * vec2(w2, w2 * 1.3));

  // ── The coast: the join's own line, in bays and headlands ──
  // Read at the column's middle in about half the columns, which squares
  // those stretches off into steps.
  float stepped = step(0.5, hash1(c + 7.0));
  float xf = mix(xn, (c + 0.5) / cols, stepped);
  float coast = 0.50 * (fbm(vec2(xf * 2.1 + 3.0, 1.3)) - 0.47)
              + 0.16 * (fbm(vec2(xf * 5.3, 7.0)) - 0.47);

  // ── The displacement, in screens ──
  // Where this point of the screen looks for its picture: up or down by the
  // coast, by its block's slip and by the marble; a little sideways by the
  // last two. It is this, and nothing drawn, that makes the tear: on the
  // join the look-up crosses from one picture into the other, and the line
  // it crosses on is as ragged as the field.
  // The marble's share is the large one: the gap holds no words, only the
  // page's ground and whatever of the sections' pictures the look-up
  // reaches, so it can be bent hard enough to turn that ground's soft
  // shapes into veins, which is what makes it marble and not a wobble.
  vec2 disp = w * (vec2(0.0, coast)
                 + slipped * vec2(slip.x * 0.07, slip.y * 0.30)
                 + (vec2(w1, w2) - 0.5) * vec2(0.85, 1.15)
                 + (m - 0.5) * vec2(0.30, 0.45)
                 + vec2(0.0, -u_dir * 0.05 * v));
  vec2 vh2uv = u_vh / u_scr;
  vec3 col = page(xu + disp.x * u_vh / u_res.x, t + disp.y, scr + disp * vh2uv);

  // The marble's own light: its folds shade the picture a little, and each
  // block stands in its own. A bend is only seen where the picture has
  // something to bend; this page's ground is soft and even, where the
  // reference's photographs give theirs away at every edge.
  float fold = (m - 0.5) * 2.0;
  col *= 1.0 + w * (0.16 * fold + slipped * 0.06 * (hash2(vec2(c + 9.0, row)) - 0.5));

  // Faded out toward the band's edges, where the displacement has gone to
  // nothing and the live page under the canvas is the same picture.
  float a = 1.0 - smoothstep(0.8, 1.0, far);
  gl_FragColor = vec4(col * a, a);
}
`;

/**
 * The store pass: the background scene as it is this frame where this frame
 * has it, and as it last was where it does not. A WebGL canvas that did not
 * draw this frame reads as nothing (black, clear), so "has it" is "is not
 * black": a scene of reds and greys over a dark ground is never that.
 */
const STORE_FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform sampler2D u_live;
uniform sampler2D u_prev;
void main() {
  vec2 uv = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_res;
  vec4 live = texture2D(u_live, uv);
  vec4 prev = texture2D(u_prev, vec2(uv.x, 1.0 - uv.y));
  float has = step(0.006, max(live.r, max(live.g, live.b)));
  gl_FragColor = vec4(mix(prev.rgb, live.rgb, has), 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (onChange: () => void) => {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

export default function MarbleSeam({
  veil,
  fallback = null,
}: {
  /** Which neighbour lays the work section's dark plane into the gap. */
  veil?: "above" | "below";
  /** What the join has instead where there is no bend (reduced motion, no GPU). */
  fallback?: ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const near = useSceneLease(anchorRef, { label: "Marble seam" });
  // Reduced motion gets no transition. Asked the way that hydrates: the
  // server cannot know, so it and the first client render both say no.
  const still = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );

  // The room is part of the page's layout, so it does not come and go with
  // the scroll: it is there for every visitor who gets the bend.
  const gpu = useGPU();
  const room = !still && gpu;
  const half = room ? `${GAP_SVH / 2}svh` : 0;

  return (
    <>
      <div aria-hidden data-marble-gap style={{ height: half }} />
      {/* The anchor: zero height, on the join, in the middle of the gap. */}
      <div
        ref={anchorRef}
        data-marble-seam
        data-marble-room={room ? "" : undefined}
        aria-hidden
        className="relative w-full"
        style={{ height: 0 }}
      >
        {room && near && <MarbleBand anchorRef={anchorRef} veil={veil} />}
      </div>
      <div aria-hidden data-marble-gap style={{ height: half }} />
      {!room && fallback}
    </>
  );
}

/** A screen-sized 2D canvas to draw a picture into, clear where the page shows through. */
function makeTarget(): RasterTarget {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
}

function MarbleBand({
  anchorRef,
  veil,
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  veil?: "above" | "below";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const anchor = anchorRef.current;
    if (!canvas || !anchor) return;
    const lite = isPhoneDevice();
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const link = (fragSrc: string) => {
      const p = gl.createProgram()!;
      gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
      gl.bindAttribLocation(p, 0, "a_pos");
      gl.linkProgram(p);
      return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
    };
    const prog = link(frag(lite));
    const storeProg = link(STORE_FRAG);
    if (!prog || !storeProg) return;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 0);

    gl.useProgram(prog);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = U("u_res"), uVh = U("u_vh"), uTop = U("u_top"), uScr = U("u_scr");
    const uPhase = U("u_phase"), uTime = U("u_time"), uVel = U("u_vel"), uDir = U("u_dir");
    const uBgRect = U("u_bgRect"), uReach = U("u_reach"), uVeilFade = U("u_veilFade");
    gl.uniform1f(U("u_veilA"), veil === "above" ? VEIL.alpha : 0);
    gl.uniform1f(U("u_veilB"), veil === "below" ? VEIL.alpha : 0);
    // Units: 0 the background (the store), 1-4 the two pictures, 5 the scene as read this frame.
    gl.uniform1i(U("u_bg"), 0);
    gl.uniform1i(U("u_a"), 1);
    gl.uniform1i(U("u_ad"), 2);
    gl.uniform1i(U("u_b"), 3);
    gl.uniform1i(U("u_bd"), 4);
    gl.useProgram(storeProg);
    const sRes = gl.getUniformLocation(storeProg, "u_res");
    gl.uniform1i(gl.getUniformLocation(storeProg, "u_live"), 5);
    gl.uniform1i(gl.getUniformLocation(storeProg, "u_prev"), 0);

    const makeTexture = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    };
    gl.activeTexture(gl.TEXTURE0 + 7); // a unit nothing samples, for setting textures up
    const overlay = [makeTexture(), makeTexture(), makeTexture(), makeTexture()]; // A, A diff, B, B diff
    const liveTex = makeTexture();
    // The store: two textures taken in turn, each frame's written from the other's.
    const store = [makeTexture(), makeTexture()];
    const fbo = [gl.createFramebuffer(), gl.createFramebuffer()];
    let cur = 0;
    // The 2D canvases are premultiplied; kept so on the way in, which is what
    // the shader's "over" expects.
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const upload = (index: number, src: HTMLCanvasElement) => {
      gl.activeTexture(gl.TEXTURE0 + 7);
      gl.bindTexture(gl.TEXTURE_2D, overlay[index]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    };

    // ── The pictures: a screen of page each side of the join, and its difference-blended parts ──
    const above = makeTarget();
    const aboveDiff = makeTarget();
    const below = makeTarget();
    const belowDiff = makeTarget();
    let dpr = 1;
    let vw = 0;
    // "A screen" here is the small viewport's height, read off the gap (which
    // is GAP_SVH of them): it does not change as a phone's bars slide.
    let vh = 0;
    let gapPx = 0;
    const size = () => {
      vw = canvas.clientWidth || window.innerWidth;
      gapPx = canvas.clientHeight;
      vh = (gapPx * 100) / GAP_SVH;
      if (!vw || !gapPx) return;
      dpr = Math.min(
        window.devicePixelRatio || 1,
        DPR_CAP,
        Math.sqrt(PIXEL_BUDGET / Math.max(1, vw * vh)),
      );
      const w = Math.max(1, Math.round(vw * dpr));
      const h = Math.max(1, Math.round(vh * dpr));
      for (const c of [above.canvas, aboveDiff.canvas, below.canvas, belowDiff.canvas]) {
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
      }
      const gh = Math.max(1, Math.round(gapPx * dpr));
      if (canvas.width !== w || canvas.height !== gh) {
        canvas.width = w;
        canvas.height = gh;
      }
      gl.useProgram(prog);
      gl.uniform2f(uRes, w, gh);
      gl.uniform1f(uVh, vh * dpr);
      // Half the gap, in screens: as far as the band goes either side of the join.
      gl.uniform1f(uReach, gapPx / 2 / vh);
      gl.uniform1f(uVeilFade, Math.max(0.01, (VEIL.reachVh / 100) * (window.innerHeight / vh)));
    };
    size();

    // The store, at half the scene's own size (it is soft, and it is only
    // ever seen bent), made again only when that size changes.
    let storeW = 0;
    let storeH = 0;
    // Whether the store has the scene in it yet. Until it has, there is no
    // band: the ground colour it starts as is near black, and drawn across
    // the gap it was a black band (client, 15 Oct). Without the bend the gap
    // is the live page, which is only less interesting.
    let haveScene = false;
    const sizeStore = (sw: number, sh: number) => {
      if (sw === storeW && sh === storeH) return;
      storeW = sw;
      storeH = sh;
      haveScene = false;
      // It starts as the page's own ground colour, for the frames before the
      // scene has been read once.
      gl.activeTexture(gl.TEXTURE0 + 7);
      for (let i = 0; i < 2; i++) {
        gl.bindTexture(gl.TEXTURE_2D, store[i]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, store[i], 0);
        gl.clearColor(0x2a / 255, 0x0a / 255, 0x12 / 255, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.clearColor(0, 0, 0, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(storeProg);
      gl.uniform2f(sRes, sw, sh);
    };
    sizeStore(2, 2);

    /**
     * Where an element really is. The sections here sit in wrappers that
     * have no box of their own (LazyHydrate's are `display: contents`), and
     * such a wrapper reports an empty rect at the page's origin: its box is
     * its content's.
     */
    const boxOf = (el: Element): DOMRect => {
      let r = el.getBoundingClientRect();
      for (let depth = 0; depth < 4 && !r.width && !r.height; depth++) {
        const child: Element | null = el.firstElementChild;
        if (!child) break;
        el = child;
        r = el.getBoundingClientRect();
      }
      return r;
    };
    /** What is on the page within a screen of the join, before it and after it, in page order. */
    const neighbours = (before: boolean) => {
      const out: Element[] = [];
      const top = anchor.getBoundingClientRect().top;
      for (
        let el = before ? anchor.previousElementSibling : anchor.nextElementSibling;
        el;
        el = before ? el.previousElementSibling : el.nextElementSibling
      ) {
        const r = boxOf(el);
        // More than a screen from the join is no part of either picture.
        if (r.height > 0 && (before ? top - r.bottom > vh : r.top - top > vh)) break;
        out.push(el);
      }
      return before ? out.reverse() : out;
    };

    // Where the gap is on the page. Read off the layout only now and then
    // and with the pictures (which read it anyway): reading it every frame
    // forced the page's layout early in every frame, on a page heavy enough
    // that this alone cost a slow phone about a frame in six. Between reads
    // it is that place less the scroll.
    let pageTop = 0;
    let measuredAt = -Infinity;
    const measure = (now: number) => {
      pageTop = canvas.getBoundingClientRect().top + window.scrollY;
      measuredAt = now;
    };

    /** Both pictures, from the page as it is now, without its words. */
    const drawPictures = (now: number) => {
      measure(now);
      const top = anchor.getBoundingClientRect().top;
      // The screen of page that ends on the join, as it would stand with the
      // join on the foot of the screen...
      rasterise(above, aboveDiff, neighbours(true), vh - top, dpr, vw, vh, false);
      upload(0, above.canvas);
      upload(1, aboveDiff.canvas);
      // ...and the one that starts on it, with the join at the head.
      rasterise(below, belowDiff, neighbours(false), -top, dpr, vw, vh, false);
      upload(2, below.canvas);
      upload(3, belowDiff.canvas);
    };

    // ── The background, live ──
    // Read every frame on a computer; on a phone no more than 20 times a
    // second, as its scene draws no more than 30 and moves slowly.
    const READ_MS = lite ? 50 : 0;
    let lastRead = -Infinity;
    let sceneReadable = true;
    const readScene = (now: number) => {
      if (now - lastRead < READ_MS) return;
      const scene = sceneReadable
        ? document.querySelector<HTMLCanvasElement>('[data-unicorn-scene="page-background"] canvas')
        : null;
      if (!scene || !scene.width) return;
      lastRead = now;
      try {
        gl.activeTexture(gl.TEXTURE0 + 5);
        gl.bindTexture(gl.TEXTURE_2D, liveTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
      } catch {
        // A canvas that may not be read: the ground colour stands in for good.
        sceneReadable = false;
        return;
      }
      sizeStore(Math.max(2, Math.round(scene.width / 2)), Math.max(2, Math.round(scene.height / 2)));
      // The store pass, into the texture that is not the current one.
      const next = 1 - cur;
      gl.useProgram(storeProg);
      gl.disable(gl.SCISSOR_TEST);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, store[cur]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[next]);
      gl.viewport(0, 0, storeW, storeH);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!haveScene) {
        // One pixel, and only until it is not the ground colour: the scene
        // reads as nothing in a frame it did not draw in, and the store then
        // keeps what it had (see the store pass and UnicornScene's readable).
        const px = new Uint8Array(4);
        gl.readPixels(storeW >> 1, storeH >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        haveScene = !(px[0] === 0x2a && px[1] === 0x0a && px[2] === 0x12);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      cur = next;
      const r = scene.getBoundingClientRect();
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      gl.useProgram(prog);
      gl.uniform4f(uBgRect, r.left / sw, r.top / sh, r.width / sw, r.height / sh);
    };

    // ── The frame ──
    let lastY = window.scrollY;
    let lastT = performance.now();
    let vel = 0;
    let dir = 1;
    let raf = 0;
    let lastDrawn = 0;
    const redrawMs = lite ? REDRAW_MS_LITE : REDRAW_MS;
    const redrawShare = lite ? REDRAW_SHARE_LITE : REDRAW_SHARE;
    let redrawEvery = redrawMs;
    let wasOn = false;
    const t0 = performance.now();

    const show = (on: boolean) => {
      if ((canvas.style.visibility === "visible") !== on) {
        canvas.style.visibility = on ? "visible" : "hidden";
      }
    };

    const frame = () => {
      raf = 0;
      if (gl.isContextLost() || !vh) return;
      const now = performance.now();
      if (now - measuredAt > 600) measure(now);
      const boxTop = pageTop - window.scrollY;
      const box = { top: boxTop, bottom: boxTop + gapPx, height: gapPx };
      const sh = window.innerHeight;
      const p = 1 - (box.top + gapPx / 2) / vh; // 0: the join at the foot of the screen; 1: at its head

      // Asleep while the gap is far from the screen; the scroll wakes it.
      if (box.top > sh + vh * 0.5 || box.bottom < -vh * 0.3) {
        show(false);
        wasOn = false;
        return;
      }

      // Scroll speed, in screens a second: up fast, down slow, so a flick
      // bends hardest at once and the bend settles over half a second.
      const dt = Math.max(1, now - lastT) / 1000;
      const y = window.scrollY;
      const speed = Math.abs(y - lastY) / vh / dt;
      if (y !== lastY) dir = y > lastY ? 1 : -1;
      lastY = y;
      lastT = now;
      const target = Math.min(1, speed / 2.2);
      vel += (target - vel) * (target > vel ? 0.35 : 1 - Math.exp(-dt * 3.2));

      // The band is drawn while any of the gap is on the screen. The
      // background is read from a little before that, so the store already
      // holds it on the band's first frame.
      const on = box.top < sh && box.bottom > 0;
      if (box.top < sh + vh * 0.15) readScene(now);
      if (!on || !haveScene) {
        show(false);
        wasOn = false;
        raf = requestAnimationFrame(frame);
        return;
      }

      // The pictures: on the band's first frame, and every so often after.
      if (!wasOn || now - lastDrawn > redrawEvery) {
        drawPictures(now);
        lastDrawn = now;
        redrawEvery = Math.min(900, Math.max(redrawMs, (performance.now() - now) * redrawShare));
      }
      wasOn = true;

      gl.useProgram(prog);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, store[cur]);
      for (let i = 0; i < 4; i++) {
        gl.activeTexture(gl.TEXTURE1 + i);
        gl.bindTexture(gl.TEXTURE_2D, overlay[i]);
      }
      gl.uniform1f(uTop, box.top * dpr);
      gl.uniform2f(uScr, vw * dpr, sh * dpr);
      gl.uniform1f(uPhase, p);
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.uniform1f(uVel, vel);
      gl.uniform1f(uDir, dir);
      // Only the rows on the screen are shaded: the rest of the canvas is clear.
      gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const k = canvas.height / Math.max(1, box.height);
      const y0 = Math.max(0, Math.floor((box.bottom - sh) * k)); // rows below the screen, counted from the canvas's foot
      const y1 = Math.min(canvas.height, Math.ceil(box.bottom * k));
      if (y1 > y0) {
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(0, y0, canvas.width, y1 - y0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.disable(gl.SCISSOR_TEST);
      }
      show(true);
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (!raf) {
        lastT = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    // Its own size changes only with the page's width or the small viewport
    // (a rotation), never with a phone's bars: that is the only resize.
    const ro = new ResizeObserver(() => {
      size();
      measuredAt = -Infinity;
      wasOn = false;
      wake();
    });
    ro.observe(canvas);
    window.addEventListener("scroll", wake, { passive: true });
    const onLost = (e: Event) => e.preventDefault();
    canvas.addEventListener("webglcontextlost", onLost);
    wake();

    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", wake);
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", onLost);
      releaseCanvasContext(canvas);
    };
  }, [anchorRef, veil]);

  // In the page, the gap's own size and in its place (the anchor is its
  // middle), so it scrolls with the page. Over whatever of the sections
  // hangs into the gap, under the navbar's strip (99), the menu (90) and the
  // corner dock. It takes no clicks: what it shows is the page, where the
  // page is, and the page is what a click is for.
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-marble-canvas
      style={{
        position: "absolute",
        left: 0,
        top: `-${GAP_SVH / 2}svh`,
        width: "100%",
        height: `${GAP_SVH}svh`,
        zIndex: 60,
        visibility: "hidden",
        pointerEvents: "none",
      }}
    />
  );
}
