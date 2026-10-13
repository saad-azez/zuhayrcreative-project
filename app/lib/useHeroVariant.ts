"use client";

import { useSyncExternalStore } from "react";
import { HERO_VARIANT, readHeroVariant, type HeroVariant } from "./heroVariant";

const subscribeToNothing = () => () => {};

/**
 * Which hero variant this visit is on (lib/heroVariant.ts), for the pieces of
 * the page that differ with it: the hero's own background, and the wording of
 * its call to action there and in the footer.
 *
 * The server can only know the default, so that is what is rendered and
 * hydrated; a visit that asked for another one (`?hero=`) is re-rendered with
 * it in the same pass, under the loader's curtain. Nothing in the address
 * changes while a page is mounted, hence nothing to subscribe to.
 */
export function useHeroVariant(): HeroVariant {
  return useSyncExternalStore(
    subscribeToNothing,
    readHeroVariant,
    () => HERO_VARIANT,
  );
}

/**
 * The call to action's wording: "Let's Talk" on the site as it is, and "Talk
 * to Us" under the two variants being tried (client, 14 Oct: "in the two new
 * variants change let's talk in hero and footer to TALK TO US"). Both places
 * set it in capitals themselves.
 */
export function talkLabel(variant: HeroVariant): string {
  return variant === "scene" ? "Let's Talk" : "Talk to Us";
}

/** The same call to action as a sentence, for the link's accessible name. */
export function talkAriaLabel(variant: HeroVariant): string {
  return `${variant === "scene" ? "Let's talk" : "Talk to us"} — we're accepting new projects`;
}
