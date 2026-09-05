"use client";

import { installWebglContextManager } from "@/app/lib/webglContexts";

// At MODULE scope, not in an effect. The wrapper can only see contexts created
// after it is installed, and the first capability probes on this page land
// ~80ms in — well before React has hydrated anything. Evaluating the import is
// the earliest hook available from application code. (It is a no-op on the
// server, and a no-op on a second call.)
installWebglContextManager();

/**
 * Mounted once from the root layout purely to pull the module above into the
 * layout's chunk, so it is evaluated with the first client JS rather than
 * whenever a scene happens to mount. Renders nothing.
 *
 * See webglContexts.ts for why the page needs this at all: it asks for 19
 * WebGL contexts against a cap of 16, and seven of them are abandoned probes
 * that no one can see and no one will free.
 */
export default function WebglBudget() {
  return null;
}
