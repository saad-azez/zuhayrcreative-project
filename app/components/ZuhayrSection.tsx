"use client";

import { useState, useRef } from "react";
import gsap from "gsap";

const LETTERS = [
  { char: "Z", image: "https://media.giphy.com/media/l41JU9pAfOI5iOkSTe/giphy.gif" }, // Tiger Walking (Animal)
  { char: "U", image: "https://media.giphy.com/media/l0HlS7eU9Zc7n2w0g/giphy.gif" }, // Skateboarder (Human)
  { char: "H", image: "https://media.giphy.com/media/3o7qE1YN7aBOFPRw8E/giphy.gif" }, // Floating Astronaut (Human)
  { char: "A", image: "https://media.giphy.com/media/3o7qDQ4kcSD1PLM3BK/giphy.gif" }, // Flying Bird (Animal)
  { char: "Y", image: "https://media.giphy.com/media/l2JhyONVYmD4bppTi/giphy.gif" }, // Dancing Skeleton (Character)
  { char: "R", image: "https://media.giphy.com/media/3oEduJn935VFB5Wf6w/giphy.gif" }, // Running Cheetah (Animal)
];

export default function ZuhayrSection() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const letterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isAnyHovered = hoveredIndex !== null;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    const el = letterRefs.current[index];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relativeX = (mouseX / rect.width) - 0.5; // -0.5 to 0.5
    const rotY = relativeX * 36; // Max 18 degrees rotation on either side

    gsap.to(el, {
      rotateY: rotY,
      scaleY: 1.45, // Retain vertical stretch during active 3D tilt
      transformPerspective: 1000,
      duration: 0.35,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handleMouseLeave = (index: number) => {
    setHoveredIndex(null);
    const el = letterRefs.current[index];
    if (!el) return;

    gsap.to(el, {
      rotateY: 0,
      scaleY: 1.45, // Retain vertical stretch when flat
      transformPerspective: 1000,
      duration: 0.6,
      ease: "power3.out",
      overwrite: "auto",
    });
  };

  return (
    <section className="relative z-10 w-full bg-background border-t border-maroon-light/10 py-20 md:py-32 overflow-hidden select-none px-0">
      <div className="w-full flex justify-center items-center px-0">
        {/* Full screen edge-to-edge grouping for ZUHAYR text block */}
        <div className="flex flex-row flex-nowrap justify-center items-center gap-0 tracking-[-0.07em] w-full text-center px-0 leading-[0.75]">
          {LETTERS.map((item, index) => {
            const isHovered = hoveredIndex === index;
            return (
              <div
                key={index}
                ref={(el) => {
                  letterRefs.current[index] = el;
                }}
                className="relative uppercase select-none cursor-pointer"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => handleMouseLeave(index)}
                onMouseMove={(e) => handleMouseMove(e, index)}
                style={{
                  display: "inline-block",
                  opacity: isHovered ? 1 : isAnyHovered ? 0.35 : 1,
                  transition: "opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
                  transformStyle: "preserve-3d",
                  willChange: "transform",
                  transform: "perspective(1000px) scaleY(1.45)", // Vertical stretch
                }}
              >
                {/* Base text: solid white */}
                <span
                  className="font-tomato text-[24vw] leading-[0.75] uppercase select-none"
                  style={{
                    color: "#FFFFFF",
                    textShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
                    display: "block",
                  }}
                >
                  {item.char}
                </span>

                {/* Textured overlay text: fades in on hover */}
                <span
                  className="font-tomato text-[24vw] leading-[0.75] uppercase select-none absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `url(${item.image})`,
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    color: "transparent",
                    WebkitTextFillColor: "transparent",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    opacity: isHovered ? 1 : 0,
                    transition: "opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                    display: "block",
                  }}
                >
                  {item.char}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
