"use client";

import { installWebglContextManager } from "@/app/lib/webglContexts";
import { quietThreeDeprecations } from "@/app/lib/quietThreeDeprecations";
import { markPhoneOnHtml } from "@/app/lib/device";
import { markGpuOnHtml } from "@/app/lib/gpu";

// At MODULE scope, not in an effect. The wrapper can only see contexts created
// after it is installed, and the first capability probes on this page land
// ~80ms in — well before React has hydrated anything. Evaluating the import is
// the earliest hook available from application code. (It is a no-op on the
// server, and a no-op on a second call.)
// The phone debug log (lib/mobileDebug.ts) first of all, so it sees the
// context manager's first grants and any error from here on. A no-op unless
// debugging is on (phones, or ?debug=1).
markPhoneOnHtml();
// Whether a GPU is drawing at all, settled before the first scene asks. On a
// software rasteriser the scenes stay off: see lib/gpu.ts for the numbers.
markGpuOnHtml();
installWebglContextManager();
// Same reason to run here: it has to be in place before the first <Canvas>
// mounts. See the file for why a console filter is the only lever available.
quietThreeDeprecations();

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
