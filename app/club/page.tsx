import type { Metadata } from "next";
import ClubGlobe from "../components/ClubGlobe";

export const metadata: Metadata = {
  title: "The Club",
  description:
    "The Club — a living archive of Zuhayr Creative's world, projected onto a globe and unfolding into an endless grid.",
};

export default function ClubPage() {
  return <ClubGlobe />;
}
