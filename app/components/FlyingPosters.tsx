"use client";

// FlyingPosters — port of the React Bits component (provided by the client) to
// this project's TypeScript / Next.js setup. The effect is unchanged: a column
// of poster planes scrolls infinitely, each one curling away in a vertex shader
// (a quintic-eased rotation around Y whose phase tracks the poster's position),
// with wheel / drag scrolling. Adapted only for TS types, "use client", inline
// sizing (the original's FlyingPosters.css), and rAF cleanup on unmount.

import { useEffect, useRef, type CSSProperties } from "react";
import { Renderer, Camera, Transform, Plane, Program, Mesh, Texture } from "ogl";

type GL = Renderer["gl"];
interface Size {
  width: number;
  height: number;
}
interface Scroll {
  ease: number;
  current: number;
  target: number;
  last: number;
  position: number;
}

const vertexShader = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec2 uv;
attribute vec3 normal;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

uniform float uPosition;
uniform float uTime;
uniform float uSpeed;
uniform vec3 distortionAxis;
uniform vec3 rotationAxis;
uniform float uDistortion;

varying vec2 vUv;
varying vec3 vNormal;

float PI = 3.141592653589793238;
mat4 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;

    return mat4(
      oc * axis.x * axis.x + c,         oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
      oc * axis.x * axis.y + axis.z * s,oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
      oc * axis.z * axis.x - axis.y * s,oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
      0.0,                              0.0,                                0.0,                                1.0
    );
}

vec3 rotate(vec3 v, vec3 axis, float angle) {
  mat4 m = rotationMatrix(axis, angle);
  return (m * vec4(v, 1.0)).xyz;
}

float qinticInOut(float t) {
  return t < 0.5
    ? 16.0 * pow(t, 5.0)
    : -0.5 * abs(pow(2.0 * t - 2.0, 5.0)) + 1.0;
}

void main() {
  vUv = uv;

  float norm = 0.5;
  vec3 newpos = position;
  float offset = (dot(distortionAxis, position) + norm / 2.) / norm;
  float localprogress = clamp(
    (fract(uPosition * 5.0 * 0.01) - 0.01 * uDistortion * offset) / (1. - 0.01 * uDistortion),
    0.,
    2.
  );
  localprogress = qinticInOut(localprogress) * PI;
  newpos = rotate(newpos, rotationAxis, localprogress);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(newpos, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform vec2 uImageSize;
uniform vec2 uPlaneSize;
uniform sampler2D tMap;

varying vec2 vUv;

void main() {
  vec2 imageSize = uImageSize;
  vec2 planeSize = uPlaneSize;

  float imageAspect = imageSize.x / imageSize.y;
  float planeAspect = planeSize.x / planeSize.y;
  vec2 scale = vec2(1.0, 1.0);

  if (planeAspect > imageAspect) {
      scale.x = imageAspect / planeAspect;
  } else {
      scale.y = planeAspect / imageAspect;
  }

  vec2 uv = vUv * scale + (1.0 - scale) * 0.5;

  gl_FragColor = texture2D(tMap, uv);
}
`;

const lerp = (p1: number, p2: number, t: number) => p1 + (p2 - p1) * t;

const map = (
  num: number,
  min1: number,
  max1: number,
  min2: number,
  max2: number,
  round = false,
) => {
  const num1 = (num - min1) / (max1 - min1);
  const num2 = num1 * (max2 - min2) + min2;
  return round ? Math.round(num2) : num2;
};

class Media {
  gl: GL;
  geometry: Plane;
  scene: Transform;
  screen: Size;
  viewport: Size;
  image: string;
  length: number;
  index: number;
  planeWidth: number;
  planeHeight: number;
  distortion: number;

  extra = 0;
  padding = 0;
  height = 0;
  heightTotal = 0;
  y = 0;
  program!: Program;
  plane!: Mesh;

  constructor(opts: {
    gl: GL;
    geometry: Plane;
    scene: Transform;
    screen: Size;
    viewport: Size;
    image: string;
    length: number;
    index: number;
    planeWidth: number;
    planeHeight: number;
    distortion: number;
  }) {
    this.gl = opts.gl;
    this.geometry = opts.geometry;
    this.scene = opts.scene;
    this.screen = opts.screen;
    this.viewport = opts.viewport;
    this.image = opts.image;
    this.length = opts.length;
    this.index = opts.index;
    this.planeWidth = opts.planeWidth;
    this.planeHeight = opts.planeHeight;
    this.distortion = opts.distortion;

    this.createShader();
    this.createMesh();
    this.onResize();
  }

  createShader() {
    const texture = new Texture(this.gl, { generateMipmaps: false });

    this.program = new Program(this.gl, {
      depthTest: false,
      depthWrite: false,
      fragment: fragmentShader,
      vertex: vertexShader,
      uniforms: {
        tMap: { value: texture },
        uPosition: { value: 0 },
        uPlaneSize: { value: [0, 0] },
        uImageSize: { value: [0, 0] },
        uSpeed: { value: 0 },
        rotationAxis: { value: [0, 1, 0] },
        distortionAxis: { value: [1, 1, 0] },
        uDistortion: { value: this.distortion },
        uViewportSize: { value: [this.viewport.width, this.viewport.height] },
        uTime: { value: 0 },
      },
      cullFace: false,
    });

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = this.image;
    img.onload = () => {
      texture.image = img;
      this.program.uniforms.uImageSize.value = [
        img.naturalWidth,
        img.naturalHeight,
      ];
    };
  }

  createMesh() {
    this.plane = new Mesh(this.gl, {
      geometry: this.geometry,
      program: this.program,
    });
    this.plane.setParent(this.scene);
  }

  setScale() {
    this.plane.scale.x =
      (this.viewport.width * this.planeWidth) / this.screen.width;
    this.plane.scale.y =
      (this.viewport.height * this.planeHeight) / this.screen.height;

    this.plane.position.x = 0;
    this.plane.program.uniforms.uPlaneSize.value = [
      this.plane.scale.x,
      this.plane.scale.y,
    ];
  }

  onResize(opts?: { screen?: Size; viewport?: Size }) {
    if (opts?.screen) this.screen = opts.screen;
    if (opts?.viewport) {
      this.viewport = opts.viewport;
      this.plane.program.uniforms.uViewportSize.value = [
        this.viewport.width,
        this.viewport.height,
      ];
    }
    this.setScale();

    this.padding = 5;
    this.height = this.plane.scale.y + this.padding;
    this.heightTotal = this.height * this.length;

    this.y = -this.heightTotal / 2 + (this.index + 0.5) * this.height;
  }

  update(scroll: Scroll) {
    this.plane.position.y = this.y - scroll.current - this.extra;

    const position = map(
      this.plane.position.y,
      -this.viewport.height,
      this.viewport.height,
      5,
      15,
    );

    this.program.uniforms.uPosition.value = position;
    this.program.uniforms.uTime.value += 0.04;
    this.program.uniforms.uSpeed.value = scroll.current;

    const planeHeight = this.plane.scale.y;
    const viewportHeight = this.viewport.height;

    const topEdge = this.plane.position.y + planeHeight / 2;
    const bottomEdge = this.plane.position.y - planeHeight / 2;

    if (topEdge < -viewportHeight / 2) {
      this.extra -= this.heightTotal;
    } else if (bottomEdge > viewportHeight / 2) {
      this.extra += this.heightTotal;
    }
  }
}

class PostersScene {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  items: string[];
  planeWidth: number;
  planeHeight: number;
  distortion: number;
  cameraFov: number;
  cameraZ: number;
  scroll: Scroll;

  renderer!: Renderer;
  gl!: GL;
  camera!: Camera;
  scene!: Transform;
  planeGeometry!: Plane;
  medias: Media[] = [];
  screen!: Size;
  viewport!: Size;
  isDown = false;
  start = 0;
  raf = 0;

  constructor(opts: {
    container: HTMLElement;
    canvas: HTMLCanvasElement;
    items: string[];
    planeWidth: number;
    planeHeight: number;
    distortion: number;
    scrollEase: number;
    cameraFov: number;
    cameraZ: number;
  }) {
    this.container = opts.container;
    this.canvas = opts.canvas;
    this.items = opts.items;
    this.planeWidth = opts.planeWidth;
    this.planeHeight = opts.planeHeight;
    this.distortion = opts.distortion;
    this.cameraFov = opts.cameraFov;
    this.cameraZ = opts.cameraZ;
    this.scroll = {
      ease: opts.scrollEase,
      current: 0,
      target: 0,
      last: 0,
      position: 0,
    };

    // Bind the handlers used as event listeners / rAF callback.
    this.onResize = this.onResize.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onTouchDown = this.onTouchDown.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchUp = this.onTouchUp.bind(this);
    this.update = this.update.bind(this);

    this.createRenderer();
    this.createCamera();
    this.createScene();
    this.onResize();

    this.createGeometry();
    this.createMedias();
    this.update();
    this.addEventListeners();
  }

  createRenderer() {
    this.renderer = new Renderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio, 2),
    });
    this.gl = this.renderer.gl;
  }

  createCamera() {
    this.camera = new Camera(this.gl);
    this.camera.fov = this.cameraFov;
    this.camera.position.z = this.cameraZ;
  }

  createScene() {
    this.scene = new Transform();
  }

  createGeometry() {
    this.planeGeometry = new Plane(this.gl, {
      heightSegments: 1,
      widthSegments: 100,
    });
  }

  createMedias() {
    this.medias = this.items.map((image, index) => {
      return new Media({
        gl: this.gl,
        geometry: this.planeGeometry,
        scene: this.scene,
        screen: this.screen,
        viewport: this.viewport,
        image,
        length: this.items.length,
        index,
        planeWidth: this.planeWidth,
        planeHeight: this.planeHeight,
        distortion: this.distortion,
      });
    });
  }

  onResize() {
    const rect = this.container.getBoundingClientRect();
    this.screen = { width: rect.width, height: rect.height };

    this.renderer.setSize(this.screen.width, this.screen.height);

    this.camera.perspective({
      aspect: this.gl.canvas.width / this.gl.canvas.height,
    });

    const fov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;

    this.viewport = { height, width };

    if (this.medias) {
      this.medias.forEach((media) =>
        media.onResize({ screen: this.screen, viewport: this.viewport }),
      );
    }
  }

  onTouchDown(e: MouseEvent | TouchEvent) {
    this.isDown = true;
    this.scroll.position = this.scroll.current;
    this.start = "touches" in e ? e.touches[0].clientY : e.clientY;
  }

  onTouchMove(e: MouseEvent | TouchEvent) {
    if (!this.isDown) return;
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    const distance = (this.start - y) * 0.1;
    this.scroll.target = this.scroll.position + distance;
  }

  onTouchUp() {
    this.isDown = false;
  }

  onWheel(e: WheelEvent) {
    const speed = e.deltaY;
    this.scroll.target += speed * 0.005;
  }

  update() {
    this.scroll.current = lerp(
      this.scroll.current,
      this.scroll.target,
      this.scroll.ease,
    );

    if (this.medias) {
      this.medias.forEach((media) => media.update(this.scroll));
    }
    this.renderer.render({ scene: this.scene, camera: this.camera });
    this.scroll.last = this.scroll.current;
    this.raf = requestAnimationFrame(this.update);
  }

  addEventListeners() {
    window.addEventListener("resize", this.onResize);
    window.addEventListener("wheel", this.onWheel);
    window.addEventListener("mousewheel", this.onWheel as EventListener);

    window.addEventListener("mousedown", this.onTouchDown);
    window.addEventListener("mousemove", this.onTouchMove);
    window.addEventListener("mouseup", this.onTouchUp);

    window.addEventListener("touchstart", this.onTouchDown);
    window.addEventListener("touchmove", this.onTouchMove);
    window.addEventListener("touchend", this.onTouchUp);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("mousewheel", this.onWheel as EventListener);

    window.removeEventListener("mousedown", this.onTouchDown);
    window.removeEventListener("mousemove", this.onTouchMove);
    window.removeEventListener("mouseup", this.onTouchUp);

    window.removeEventListener("touchstart", this.onTouchDown);
    window.removeEventListener("touchmove", this.onTouchMove);
    window.removeEventListener("touchend", this.onTouchUp);
    // NB: do NOT call WEBGL_lose_context.loseContext() here. This component
    // reuses the same <canvas> across mounts (React Strict Mode / HMR remount),
    // so losing the context would leave the next mount unable to link its
    // shaders (Program.attributeLocations stays undefined → forEach crash).
  }
}

export interface FlyingPostersProps {
  items?: string[];
  planeWidth?: number;
  planeHeight?: number;
  distortion?: number;
  scrollEase?: number;
  cameraFov?: number;
  cameraZ?: number;
  className?: string;
  style?: CSSProperties;
}

export default function FlyingPosters({
  items = [],
  planeWidth = 320,
  planeHeight = 320,
  distortion = 3,
  scrollEase = 0.01,
  cameraFov = 45,
  cameraZ = 20,
  className,
  style,
}: FlyingPostersProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<PostersScene | null>(null);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    instanceRef.current = new PostersScene({
      container: containerRef.current,
      canvas: canvasRef.current,
      items,
      planeWidth,
      planeHeight,
      distortion,
      scrollEase,
      cameraFov,
      cameraZ,
    });

    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [items, planeWidth, planeHeight, distortion, scrollEase, cameraFov, cameraZ]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      instanceRef.current?.onWheel(e);
    };
    const handleTouchMove = (e: TouchEvent) => e.preventDefault();

    canvasEl.addEventListener("wheel", handleWheel, { passive: false });
    canvasEl.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      canvasEl.removeEventListener("wheel", handleWheel);
      canvasEl.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`posters-container${className ? ` ${className}` : ""}`}
      style={{ position: "relative", width: "100%", height: "100%", ...style }}
    >
      <canvas
        ref={canvasRef}
        className="posters-canvas"
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}
