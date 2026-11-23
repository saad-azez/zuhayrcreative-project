/**
 * Phone / tablet detection for MEMORY and PACING decisions — never for
 * layout (the client rejects phone-specific compositions; see the mobile
 * parity note in the project memory).
 *
 * The user agent, not a media query. Phones misreport (hover: hover) and
 * even (pointer: fine) in "desktop site" mode and with a stylus, and what
 * these callers care about is the class of hardware — an iOS/Android GPU
 * with a per-tab memory ceiling the OS enforces by killing the tab — not
 * the input device. iPadOS reports itself as a Mac; its touch points give
 * it away.
 */
export function isPhoneDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /Android|iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

/**
 * Puts `is-phone` on <html> so stylesheets can give a phone a cheaper
 * version of an effect (the corner dock's frost, for one). Called once
 * from the earliest client module (WebglBudget); a no-op on the server.
 */
export function markPhoneOnHtml() {
  if (typeof document === "undefined") return;
  if (isPhoneDevice()) document.documentElement.classList.add("is-phone");
}

/**
 * The device-pixel-ratio ceiling for a full-screen WebGL canvas. Phones
 * render at 1x: at DPR 3 that is a ninth of the native pixels, which is
 * what keeps several scenes inside iOS's per-tab memory at once, and at
 * phone pixel density the difference from 2x is not visible in a moving
 * shader. Everything else keeps the site's usual 2x ceiling.
 */
export function sceneDprCap(): number {
  return isPhoneDevice() ? 1 : 2;
}

/**
 * The height a full-screen scene should cover: --scene-h (globals.css). On a
 * phone or tablet that is the LARGE viewport (100lvh) plus the hero's tail: the strip under iOS Safari's see-through
 * toolbar is screen too, and the services section runs under it
 * (services-section-v3.css). `innerHeight` stops at the toolbar's top edge,
 * so a picture sized from it ended ~40px short of the screen's foot. On
 * desktop the two are equal. Measured once and again on resize, not per
 * frame, so callers can read it in a render loop.
 */
let lvh = 0;
let lvhListening = false;
function measureLvh() {
  const d = document.createElement("div");
  d.style.cssText = "position:absolute;visibility:hidden;top:0;height:var(--scene-h, 100lvh);width:0";
  document.body.appendChild(d);
  lvh = d.offsetHeight;
  d.remove();
}
export function screenHeight(): number {
  if (typeof window === "undefined") return 0;
  if (!lvhListening) {
    lvhListening = true;
    measureLvh();
    window.addEventListener("resize", measureLvh);
  }
  return Math.max(window.innerHeight, lvh);
}
