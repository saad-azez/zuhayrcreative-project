/**
 * Is this browser drawing WebGL on a real GPU?
 *
 * With no usable GPU Chrome falls back to a software rasteriser
 * (SwiftShader) - headless runners, PageSpeed Insights, locked-down
 * machines. Every scene then rasterises on the main thread at whole seconds
 * a frame: the page never goes quiet, and the tab is eventually killed.
 * Measured on the live site (20 Sep): 153s of main-thread work and a
 * 72.5s blocking time without a GPU, against 3.4s and 4.0s with one.
 *
 * Those visitors are better served the still page, so the heavy scenes ask
 * here before they start.
 */

/** Renderer names that mean "the CPU is drawing this". */
const SOFTWARE = /swiftshader|llvmpipe|software|basic render|mesa offscreen|subzero/i;

let answer: boolean | null = null;

export function hasGPU(): boolean {
  if (answer !== null) return answer;
  if (typeof window === "undefined") return true; // decided on the client
  answer = probe();
  return answer;
}

/**
 * Puts `no-gpu` on <html> when the CPU is drawing, so stylesheets can show a
 * still stand-in where a scene's own markup cannot. Called once from
 * WebglBudget, the earliest client module; a no-op on the server.
 */
export function markGpuOnHtml() {
  if (typeof document === "undefined") return;
  if (!hasGPU()) document.documentElement.classList.add("no-gpu");
}

function probe(): boolean {
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    gl =
      (c.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) as WebGL2RenderingContext | null) ??
      (c.getContext("webgl", { failIfMajorPerformanceCaveat: true }) as WebGLRenderingContext | null);
    // No context at all, or only one the driver flagged as slow: no GPU.
    if (!gl) return false;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "") : "";
    // Without the extension the name is hidden; trust the caveat check above.
    if (name && SOFTWARE.test(name)) return false;
    return true;
  } catch {
    return false;
  } finally {
    // The probe holds a context; contexts are scarce, so hand it straight back.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
