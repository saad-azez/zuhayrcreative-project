"use client";

import { useEffect, useState } from "react";
import { readHeroVariant } from "@/app/lib/heroVariant";

/**
 * The line above the notebook that says what it is: the founder's own
 * notebook, made into a 3D asset (client, 26 Oct). The model draft only, for
 * now, like the pages inside it; read after mount, since the variant lives in
 * the address.
 */
export default function NotesIntro() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(readHeroVariant() === "model"), []);
  if (!show) return null;
  return (
    <p
      className="mt-5 max-w-xl text-balance text-[0.85rem] leading-relaxed text-white/85 [text-shadow:0_1px_12px_rgba(0,0,0,0.55)]"
      style={{ fontFamily: "var(--font-departure)" }}
    >
      The founder&rsquo;s real notebook, rendered as a 3D digital asset.
    </p>
  );
}
