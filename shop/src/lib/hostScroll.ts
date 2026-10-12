// The window is one section of somebody else's page, and that page's scrolling comes first. Work that can wait (the
// warm-up, the texture uploads) asks here whether a scroll is in progress and steps aside until it is not.
let last = 0
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', () => { last = performance.now() }, { passive: true })
}

/** Milliseconds since the host page last scrolled. */
export const sinceScroll = (): number => performance.now() - last
/** True once the page has been still for a moment. */
export const pageIsStill = (): boolean => sinceScroll() > 300
