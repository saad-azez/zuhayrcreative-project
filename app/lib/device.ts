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
 * render at 1.5x: at DPR 3 that is a quarter of the native pixels, which is
 * what keeps several scenes inside iOS's per-tab memory at once, and at
 * phone pixel density the difference from 2x is not visible in a moving
 * shader. Everything else keeps the site's usual 2x ceiling.
 */
export function sceneDprCap(): number {
  return isPhoneDevice() ? 1.5 : 2;
}
