/**
 * The site's destinations. Shared by the fullscreen menu (Navbar) and the
 * strip of section names along the top of the screen (NavHud), so the two can
 * never list different things. The strip has one name more: see HUD_ITEMS.
 */

export interface NavItem {
  label: string;
  href: string;
}

// Each href maps to a real section id on the home page (#…) or a real route.
export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  // Stays a clean "/" so the address bar never picks up a hash. Clicking it
  // while already on the home page is handled in handleNavClick, which scrolls
  // back to the top instead of re-navigating to the route you are on.
  { label: "Home", href: "/" },
  { label: "Services", href: "/#services" },
  { label: "Work", href: "/#work" },
  // Seasons — the club globe, now a section on the home page (#seasons).
  { label: "Seasons", href: "/#seasons" },
  // Hidden — their sections (reviews / below-footer) are currently hidden.
  // { label: "Clients", href: "/#testimonials" },
  // { label: "About", href: "/#about" },
  { label: "Careers", href: "/career" },
  { label: "Club", href: "/club" },
  // Notes — the 3D notebook, on a page of its own (client, 12 Oct).
  { label: "Notes", href: "/notes" },
  { label: "Contact", href: "/contact" },
];

/**
 * The strip's names: the menu's, and "End" for the foot of the home page.
 *
 * The strip says where the reader IS, and from the footer down there was no
 * name to say it with, so it stayed on the last one it had (client, 14 Oct:
 * "when you reach footer the nav bar stays at seasons because there's no name
 * for that section so just add the name End for the footer"). It sits after
 * the last of the home page's sections, where the footer is on the page. The
 * menu is a list of places to go and does not have it.
 */
const END: NavItem = { label: "End", href: "/#contact-footer" };
const lastSection = NAV_ITEMS.reduce(
  (last, item, i) => (item.href.startsWith("/#") ? i : last),
  0,
);
export const HUD_ITEMS: ReadonlyArray<NavItem> = [
  ...NAV_ITEMS.slice(0, lastSection + 1),
  END,
  ...NAV_ITEMS.slice(lastSection + 1),
];
