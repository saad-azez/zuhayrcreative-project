import { notFound } from "next/navigation";

// The Career page isn't finished yet — show the shared not-found / coming-soon
// page until it's ready. (Its previous StackedPanels layout is preserved in git
// and can be restored when the page is built out.)
export default function CareerPage() {
  return notFound();
}
