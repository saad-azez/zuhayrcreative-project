"use client";

import { useEffect } from "react";

/**
 * The door to the frame recorder, and nothing else.
 *
 * With no `?perf=1` on the URL this renders nothing, fetches nothing and
 * leaves no trace: the recorder lives in its own chunk that is only imported
 * once the flag is seen, so the site a visitor gets is unchanged. That was the
 * condition the debug scaffolding was stripped under (ba9679a) and it still
 * holds — there is nothing here to turn off, because there is nothing on.
 *
 * See lib/perfRecorder for what it measures and how to read it.
 */
export default function PerfProbe() {
  useEffect(() => {
    let params: URLSearchParams;
    try {
      params = new URLSearchParams(window.location.search);
    } catch {
      return;
    }
    if (params.get("perf") !== "1") return;
    let stop: (() => void) | undefined;
    void import("@/app/lib/perfRecorder").then((m) => {
      m.installPerfRecorder();
      stop = m.stopPerfRecorder;
    });
    return () => stop?.();
  }, []);

  return null;
}
