// The site's way in: the window as a self-contained module, React and three inside it, mounted into an element of the
// host page's. Built by `npm run build:lib` into ../public/shop/shop-window.js; see README.md.
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { ShopWindow, type ShopWindowProps } from './src/ShopWindow'

export type { ShopWindowProps }

/** Renders the window filling `el` (size and place that element yourself) and hands back the way to take it down. */
export function mountShop(el: HTMLElement, props: ShopWindowProps = {}) {
  const root = createRoot(el)
  root.render(createElement(ShopWindow, props))
  return {
    /** Unmounts the scene and frees its GPU memory. */
    destroy() {
      root.unmount()
    },
  }
}
