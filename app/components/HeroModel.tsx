"use client";

import { useSyncExternalStore } from "react";
import { isPhoneDevice } from "@/app/lib/device";
import HeroModelDesktop from "./HeroModelDesktop";
import HeroModelPhone from "./HeroModelPhone";

/**
 * The model hero (draft). Desktop runs the approved 22 Oct build as it was
 * (HeroModelDesktop: the 4K lift, then the full-size still); phones run their
 * own (HeroModelPhone: the lift as a frame sequence, framed to fill a
 * portrait screen). Kept apart so phone work can never touch desktop.
 */
const noSubscribe = () => () => {};
const kind = () => (isPhoneDevice() ? "phone" : "desktop");
const serverKind = () => null;

export default function HeroModel() {
  const k = useSyncExternalStore(noSubscribe, kind, serverKind);
  if (k === "phone") return <HeroModelPhone />;
  if (k === "desktop") return <HeroModelDesktop />;
  return null;
}
