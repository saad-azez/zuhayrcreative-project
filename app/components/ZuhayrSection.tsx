"use client";

import { useState, useRef } from "react";
import gsap from "gsap";

// 6 human-themed Giphy assets — only people (female, male) animated.
// One distinct portrait/figure per letter.
const LETTERS = [
  {
    char: "Z",
    image:
      "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcmlycGYwaHdjbW9xNzdxeGFva2R3ejRkd25iM3J2bTh6Y216bjhwdiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/VbEuHLBUPQm55MyqJg/giphy.gif",
    theme: "Fashion Model",
  },
  {
    char: "U",
    image:
      "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExNGw0bTB4YWRwN2E3ZW4wZDNsNmp6YWlncjdhZDB6aXN3Y2R4bWpuZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xkmQfH1TB0dLW/giphy.gif",
    theme: "Studio Portrait",
  },
  {
    char: "H",
    image:
      "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExYndxcjdsa2JxdTVjcDlzYTJzOXA4dzJrd3RhN2VhYmE2NzlkZzJidiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/D4zbzXKSl9tOE/giphy.gif",
    theme: "Editorial Shot",
  },
  {
    char: "A",
    image:
      "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTNxOWFpNDl4d3R2dTBuMjZsczV4cXpva3FqMHR1NWhzbmt0ZGxqZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/A0Ws0HMCureM4KzrpN/giphy.gif",
    theme: "Dancer",
  },
  {
    char: "Y",
    image:
      "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGljZm9kdjl5enN1d3F3OXNhZHF4aWZrdHNyOGU2MTBlMzY3ZXZ3ciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/cU7jXQjldnZ7y/giphy.gif",
    theme: "Runway",
  },
  {
    char: "R",
    image:
      "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExc3kwNGFjZWhyd3Y0cTZrazl0bndkYTVhZW1tanhpNHc2bGxzaWhtaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/MkkCnoC53hF7y/giphy.gif",
    theme: "Street Style",
  },
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
      scaleY: 1.2, // Same as base — never grow on hover.
      transformPerspective: 1200,
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
      scaleY: 1.2, // Same as base — keep size locked.
      transformPerspective: 1200,
      duration: 0.6,
      ease: "power3.out",
      overwrite: "auto",
    });
  };

  return (
    <section className="zuhayr-section relative z-10 w-full bg-background border-t border-maroon-light/10 py-20 md:py-32 overflow-hidden select-none px-0">
      {/* Eyebrow label above wordmark */}
      <div className="absolute top-6 sm:top-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <span className="text-[10px] sm:text-xs tracking-[0.4em] uppercase text-white/40 font-mono">
          {hoveredIndex !== null
            ? LETTERS[hoveredIndex].theme
            : "— Hover Each Letter —"}
        </span>
      </div>

      {/* Full-bleed: each letter takes 1/6 of the viewport (flex-1).
          Font-size is dialed so glyphs touch their cell edges → letters
          appear locked together edge-to-edge across the whole screen. */}
      <div className="w-screen flex flex-row flex-nowrap items-end justify-between leading-none">
        {LETTERS.map((item, index) => {
          const isHovered = hoveredIndex === index;
          return (
            <div
              key={index}
              ref={(el) => {
                letterRefs.current[index] = el;
              }}
              className="flex-1 relative cursor-pointer uppercase select-none zuhayr-letter text-center"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => handleMouseLeave(index)}
              onMouseMove={(e) => handleMouseMove(e, index)}
              style={{
                opacity: isHovered ? 1 : isAnyHovered ? 0.18 : 1,
                transition:
                  "opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
                transformStyle: "preserve-3d",
                willChange: "transform",
                transform: "perspective(1200px) scaleY(1.2)",
              }}
            >
              {/* Base text: heavy white with depth shadow */}
              <span
                className="font-anton uppercase select-none"
                style={{
                  fontSize: "30vw",
                  lineHeight: 0.85,
                  letterSpacing: "-0.04em",
                  color: "#ffffff",
                  fontWeight: 900,
                  WebkitTextStroke: "1px rgba(255,255,255,0.04)",
                  textShadow:
                    "0 6px 30px rgba(220, 20, 60, 0.18), 0 2px 8px rgba(0,0,0,0.55)",
                  display: "block",
                }}
              >
                {item.char}
              </span>

              {/* GIF-clipped overlay — fades in on hover, covers letter shape */}
              <span
                className="font-anton uppercase select-none absolute inset-0 pointer-events-none"
                style={{
                  fontSize: "30vw",
                  lineHeight: 0.85,
                  letterSpacing: "-0.04em",
                  backgroundImage: `url(${item.image})`,
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                  WebkitTextFillColor: "transparent",
                  backgroundSize: "cover",
                  backgroundPosition: "center center",
                  backgroundRepeat: "no-repeat",
                  fontWeight: 900,
                  opacity: isHovered ? 1 : 0,
                  transition:
                    "opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                  display: "block",
                  filter: "contrast(1.2) saturate(1.3)",
                }}
              >
                {item.char}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
