---
name: verify
description: How to build, launch, and drive this Next.js site to verify changes at runtime (dev server + Playwright screenshots).
---

# Verifying zuhayr-creative changes

## Launch

- The user often already has `next dev` running on **http://localhost:3000** — probe it first (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`). A second `npm run dev` will bind 3001 and then **exit with "Another next dev server is already running"** — reuse the existing server instead.
- Turbopack hot-reloads file edits; a fresh page load in the driver picks up changes without restarting.

## Drive (GUI surface)

- No Playwright in the repo. Install it in the session scratchpad (`npm init -y && npm i playwright`) and launch with the system browser — `chromium.launch({ channel: "msedge", headless: true })` — so no browser download is needed.
- Screenshot + interact via a small `.mjs` script; collect `console`/`pageerror` events — WebGL/R3F failures often surface only there.
- **Wait ~4–5s after `goto`** before asserting anything: `app/template.tsx` plays a LoadingScreen on every navigation, and WebGL scenes/textures need time to settle.

## Gotchas

- `app/template.tsx` injects global chrome on **every** route: LoadingScreen, Navbar (hamburger, top-left), GlobalCursor (DOM element that follows the pointer), IdleScreen, ScrollBlur, LocomotiveScroll. Don't mistake these for the page under test; new pages must not overlap the hamburger (top-left ~84px) .
- The black "N" circle bottom-left is the **Next.js dev-tools badge** — dev only, not site chrome.
- ESLint runs the React Compiler rules: mutating props/hook returns in render, `useMemo`, `useEffect`, or `useFrame` is an error. Use refs (`fooRef.current`) for R3F mutable state and dashed props (`map-colorSpace={...}`) for texture/material config.
- `pointerdown` handlers that call `setPointerCapture` immediately swallow all child clicks (R3F `onClick`, buttons, links). Capture only after a movement threshold.
