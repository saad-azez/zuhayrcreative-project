import type { Metadata } from "next";
import CareerGallery from "../components/CareerGallery";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Join Zuhayr Creative — open roles across design, motion, engineering, strategy and AI automation.",
};

export default function CareerPage() {
  return <CareerGallery />;
}
