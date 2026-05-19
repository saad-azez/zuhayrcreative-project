/**
 * Lightweight WebGL2 renderer for fluted glass shader.
 * Handles shader compilation, program linking, uniform management, and rendering.
 */

import { vertexShaderSource } from "./vertex-shader";
import {
  flutedGlassFragmentShader,
  type FlutedGlassUniforms,
} from "./fluted-glass-shader";

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
      `[FlutedGlass] ${typeName} shader compile error:`,
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
  // Adjust precision for low-end devices
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
    console.error(
      "[FlutedGlass] Program link error:",
      gl.getProgramInfoLog(program),
    );
    gl.deleteProgram(program);
    return null;
  }

  gl.detachShader(program, vs);
  gl.detachShader(program, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  return program;
}

export class FlutedGlassRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private backgroundTexture: WebGLTexture | null = null;
  private animationId: number | null = null;
  private canvas: HTMLCanvasElement;
  private uniforms: FlutedGlassUniforms;
  private onRender:
    | ((gl: WebGL2RenderingContext, uniforms: FlutedGlassUniforms) => void)
    | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    uniforms: Partial<FlutedGlassUniforms> = {},
  ) {
    this.canvas = canvas;
    this.uniforms = { ...this.getDefaults(), ...uniforms };
  }

  private getDefaults(): FlutedGlassUniforms {
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

  setOnRender(
    cb: (gl: WebGL2RenderingContext, uniforms: FlutedGlassUniforms) => void,
  ) {
    this.onRender = cb;
  }

  init(): boolean {
    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      console.error("[FlutedGlass] WebGL2 not available on this browser");
      return false;
    }
    this.gl = gl;

    const program = createProgram(
      gl,
      vertexShaderSource,
      flutedGlassFragmentShader,
    );
    if (!program) {
      console.error(
        "[FlutedGlass] Shader program creation failed — check the shader compilation log above for GLSL errors",
      );
      return false;
    }
    this.program = program;

    // Setup VAO with full-screen quad
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    this.vao = vao;

    // Create background texture
    this.backgroundTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return true;
  }

  /** Render a background to the internal texture (gradient, image, etc.) */
  renderBackgroundToTexture(source: TexImageSource) {
    const gl = this.gl;
    if (!gl) return;
    gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.uniforms.u_image = this.backgroundTexture;
  }

  /** Render background gradient from an offscreen canvas */
  renderBackgroundFromCanvas(offscreen: HTMLCanvasElement) {
    const gl = this.gl;
    if (!gl) return;
    gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      offscreen,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
    this.uniforms.u_image = this.backgroundTexture;
  }

  updateUniforms(partial: Partial<FlutedGlassUniforms>) {
    Object.assign(this.uniforms, partial);
  }

  private setUniforms() {
    const gl = this.gl;
    const program = this.program;
    if (!gl || !program) return;

    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth * dpr;
    const h = this.canvas.clientHeight * dpr;
    const aspect = w / Math.max(h, 1);

    // Resolution & sizing
    gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), w, h);
    gl.uniform1f(gl.getUniformLocation(program, "u_pixelRatio"), dpr);
    gl.uniform1f(gl.getUniformLocation(program, "u_imageAspectRatio"), aspect);
    gl.uniform1f(gl.getUniformLocation(program, "u_originX"), 0.5);
    gl.uniform1f(gl.getUniformLocation(program, "u_originY"), 0.5);
    gl.uniform1f(gl.getUniformLocation(program, "u_worldWidth"), w);
    gl.uniform1f(gl.getUniformLocation(program, "u_worldHeight"), h);
    gl.uniform1f(gl.getUniformLocation(program, "u_fit"), 2); // cover
    gl.uniform1f(gl.getUniformLocation(program, "u_scale"), 1);
    gl.uniform1f(gl.getUniformLocation(program, "u_rotation"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "u_offsetX"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "u_offsetY"), 0);

    // Shader uniforms
    const u = this.uniforms;
    gl.uniform4fv(gl.getUniformLocation(program, "u_colorBack"), u.u_colorBack);
    gl.uniform4fv(
      gl.getUniformLocation(program, "u_colorShadow"),
      u.u_colorShadow,
    );
    gl.uniform4fv(
      gl.getUniformLocation(program, "u_colorHighlight"),
      u.u_colorHighlight,
    );
    gl.uniform1f(gl.getUniformLocation(program, "u_shadows"), u.u_shadows);
    gl.uniform1f(gl.getUniformLocation(program, "u_size"), u.u_size);
    gl.uniform1f(gl.getUniformLocation(program, "u_angle"), u.u_angle);
    gl.uniform1f(
      gl.getUniformLocation(program, "u_distortion"),
      u.u_distortion,
    );
    gl.uniform1f(gl.getUniformLocation(program, "u_shift"), u.u_shift);
    gl.uniform1f(gl.getUniformLocation(program, "u_blur"), u.u_blur);
    gl.uniform1f(gl.getUniformLocation(program, "u_edges"), u.u_edges);
    gl.uniform1f(
      gl.getUniformLocation(program, "u_marginLeft"),
      u.u_marginLeft,
    );
    gl.uniform1f(
      gl.getUniformLocation(program, "u_marginRight"),
      u.u_marginRight,
    );
    gl.uniform1f(gl.getUniformLocation(program, "u_marginTop"), u.u_marginTop);
    gl.uniform1f(
      gl.getUniformLocation(program, "u_marginBottom"),
      u.u_marginBottom,
    );
    gl.uniform1f(gl.getUniformLocation(program, "u_stretch"), u.u_stretch);
    gl.uniform1f(
      gl.getUniformLocation(program, "u_distortionShape"),
      u.u_distortionShape,
    );
    gl.uniform1f(
      gl.getUniformLocation(program, "u_highlights"),
      u.u_highlights,
    );
    gl.uniform1f(gl.getUniformLocation(program, "u_shape"), u.u_shape);
    gl.uniform1f(
      gl.getUniformLocation(program, "u_grainMixer"),
      u.u_grainMixer,
    );
    gl.uniform1f(
      gl.getUniformLocation(program, "u_grainOverlay"),
      u.u_grainOverlay,
    );

    // Bind image texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
    gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);
  }

  render() {
    const gl = this.gl;
    if (!gl || !this.program || !this.vao) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = this.canvas.clientWidth;
    const displayH = this.canvas.clientHeight;
    const w = Math.floor(displayW * dpr);
    const h = Math.floor(displayH * dpr);

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    gl.viewport(0, 0, w, h);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Allow external background rendering
    if (this.onRender) {
      this.onRender(gl, this.uniforms);
    }

    this.setUniforms();
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

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

  dispose() {
    this.stopLoop();
    const gl = this.gl;
    if (gl) {
      if (this.program) gl.deleteProgram(this.program);
      if (this.backgroundTexture) gl.deleteTexture(this.backgroundTexture);
      if (this.vao) gl.deleteVertexArray(this.vao);
    }
    this.gl = null;
    this.program = null;
    this.vao = null;
    this.backgroundTexture = null;
  }
}

/**
 * Draw a gradient background to an offscreen canvas.
 * This canvas is then fed as u_image to the fluted glass shader,
 * creating the "refractive glass" effect.
 */
export function drawBackgroundGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: string[],
) {
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  colors.forEach((color, i) => {
    gradient.addColorStop(i / Math.max(colors.length - 1, 1), color);
  });
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Add subtle noise for realism
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 4;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);
}
