"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const ITEMS = [
  { label: "WEB DESIGN", hover: "CRAFTED FOR IMPACT" },
  { label: "AI AUTOMATION", hover: "MULTIPLY OUTPUT" },
  { label: "FULL-STACK DEV", hover: "PRODUCTION READY" },
  { label: "SOCIAL MEDIA", hover: "AUTHENTIC GROWTH" },
  { label: "SEO STRATEGY", hover: "BUILT TO RANK" },
];

export default function TextRevealSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const texts = gsap.utils.toArray<HTMLElement>(".tr-text");

      texts.forEach((text) => {
        gsap.to(text, {
          backgroundSize: "100%",
          ease: "none",
          scrollTrigger: {
            trigger: text,
            start: "center 80%",
            end: "center 20%",
            scrub: true,
          },
        });
      });
    },
    { scope: containerRef }
  );

  return (
    <>
      <style>{`
        .tr-text {
          font-size: clamp(2.75rem, 8.5vw, 9vw);
          font-weight: 800;
          letter-spacing: -0.025em;
          line-height: 1;
          margin: 0;
          width: 100%;
          color: rgba(255, 255, 255, 0.07);
          background: linear-gradient(to right, #ffffff, #dc143c) no-repeat;
          -webkit-background-clip: text;
          background-clip: text;
          background-size: 0%;
          transition: background-size cubic-bezier(0.1, 0.5, 0.5, 1) 0.5s;
          border-bottom: 1px solid #1a1a1a;
          display: flex;
          align-items: center;
          position: relative;
          padding: 1.5rem 0;
          cursor: default;
          font-family: var(--font-geist-sans);
        }

        .tr-span {
          position: absolute;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: #dc143c;
          color: #0a0a0a;
          clip-path: polygon(0 50%, 100% 50%, 100% 50%, 0 50%);
          transform-origin: center;
          transition: clip-path cubic-bezier(0.1, 0.5, 0.5, 1) 0.42s;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 0;
          font-size: clamp(0.9rem, 2.5vw, 2.5vw);
          letter-spacing: 0.12em;
          font-weight: 900;
          font-family: var(--font-geist-sans);
        }

        .tr-text:hover .tr-span {
          clip-path: polygon(0 0, 100% 0, 100% 100%, 0% 100%);
        }
      `}</style>

      <section
        ref={containerRef}
        className="bg-background px-[5%] pt-24 pb-32"
      >
        <div className="mb-14 flex flex-col gap-2">
          <span
            className="text-title-red text-xs tracking-[0.25em] uppercase"
            style={{ fontFamily: "var(--font-geist-mono)" }}
          >
            Our Capabilities
          </span>
          <p className="text-foreground-subtle text-sm max-w-xs leading-relaxed">
            Scroll to reveal. Hover to explore.
          </p>
        </div>

        <div className="flex flex-col border-t border-[#1a1a1a]">
          {ITEMS.map((item) => (
            <h2 key={item.label} className="tr-text">
              {item.label}
              <span className="tr-span">{item.hover}</span>
            </h2>
          ))}
        </div>
      </section>
    </>
  );
}
