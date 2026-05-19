/**
 * Lightweight WebGL2 renderer for fluted glass shader.
 * Uses a two-pass Framebuffer Object (FBO) pipeline for true refractive glass:
 *   Pass 1 — render background into FBO texture
 *   Pass 2 — fluted glass shader samples FBO texture, applies distortion
 *
 * Supports: colors, gradients, images, videos, canvas, custom WebGL scenes.
 */

import { vertexShaderSource } from "./vertex-shader";
import {
  flutedGlassFragmentShader,
  type FlutedGlassUniforms,
} from "./fluted-glass-shader";

// ── Shader helpers ──

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const typeName = type === gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT";
    console.error(
      `[FlutedGlass] ${typeName} compile error:`,
      gl.getShaderInfoLog(shader),
    );
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram | null {
  const format = gl.getShaderPrecisionFormat(
    gl.FRAGMENT_SHADER,
    gl.MEDIUM_FLOAT,
  );
  const precision = format ? format.precision : null;
  if (precision && precision < 23) {
    vertSrc = vertSrc.replace(
      /precision\s+(lowp|mediump)\s+float;/g,
      "precision highp float;",
    );
    fragSrc = fragSrc.replace(
      /precision\s+(lowp|mediump)\s+float/g,
      "precision highp float",
    );
  }
  const vs = createShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("[FlutedGlass] Link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  gl.detachShader(program, vs);
  gl.detachShader(program, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

// ── Background fill shader (solid color → FBO) ──

const bgFragmentShader = `#version 300 es
precision mediump float;
uniform vec4 u_bgColor;
out vec4 fragColor;
void main() {
  fragColor = u_bgColor;
}
`;

// ── Texture-blit shader (image/video/canvas → FBO) ──

const texBlitFragmentShader = `#version 300 es
precision mediump float;
uniform sampler2D u_source;
in vec2 v_imageUV;
out vec4 fragColor;
void main() {
  fragColor = texture(u_source, v_imageUV);
}
`;

// ── Types ──

export type BackgroundSource =
  | { type: "color"; color: [number, number, number, number] }
  | { type: "image"; image: TexImageSource }
  | { type: "video"; video: HTMLVideoElement }
  | { type: "canvas"; canvas: HTMLCanvasElement };

export type BackgroundRenderer = (
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
) => void;

// ── Renderer ──

export class FlutedGlassRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private glassProgram: WebGLProgram | null = null;
  private bgProgram: WebGLProgram | null = null;
  private texBlitProgram: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;

  // FBO: "behind-glass" content rendered here first
  private fbo: WebGLFramebuffer | null = null;
  private fboTexture: WebGLTexture | null = null;
  private sourceTexture: WebGLTexture | null = null;

  private animationId: number | null = null;
  private canvas: HTMLCanvasElement;
  private uniforms: FlutedGlassUniforms;
  private backgroundSource: BackgroundSource | null = null;
  private customBackgroundRenderer: BackgroundRenderer | null = null;
  private fboW = 0;
  private fboH = 0;
  private sourceW = 0;
  private sourceH = 0;

  constructor(
    canvas: HTMLCanvasElement,
    uniforms: Partial<FlutedGlassUniforms> = {},
  ) {
    this.canvas = canvas;
    this.uniforms = { ...defaults(), ...uniforms };
  }

  // ── Public API ──

  setBackgroundRenderer(renderer: BackgroundRenderer | null) {
    this.customBackgroundRenderer = renderer;
  }

  setBackgroundSource(source: BackgroundSource | null) {
    this.backgroundSource = source;
  }

  updateUniforms(partial: Partial<FlutedGlassUniforms>) {
    Object.assign(this.uniforms, partial);
  }

  // ── Init / Dispose ──

  init(): boolean {
    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      console.error("[FlutedGlass] WebGL2 not available");
      return false;
    }
    this.gl = gl;

    this.glassProgram = createProgram(
      gl,
      vertexShaderSource,
      flutedGlassFragmentShader,
    );
    if (!this.glassProgram) return false;

    this.bgProgram = createProgram(gl, vertexShaderSource, bgFragmentShader);
    if (!this.bgProgram) return false;

    this.texBlitProgram = createProgram(
      gl,
      vertexShaderSource,
      texBlitFragmentShader,
    );
    if (!this.texBlitProgram) return false;

    // VAO + full-screen quad
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    this.vao = vao;

    // FBO
    this.fbo = gl.createFramebuffer();
    this.fboTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.fboTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.uniforms.u_image = this.fboTexture;
    return true;
  }

  dispose() {
    this.stopLoop();
    const gl = this.gl;
    if (gl) {
      if (this.glassProgram) gl.deleteProgram(this.glassProgram);
      if (this.bgProgram) gl.deleteProgram(this.bgProgram);
      if (this.texBlitProgram) gl.deleteProgram(this.texBlitProgram);
      if (this.fbo) gl.deleteFramebuffer(this.fbo);
      if (this.fboTexture) gl.deleteTexture(this.fboTexture);
      if (this.sourceTexture) gl.deleteTexture(this.sourceTexture);
      if (this.vao) gl.deleteVertexArray(this.vao);
    }
    this.gl = null;
    this.glassProgram = null;
    this.bgProgram = null;
    this.texBlitProgram = null;
    this.fbo = null;
    this.fboTexture = null;
    this.sourceTexture = null;
    this.vao = null;
  }

  // ── Render Loop ──

  startLoop() {
    const loop = () => {
      this.render();
      this.animationId = requestAnimationFrame(loop);
    };
    loop();
  }

  stopLoop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  render() {
    const gl = this.gl;
    if (!gl || !this.glassProgram || !this.vao || !this.fbo) return;

    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    // ── Pass 1: Render background → FBO ──
    this.renderBgToFBO(w, h);

    // ── Pass 2: Fluted glass ← samples FBO ──
    this.renderGlass(w, h);
  }

  // ── Private: Pass 1 (background → FBO) ──

  private renderBgToFBO(w: number, h: number) {
    const gl = this.gl!;
    this.ensureFBO(w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, w, h);

    // Custom WebGL renderer
    if (this.customBackgroundRenderer) {
      this.customBackgroundRenderer(gl, w, h);
      return;
    }

    const src = this.backgroundSource;

    if (!src || src.type === "color") {
      // Solid color
      const c = src?.type === "color" ? src.color : [0.04, 0.04, 0.06, 1];
      gl.useProgram(this.bgProgram);
      this.bindPosition(this.bgProgram!);
      gl.uniform4fv(gl.getUniformLocation(this.bgProgram!, "u_bgColor"), c);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return;
    }

    // Image / video / canvas → blit to FBO
    this.ensureSourceTexture(gl, src);
    if (!this.sourceTexture) return;

    gl.useProgram(this.texBlitProgram);
    this.bindPosition(this.texBlitProgram!);
    this.setupSizing(gl, this.texBlitProgram!, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.uniform1i(gl.getUniformLocation(this.texBlitProgram!, "u_source"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ── Private: Pass 2 (glass ← FBO) ──

  private renderGlass(w: number, h: number) {
    const gl = this.gl!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.glassProgram);
    this.bindPosition(this.glassProgram!);
    this.setupSizing(gl, this.glassProgram!, w, h);

    const u = this.uniforms;
    const L = (n: string) => gl.getUniformLocation(this.glassProgram!, n);
    gl.uniform4fv(L("u_colorBack"), u.u_colorBack);
    gl.uniform4fv(L("u_colorShadow"), u.u_colorShadow);
    gl.uniform4fv(L("u_colorHighlight"), u.u_colorHighlight);
    gl.uniform1f(L("u_shadows"), u.u_shadows);
    gl.uniform1f(L("u_size"), u.u_size);
    gl.uniform1f(L("u_angle"), u.u_angle);
    gl.uniform1f(L("u_distortion"), u.u_distortion);
    gl.uniform1f(L("u_shift"), u.u_shift);
    gl.uniform1f(L("u_blur"), u.u_blur);
    gl.uniform1f(L("u_edges"), u.u_edges);
    gl.uniform1f(L("u_marginLeft"), u.u_marginLeft);
    gl.uniform1f(L("u_marginRight"), u.u_marginRight);
    gl.uniform1f(L("u_marginTop"), u.u_marginTop);
    gl.uniform1f(L("u_marginBottom"), u.u_marginBottom);
    gl.uniform1f(L("u_stretch"), u.u_stretch);
    gl.uniform1f(L("u_distortionShape"), u.u_distortionShape);
    gl.uniform1f(L("u_highlights"), u.u_highlights);
    gl.uniform1f(L("u_shape"), u.u_shape);
    gl.uniform1f(L("u_grainMixer"), u.u_grainMixer);
    gl.uniform1f(L("u_grainOverlay"), u.u_grainOverlay);

    // Bind FBO texture → shader sees what's "behind" the glass
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTexture);
    gl.uniform1i(L("u_image"), 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ── Helpers ──

  private ensureFBO(w: number, h: number) {
    const gl = this.gl!;
    if (this.fboW === w && this.fboH === h) return;
    this.fboW = w;
    this.fboH = h;
    gl.bindTexture(gl.TEXTURE_2D, this.fboTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      w,
      h,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.fboTexture,
      0,
    );
  }

  private ensureSourceTexture(
    gl: WebGL2RenderingContext,
    src: BackgroundSource,
  ) {
    if (src.type === "color") return;
    const img =
      src.type === "image"
        ? src.image
        : src.type === "canvas"
          ? src.canvas
          : src.video;
    const iw =
      "videoWidth" in img
        ? (img as HTMLVideoElement).videoWidth
        : (img as HTMLImageElement).naturalWidth;
    const ih =
      "videoHeight" in img
        ? (img as HTMLVideoElement).videoHeight
        : (img as HTMLImageElement).naturalHeight;

    if (!this.sourceTexture) {
      this.sourceTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    if (this.sourceW !== iw || this.sourceH !== ih) {
      this.sourceW = iw;
      this.sourceH = ih;
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        img as TexImageSource,
      );
    }
  }

  private bindPosition(program: WebGLProgram) {
    const gl = this.gl!;
    gl.bindVertexArray(this.vao);
    const loc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  private setupSizing(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    w: number,
    h: number,
  ) {
    const dpr = window.devicePixelRatio || 1;
    const aspect = w / Math.max(h, 1);
    const L = (n: string) => gl.getUniformLocation(program, n);
    gl.uniform2f(L("u_resolution"), w, h);
    gl.uniform1f(L("u_pixelRatio"), dpr);
    gl.uniform1f(L("u_imageAspectRatio"), aspect);
    gl.uniform1f(L("u_originX"), 0.5);
    gl.uniform1f(L("u_originY"), 0.5);
    gl.uniform1f(L("u_worldWidth"), w);
    gl.uniform1f(L("u_worldHeight"), h);
    gl.uniform1f(L("u_fit"), 2);
    gl.uniform1f(L("u_scale"), 1);
    gl.uniform1f(L("u_rotation"), 0);
    gl.uniform1f(L("u_offsetX"), 0);
    gl.uniform1f(L("u_offsetY"), 0);
  }
}

function defaults(): FlutedGlassUniforms {
  return {
    u_image: null,
    u_colorBack: [0, 0, 0, 0],
    u_colorShadow: [0, 0, 0, 1],
    u_colorHighlight: [1, 1, 1, 1],
    u_shadows: 0.11,
    u_size: 0.83,
    u_angle: 0,
    u_distortion: 0.61,
    u_shift: 0,
    u_blur: 0,
    u_edges: 0,
    u_marginLeft: 0,
    u_marginRight: 0,
    u_marginTop: 0,
    u_marginBottom: 0,
    u_stretch: 0,
    u_distortionShape: 5,
    u_highlights: 0,
    u_shape: 1,
    u_grainMixer: 0,
    u_grainOverlay: 0,
  };
}

// ── Utility: draw gradient to 2D canvas ──

export function drawBackgroundGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: string[],
) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  colors.forEach((c, i) =>
    g.addColorStop(i / Math.max(colors.length - 1, 1), c),
  );
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 4;
    data[i] = Math.min(255, Math.max(0, data[i] + n));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
  }
  ctx.putImageData(new ImageData(data, w, h), 0, 0);
}
