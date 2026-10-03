/**
 * Production settings for a three.js renderer. Call once, right after the
 * renderer is created (a react-three-fiber Canvas: from `onCreated`).
 *
 * `checkShaderErrors` is on by default, and with it three reads every
 * program's link status and info log the moment it is compiled. Those reads
 * make the driver finish compiling there and then, on the main thread,
 * instead of in parallel with the page. Profiled scrolling the home page on
 * a tablet: ~600ms (at a 4x CPU throttle) inside getProgramParameter and
 * getProgramInfoLog, landing as each section's scene first drew. three's own
 * advice is to turn it off in production; development keeps it, so a broken
 * shader still reports itself where someone is looking.
 */
export function tuneRendererForProduction(renderer: {
  debug: { checkShaderErrors: boolean };
}) {
  if (process.env.NODE_ENV === "production") {
    renderer.debug.checkShaderErrors = false;
  }
}
