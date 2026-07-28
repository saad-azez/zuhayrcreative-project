/* ═══════════════════════════════════════════════════════════════════════
   TEMPORARY — scroll diagnostics for the Services "Expand" view.

   Delete this file and its single call site in ServicesSectionV3.tsx once the
   cause is found. Everything it prints is prefixed [svv3].

   What it answers, in order:
     1. Is the page locked?  Five components share one global scroll-lock event
        pair (IdleScreen, Navbar, OrbitingGallery, VerticalGallery) and none of
        them refcount, so an overlapping lock/unlock can leave the page frozen
        with no visible overlay. Every lock/unlock is logged with a stack.
     2. Is Lenis stopped, or is its cached scroll `limit` stale? Growing the
        section changes the document height; if Lenis still holds the old limit
        it refuses to scroll past it.
     3. Does raw input reach the page at all? Every wheel/touch/key scroll
        attempt is checked one frame later — if scrollY didn't move, the reason
        is printed loudly along with the full state.
   ═══════════════════════════════════════════════════════════════════════ */

interface LenisLike {
  isStopped?: boolean;
  animatedScroll?: number;
  targetScroll?: number;
  limit?: number;
}
interface LocoLike {
  lenisInstance?: LenisLike;
}

export interface ScrollDebugRefs {
  stage: HTMLElement | null;
  cols: HTMLElement | null;
  loco: LocoLike | null;
  expanded: boolean;
  isWide: boolean;
}

const B = "color:#C4010D;font-weight:bold";
const OK = "color:#2e9e4f;font-weight:bold";
const BAD = "color:#fff;background:#C4010D;font-weight:bold;padding:1px 4px";

function snapshot(refs: ScrollDebugRefs) {
  const html = document.documentElement;
  const body = document.body;
  const lenis = refs.loco?.lenisInstance;
  const stage = refs.stage;
  const cols = refs.cols;
  const docH = html.scrollHeight;
  const winH = window.innerHeight;

  return {
    // ── is anything holding the page still? ──
    "html.style.overflow": html.style.overflow || "(unset)",
    "body.style.overflow": body.style.overflow || "(unset)",
    "html computed overflow": getComputedStyle(html).overflowY,
    "body computed overflow": getComputedStyle(body).overflowY,
    "body classes": body.className || "(none)",
    // ── Lenis ──
    lenis: lenis
      ? {
          isStopped: lenis.isStopped,
          animatedScroll: Math.round(lenis.animatedScroll ?? -1),
          targetScroll: Math.round(lenis.targetScroll ?? -1),
          limit: Math.round(lenis.limit ?? -1),
          expectedLimit: docH - winH,
          limitIsStale:
            lenis.limit != null && Math.abs(lenis.limit - (docH - winH)) > 2,
        }
      : "(no Lenis — native scroll, expected on touch)",
    // ── page ──
    scrollY: Math.round(window.scrollY),
    docHeight: docH,
    winHeight: winH,
    maxScroll: docH - winH,
    // ── services section ──
    expanded: refs.expanded,
    isWide: refs.isWide,
    stageInlineHeight: stage?.style.height || "(from CSS)",
    stageHeight: stage ? Math.round(stage.getBoundingClientRect().height) : null,
    stageTop: stage ? Math.round(stage.getBoundingClientRect().top) : null,
    colsScrollLeft: cols ? Math.round(cols.scrollLeft) : null,
    colsMaxScroll: cols ? cols.scrollWidth - cols.clientWidth : null,
    colsOverflowX: cols ? getComputedStyle(cols).overflowX : null,
  };
}

/** Walks up from `el` reporting any ancestor that could swallow the gesture. */
function blockingAncestors(el: Element | null) {
  const out: string[] = [];
  let n: Element | null = el;
  while (n && n !== document.documentElement) {
    const cs = getComputedStyle(n);
    const reasons: string[] = [];
    if (cs.overflowY === "hidden" || cs.overflow === "hidden")
      reasons.push(`overflow-y:${cs.overflowY}`);
    if (cs.touchAction !== "auto") reasons.push(`touch-action:${cs.touchAction}`);
    if (cs.position === "fixed") reasons.push("position:fixed");
    if (reasons.length) {
      const cls =
        typeof n.className === "string" && n.className
          ? `.${n.className.trim().split(/\s+/).join(".")}`
          : "";
      out.push(`<${n.tagName.toLowerCase()}${cls}> ${reasons.join(" ")}`);
    }
    n = n.parentElement;
  }
  return out.length ? out : ["(none)"];
}

let installed = false;

/**
 * Install once per page. `getRefs` is called fresh on every log so the numbers
 * always reflect the current render, not the one that installed the listeners.
 */
export function installScrollDebug(getRefs: () => ScrollDebugRefs) {
  if (installed) return () => {};
  installed = true;

  console.log("%c[svv3] scroll diagnostics ARMED", B);
  console.log("[svv3] initial state:", snapshot(getRefs()));

  // ── 1. Who locks the page? ─────────────────────────────────────────
  const onLock = () => {
    console.log(
      "%c[svv3] app:scroll-lock fired — someone froze the page",
      BAD,
      "\nstack:",
      new Error().stack,
    );
  };
  const onUnlock = () => {
    console.log("%c[svv3] app:scroll-unlock fired", OK);
  };
  window.addEventListener("app:scroll-lock", onLock);
  window.addEventListener("app:scroll-unlock", onUnlock);

  // Catch a lock applied directly to the DOM without firing the event.
  let prevBodyOverflow = document.body.style.overflow;
  let prevHtmlOverflow = document.documentElement.style.overflow;
  let prevBodyClass = document.body.className;
  const mo = new MutationObserver(() => {
    const b = document.body.style.overflow;
    const h = document.documentElement.style.overflow;
    const c = document.body.className;
    if (b !== prevBodyOverflow || h !== prevHtmlOverflow) {
      console.log(
        `%c[svv3] inline overflow CHANGED — body:"${prevBodyOverflow || "unset"}"→"${b || "unset"}"  html:"${prevHtmlOverflow || "unset"}"→"${h || "unset"}"`,
        b === "hidden" || h === "hidden" ? BAD : OK,
        "\nstack:",
        new Error().stack,
      );
      prevBodyOverflow = b;
      prevHtmlOverflow = h;
    }
    if (c !== prevBodyClass) {
      console.log(`[svv3] body class: "${prevBodyClass}" → "${c}"`);
      prevBodyClass = c;
    }
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });

  // ── 2 + 3. Did the gesture actually move the page? ─────────────────
  let stuck = 0;
  let lastMovedLog = 0;

  const check = (kind: string, detail: Record<string, unknown>, target: Element | null) => {
    const before = window.scrollY;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const moved = window.scrollY - before;
        const refs = getRefs();
        if (Math.abs(moved) < 0.5) {
          stuck++;
          // Loud for the first few, then every 10th, so the console stays usable.
          if (stuck <= 6 || stuck % 10 === 0) {
            console.log(
              `%c[svv3] ${kind} DID NOT MOVE THE PAGE  (attempt #${stuck})`,
              BAD,
              "\n  event:",
              detail,
              "\n  target:",
              target
                ? `<${target.tagName.toLowerCase()} class="${typeof target.className === "string" ? target.className : ""}">`
                : "(none)",
              "\n  blocking ancestors of target:",
              blockingAncestors(target),
              "\n  state:",
              snapshot(refs),
            );
          }
        } else {
          if (stuck > 0) {
            console.log(`%c[svv3] scrolling recovered after ${stuck} blocked attempts`, OK);
            stuck = 0;
          }
          const now = performance.now();
          if (now - lastMovedLog > 400) {
            lastMovedLog = now;
            const s = snapshot(refs);
            console.log(
              `[svv3] ${kind} moved ${moved.toFixed(0)}px → scrollY=${s.scrollY} stageTop=${s.stageTop} colsLeft=${s.colsScrollLeft}/${s.colsMaxScroll}`,
            );
          }
        }
      }),
    );
  };

  const onWheel = (e: WheelEvent) =>
    check(
      "wheel",
      { deltaY: Math.round(e.deltaY), defaultPrevented: e.defaultPrevented, ctrl: e.ctrlKey },
      e.target as Element,
    );
  const onTouchMove = (e: TouchEvent) =>
    check(
      "touchmove",
      { touches: e.touches.length, defaultPrevented: e.defaultPrevented },
      e.target as Element,
    );
  const onKey = (e: KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "End", "Home"].includes(e.key))
      return;
    check("key:" + e.key, { defaultPrevented: e.defaultPrevented }, e.target as Element);
  };

  // Capture phase + passive: observes without altering behaviour.
  window.addEventListener("wheel", onWheel, { capture: true, passive: true });
  window.addEventListener("touchmove", onTouchMove, { capture: true, passive: true });
  window.addEventListener("keydown", onKey, { capture: true, passive: true });

  return () => {
    window.removeEventListener("app:scroll-lock", onLock);
    window.removeEventListener("app:scroll-unlock", onUnlock);
    window.removeEventListener("wheel", onWheel, { capture: true });
    window.removeEventListener("touchmove", onTouchMove, { capture: true });
    window.removeEventListener("keydown", onKey, { capture: true });
    mo.disconnect();
    installed = false;
  };
}

/** One-off labelled snapshot, for milestones like "Expand clicked". */
export function logScrollMoment(label: string, refs: ScrollDebugRefs) {
  console.log(`%c[svv3] ${label}`, B, snapshot(refs));
}

/**
 * Re-reads Lenis's cached scroll limit after the layout has settled. A limit
 * that is stale for one frame is harmless (Lenis's own ResizeObserver catches
 * up); one that is STILL stale here means scrolling is clamped to the old
 * document height and the bottom of the page is unreachable.
 */
export function verifyLimitAfterResize(refs: ScrollDebugRefs, delayMs = 600) {
  window.setTimeout(() => {
    const s = snapshot(refs);
    if (typeof s.lenis === "string") return;
    if (s.lenis.limitIsStale) {
      console.log(
        `%c[svv3] Lenis limit STILL STALE ${delayMs}ms after resize — page is clamped to ${s.lenis.limit}px but the document needs ${s.lenis.expectedLimit}px. The last ${s.lenis.expectedLimit - s.lenis.limit}px are unreachable.`,
        BAD,
        s,
      );
    } else {
      console.log(
        `%c[svv3] Lenis limit recovered after resize (${s.lenis.limit} = expected ${s.lenis.expectedLimit})`,
        OK,
      );
    }
  }, delayMs);
}
