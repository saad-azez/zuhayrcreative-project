import type { Metadata } from "next";
import CareerGallery from "../components/CareerGallery";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Join Zuhayr Creative — open roles for an AI Specialist, Creative Direction, Designer, Motion Design and Web Developer.",
};

export default function CareerPage() {
  return <CareerGallery />;
}
