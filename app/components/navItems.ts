/**
 * The site's destinations. Shared by the fullscreen menu (Navbar) and the
 * strip of section names along the top of the screen (NavHud), so the two can
 * never list different things.
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
  { label: "Contact", href: "/contact" },
];
