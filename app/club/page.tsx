import type { Metadata } from "next";
import { notFound } from "next/navigation";
// import UnicornBackground from "../components/UnicornBackground";
// import ClubSlider from "../components/ClubSlider";

export const metadata: Metadata = {
  title: "The Club",
  description:
    "The Club — an endless strip from Zuhayr Creative's archive. Drag to explore.",
};

/**
 * The Club — back to "coming soon" for now (client, 12 Oct: "change the club
 * page back to the coming soon and add a new page named notes"). As it was
 * before the page was first built: the shared not-found / coming-soon page
 * (app/not-found.tsx).
 *
 * The slider that was here (ClubSlider) stays in the tree, unmounted. To
 * bring it back, restore the two imports above and return this instead:
 *
 *   <>
 *     <UnicornBackground />
 *     <main className="relative w-full max-w-full overflow-x-hidden">
 *       <ClubSlider />
 *     </main>
 *   </>
 */
export default function ClubPage() {
  return notFound();
}
