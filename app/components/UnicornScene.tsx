"use client";

import { useEffect, useRef, useState } from "react";
import { preconnect, preload } from "react-dom";
import {
  UNICORN_ASSETS_ORIGIN,
  UNICORN_SDK_INTEGRITY,
  UNICORN_SDK_URL,
} from "@/app/lib/unicorn";
import { releaseCanvasContext } from "@/app/lib/webglContexts";
import { hasGPU } from "@/app/lib/gpu";

/**
 * Unicorn Studio scene host — the site's own, replacing `unicornstudio-react`.
 *
 * ── Why not the package ──
 * The package inlines a complete copy of the SDK as a string, so it can run
 * without a CDN. Every scene here passes `sdkUrl` and loads the SDK from the
 * CDN instead, so that string was a megabyte of JavaScript (a quarter of it
 * after gzip) downloaded and parsed on every route and never executed — the
 * single largest thing the landing page shipped, and after the scene split it
 * was being bundled twice. The package also probed WebGL support with a
 * throwaway context per scene, four abandoned contexts at boot on a page
 * that is already short of them (see webglContexts.ts).
 *
 * ── What this keeps ──
 * The same calls, in the same order, with the same config keys, so the SDK
 * sees no difference: one <script> per URL, deduplicated and shared by every
 * scene through a module-level promise; `UnicornStudio.addScene` with
 * elementId / projectId / scale / dpi / fps / lazyLoad / altText / ariaLabel /
 * production; `scene.paused` toggled from the prop; `scene.resize()` from a
 * ResizeObserver; `scene.destroy()` on unmount or when a render parameter
 * changes. Same defaults (production on, dpi 1.5, fps 60, "Scene" alt).
 *
 * ── What this drops ──
 * The placeholder image (unused here — every scene paints its own base
 * gradient) and the package's red "Error loading scene" box, which on a
 * blocked CDN would have put a pink error card over the hero. A scene that
 * fails now leaves its base showing and reports through `onError`.
 */

/** The SDK only accepts these. */
export type UnicornFps = 15 | 24 | 30 | 60 | 120;

export interface UnicornSceneProps {
  /** Unicorn Studio project id. */
  projectId: string;
  /** Where to fetch the SDK from. See app/lib/unicorn.ts — one URL, always. */
  sdkUrl: string;
  /**
   * The images this scene paints with, so they can be preloaded from the
   * document head. Without this they are only requested once the SDK has
   * downloaded, run, and fetched the scene — after the whole app has
   * hydrated — and a scene the loader waits on cannot be shown until they
   * arrive. Copy the URLs from the network panel (assets.unicorn.studio) and
   * update them when the scene is re-exported; in development the host warns
   * when the scene asks for an image that is not in this list.
   */
  preloadImages?: readonly string[];
  width?: number | string;
  height?: number | string;
  /** Internal render buffer size, 0.25–1. */
  scale?: number;
  /** Device pixel ratio the scene renders at. */
  dpi?: number;
  fps?: UnicornFps;
  /** Let the SDK defer initialisation until the element is in view. */
  lazyLoad?: boolean;
  /**
   * With lazyLoad: start the SDK's set-up the moment the scene is created
   * rather than when it reaches the screen. For a scene mounted on approach
   * (useSceneLease), so it is drawn by the time it scrolls in: on the
   * client's iPhone the footer's set-up (shaders, planes) took seconds and
   * the footer sat empty that long after it came on screen (24 Nov).
   */
  warmAhead?: boolean;
  production?: boolean;
  /** Freeze the render loop (the SDK keeps the last frame). */
  paused?: boolean;
  /**
   * Keep the scene's picture in its canvas between frames, so something else
   * can read it at any moment (see keepPictureIn). The page's background is
   * read by the marble seams; nothing else needs it.
   */
  readable?: boolean;
  altText?: string;
  ariaLabel?: string;
  className?: string;
  /**
   * The scene has initialised AND its image layers have arrived. Not the
   * SDK's own resolve, which comes before the images: between the two the
   * SDK re-uploads each loaded layer to the GPU on every frame while it waits
   * for the rest (a 2000x2000 layer is 30ms a frame), so a curtain lifted on
   * the resolve lands in that stall. See assetsLoaded.
   */
  onLoad?: () => void;
  /** The SDK failed to load, or the scene failed to initialise. */
  onError?: (error: Error) => void;
}

interface UnicornStudioScene {
  destroy: () => void;
  resize?: () => void;
  paused?: boolean;
  // The SDK's own fields, read and written by holdScene (v2.2.6).
  isInView?: boolean;
  rendering?: boolean;
  pauseTime?: number;
  element?: HTMLElement;
  getDynamicLayers?: () => unknown[];
  initialized?: boolean;
  initializing?: boolean;
  initializePlanes?: () => void;
  /** The SDK's per-image preload table, filled in before addScene resolves. */
  local?: { preloadedImages?: Record<string, { loading?: boolean }> };
}

interface UnicornStudioGlobal {
  addScene: (config: Record<string, unknown>) => Promise<UnicornStudioScene>;
}

declare global {
  interface Window {
    UnicornStudio?: UnicornStudioGlobal;
  }
}

/** Past this the scene is treated as never arriving. Same as the package. */
const INIT_TIMEOUT_MS = 15_000;
/** Past this the images are treated as arrived, whatever the table says. */
const ASSETS_TIMEOUT_MS = 8_000;

/**
 * A paused scene off the SDK's frame loop altogether.
 *
 * `scene.paused` only skips drawing. The SDK runs ONE requestAnimationFrame
 * loop for every scene and keeps it going while any scene is "in view",
 * paused or not, and that loop reads window.scrollY every ~64 ms, which
 * forces a layout. On the client's iPhone 12 (23 Nov) the page sat at
 * 66-90% CPU in the services section, every background hidden behind a
 * scene, with Unicorn's loop laying the page out over and over.
 *
 * Every pass of the SDK (its loop, its scroll measuring, its in-view test)
 * starts from scene.getDynamicLayers(), and skips a scene that has none. So a
 * held scene reports none, and takes the SDK's own "left the view" step
 * (isInView false, clock noted): with no scene in view the loop cancels
 * itself. Let go, it takes the SDK's own "came back" step and the loop is
 * restarted the way the SDK restarts it: a scroll event with no scene
 * rendering. The scene carries on from its last frame.
 *
 * Written against unicornStudio.js v2.2.6 (lib/unicorn.ts pins it, with SRI);
 * re-check these fields when that version changes.
 */
const liveScenes = new Set<UnicornStudioScene>();
const ownLayers = new WeakMap<UnicornStudioScene, () => unknown[]>();
function holdScene(scene: UnicornStudioScene, held: boolean) {
  if (typeof scene.getDynamicLayers !== "function") return;
  // Never before its set-up is done: held, the SDK could not set a lazily
  // loaded scene up until it was almost on screen (UnicornScene polls and
  // holds it once it is ready).
  if (held && !scene.initialized) return;
  const isHeld = ownLayers.has(scene);
  if (held === isHeld) return;
  const now = performance.now();
  if (held) {
    ownLayers.set(scene, scene.getDynamicLayers);
    scene.getDynamicLayers = () => [];
    if (scene.isInView) {
      scene.isInView = false;
      scene.pauseTime = now;
    }
    scene.rendering = false;
    return;
  }
  const own = ownLayers.get(scene);
  ownLayers.delete(scene);
  if (own) scene.getDynamicLayers = own;
  const r = scene.element?.getBoundingClientRect();
  const onScreen = !!r && r.bottom >= -100 && r.top <= window.innerHeight + 100 && r.right >= -100 && r.left <= window.innerWidth + 100;
  if (onScreen && !scene.isInView) {
    scene.isInView = true;
    scene.pauseTime = (scene.pauseTime ?? now) - now;
  }
  liveScenes.forEach((s) => (s.rendering = false));
  window.dispatchEvent(new Event("scroll"));
}


const scriptPromises = new Map<string, Promise<void>>();

function sdkReady(): boolean {
  return typeof window.UnicornStudio?.addScene === "function";
}

/**
 * Load the SDK once per URL. A <script> already in the document (a previous
 * scene's, or one the page put there) is reused rather than duplicated; the
 * promise is shared so a burst of scenes mounting together waits on one
 * fetch. Matches the layout's `<link rel="preload" as="script">`: same URL,
 * no crossorigin, so the browser serves this tag from that preload.
 */
function loadSdk(url: string): Promise<void> {
  if (sdkReady()) return Promise.resolve();
  const pending = scriptPromises.get(url);
  if (pending) return pending;

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${url}"]`,
    );
    if (existing?.dataset.loaded === "true") {
      if (sdkReady()) resolve();
      else reject(new Error("UnicornStudio global not found after script load"));
      return;
    }
    const script = existing ?? document.createElement("script");
    const done = () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
    const onLoad = () => {
      done();
      script.dataset.loaded = "true";
      if (sdkReady()) resolve();
      else reject(new Error("UnicornStudio global not found after script load"));
    };
    const onError = () => {
      done();
      reject(new Error("Failed to load UnicornStudio script"));
    };
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    if (!existing) {
      // Pin the SDK to its known hash (see UNICORN_SDK_INTEGRITY). crossOrigin
      // is required for the browser to check it, and matches the head preload.
      if (url === UNICORN_SDK_URL) {
        script.integrity = UNICORN_SDK_INTEGRITY;
        script.crossOrigin = "anonymous";
      }
      script.src = url;
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((err: unknown) => {
    scriptPromises.delete(url);
    throw err;
  });
  scriptPromises.set(url, promise);
  return promise;
}

/**
 * Resolves once every image the scene preloads has finished loading — the
 * point at which the SDK flattens its static layers and stops re-uploading
 * them each frame. Read from the scene's own preload table rather than
 * guessed from frame timing: a quiet 400ms sits between the SDK resolving
 * and the first image arriving, and a frame-timing heuristic reads that
 * quiet as "settled". Polled, because the table has no events; bounded, in
 * case a build of the SDK stops keeping it.
 */
function assetsLoaded(scene: UnicornStudioScene): Promise<void> {
  const table = () => scene.local?.preloadedImages;
  const pending = () =>
    Object.values(table() ?? {}).some((entry) => entry?.loading === true);
  if (!table() || !pending()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const started = performance.now();
    const check = () => {
      if (!pending() || performance.now() - started > ASSETS_TIMEOUT_MS) {
        resolve();
        return;
      }
      window.setTimeout(check, 50);
    };
    window.setTimeout(check, 50);
  });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(
      () => reject(new Error("Scene initialization timeout")),
      ms,
    );
  });
  return Promise.race([p, timeout]).finally(() => window.clearTimeout(timer));
}

let uid = 0;

/**
 * The SDK makes its WebGL context with `preserveDrawingBuffer: false` and no
 * way to ask otherwise. Such a canvas only has a picture in it during the
 * frame it drew in: read at any other moment it is empty, and whether a
 * reader's moment falls before or after the scene's own draw depends on the
 * order the two were started in. The marble seams read the page's background
 * that way, and about one visit in fifty the order went against them and the
 * band stood black (client, 15 Oct: "it just randomly sometimes becomes black
 * on both desktop and mobile").
 *
 * So for a host that asks, the context is made keeping its picture. The SDK
 * puts its canvas in the host before it asks for the context, which is what
 * this goes by: only a canvas inside a registered host is touched.
 */
const readableHosts = new Set<HTMLElement>();
let getContextWrapped = false;
function keepPictureIn(host: HTMLElement): () => void {
  if (!getContextWrapped) {
    getContextWrapped = true;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      attributes?: Record<string, unknown>,
    ) {
      if ((type === "webgl" || type === "webgl2") && readableHosts.size) {
        for (const h of readableHosts) {
          if (h.contains(this)) {
            attributes = { ...attributes, preserveDrawingBuffer: true };
            break;
          }
        }
      }
      return original.call(this, type, attributes);
    } as typeof original;
  }
  readableHosts.add(host);
  return () => readableHosts.delete(host);
}

export default function UnicornScene({
  projectId,
  sdkUrl,
  width = "100%",
  height = "100%",
  scale = 1,
  dpi = 1.5,
  fps = 60,
  lazyLoad = true,
  warmAhead = false,
  production = true,
  paused = false,
  readable = false,
  altText = "Scene",
  ariaLabel,
  className = "",
  onLoad,
  onError,
  preloadImages,
}: UnicornSceneProps) {
  // Resource hints, emitted into <head> during server rendering (React
  // deduplicates them across scenes). The SDK is what every scene waits on
  // and the react wrapper only asked for it after hydration — many seconds
  // in on a slow phone; preloaded, it lands with the app's own code. Same URL
  // and no crossorigin on either side, or the browser fetches it twice. The
  // images are fetched by the SDK with crossOrigin="anonymous", so the hint
  // has to say so too; low priority keeps them behind the code and fonts.
  // Client only. Emitted while server rendering, these went into the HTML of
  // every visitor - including the ones lib/gpu.ts then refuses to start a
  // scene for, who were told to fetch a megabyte for scenes that never ran.
  // This component only renders on a machine with a GPU, so asking from here
  // asks exactly where it is wanted; the hero's are sent earlier still, from
  // the document head (lib/gpuProbe.ts).
  // hasGPU(), not just "are we on the client": this component still renders
  // once during hydration on a machine without one, because the markup React
  // is hydrating came from a server that could not know. That one render is
  // enough to ask for a megabyte.
  if (typeof window !== "undefined" && hasGPU()) {
    preload(sdkUrl, { as: "script" });
    preconnect(UNICORN_ASSETS_ORIGIN, { crossOrigin: "anonymous" });
    for (const href of preloadImages ?? []) {
      preload(href, { as: "image", crossOrigin: "anonymous", fetchPriority: "low" });
    }
  }

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<UnicornStudioScene | null>(null);
  // The callbacks are read through refs so a new closure from the parent does
  // not tear the scene down and rebuild it.
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onLoadRef.current = onLoad;
    onErrorRef.current = onError;
  });
  // Remembered for a scene that is still initialising, so it does not start
  // with a frame it was told not to draw.
  const pausedRef = useRef(paused);
  const preloadImagesRef = useRef(preloadImages);
  useEffect(() => {
    preloadImagesRef.current = preloadImages;
  });
  const [sdkLoaded, setSdkLoaded] = useState(
    () => typeof window !== "undefined" && sdkReady(),
  );

  // ── The SDK ──
  useEffect(() => {
    let ignore = false;
    // The scene will not run here (lib/gpu.ts), and this effect can still fire
    // from the single render React does while hydrating markup the server
    // wrote. Fetching the SDK for a scene that is about to unmount is 47KB
    // and a parse on a machine that has already been judged too slow for it.
    if (!hasGPU()) return;
    if (sdkReady()) {
      const t = requestAnimationFrame(() => setSdkLoaded(true));
      return () => cancelAnimationFrame(t);
    }
    loadSdk(sdkUrl).then(
      () => {
        if (!ignore) setSdkLoaded(true);
      },
      (err: unknown) => {
        if (ignore) return;
        onErrorRef.current?.(
          err instanceof Error
            ? err
            : new Error("Failed to load UnicornStudio script"),
        );
      },
    );
    return () => {
      ignore = true;
    };
  }, [sdkUrl]);

  // ── The scene ──
  // Rebuilt whenever a render parameter changes, exactly as the package did:
  // the SDK has no way to change a live scene's dpi or fps.
  useEffect(() => {
    const host = hostRef.current;
    if (!sdkLoaded || !host) return;
    let ignore = false;
    const unkeep = readable ? keepPictureIn(host) : null;

    const destroy = () => {
      // The SDK's destroy stops the scene but leaves its context to the
      // garbage collector; hand it back once the canvas has left the page
      // (a scene released for memory — useSceneLease — must really free it).
      const canvases = [...host.querySelectorAll("canvas")];
      if (sceneRef.current) {
        holdScene(sceneRef.current, false);
        liveScenes.delete(sceneRef.current);
      }
      sceneRef.current?.destroy();
      sceneRef.current = null;
      canvases.forEach(releaseCanvasContext);
    };

    (async () => {
      try {
        const studio = window.UnicornStudio;
        if (!studio?.addScene) throw new Error("UnicornStudio.addScene not found");
        if (!host.id) host.id = `unicorn-${(uid += 1).toString(36)}`;
        const scene = await withTimeout(
          studio.addScene({
            elementId: host.id,
            projectId,
            scale,
            dpi,
            fps,
            lazyLoad,
            altText,
            ariaLabel: ariaLabel || altText,
            production,
          }),
          INIT_TIMEOUT_MS,
        );
        if (ignore) {
          scene?.destroy();
          return;
        }
        if (!scene) throw new Error("Failed to initialize scene");
        sceneRef.current = scene;
        scene.paused = pausedRef.current;
        liveScenes.add(scene);
        if (warmAhead && !scene.initialized && !scene.initializing) {
          try {
            scene.initializePlanes?.();
          } catch {
            /* the SDK sets it up itself when it is in view */
          }
        }
        holdScene(scene, pausedRef.current);
        // Paused before its set-up finished: held as soon as it is ready.
        if (!scene.initialized) {
          const wait = window.setInterval(() => {
            if (ignore || sceneRef.current !== scene) return window.clearInterval(wait);
            if (!scene.initialized) return;
            window.clearInterval(wait);
            holdScene(scene, pausedRef.current);
          }, 300);
        }
        if (process.env.NODE_ENV !== "production") {
          const declared = new Set(preloadImagesRef.current ?? []);
          const asked = Object.keys(scene.local?.preloadedImages ?? {});
          const missing = asked.filter((u) => !declared.has(u));
          const stale = [...declared].filter((u) => !asked.includes(u));
          if (missing.length || stale.length) {
          }
        }
        await assetsLoaded(scene);
        if (ignore) return;
        onLoadRef.current?.();
      } catch (err: unknown) {
        if (ignore) return;
        onErrorRef.current?.(
          err instanceof Error ? err : new Error("Unknown error"),
        );
      }
    })();

    return () => {
      ignore = true;
      destroy();
      unkeep?.();
    };
  }, [sdkLoaded, projectId, scale, dpi, fps, lazyLoad, warmAhead, altText, ariaLabel, production, readable]);

  // ── Pause ──
  useEffect(() => {
    pausedRef.current = paused;
    if (sceneRef.current) {
      sceneRef.current.paused = paused;
      holdScene(sceneRef.current, paused);
    }
  }, [paused]);

  // ── Resize ──
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => sceneRef.current?.resize?.());
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        position: "relative",
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  );
}
