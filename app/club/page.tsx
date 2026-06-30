import { notFound } from "next/navigation";

// The Club page isn't built yet — show the shared not-found / coming-soon page
// until it's ready.
export default function ClubPage() {
  return notFound();
}
