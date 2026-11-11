"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { clearLog, getVersion, installPerfDebug, live, report, subscribe } from "@/app/lib/perfDebug";

/**
 * The performance debug panel (`?debug=1`; see lib/perfDebug.ts). A pill in
 * the bottom-left corner with the live fps, what is on screen and the freezes
 * so far; tapped, the latest events and the buttons:
 *
 *   Copy report    the whole report to the clipboard (and the console)
 *   Show report    the report as selectable text: over plain http (a phone on
 *                  the office Wi-Fi) the clipboard is not available
 *   Previous load  the last load's report, kept in case the phone killed it
 *   Clear          start counting again from now
 *
 * Its own cost is small: it re-renders at most once a second, with the
 * collector's numbers. It is kept out of the glitch reveal (data-no-glitch)
 * and out of the smooth scroll (data-lenis-prevent), so it is only itself.
 */

const box: React.CSSProperties = {
  position: "fixed",
  left: 8,
  bottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
  zIndex: 2147483000,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: 11,
  lineHeight: 1.4,
  color: "#eaeaea",
  background: "rgba(8, 8, 10, 0.88)",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  borderRadius: 8,
  WebkitTextSizeAdjust: "100%",
};
const button: React.CSSProperties = {
  font: "inherit",
  color: "#fff",
  background: "rgba(255, 255, 255, 0.12)",
  border: "1px solid rgba(255, 255, 255, 0.25)",
  borderRadius: 6,
  padding: "6px 8px",
};

/** Copies text where the clipboard API is not available (plain http): a selected textarea and the old copy command. */
function copyFallback(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  Object.assign(ta.style, { position: "fixed", top: "0", left: "0", opacity: "0" });
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

export default function DebugPanel() {
  useEffect(() => {
    installPerfDebug();
  }, []);
  useSyncExternalStore(subscribe, getVersion, () => 0);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const s = live();

  const copy = async (text: string, what: string) => {
    console.log(text);
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = copyFallback(text);
    if (ok) setNote(`${what} copied`);
    else {
      // Last resort: show it, selected, for a long-press copy.
      setShown(text);
      setNote("Could not copy: select the text below and copy it");
    }
  };

  // When a report is shown, select it all, ready to copy by hand.
  useEffect(() => {
    if (shown && textRef.current) textRef.current.select();
  }, [shown]);

  if (!open) {
    return (
      <button
        type="button"
        data-no-glitch
        aria-label="Open the performance debug panel"
        onClick={() => setOpen(true)}
        style={{ ...box, padding: "6px 10px", cursor: "pointer", textAlign: "left" }}
      >
        <b style={{ color: s.fps && s.fps < 30 ? "#ff6b6b" : "#7dff9b" }}>{s.fps || "…"} fps</b> · {s.where} · freezes {s.freezes}
        {s.lost ? ` · GL lost ${s.lost}` : ""}
        {s.errors ? ` · errors ${s.errors}` : ""}
      </button>
    );
  }

  return (
    <div
      data-no-glitch
      data-lenis-prevent
      role="region"
      aria-label="Performance debug"
      style={{
        ...box,
        width: "min(92vw, 460px)",
        maxHeight: "62vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
        <div>
          <b style={{ color: s.fps && s.fps < 30 ? "#ff6b6b" : "#7dff9b" }}>{s.fps || "…"} fps</b> · {s.where} · freezes{" "}
          {s.freezes} · GL made {s.contexts}, lost {s.lost} · errors {s.errors}
        </div>
        <div style={{ opacity: 0.75, marginTop: 2 }}>{s.busiest || "no WebGL drawing this second"}</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 10px" }}>
        <button type="button" style={button} onClick={() => copy(report(), "Report")}>
          Copy report
        </button>
        <button type="button" style={button} onClick={() => setShown(shown ? null : report())}>
          {shown ? "Hide report" : "Show report"}
        </button>
        {s.previous ? (
          <button type="button" style={button} onClick={() => setShown(s.previous)}>
            Previous load{s.previousClean ? "" : " (ended badly)"}
          </button>
        ) : null}
        <button type="button" style={button} onClick={() => { clearLog(); setNote("Cleared"); }}>
          Clear
        </button>
        <button type="button" style={button} onClick={() => { setOpen(false); setShown(null); }}>
          Hide
        </button>
      </div>
      {note ? <div style={{ padding: "0 10px 6px", color: "#ffd479" }}>{note}</div> : null}

      {shown !== null ? (
        <textarea
          ref={textRef}
          readOnly
          value={shown}
          style={{
            flex: 1,
            minHeight: 200,
            margin: "0 10px 10px",
            font: "inherit",
            fontSize: 10,
            color: "#eaeaea",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6,
            padding: 6,
          }}
        />
      ) : (
        <div style={{ overflowY: "auto", overscrollBehavior: "contain", padding: "0 10px 10px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {s.events.length ? [...s.events].reverse().map((e, i) => <div key={i} style={{ padding: "2px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{e}</div>) : "Nothing yet. Use the site; freezes, lost contexts and errors appear here."}
        </div>
      )}
    </div>
  );
}
